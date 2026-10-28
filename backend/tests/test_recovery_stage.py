from app.services.recovery import already_bought, pick_recovery_items, recovery_score, stage_of


def test_under_60_days_is_not_recovery():
    assert stage_of(None) is None
    assert stage_of(0) is None
    assert stage_of(31) is None
    assert stage_of(59) is None
    assert stage_of(60) == "60_90"
    assert stage_of(90) == "60_90"
    assert stage_of(91) == "90_180"
    assert stage_of(179) == "90_180"
    assert stage_of(180) == "180_mais"
    assert stage_of(400) == "180_mais"


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
                "dias_sem_contato": 75,
                "fat_12m": float(i * 100),
                "fat_total": float(i * 100),
                "n_compras": 3,
                "ultima_compra": "2026-08-14",
            }
        )
    for i in range(12):
        candidates.append(
            {
                "id": 200 + i,
                "dias_sem_contato": 120,
                "fat_12m": float(i * 50),
                "fat_total": float(i * 80),
                "n_compras": 2,
                "ultima_compra": "2026-06-30",
            }
        )
    for i in range(8):
        candidates.append(
            {
                "id": 300 + i,
                "dias_sem_contato": 200,
                "fat_12m": 0.0,
                "fat_total": float(5000 + i * 1000),
                "n_compras": 10,
                "ultima_compra": "2026-04-01",
            }
        )
    candidates.append(
        {
            "id": 40,
            "dias_sem_contato": 40,
            "fat_12m": 99999,
            "fat_total": 99999,
            "n_compras": 20,
            "ultima_compra": "2026-09-18",
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
    by_stage: dict[str, list[int]] = {"60_90": [], "90_180": [], "180_mais": []}
    for item in picked:
        by_stage[item["nivel"]].append(item["id"])

    ids = {p["id"] for p in picked}
    assert 999 not in ids
    assert 40 not in ids
    assert by_stage["60_90"] == list(range(114, 104, -1))
    assert by_stage["90_180"] == list(range(211, 201, -1))
    assert by_stage["180_mais"] == list(range(307, 299, -1))
    assert {p["assigned_vendedor_id"] for p in picked} == {1071, 1072, 1073}


def test_recovery_score_prefers_history_when_12m_is_zero():
    cold = {"fat_12m": 0, "fat_total": 80000, "n_compras": 40}
    weak = {"fat_12m": 0, "fat_total": 200, "n_compras": 1}
    assert recovery_score(cold) < recovery_score(weak)
