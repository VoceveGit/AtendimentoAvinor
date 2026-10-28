from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DayClose, RecoveryAssignment
from app.services.clients import clients_today
from app.services.closes import _dump
from app.services.televendas import TEAM, scoped_seller_ids


async def panel_analytics(
    session: AsyncSession,
    user: dict,
    start: date | None = None,
    end: date | None = None,
) -> dict:
    end = end or date.today()
    start = start or (end - timedelta(days=29))
    sellers = scoped_seller_ids(user, None)
    rows = (
        await session.execute(
            select(DayClose).where(DayClose.dia >= start, DayClose.dia <= end)
        )
    ).scalars().all()
    rows = [r for r in rows if r.vendedor_id in sellers]

    assignments = (
        await session.execute(
            select(RecoveryAssignment).where(
                RecoveryAssignment.dia >= start, RecoveryAssignment.dia <= end
            )
        )
    ).scalars().all()
    assignments = [a for a in assignments if a.vendedor_id in sellers]

    by_kind: dict[str, int] = defaultdict(int)
    by_city: dict[str, dict] = defaultdict(lambda: {"finalizado": 0, "nao_venda": 0, "nao_recuperado": 0, "valor": 0.0})
    by_colab: dict[int, dict] = defaultdict(
        lambda: {"finalizado": 0, "nao_venda": 0, "nao_recuperado": 0, "valor": 0.0, "recuperados": 0}
    )
    by_day: dict[str, dict] = defaultdict(lambda: {"finalizado": 0, "nao_venda": 0, "nao_recuperado": 0, "valor": 0.0})
    by_motivo_city: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    products: dict[str, dict] = defaultdict(lambda: {"qtd": 0.0, "valor": 0.0})
    prod_city: dict[tuple[str, str], dict] = defaultdict(lambda: {"qtd": 0.0, "valor": 0.0})
    valor = 0.0
    recuperados = 0
    recuperado_valor = 0.0
    clientes_venda: set[int] = set()

    for r in rows:
        by_kind[r.kind] += 1
        city = r.cidade or "Sem cidade"
        by_city[city][r.kind] = by_city[city].get(r.kind, 0) + 1
        col = by_colab[r.vendedor_id]
        col[r.kind] = col.get(r.kind, 0) + 1
        dayk = r.dia.isoformat()
        by_day[dayk][r.kind] = by_day[dayk].get(r.kind, 0) + 1
        if r.kind == "finalizado":
            v = float(r.valor_total or 0)
            valor += v
            by_city[city]["valor"] += v
            col["valor"] += v
            by_day[dayk]["valor"] += v
            clientes_venda.add(r.cliente_id)
            if r.origem == "recuperacao":
                recuperados += 1
                recuperado_valor += v
                col["recuperados"] += 1
        if r.kind == "recuperado":
            recuperados += 1
            col["recuperados"] = col.get("recuperados", 0) + 1
            for item in r.itens or []:
                name = (item.get("descricao") or item.get("produto") or "Item").strip() or "Item"
                products[name]["qtd"] += float(item.get("qtd") or 0)
                products[name]["valor"] += float(item.get("valor") or 0)
                prod_city[(city, name)]["qtd"] += float(item.get("qtd") or 0)
                prod_city[(city, name)]["valor"] += float(item.get("valor") or 0)
        if r.motivo:
            by_motivo_city[city][r.motivo[:80]] += 1

    today_payload = await clients_today(session, page=1, page_size=10000, user=user)
    today_ids = {i["id"] for i in today_payload["items"]}
    closed_today = {
        r.cliente_id
        for r in rows
        if r.dia == date.today() and r.origem == "carteira"
    }
    nao_atendidos_hoje = len(today_ids - closed_today)
    rec_hoje = [a for a in assignments if a.dia == date.today()]
    rec_closed = {r.cliente_id for r in rows if r.dia == date.today() and r.origem == "recuperacao"}
    rec_nao_atendidos = sum(1 for a in rec_hoje if a.cliente_id not in rec_closed)

    fluxo = len(today_ids) + len(rec_hoje)
    finalizados = by_kind.get("finalizado", 0)
    encerrados = (
        finalizados
        + by_kind.get("nao_venda", 0)
        + by_kind.get("nao_recuperado", 0)
        + by_kind.get("recuperado", 0)
    )
    conversao = round(100 * finalizados / encerrados, 1) if encerrados else 0.0
    ticket = round(valor / finalizados, 2) if finalizados else 0.0
    cobertura = len(clientes_venda)
    names = {c.vendedor_id: c.nome for c in TEAM}

    colaboradoras = []
    for vid, data in by_colab.items():
        colaboradoras.append({"id": vid, "nome": names.get(vid, str(vid)), **data})
    colaboradoras.sort(key=lambda x: -x["valor"])

    top_produtos = sorted(
        [{"nome": k, **v} for k, v in products.items()],
        key=lambda x: -x["valor"],
    )[:8]
    cidades = sorted(
        [{"cidade": k, **v} for k, v in by_city.items()],
        key=lambda x: -x["valor"],
    )[:8]
    motivos = []
    for city, mp in by_motivo_city.items():
        for mot, n in mp.items():
            motivos.append({"cidade": city, "motivo": mot, "n": n})
    motivos.sort(key=lambda x: -x["n"])
    nuvem: dict[str, int] = defaultdict(int)
    for m in motivos:
        nuvem[m["motivo"]] += m["n"]
    motivos_nuvem = sorted(
        [{"motivo": k, "n": v} for k, v in nuvem.items()],
        key=lambda x: -x["n"],
    )
    heat = [[0] * 10 for _ in range(6)]
    for r in rows:
        if not r.created_at:
            continue
        wd = r.created_at.weekday()
        hr = r.created_at.hour
        if wd > 5 or hr < 8 or hr > 17:
            continue
        heat[wd][hr - 8] += 1
    produtos_cidade = sorted(
        [{"cidade": k[0], "nome": k[1], **v} for k, v in prod_city.items()],
        key=lambda x: -x["valor"],
    )[:12]

    nao_atendidos = []
    for colab in TEAM:
        if colab.vendedor_id not in sellers:
            continue
        carteira_n = sum(1 for i in today_payload["items"] if i.get("vendedor_id") == colab.vendedor_id)
        carteira_closed = sum(
            1
            for r in rows
            if r.dia == date.today() and r.origem == "carteira" and r.vendedor_id == colab.vendedor_id
        )
        rec_n = sum(1 for a in rec_hoje if a.vendedor_id == colab.vendedor_id)
        rec_closed_n = sum(
            1
            for r in rows
            if r.dia == date.today() and r.origem == "recuperacao" and r.vendedor_id == colab.vendedor_id
        )
        nao_atendidos.append(
            {
                "id": colab.vendedor_id,
                "nome": colab.nome,
                "carteira": max(carteira_n - carteira_closed, 0),
                "recuperacao": max(rec_n - rec_closed_n, 0),
            }
        )

    peak_day = max(by_day.items(), key=lambda kv: kv[1].get("finalizado", 0), default=(None, {}))
    lost_day = max(
        by_day.items(),
        key=lambda kv: kv[1].get("nao_venda", 0) + kv[1].get("nao_recuperado", 0),
        default=(None, {}),
    )

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "kpis": {
            "fluxo_hoje": fluxo,
            "finalizados": finalizados,
            "nao_venda": by_kind.get("nao_venda", 0),
            "nao_recuperado": by_kind.get("nao_recuperado", 0),
            "nao_atendidos_hoje": nao_atendidos_hoje,
            "rec_nao_atendidos_hoje": rec_nao_atendidos,
            "conversao": conversao,
            "valor": round(valor, 2),
            "ticket": ticket,
            "pedidos": finalizados,
            "recuperados": recuperados,
            "cadastros": by_kind.get("recuperado", 0),
            "recuperado_valor": round(recuperado_valor, 2),
            "pool_recuperacao": len(rec_hoje),
            "cobertura": cobertura,
            "encerrados": encerrados,
        },
        "colaboradoras": colaboradoras,
        "cidades": cidades,
        "produtos": top_produtos,
        "produtos_cidade": produtos_cidade,
        "motivos": motivos[:12],
        "motivos_nuvem": motivos_nuvem[:8],
        "heatmap": heat,
        "nao_atendidos": nao_atendidos,
        "dias": [{"dia": k, **v} for k, v in sorted(by_day.items())],
        "pico_finalizacao": peak_day[0],
        "pico_perda": lost_day[0],
        "closes": [_dump(r) for r in rows[:40]],
        "eventos": [
            {
                "id": r.id,
                "cliente_nome": r.cliente_nome,
                "cidade": r.cidade,
                "rota_nome": r.rota_nome,
                "vendedor_id": r.vendedor_id,
                "vendedor_nome": r.vendedor_nome,
                "kind": r.kind,
                "motivo": r.motivo,
                "valor_total": r.valor_total,
                "origem": r.origem,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rows
        ],
    }
