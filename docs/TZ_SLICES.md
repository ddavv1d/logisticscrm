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

> ⚠️ **Правки после council-ревью плана (адверсариального).** Ниже — уже исправленная схема. Ключевые гардрейлы помечены `[review]`. Обоснования — `research/PLAN_REVIEW_RESULT.json`.
>
> **Паттерн nullable-enum (применять ко ВСЕМ nullable VARCHAR+CHECK):** НЕ писать `CHECK (col IN ('a','b', NULL))` — литерал `NULL` в IN не помогает NULL проходить (это делает сама nullability), но **тихо отключает гард**: любой мусор (`'GARBAGE' IN ('a', NULL)` → UNKNOWN) проходит. Проверено рантаймом на Postgres. Писать: `CHECK (col IS NULL OR col IN ('a','b'))`.

### `container` — Контейнер / Заказ (центральная сущность)
| поле | тип | заметка |
|------|-----|---------|
| ref_no | VARCHAR(32) UNIQUE NOT NULL | внутренний номер, генерим (напр. LC-2026-00042). **Первичный идентификатор учёта/поиска.** |
| container_no | VARCHAR(20) NULL | ISO 6346 (MSKU1234565); **атрибут**, заполняется на стадии loading, может меняться при перетарке, НЕ создаёт новую запись. Опц. валидация check-digit. Без enum-CHECK. |
| container_type | VARCHAR(16) NULL — `CHECK (container_type IS NULL OR container_type IN ('20DC','40DC','40HC','REEFER','OT','TANK'))` | dropdown. `[review]` убран литерал NULL из IN |
| direction | VARCHAR(8) NOT NULL DEFAULT 'ge_uz' — `CHECK (direction IN ('ge_uz','uz_ge'))` | `[review]` направление коридора не затвердевает до ответа Q1; зеркальный пресет «обратный» |
| client_id | BIGINT NULL FK client | FCL: заполнен = 1 контейнер = 1 клиент |
| is_consolidated | BOOLEAN NOT NULL DEFAULT false | переключатель FCL/LCL (задел под сборный) |
| origin_location | VARCHAR(80) NOT NULL | точка отправления (см. решение D1 ниже) |
| dest_location | VARCHAR(80) NOT NULL | точка назначения |
| current_stage_code | VARCHAR(40) NOT NULL | ДЕНОРМАЛИЗАЦИЯ, обновляет ТОЛЬКО сервис change_stage. `[review]` заполняется при создании ('booking'), не nullable |
| current_stage_since | TIMESTAMPTZ NOT NULL DEFAULT now() | когда встал на текущую стадию (для «дней на стадии») |
| is_flagged | BOOLEAN NOT NULL DEFAULT false | «проблема/на контроле» — ОТДЕЛЬНО от стадии |
| status | VARCHAR(16) NOT NULL DEFAULT 'active' — `CHECK (status IN ('active','delivered','cancelled','archived'))` | soft-delete |
| created_by/updated_by | BIGINT NOT NULL FK users | + `updated_at` через SQLAlchemy `onupdate=func.now()` |

### `leg` — Плечо маршрута
| поле | тип | заметка |
|------|-----|---------|
| container_id | BIGINT NOT NULL FK container **ON DELETE RESTRICT** | `[review]` RESTRICT, не CASCADE — политика soft-delete, физическое удаление контейнера с плечами/деньгами запрещено на уровне БД |
| seq | SMALLINT NOT NULL — `CHECK (seq > 0)`, UNIQUE(container_id, seq) **DEFERRABLE INITIALLY DEFERRED** | `[review]` deferrable — под будущую вставку-между с перенумерацией. «Плечо N из M» во фронте = позиция в отсортированном списке, не абсолютный seq |
| transport_type | VARCHAR(16) **NOT NULL** — `CHECK (transport_type IN ('rail','sea_ferry','truck','other'))` | `[review]` NOT NULL — плечо без транспорта ломает иконки маршрута |
| from_location / to_location | VARCHAR(80) NOT NULL | точки (решение D1) |
| carrier_id | BIGINT NULL FK carrier | NULLABLE (как LoadPartner) |
| planned_departure/arrival | TIMESTAMPTZ NULL | план |
| actual_departure/arrival | TIMESTAMPTZ NULL | факт |
| comment | TEXT | |

