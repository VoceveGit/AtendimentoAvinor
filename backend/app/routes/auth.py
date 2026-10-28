from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.televendas import authenticate, issue_token, public_team

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(payload: LoginIn):
    user = authenticate(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos.")
    token = issue_token(user)
    return {**user, "token": token, "colaboradoras": public_team()}


@router.get("/team")
async def team():
    return public_team()
