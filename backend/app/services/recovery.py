from __future__ import annotations

from collections import Counter
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

PER_STAGE = 10
STAGE_ORDER = ("60_90", "90_180", "180_mais")
MAX_POOL = PER_STAGE * len(STAGE_ORDER)


def stage_of(days: int | None) -> str | None:
    """60–90, 90–180 e 180+. Antes de 60 dias ainda não é recuperação."""
    if days is None or days < 60:
        return None
    if days <= 90:
        return "60_90"
    if days < 180:
        return "90_180"
    return "180_mais"


def already_bought(metrics: dict | None) -> bool:
    if not metrics:
        return False
    if not metrics.get("ultima_compra"):
        return False
    return (metrics.get("n_compras") or 0) > 0


def recovery_score(item: dict) -> tuple:
    """Melhor cliente primeiro: 12 meses, histórico e frequência."""
    return (
        -(item.get("fat_12m") or 0),
        -(item.get("fat_total") or 0),
        -(item.get("n_compras") or 0),
    )


def pick_recovery_items(candidates: list[dict], team_ids: list[int]) -> list[dict]:
    buckets: dict[str, list[dict]] = {k: [] for k in STAGE_ORDER}
    for item in candidates:
        stage = stage_of(item.get("dias_sem_contato"))
        if not stage or not already_bought(item):
            continue
        buckets[stage].append({**item, "nivel": stage})

    for key in STAGE_ORDER:
        buckets[key].sort(key=recovery_score)

    if not team_ids:
        team_ids = [0]

    picked: list[dict] = []
    n = 0
    for key in STAGE_ORDER:
        for item in buckets[key][:PER_STAGE]:
            picked.append({**item, "assigned_vendedor_id": team_ids[n % len(team_ids)]})
            n += 1
    return picked


def _stale_assignments(existing: list[RecoveryAssignment]) -> bool:
    """Remonta a fila do dia se ainda estiver nas faixas antigas (31–60 etc.)."""
    if len(existing) > MAX_POOL:
        return True
    known = set(STAGE_ORDER)
    if any(a.faixa not in known for a in existing):
        return True
    counts = Counter(a.faixa for a in existing)
    return any(counts[k] > PER_STAGE for k in STAGE_ORDER)


async def ensure_assignments(session: AsyncSession, day: date | None = None) -> list[RecoveryAssignment]:
    day = day or date.today()
    existing = (
        await session.execute(select(RecoveryAssignment).where(RecoveryAssignment.dia == day))
    ).scalars().all()
    if existing and not _stale_assignments(list(existing)):
        return list(existing)

    clients, agg = await load_all_clients(), await load_aggregates()
    route_ids = {r["id"] for r in routes_for_day(day)}
    candidates: list[dict] = []
    for c in clients:
        cid = c.get("id")
        if not cid or c.get("rota_id") not in route_ids:
            continue
        if c.get("vendedor_id") in TELEVENDAS_IDS:
            continue
        metrics = agg.get(cid) or {}
        candidates.append({**c, **metrics})

    team_ids = [c.vendedor_id for c in TEAM]
    picked = pick_recovery_items(candidates, team_ids)

    for row in existing:
        await session.delete(row)
    await session.flush()

    rows: list[RecoveryAssignment] = []
    for item in picked:
        row = RecoveryAssignment(
            cliente_id=int(item["id"]),
            dia=day,
            vendedor_id=int(item["assigned_vendedor_id"]),
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
        if not live or not already_bought(metrics):
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

    items.sort(key=lambda c: (*recovery_score(c), c.get("nome") or ""))
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
        "precisam_contato": niveis.get("180_mais", 0),
        "colaboradoras": public_team(),
        "items": sliced,
    }
