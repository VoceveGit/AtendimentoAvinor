from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta

WEEKDAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

_NAME_TO_IDX = {
    "domingo": 6,
    "segunda": 0,
    "seg": 0,
    "terca": 1,
    "terça": 1,
    "ter": 1,
    "quarta": 2,
    "qua": 2,
    "quinta": 3,
    "qui": 3,
    "sexta": 4,
    "sex": 4,
    "sabado": 5,
    "sábado": 5,
    "sab": 5,
}


@dataclass
class DaySpec:
    weekdays: list[int]
    biweekly: bool
    raw: str

    def matches(self, day: date) -> bool:
        if day.weekday() not in self.weekdays:
            return False
        if self.biweekly and day.isocalendar().week % 2 == 0:
            return False
        return True


def parse_day_spec(raw: str | None) -> DaySpec:
    text = (raw or "").strip()
    if not text:
        return DaySpec(weekdays=[], biweekly=False, raw="")

    lowered = (
        text.lower()
        .replace("feira", "")
        .replace("feiras", "")
        .replace("ª", "")
    )
    biweekly = "quinzenal" in lowered
    lowered = re.sub(r"\([^)]*quinzenal[^)]*\)", " ", lowered)
    lowered = lowered.replace("quinzenal", " ")

    weekdays: list[int] = []
    range_match = re.search(
        r"(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado)\s*a\s*"
        r"(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado)",
        lowered,
    )
    if range_match:
        start = _NAME_TO_IDX[range_match.group(1)]
        end = _NAME_TO_IDX[range_match.group(2)]
        if start <= end:
            weekdays = list(range(start, end + 1))
        else:
            weekdays = list(range(start, 7)) + list(range(0, end + 1))
    else:
        for token in re.split(r"[^a-záéíóúâêôãõç]+", lowered):
            idx = _NAME_TO_IDX.get(token)
            if idx is not None and idx not in weekdays:
                weekdays.append(idx)

    return DaySpec(weekdays=weekdays, biweekly=biweekly, raw=text)


def week_dates(ref: date | None = None) -> list[date]:
    """Monday–Saturday of the current operational week."""
    today = ref or date.today()
    monday = today - timedelta(days=today.weekday())
    return [monday + timedelta(days=i) for i in range(6)]
