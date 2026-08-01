# --- stage 1: сборка фронта ---
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- stage 2: бэкенд + раздача фронта ---
FROM python:3.12-slim AS runtime
WORKDIR /app

# системные зависимости для asyncpg/сборки колёс — не нужны для slim + бинарные wheels
RUN pip install --no-cache-dir --upgrade pip

# python-зависимости
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# код бэкенда
COPY backend/ ./

# статика фронта из stage 1 → app/static (раздаётся FastAPI)
COPY --from=frontend /fe/dist ./app/static

# entrypoint: миграции + сид (idempotent) + uvicorn
COPY deploy/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV PYTHONPATH=/app
ENV PORT=8000
EXPOSE 8000
CMD ["./start.sh"]
