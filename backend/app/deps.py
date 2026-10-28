from __future__ import annotations

from fastapi import Header, HTTPException

from app.services.televendas import read_token


async def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Faça login para continuar.")
    token = authorization.split(" ", 1)[1].strip()
    user = read_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sessão inválida. Entre de novo.")
    return user
