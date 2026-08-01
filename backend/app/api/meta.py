"""Справочные данные для фронта: стадии, точки, валюты, типы зарядов, клиенты, перевозчики."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.db import get_session
from app.domain.locations import location_list
from app.domain.money import charge_type_list, currency_list
from app.domain.stages import stage_list
from app.models.models import Carrier, Client, User
from app.schemas.schemas import CarrierOut, ClientOut

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/reference")
async def reference(user: User = Depends(current_user)):
    """Всё для дропдаунов одним запросом."""
    return {
        "stages": stage_list(),
        "locations": location_list(),
        "currencies": currency_list(),
        "charge_types": charge_type_list(),
        "transport_types": [
            {"code": "rail", "title_ru": "Ж/д", "title_en": "Rail"},
            {"code": "sea_ferry", "title_ru": "Паром", "title_en": "Ferry"},
            {"code": "truck", "title_ru": "Авто", "title_en": "Truck"},
            {"code": "other", "title_ru": "Другое", "title_en": "Other"},
        ],
    }


@router.get("/clients", response_model=list[ClientOut])
async def clients(session: AsyncSession = Depends(get_session), user: User = Depends(current_user)):
    rows = await session.execute(select(Client).order_by(Client.name))
    return list(rows.scalars().all())


@router.get("/carriers", response_model=list[CarrierOut])
async def carriers(session: AsyncSession = Depends(get_session), user: User = Depends(current_user)):
    rows = await session.execute(select(Carrier).order_by(Carrier.name))
    return list(rows.scalars().all())
