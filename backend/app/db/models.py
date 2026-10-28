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
    ("visita_marcada", "Visita Marcada", "purple", 3, False, False),
    ("remarcado", "Remarcado", "orange", 4, False, False),
    ("nao_venda", "Não venda", "slate", 5, False, True),
    ("nao_recuperado", "Não recuperado", "rose", 6, False, True),
    ("finalizado", "Finalizado", "emerald", 7, True, False),
    ("atendido", "Atendido / Concluído", "emerald", 8, False, False),
    ("em_recuperacao", "Em Recuperação (90+ dias)", "rose", 9, True, False),
]

DROPDOWN_HIDDEN = {"em_recuperacao", "finalizado"}
CLOSE_KINDS = {"nao_venda", "nao_recuperado", "nao_atendido"}