### `stage_event` — Журнал стадий (СЕРДЦЕ, append-only)
| поле | тип | заметка |
|------|-----|---------|
| container_id | BIGINT NOT NULL FK container **ON DELETE RESTRICT** | `[review]` |
| stage_code | VARCHAR(40) NOT NULL | из каталога; **валидировать против STAGE_CATALOG в сервисе** change_stage |
| changed_at | TIMESTAMPTZ NOT NULL DEFAULT now() | АВТО |
| changed_by | BIGINT NOT NULL FK users | АВТО, из сессии |
| comment | TEXT NULL | опц. |
| actual_date | DATE NULL | если факт-дата отличается от момента записи |

> **Только INSERT.** Никаких UPDATE/DELETE. `[review]` **Индекс:** `CREATE INDEX ON stage_event (container_id, changed_at DESC)` — под ленту истории (в первую миграцию).

### `charge_line` — Деньги по плечу
| поле | тип | заметка |
|------|-----|---------|
| container_id | BIGINT NOT NULL FK container **ON DELETE RESTRICT** | маржа считается на контейнер |
| leg_id | BIGINT NULL FK leg | к какому плечу относится (nullable — сквозные затраты) |
| kind | VARCHAR(8) NOT NULL — `CHECK (kind IN ('income','expense'))` | клиенту / перевозчику. **Инвариант:** amount всегда положителен, направление задаёт kind |
| charge_type | VARCHAR(40) NOT NULL — `CHECK (charge_type IN (...CHARGE_TYPES...))` | `[review]` CHECK по Python-константе CHARGE_TYPES (см. ниже) — даёт разрез затрат в дашборде бесплатно |
| amount | NUMERIC(14,2) NOT NULL — `CHECK (amount > 0)` | `[review]` Decimal, строго > 0; сторно/возврат — отдельной строкой, НЕ отрицательным amount |
| paid_amount | NUMERIC(14,2) NOT NULL DEFAULT 0 — `CHECK (paid_amount >= 0 AND paid_amount <= amount)` | `[review]` **добавлено** — без него 'partial' невычислим. Остаток долга = amount − paid_amount |
| currency | CHAR(3) NOT NULL DEFAULT 'USD' — `CHECK (currency = 'USD')` | `[review]` v1-замок: мультивалюта = Фаза 2 (снять CHECK при пересчёте курсов). Per-row currency оставлен как задел |
| is_estimated | BOOLEAN NOT NULL DEFAULT false | estimated/actual — ловит поздний демередж |
| payment_status | VARCHAR(8) NOT NULL DEFAULT 'unpaid' — `CHECK (payment_status IN ('unpaid','partial','paid'))` | **считать по (amount−paid_amount), не по тексту статуса.** Рекомендуется GENERATED из paid_amount |
| due_date | DATE NULL | срок оплаты (краснеет при просрочке) |

> `[review]` **Убрано `counterparty`** — само ТЗ признавало «дублирует carrier/client». income→client контейнера, expense→carrier плеча. Разовый сторонний плательщик — Фаза 2.

### `client`, `carrier` — Справочники (минимальные)
`id, name VARCHAR(120), contact_person, phone, email, note`. Клиент = плательщик; carrier = кому платим на плече.

### `CHARGE_TYPES` (Python-константа, `app/domain/charges.py`) `[review]`
`freight_rail, ferry, truck, customs, demurrage, detention, storage, forwarding, insurance, terminal_handling, other`.
> НЕ добавлять free_days/дата-триггеры демереджа — это запрещённый заказчиком трекинг (Фаза 2).

### ✅ D1 — РЕШЕНО: точки маршрута = VARCHAR + Python-константа `CORRIDOR_LOCATIONS`
VARCHAR-поле + предзаполненный dropdown из константы (`app/domain/locations.py`): `Поти, Батуми, Тбилиси, Баку/Алят, Туркменбаши, Ташкент, Навои` (+ добавлять по факту). Защита от опечаток без таблицы. Промотать в таблицу `location` — **Фаза 2**, если понадобится админка точек.

### ✅ D2 — РЕШЕНО: каталог стадий = Python-константа `STAGE_CATALOG` СЕЙЧАС
`app/domain/stages.py`, поля `code, title_ru, order, stuck_after_days`. Менеджер выбирает в 1 клик. Промотать в таблицу `stage_catalog` (редактируемую владельцем) — **Фаза 2**, только если Давид ответит на Q8 «хочу сам редактировать стадии».

---

