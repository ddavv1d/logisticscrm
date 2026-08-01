"""Богатый демо-сид для показа инвестору.

Создаёт согласованные данные: контейнеры в разных стадиях с пройденными плечами,
мультивалютными деньгами и РЕАЛЬНО застрявшими (бэкдейт current_stage_since).

Запуск:  python -m app.seed         (idempotent: чистит и пересоздаёт демо-данные)
"""

import asyncio
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.domain.locations import corridor_preset
from app.domain.stages import stage_meta
from app.models.models import (
    Carrier,
    ChargeLine,
    Client,
    Container,
    Leg,
    StageEvent,
    User,
)

NOW = datetime.now(timezone.utc)


def ago(days: float) -> datetime:
    return NOW - timedelta(days=days)


USERS = [
    ("owner@demo.lc",      "Давид Ц. (владелец)",   "owner",      True),
    ("manager@demo.lc",    "Ирина М. (менеджер)",   "manager",    False),
    ("buh@demo.lc",        "Ольга Б. (бухгалтер)",  "accountant", True),
]
PASSWORD = "demo1234"

CLIENTS = [
    "ООО «Каспий Трейд»", "TashkentTextile LLC", "Batumi Agro Export",
    "SilkRoad Logistics", "Uzbek Steel Import", "Georgian Wine Co.",
]
CARRIERS = [
    "Azerbaijan Railways (ADY)", "ADY Container", "Uzbek Railways (UTY)",
    "Caspian Shipping (ASCO)", "TransCaucasus Terminals", "Silk Road Trucking",
]

# ref, type, client_idx, stage_code, days_on_stage, flagged, money_plan
# money_plan: list of (kind, charge_type, amount, currency, rate_to_usd, leg_seq, paid_ratio, due_offset_days)
CONTAINERS = [
    ("40HC", 0, "booking",       2,  False),
    ("20DC", 1, "loading",       1,  False),
    ("40HC", 2, "rail_to_baku",  4,  False),
    ("40DC", 3, "customs_az",    3,  False),
    ("40HC", 4, "ferry_wait",   14,  True),   # ЗАСТРЯЛ (порог 12)
    ("REEFER", 5, "ferry_wait",  6,  False),
    ("20DC", 0, "ferry",         2,  False),
    ("40HC", 1, "turkmenbashi",  2,  False),
    ("40DC", 2, "rail_to_uz",   15,  True),   # ЗАСТРЯЛ (порог 12)
    ("40HC", 3, "rail_to_uz",    5,  False),
    ("20DC", 4, "customs_uz",    9,  True),    # ЗАСТРЯЛ (порог 7)
    ("40HC", 5, "customs_uz",    3,  False),
    ("40DC", 0, "delivered",     1,  False),
    ("40HC", 1, "delivered",    10,  False),
    ("REEFER", 2, "delivered",  20,  False),
    ("40HC", 3, "empty_returned", 25, False),
]


