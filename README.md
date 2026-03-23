# InvenioScan

> I'm helping a friend moving lots of books.
> I wanted to build a system to quickly track where books end up on shelves using QR codes and a mobile app.
> Claude (and others) are helping me helping my friend. 🙂
> This repo is the codebase for that project.

FastAPI backend with a web UI and an Expo mobile app for fast book position tracking.

The backend owns book and shelf data, serves a minimal but polished web platform (Jinja2 + HTMX + Pico CSS),
and exposes a JSON API for the mobile scanning app. Data is stored in SQLite (Postgres-ready via SQLModel).

## Current features

- **OAuth2 password-flow auth** with multi-user registration requiring admin approval.
- **Book catalog** with title, author, ISBN, arbitrary metadata (`extra` JSON field), and notes.
- **Shelf management** with unique shelf IDs and labels.
- **Book copies** — one book can have many physical copies, each tracked to a specific shelf/row/position.
- **Mobile ingest** — scan a shelf QR code, then scan book barcodes to quickly log positions.
- **Shelf QR generation** — printable QR code sheets for labelling shelves.
- **Web UI** — dashboard, book search (HTMX live search), shelf browser, admin user management.

## Quick start

```bash
cd backend
pip install -e ".[dev]"
python main.py
```

Open http://localhost:8000 — default admin: `admin` / `admin`.

## Architecture

- **Backend:** FastAPI + SQLModel (SQLite default) + Jinja2 + HTMX
- **Mobile app:** Expo (React Native) with barcode/QR scanning
- **Auth:** OAuth2 password flow, JWT tokens, bcrypt password hashing

See `GRAND_PLAN.md` for the implementation roadmap.
