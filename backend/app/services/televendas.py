from __future__ import annotations

import json
from dataclasses import dataclass

from app.crypto import decrypt_text, encrypt_text
from app.services.normalize import norm_key, strip_accents


@dataclass(frozen=True)
class Colaboradora:
    vendedor_id: int
    nome: str
    login: str
    aliases: tuple[str, ...]


SEED_TEAM: tuple[Colaboradora, ...] = (
    Colaboradora(
        vendedor_id=1071,
        nome="Poliana",
        login="poliana",
        aliases=("poliana", "polianapessoa", "poliana pessoa"),
    ),
    Colaboradora(
        vendedor_id=1072,
        nome="Fernanda",
        login="fernanda",
        aliases=("fernanda", "fernandaabade", "fernanda abade"),
    ),
    Colaboradora(
        vendedor_id=1073,
        nome="Karolline",
        login="karolline",
        aliases=("karolline", "karol", "carol", "carolina"),
    ),
)

TEAM: list[Colaboradora] = list(SEED_TEAM)
TELEVENDAS_IDS: frozenset[int] = frozenset(c.vendedor_id for c in TEAM)
ADM_LOGINS = frozenset({"adm", "admin", "administrador"})
ADM_PASSWORD = "adm"

_live_rows: list[dict] = []


def _norm_login(value: str) -> str:
    return strip_accents(value or "").strip().lower()


def apply_account_rows(rows: list[dict]) -> None:
    global TEAM, TELEVENDAS_IDS, _live_rows
    _live_rows = [r for r in rows if r.get("active", True)]
    cols: list[Colaboradora] = []
    for r in _live_rows:
        if r.get("role") != "colaborador" or not r.get("vendedor_id"):
            continue
        aliases = tuple(str(a) for a in (r.get("aliases") or []) if a)
        cols.append(
            Colaboradora(
                vendedor_id=int(r["vendedor_id"]),
                nome=r["nome"],
                login=r["login"],
                aliases=aliases,
            )
        )
    TEAM = cols or list(SEED_TEAM)
    TELEVENDAS_IDS = frozenset(c.vendedor_id for c in TEAM)


def public_team() -> list[dict]:
    return [{"id": c.vendedor_id, "nome": c.nome, "login": c.login} for c in TEAM]


def find_colaboradora(username: str) -> Colaboradora | None:
    key = _norm_login(username)
    compact = norm_key(username)
    for item in TEAM:
        names = {_norm_login(item.login), _norm_login(item.nome), *(_norm_login(a) for a in item.aliases)}
        if key in names or compact == norm_key(item.nome) or compact == item.login:
            return item
    return None


def _match_row(row: dict, username: str) -> bool:
    key = _norm_login(username)
    compact = norm_key(username)
    names = {_norm_login(row.get("login") or ""), _norm_login(row.get("nome") or "")}
    for a in row.get("aliases") or []:
        names.add(_norm_login(str(a)))
    if row.get("role") == "adm":
        names |= ADM_LOGINS
    return key in names or compact == norm_key(row.get("nome") or "") or compact == _norm_login(row.get("login") or "")


def _password_ok(row: dict, pwd: str) -> bool:
    stored = decrypt_text(row.get("password_enc") or "")
    if stored and pwd == stored:
        return True
    vid = row.get("vendedor_id")
    if vid and pwd == str(vid):
        return True
    if row.get("role") == "adm" and pwd.lower() == ADM_PASSWORD and not stored:
        return True
    return False


def authenticate(username: str, password: str) -> dict | None:
    user = (username or "").strip()
    pwd = (password or "").strip()
    if not user or not pwd:
        return None
    if _live_rows:
        for row in _live_rows:
            if not _match_row(row, user):
                continue
            if not _password_ok(row, pwd):
                return None
            return {
                "role": row["role"],
                "login": row["login"],
                "nome": row["nome"],
                "vendedor_id": row.get("vendedor_id"),
            }
        return None
    if _norm_login(user) in ADM_LOGINS and pwd.lower() == ADM_PASSWORD:
        return {
            "role": "adm",
            "login": "adm",
            "nome": "Administrador",
            "vendedor_id": None,
        }
    colab = find_colaboradora(user)
    if colab and pwd == str(colab.vendedor_id):
        return {
            "role": "colaborador",
            "login": colab.login,
            "nome": colab.nome,
            "vendedor_id": colab.vendedor_id,
        }
    return None


def issue_token(user: dict) -> str:
    return encrypt_text(json.dumps(user, ensure_ascii=False))


def read_token(token: str) -> dict | None:
    if not token:
        return None
    try:
        data = json.loads(decrypt_text(token))
    except (json.JSONDecodeError, TypeError, ValueError):
        return None
    if not isinstance(data, dict) or data.get("role") not in {"adm", "colaborador"}:
        return None
    return data


def scoped_seller_ids(user: dict | None, requested: int | None = None) -> frozenset[int]:
    ids = TELEVENDAS_IDS
    if user and user.get("role") == "colaborador" and user.get("vendedor_id"):
        vid = int(user["vendedor_id"])
        return frozenset({vid}) if vid in ids else frozenset()
    if requested and requested in ids:
        return frozenset({requested})
    return ids
