"""SQLAlchemy модели. Паттерны из council-review:
- VARCHAR + CHECK (не нативный enum); nullable-enum как (col IS NULL OR col IN (...))
- Decimal для денег; amount_usd = GENERATED (мультивалюта → USD база)
- ON DELETE RESTRICT на дочерних (политика soft-delete)
- current_stage денормализован; журнал stage_event append-only
"""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.domain.money import CHARGE_TYPE_CODES, CURRENCY_CODES

ROLES = ("manager", "owner", "accountant")
CONTAINER_TYPES = ("20DC", "40DC", "40HC", "REEFER", "OT", "TANK")
CONTAINER_STATUS = ("active", "delivered", "cancelled", "archived")
DIRECTIONS = ("ge_uz", "uz_ge")
TRANSPORT_TYPES = ("rail", "sea_ferry", "truck", "other")
CHARGE_KINDS = ("income", "expense")
PAYMENT_STATUS = ("unpaid", "partial", "paid")


def _in(col: str, vals: tuple[str, ...]) -> str:
    quoted = ",".join(f"'{v}'" for v in vals)
    return f"{col} IN ({quoted})"


def _nullable_in(col: str, vals: tuple[str, ...]) -> str:
    # Паттерн nullable-enum: НЕ ставить NULL в IN (тихо отключает гард).
    return f"{col} IS NULL OR {_in(col, vals)}"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint(_in("role", ROLES), name="ck_users_role"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    email: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    can_see_money: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Client(Base, TimestampMixin):
    __tablename__ = "client"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(120))
    note: Mapped[str | None] = mapped_column(Text)


class Carrier(Base, TimestampMixin):
    __tablename__ = "carrier"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(120))
    note: Mapped[str | None] = mapped_column(Text)


class Container(Base, TimestampMixin):
    __tablename__ = "container"
    __table_args__ = (
        CheckConstraint(_nullable_in("container_type", CONTAINER_TYPES), name="ck_container_type"),
        CheckConstraint(_in("direction", DIRECTIONS), name="ck_container_direction"),
        CheckConstraint(_in("status", CONTAINER_STATUS), name="ck_container_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    ref_no: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    container_no: Mapped[str | None] = mapped_column(String(20))
    container_type: Mapped[str | None] = mapped_column(String(16))
    direction: Mapped[str] = mapped_column(String(8), nullable=False, default="ge_uz")
    client_id: Mapped[int | None] = mapped_column(ForeignKey("client.id", ondelete="RESTRICT"))
    is_consolidated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    origin_location: Mapped[str] = mapped_column(String(80), nullable=False)
    dest_location: Mapped[str] = mapped_column(String(80), nullable=False)
    current_stage_code: Mapped[str] = mapped_column(String(40), nullable=False)
    current_stage_since: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_flagged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))

    client: Mapped["Client | None"] = relationship(lazy="joined")
    legs: Mapped[list["Leg"]] = relationship(
        back_populates="container", cascade="all, delete-orphan", order_by="Leg.seq"
    )
    charges: Mapped[list["ChargeLine"]] = relationship(
        back_populates="container", cascade="all, delete-orphan"
    )


class Leg(Base, TimestampMixin):
    __tablename__ = "leg"
    __table_args__ = (
        UniqueConstraint("container_id", "seq", name="uq_leg_container_seq"),
        CheckConstraint("seq > 0", name="ck_leg_seq_positive"),
        CheckConstraint(_in("transport_type", TRANSPORT_TYPES), name="ck_leg_transport"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    container_id: Mapped[int] = mapped_column(
        ForeignKey("container.id", ondelete="RESTRICT"), nullable=False
    )
    seq: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    transport_type: Mapped[str] = mapped_column(String(16), nullable=False)
    from_location: Mapped[str] = mapped_column(String(80), nullable=False)
    to_location: Mapped[str] = mapped_column(String(80), nullable=False)
    carrier_id: Mapped[int | None] = mapped_column(ForeignKey("carrier.id", ondelete="RESTRICT"))
    planned_departure: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    planned_arrival: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_departure: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_arrival: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    comment: Mapped[str | None] = mapped_column(Text)

    container: Mapped["Container"] = relationship(back_populates="legs")
    carrier: Mapped["Carrier | None"] = relationship(lazy="joined")


class StageEvent(Base):
    """Журнал стадий — append-only. Только INSERT."""

    __tablename__ = "stage_event"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    container_id: Mapped[int] = mapped_column(
        ForeignKey("container.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    stage_code: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    changed_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    comment: Mapped[str | None] = mapped_column(Text)
    actual_date: Mapped[Date | None] = mapped_column(Date)

    changed_by_user: Mapped["User"] = relationship(lazy="joined")


class ChargeLine(Base, TimestampMixin):
    """Деньги по плечу. Мультивалюта: amount в валюте строки, amount_usd = GENERATED."""

    __tablename__ = "charge_line"
    __table_args__ = (
        CheckConstraint(_in("kind", CHARGE_KINDS), name="ck_charge_kind"),
        CheckConstraint(_in("charge_type", tuple(CHARGE_TYPE_CODES)), name="ck_charge_type"),
        CheckConstraint(_in("currency", tuple(CURRENCY_CODES)), name="ck_charge_currency"),
        CheckConstraint(_in("payment_status", PAYMENT_STATUS), name="ck_charge_paystatus"),
        CheckConstraint("amount > 0", name="ck_charge_amount_positive"),
        CheckConstraint("rate_to_usd > 0", name="ck_charge_rate_positive"),
        CheckConstraint(
            "paid_amount >= 0 AND paid_amount <= amount", name="ck_charge_paid_range"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    container_id: Mapped[int] = mapped_column(
        ForeignKey("container.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    leg_id: Mapped[int | None] = mapped_column(ForeignKey("leg.id", ondelete="RESTRICT"))
    kind: Mapped[str] = mapped_column(String(8), nullable=False)
    charge_type: Mapped[str] = mapped_column(String(40), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    paid_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    rate_to_usd: Mapped[float] = mapped_column(Numeric(14, 6), nullable=False, default=1)
    # USD-эквивалент, вычисляется БД. Маржа и отчёты — по нему.
    amount_usd: Mapped[float] = mapped_column(
        Numeric(14, 2), Computed("amount * rate_to_usd", persisted=True)
    )
    is_estimated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    payment_status: Mapped[str] = mapped_column(String(8), nullable=False, default="unpaid")
    due_date: Mapped[Date | None] = mapped_column(Date)

    container: Mapped["Container"] = relationship(back_populates="charges")