## Каталог стадий (дефолт, `app/domain/stages.py`)

```python
# stuck_after_days ОТКАЛИБРОВАНЫ под P75-P90 реальных таймингов коридора [review].
# ПОМЕТКА: пересмотреть по факту первого месяца эксплуатации.
STAGE_CATALOG = [
    # code, title_ru, order, stuck_after_days, leg_seq (к какому плечу относится стадия)
    ("booking",        "Бронирование",                          10,  7,    None),
    ("loading",        "Загрузка контейнера",                   20,  3,    1),
    ("rail_to_baku",   "В пути по ж/д: Грузия → Баку/Алят",      30,  7,    1),  # было 5
    ("customs_az",     "Прибыл в Баку/Алят + таможня АЗ",        40,  4,    1),
    ("ferry_wait",     "Ожидание парома в Аляте",               50, 12,    2),  # было 5 — точка простоя!
    ("ferry",          "На пароме через Каспий",                60,  4,    2),
    ("turkmenbashi",   "Прибыл в Туркменбаши / выгрузка",       70,  3,    2),
    ("rail_to_uz",     "В пути по ж/д: Туркменбаши → Узбекистан",80, 12,    3),  # было 6
    ("customs_uz",     "Таможенное оформление в Узбекистане",   90,  7,    3),  # было 5
    ("delivered",      "Выдан / доставлен клиенту",            100, None,  4),
    ("empty_returned", "Порожний возвращён",                   110, None,  None),  # опц.
]
```
> НЕ конечный автомат: менеджер выбирает любую стадию свободно (груз возвращают на таможню, паром отменяют). Порядок нужен только для отрисовки.
>
> `[review]` **stuck_after_days=None** (delivered/empty_returned) → в расчёте «застряло» трактовать как «никогда не застревает». Неизвестный код (вне каталога) → тоже «никогда». Иначе финальные стадии молча выпадают из ленты владельца.
> `[review]` **leg_seq** связывает стадию с плечом → пресет и «Плечо N из M» согласованы; «ferry_wait»/«ferry» на плече 2 (Алят→Туркменбаши).

---

## Срезы (порядок сборки)

### Срез 0 — Скелет + auth + сид
- **Среда `[review]`:** `.python-version=3.12` в корне; venv на **3.12** (не системный 3.14 — иначе сборка asyncpg/pydantic-core из исходников); `check_env.sh` падает если активный python ≠ 3.12.x.
- **Backend:** FastAPI-скелет, SQLAlchemy async, Alembic init, миграция всех таблиц (VARCHAR+CHECK по паттерну nullable-enum, `CREATE EXTENSION IF NOT EXISTS citext`). Сид **версионируемый, с уровнями** `[review]`: базовый (пользователи+справочники+константы) / +история / +деньги / **+«застрявший» контейнер с бэкдейт-датой** (нужен для E2E среза 5, т.к. current_stage_since=now() не даёт создать застрявшего через UI). One-liner «db reset+seed».
- **Auth (упрощено `[review]`):** регистрация/логин, Argon2id, **единая opaque cookie-сессия со скользящим TTL 12-24ч** + CSRF double-submit. На 401 — редирект на `/login`. **БЕЗ silent-refresh/single-flight** — рефрешить opaque-сессию нечего, брифом не требуется, это был scope-creep в самом раннем срезе (убирает подкласс фронт-багов: петли/гонки). 3 роли в FastAPI-зависимостях, флаг `can_see_money`.
- **Frontend:** экран логина, api-клиент (`credentials:'include'` + CSRF-header из cookie; на 401 → redirect /login), защищённый layout, дизайн-токены в `tailwind.config.js` + примитивы `ui.jsx`.
- **Done:** venv на 3.12 (проверено); `import app.main` OK; pytest зелёный на реальном Postgres; `alembic check` без дрейфа; логин→редирект работает в браузере (скриншот); gitleaks чисто.

