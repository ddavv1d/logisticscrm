"""Дашборд владельца: где деньги / где застряло / сколько в пути / лента изменений."""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_roles
from app.core.db import get_session
from app.domain.stages import stage_meta
from app.models.models import ChargeLine, Container, StageEvent, User
from app.services.container_service import build_container_query, is_stuck
from app.services.money_service import container_money

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
async def dashboard(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_roles("owner", "accountant")),
):
    rows = await session.execute(build_container_query(status="active"))
    containers = list(rows.scalars().unique().all())

    receivable = margin = overdue = 0.0
    today = date.today()
    for c in containers:
        m = container_money(c)
        receivable += m["receivable_usd"]
        margin += m["margin_usd"]
    # просроченные платежи (income с остатком и due_date < today), USD
    ch_rows = await session.execute(
        select(ChargeLine).where(ChargeLine.kind == "income", ChargeLine.due_date.is_not(None))
    )
    for ch in ch_rows.scalars().all():
        outstanding = float(ch.amount) - float(ch.paid_amount)
        if outstanding > 0 and ch.due_date and ch.due_date < today:
            overdue += outstanding * float(ch.rate_to_usd)

    stuck = [c for c in containers if is_stuck(c)]

    # разбивка «в пути» по текущему плечу коридора
    by_stage: dict[str, int] = {}
    for c in containers:
        if c.current_stage_code not in ("delivered", "empty_returned"):
            by_stage[c.current_stage_code] = by_stage.get(c.current_stage_code, 0) + 1
    in_transit = [
        {"stage": code, "title": (stage_meta(code) or {}).get("title_ru", code), "count": n}
        for code, n in sorted(by_stage.items(), key=lambda kv: (stage_meta(kv[0]) or {}).get("order", 0))
    ]

    return {
        "money": {
            "receivable_usd": round(receivable, 2),
            "margin_usd": round(margin, 2),
            "overdue_usd": round(overdue, 2),
        },
        "counts": {
            "total": len(containers),
            "stuck": len(stuck),
            "in_transit": sum(v["count"] for v in in_transit),
            "delivered": sum(
                1 for c in containers if c.current_stage_code in ("delivered", "empty_returned")
            ),
        },
        "stuck": [
            {
                "id": c.id, "ref_no": c.ref_no,
                "stage": c.current_stage_code,
                "stage_title": (stage_meta(c.current_stage_code) or {}).get("title_ru"),
            }
            for c in stuck
        ],
        "in_transit": in_transit,
    }


@router.get("/activity")
async def activity(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_roles("owner", "accountant")),
    limit: int = 15,
):
    rows = await session.execute(
        select(StageEvent)
        .options(selectinload(StageEvent.changed_by_user))
        .order_by(StageEvent.changed_at.desc())
        .limit(limit)
    )
    events = list(rows.scalars().all())
    # подтянуть ref_no
    ids = {e.container_id for e in events}
    cmap = {}
    if ids:
        crows = await session.execute(select(Container).where(Container.id.in_(ids)))
        cmap = {c.id: c.ref_no for c in crows.scalars().all()}
    return [
        {
            "container_id": e.container_id,
            "ref_no": cmap.get(e.container_id, ""),
            "stage": e.stage_code,
            "stage_title": (stage_meta(e.stage_code) or {}).get("title_ru"),
            "by": e.changed_by_user.full_name if e.changed_by_user else "",
            "at": e.changed_at.isoformat(),
            "comment": e.comment,
        }
        for e in events
    ]


@router.get("/receivables")
async def receivables(
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_roles("owner", "accountant")),
):
    """«Кто должен» — income с остатком, по клиентам (в USD)."""
    rows = await session.execute(
        build_container_query(status="active")
    )
    containers = list(rows.scalars().unique().all())
    by_client: dict[str, float] = {}
    for c in containers:
        cname = c.client.name if c.client else "—"
        for ch in c.charges:
            if ch.kind == "income":
                out = float(ch.amount) - float(ch.paid_amount)
                if out > 0:
                    by_client[cname] = by_client.get(cname, 0) + out * float(ch.rate_to_usd)
    return [
        {"client": k, "outstanding_usd": round(v, 2)}
        for k, v in sorted(by_client.items(), key=lambda kv: -kv[1])
    ]
