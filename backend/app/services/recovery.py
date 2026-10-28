from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DayClose, RecoveryAssignment
from app.services.clients import (
    _hydrate,
    _match_query,
    _status_maps,
    load_aggregates,
    load_all_clients,
    load_top_products,
)
from app.services.routes_sheet import routes_for_day
from app.services.televendas import TEAM, TELEVENDAS_IDS, public_team, scoped_seller_ids

MAX_POOL = 30
STAGE_ORDER = ("31_60", "61_90", "90_mais")


def stage_of(days: int | None) -> str | None:
    if days is None or days <= 30:
        return None
    if days <= 60:
        return "31_60"
    if days <= 90:
        return "61_90"
    return "90_mais"


async def ensure_assignments(session: AsyncSession, day: date | None = None) -> list[RecoveryAssignment]:
    day = day or date.today()
    existing = (
        await session.execute(select(RecoveryAssignment).where(RecoveryAssignment.dia == day))
    ).scalars().all()
    if existing:
        return list(existing)

    clients, agg = await load_all_clients(), await load_aggregates()
    route_ids = {r["id"] for r in routes_for_day(day)}
    buckets: dict[str, list[dict]] = {k: [] for k in STAGE_ORDER}

    for c in clients:
        cid = c.get("id")
        if not cid or c.get("rota_id") not in route_ids:
            continue
        metrics = agg.get(cid) or {}
        if c.get("vendedor_id") in TELEVENDAS_IDS:
            continue
        stage = stage_of(metrics.get("dias_sem_contato"))
        if not stage:
            continue
        buckets[stage].append({**c, **metrics, "nivel": stage})

    for key in STAGE_ORDER:
        buckets[key].sort(key=lambda x: (x.get("dias_sem_contato") or 9999, -(x.get("fat_12m") or 0)))

    pool: list[dict] = []
    for key in STAGE_ORDER:
        need = MAX_POOL - len(pool)
        if need <= 0:
            break
        pool.extend(buckets[key][:need])

    team_ids = [c.vendedor_id for c in TEAM]
    rows: list[RecoveryAssignment] = []
    for i, item in enumerate(pool):
        row = RecoveryAssignment(
            cliente_id=int(item["id"]),
            dia=day,
            vendedor_id=team_ids[i % len(team_ids)],
            faixa=item["nivel"],
        )
        session.add(row)
        rows.append(row)
    await session.commit()
    for row in rows:
        await session.refresh(row)
    return rows


async def clients_recovery(
    session: AsyncSession,
    q: str = "",
    faixa: str = "todas",
    page: int = 1,
    page_size: int = 10,
    user: dict | None = None,
    vendedor_id: int | None = None,
    ref: date | None = None,
) -> dict:
    day = ref or date.today()
    sellers = scoped_seller_ids(user, vendedor_id)
    assignments = await ensure_assignments(session, day)
    clients = {c["id"]: c for c in await load_all_clients()}
    agg = await load_aggregates()
    status_by_id, by_cs = await _status_maps(session)
    team_name = {c.vendedor_id: c.nome for c in TEAM}
    closes = (
        await session.execute(
            select(DayClose).where(DayClose.dia == day, DayClose.origem == "recuperacao")
        )
    ).scalars().all()
    closed = {r.cliente_id: r.kind for r in closes}

    items: list[dict] = []
    niveis = {k: 0 for k in STAGE_ORDER}
    mine = [asg for asg in assignments if asg.vendedor_id in sellers]
    for asg in mine:
        base = clients.get(asg.cliente_id)
        if not base:
            continue
        metrics = agg.get(asg.cliente_id) or {}
        if not _match_query(base, q):
            continue
        days = metrics.get("dias_sem_contato")
        live = stage_of(days)
        if not live:
            # Comprou de novo — não é recuperação.
            continue
        item = _hydrate(base, metrics, status_by_id, by_cs.get(asg.cliente_id), apply_default=True)
        item["nivel"] = live
        item["origem"] = "recuperacao"
        item["assigned_vendedor_id"] = asg.vendedor_id
        item["assigned_vendedor_nome"] = team_name.get(asg.vendedor_id)
        item["close_kind"] = closed.get(asg.cliente_id)
        niveis[live] = niveis.get(live, 0) + 1
        if faixa and faixa not in {"", "todas"} and live != faixa:
            continue
        items.append(item)

    items.sort(key=lambda c: (c.get("dias_sem_contato") or 0, c.get("nome") or ""))
    total = len(items)
    start = max(page - 1, 0) * page_size
    sliced = items[start : start + page_size]
    tops = await load_top_products([i["id"] for i in sliced], per_client=3)
    for item in sliced:
        item["produtos_top"] = tops.get(item["id"], [])
    return {
        "date": day.isoformat(),
        "total": total,
        "page": page,
        "page_size": page_size,
        "pool": len(mine),
        "niveis": niveis,
        "precisam_contato": niveis.get("90_mais", 0),
        "colaboradoras": public_team(),
        "items": sliced,
    }
