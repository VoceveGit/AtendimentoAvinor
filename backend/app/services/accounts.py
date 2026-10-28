from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import encrypt_text
from app.db.models import Account
from app.services.televendas import SEED_TEAM, apply_account_rows, _norm_login


def _dump(row: Account, *, with_secret: bool = False) -> dict:
    data = {
        "id": row.id,
        "role": row.role,
        "nome": row.nome,
        "login": row.login,
        "vendedor_id": row.vendedor_id,
        "aliases": list(row.aliases or []),
        "active": bool(row.active),
        "sort_order": row.sort_order,
        "password_enc": row.password_enc if with_secret else "",
    }
    return data


def _public(row: Account) -> dict:
    return {
        "id": row.id,
        "role": row.role,
        "nome": row.nome,
        "login": row.login,
        "vendedor_id": row.vendedor_id,
        "aliases": list(row.aliases or []),
        "active": bool(row.active),
        "sort_order": row.sort_order,
    }


async def refresh_team(session: AsyncSession) -> None:
    rows = (await session.execute(select(Account).order_by(Account.sort_order, Account.id))).scalars().all()
    apply_account_rows([_dump(r, with_secret=True) for r in rows])


async def seed_accounts(session: AsyncSession) -> None:
    existing = (await session.execute(select(Account))).scalars().first()
    if existing:
        await refresh_team(session)
        return
    session.add(
        Account(
            role="adm",
            nome="Administrador",
            login="adm",
            password_enc=encrypt_text("adm"),
            vendedor_id=None,
            aliases=["admin", "administrador"],
            active=True,
            sort_order=0,
        )
    )
    for i, col in enumerate(SEED_TEAM, start=1):
        session.add(
            Account(
                role="colaborador",
                nome=col.nome,
                login=col.login,
                password_enc=encrypt_text(str(col.vendedor_id)),
                vendedor_id=col.vendedor_id,
                aliases=list(col.aliases),
                active=True,
                sort_order=i,
            )
        )
    await session.commit()
    await refresh_team(session)


async def list_accounts(session: AsyncSession) -> list[dict]:
    rows = (await session.execute(select(Account).order_by(Account.sort_order, Account.id))).scalars().all()
    return [_public(r) for r in rows]


async def create_account(session: AsyncSession, payload: dict) -> dict:
    role = payload.get("role") or "colaborador"
    if role not in {"adm", "colaborador"}:
        raise ValueError("Papel inválido.")
    login = _norm_login(payload.get("login") or "")
    nome = (payload.get("nome") or "").strip()
    password = (payload.get("password") or "").strip()
    if not login or not nome or not password:
        raise ValueError("Nome, login e senha são obrigatórios.")
    taken = (await session.execute(select(Account).where(Account.login == login))).scalar_one_or_none()
    if taken:
        raise ValueError("Esse login já existe.")
    vid = payload.get("vendedor_id")
    if role == "colaborador":
        try:
            vid = int(vid)
        except (TypeError, ValueError):
            raise ValueError("Informe o código da carteira (vendedor).") from None
        clash = (await session.execute(select(Account).where(Account.vendedor_id == vid))).scalar_one_or_none()
        if clash:
            raise ValueError("Esse código de carteira já está em uso.")
    else:
        vid = None
    last = (await session.execute(select(Account).order_by(Account.sort_order.desc()))).scalars().first()
    row = Account(
        role=role,
        nome=nome,
        login=login,
        password_enc=encrypt_text(password),
        vendedor_id=vid,
        aliases=[a.strip() for a in (payload.get("aliases") or []) if str(a).strip()],
        active=True,
        sort_order=(last.sort_order + 1) if last else 1,
        updated_at=datetime.utcnow(),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    await refresh_team(session)
    return _public(row)


async def update_account(session: AsyncSession, account_id: int, payload: dict) -> dict:
    row = await session.get(Account, account_id)
    if not row:
        raise ValueError("Conta não encontrada.")
    if payload.get("nome"):
        row.nome = payload["nome"].strip()
    if payload.get("login"):
        login = _norm_login(payload["login"])
        clash = (await session.execute(select(Account).where(Account.login == login, Account.id != account_id))).scalar_one_or_none()
        if clash:
            raise ValueError("Esse login já existe.")
        row.login = login
    if payload.get("password"):
        row.password_enc = encrypt_text(payload["password"].strip())
    if row.role == "colaborador" and payload.get("vendedor_id") is not None:
        try:
            vid = int(payload["vendedor_id"])
        except (TypeError, ValueError):
            raise ValueError("Código da carteira inválido.") from None
        clash = (
            await session.execute(select(Account).where(Account.vendedor_id == vid, Account.id != account_id))
        ).scalar_one_or_none()
        if clash:
            raise ValueError("Esse código de carteira já está em uso.")
        row.vendedor_id = vid
    if "active" in payload and payload["active"] is not None:
        if row.role == "adm" and payload["active"] is False:
            others = (
                await session.execute(select(Account).where(Account.role == "adm", Account.active.is_(True), Account.id != account_id))
            ).scalars().first()
            if not others:
                raise ValueError("Não dá para desativar o único administrador.")
        row.active = bool(payload["active"])
    if payload.get("aliases") is not None:
        row.aliases = [a.strip() for a in payload["aliases"] if str(a).strip()]
    row.updated_at = datetime.utcnow()
    await session.commit()
    await refresh_team(session)
    return _public(row)


async def delete_account(session: AsyncSession, account_id: int) -> None:
    row = await session.get(Account, account_id)
    if not row:
        raise ValueError("Conta não encontrada.")
    if row.role == "adm":
        others = (
            await session.execute(select(Account).where(Account.role == "adm", Account.active.is_(True), Account.id != account_id))
        ).scalars().first()
        if not others:
            raise ValueError("Não dá para remover o único administrador.")
    await session.delete(row)
    await session.commit()
    await refresh_team(session)
