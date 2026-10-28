from datetime import date

from app.services.days import parse_day_spec


def test_segunda_e_quinta():
    spec = parse_day_spec("Segunda e Quinta")
    assert spec.weekdays == [0, 3]
    assert spec.matches(date(2026, 10, 26))  # segunda
    assert spec.matches(date(2026, 10, 29))  # quinta
    assert not spec.matches(date(2026, 10, 27))  # terça


def test_terca_a_sexta():
    spec = parse_day_spec("Terça a Sexta")
    assert spec.weekdays == [1, 2, 3, 4]


def test_quinzenal():
    spec = parse_day_spec("Terça (quinzenal)")
    assert spec.weekdays == [1]
    assert spec.biweekly is True
    odd = date(2026, 10, 27)  # terça, semana 44 (par) ou ímpar
    # regra: semana ISO ímpar entra
    if odd.isocalendar().week % 2 == 1:
        assert spec.matches(odd)
    else:
        assert not spec.matches(odd)
