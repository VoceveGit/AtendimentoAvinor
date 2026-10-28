from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.write import get_session
from app.deps import get_current_user
from app.services import analytics as an
from app.services import closes as cl
from app.services import pedidos as ped

router = APIRouter(tags=["ops"])


class FinalizeIn(BaseModel):
    codigo_pedido: str
    valor_total: float | None = None
    origem: str = "carteira"


class CloseIn(BaseModel):
    kind: str
    motivo: str
    origem: str = "carteira"


@router.post("/api/clients/{cliente_id}/finalize")
async def finalize(
    cliente_id: int,
    payload: FinalizeIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    try:
        return await cl.finalize(
            session,
            cliente_id,
            user,
            codigo_pedido=payload.codigo_pedido,
            valor_total=payload.valor_total,
            origem=payload.origem or "carteira",
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/api/clients/{cliente_id}/close")
async def close_client(
    cliente_id: int,
    payload: CloseIn,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    try:
        return await cl.close_without_sale(
            session,
            cliente_id,
            user,
            kind=payload.kind,
            motivo=payload.motivo,
            origem=payload.origem or "carteira",
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/api/finalized")
async def list_finalized(
    dia: date | None = None,
    kind: str | None = "finalizado",
    origem: str | None = None,
    vendedor: str | None = None,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    vid = None
    if user.get("role") != "colaborador" and vendedor and vendedor not in {"todas", "todos"}:
        try:
            vid = int(vendedor)
        except ValueError:
            vid = None
    return await cl.list_closes(session, user, dia=dia, kind=kind, vendedor_id=vid, origem=origem)


@router.post("/api/finalized/sync")
async def sync_finalized(
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    return await cl.sync_pending(session, user)


@router.get("/api/pedidos/lookup")
async def lookup(codigo: str, user: dict = Depends(get_current_user)):
    _ = user
    return await ped.lookup_pedido(codigo)


@router.get("/api/analytics")
async def analytics(
    start: date | None = None,
    end: date | None = None,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    if user.get("role") != "adm":
        raise HTTPException(403, "Apenas o administrador acessa os relatórios.")
    return await an.panel_analytics(session, user, start=start, end=end)
