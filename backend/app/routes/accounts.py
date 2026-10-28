from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db.write import get_session
from app.deps import get_current_user
from app.services import accounts as svc
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class AccountIn(BaseModel):
    role: str | None = None
    nome: str | None = None
    login: str | None = None
    password: str | None = None
    vendedor_id: int | None = None
    aliases: list[str] | None = None
    active: bool | None = None


def _adm(user: dict) -> dict:
    if user.get("role") != "adm":
        raise HTTPException(403, "Apenas o administrador gerencia as contas.")
    return user


@router.get("")
async def list_accounts(session: AsyncSession = Depends(get_session), user: dict = Depends(get_current_user)):
    _adm(user)
    return await svc.list_accounts(session)


@router.post("")
async def create_account(
    payload: AccountIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    _adm(user)
    try:
        return await svc.create_account(session, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.patch("/{account_id}")
async def update_account(
    account_id: int,
    payload: AccountIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    _adm(user)
    try:
        return await svc.update_account(session, account_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.delete("/{account_id}")
async def delete_account(
    account_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    _adm(user)
    try:
        await svc.delete_account(session, account_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"ok": True}
