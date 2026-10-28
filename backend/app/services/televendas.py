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


TEAM: tuple[Colaboradora, ...] = (
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

TELEVENDAS_IDS: frozenset[int] = frozenset(c.vendedor_id for c in TEAM)
ADM_LOGINS = frozenset({"adm", "admin", "administrador"})
ADM_PASSWORD = "adm"


def _norm_login(value: str) -> str:
    return strip_accents(value or "").strip().lower()


def public_team() -> list[dict]:
    return [
        {"id": c.vendedor_id, "nome": c.nome, "login": c.login}
        for c in TEAM
    ]


def find_colaboradora(username: str) -> Colaboradora | None:
    key = _norm_login(username)
    compact = norm_key(username)
    for item in TEAM:
        names = {_norm_login(item.login), _norm_login(item.nome), *( _norm_login(a) for a in item.aliases )}
        if key in names or compact == norm_key(item.nome) or compact == item.login:
            return item
    return None


def authenticate(username: str, password: str) -> dict | None:
    user = (username or "").strip()
    pwd = (password or "").strip()
    if not user or not pwd:
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
    if user and user.get("role") == "colaborador" and user.get("vendedor_id"):
        vid = int(user["vendedor_id"])
        return frozenset({vid}) if vid in TELEVENDAS_IDS else frozenset()
    if requested and requested in TELEVENDAS_IDS:
        return frozenset({requested})
    return TELEVENDAS_IDS
