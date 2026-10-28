import pytest
from httpx import ASGITransport, AsyncClient

from app.db.write import init_write_db
from app.main import app
from app.services.televendas import authenticate, issue_token


@pytest.fixture(autouse=True)
async def setup_db():
    await init_write_db()
    yield


@pytest.mark.asyncio
async def test_accounts_crud_and_login():
    token = issue_token(authenticate("adm", "adm"))
    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        listed = await client.get("/api/accounts", headers=headers)
        assert listed.status_code == 200
        logins = {a["login"] for a in listed.json()}
        assert "adm" in logins
        assert "poliana" in logins

        created = await client.post(
            "/api/accounts",
            headers=headers,
            json={"nome": "Nova", "login": "nova", "password": "9999", "vendedor_id": 1099, "role": "colaborador"},
        )
        assert created.status_code == 200
        assert authenticate("nova", "9999")["vendedor_id"] == 1099

        aid = created.json()["id"]
        patched = await client.patch(f"/api/accounts/{aid}", headers=headers, json={"password": "8888"})
        assert patched.status_code == 200
        assert authenticate("nova", "9999") is None
        assert authenticate("nova", "8888") is not None
