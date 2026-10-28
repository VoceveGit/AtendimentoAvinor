from app.services.recovery import already_bought, pick_recovery_items, recovery_score, stage_of


def test_recent_or_never_are_not_recovery():
    assert stage_of(None) is None
    assert stage_of(0) is None
    assert stage_of(15) is None
    assert stage_of(30) is None
    assert stage_of(31) == "31_60"
    assert stage_of(60) == "31_60"
    assert stage_of(61) == "61_90"
    assert stage_of(89) == "61_90"
    assert stage_of(90) == "90_mais"
    assert stage_of(200) == "90_mais"


def test_already_bought_requires_real_purchase():
    assert already_bought({}) is False
    assert already_bought({"ultima_compra": None, "n_compras": 0}) is False
    assert already_bought({"ultima_compra": "2026-08-01", "n_compras": 0}) is False
    assert already_bought({"ultima_compra": "2026-08-01", "n_compras": 4}) is True


def test_pick_keeps_best_clients_in_each_column():
    team = [1071, 1072, 1073]
    candidates = []
    for i in range(15):
        candidates.append(
            {
                "id": 100 + i,
                "dias_sem_contato": 40,
                "fat_12m": float(i * 100),
                "fat_total": float(i * 100),
                "n_compras": 3,
                "ultima_compra": "2026-09-18",
            }
        )
    for i in range(12):
        candidates.append(
            {
                "id": 200 + i,
                "dias_sem_contato": 70,
                "fat_12m": float(i * 50),
                "fat_total": float(i * 80),
                "n_compras": 2,
                "ultima_compra": "2026-08-19",
            }
        )
    for i in range(8):
        candidates.append(
            {
                "id": 300 + i,
                "dias_sem_contato": 120,
                "fat_12m": 0.0,
                "fat_total": float(5000 + i * 1000),
                "n_compras": 10,
                "ultima_compra": "2026-06-01",
            }
        )
    candidates.append(
        {
            "id": 999,
            "dias_sem_contato": None,
            "fat_12m": 99999,
            "fat_total": 99999,
            "n_compras": 0,
            "ultima_compra": None,
        }
    )
    picked = pick_recovery_items(candidates, team)
    by_stage: dict[str, list[int]] = {"31_60": [], "61_90": [], "90_mais": []}
    for item in picked:
        by_stage[item["nivel"]].append(item["id"])

    assert 999 not in {p["id"] for p in picked}
    assert by_stage["31_60"] == list(range(114, 104, -1))
    assert by_stage["61_90"] == list(range(211, 201, -1))
    assert by_stage["90_mais"] == list(range(307, 299, -1))
    assert {p["assigned_vendedor_id"] for p in picked} == {1071, 1072, 1073}


def test_recovery_score_prefers_history_when_12m_is_zero():
    cold = {"fat_12m": 0, "fat_total": 80000, "n_compras": 40}
    weak = {"fat_12m": 0, "fat_total": 200, "n_compras": 1}
    assert recovery_score(cold) < recovery_score(weak)
