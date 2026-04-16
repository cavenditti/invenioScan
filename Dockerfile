# ── Python backend + integrated scanner UI ───────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps (none needed for SQLite/aiosqlite, but keep layer for future)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install backend
COPY backend/pyproject.toml backend/README.md ./
RUN pip install --no-cache-dir .

COPY backend/ ./

# Pre-create directories that need to be writable
RUN mkdir -p /data/uploads

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
