"""Переиспользуемая сборка запроса списка контейнеров + is_stuck (council: build_container_query).

Используется списком (срез 1), дашбордом (срез 5) и экспортом (срез 6) — единый источник.
"""

from datetime import datetime, timezone

from sqlalchemy import String, or_, select
from sqlalchemy.orm import selectinload

from app.domain.stages import stuck_after_days
from app.models.models import Client, Container


def is_stuck(container: Container) -> bool:
    """Застрял = на текущей стадии дольше её порога stuck_after_days.

    None (delivered/empty_returned/неизвестная стадия) → никогда не застревает.
    """
    threshold = stuck_after_days(container.current_stage_code)
    if threshold is None or container.current_stage_since is None:
        return False
    since = container.current_stage_since
    now = datetime.now(timezone.utc)
    days = (now - since).total_seconds() / 86400
    return days > threshold


def days_on_stage(container: Container) -> int:
    if container.current_stage_since is None:
        return 0
    now = datetime.now(timezone.utc)
    return int((now - container.current_stage_since).total_seconds() // 86400)


def build_container_query(
    *,
    search: str | None = None,
    stage: str | None = None,
    client_id: int | None = None,
    status: str | None = "active",
    chip: str | None = None,
):
    """Единая сборка фильтра. chip ∈ {in_transit, ferry_wait, stuck, delivered, flagged}.

    stuck фильтруется в Python (зависит от времени) — здесь только БД-предикаты.
    """
    q = (
        select(Container)
        .options(selectinload(Container.legs), selectinload(Container.charges))
        .outerjoin(Client, Container.client_id == Client.id)
    )
    if status:
        q = q.where(Container.status == status)
    if search:
        s = f"%{search.strip().upper()}%"
        q = q.where(
            or_(
                Container.ref_no.cast(String).ilike(s),
                Container.container_no.cast(String).ilike(s),
                Client.name.cast(String).ilike(s),
            )
        )
    if stage:
        q = q.where(Container.current_stage_code == stage)
    if client_id:
        q = q.where(Container.client_id == client_id)
    if chip == "ferry_wait":
        q = q.where(Container.current_stage_code == "ferry_wait")
    elif chip == "delivered":
        q = q.where(Container.current_stage_code.in_(("delivered", "empty_returned")))
    elif chip == "flagged":
        q = q.where(Container.is_flagged.is_(True))
    elif chip == "in_transit":
        q = q.where(
            Container.current_stage_code.notin_(("delivered", "empty_returned", "booking"))
        )
    q = q.order_by(Container.is_flagged.desc(), Container.current_stage_since.asc())
    return q