### Срез 1 — CRUD Контейнер + Плечи + пресет «Средний коридор»
- **Backend:** CRUD container + leg. Endpoint `POST /containers` с опцией `apply_corridor_preset=true` → создаёт 4 плеча из `CORRIDOR_LOCATIONS` (rail Поти→Алят · sea_ferry Алят→Туркменбаши · rail Туркменбаши→Ташкент · truck Ташкент→клиент) с корректными `seq`. `[review]` **from/to брать точными строками из константы** (в ней нет 'Грузия'/'truck доставка'). При обратном направлении (Q1) — зеркальный пресет.
- `[review]` **Создание контейнера ставит стартовую стадию:** первый `stage_event` 'booking' + `current_stage_code='booking'` + `current_stage_since=now()` (через ту же `change_stage()` из среза 2 — вынести её раньше). Иначе пустой бейдж и несчитаемые «дни на стадии».
- `[review]` **`build_container_query(params)`** — переиспользуемая сборка фильтра списка (service/dependency) с замкнутым набором параметров: `search, chip/stage, client, stuck`. Её же используют дашборд (срез 5) и экспорт (срез 6) — иначе они станут скрытым рефактором.
- `[review]` **`is_stuck(container)`** — одна доменная функция (порог из `stuck_after_days` стадии), с среза 1 (где появляется чип «Застряло»), не дублировать в срезе 5.
- **Frontend:** список контейнеров (плотная таблица, колонки: Ref/Конт.№ · клиент · маршрут мини-иконки · стадия-бейдж · дней на стадии · менеджер); чипы-счётчики; форма создания (минимум: № + клиент) + кнопка «Шаблон Средний коридор».
- `[review]` **Поиск = ref_no ∪ client.name ∪ container_no** (один ILIKE, нормализовать ввод upper/trim в сервисе — иначе 'msku1234565'/'MSKU 1234565' не найдут). «Где мой груз MSKU…» обязан находиться.
- **Done:** создать контейнер с пресетом → 4 плеча + стартовая стадия 'booking' в БД; список рендерит; поиск по container_no находит; E2E через браузер.

### Срез 2 — Смена стадии + журнал + денормализация
- **Backend:** ОДНА сервисная функция `change_stage()` — атомарно INSERT stage_event + UPDATE current_stage_code/since (одна транзакция). Endpoint `POST /containers/{id}/stage`. Журнал только INSERT. `[review]` **валидировать stage_code против STAGE_CATALOG**; правило-ловушка «UPDATE current_stage_code только здесь».
- **Frontend `[review]`:** клик по бейджу стадии → поповер с **ОДНОЙ крупной кнопкой «→ Следующая: [стадия по order]»** сверху (закрывает 90% случаев в 1 клик — must-win-метрика «быстрее Excel»), ниже — полный список всех стадий для откатов/перескоков + опц. комментарий + опц. дата факта → синхронное сохранение + тост. Дата/время/автор автоматически. Без модалок «уверены?».
- **Done:** кнопка «→ Следующая» двигает на одну стадию в 1 клик; смена стадии → запись в журнале + current_stage обновился в одной транзакции (тест-инвариант `current_stage_code == max(changed_at).stage_code`); тост показан; E2E.

### Срез 3 — Карточка контейнера + лента истории
- **Frontend:** карточка контейнера: шапка «Плечо N из M · [текущая стадия]»; вертикальная append-only лента истории (иконка транспорта + что + автор + дата-время + комментарий, новейшее сверху, записи неизменяемы); блок плеч; ниже — блок денег (срез 4).
- **Done:** открыть контейнер → лента показывает всю историю стадий в порядке; плечи видны; E2E.

### Срез 4 — Деньги income/expense + маржа
- **Backend:** CRUD charge_line. Агрегат маржи = Σ(income) − Σ(expense) по контейнеру (Decimal, `amount>0`, направление по `kind`). `[review]` **долг/«кто должен»/дашборд считать по `(amount − paid_amount) > 0`, НЕ по тексту `payment_status`.** Список «кто должен» = строки income с остатком > 0, группировка по client_id.
- `[review]` **Сериализация маржи по роли — безопасная техника:** вырезать `margin` в сервисе ДО сериализации ИЛИ две модели `ManagerContainerOut`/`OwnerContainerOut`. НЕ полагаться на «скрыто на экране».
- `[review]` **Валютный замок:** до этого среза `CHECK (currency='USD')` уже в схеме (мультивалюта = Фаза 2). Закрыть **Q2** перед срезом. Тест на смешанные валюты в Done.
- **Frontend:** блок денег в карточке (строки income/expense по плечу, статус оплаты + остаток + due_date, флаг estimated/actual, авто-маржа); экран/вкладка бухгалтера «кто должен».
- **Done:** добавить income+expense → маржа верна; **в СЫРОМ JSON под manager нет ключа `margin`** (assert, не «на экране не видно»); частично оплаченная строка даёт верный остаток; просроченный due_date краснеет; тест смешанных валют падает корректно; E2E.

