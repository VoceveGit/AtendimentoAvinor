from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Motivo
from app.db.write import get_session
from app.deps import get_current_user
from app.services.normalize import norm_key

router = APIRouter(prefix="/api/motivos", tags=["motivos"])


class MotivoIn(BaseModel):
    label: str
    id: str | None = None
    active: bool | None = None


def _slug(label: str) -> str:
    return (norm_key(label) or "motivo")[:80]


def _dump(row: Motivo) -> dict:
    return {
        "id": row.id,
        "label": row.label,
        "active": bool(row.active),
        "order": row.sort_order,
    }


@router.get("")
async def list_motivos(
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    _ = user
    rows = (await session.execute(select(Motivo).order_by(Motivo.sort_order, Motivo.label))).scalars().all()
    return [_dump(r) for r in rows]


@router.post("")
async def create_motivo(
    payload: MotivoIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "adm":
        raise HTTPException(403, "Apenas o administrador cadastra motivos.")
    label = payload.label.strip()
    if not label:
        raise HTTPException(400, "Informe o motivo.")
    mid = payload.id or _slug(label)
    if await session.get(Motivo, mid):
        mid = f"{mid}_{int(__import__('time').time())}"
    last = (await session.execute(select(Motivo).order_by(Motivo.sort_order.desc()))).scalars().first()
    row = Motivo(
        id=mid,
        label=label,
        sort_order=(last.sort_order + 1) if last else 1,
        active=True if payload.active is None else bool(payload.active),
    )
    session.add(row)
    await session.commit()
    return _dump(row)


@router.patch("/{motivo_id}")
async def update_motivo(
    motivo_id: str,
    payload: MotivoIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "adm":
        raise HTTPException(403, "Apenas o administrador edita motivos.")
    row = await session.get(Motivo, motivo_id)
    if not row:
        raise HTTPException(404, "Motivo não encontrado.")
    if payload.label.strip():
        row.label = payload.label.strip()
    if payload.active is not None:
        row.active = bool(payload.active)
    await session.commit()
    return _dump(row)


@router.delete("/{motivo_id}")
async def delete_motivo(
    motivo_id: str,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "adm":
        raise HTTPException(403, "Apenas o administrador remove motivos.")
    row = await session.get(Motivo, motivo_id)
    if not row:
        raise HTTPException(404, "Motivo não encontrado.")
    await session.delete(row)
    await session.commit()
    return {"ok": True}
