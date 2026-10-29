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
        assert "agendado" in ids
        autos = {s["id"] for s in listed.json() if s.get("is_automatic") or s.get("is_system")}
        assert "agendado" in autos
        assert "finalizado" in autos
        if "atendimento_hoje" in ids:
            await client.post("/api/statuses/atendimento_hoje/default")

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


@pytest.mark.asyncio
async def test_deleted_status_does_not_come_back_on_boot():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        created = await client.post("/api/statuses", json={"label": "Temporario Persist", "color": "sky"})
        assert created.status_code == 200
        sid = created.json()["id"]
        deleted = await client.delete(f"/api/statuses/{sid}")
        assert deleted.status_code == 200
        await init_write_db()
        listed = await client.get("/api/statuses")
        ids = {s["id"] for s in listed.json()}
        assert sid not in ids
        assert "atendimento_hoje" in ids

        protected = {"em_recuperacao", "finalizado", "atendido", "agendado", "atendimento_hoje", "em_atendimento"}
        seed_id = next((i for i in ids if i not in protected), None)
        if seed_id:
            gone = await client.delete(f"/api/statuses/{seed_id}")
            assert gone.status_code == 200
            await init_write_db()
            ids = {s["id"] for s in (await client.get("/api/statuses")).json()}
            assert seed_id not in ids
