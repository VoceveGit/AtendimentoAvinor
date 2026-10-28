from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
PROJECT_ROOT = ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(ROOT / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    avinor_secret_key: str = "change-me-generate-a-fernet-key"

    mysql_host: str = "45.79.29.86"
    mysql_port: int = 3306
    mysql_user: str = "gccconsultoria"
    mysql_password: str = ""
    mysql_database: str = "EXTRACTOR"
    mysql_ssl: bool = False

    neon_database_url: str = ""
    neon_pool_min: int = 2
    neon_pool_max: int = 10
    neon_ssl: bool = True

    write_database_url: str = f"sqlite+aiosqlite:///{(DATA_DIR / 'avinor.db').as_posix()}"

    rotas_xlsx: str = str(DATA_DIR / "ROTAS AVINOR.xlsx")
    cursor_prompt_path: str = str(PROJECT_ROOT / "CURSOR_PROMPT.md")
    cors_origins: str = ""

    mysql_table_clientes: str = "base_clientes_avinor"
    mysql_table_faturamento: str = "faturamento_avinor"
    mysql_table_pedidos: str = "base_pedidos_avinor"

    def cors_list(self) -> list[str]:
        extra = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return extra or ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
