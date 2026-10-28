from app.services.recovery import stage_of


def test_recent_buyers_are_not_recovery():
    assert stage_of(None) is None
    assert stage_of(0) is None
    assert stage_of(15) is None
    assert stage_of(30) is None
    assert stage_of(31) == "31_60"
    assert stage_of(61) == "61_90"
    assert stage_of(91) == "90_mais"
