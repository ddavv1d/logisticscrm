# 06 — VERIFICATION (trust no agent, verify)

Не заявляй «готово» без пруфа. Верифицируй после КАЖДОЙ задачи.

## Что значит «Done»
Билд зелёный + тесты зелёные + lint/types чисто + security чисто + требования выполнены —
**с доказательством** (вывод команды / скриншот / зелёный E2E). Не «должно работать».

## Backend
```bash
# импорт приложения (нет — значит сломано)
./.venv/bin/python -c "import app.main; print('OK')"
# тесты на РЕАЛЬНОМ Postgres (SQLite не годится с CITEXT/INET/VARCHAR+CHECK)
./.venv/bin/python -m pytest tests/ -q
# lint + types
./.venv/bin/ruff check app/
./.venv/bin/mypy app/
# миграция ↔ модели без дрейфа
./.venv/bin/python -m alembic check    # → "No new upgrade operations detected"
```

## Frontend
```bash
npm run build        # должен пройти; смотри размеры чанков
```
- Проверяй В БРАУЗЕРЕ через **preview_*** инструменты (не Bash, не Chrome для этого):
  `preview_start` → `preview_console_logs` (level=error) → `preview_screenshot` /
  `preview_snapshot` → `preview_click`/`preview_fill` для интеракций → снова снимок.
- Проверь mobile И desktop (`preview_resize`).

## E2E (главный пруф)
Прогони реальный поток через настоящий стек (фронт → прокси → бэк → БД). Пример: register →
consent → profile → основное действие → результат. Убедись, что доменная логика верна (не только
что «не упало»). Проверь лог бэка на 500-е.

> **Грабля с контролируемым инпутом:** `preview_fill` ставит DOM-value, но не всегда триггерит
> React onChange. Если сабмит «не сработал» — ставь через нативный сеттер + dispatch input event:
> ```js
> const el=document.querySelector(sel);
> const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
> s.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true}));
> ```

> **Грабля со stale-процессом:** старый dev-сервер может висеть на порту и отдавать УСТАРЕВШИЙ код
> (кажется, что фикс не применился). `lsof -ti:PORT | xargs kill` не всегда убивает —
> `pkill -9 -f "uvicorn app.main"`. Проверь что живой код актуален (напр. по /openapi.json).

## Security gate (перед коммитом)
```bash
gitleaks detect --no-banner --redact     # секреты — 0
# + Skill(security-scan) на изменённые файлы: 0 critical/high на своих строках
```

## Финал
- LLM Council на готовый продукт (`04_METHODOLOGY.md`) — ловит то, что пропустил.
- Подними локально, дай владельцу креды/URL для теста.
- Пуш/деплой — только с явного согласия владельца.
