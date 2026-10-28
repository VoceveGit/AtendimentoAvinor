import os
from pathlib import Path

os.environ.setdefault("AVINOR_SECRET_KEY", "test-secret-key-avinor-local")
os.environ["AVINOR_SKIP_WARMUP"] = "1"
os.environ["WRITE_DATABASE_URL"] = "sqlite+aiosqlite:///" + Path(__file__).resolve().parent.joinpath("test.db").as_posix()
