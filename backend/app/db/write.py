from __future__ import annotations

from datetime import datetime

from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.models import Base, DbConfig, SEED_STATUSES, Status

_engine = None
_session = None


def _url() -> str:
    settings = get_settings()
    if settings.neon_database_url:
        url = settings.neon_database_url.strip()
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        url = url.replace("sslmode=require", "").replace("ssl=require", "")
        url = url.replace("?&", "?").rstrip("?&")
        return url
    return settings.write_database_url


def engine():
    global _engine
    if _engine is None:
        kwargs: dict = {"echo": False, "pool_pre_ping": True}
        url = _url()
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
        elif "asyncpg" in url:
            kwargs["connect_args"] = {"ssl": True} if get_settings().neon_ssl else {}
            kwargs["pool_size"] = get_settings().neon_pool_min
            kwargs["max_overflow"] = max(get_settings().neon_pool_max - get_settings().neon_pool_min, 0)
        _engine = create_async_engine(url, **kwargs)
    return _engine


def session_factory() -> async_sessionmaker[AsyncSession]:
    global _session
    if _session is None:
        _session = async_sessionmaker(engine(), expire_on_commit=False)
    return _session


async def get_session() -> AsyncSession:
    async with session_factory()() as session:
        yield session


def _ensure_status_columns(sync_conn) -> None:
    insp = inspect(sync_conn)
    if "avinor_statuses" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("avinor_statuses")}
    if "is_default" not in cols:
        sync_conn.execute(text("ALTER TABLE avinor_statuses ADD COLUMN is_default BOOLEAN DEFAULT 0"))
    if "requires_motivo" not in cols:
        sync_conn.execute(text("ALTER TABLE avinor_statuses ADD COLUMN requires_motivo BOOLEAN DEFAULT 0"))


async def init_write_db() -> None:
    async with engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_status_columns)

    async with session_factory()() as session:
        existing = {row.id for row in (await session.execute(select(Status))).scalars()}
        for sid, label, color, order, system, requires_motivo in SEED_STATUSES:
            if sid not in existing:
                session.add(
                    Status(
                        id=sid,
                        label=label,
                        color=color,
                        sort_order=order,
                        is_system=system,
                        is_default=sid == "atendimento_hoje",
                        requires_motivo=requires_motivo,
                    )
                )
            else:
                row = await session.get(Status, sid)
                if row and requires_motivo and not row.requires_motivo:
                    row.requires_motivo = True
        has_default = any(row.is_default for row in (await session.execute(select(Status))).scalars())
        if not has_default:
            seeded = await session.get(Status, "atendimento_hoje")
            if seeded:
                seeded.is_default = True

        mysql_cfg = (
            await session.execute(select(DbConfig).where(DbConfig.kind == "mysql"))
        ).scalar_one_or_none()
        settings = get_settings()
        if mysql_cfg is None:
            session.add(
                DbConfig(
                    kind="mysql",
                    config={
                        "host": settings.mysql_host,
                        "port": settings.mysql_port,
                        "database": settings.mysql_database,
                        "user": settings.mysql_user,
                        "password_encrypted": True,
                        "ssl": settings.mysql_ssl,
                        "readonly": True,
                    },
                    updated_at=datetime.utcnow(),
                )
            )
        neon_cfg = (
            await session.execute(select(DbConfig).where(DbConfig.kind == "neon"))
        ).scalar_one_or_none()
        if neon_cfg is None:
            session.add(
                DbConfig(
                    kind="neon",
                    config={
                        "connection_string": settings.neon_database_url,
                        "pool_min": settings.neon_pool_min,
                        "pool_max": settings.neon_pool_max,
                        "ssl": settings.neon_ssl,
                    },
                    updated_at=datetime.utcnow(),
                )
            )
        await session.commit()
