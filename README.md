# ShelfScan

> I'm helping a friend moving lots of books.
> I wanted to build a system to quickly track where books end up on shelves using QR codes and a browser-based scanner.
> Claude (and others) are helping me helping my friend. 🙂
> This repo is the codebase for that project.

FastAPI backend with a web UI and an integrated browser scanner for fast book position tracking.

The backend owns book and shelf data, serves a minimal but polished web platform (Jinja2 + HTMX + Pico CSS),
and includes a standalone `/scan` workflow backed by the same API and auth session. Data is stored in SQLite
(Postgres-ready via SQLModel).

## Current features

- **OAuth2 password-flow auth** with multi-user registration requiring admin approval.
- **Book catalog** with title, author, ISBN, arbitrary metadata (`extra` JSON field), and notes.
- **Shelf management** with globally unique shelf IDs and globally unique coordinates (`row`, `position`, `height`).
- **Book copies** — one book can have many physical copies, each tracked to a specific shelf.
- **Standalone scan page** — scan a shelf QR code, then scan book barcodes or capture covers from the browser.
- **Shelf QR generation** — printable QR code sheets for labelling shelves.
- **Web UI** — dashboard, book search (HTMX live search), shelf browser, admin user management.

## Data model note

The current shelf model is intentionally simplified: `shelf_id` is globally unique, and the coordinate triplet
`(row, position, height)` is also globally unique.

If the project grows to support multiple rooms, areas, or buildings, the better shape is:

- a `Location` model
- `Shelf` belonging to a `Location`
- a unique constraint on `(row, position, height, location_id)`
- a unique constraint on `(shelf_id, location_id)`

## Quick start

```bash
cd backend
uv sync --dev
python main.py
```

Open http://localhost:8000 — default admin: `admin` / `admin`.
Open http://localhost:8000/scan for the scanner workflow.

## Architecture

- **Backend:** FastAPI + SQLModel (SQLite default) + Jinja2 + HTMX
- **Scanner UI:** backend-served browser page with camera-based QR/barcode scanning and cover capture
- **Auth:** OAuth2 password flow, JWT tokens, bcrypt password hashing

See `GRAND_PLAN.md` for the implementation roadmap.
