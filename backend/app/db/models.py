from datetime import date, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Status(Base):
    __tablename__ = "avinor_statuses"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    color: Mapped[str] = mapped_column(String(40), nullable=False, default="amber")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_motivo: Mapped[bool] = mapped_column(Boolean, default=False)


class ClientStatus(Base):
    __tablename__ = "avinor_client_status"

    cliente_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    status_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    data_atendimento: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(40), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    recontato: Mapped[bool] = mapped_column(Boolean, default=False)
    agenda_origem: Mapped[str | None] = mapped_column(String(20), nullable=True)
    agenda_vendedor_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class ImportLog(Base):
    __tablename__ = "avinor_import_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str | None] = mapped_column(String(255))
    rows_imported: Mapped[int] = mapped_column(Integer, default=0)
    mapping: Mapped[dict | None] = mapped_column(JSON)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DbConfig(Base):
    __tablename__ = "avinor_db_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(20))
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ExtraAttendance(Base):
    __tablename__ = "avinor_extra_attendances"
    __table_args__ = (UniqueConstraint("cliente_id", "dia", name="uq_extra_cliente_dia"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    dia: Mapped[date] = mapped_column(Date, nullable=False)
    vendedor_id: Mapped[int] = mapped_column(Integer, nullable=False)
    added_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ColumnMapping(Base):
    __tablename__ = "avinor_column_mappings"
    __table_args__ = (UniqueConstraint("signature", name="uq_mapping_signature"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signature: Mapped[str] = mapped_column(String(255), nullable=False)
    headers: Mapped[list] = mapped_column(JSON, default=list)
    mapping: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RecoveryAssignment(Base):
    __tablename__ = "avinor_recovery_assignments"
    __table_args__ = (UniqueConstraint("cliente_id", "dia", name="uq_recovery_cliente_dia"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    dia: Mapped[date] = mapped_column(Date, nullable=False)
    vendedor_id: Mapped[int] = mapped_column(Integer, nullable=False)
    faixa: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Motivo(Base):
    __tablename__ = "avinor_motivos"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Account(Base):
    __tablename__ = "avinor_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="colaborador")
    nome: Mapped[str] = mapped_column(String(80), nullable=False)
    login: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    password_enc: Mapped[str] = mapped_column(Text, nullable=False, default="")
    vendedor_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    aliases: Mapped[list | None] = mapped_column(JSON, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DayClose(Base):
    __tablename__ = "avinor_day_closes"
    __table_args__ = (UniqueConstraint("cliente_id", "dia", "origem", name="uq_close_cliente_dia_origem"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    dia: Mapped[date] = mapped_column(Date, nullable=False)
    vendedor_id: Mapped[int] = mapped_column(Integer, nullable=False)
    origem: Mapped[str] = mapped_column(String(20), nullable=False, default="carteira")
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    motivo: Mapped[str | None] = mapped_column(Text, nullable=True)
    codigo_pedido: Mapped[str | None] = mapped_column(String(40), nullable=True)
    valor_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    itens: Mapped[list | None] = mapped_column(JSON, nullable=True)
    synced: Mapped[bool] = mapped_column(Boolean, default=False)
    data_pedido: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_emissao: Mapped[date | None] = mapped_column(Date, nullable=True)
    cidade: Mapped[str | None] = mapped_column(String(120), nullable=True)
    rota_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    rota_nome: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cliente_nome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vendedor_nome: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


SEED_STATUSES = [
    ("em_atendimento", "Em Atendimento", "amber", 1, False, False),
    ("atendimento_hoje", "Atendimento Hoje", "blue", 2, False, False),
    ("nao_venda", "Não venda", "slate", 3, False, True),
    ("nao_recuperado", "Não recuperado", "rose", 4, False, True),
    ("agendado", "Agendado", "purple", 90, True, False),
    ("finalizado", "Finalizado", "emerald", 91, True, False),
    ("atendido", "Atendido / Concluído", "emerald", 92, True, False),
    ("em_recuperacao", "Em Recuperação", "rose", 93, True, False),
]

AUTO_STATUS_IDS = frozenset({"agendado", "finalizado", "atendido", "em_recuperacao", "visita_marcada", "remarcado"})
DROPDOWN_HIDDEN = AUTO_STATUS_IDS | {"sem_status"}
CLOSE_KINDS = {"nao_venda", "nao_recuperado", "nao_atendido", "recuperado"}

SEED_MOTIVOS = [
    ("preco_alto", "Preço alto", 1),
    ("concorrente", "Comprou com o concorrente", 2),
    ("sem_demanda", "Sem demanda no momento", 3),
    ("credito", "Problema de crédito", 4),
    ("fechou", "Mudou de ramo / fechou", 5),
    ("entrega", "Prazo ou entrega", 6),
    ("viajando", "Cliente viajando", 7),
    ("estoque", "Estoque cheio", 8),
]
