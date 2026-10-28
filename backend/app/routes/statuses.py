from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Status
from app.db.write import get_session
from app.services.normalize import norm_key

router = APIRouter(prefix="/api/statuses", tags=["statuses"])


class StatusIn(BaseModel):
    label: str
    color: str = "amber"
    id: str | None = None
    requires_motivo: bool | None = None


class ReorderIn(BaseModel):
    ids: list[str]


def _slug(label: str) -> str:
    slug = norm_key(label) or "status"
    return slug[:80]


@router.get("")
async def list_statuses(session: AsyncSession = Depends(get_session)):
    rows = (await session.execute(select(Status).order_by(Status.sort_order))).scalars().all()
    return [
        {
            "id": r.id,
            "label": r.label,
            "color": r.color,
            "order": r.sort_order,
            "is_system": r.is_system,
            "is_default": bool(r.is_default),
            "requires_motivo": bool(r.requires_motivo),
        }
        for r in rows
    ]


@router.post("")
async def create_status(payload: StatusIn, session: AsyncSession = Depends(get_session)):
    sid = payload.id or _slug(payload.label)
    if await session.get(Status, sid):
        sid = f"{sid}_{int(__import__('time').time())}"
    last = (
        await session.execute(select(Status).order_by(Status.sort_order.desc()))
    ).scalars().first()
    row = Status(
        id=sid,
        label=payload.label.strip(),
        color=payload.color,
        sort_order=(last.sort_order + 1) if last else 1,
        is_system=False,
        requires_motivo=bool(payload.requires_motivo),
    )
    session.add(row)
    await session.commit()
    return {
        "id": row.id,
        "label": row.label,
        "color": row.color,
        "order": row.sort_order,
        "is_default": bool(row.is_default),
        "requires_motivo": bool(row.requires_motivo),
    }


@router.patch("/{status_id}")
async def update_status(
    status_id: str, payload: StatusIn, session: AsyncSession = Depends(get_session)
):
    row = await session.get(Status, status_id)
    if not row:
        raise HTTPException(404, "Status não encontrado.")
    if row.is_system and payload.label:
        # allow color change only for system recovery status
        row.color = payload.color
    else:
        row.label = payload.label.strip()
        row.color = payload.color
    if payload.requires_motivo is not None and not row.is_system:
        row.requires_motivo = payload.requires_motivo
    await session.commit()
    return {
        "id": row.id,
        "label": row.label,
        "color": row.color,
        "is_default": bool(row.is_default),
        "requires_motivo": bool(row.requires_motivo),
    }


@router.post("/{status_id}/default")
async def set_default(status_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.get(Status, status_id)
    if not row:
        raise HTTPException(404, "Status não encontrado.")
    if row.id == "em_recuperacao" or row.is_system:
        raise HTTPException(400, "Status de sistema não pode ser o padrão do dia.")
    rows = (await session.execute(select(Status))).scalars().all()
    for item in rows:
        item.is_default = item.id == status_id
    await session.commit()
    return {"ok": True, "id": status_id}


@router.delete("/{status_id}")
async def delete_status(status_id: str, session: AsyncSession = Depends(get_session)):
    row = await session.get(Status, status_id)
    if not row:
        raise HTTPException(404, "Status não encontrado.")
    if row.is_system:
        raise HTTPException(400, "Status de sistema não pode ser removido.")
    was_default = bool(row.is_default)
    await session.delete(row)
    if was_default:
        fallback = await session.get(Status, "atendimento_hoje")
        if fallback:
            fallback.is_default = True
    await session.commit()
    return {"ok": True}


@router.post("/reorder")
async def reorder(payload: ReorderIn, session: AsyncSession = Depends(get_session)):
    for i, sid in enumerate(payload.ids, start=1):
        row = await session.get(Status, sid)
        if row:
            row.sort_order = i
    await session.commit()
    return {"ok": True}
