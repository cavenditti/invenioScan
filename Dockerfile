# ── Python backend + integrated scanner UI ───────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps (none needed for SQLite/aiosqlite, but keep layer for future)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install the root Python project
COPY pyproject.toml README.md ./
COPY shelfscan ./shelfscan
COPY alembic.ini main.py ./
COPY migrations ./migrations
RUN pip install --no-cache-dir .

# Pre-create directories that need to be writable
RUN mkdir -p /data/uploads

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
