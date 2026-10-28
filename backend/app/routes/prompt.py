from pathlib import Path

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(prefix="/api/prompt", tags=["prompt"])


@router.get("")
async def get_prompt():
    settings = get_settings()
    candidates = [
        Path(settings.cursor_prompt_path),
        Path(__file__).resolve().parents[3] / "CURSOR_PROMPT.md",
        Path(__file__).resolve().parents[2] / "data" / "CURSOR_PROMPT.md",
    ]
    path = next((p for p in candidates if p.exists()), candidates[0])
    if not path.exists():
        return {"content": "CURSOR_PROMPT.md ainda não foi gerado.", "path": str(path)}
    return {"content": path.read_text(encoding="utf-8"), "path": str(path)}
