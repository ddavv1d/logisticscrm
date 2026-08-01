"""Смена стадии — ЕДИНСТВЕННАЯ точка входа (council: риск рассинхрона current_stage↔журнал).

Атомарно: INSERT stage_event + UPDATE container.current_stage_code/since.
Журнал append-only. current_stage_code обновляется ТОЛЬКО здесь.
"""

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.stages import STAGE_CODES
from app.models.models import Container, StageEvent


async def change_stage(
    session: AsyncSession,
    container: Container,
    stage_code: str,
    user_id: int,
    comment: str | None = None,
    actual_date: date | None = None,
) -> StageEvent:
    if stage_code not in STAGE_CODES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Неизвестная стадия: {stage_code}")

    event = StageEvent(
        container_id=container.id,
        stage_code=stage_code,
        changed_by=user_id,
        comment=comment,
        actual_date=actual_date,
    )
    session.add(event)
    # денормализация — только здесь. Python-datetime (не func.now()), иначе
    # отложенное SQL-выражение ломает синхронное чтение атрибута (MissingGreenlet).
    container.current_stage_code = stage_code
    container.current_stage_since = datetime.now(timezone.utc)
    await session.flush()
    return event


async def history(session: AsyncSession, container_id: int) -> list[StageEvent]:
    rows = await session.execute(
        select(StageEvent)
        .where(StageEvent.container_id == container_id)
        .order_by(StageEvent.changed_at.desc(), StageEvent.id.desc())
    )
    return list(rows.scalars().all())
