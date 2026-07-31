# ⭐ 21st.dev Magic MCP — установка и активное использование

Это **главный инструмент дизайна**. 21st.dev — маркетплейс из тысяч готовых shadcn/React
компонентов и тем, уже подобранных почти под любой случай (hero, дашборды, графики, навигация,
формы, карточки, эффекты курсора, анимации). **Не выдумывай дизайн — бери отсюда максимум.**

---

## 1. Установка MCP (один раз на проект)

21st MCP подключается как **HTTP MCP-сервер** через `~/.claude.json`. Ключ API получается на
https://21st.dev (аккаунт → API). Конфиг кладётся в секцию `mcpServers` твоего проекта:

```jsonc
// ~/.claude.json → projects → "/путь/к/твоему/проекту" → mcpServers
"21st": {
  "type": "http",
  "url": "https://21st.dev/api/mcp",
  "headers": {
    "x-api-key": "<YOUR_21ST_API_KEY>"   // секрет! в репозиторий НЕ класть
  }
}
```

Проверь платный ли тариф (даёт unlimited `get_component`): вызови tool `get_usage` — увидишь
`tier: paid, Unlimited search and component-code retrieval`.

> **Безопасность:** ключ 21st — секрет. Он живёт только в `~/.claude.json` (локально), НЕ в git.
> Если ключ где-то засветился (в чате, в логах) — ротируй его в кабинете 21st.

---

## 2. ГЛАВНАЯ ГРАБЛЯ: тулзы 21st часто НЕ грузятся в сессии

Когда рабочая директория Claude — НЕ корень твоего проекта (частый случай), инструменты 21st
(`search`, `get_component`, ...) не появляются в списке. **Это норма.** Решение — ходить в тот же
HTTP-эндпоинт напрямую через JSON-RPC bridge. Готовые скрипты — в `scripts/`. Проверка что
бридж жив:

```bash
KEY=$(python3 -c "import json,os; d=json.load(open(os.path.expanduser('~/.claude.json'))); \
  print(d['projects']['/путь/к/проекту']['mcpServers']['21st']['headers']['x-api-key'])")
curl -s -X POST https://21st.dev/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: $KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | head -c 400
```

Если вернулся список tools (`search`, `get_component`, `get_theme`, `search_logo`, `generate`, ...)
— бридж работает, можно тащить дизайн.

---

## 3. Инструменты 21st (что есть)

| Tool | Что делает | Стоимость |
|------|-----------|-----------|
| `search` | Поиск компонентов/тем/шаблонов. Метаданные (id, name, preview, install). | **FREE, без лимита** |
| `get_component` | Полный КОД компонента + демо + install-команда. По `id` из search. | платно (на paid — unlimited) |
| `get_theme` | Полный CSS темы (`:root`/`.dark` токены). По `id`. | **FREE** |
| `search_logo` | SVG-логотипы брендов (svgl.app). | **FREE** |
| `get_usage` | Тариф + остаток квоты. | FREE |
| `generate` | Сгенерировать UI из текста (возвращает URL, не код). | платно |
| `get_take` | Код одного «take» из generate + copyPrompt-спека. | FREE (для sketch) |

---

## 4. Как ПРАВИЛЬНО работать с 21st (рабочий процесс)

**Стратегия (проверена):** `search` бесплатен и безлимитен — ищи ШИРОКО. `get_component` на
платном тарифе тоже безлимитен — бери код лучших. Дальше адаптируй под палитру проекта.

Для каждого экрана/секции:

1. **`search` под задачу** (несколько запросов, разными словами). Пример запросов, что я гонял:
   - hero: `"animated gradient hero interactive"`, `"aurora shader background hero"`
   - эффект курсора: `"interactive cursor spotlight glow follow"`
   - навигация: `"bottom navigation mobile tab bar"`, `"animated tab bar"`
   - карточки метрик: `"metric stat card trend badge"`, `"stats card"`
   - графики: `"area chart trend recharts"`, `"chart"`
2. **Посмотри preview-картинки** (в результате `search` есть `previewUrl`) — выбери подходящие
   по тематике, не первый попавшийся, НЕ повторяй один и тот же паттерн на всех экранах.
3. **`get_component` по `id`** лучших → получишь реальный код (React/shadcn + framer-motion).
4. **Адаптируй под проект:** перекрась в палитру проекта, убери лишние зависимости, подгони тон.
   Если стек НЕ shadcn (например чистый Vite+Tailwind) — бери СТРУКТУРУ и приёмы (анимации,
   раскладку), переписывай на свои токены минимальными зависимостями.
5. **`get_theme`** — если нужна готовая палитра как отправная точка (но обычно проект уже имеет
   свою — тогда только вдохновение).

**Важно про качество (см. taste-skill, `03_SKILLS_MANIFEST.md`):** 21st даёт СЫРУЮ мощь. Не тащи
слепо неоновые градиенты и «AI-фиолетовый» в серьёзный продукт — примени design-read из
taste-skill, убавь MOTION_INTENSITY под тему, перекрась в палитру проекта. 21st = что взять,
taste-skill = сколько это уместно.

---

## 5. Практический пример (как было в PKUonline)

- Задача: анимированный hero с эффектом курсора для медицинского приложения.
- `search "animated gradient hero interactive"` → нашёл hero с gradient-text + SVG line-draw +
  pulsing CTA. `search "interactive cursor spotlight glow"` → cursor-follow spotlight.
- `get_component` обоих → изучил структуру (CSS-keyframes, pointermove без React-state per frame).
- Палитра компонента была неоновая (`#ff00cc`) — **перекрасил** в стально-синюю палитру проекта,
  **убавил** интенсивность (медтема), добавил `prefers-reduced-motion`. Получился «живой, но
  спокойный» hero — именно то, что просил владелец, без слоп-неона.

Мораль: **дизайн-приёмы и структуру берёшь из 21st, тон и палитру диктует проект + taste-skill.**
