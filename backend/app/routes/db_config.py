from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.crypto import decrypt_text, encrypt_text
from app.db.models import DbConfig
from app.db.mysql import apply_runtime_mysql, test_mysql
from app.db.write import apply_runtime_neon, asyncpg_dsn, get_session, init_write_db, write_backend

router = APIRouter(prefix="/api/db", tags=["db"])


class MysqlIn(BaseModel):
    host: str
    port: int = 3306
    database: str
    user: str
    password: str = ""
    ssl: bool = False


class NeonIn(BaseModel):
    connection_string: str = ""
    pool_min: int = 2
    pool_max: int = 10
    ssl: bool = True


class SaveIn(BaseModel):
    mysql: MysqlIn
    neon: NeonIn


def _mask(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "•" * len(value)
    return value[:2] + "•" * (len(value) - 4) + value[-2:]


@router.get("/config")
async def get_config(session: AsyncSession = Depends(get_session)):
    settings = get_settings()
    rows = {r.kind: r for r in (await session.execute(select(DbConfig))).scalars()}
    mysql = (rows.get("mysql").config if rows.get("mysql") else {}) or {}
    neon = (rows.get("neon").config if rows.get("neon") else {}) or {}
    password = decrypt_text(mysql.get("password", "")) or settings.mysql_password
    neon_url = decrypt_text(neon.get("connection_string", "")) or settings.neon_database_url
    return {
        "mysql": {
            "host": mysql.get("host") or settings.mysql_host,
            "port": mysql.get("port") or settings.mysql_port,
            "database": mysql.get("database") or settings.mysql_database,
            "user": mysql.get("user") or settings.mysql_user,
            "password": password,
            "password_masked": _mask(password),
            "ssl": bool(mysql.get("ssl", settings.mysql_ssl)),
            "readonly": True,
            "connected": True,
        },
        "neon": {
            "connection_string": neon_url,
            "pool_min": neon.get("pool_min") or settings.neon_pool_min,
            "pool_max": neon.get("pool_max") or settings.neon_pool_max,
            "ssl": bool(neon.get("ssl", True)),
            "connected": write_backend() == "neon",
            "write": write_backend(),
        },
        "write": write_backend(),
    }


@router.post("/test-mysql")
async def post_test_mysql(payload: MysqlIn):
    try:
        result = await test_mysql(payload.model_dump())
        return result
    except Exception as exc:
        raise HTTPException(400, f"Falha na conexão MySQL: {exc}") from exc


@router.post("/test-neon")
async def post_test_neon(payload: NeonIn):
    if not payload.connection_string:
        return {
            "ok": True,
            "mode": "sqlite-local",
            "detail": "Sem connection string — o painel grava no SQLite local até o Neon ser informado.",
        }
    try:
        import asyncpg

        dsn = asyncpg_dsn(payload.connection_string)
        conn = await asyncpg.connect(dsn, timeout=10, ssl=True if payload.ssl else False)
        try:
            val = await conn.fetchval("SELECT 1")
        finally:
            await conn.close()
        return {"ok": True, "result": val, "mode": "neon"}
    except Exception as exc:
        raise HTTPException(400, f"Falha na conexão Neon: {exc}") from exc


@router.post("/save-config")
async def save_config(payload: SaveIn, session: AsyncSession = Depends(get_session)):
    mysql_row = (
        await session.execute(select(DbConfig).where(DbConfig.kind == "mysql"))
    ).scalar_one_or_none()
    neon_row = (
        await session.execute(select(DbConfig).where(DbConfig.kind == "neon"))
    ).scalar_one_or_none()
    mysql_cfg = {
        "host": payload.mysql.host,
        "port": payload.mysql.port,
        "database": payload.mysql.database,
        "user": payload.mysql.user,
        "password": encrypt_text(payload.mysql.password),
        "ssl": payload.mysql.ssl,
        "readonly": True,
    }
    neon_cfg = {
        "connection_string": encrypt_text(payload.neon.connection_string),
        "pool_min": payload.neon.pool_min,
        "pool_max": payload.neon.pool_max,
        "ssl": payload.neon.ssl,
    }
    now = datetime.utcnow()
    if mysql_row:
        mysql_row.config = mysql_cfg
        mysql_row.updated_at = now
    else:
        session.add(DbConfig(kind="mysql", config=mysql_cfg, updated_at=now))
    if neon_row:
        neon_row.config = neon_cfg
        neon_row.updated_at = now
    else:
        session.add(DbConfig(kind="neon", config=neon_cfg, updated_at=now))
    await session.commit()
    apply_runtime_mysql(
        {
            "host": payload.mysql.host,
            "port": payload.mysql.port,
            "database": payload.mysql.database,
            "user": payload.mysql.user,
            "password": payload.mysql.password,
            "ssl": payload.mysql.ssl,
        }
    )
    if payload.neon.connection_string.strip():
        await apply_runtime_neon(payload.neon.connection_string, ssl=payload.neon.ssl)
        await init_write_db()
    return {"ok": True, "readonly": True, "write": write_backend()}
