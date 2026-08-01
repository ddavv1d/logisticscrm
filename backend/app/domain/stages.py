"""Каталог стадий коридора — единый источник правды (D2: Python-константа).

НЕ конечный автомат: менеджер выбирает любую стадию свободно.
Порядок (order) нужен только для отрисовки и вычисления «следующей».
stuck_after_days откалиброваны под P75-P90 реальных таймингов (см. council-review).
"""

# code, title_ru, title_en, order, stuck_after_days, leg_seq
STAGE_CATALOG = [
    ("booking",        "Бронирование",                            "Booking",                       10,  7,   None),
    ("loading",        "Загрузка контейнера",                     "Container loading",             20,  3,   1),
    ("rail_to_baku",   "В пути по ж/д: Грузия → Баку/Алят",        "Rail: Georgia → Baku/Alat",     30,  7,   1),
    ("customs_az",     "Прибыл в Баку/Алят + таможня АЗ",          "Arrived Baku/Alat + AZ customs",40,  4,   1),
    ("ferry_wait",     "Ожидание парома в Аляте",                  "Ferry wait at Alat",            50, 12,   2),
    ("ferry",          "На пароме через Каспий",                   "On ferry across Caspian",       60,  4,   2),
    ("turkmenbashi",   "Прибыл в Туркменбаши / выгрузка",          "Arrived Turkmenbashi",          70,  3,   2),
    ("rail_to_uz",     "В пути по ж/д: Туркменбаши → Узбекистан",  "Rail: Turkmenbashi → Uzbekistan",80, 12,   3),
    ("customs_uz",     "Таможенное оформление в Узбекистане",      "Uzbekistan customs",            90,  7,   3),
    ("delivered",      "Выдан / доставлен клиенту",                "Delivered to client",          100, None, 4),
    ("empty_returned", "Порожний возвращён",                       "Empty returned",               110, None, None),
]

STAGE_CODES = [s[0] for s in STAGE_CATALOG]

_BY_CODE = {s[0]: s for s in STAGE_CATALOG}
_ORDERED = sorted(STAGE_CATALOG, key=lambda s: s[3])


def stage_meta(code: str) -> dict | None:
    s = _BY_CODE.get(code)
    if not s:
        return None
    return {
        "code": s[0], "title_ru": s[1], "title_en": s[2],
        "order": s[3], "stuck_after_days": s[4], "leg_seq": s[5],
    }


def stage_list() -> list[dict]:
    return [stage_meta(s[0]) for s in _ORDERED]


def next_stage_code(code: str) -> str | None:
    """Следующая стадия по order (для кнопки «→ Следующая»)."""
    cur = _BY_CODE.get(code)
    if not cur:
        return None
    cur_order = cur[3]
    later = [s for s in _ORDERED if s[3] > cur_order]
    return later[0][0] if later else None


def stuck_after_days(code: str) -> int | None:
    s = _BY_CODE.get(code)
    return s[4] if s else None
