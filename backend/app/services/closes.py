from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ClientStatus, DayClose
from app.services.clients import load_all_clients
from app.services.pedidos import lookup_many, lookup_pedido
from app.services.televendas import TEAM, scoped_seller_ids

KIND_STATUS = {
    "finalizado": "finalizado",
    "nao_venda": "nao_venda",
    "nao_recuperado": "nao_recuperado",
}


def _team_name(vid: int | None) -> str | None:
    for c in TEAM:
        if c.vendedor_id == vid:
            return c.nome
    return None


async def _touch_status(session: AsyncSession, cliente_id: int, status_id: str, user: dict) -> None:
    row = await session.get(ClientStatus, cliente_id)
    if row is None:
        row = ClientStatus(cliente_id=cliente_id)
        session.add(row)
    row.status_id = status_id
    row.updated_by = user.get("login") or user.get("nome")
    row.updated_at = datetime.utcnow()


async def finalize(
    session: AsyncSession,
    cliente_id: int,
    user: dict,
    codigo_pedido: str,
    valor_total: float | None,
    origem: str = "carteira",
    dia: date | None = None,
) -> dict:
    day = dia or date.today()
    sellers = scoped_seller_ids(user, None)
    vendedor_id = user.get("vendedor_id") if user.get("role") == "colaborador" else next(iter(sellers), None)
    if user.get("role") == "adm" and vendedor_id is None:
        vendedor_id = next(iter(sellers), 0)

    found = await lookup_pedido(codigo_pedido)
    valor = found.get("valor_total") if found.get("found") else valor_total
    if valor is None:
        raise ValueError("Pedido não está no banco ainda. Informe o valor total.")

    clients = {c["id"]: c for c in await load_all_clients()}
    client = clients.get(cliente_id) or {}
    existing = (
        await session.execute(
            select(DayClose).where(
                DayClose.cliente_id == cliente_id,
                DayClose.dia == day,
                DayClose.origem == origem,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        existing = DayClose(cliente_id=cliente_id, dia=day, origem=origem)
        session.add(existing)
    existing.vendedor_id = int(vendedor_id or client.get("vendedor_id") or 0)
    existing.kind = "finalizado"
    existing.codigo_pedido = str(found.get("codigo") or codigo_pedido)
    existing.valor_total = float(valor)
    existing.itens = found.get("itens") if found.get("found") else None
    existing.synced = bool(found.get("found"))
    existing.data_pedido = date.fromisoformat(found["data_pedido"]) if found.get("data_pedido") else day
    existing.data_emissao = date.fromisoformat(found["data_emissao"]) if found.get("data_emissao") else None
    existing.cidade = client.get("cidade")
    existing.rota_id = client.get("rota_id")
    existing.rota_nome = client.get("rota_nome")
    existing.cliente_nome = client.get("nome")
    existing.vendedor_nome = _team_name(existing.vendedor_id) or client.get("vendedor_nome")
    existing.created_by = user.get("login") or user.get("nome")
    existing.updated_at = datetime.utcnow()
    await _touch_status(session, cliente_id, "finalizado", user)
    await session.commit()
    await session.refresh(existing)
    return _dump(existing)


async def close_without_sale(
    session: AsyncSession,
    cliente_id: int,
    user: dict,
    kind: str,
    motivo: str,
    origem: str = "carteira",
    dia: date | None = None,
) -> dict:
    if kind not in {"nao_venda", "nao_recuperado", "nao_atendido"}:
        raise ValueError("Tipo de encerramento inválido.")
    if kind != "nao_atendido" and not (motivo or "").strip():
        raise ValueError("Informe o motivo.")
    day = dia or date.today()
    sellers = scoped_seller_ids(user, None)
    vendedor_id = user.get("vendedor_id") if user.get("role") == "colaborador" else next(iter(sellers), 0)
    clients = {c["id"]: c for c in await load_all_clients()}
    client = clients.get(cliente_id) or {}
    existing = (
        await session.execute(
            select(DayClose).where(
                DayClose.cliente_id == cliente_id,
                DayClose.dia == day,
                DayClose.origem == origem,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        existing = DayClose(cliente_id=cliente_id, dia=day, origem=origem)
        session.add(existing)
    existing.vendedor_id = int(vendedor_id or client.get("vendedor_id") or 0)
    existing.kind = kind
    existing.motivo = (motivo or "").strip() or ("Não atendeu" if kind == "nao_atendido" else None)
    existing.cidade = client.get("cidade")
    existing.rota_id = client.get("rota_id")
    existing.rota_nome = client.get("rota_nome")
    existing.cliente_nome = client.get("nome")
    existing.vendedor_nome = _team_name(existing.vendedor_id) or client.get("vendedor_nome")
    existing.created_by = user.get("login") or user.get("nome")
    existing.updated_at = datetime.utcnow()
    await _touch_status(session, cliente_id, kind, user)
    await session.commit()
    await session.refresh(existing)
    return _dump(existing)


def _dump(row: DayClose) -> dict:
    situacao = "Recuperado" if row.origem == "recuperacao" and row.kind == "finalizado" else (
        "Da carteira" if row.origem == "carteira" else "Recuperação"
    )
    if row.origem == "recuperacao" and row.kind == "finalizado":
        situacao = "Recuperado"
    elif row.origem == "recuperacao":
        situacao = "Recuperação"
    else:
        situacao = "Da carteira"
    return {
        "id": row.id,
        "cliente_id": row.cliente_id,
        "cliente_nome": row.cliente_nome,
        "dia": row.dia.isoformat(),
        "vendedor_id": row.vendedor_id,
        "vendedor_nome": row.vendedor_nome,
        "origem": row.origem,
        "situacao": situacao,
        "kind": row.kind,
        "motivo": row.motivo,
        "codigo_pedido": row.codigo_pedido,
        "valor_total": row.valor_total,
        "itens": row.itens or [],
        "synced": bool(row.synced),
        "data_pedido": row.data_pedido.isoformat() if row.data_pedido else None,
        "data_emissao": row.data_emissao.isoformat() if row.data_emissao else None,
        "cidade": row.cidade,
        "rota_id": row.rota_id,
        "rota_nome": row.rota_nome,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


async def list_closes(
    session: AsyncSession,
    user: dict,
    dia: date | None = None,
    kind: str | None = None,
    vendedor_id: int | None = None,
    origem: str | None = None,
) -> dict:
    sellers = scoped_seller_ids(user, vendedor_id)
    day = dia or date.today()
    q = select(DayClose).where(DayClose.dia == day)
    if kind and kind not in {"", "todos"}:
        q = q.where(DayClose.kind == kind)
    if origem and origem not in {"", "todas"}:
        q = q.where(DayClose.origem == origem)
    rows = (await session.execute(q.order_by(DayClose.created_at.desc()))).scalars().all()
    items = [_dump(r) for r in rows if r.vendedor_id in sellers]
    return {"date": day.isoformat(), "total": len(items), "items": items}


async def sync_pending(session: AsyncSession, user: dict) -> dict:
    sellers = scoped_seller_ids(user, None)
    rows = (
        await session.execute(
            select(DayClose).where(
                DayClose.kind == "finalizado",
                DayClose.synced.is_(False),
            )
        )
    ).scalars().all()
    mine = [r for r in rows if r.vendedor_id in sellers]
    codes = [r.codigo_pedido for r in mine if r.codigo_pedido]
    found = await lookup_many(codes)
    updated = 0
    for row in mine:
        hit = found.get(str(row.codigo_pedido or ""))
        if not hit:
            continue
        row.valor_total = hit.get("valor_total")
        row.itens = hit.get("itens")
        row.synced = True
        if hit.get("data_pedido"):
            row.data_pedido = date.fromisoformat(hit["data_pedido"])
        if hit.get("data_emissao"):
            row.data_emissao = date.fromisoformat(hit["data_emissao"])
        row.updated_at = datetime.utcnow()
        updated += 1
    await session.commit()
    return {"ok": True, "updated": updated, "pending": len(mine) - updated}
