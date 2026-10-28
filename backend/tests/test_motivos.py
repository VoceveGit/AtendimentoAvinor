import pytest
from httpx import ASGITransport, AsyncClient

from app.db.write import init_write_db
from app.main import app
from app.services.televendas import authenticate, issue_token


@pytest.fixture(autouse=True)
async def setup_db():
    await init_write_db()
    yield


def _headers(login="adm", password="adm"):
    token = issue_token(authenticate(login, password))
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_seeded_motivos_and_adm_crud():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        listed = await client.get("/api/motivos", headers=_headers())
        assert listed.status_code == 200
        labels = {m["label"] for m in listed.json()}
        assert "Preço alto" in labels
        assert "Comprou com o concorrente" in labels

        created = await client.post("/api/motivos", headers=_headers(), json={"label": "Cliente de férias"})
        assert created.status_code == 200
        mid = created.json()["id"]
        assert created.json()["label"] == "Cliente de férias"

        patched = await client.patch(
            f"/api/motivos/{mid}",
            headers=_headers(),
            json={"label": "Cliente de férias", "active": False},
        )
        assert patched.status_code == 200
        assert patched.json()["active"] is False

        gone = await client.delete(f"/api/motivos/{mid}", headers=_headers())
        assert gone.status_code == 200
        ids = {m["id"] for m in (await client.get("/api/motivos", headers=_headers())).json()}
        assert mid not in ids


@pytest.mark.asyncio
async def test_collaborator_cannot_edit_motivos():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        listed = await client.get("/api/motivos", headers=_headers("poliana", "1071"))
        assert listed.status_code == 200
        blocked = await client.post(
            "/api/motivos",
            headers=_headers("poliana", "1071"),
            json={"label": "Inventado"},
        )
        assert blocked.status_code == 403


@pytest.mark.asyncio
async def test_deleted_motivo_does_not_come_back_on_boot():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post("/api/motivos", headers=_headers(), json={"label": "Temporario Motivo"})
        mid = created.json()["id"]
        await client.delete(f"/api/motivos/{mid}", headers=_headers())
        await init_write_db()
        ids = {m["id"] for m in (await client.get("/api/motivos", headers=_headers())).json()}
        assert mid not in ids
        assert "preco_alto" in ids
