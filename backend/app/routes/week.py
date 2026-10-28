from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.write import get_session
from app.deps import get_current_user
from app.services.clients import week_routes
from app.services.routes_sheet import catalog_payload

router = APIRouter(prefix="/api/routes", tags=["routes"])


@router.get("/week")
async def week(
    vendedor: str | None = None,
    session: AsyncSession = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    vid = None
    if user.get("role") == "colaborador":
        vid = user.get("vendedor_id")
    elif vendedor and vendedor not in {"todas", "todos"}:
        try:
            vid = int(vendedor)
        except ValueError:
            vid = None
    return await week_routes(session, user=user, vendedor_id=vid)


@router.get("/catalog")
async def routes_catalog():
    return catalog_payload()
