"""Контейнеры: список, создание (пресет+стартовая стадия), карточка, смена стадии, плечи, деньги.

RBAC: маржа отдаётся только owner/accountant (can_see_money) — вырезаем в роутере ДО сериализации.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import csrf_protect, current_user
from app.core.db import get_session
from app.domain.locations import corridor_preset
from app.models.models import ChargeLine, Container, Leg, User
from app.schemas.schemas import (
    ChargeIn,
    ChargeOut,
    ContainerCreate,
    ContainerDetail,
    ContainerListItem,
    LegIn,
    LegOut,
    StageChangeIn,
    StageEventOut,
)
from app.services.container_service import build_container_query, days_on_stage, is_stuck
from app.services.money_service import container_money
from app.services.stage_service import change_stage, history

router = APIRouter(prefix="/api/containers", tags=["containers"])


async def _load(session: AsyncSession, container_id: int) -> Container:
    c = await session.get(Container, container_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Контейнер не найден")
    return c


def _list_item(c: Container) -> ContainerListItem:
    item = ContainerListItem.model_validate(c)
    item.days_on_stage = days_on_stage(c)
    item.is_stuck = is_stuck(c)
    item.leg_count = len(c.legs)
    return item


@router.get("", response_model=list[ContainerListItem])
async def list_containers(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(current_user),
    search: str | None = None,
    stage: str | None = None,
    client_id: int | None = None,
    chip: str | None = None,
    status_: str = Query("active", alias="status"),
):
    q = build_container_query(
        search=search, stage=stage, client_id=client_id, chip=chip, status=status_
    )
    rows = await session.execute(q)
    containers = list(rows.scalars().unique().all())
    items = [_list_item(c) for c in containers]
    if chip == "stuck":
        items = [i for i in items if i.is_stuck]
    return items


@router.get("/counts")
async def chip_counts(
    session: AsyncSession = Depends(get_session), user: User = Depends(current_user)
):
    """Счётчики для чипов над списком."""
    rows = await session.execute(build_container_query(status="active"))
    containers = list(rows.scalars().unique().all())
    return {
        "all": len(containers),
        "in_transit": sum(
            1 for c in containers
            if c.current_stage_code not in ("delivered", "empty_returned", "booking")
        ),
        "ferry_wait": sum(1 for c in containers if c.current_stage_code == "ferry_wait"),
        "stuck": sum(1 for c in containers if is_stuck(c)),
        "delivered": sum(
            1 for c in containers if c.current_stage_code in ("delivered", "empty_returned")
        ),
        "flagged": sum(1 for c in containers if c.is_flagged),
    }


async def _next_ref_no(session: AsyncSession) -> str:
    year = datetime.now().year
    row = await session.execute(select(func.count()).select_from(Container))
    n = (row.scalar() or 0) + 1
    return f"LC-{year}-{n:05d}"


@router.post("", response_model=ContainerDetail, dependencies=[Depends(csrf_protect)])
async def create_container(
    body: ContainerCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(current_user),
):
    ref_no = body.ref_no or await _next_ref_no(session)
    container = Container(
        ref_no=ref_no,
        container_no=body.container_no,
        container_type=body.container_type,
        direction=body.direction,
        client_id=body.client_id,
        is_consolidated=body.is_consolidated,
        origin_location=body.origin_location,
        dest_location=body.dest_location,
        current_stage_code="booking",
        created_by=user.id,
        updated_by=user.id,
    )
    session.add(container)
    await session.flush()

    # стартовая стадия 'booking' через ту же сервисную функцию (council)
    await change_stage(session, container, "booking", user.id, comment="Заказ создан")

    # пресет коридора: 4 плеча
    if body.apply_corridor_preset:
        for i, (ttype, frm, to) in enumerate(corridor_preset(body.direction), start=1):
            session.add(
                Leg(
                    container_id=container.id, seq=i, transport_type=ttype,
                    from_location=frm, to_location=to,
                )
            )
    await session.flush()
    await session.refresh(container)
    return await _detail(session, container, user)


async def _detail(session: AsyncSession, c: Container, user: User) -> ContainerDetail:
    # полный refresh: после change_stage current_stage_since = func.now() (отложенное
    # SQL-выражение) — refresh подтягивает вычисленное БД значение (иначе MissingGreenlet).
    await session.refresh(c)
    await session.refresh(c, attribute_names=["legs", "charges"])
    d = ContainerDetail.model_validate(c)
    d.days_on_stage = days_on_stage(c)
    d.is_stuck = is_stuck(c)
    d.leg_count = len(c.legs)
    d.legs = [LegOut.model_validate(leg) for leg in sorted(c.legs, key=lambda x: x.seq)]
    # деньги только для тех, кто может видеть маржу (RBAC: вырезаем ДО сериализации)
    if user.can_see_money:
        d.charges = [ChargeOut.model_validate(ch) for ch in c.charges]
        d.money = container_money(c)
    else:
        d.charges = []
        d.money = None
    return d


@router.get("/{container_id}", response_model=ContainerDetail)
async def get_container(
    container_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(current_user),
):
    c = await _load(session, container_id)
    return await _detail(session, c, user)


@router.get("/{container_id}/history", response_model=list[StageEventOut])
async def get_history(
    container_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(current_user),
):
    await _load(session, container_id)
    return await history(session, container_id)


@router.post(
    "/{container_id}/stage",
    response_model=ContainerDetail,
    dependencies=[Depends(csrf_protect)],
)
async def post_stage(
    container_id: int,
    body: StageChangeIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(current_user),
):
    c = await _load(session, container_id)
    await change_stage(session, c, body.stage_code, user.id, body.comment, body.actual_date)
    c.updated_by = user.id
    await session.flush()
    return await _detail(session, c, user)


@router.patch("/{container_id}/flag", response_model=ContainerListItem, dependencies=[Depends(csrf_protect)])
async def toggle_flag(
    container_id: int,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(current_user),
):
    c = await _load(session, container_id)
    c.is_flagged = not c.is_flagged
    await session.flush()
    return _list_item(c)


# ---- legs ----
@router.post("/{container_id}/legs", response_model=LegOut, dependencies=[Depends(csrf_protect)])
async def add_leg(
    container_id: int,
    body: LegIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(current_user),
):
    await _load(session, container_id)
    leg = Leg(container_id=container_id, **body.model_dump())
    session.add(leg)
    await session.flush()
    await session.refresh(leg)
    return LegOut.model_validate(leg)


# ---- charges (money) — только owner/accountant ----
def _money_gate(user: User) -> None:
    if not user.can_see_money:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет доступа к финансам")


@router.post("/{container_id}/charges", response_model=ChargeOut, dependencies=[Depends(csrf_protect)])
async def add_charge(
    container_id: int,
    body: ChargeIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(current_user),
):
    _money_gate(user)
    await _load(session, container_id)
    charge = ChargeLine(container_id=container_id, **body.model_dump())
    session.add(charge)
    await session.flush()
    await session.refresh(charge)
    return ChargeOut.model_validate(charge)
