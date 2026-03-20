# InvenioScan

> I'm helping a friend moving lots of books.
> I wanted to build a system to quickly ingest a large number of items into InvenioILS using QR codes and a mobile app.
> Claude (and others) are helping me helping my friend. 🙂
> This repo is the codebase for that project.

FastAPI backend and Expo mobile app for fast operator-assisted ingestion into InvenioILS.

The backend owns shelf QR generation, validates ingest requests, prepares InvenioILS-facing metadata,
and will later take responsibility for async processing and auditing.

The current implementation slice includes:

- FastAPI API scaffold with JWT login.
- Ingest endpoint for ISBN or image-reference submissions.
- Shelf QR payload and PNG generation utilities.
- Minimal Expo app plan and bootstrap target.

See `GRAND_PLAN.md` for the implementation roadmap.
