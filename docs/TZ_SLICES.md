# Техническое задание — по вертикальным срезам (0→6)

> Детальное ТЗ, из которого кодят срез за срезом. Источник решений: `research/RESEARCH_SYNTHESIS.md` (совет 10 агентов).
> Паттерны реализации: `docs/STACK_AND_PATTERNS.md`. Порядок работы: `docs/WORKFLOW_AND_SKILLS.md`.
>
> **Принцип:** каждый срез — рабочий, проверяется E2E через фронт. Никаких «сначала вся модель, потом весь фронт». Не переписывать это ТЗ — двигать код.

---

## 0. Модель данных (полная схема)

Источники паттернов: **LoadPartner TMS** (статус = простая строка, carrier nullable, join-таблица клиентов), **project44** (RouteSegment = плечо, типизация точек/мод), **Postgres monetary docs** (NUMERIC не float/money).

### Соглашения
- Все таблицы: `id BIGSERIAL PK`, `created_at`/`updated_at TIMESTAMPTZ DEFAULT now()`.
- Строковые перечисления — `VARCHAR + CHECK`, НЕ нативный enum.
- Деньги — `NUMERIC(14,2)`. Валюта — `CHAR(3)` ISO-4217, default 'USD'.
- Аудит авторства — `created_by`/`updated_by BIGINT FK users`.

### `users` — пользователи и роли
| поле | тип | заметка |
|------|-----|---------|
| email | CITEXT UNIQUE | регистронезависимый (расширение CITEXT) |
| password_hash | TEXT | Argon2id |
| full_name | VARCHAR(120) | автор записи стадии показывается по имени |
| role | VARCHAR(16) CHECK IN ('manager','owner','accountant') | RBAC в сервисе |
| can_see_money | BOOLEAN DEFAULT false | менеджеру не отдаём маржу |
| is_active | BOOLEAN DEFAULT true | |

### `container` — Контейнер / Заказ (центральная сущность)
| поле | тип | заметка |
|------|-----|---------|
| ref_no | VARCHAR(32) UNIQUE NOT NULL | внутренний номер, генерим (напр. LC-2026-00042) |
| container_no | VARCHAR(20) NULL | ISO 6346, напр. MSKU1234565; опц. валидация check-digit при вводе |
| container_type | VARCHAR(16) NULL CHECK IN ('20DC','40DC','40HC','REEFER','OT','TANK', NULL) | dropdown |
| client_id | BIGINT NULL FK client | FCL: заполнен = 1 контейнер = 1 клиент |
| is_consolidated | BOOLEAN NOT NULL DEFAULT false | переключатель FCL/LCL (задел под сборный) |
| origin_location | VARCHAR(80) | точка отправления (см. решение D1 ниже) |
| dest_location | VARCHAR(80) | точка назначения |
| current_stage_code | VARCHAR(40) NULL | ДЕНОРМАЛИЗАЦИЯ, обновляет только сервис смены стадии |
| current_stage_since | TIMESTAMPTZ NULL | когда встал на текущую стадию (для «дней на стадии») |
| is_flagged | BOOLEAN DEFAULT false | «проблема/на контроле» — ОТДЕЛЬНО от стадии |
| status | VARCHAR(16) DEFAULT 'active' CHECK IN ('active','delivered','cancelled','archived') | soft-delete |
| created_by/updated_by | BIGINT FK users | |

### `leg` — Плечо маршрута
| поле | тип | заметка |
|------|-----|---------|
| container_id | BIGINT FK container ON DELETE CASCADE | |
| seq | SMALLINT NOT NULL | порядок плеча; UNIQUE(container_id, seq) — «дыра LoadPartner», не забыть |
| transport_type | VARCHAR(16) CHECK IN ('rail','sea_ferry','truck','other') | |
| from_location / to_location | VARCHAR(80) | точки (решение D1) |
| carrier_id | BIGINT NULL FK carrier | NULLABLE (как LoadPartner) |
| planned_departure/arrival | TIMESTAMPTZ NULL | план |
| actual_departure/arrival | TIMESTAMPTZ NULL | факт |
| comment | TEXT | |

### `stage_event` — Журнал стадий (СЕРДЦЕ, append-only)
| поле | тип | заметка |
|------|-----|---------|
| container_id | BIGINT FK container | |
| stage_code | VARCHAR(40) | из каталога стадий |
| changed_at | TIMESTAMPTZ DEFAULT now() | АВТО |
| changed_by | BIGINT FK users NOT NULL | АВТО, из сессии |
| comment | TEXT NULL | опц. |
| actual_date | DATE NULL | если факт-дата отличается от момента записи |

> **Только INSERT.** Никаких UPDATE/DELETE на этой таблице.

