import re
import unicodedata
from typing import Any


def strip_accents(value: str) -> str:
    return "".join(
        ch for ch in unicodedata.normalize("NFKD", value) if not unicodedata.combining(ch)
    )


def norm_key(value: str) -> str:
    text = strip_accents(str(value or "")).lower()
    text = re.sub(r"_?x000d_?", " ", text)
    text = re.sub(r"[^a-z0-9]+", "", text)
    return text


def norm_place(value: str | None) -> str:
    text = strip_accents(str(value or "")).upper().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def pick(row: dict[str, Any], *candidates: str) -> Any:
    indexed = {norm_key(k): v for k, v in row.items()}
    for name in candidates:
        val = indexed.get(norm_key(name))
        if val is not None and val != "":
            return val
    return None


def as_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def as_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()
