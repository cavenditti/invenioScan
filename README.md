<div align="center">

# ShelfScan

<p><strong>Know exactly where every book lives.</strong></p>

<p>
 <img alt="shelfscan main view" src="https://github.com/cavenditti/ShelfScan/blob/master/docs/Dashboard-mixed.png?raw=true">
</p>

<p>Label shelves, lock a location, scan books quickly, and keep the catalog searchable from one browser-based workflow.</p>

</div>

## Why It Exists

I'm helping a friend move a lot of books.

ShelfScan grew out of a very practical need: label shelves, scan books quickly, and know exactly where everything ended up. This repository is the codebase for that workflow.

ShelfScan is a shelf-first book position tracker built as a single web application. It combines catalog management, printable shelf QR codes, browser-based scanning, and a lightweight admin workflow in one FastAPI app.

## Highlights

- **Shelf-first scanning**: lock a shelf once, then keep scanning ISBNs or capture covers for books without readable barcodes.
- **Integrated web scanner**: no separate mobile app or build pipeline is required for scanning.
- **Searchable catalog**: browse books, copies, and shelves from the same web UI.
- **Printable shelf QR labels**: generate payloads, PNGs, and printable sheets directly from the app.
- **Approval-based auth**: support registration, admin approval, and cookie-backed web sessions.
- **Simple storage model**: SQLite by default, with a Postgres-ready SQLModel codebase.

## How The Scan Flow Works

1. Open `/scan` in the web app.
2. Scan or paste a shelf QR payload.
3. Scan ISBN barcodes, or capture a cover image when needed.
4. Confirm each save visually and continue scanning on the same shelf.
5. Jump into the saved book record when you need to review or edit it.

## Current Features

- **OAuth2 password-flow auth** with multi-user registration and admin approval.
- **Book catalog** with title, author, ISBN, arbitrary metadata (`extra` JSON field), notes, and optional cover URL.
- **Shelf management** with globally unique `shelf_id` values and globally unique coordinates (`row`, `position`, `height`).
- **Book copies** so the same title can exist multiple times on different shelves.
- **Integrated `/scan` workflow** for shelf QR scanning, book barcode scanning, and cover capture from the browser.
- **Shelf QR generation** for labelling and printing shelf markers.
- **Admin tools** for approving and denying users.
- **Web UI** for dashboard views, book search, shelf browsing, and detail pages.

## Quick Start

### Local development

```bash
uv sync --extra dev
uv run python main.py
```

Then open `http://localhost:8000`.

On first startup, ShelfScan creates a bootstrap admin user named `admin`.
If `INVSCAN_BOOTSTRAP_ADMIN_PASSWORD` is not set, a random password is generated and printed to the startup logs.

For local HTTP development, you may also want:

```bash
export INVSCAN_COOKIE_SECURE=false
```

The scanner lives at `http://localhost:8000/scan`.

### Docker

```bash
cp .env.example .env
printf '\nINVSCAN_COOKIE_SECURE=false\n' >> .env
docker compose up --build
```

This starts the full web app on `http://localhost:8000` and stores data in the Docker volume declared in `docker-compose.yml`.

## Configuration

All runtime settings use the `INVSCAN_` prefix.
The main ones you will care about are:

- `INVSCAN_DATABASE_URL`
- `INVSCAN_JWT_SECRET_KEY`
- `INVSCAN_BOOTSTRAP_ADMIN_USERNAME`
- `INVSCAN_BOOTSTRAP_ADMIN_PASSWORD`
- `INVSCAN_BOOTSTRAP_ADMIN_EMAIL`
- `INVSCAN_PUBLIC_BASE_URL`
- `INVSCAN_UPLOAD_DIR`
- `INVSCAN_COOKIE_SECURE`

See `.env.example` for the full set of documented options.

## Stack

- **Backend**: FastAPI + SQLModel
- **Persistence**: SQLite by default
- **Templates/UI**: Jinja2 + HTMX + Pico CSS
- **Scanner**: backend-served browser page with QR, barcode, and cover-capture flow
- **Auth**: JWT-backed login with cookie-based web sessions

## Project Layout

- `shelfscan/`: current FastAPI app package
- `tests/`: backend test suite
- `migrations/`: Alembic migration history
- `pyproject.toml`: root Python project configuration
- `docker-compose.yml`: local container setup
- `Dockerfile`: production-style image build for the web app
- `app/`: archived legacy client, not used by the active product

## Data Model Note

The current shelf model is intentionally simplified: `shelf_id` is globally unique, and the coordinate triplet
`(row, position, height)` is also globally unique.

If the project ever grows to support multiple rooms, areas, or buildings, the better shape is:

- a `Location` model
- `Shelf` belonging to a `Location`
- a unique constraint on `(row, position, height, location_id)`
- a unique constraint on `(shelf_id, location_id)`
