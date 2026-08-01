"""Мультивалюта и типы зарядов — единый источник правды.

Маржа и все отчёты считаются в USD (через amount_usd = amount * rate_to_usd).
Курс вводится вручную на строке денег (курс сделки) — не тянем из API (простота).
"""

# code, symbol, title_ru, title_en
CURRENCIES = [
    ("USD", "$",  "Доллар США",       "US Dollar"),
    ("EUR", "€",  "Евро",             "Euro"),
    ("GEL", "₾",  "Грузинский лари",  "Georgian Lari"),
    ("AZN", "₼",  "Азерб. манат",     "Azerbaijani Manat"),
    ("TMT", "m",  "Туркм. манат",     "Turkmen Manat"),
    ("UZS", "so'm", "Узб. сум",       "Uzbek Som"),
    ("RUB", "₽",  "Российский рубль", "Russian Ruble"),
]
CURRENCY_CODES = [c[0] for c in CURRENCIES]
CURRENCY_SYMBOL = {c[0]: c[1] for c in CURRENCIES}


def currency_list() -> list[dict]:
    return [
        {"code": c[0], "symbol": c[1], "title_ru": c[2], "title_en": c[3]}
        for c in CURRENCIES
    ]


# Типы зарядов (разрез затрат в дашборде/экспорте).
# code, title_ru, title_en
CHARGE_TYPES = [
    ("freight_rail",      "Ж/д фрахт",            "Rail freight"),
    ("ferry",             "Паром",                "Ferry"),
    ("truck",             "Автоперевозка",        "Trucking"),
    ("customs",           "Таможня",              "Customs"),
    ("demurrage",         "Демередж",             "Demurrage"),
    ("detention",         "Простой (detention)",  "Detention"),
    ("storage",           "Хранение",             "Storage"),
    ("forwarding",        "Экспедирование",       "Forwarding"),
    ("insurance",         "Страхование",          "Insurance"),
    ("terminal_handling", "Терминальная обработка","Terminal handling"),
    ("other",             "Прочее",               "Other"),
]
CHARGE_TYPE_CODES = [c[0] for c in CHARGE_TYPES]


def charge_type_list() -> list[dict]:
    return [{"code": c[0], "title_ru": c[1], "title_en": c[2]} for c in CHARGE_TYPES]
