"""Pydantic v2 схемы. Разная сериализация маржи по роли — в роутерах (не тут)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- auth ----
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    email: str
    full_name: str
    role: str
    can_see_money: bool


# ---- refs ----
class ClientOut(ORM):
    id: int
    name: str
    contact_person: str | None = None
    phone: str | None = None


class CarrierOut(ORM):
    id: int
    name: str


# ---- legs ----
class LegIn(BaseModel):
    seq: int
    transport_type: str
    from_location: str
    to_location: str
    carrier_id: int | None = None
    planned_departure: datetime | None = None
    planned_arrival: datetime | None = None
    comment: str | None = None


class LegOut(ORM):
    id: int
    seq: int
    transport_type: str
    from_location: str
    to_location: str
    carrier_id: int | None = None
    carrier: CarrierOut | None = None
    planned_departure: datetime | None = None
    planned_arrival: datetime | None = None
    actual_departure: datetime | None = None
    actual_arrival: datetime | None = None
    comment: str | None = None


# ---- charges ----
class ChargeIn(BaseModel):
    leg_id: int | None = None
    kind: str
    charge_type: str
    amount: float = Field(gt=0)
    paid_amount: float = 0
    currency: str = "USD"
    rate_to_usd: float = Field(default=1, gt=0)
    is_estimated: bool = False
    payment_status: str = "unpaid"
    due_date: date | None = None


class ChargeOut(ORM):
    id: int
    leg_id: int | None = None
    kind: str
    charge_type: str
    amount: float
    paid_amount: float
    currency: str
    rate_to_usd: float
    amount_usd: float
    is_estimated: bool
    payment_status: str
    due_date: date | None = None


class ChargeUpdate(BaseModel):
    """Частичная правка строки денег (замыкает финцикл: оплата/правка)."""
    amount: float | None = Field(default=None, gt=0)
    paid_amount: float | None = Field(default=None, ge=0)
    payment_status: str | None = None
    due_date: date | None = None
    charge_type: str | None = None
    currency: str | None = None
    rate_to_usd: float | None = Field(default=None, gt=0)


# ---- containers ----
class ContainerCreate(BaseModel):
    ref_no: str | None = None  # генерируем если пусто
    container_no: str | None = None
    container_type: str | None = None
    direction: str = "ge_uz"
    client_id: int | None = None
    is_consolidated: bool = False
    origin_location: str = "poti"
    dest_location: str = "tashkent"
    apply_corridor_preset: bool = True


class StageChangeIn(BaseModel):
    stage_code: str
    comment: str | None = None
    actual_date: date | None = None


class StageEventOut(ORM):
    id: int
    stage_code: str
    changed_at: datetime
    changed_by: int
    comment: str | None = None
    actual_date: date | None = None


class ContainerListItem(ORM):
    id: int
    ref_no: str
    container_no: str | None = None
    container_type: str | None = None
    direction: str
    client: ClientOut | None = None
    origin_location: str
    dest_location: str
    current_stage_code: str
    current_stage_since: datetime
    is_flagged: bool
    status: str
    # вычисляемые (заполняются в роутере)
    days_on_stage: int = 0
    is_stuck: bool = False
    leg_count: int = 0


class ContainerDetail(ContainerListItem):
    legs: list[LegOut] = []
    charges: list[ChargeOut] = []
    # деньги — только для owner/accountant
    money: dict | None = None
