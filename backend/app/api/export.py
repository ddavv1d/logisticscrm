"""Экспорт списка контейнеров в Excel (openpyxl) — выгружает текущий фильтр."""

import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.db import get_session
from app.domain.locations import LOCATION_TITLE_RU
from app.domain.stages import stage_meta
from app.models.models import User
from app.services.container_service import build_container_query, days_on_stage, is_stuck

router = APIRouter(prefix="/api/export", tags=["export"])

_HEAD = ["Ref №", "Контейнер №", "Тип", "Клиент", "Откуда", "Куда", "Стадия", "Дней на стадии", "Застрял", "Плеч"]


@router.get("/containers.xlsx")
async def export_containers(
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
    if chip == "stuck":
        containers = [c for c in containers if is_stuck(c)]

    wb = Workbook()
    ws = wb.active
    ws.title = "Контейнеры"
    ws.append(_HEAD)
    head_fill = PatternFill("solid", fgColor="1E2A32")
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = head_fill

    def loc(code: str) -> str:
        return LOCATION_TITLE_RU.get(code, code)

    for c in containers:
        sm = stage_meta(c.current_stage_code) or {}
        ws.append([
            c.ref_no, c.container_no or "", c.container_type or "",
            c.client.name if c.client else "",
            loc(c.origin_location), loc(c.dest_location),
            sm.get("title_ru", c.current_stage_code),
            days_on_stage(c), "Да" if is_stuck(c) else "", len(c.legs),
        ])
    for col in ws.columns:
        width = max((len(str(cell.value or "")) for cell in col), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(width + 3, 40)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=containers.xlsx"},
    )
