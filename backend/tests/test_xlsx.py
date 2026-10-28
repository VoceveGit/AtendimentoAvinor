from io import BytesIO

from openpyxl import Workbook

from app.services.xlsx_parser import detect_header_row, parse_workbook


def test_detect_header_skips_title_block():
    rows = [
        ("PLANILHA AVINOR", None, None),
        (None, None, None),
        ("RAZÃO SOCIAL", "ENDEREÇO", "CONTATO", "ZONA/ROTA"),
        ("Padaria", "Rua A", "77 9999", "Centro"),
    ]
    assert detect_header_row(rows) == 3


def test_parse_suggests_mapping():
    wb = Workbook()
    ws = wb.active
    ws.append(["Relatório de rotas"])
    ws.append([])
    ws.append(["RAZÃO SOCIAL", "ENDEREÇO", "CONTATO", "ZONA/ROTA", "DIA DA SEMANA", "ULT. VISITA"])
    ws.append(["Padaria São José", "Rua A, 10", "(77)99911", "Centro", "Segunda", "10/02/2026"])
    buf = BytesIO()
    wb.save(buf)
    parsed = parse_workbook(buf.getvalue())
    assert parsed["header_row"] == 3
    assert parsed["suggested_mapping"]["RAZÃO SOCIAL"] == "nome"
    assert parsed["suggested_mapping"]["CONTATO"] == "telefone"
    assert parsed["total_rows"] == 1
