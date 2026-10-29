import os
from pathlib import Path

os.environ.setdefault("AVINOR_SECRET_KEY", "test-secret-key-avinor-local")
os.environ["AVINOR_SKIP_WARMUP"] = "1"
_db = Path(__file__).resolve().parent.joinpath("test.db")
for leftover in (_db, Path(str(_db) + "-wal"), Path(str(_db) + "-shm")):
    if leftover.exists():
        leftover.unlink()
os.environ["WRITE_DATABASE_URL"] = "sqlite+aiosqlite:///" + _db.as_posix()
