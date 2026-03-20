# InvenioScan Grand Plan

## Goal

Build a mobile-assisted ingestion pipeline for InvenioILS that lets operators authenticate, scan or select a shelf context, submit ISBN or image-backed scans quickly, and attach enough metadata for later catalog enrichment.

## Product Decisions

- Backend owns shelf QR code generation.
- Shelf position metadata must be attached to the InvenioILS-facing metadata payload.
- Local backend accounts with JWT are sufficient for the first release.
- The first implementation slice favors a stable middleware contract over a full worker or database stack.
- The app should already expose optional title and author fields to support manual enrichment while scanning.

## Phase Plan

### Phase 1: Foundation

- Minimal FastAPI application.
- Settings management, JWT auth helpers, request/response schemas, and router structure.
- A pluggable InvenioILS adapter boundary so API validation and external integration stay decoupled.

### Phase 2: Core Middleware API

- Implement `POST /api/v1/auth/login` with a bootstrap operator account from configuration.
- Implement `GET /api/v1/health` for readiness checks.
- Implement `POST /api/v1/ingest` to accept shelf context, ISBN or image reference, and optional title/author.
- Implement a QR utility endpoint to generate printable shelf tags.

### Phase 3: Mobile App Slice

- Bootstrap an Expo TypeScript app.
- Add login and secure JWT storage.
- Add a manual ingest form with shelf metadata, ISBN or image reference, and optional title/author.
- Leave the camera-driven flow for the next slice once the backend contract is stable.

### Phase 4: InvenioILS Integration Hardening

- Replace the stub adapter with real HTTP integration once the target instance metadata contract is confirmed.
- Ensure shelf position data is written into the record payload and internal tracking identifiers are preserved.
- Decide whether scan images become external references, identifiers, or linked e-items.

### Phase 5: Queueing, Persistence, and Deployment

- Add Postgres-backed audit data for operators, shelves, and ingest jobs.
- Async processing so the mobile client never waits on InvenioILS.
- Add Dockerfiles and a Compose stack for API, worker, and Postgres.

## First Implementation Slice in This Repo

### Backend

- FastAPI app bootstrap in `backend/invenioscan`.
- JWT login using bootstrap credentials from environment variables.
- Ingest validation with normalized metadata output.
- QR payload builder and PNG QR endpoint.
- Stub InvenioILS adapter that prepares the outbound payload shape, including shelf position metadata.

### App

- Expo app bootstrap under `app/`.
- Secure token persistence with `expo-secure-store`.
- Login form.
- Manual ingest form with optional title and author.

## Open Questions

- Which exact InvenioILS fields should store operator tracking and shelf position metadata.
- Whether captured images should be represented as e-items, external references, or a custom extension.
- When to enable queueing and durable persistence relative to metadata mapping validation.

