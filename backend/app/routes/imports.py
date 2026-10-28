import json
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ColumnMapping, ImportLog
from app.db.write import get_session
from app.services.xlsx_parser import SYSTEM_FIELDS, parse_workbook

router = APIRouter(prefix="/api/import", tags=["import"])


@router.get("/fields")
async def fields():
    return {"fields": [{"id": i, "label": l} for i, l in SYSTEM_FIELDS]}


@router.post("/preview")
async def preview(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Envie um arquivo .xlsx")
    content = await file.read()
    try:
        parsed = parse_workbook(content, preview_rows=10)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc

    saved = (
        await session.execute(
            select(ColumnMapping).where(ColumnMapping.signature == parsed["signature"])
        )
    ).scalar_one_or_none()
    mapping = saved.mapping if saved else parsed["suggested_mapping"]
    return {
        "filename": file.filename,
        "header_row": parsed["header_row"],
        "headers": parsed["headers"],
        "mapping": mapping,
        "suggested_mapping": parsed["suggested_mapping"],
        "reused": bool(saved),
        "preview": parsed["preview"],
        "total_rows": parsed["total_rows"],
        "signature": parsed["signature"],
    }


@router.post("/xlsx")
async def import_xlsx(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    content = await file.read()
    try:
        parsed = parse_workbook(content, preview_rows=4)
        map_obj = json.loads(mapping)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc

    saved = (
        await session.execute(
            select(ColumnMapping).where(ColumnMapping.signature == parsed["signature"])
        )
    ).scalar_one_or_none()
    if saved:
        saved.mapping = map_obj
        saved.headers = parsed["headers"]
        saved.updated_at = datetime.utcnow()
    else:
        session.add(
            ColumnMapping(
                signature=parsed["signature"],
                headers=parsed["headers"],
                mapping=map_obj,
                updated_at=datetime.utcnow(),
            )
        )

    session.add(
        ImportLog(
            filename=file.filename,
            rows_imported=parsed["total_rows"],
            mapping=map_obj,
            imported_at=datetime.utcnow(),
        )
    )
    await session.commit()
    return {
        "ok": True,
        "filename": file.filename,
        "rows_imported": parsed["total_rows"],
        "mapping": map_obj,
        "preview": parsed["preview"][:4],
    }
