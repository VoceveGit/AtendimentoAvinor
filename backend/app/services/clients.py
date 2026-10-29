from __future__ import annotations

import asyncio
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import AUTO_STATUS_IDS, ClientStatus, ExtraAttendance, Status
from app.db.mysql import fetch_all
from app.services.normalize import as_float, as_int, as_str, pick
from app.services.routes_sheet import catalog, resolve_route, routes_for_day
from app.services.televendas import TEAM, TELEVENDAS_IDS, public_team, scoped_seller_ids

_agg_cache: dict[str, Any] = {"at": None, "data": {}}
_base_cache: dict[str, Any] = {"at": None, "data": []}
_agg_lock = asyncio.Lock()
_base_lock = asyncio.Lock()
CACHE_TTL = timedelta(minutes=20)
RECOVERY_DAYS = 90
RECOVERY_MIN_DAYS = 60
HOT_RECOVERY_DAYS = 180
RECOVERY_BANDS = ("60_90", "90_180", "180_mais")


def recovery_band(days: int | None) -> str | None:
    if days is None or days < RECOVERY_MIN_DAYS:
        return None
    if days <= 90:
        return "60_90"
    if days < 180:
        return "90_180"
    return "180_mais"


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value)[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _streak(days: list[date], last: date | None) -> int:
    if not days or not last:
        return 0
    weeks = sorted({d.isocalendar()[:2] for d in days}, reverse=True)
    if not weeks:
        return 0
    streak = 1
    year, week = weeks[0]
    for y, w in weeks[1:]:
        prev_week = week - 1
        prev_year = year
        if prev_week == 0:
            prev_year -= 1
            prev_week = date(prev_year, 12, 28).isocalendar()[1]
        if y == prev_year and w == prev_week:
            streak += 1
            year, week = y, w
        else:
            break
    if (date.today() - last).days > 21:
        return streak
    return streak


async def load_aggregates(force: bool = False) -> dict[int, dict]:
    now = datetime.utcnow()
    cached_at = _agg_cache["at"]
    if not force and cached_at and now - cached_at < CACHE_TTL and _agg_cache["data"]:
        return _agg_cache["data"]

    async with _agg_lock:
        cached_at = _agg_cache["at"]
        if not force and cached_at and now - cached_at < CACHE_TTL and _agg_cache["data"]:
            return _agg_cache["data"]

        settings = get_settings()
        table = settings.mysql_table_faturamento
        rows = await fetch_all(
            f"""
            SELECT
              cliente,
              MAX(CASE WHEN valor_total_faturado > 0 THEN `data` END) AS ultima_compra,
              SUM(CASE
                    WHEN valor_total_faturado > 0
                    THEN valor_total_faturado ELSE 0 END) AS fat_total,
              SUM(CASE
                    WHEN valor_total_faturado > 0
                     AND `data` >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                    THEN valor_total_faturado ELSE 0 END) AS fat_12m,
              COUNT(DISTINCT CASE
                    WHEN valor_total_faturado > 0 THEN DATE(`data`) END) AS n_compras,
              SUM(CASE
                    WHEN valor_total_faturado > 0
                     AND `data` >= DATE_SUB(CURDATE(), INTERVAL 56 DAY)
                    THEN 1 ELSE 0 END) AS linhas_8s
            FROM `{table}`
            WHERE tipo_de_cliente LIKE %s
            GROUP BY cliente
            """,
            ("%Cliente%",),
        )

        recent = await fetch_all(
            f"""
            SELECT cliente, DATE(`data`) AS d
            FROM `{table}`
            WHERE tipo_de_cliente LIKE %s
              AND valor_total_faturado > 0
              AND `data` >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
            """,
            ("%Cliente%",),
        )
        by_client_days: dict[int, list[date]] = defaultdict(list)
        for row in recent:
            cid = as_int(row.get("cliente"))
            d = _parse_date(row.get("d"))
            if cid and d:
                by_client_days[cid].append(d)

        data: dict[int, dict] = {}
        fats = []
        for row in rows:
            cid = as_int(row.get("cliente"))
            if not cid:
                continue
            last = _parse_date(row.get("ultima_compra"))
            fat = as_float(row.get("fat_12m"))
            fat_total = as_float(row.get("fat_total"))
            days_since = (date.today() - last).days if last else None
            if days_since is not None and days_since < 0:
                days_since = 0
            unique_days = sorted(set(by_client_days.get(cid, [])))
            item = {
                "ultima_compra": last.isoformat() if last else None,
                "dias_sem_contato": days_since,
                "fat_12m": round(fat, 2),
                "fat_total": round(fat_total, 2),
                "n_compras": as_int(row.get("n_compras")) or 0,
                "streak": _streak(unique_days, last),
            }
            data[cid] = item
            if fat > 0:
                fats.append(fat)

        threshold = 0.0
        if fats:
            fats.sort()
            threshold = fats[int(len(fats) * 0.8)] if len(fats) > 5 else 3000
        for item in data.values():
            item["alto_valor"] = item["fat_12m"] >= max(threshold, 2500)

        _agg_cache["at"] = datetime.utcnow()
        _agg_cache["data"] = data
        return data


async def load_base_clients(force: bool = False) -> list[dict]:
    now = datetime.utcnow()
    if not force and _base_cache["at"] and now - _base_cache["at"] < CACHE_TTL and _base_cache["data"]:
        return _base_cache["data"]
    async with _base_lock:
        if not force and _base_cache["at"] and now - _base_cache["at"] < CACHE_TTL and _base_cache["data"]:
            return _base_cache["data"]
        settings = get_settings()
        table = settings.mysql_table_clientes
        rows = await fetch_all(f"SELECT * FROM `{table}`")
        clients = []
        for row in rows:
            situacao = as_str(pick(row, "Situação", "Situacao")).lower()
            tipo = as_str(pick(row, "Tp.Cliente", "TpCliente", "tipo")).lower()
            if situacao not in {"ativo", "ativa"}:
                continue
            if "fornecedor" in tipo or "integrado" in tipo:
                continue
            cid = as_int(pick(row, "Cliente", "id"))
            vid = as_int(pick(row, "Vendedor"))
            if not cid:
                continue
            cidade = as_str(pick(row, "Cidade"))
            bairro = as_str(pick(row, "Bairro"))
            rota = resolve_route(cidade, bairro)
            phone = as_str(pick(row, "Telefone")) or as_str(pick(row, "Telefone.1"))
            numero = as_str(pick(row, "Numero", "Número"))
            endereco = as_str(pick(row, "Endereço", "Endereco"))
            if numero and numero.lower() not in endereco.lower():
                endereco = f"{endereco}, {numero}".strip(", ")
            cpf = as_str(pick(row, "CPF/CGC", "CPF", "CNPJ", "CGC"))
            clients.append(
                {
                    "id": cid,
                    "nome": as_str(pick(row, "Nome Fantasia"))
                    or as_str(pick(row, "Razão Social", "Razao Social")),
                    "razao_social": as_str(pick(row, "Razão Social", "Razao Social")),
                    "endereco": endereco,
                    "bairro": bairro,
                    "cidade": cidade,
                    "uf": as_str(pick(row, "UF")),
                    "telefone": phone,
                    "cpf": cpf,
                    "cpf_digits": re.sub(r"\D", "", cpf),
                    "vendedor_id": vid,
                    "vendedor_nome": as_str(pick(row, "Nome")),
                    "vendedor": as_str(pick(row, "Nome")),
                    "situacao": as_str(pick(row, "Situação", "Situacao")),
                    "tipo": as_str(pick(row, "Tp.Cliente")),
                    "rota_id": rota["id"] if rota else None,
                    "rota_nome": rota["nome"] if rota else None,
                    "enviar_cards": rota["enviar_cards"] if rota else None,
                    "saida_carga": rota["saida_carga"] if rota else None,
                }
            )
        _base_cache["at"] = datetime.utcnow()
        _base_cache["data"] = clients
        return clients


async def load_all_clients(force: bool = False) -> list[dict]:
    return await load_base_clients(force)


async def load_televendas_clients(force: bool = False) -> list[dict]:
    return [c for c in await load_base_clients(force) if c.get("vendedor_id") in TELEVENDAS_IDS]


async def _status_maps(session: AsyncSession) -> tuple[dict, dict]:
    statuses = (await session.execute(select(Status).order_by(Status.sort_order))).scalars().all()
    status_by_id = {
        s.id: {
            "id": s.id,
            "label": s.label,
            "color": s.color,
            "is_system": s.is_system,
            "is_default": bool(getattr(s, "is_default", False)),
            "requires_motivo": bool(getattr(s, "requires_motivo", False)),
        }
        for s in statuses
    }
    rows = (await session.execute(select(ClientStatus))).scalars().all()
    by_client = {r.cliente_id: r for r in rows}
    return status_by_id, by_client


def _default_status_id(status_by_id: dict) -> str | None:
    for sid, meta in status_by_id.items():
        if meta.get("is_default") and sid not in AUTO_STATUS_IDS:
            return sid
    if "atendimento_hoje" in status_by_id:
        return "atendimento_hoje"
    return None


def _hydrate(
    client: dict,
    agg: dict,
    status_by_id: dict,
    cs: ClientStatus | None,
    apply_default: bool = False,
) -> dict:
    days = agg.get("dias_sem_contato")
    derived_recovery = days is not None and days > RECOVERY_DAYS
    status_id = cs.status_id if cs else None
    if cs and _pending_schedule(cs):
        status_id = "agendado"
    if derived_recovery and (not status_id or status_id == "em_recuperacao"):
        status_id = "em_recuperacao"
    if not derived_recovery and status_id == "em_recuperacao":
        status_id = None
    if apply_default and not status_id:
        fallback = _default_status_id(status_by_id)
        if fallback:
            status_id = fallback
    status = status_by_id.get(status_id) if status_id else None
    if not status:
        fallback = _default_status_id(status_by_id)
        if fallback:
            status_id = fallback
            status = status_by_id.get(status_id)
    item = {
        **client,
        **agg,
        "status_id": status_id,
        "status": status,
        "data_atendimento": cs.data_atendimento.isoformat() if cs and cs.data_atendimento else None,
        "observacoes": cs.observacoes if cs else None,
        "recontato": bool(cs.recontato) if cs else False,
        "updated_by": cs.updated_by if cs else None,
        "em_recuperacao": derived_recovery,
        "critico": bool(days is not None and days > HOT_RECOVERY_DAYS),
    }
    return item


def _schedule_date(cs: ClientStatus | None) -> date | None:
    if not cs:
        return None
    return _parse_date(cs.data_atendimento)


def _pending_schedule(cs: ClientStatus | None) -> bool:
    if not cs or (cs.status_id or "") in {"atendido", "finalizado"}:
        return False
    return _schedule_date(cs) is not None


def _mine_agenda(cs: ClientStatus | None, in_carteira: bool, sellers: frozenset[int]) -> bool:
    if not _pending_schedule(cs):
        return False
    vid = getattr(cs, "agenda_vendedor_id", None)
    if vid is not None:
        return vid in sellers
    return in_carteira


async def _upsert_extra(session: AsyncSession, cliente_id: int, day: date, vendedor_id: int, user: dict) -> None:
    existing = (
        await session.execute(
            select(ExtraAttendance).where(
                ExtraAttendance.cliente_id == cliente_id,
                ExtraAttendance.dia == day,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        session.add(
            ExtraAttendance(
                cliente_id=cliente_id,
                dia=day,
                vendedor_id=int(vendedor_id),
                added_by=user.get("login") or user.get("nome"),
            )
        )
        return
    existing.vendedor_id = int(vendedor_id)


async def apply_schedule(
    session: AsyncSession,
    cliente_id: int,
    user: dict,
    when: date,
    origem: str = "carteira",
    vendedor_id: int | None = None,
) -> dict:
    sellers = scoped_seller_ids(user, None)
    if user.get("role") == "colaborador":
        vendedor_id = user.get("vendedor_id")
    elif not vendedor_id:
        vendedor_id = next(iter(sellers), 0)
    row = await session.get(ClientStatus, cliente_id)
    if row is None:
        row = ClientStatus(cliente_id=cliente_id)
        session.add(row)
    old_day = _schedule_date(row)
    if old_day and old_day != when:
        old_extra = (
            await session.execute(
                select(ExtraAttendance).where(
                    ExtraAttendance.cliente_id == cliente_id,
                    ExtraAttendance.dia == old_day,
                )
            )
        ).scalar_one_or_none()
        if old_extra:
            await session.delete(old_extra)
    row.status_id = "agendado"
    row.data_atendimento = when
    row.agenda_origem = origem if origem in {"carteira", "recuperacao"} else "carteira"
    row.agenda_vendedor_id = int(vendedor_id or 0) or None
    row.updated_by = user.get("login") or user.get("nome")
    row.updated_at = datetime.utcnow()
    await _upsert_extra(session, cliente_id, when, int(vendedor_id or 0), user)
    await session.commit()
    await session.refresh(row)
    return {
        "cliente_id": row.cliente_id,
        "status_id": row.status_id,
        "data_atendimento": row.data_atendimento.isoformat() if row.data_atendimento else None,
        "agenda_origem": row.agenda_origem,
    }


async def clear_schedule(session: AsyncSession, cliente_id: int, user: dict) -> dict:
    row = await session.get(ClientStatus, cliente_id)
    if row is None:
        raise ValueError("Esse cliente não tem agendamento.")
    day = _schedule_date(row)
    if day:
        extra = (
            await session.execute(
                select(ExtraAttendance).where(
                    ExtraAttendance.cliente_id == cliente_id,
                    ExtraAttendance.dia == day,
                )
            )
        ).scalar_one_or_none()
        if extra:
            await session.delete(extra)
    was_recovery = (row.agenda_origem or "") == "recuperacao"
    row.data_atendimento = None
    row.agenda_origem = None
    row.agenda_vendedor_id = None
    if was_recovery:
        row.status_id = None
    else:
        statuses = (await session.execute(select(Status))).scalars().all()
        default = next((s.id for s in statuses if s.is_default and s.id not in AUTO_STATUS_IDS), None)
        row.status_id = default or "atendimento_hoje"
    row.updated_by = user.get("login") or user.get("nome")
    row.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(row)
    return {
        "cliente_id": row.cliente_id,
        "status_id": row.status_id,
        "data_atendimento": None,
        "agenda_origem": None,
    }


def _sort_today(items: list[dict]) -> list[dict]:
    return sorted(
        items,
        key=lambda c: (
            not c.get("agendado_hoje"),
            not c.get("extra_hoje"),
            -(c.get("streak") or 0),
            -(c.get("fat_12m") or 0),
            (c.get("nome") or ""),
        ),
    )


async def _extra_ids(session: AsyncSession, day: date, seller_ids: frozenset[int]) -> set[int]:
    rows = (await session.execute(select(ExtraAttendance).where(ExtraAttendance.dia == day))).scalars().all()
    return {r.cliente_id for r in rows if r.vendedor_id in seller_ids}


def _match_query(client: dict, q: str) -> bool:
    needle = q.strip().lower()
    if not needle:
        return True
    digits = re.sub(r"\D", "", q)
    blob = " ".join(
        str(client.get(k) or "")
        for k in ("nome", "razao_social", "endereco", "cidade", "bairro", "cpf", "id", "vendedor_nome")
    ).lower()
    if needle in blob:
        return True
    if digits and digits in (client.get("cpf_digits") or ""):
        return True
    if digits and digits == str(client.get("id") or ""):
        return True
    return False


async def load_top_products(cliente_ids: list[int], per_client: int = 5) -> dict[int, list[dict]]:
    ids = [int(i) for i in cliente_ids if i]
    if not ids:
        return {}
    try:
        table = get_settings().mysql_table_faturamento
        placeholders = ",".join(["%s"] * len(ids))
        rows = await fetch_all(
            f"""
            SELECT
              cliente,
              produto,
              descricao,
              SUM(valor_total_faturado) AS valor
            FROM `{table}`
            WHERE cliente IN ({placeholders})
              AND tipo_de_cliente LIKE %s
              AND valor_total_faturado > 0
            GROUP BY cliente, produto, descricao
            """,
            (*ids, "%Cliente%"),
        )
    except Exception:
        return {}
    by: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        cid = as_int(row.get("cliente"))
        if not cid:
            continue
        sku = as_int(row.get("produto"))
        nome = as_str(row.get("descricao")) or (f"Produto {sku}" if sku else "Produto")
        by[cid].append(
            {
                "sku": str(sku) if sku else None,
                "nome": nome,
                "valor": round(as_float(row.get("valor")), 2),
            }
        )
    out: dict[int, list[dict]] = {}
    for cid, items in by.items():
        items.sort(key=lambda x: -x["valor"])
        out[cid] = items[:per_client]
    return out


async def clients_today(
    session: AsyncSession,
    q: str = "",
    rota_id: str | None = None,
    status_id: str | None = None,
    page: int = 1,
    page_size: int = 10,
    ref: date | None = None,
    user: dict | None = None,
    vendedor_id: int | None = None,
    include_products: bool = True,
) -> dict:
    day = ref or date.today()
    day_routes = routes_for_day(day)
    route_ids = {r["id"] for r in day_routes}
    sellers = scoped_seller_ids(user, vendedor_id)
    clients, agg = await asyncio.gather(
        load_base_clients(),
        load_aggregates(),
    )
    status_by_id, by_cs = await _status_maps(session)
    extras = await _extra_ids(session, day, sellers)
    looking_agendados = status_id == "agendados"
    items = []
    carteira = 0
    agendados = 0
    for c in clients:
        cid = c.get("id")
        cs = by_cs.get(cid)
        in_carteira = c.get("vendedor_id") in sellers
        extra = cid in extras
        pending = _pending_schedule(cs)
        sched_day = _schedule_date(cs)
        scheduled_today = pending and sched_day == day
        mine_agenda = _mine_agenda(cs, in_carteira, sellers)
        on_route = in_carteira and c.get("rota_id") in route_ids
        if in_carteira:
            carteira += 1
        if mine_agenda:
            agendados += 1
        if looking_agendados:
            if not mine_agenda:
                continue
        else:
            if mine_agenda and sched_day is not None and sched_day != day:
                continue
            if not on_route and not extra and not (scheduled_today and mine_agenda):
                continue
        if (
            rota_id
            and rota_id not in {"", "todas"}
            and c.get("rota_id") != rota_id
            and not extra
            and not scheduled_today
            and not looking_agendados
        ):
            continue
        metrics = agg.get(cid) or {}
        if (
            not looking_agendados
            and on_route
            and not extra
            and not scheduled_today
            and not metrics.get("ultima_compra")
        ):
            continue
        if not _match_query(c, q):
            continue
        origem = "recuperacao" if cs and getattr(cs, "agenda_origem", None) == "recuperacao" else "carteira"
        item = _hydrate(c, metrics, status_by_id, cs, apply_default=not pending)
        item["extra_hoje"] = extra and not on_route and not scheduled_today
        item["agendado_hoje"] = bool(scheduled_today and mine_agenda)
        item["origem"] = origem
        if cs and getattr(cs, "agenda_vendedor_id", None):
            item["assigned_vendedor_id"] = cs.agenda_vendedor_id
        items.append(item)

    if status_id and status_id not in {"", "todos", "agendados", "sem_status"}:
        items = [i for i in items if i.get("status_id") == status_id]

    if looking_agendados:
        items = sorted(items, key=lambda c: (c.get("data_atendimento") or "9999", c.get("nome") or ""))
    else:
        items = _sort_today(items)
    total = len(items)
    start = max(page - 1, 0) * page_size
    sliced = items[start : start + page_size]
    tops = await load_top_products([i["id"] for i in sliced]) if include_products else {}
    for item in sliced:
        fat = float(item.get("fat_12m") or 0)
        n = int(item.get("n_compras") or 0)
        item["ticket_medio"] = round(fat / n, 2) if n else 0.0
        item["fat_medio_mes"] = round(fat / 12, 2) if fat else 0.0
        item["produtos_top"] = tops.get(item["id"], [])
    return {
        "date": day.isoformat(),
        "routes": day_routes,
        "total": total,
        "page": page,
        "page_size": page_size,
        "carteira": carteira,
        "agendados": agendados,
        "colaboradoras": public_team(),
        "items": sliced,
    }


async def clients_recovery(
    session: AsyncSession,
    q: str = "",
    alto_valor: bool = False,
    recontato: bool = False,
    faixa: str = "todas",
    page: int = 1,
    page_size: int = 10,
    user: dict | None = None,
    vendedor_id: int | None = None,
    ref: date | None = None,
) -> dict:
    from app.services.recovery import clients_recovery as assigned_recovery

    return await assigned_recovery(
        session,
        q=q,
        faixa=faixa,
        page=page,
        page_size=page_size,
        user=user,
        vendedor_id=vendedor_id,
        ref=ref,
    )


async def dashboard(
    session: AsyncSession,
    ref: date | None = None,
    user: dict | None = None,
    vendedor_id: int | None = None,
) -> dict:
    adm = (user or {}).get("role") == "adm"
    load_vid = None if adm else vendedor_id
    payload = await clients_today(
        session,
        page=1,
        page_size=10000,
        ref=ref,
        user=user,
        vendedor_id=load_vid,
        include_products=False,
    )
    recovery = await clients_recovery(session, page=1, page_size=10000, user=user, vendedor_id=load_vid)
    base = await load_base_clients()
    statuses = (await session.execute(select(Status).order_by(Status.sort_order))).scalars().all()
    rec_items = recovery.get("items") or []
    carteira_by: dict[int, int] = defaultdict(int)
    for c in base:
        vid = c.get("vendedor_id")
        if vid in TELEVENDAS_IDS:
            carteira_by[int(vid)] += 1

    def _slice(today_items: list[dict], rec_for: list[dict], carteira_n: int) -> dict:
        counts: dict[str, int] = defaultdict(int)
        for item in today_items:
            sid = (item.get("status") or {}).get("id") or "atendimento_hoje"
            if sid == "sem_status":
                sid = "atendimento_hoje"
            counts[sid] += 1
        total = len(today_items) or 1
        bars = []
        for s in statuses:
            if s.id in AUTO_STATUS_IDS:
                continue
            n = counts.get(s.id, 0)
            bars.append(
                {
                    "id": s.id,
                    "label": s.label,
                    "color": s.color,
                    "count": n,
                    "pct": round(100 * n / total),
                }
            )
        route_counts: dict[str, int] = defaultdict(int)
        for item in today_items:
            if item.get("rota_id"):
                route_counts[item["rota_id"]] += 1
        routes = [{**r, "clientes": route_counts.get(r["id"], 0)} for r in payload["routes"]]
        return {
            "kpis": {
                "clientes_dia": len(today_items),
                "em_atendimento": counts.get("em_atendimento", 0),
                "atendidos": counts.get("atendido", 0),
                "em_recuperacao": len(rec_for),
                "carteira": carteira_n,
            },
            "bars": bars,
            "routes": routes,
        }

    all_today = payload["items"]
    if vendedor_id:
        today_items = [i for i in all_today if i.get("vendedor_id") == vendedor_id]
        rec_for = [i for i in rec_items if i.get("assigned_vendedor_id") == vendedor_id]
        carteira_n = carteira_by.get(vendedor_id, 0)
    else:
        today_items = all_today
        rec_for = rec_items
        carteira_n = sum(carteira_by[c.vendedor_id] for c in TEAM)

    built = _slice(today_items, rec_for, carteira_n)
    por: dict[str, dict] = {}
    if adm:
        for col in TEAM:
            t = [i for i in all_today if i.get("vendedor_id") == col.vendedor_id]
            r = [i for i in rec_items if i.get("assigned_vendedor_id") == col.vendedor_id]
            por[str(col.vendedor_id)] = _slice(t, r, carteira_by.get(col.vendedor_id, 0))

    return {
        "date": payload["date"],
        **built,
        "colaboradoras": public_team(),
        "por_colaboradora": por,
        "recovery_high_value": (recovery.get("niveis") or {}).get("180_mais", 0),
    }


async def week_routes(
    session: AsyncSession,
    user: dict | None = None,
    vendedor_id: int | None = None,
) -> dict:
    from app.services.routes_sheet import week_board

    board = week_board()
    sellers = scoped_seller_ids(user, vendedor_id)
    clients = await load_base_clients()
    by_rota = defaultdict(int)
    for c in clients:
        if c.get("vendedor_id") not in sellers:
            continue
        if c.get("rota_id"):
            by_rota[c["rota_id"]] += 1
    days = []
    for day in board:
        routes = []
        total = 0
        for r in day["routes"]:
            n = by_rota.get(r["id"], 0)
            total += n
            routes.append({**r, "clientes": n})
        days.append({**day, "routes": routes, "clientes": total})
    return {"days": days}


def route_pills() -> list[dict]:
    cat = catalog()
    return [{"id": r["id"], "nome": r["nome"]} for r in cat.routes.values()]


async def search_carteira(
    session: AsyncSession,
    q: str,
    user: dict | None = None,
    vendedor_id: int | None = None,
    limit: int = 20,
) -> list[dict]:
    if len(q.strip()) < 2:
        return []
    sellers = scoped_seller_ids(user, vendedor_id)
    clients, agg, (status_by_id, by_cs) = await asyncio.gather(
        load_base_clients(),
        load_aggregates(),
        _status_maps(session),
    )
    found: list[dict] = []
    for c in clients:
        if c.get("vendedor_id") not in sellers:
            continue
        if not _match_query(c, q):
            continue
        found.append(_hydrate(c, agg.get(c["id"]) or {}, status_by_id, by_cs.get(c["id"])))
        if len(found) >= limit:
            break
    return found


async def add_to_today(
    session: AsyncSession,
    cliente_id: int,
    user: dict,
) -> dict:
    sellers = scoped_seller_ids(user, None)
    clients = await load_base_clients()
    client = next((c for c in clients if c["id"] == cliente_id), None)
    if not client:
        raise ValueError("Cliente não encontrado na carteira do Televendas.")
    if client.get("vendedor_id") not in sellers:
        raise ValueError("Esse cliente não pertence à sua carteira.")
    day = date.today()
    existing = (
        await session.execute(
            select(ExtraAttendance).where(
                ExtraAttendance.cliente_id == cliente_id,
                ExtraAttendance.dia == day,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        session.add(
            ExtraAttendance(
                cliente_id=cliente_id,
                dia=day,
                vendedor_id=int(client["vendedor_id"]),
                added_by=user.get("login") or user.get("nome"),
            )
        )
    row = await session.get(ClientStatus, cliente_id)
    if row is None:
        row = ClientStatus(cliente_id=cliente_id)
        session.add(row)
    if not row.status_id or row.status_id == "em_recuperacao":
        statuses = (await session.execute(select(Status))).scalars().all()
        default = next((s.id for s in statuses if s.is_default and s.id != "em_recuperacao"), None)
        row.status_id = default or "atendimento_hoje"
    row.updated_by = user.get("login") or user.get("nome")
    row.updated_at = datetime.utcnow()
    await session.commit()
    return {"ok": True, "cliente_id": cliente_id, "extra": True}
