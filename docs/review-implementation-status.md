# EventBoard review implementation — 27 October 2026

Source: EventBoard_Review_2026-10-20_AR.md (20 October review).
Branch: improve/review-2026-10-27. Base: 37d2b53ba804a0f619a2be8fa14361778ce029eb.

## First implementation batch

- Preserve local catalogue images when the organizer edits an event.
- Validate internal event-image paths without permitting arbitrary local URLs.
- Recover from an image loading failure with the existing fallback artwork.
- Hide personal distances until coordinates are supplied.
- Label multi-day events as ongoing rather than claiming they are open now.
- Correct contrast on dark hover backgrounds.
- Name icon-only search and account controls for assistive technology.
- Distinguish initial loading/errors from an empty home catalogue.
- Explain optional location transmission accurately.
- Label booking-backed reviews as verified bookings rather than confirmed attendance.
- Remove the positive-rating filter from the latest-review query.
- Explain the demonstration nature of bookings next to the booking panel.
- Enforce parsed price/time constraints before either AI or fallback search.
- Add regression tests for free, paid, budget and date constraints.

## Still pending from the review

- Complete all 30 event covers with verified photographs and credits; replace outdated posters.
- Separate complete posters from cropped covers; implement image upload/preview.
- Daily sessions and opening times, exact/approximate venue selection and honest map clustering.
- Compact/mobile discovery layouts, card view, reduced duplication, calendar links and decision details.
- Draft publishing and preview workflow.
- Consistent analytics periods/definitions, historical booking prices and interaction deduplication.
- Demand-gap quality, recommender evaluation and full forecast scenario consistency.
- Diagnose hosted AI availability and verify the final release across services.

## Interruption and verification

The local execution environment disconnected during development. Local draft schema changes,
dependency installation and test processes could not be inspected after disconnection.
This branch preserves the coherent first batch independently; it deliberately excludes unfinished
schema changes. Full CI is requested by the draft pull request. No production branch, live website,
or production database has been updated by this batch.

A separate Neon test branch was created: dev-review-2026-10-27.
