from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import PROJECT_ROOT, ROOT, get_settings
from app.db.mysql import close_mysql
from app.db.write import init_write_db
from app.routes.auth import router as auth_router
from app.routes.clients import router as clients_router
from app.routes.db_config import router as db_router
from app.routes.imports import router as import_router
from app.routes.prompt import router as prompt_router
from app.routes.statuses import router as statuses_router
from app.routes.ops import router as ops_router
from app.routes.week import router as week_router


def static_dir() -> Path | None:
    for candidate in (ROOT / "static", PROJECT_ROOT / "frontend" / "dist"):
        if (candidate / "index.html").exists():
            return candidate
    return None


async def _warmup() -> None:
    try:
        from app.services.clients import load_aggregates, load_base_clients
        from app.services.routes_sheet import catalog

        catalog()
        await load_base_clients()
        await load_aggregates()
    except Exception as exc:  # pragma: no cover
        print(f"[avinor] warmup falhou (o painel sobe mesmo assim): {exc}")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_write_db()
    task = None
    if os.getenv("AVINOR_SKIP_WARMUP") != "1":
        task = asyncio.create_task(_warmup())
    yield
    if task:
        task.cancel()
    await close_mysql()


settings = get_settings()
app = FastAPI(
    title="Avinor Atendimento",
    version="1.1.0",
    lifespan=lifespan,
)

origins = settings.cors_list()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(clients_router)
app.include_router(statuses_router)
app.include_router(db_router)
app.include_router(import_router)
app.include_router(week_router)
app.include_router(ops_router)
app.include_router(prompt_router)


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "service": "avinor-atendimento",
        "mysql_readonly": True,
        "write": "neon" if settings.neon_database_url else "sqlite",
    }


_static = static_dir()
if _static is not None:
    assets = _static / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404)
        target = _static / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(_static / "index.html")
