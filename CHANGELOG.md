# Changelog

## 2.1.0 — visual redesign (front-end only)
- New editorial festival identity: Kufam display type, flat logo-palette fields, poster-style event cards, programme-style lineup rows, original generated posters for imageless events. See `docs/design.md`.
- Home: the Madinah hero video is now full-bleed with a floating header; new "وش مزاجك؟" picker backed by the real smart-search endpoint.
- Event detail rebuilt as a poster header with a perforated, animated ticket; organizer area re-skinned with the same identity (charts and data logic unchanged).
- Fixes found during review: Map/Events nav both highlighted, low-contrast inline links, cancelled bookings dimmed below AA contrast, QR codes without a text alternative.
- Two new e2e journeys (hero video present, vibe picker returns real events). No backend, schema, API or AI-service changes.

## 2.0.0
- Rebuilt as React + TypeScript SPA, Express API, PostgreSQL and a Python AI service.
- Arabic natural-language search with interpreted chips; hybrid explainable recommendations; grounded assistant.
- Organizer area: attendance forecast with prediction interval, slot advice, demand gaps, per-event analytics.
- Accounts, bookings with seat locking, QR tickets, verified reviews, favourites, map view.
- CI, Docker, Playwright journeys.

## 1.x (portfolio edition of the 2023 graduation project)
- Static front-end, browser storage, CSV synthetic interactions, KPI report and CSV export.
