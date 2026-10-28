from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

from app.config import get_settings
from app.db.mysql import fetch_all
from app.services.clients import _parse_date
from app.services.normalize import as_float, as_int, as_str, pick


def _codigo_num(raw: str) -> float | None:
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit() or ch == ".")
    if not digits:
        return None
    try:
        return float(digits)
    except ValueError:
        return None


def _item_from_row(row: dict[str, Any]) -> dict:
    qtd = as_float(
        pick(
            row,
            "Quant. Pedida",
            "Quant Pedida",
            "Quantidade",
            "Quant._x000D_ Pedida",
            "Quant. Atendida",
            "Quant Atendida",
            "Quant._x000D_ Atendida",
        )
    )
    valor = as_float(
        pick(
            row,
            "Valor Previsto",
            "Valor_x000D_ Previsto",
            "Valor ST",
            "Valor_x000D_ ST",
            "Valor",
        )
    )
    return {
        "produto": as_str(pick(row, "Produto")),
        "descricao": as_str(pick(row, "Descricao", "Descrição")),
        "qtd": qtd,
        "valor": round(valor or 0, 2),
        "um": as_str(pick(row, "UM")),
    }


def _order_from_rows(codigo: str, rows: list[dict[str, Any]]) -> dict | None:
    if not rows:
        return None
    first = rows[0]
    itens = [_item_from_row(r) for r in rows]
    total = round(sum(i["valor"] or 0 for i in itens), 2)
    dt = _parse_date(pick(first, "Dt.Entrega", "Dt Entrega", "Data", "Emissao", "Dt.Emissao"))
    vendedor = as_int(pick(first, "Vendedor"))
    return {
        "codigo": str(as_int(pick(first, "Pedido")) or codigo),
        "cliente_id": as_int(pick(first, "Cliente")),
        "cliente_nome": as_str(pick(first, "Razao Social", "Razão Social")),
        "vendedor_id": vendedor,
        "status": as_str(pick(first, "Status")).strip(),
        "data_pedido": dt.isoformat() if dt else None,
        "data_emissao": dt.isoformat() if dt else None,
        "valor_total": total,
        "itens": itens,
        "found": True,
    }


async def lookup_pedido(codigo: str) -> dict:
    num = _codigo_num(codigo)
    if num is None:
        return {"found": False, "codigo": codigo}
    table = get_settings().mysql_table_pedidos
    rows = await fetch_all(
        f"SELECT * FROM `{table}` WHERE Pedido = %s",
        (num,),
    )
    built = _order_from_rows(codigo, rows)
    if built:
        return built
    return {"found": False, "codigo": str(int(num)) if num == int(num) else str(num)}


async def lookup_many(codigos: list[str]) -> dict[str, dict]:
    nums: dict[str, float] = {}
    for raw in codigos:
        n = _codigo_num(raw)
        if n is not None:
            nums[str(int(n)) if n == int(n) else str(n)] = n
    if not nums:
        return {}
    table = get_settings().mysql_table_pedidos
    placeholders = ",".join(["%s"] * len(nums))
    rows = await fetch_all(
        f"SELECT * FROM `{table}` WHERE Pedido IN ({placeholders})",
        tuple(nums.values()),
    )
    grouped: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        cid = as_int(pick(row, "Pedido"))
        if cid:
            grouped[cid].append(row)
    out: dict[str, dict] = {}
    for key, num in nums.items():
        built = _order_from_rows(key, grouped.get(int(num), []))
        if built:
            out[built["codigo"]] = built
            out[key] = built
    return out
