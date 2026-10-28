from app.db.write import neon_asyncpg_url


def test_strips_channel_binding_and_sslmode():
    raw = (
        "postgresql://user:pass@ep-xx.us-east-2.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require"
    )
    out = neon_asyncpg_url(raw)
    assert out.startswith("postgresql+asyncpg://")
    assert "sslmode" not in out
    assert "channel_binding" not in out
    assert "neondb" in out


def test_postgres_scheme():
    out = neon_asyncpg_url("postgres://u:p@host/db?sslmode=require")
    assert out == "postgresql+asyncpg://u:p@host/db"