async def run():
    async with SessionLocal() as s:
        # чистим демо-данные (idempotent) — порядок из-за FK RESTRICT
        await s.execute(delete(ChargeLine))
        await s.execute(delete(StageEvent))
        await s.execute(delete(Leg))
        await s.execute(delete(Container))
        await s.execute(delete(Client))
        await s.execute(delete(Carrier))
        await s.execute(delete(User))
        await s.commit()

        users = {}
        for email, name, role, money in USERS:
            u = User(
                email=email, password_hash=hash_password(PASSWORD),
                full_name=name, role=role, can_see_money=money, is_active=True,
            )
            s.add(u)
            users[role] = u
        clients = [Client(name=n) for n in CLIENTS]
        carriers = [Carrier(name=n) for n in CARRIERS]
        for c in clients + carriers:
            s.add(c)
        await s.flush()

        mgr = users["manager"]
        year = NOW.year

        for i, (ctype, cidx, stage, dos, flagged) in enumerate(CONTAINERS, start=1):
            sm = stage_meta(stage)
            cont = Container(
                ref_no=f"LC-{year}-{i:05d}",
                container_no=f"{'MSKU TCLU HLXU CAIU'.split()[i % 4]}{1000000 + i * 137}",
                container_type=ctype,
                direction="ge_uz",
                client_id=clients[cidx].id,
                origin_location="poti",
                dest_location="tashkent",
                current_stage_code=stage,
                current_stage_since=ago(dos),
                is_flagged=flagged,
                status="active" if stage not in ("empty_returned",) else "delivered",
                created_by=mgr.id, updated_by=mgr.id,
            )
            s.add(cont)
            await s.flush()

            # плечи по пресету
            legs = {}
            for seq, (ttype, frm, to) in enumerate(corridor_preset("ge_uz"), start=1):
                leg = Leg(
                    container_id=cont.id, seq=seq, transport_type=ttype,
                    from_location=frm, to_location=to,
                    carrier_id=carriers[(i + seq) % len(carriers)].id,
                )
                s.add(leg)
                legs[seq] = leg
            await s.flush()

            # история стадий: все стадии до текущей включительно, с бэкдейтом
            cur_order = sm["order"]
            passed = [
                st for st in
                [stage_meta(c) for c in
                 ["booking","loading","rail_to_baku","customs_az","ferry_wait","ferry",
                  "turkmenbashi","rail_to_uz","customs_uz","delivered","empty_returned"]]
                if st["order"] <= cur_order
            ]
            n = len(passed)
            for j, st in enumerate(passed):
                # равномерно распределяем во времени: последняя = current_stage_since
                offset = dos + (n - 1 - j) * 2.5
                ev = StageEvent(
                    container_id=cont.id, stage_code=st["code"],
                    changed_by=mgr.id, changed_at=ago(offset),
                    comment="Заказ создан" if st["code"] == "booking" else None,
                )
                s.add(ev)

            # деньги: sell (клиенту, USD) + buy по плечам (в валютах коридора)
            _add_money(s, cont, legs, i, stage_order=cur_order)

        await s.commit()
    print("Демо-сид готов: 3 пользователя, 16 контейнеров, плечи, история, мультивалютные деньги.")
    print(f"Логины (пароль у всех '{PASSWORD}'):")
    for email, name, role, _ in USERS:
        print(f"  {role:11s} {email}")


def _add_money(s, cont, legs, i, stage_order):
    """Реалистичные деньги: доход клиенту в USD, расходы по плечам в местных валютах."""
    # income — клиенту, USD, часть оплачена
    sell = 4200 + (i % 5) * 350
    paid = sell if stage_order >= 100 else (sell * 0.5 if i % 2 == 0 else 0)
    due = date.today() + timedelta(days=(-5 if i % 3 == 0 else 20))
    s.add(ChargeLine(
        container_id=cont.id, leg_id=None, kind="income", charge_type="freight_rail",
        amount=sell, paid_amount=paid, currency="USD", rate_to_usd=1,
        payment_status=("paid" if paid >= sell else "partial" if paid > 0 else "unpaid"),
        due_date=due,
    ))
    # expenses по плечам в валютах: ж/д Грузия (GEL), паром (USD), ж/д UZ (UZS), авто (UZS)
    plan = [
        (1, "freight_rail", 900,  "GEL", 0.37),
        (2, "ferry",        1150, "USD", 1.0),
        (3, "freight_rail", 14_000_000, "UZS", 0.000079),
        (4, "truck",        3_500_000,  "UZS", 0.000079),
    ]
    for seq, ctype, amt, cur, rate in plan:
        leg = legs.get(seq)
        if not leg:
            continue
        s.add(ChargeLine(
            container_id=cont.id, leg_id=leg.id, kind="expense", charge_type=ctype,
            amount=amt, paid_amount=amt if i % 3 else 0, currency=cur, rate_to_usd=rate,
            payment_status="paid" if i % 3 else "unpaid",
        ))
    # у застрявших на пароме — демередж (AZN)
    if cont.current_stage_code == "ferry_wait" and cont.is_flagged:
        s.add(ChargeLine(
            container_id=cont.id, leg_id=legs.get(2).id, kind="expense",
            charge_type="demurrage", amount=680, paid_amount=0, currency="AZN",
            rate_to_usd=0.59, payment_status="unpaid",
        ))


if __name__ == "__main__":
    asyncio.run(run())
