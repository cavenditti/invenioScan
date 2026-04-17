#!/bin/sh
set -e

# Run Alembic migrations (when migrations/ exists)
if [ -d "migrations" ]; then
    echo "Running database migrations…"
    alembic upgrade head
fi

exec uvicorn shelfscan.app:app \
    --host 0.0.0.0 \
    --port 8000 \
    --proxy-headers \
    --forwarded-allow-ips='*'
