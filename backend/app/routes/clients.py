from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ClientStatus
from app.db.write import get_session
from app.deps import get_current_user
from app.services import clients as svc

router = APIRouter(prefix="/api/clients", tags=["clients"])


class StatusPatch(BaseModel):
    status_id: str | None = None
    data_atendimento: date | None = None
    observacoes: str | None = None
    recontato: bool | None = None
    updated_by: str | None = None


def _vendedor_q(raw: str | None, user: dict) -> int | None:
    if user.get("role") == "colaborador":
        return user.get("vendedor_id")
    if not raw or raw in {"", "todas", "todos"}:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


@router.get("/today")
async def today(
    q: str = "",
    rota: str | None = None,
    status: str | None = None,
    vendedor: str | None = None,
    page: int = 1,
    page_size: int = 10,
    ref: date | None = None,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    return await svc.clients_today(
        session,
        q=q,
        rota_id=rota,
        status_id=status,
        page=page,
        page_size=page_size,
        ref=ref,
        user=user,
        vendedor_id=_vendedor_q(vendedor, user),
    )


@router.get("/recovery")
async def recovery(
    q: str = "",
    alto_valor: bool = False,
    recontato: bool = False,
    faixa: str = "todas",
    vendedor: str | None = None,
    page: int = 1,
    page_size: int = 10,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    return await svc.clients_recovery(
        session,
        q=q,
        alto_valor=alto_valor,
        recontato=recontato,
        faixa=faixa,
        page=page,
        page_size=page_size,
        user=user,
        vendedor_id=_vendedor_q(vendedor, user),
    )


@router.get("/search")
async def search(
    q: str = Query("", min_length=0),
    vendedor: str | None = None,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    return {
        "items": await svc.search_carteira(
            session, q=q, user=user, vendedor_id=_vendedor_q(vendedor, user)
        )
    }


@router.post("/{cliente_id}/today")
async def add_today(
    cliente_id: int,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    try:
        return await svc.add_to_today(session, cliente_id, user)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.patch("/{cliente_id}/status")
async def patch_status(
    cliente_id: int,
    payload: StatusPatch,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    if payload.status_id == "em_recuperacao":
        raise HTTPException(
            400,
            "Status Em Recuperação é automático (última compra > 90 dias).",
        )
    row = await session.get(ClientStatus, cliente_id)
    if row is None:
        row = ClientStatus(cliente_id=cliente_id)
        session.add(row)
    if payload.status_id is not None:
        row.status_id = payload.status_id or None
    if payload.data_atendimento is not None:
        row.data_atendimento = payload.data_atendimento
        if payload.status_id != "atendido":
            row.status_id = "visita_marcada"
    if payload.observacoes is not None:
        row.observacoes = payload.observacoes
    if payload.recontato is not None:
        row.recontato = payload.recontato
    row.updated_by = payload.updated_by or user.get("login") or user.get("nome")
    row.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(row)
    return {
        "cliente_id": row.cliente_id,
        "status_id": row.status_id,
        "data_atendimento": row.data_atendimento.isoformat() if row.data_atendimento else None,
        "recontato": row.recontato,
        "updated_by": row.updated_by,
    }


@router.get("/pills")
async def pills():
    return {"routes": svc.route_pills()}


@router.get("/dashboard")
async def dashboard(
    vendedor: str | None = None,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    return await svc.dashboard(session, user=user, vendedor_id=_vendedor_q(vendedor, user))
