# ShelfScan Grand Plan

## Goal

Build a self-contained book position tracker that lets operators authenticate, scan or select a shelf context, submit ISBN or image-backed scans, and track where every book copy lives across physical shelves. A polished web UI provides browsing, search, and admin capabilities.

## Product Decisions

- **No external library system dependency.** The backend owns all data in its own database.
- Backend owns shelf QR code generation.
- Shelf position metadata is first-class: every book copy is pinned to a shelf/row/position/height.
- OAuth2 password flow with multi-user registration requiring admin approval. Registrations auto-denied after 7 days.
- SQLite by default (zero-config), Postgres-ready by changing `DATABASE_URL`.
- Web UI via Jinja2 + HTMX + Pico CSS — no JS build step, served directly by FastAPI.
- Book `extra` JSON field for arbitrary metadata expansion without schema changes.
- The backend-owned `/scan` page handles scanning workflows; the rest of the web UI handles browsing and admin.

## Data Model

- **User** — username, email, hashed password, status (pending/approved/denied), admin flag.
- **Book** — title, author, isbn, publication year, document type, language, cover image URL, extra (JSON), notes.
- **Shelf** — unique shelf_id (human-readable, e.g. "A1"), label.
- **BookCopy** — links a book to a shelf position (row, position, height), with a UUID scan_id for traceability.

One book → many copies. One shelf → many copies. One user → many books (creator tracking).

## Phase Plan

### Phase 1: Foundation (✅ Done)

- FastAPI application with settings management and router structure.
- SQLModel models for User, Book, Shelf, BookCopy.
- Async SQLite database with auto-migration via `create_all()`.
- OAuth2 password flow with JWT, bcrypt hashing, multi-user registration + admin approval.
- Bootstrap admin auto-created on first startup.

### Phase 2: Core API (✅ Done)

- `POST /api/v1/auth/register` — create pending user.
- `POST /api/v1/auth/login` — OAuth2 form login, returns JWT.
- `GET /api/v1/auth/me` — current user profile.
- Full CRUD for books, shelves, and book copies.
- `POST /api/v1/ingest` — shelf-first scanning: creates book + copy from ISBN/image scan.
- `POST /api/v1/ingest/upload` — image upload ingest.
- Admin user management: list, approve, deny.
- QR shelf tag generation (payload, PNG, printable sheet).

### Phase 3: Web UI (✅ Done)

- Jinja2 + HTMX + Pico CSS web platform served by FastAPI.
- Dashboard with stats and recent books.
- Book list with live HTMX search, book detail with copies.
- Shelf list and detail views.
- Admin user management page with approve/deny buttons.
- Cookie-based auth backed by same JWT tokens.

### Phase 4: Integrated Scanner (✅ Done)

- Backend-served `/scan` page with browser camera access.
- Shelf QR scanning, book barcode scanning, image capture, and manual fallbacks.
- Same-origin cookie auth for both web pages and API calls.
- Ingest responses show book_id/copy_id/scan_id.

### Phase 5: Future Enhancements

- Alembic migrations when schema stabilizes.
- Postgres deployment option with Docker Compose.
- Book metadata enrichment via ISBN lookup APIs (Open Library, Google Books).
- Bulk import/export (CSV, JSON).
- Search improvements: full-text search, faceted filtering.
- Async worker for background processing (image OCR, metadata enrichment).
- Audit log for tracking who scanned what and when.

## Open Questions

- Whether to add ISBN lookup integration for automatic metadata enrichment.
- When to enable Postgres + Docker Compose deployment.
- Whether captured images should become cover images or separate attachments.
- Full-text search strategy (SQLite FTS5 vs. external search engine).