### `charge_line` — Деньги по плечу
| поле | тип | заметка |
|------|-----|---------|
| container_id | BIGINT FK container | маржа считается на контейнер |
| leg_id | BIGINT NULL FK leg | к какому плечу относится (nullable — сквозные затраты) |
| kind | VARCHAR(8) CHECK IN ('income','expense') | клиенту / перевозчику |
| charge_type | VARCHAR(40) | тип заряда (фрахт, паром, таможня, демередж, экспедирование…) |
| amount | NUMERIC(14,2) NOT NULL | Decimal |
| currency | CHAR(3) DEFAULT 'USD' | ISO-4217 |
| is_estimated | BOOLEAN DEFAULT false | estimated/actual — ловит поздний демередж |
| payment_status | VARCHAR(8) DEFAULT 'unpaid' CHECK IN ('unpaid','partial','paid') | |
| due_date | DATE NULL | срок оплаты (краснеет при просрочке) |
| counterparty | VARCHAR(120) NULL | кому/от кого (свободный текст или дублирует carrier/client) |

### `client`, `carrier` — Справочники (минимальные)
`id, name VARCHAR(120), contact_person, phone, email, note`. Клиент = плательщик; carrier = кому платим на плече.

### 🔶 D1 — ОТКРЫТОЕ РЕШЕНИЕ: точки маршрута — строка или справочник?
- **Синтез (chairman):** dropdown предзаданных точек как VARCHAR, НЕ таблица на старте (проще).
- **Data-model исследователь:** таблица `location` с FK (LoadPartner) — защита от опечаток, точки как сущность.
- **Компромисс (рекомендую):** VARCHAR-поле + предзаполненный dropdown из Python-константы `CORRIDOR_LOCATIONS` (Поти, Батуми, Тбилиси, Баку/Алят, Туркменбаши, Ташкент, Навои…). Даёт защиту от опечаток без таблицы. Промотать в таблицу `location` — Фаза 2, если понадобится админка точек. → **Стартуем на VARCHAR+константа.**

### 🔶 D2 — Каталог стадий: константа или таблица?
- **Синтез:** Python-константа `STAGE_CATALOG` (проще, менеджер выбирает в 1 клик).
- **Data-model исследователь:** таблица `stage_catalog` (редактируемая владельцем).
- **Решение:** зависит от вопроса Q8 Давиду («нужна ли владельцу правка стадий?»). Дефолт — **Python-константа** (`app/domain/stages.py`), с полями `code, title_ru, order, transport_hint, stuck_after_days`. Промотать в таблицу — только если Давид скажет «хочу редактировать».

---

## Каталог стадий (дефолт, `app/domain/stages.py`)

```python
STAGE_CATALOG = [
    # code, title_ru, order, stuck_after_days
    ("booking",        "Бронирование",                         10, 7),
    ("loading",        "Загрузка контейнера",                  20, 3),
    ("rail_to_baku",   "В пути по ж/д: Грузия → Баку/Алят",    30, 5),
    ("customs_az",     "Прибыл в Баку/Алят + таможня АЗ",       40, 4),
    ("ferry_wait",     "Ожидание парома в Аляте",               50, 5),  # точка простоя!
    ("ferry",          "На пароме через Каспий",                60, 4),
    ("turkmenbashi",   "Прибыл в Туркменбаши / выгрузка",       70, 3),
    ("rail_to_uz",     "В пути по ж/д: Туркменбаши → Узбекистан",80, 6),
    ("customs_uz",     "Таможенное оформление в Узбекистане",   90, 5),
    ("delivered",      "Выдан / доставлен клиенту",            100, None),
    ("empty_returned", "Порожний возвращён",                   110, None),  # опц.
]
```
> НЕ конечный автомат: менеджер выбирает любую стадию свободно (груз возвращают на таможню, паром отменяют). Порядок нужен только для отрисовки.

---

## Срезы (порядок сборки)

### Срез 0 — Скелет + auth + сид
- **Backend:** FastAPI-скелет, SQLAlchemy async, Alembic init, миграция всех таблиц (VARCHAR+CHECK, CITEXT-расширение). Сид: демо-пользователи (manager/owner/accountant), справочники, Python-константы стадий/точек/типов зарядов.
- **Auth:** регистрация/логин, Argon2id, cookie-сессия + CSRF double-submit, 3 роли в FastAPI-зависимостях, флаг `can_see_money`.
- **Frontend:** экран логина, api-клиент (`credentials:'include'` + CSRF + silent refresh), защищённый layout, дизайн-токены в `tailwind.config.js` + примитивы `ui.jsx`.
- **Done:** `import app.main` OK; pytest зелёный на реальном Postgres; `alembic check` без дрейфа; логин→редирект работает в браузере (скриншот); gitleaks чисто.

