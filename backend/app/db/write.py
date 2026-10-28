from __future__ import annotations

from datetime import datetime
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.models import Base, DbConfig, SEED_STATUSES, Status

_engine = None
_session = None
_runtime_neon_url: str | None = None
_runtime_ssl: bool | None = None

# libpq query keys that asyncpg.connect() rejects (Neon includes channel_binding).
_ASYNCPG_DROP = {
    "sslmode",
    "ssl",
    "channel_binding",
    "gssencmode",
    "requiressl",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslcrl",
    "sslnegotiation",
}


def neon_asyncpg_url(raw: str) -> str:
    url = (raw or "").strip()
    if not url:
        return url
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    parsed = urlparse(url)
    scheme = parsed.scheme or "postgresql"
    if "+asyncpg" not in scheme:
        scheme = "postgresql+asyncpg"
    query = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k.lower() not in _ASYNCPG_DROP]
    return urlunparse(parsed._replace(scheme=scheme, query=urlencode(query))).rstrip("?")


def _url() -> str:
    raw = (_runtime_neon_url or get_settings().neon_database_url or "").strip()
    if raw:
        return neon_asyncpg_url(raw)
    return get_settings().write_database_url


def write_backend() -> str:
    url = _url()
    if "+asyncpg" in url or url.startswith("postgresql"):
        return "neon"
    return "sqlite"


def asyncpg_dsn(raw: str) -> str:
    return neon_asyncpg_url(raw).replace("postgresql+asyncpg://", "postgresql://", 1)


async def apply_runtime_neon(url: str, ssl: bool = True) -> None:
    global _runtime_neon_url, _runtime_ssl, _engine, _session
    _runtime_neon_url = (url or "").strip() or None
    _runtime_ssl = ssl
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session = None


def engine():
    global _engine
    if _engine is None:
        kwargs: dict = {"echo": False, "pool_pre_ping": True}
        url = _url()
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
        elif "asyncpg" in url:
            use_ssl = get_settings().neon_ssl if _runtime_ssl is None else _runtime_ssl
            kwargs["connect_args"] = {"ssl": True} if use_ssl else {}
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
        existing_rows = list((await session.execute(select(Status))).scalars())
        if not existing_rows:
            # Só na instalação vazia. Status apagado pelo ADM não volta no próximo boot.
            for sid, label, color, order, system, requires_motivo in SEED_STATUSES:
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
        has_default = any(row.is_default for row in (await session.execute(select(Status))).scalars())
        if not has_default:
            seeded = await session.get(Status, "atendimento_hoje")
            fallback = seeded or (await session.execute(select(Status))).scalars().first()
            if fallback:
                fallback.is_default = True

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
