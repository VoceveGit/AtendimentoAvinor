import pytest
from httpx import ASGITransport, AsyncClient

from app.db.write import init_write_db
from app.main import app


@pytest.fixture(autouse=True)
async def setup_db():
    await init_write_db()
    yield


@pytest.mark.asyncio
async def test_list_and_create_status():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        listed = await client.get("/api/statuses")
        assert listed.status_code == 200
        ids = {s["id"] for s in listed.json()}
        assert "em_atendimento" in ids
        assert "em_recuperacao" in ids

        created = await client.post("/api/statuses", json={"label": "Aguardando retorno", "color": "sky"})
        assert created.status_code == 200
        assert created.json()["label"] == "Aguardando retorno"

        forbidden = await client.delete("/api/statuses/em_recuperacao")
        assert forbidden.status_code == 400

        listed = await client.get("/api/statuses")
        defaults = [s for s in listed.json() if s.get("is_default")]
        assert len(defaults) == 1
        assert defaults[0]["id"] == "atendimento_hoje"

        switched = await client.post("/api/statuses/em_atendimento/default")
        assert switched.status_code == 200
        listed = await client.get("/api/statuses")
        defaults = [s["id"] for s in listed.json() if s.get("is_default")]
        assert defaults == ["em_atendimento"]

        blocked = await client.post("/api/statuses/em_recuperacao/default")
        assert blocked.status_code == 400
