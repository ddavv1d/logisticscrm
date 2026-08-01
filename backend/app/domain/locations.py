"""Точки коридора — единый источник правды (D1: Python-константа).

VARCHAR-поле + предзаполненный dropdown. Защита от опечаток без таблицы.
"""

# code, title_ru, title_en, country
CORRIDOR_LOCATIONS = [
    ("poti",         "Поти",          "Poti",          "GE"),
    ("batumi",       "Батуми",        "Batumi",        "GE"),
    ("tbilisi",      "Тбилиси",       "Tbilisi",       "GE"),
    ("alat",         "Баку / Алят",   "Baku / Alat",   "AZ"),
    ("turkmenbashi", "Туркменбаши",   "Turkmenbashi",  "TM"),
    ("tashkent",     "Ташкент",       "Tashkent",      "UZ"),
    ("navoi",        "Навои",         "Navoi",         "UZ"),
]
LOCATION_CODES = [loc[0] for loc in CORRIDOR_LOCATIONS]
LOCATION_TITLE_RU = {loc[0]: loc[1] for loc in CORRIDOR_LOCATIONS}


def location_list() -> list[dict]:
    return [
        {"code": loc[0], "title_ru": loc[1], "title_en": loc[2], "country": loc[3]}
        for loc in CORRIDOR_LOCATIONS
    ]


# Пресет «Средний коридор» GE→UZ: 4 плеча.
# (transport_type, from_location, to_location)
CORRIDOR_PRESET_GE_UZ = [
    ("rail",      "poti",         "alat"),
    ("sea_ferry", "alat",         "turkmenbashi"),
    ("rail",      "turkmenbashi", "tashkent"),
    ("truck",     "tashkent",     "tashkent"),  # последняя миля до склада клиента
]

# Зеркальный обратный пресет UZ→GE (под Q1).
CORRIDOR_PRESET_UZ_GE = [
    ("truck",     "tashkent",     "tashkent"),
    ("rail",      "tashkent",     "turkmenbashi"),
    ("sea_ferry", "turkmenbashi", "alat"),
    ("rail",      "alat",         "poti"),
]


def corridor_preset(direction: str) -> list[tuple]:
    return CORRIDOR_PRESET_UZ_GE if direction == "uz_ge" else CORRIDOR_PRESET_GE_UZ