### Срез 5 — Дашборд владельца (drill-down)
- **Backend:** агрегирующие эндпоинты (через `build_container_query`/`is_stuck` из среза 1): (1) деньги — к получению/**просрочено (due_date<today)**/маржа за период; (2) застряло — `is_stuck` (порог `stuck_after_days` стадии; None → не застревает); (3) в пути — разбивка по текущему плечу; (4) лента последних N stage_event.
- **Frontend `[review]`:** **3-4 крупных кликабельных числа СВЕРХУ** (Просрочено · К получению · Застряло N⚠ · В пути N), area-график — ниже/опционально. Каждая цифра → отфильтрованный список. «Застряло» — список (не число) с кнопкой перейти.
- `[review]` **recharts — условно:** `React.lazy()`+`Suspense`; `manualChunks` добавлять только если замер бандла покажет проблему. Если график уйдёт в Фазу 2 — recharts в MVP не нужен вовсе.
- `[review]` **E2E требует фикстуру «застрявшего»** из версионируемого сида (см. срез 0) — через UI застрявшего не создать (current_stage_since=now()).
- **Done:** дашборд показывает реальные агрегаты на сид-фикстуре с застрявшим; клик по цифре → отфильтрованный список; E2E.

### Срез 6 — Экспорт в Excel
- **Backend:** endpoint `/export.xlsx` (openpyxl), фиксированные колонки, выгружает ТЕКУЩИЙ отфильтрованный вид списка контейнеров (те же query-параметры через `build_container_query`).
- `[review]` **Экспорт дашборда/«застряло» — отдельная под-задача** (не «та же кнопка»): один `/export.xlsx` с фикс-колонками списка НЕ покрывает агрегаты дашборда. Для MVP достаточно экспорта списка; экспорт агрегатов — по необходимости.
- **Frontend:** кнопка «Выгрузить в Excel» на списке контейнеров (+ на «кто должен»).
- **Done:** выгрузка открывается в Excel, колонки заполнены, фильтр учтён; E2E.

---

## Финал (после срезов)
- **security-scan** + `gitleaks detect` — гейт перед коммитом (⚠️ Opsera-хук требует скан + `touch /tmp/.opsera-pre-commit-scan-passed` отдельным вызовом).
- **Council-ревью** (Workflow, 5 линз + адверсариальная верификация: security/engineering/ux/domain/simplicity) — на готовый продукт, починить BLOCKER'ы.
- Поднять локально, дать Давиду креды для теста. Деплой демо — только по явной просьбе.

---

## Уточнения по ходу (НЕ блокеры — дефолты в коде)
Полный список — `research/RESEARCH_SYNTHESIS.md`. После council-ревью плана: **Q3 (единица=контейнер) и Q7 (порог застряло) — закрыты дефолтом в коде.** Осталось уточнить к соответствующим срезам:
- **Q2 (валюта):** не-USD часто? → снять `CHECK(currency='USD')` для мультивалюты. **Закрыть перед срезом 4.**
- **Q5 (финансы):** плоские заряды или инвойс-документ с частичными оплатами? → `paid_amount` уже в схеме; инвойс-документ = Фаза 2. Граница среза 4.
- **Q8 (стадии):** правка стадий владельцем? → D2 решено (константа сейчас); таблица `stage_catalog` = Фаза 2, если «да».
- **Q6 (авто-плечи):** включать truck-плечи в пресет? → срез 1 пресет.
- **Q1 (направление):** обратные рейсы UZ→GE? → `container.direction` уже в схеме + зеркальный пресет.
- **Q9 (документы):** хранить сканы или только номера? → +таблица attachment (Фаза 2).

**Дефолты заданы — можно стартовать срез 0 без ответов, уточнить по ходу.**

---

## Итог council-ревью плана (адверсариального)
54 агента, 48 находок → **42 пережили адверсариальную верификацию** (6 опровергнуто). **Вердикт: настоящих BLOCKER'ов нет, план готов к коду.** Все правки выше помечены `[review]` и внесены в схему/срезы. Полный punch-list + обоснования (часть проверена рантаймом на Postgres) — `research/PLAN_REVIEW_RESULT.json`. Оставшиеся NICE-пункты (индексы по мере надобности, косметика доков) — по ходу сборки.
