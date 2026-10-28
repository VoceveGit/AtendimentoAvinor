from app.services.televendas import authenticate, issue_token, read_token, scoped_seller_ids


def test_login_colaboradoras():
    poliana = authenticate("Poliana", "1071")
    assert poliana is not None
    assert poliana["role"] == "colaborador"
    assert poliana["vendedor_id"] == 1071
    assert authenticate("carol", "1073")["nome"] == "Karolline"
    assert authenticate("Fernanda Abade", "1072")["vendedor_id"] == 1072
    assert authenticate("poliana", "0000") is None


def test_login_adm():
    adm = authenticate("adm", "adm")
    assert adm["role"] == "adm"
    assert adm["vendedor_id"] is None
    token = issue_token(adm)
    back = read_token(token)
    assert back["login"] == "adm"


def test_scope():
    user = {"role": "colaborador", "vendedor_id": 1071}
    assert scoped_seller_ids(user) == frozenset({1071})
    assert scoped_seller_ids({"role": "adm"}, 1072) == frozenset({1072})
    assert 1073 in scoped_seller_ids({"role": "adm"})
