from __future__ import annotations

import re
from typing import Any

import aiomysql

from app.config import get_settings

_WRITE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|"
    r"LOAD|INTO|CALL|LOCK|UNLOCK|HANDLER|RENAME|MERGE)\b",
    re.I,
)
_ALLOWED = re.compile(r"^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN)\b", re.I)

_pool: aiomysql.Pool | None = None
_runtime_cfg: dict[str, Any] | None = None


class ReadOnlyError(PermissionError):
    pass


def assert_readonly(sql: str) -> None:
    stripped = sql.strip().lstrip("(").strip()
    if not _ALLOWED.match(stripped):
        raise ReadOnlyError("MySQL Avinor é somente leitura — apenas SELECT.")
    if _WRITE.search(sql):
        raise ReadOnlyError("MySQL Avinor é somente leitura — apenas SELECT.")


def apply_runtime_mysql(cfg: dict[str, Any]) -> None:
    global _runtime_cfg, _pool
    _runtime_cfg = cfg
    _pool = None


def _mysql_kwargs() -> dict[str, Any]:
    settings = get_settings()
    cfg = _runtime_cfg or {}
    return {
        "host": cfg.get("host") or settings.mysql_host,
        "port": int(cfg.get("port") or settings.mysql_port),
        "user": cfg.get("user") or settings.mysql_user,
        "password": cfg.get("password") or settings.mysql_password,
        "db": cfg.get("database") or settings.mysql_database,
        "charset": "utf8mb4",
        "autocommit": True,
        "minsize": 1,
        "maxsize": 8,
        "connect_timeout": 15,
    }


async def get_pool() -> aiomysql.Pool:
    global _pool
    if _pool is None or _pool._closed:  # noqa: SLF001
        _pool = await aiomysql.create_pool(**_mysql_kwargs())
    return _pool


async def fetch_all(sql: str, params: tuple | None = None) -> list[dict[str, Any]]:
    assert_readonly(sql)
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(sql, params or ())
            rows = await cur.fetchall()
            return list(rows or [])


async def fetch_one(sql: str, params: tuple | None = None) -> dict[str, Any] | None:
    rows = await fetch_all(sql, params)
    return rows[0] if rows else None


async def test_mysql(cfg: dict[str, Any]) -> dict[str, Any]:
    assert_readonly("SELECT 1")
    conn = await aiomysql.connect(
        host=cfg["host"],
        port=int(cfg.get("port") or 3306),
        user=cfg["user"],
        password=cfg["password"],
        db=cfg["database"],
        charset="utf8mb4",
        connect_timeout=10,
        autocommit=True,
    )
    try:
        async with conn.cursor() as cur:
            await cur.execute("SELECT 1 AS ok")
            row = await cur.fetchone()
        return {"ok": True, "result": row[0] if row else None, "readonly": True}
    finally:
        conn.close()


async def close_mysql() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None