### Срез 1 — CRUD Контейнер + Плечи + пресет «Средний коридор»
- **Backend:** CRUD container + leg. Endpoint `POST /containers` с опцией `apply_corridor_preset=true` → создаёт 4 плеча (rail Грузия→Баку · sea_ferry Алят→Туркменбаши · rail →Ташкент · truck доставка) с корректными `seq`.
- **Frontend:** список контейнеров (плотная таблица, колонки: № · клиент · маршрут мини-иконки · стадия-бейдж · дней на стадии · менеджер); форма создания (минимум: № + клиент) + кнопка «Шаблон Средний коридор»; поиск по №/клиенту всегда виден.
- **Done:** создать контейнер с пресетом → 4 плеча в БД; список рендерит; поиск фильтрует; E2E через браузер.

### Срез 2 — Смена стадии + журнал + денормализация
- **Backend:** ОДНА сервисная функция `change_stage()` — атомарно INSERT stage_event + UPDATE current_stage_code/since (одна транзакция). Endpoint `POST /containers/{id}/stage`. Журнал только INSERT.
- **Frontend:** клик по бейджу стадии в строке → поповер (список всех стадий + опц. комментарий + опц. дата факта) → синхронное сохранение + тост. Дата/время/автор автоматически. Без модалок «уверены?».
- **Done:** сменить стадию → запись в журнале + current_stage обновился в одной транзакции (проверить, что не рассинхронятся); тост показан; E2E.

### Срез 3 — Карточка контейнера + лента истории
- **Frontend:** карточка контейнера: шапка «Плечо N из M · [текущая стадия]»; вертикальная append-only лента истории (иконка транспорта + что + автор + дата-время + комментарий, новейшее сверху, записи неизменяемы); блок плеч; ниже — блок денег (срез 4).
- **Done:** открыть контейнер → лента показывает всю историю стадий в порядке; плечи видны; E2E.

### Срез 4 — Деньги income/expense + маржа
- **Backend:** CRUD charge_line. Агрегат маржи = Σ(income) − Σ(expense) по контейнеру (Decimal). Разная сериализация по роли: менеджеру не отдавать маржу (`can_see_money`). Список «кто должен» = неоплаченные income с фильтром по клиенту.
- **Frontend:** блок денег в карточке (строки income/expense по плечу, статус оплаты + due_date, флаг estimated/actual, авто-маржа); экран/вкладка бухгалтера «кто должен».
- **Done:** добавить income+expense → маржа считается верно; менеджер НЕ видит маржу (проверить сериализацию); просроченный due_date краснеет; E2E.

### Срез 5 — Дашборд владельца (drill-down)
- **Backend:** агрегирующие эндпоинты: (1) деньги — к получению/просрочено/маржа за период; (2) застряло — контейнеры без смены стадии дольше `stuck_after_days` стадии; (3) в пути — разбивка по текущему плечу; (4) лента последних N stage_event.
- **Frontend:** дашборд, каждая цифра кликабельна → отфильтрованный список. «Застряло» — список (не число) с кнопкой перейти. recharts ленивый.
- **Done:** дашборд показывает реальные агрегаты; клик по цифре → отфильтрованный список; «застряло» считается по порогу стадии; E2E.

### Срез 6 — Экспорт в Excel
- **Backend:** endpoint `/export.xlsx` (openpyxl), фиксированные колонки, выгружает ТЕКУЩИЙ отфильтрованный вид (те же query-параметры, что список).
- **Frontend:** кнопка «Выгрузить в Excel» на каждом списке и дашборде.
- **Done:** выгрузка открывается в Excel, колонки заполнены, фильтр учтён; E2E.

---

## Финал (после срезов)
- **security-scan** + `gitleaks detect` — гейт перед коммитом.
- **Council-ревью** (Workflow, 4 линзы: security/engineering/ux/domain) — на готовый продукт, починить BLOCKER'ы.
- Поднять локально, дать Давиду креды для теста. Деплой демо — только по явной просьбе.

---

## Открытые вопросы к Давиду (влияют на срезы)
Полный список — `research/RESEARCH_SYNTHESIS.md` / артефакт. Ключевые для модели:
- **Q2 (валюта):** не-USD часто? → мультивалюта в v1 или Фаза 2 (влияет на charge_line).
- **Q5 (финансы):** плоские заряды или инвойс-документ? → граница среза 4.
- **Q8 (стадии):** правка стадий владельцем? → D2 (константа vs таблица).
- **Q6 (авто-плечи):** включать в пресет? → срез 1 пресет.
- **Q9 (документы):** хранить сканы или только номера? → возможно +таблица attachment (Фаза 2).

**Дефолты заданы — можно стартовать срез 0 без ответов, уточнить по ходу.**
