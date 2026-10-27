# EventBoard review implementation — 27 October 2026

Source: EventBoard_Review_2026-10-20_AR.md. Work is on draft PR #3, not production.

## Implemented

- Search price/date constraints survive an AI outage; local images survive organizer edits.
- Personal distance is absent without explicit coordinates; location transmission is explained.
- Loading/errors, hover contrast, icon labels and verified-booking wording are corrected.
- All 30 synthetic events now have sourced photographic covers, photographer/license records and illustrative captions.
  The old 2023 book-fair poster is replaced. Existing user-created events are not overwritten.
- Responsive CDN sizes, reserved image dimensions, lazy loading, failure artwork and focal-position previews.
- Full poster links are separate from cropped covers. External images remain dependent on the image provider.
- Daily opening hours are distinct from a multi-day date envelope; unknown hours never claim “open now”.
- Exact-coordinate groups replace display jitter, with category legends, linked selection and accuracy labels.
- Organizer coordinate fields preserve existing locations, and a map link verifies the selected point.
- Card/list/map modes, smaller mobile hero, reduced duplication between tonight/popular, decision fields and calendar export.
- Drafts are private to their owner, excluded from public discovery, and cannot be booked.
- Draft save, local preview and published/detail preview links.
- Consistent 7/14/30-day analytics including previous-period counts; views are not falsely called visitors.
- Independent interaction summary replaces the false sequential funnel.
- Booking values use the price captured at booking, not the current event price. Historical unknown prices are excluded and disclosed.
- Synthetic visit sources are varied and labelled. Real attribution is never overwritten.
- Server-side view deduplication (event/session/rolling 30 minutes), safe across concurrent API instances.
- Search diagnostics distinguish constrained-inventory absence from zero-result retrieval. Repeated same-text searches are counted once per identity/day.
- Forecast slots carry an actual date and recomputed promotion lead time, and the UI uses that date.
- Forecast output is labelled registrations/seats, not verified attendance; synthetic-data limits remain visible.
- Client-side event share metadata (static social crawlers still require prerendering; not claimed solved).

## Verification and release gates

- First saved batch: all CI jobs passed before this continuation.
- Continuation: API TypeScript check passed locally. The local Windows dependency install is incomplete
  (workspace symlinks were denied and some optional/native packages are incomplete), so full verification runs in GitHub CI.
- Added regression tests: complete media catalogue, draft privacy, booking-price snapshots,
  analytics ranges, preserved coordinates/images, concurrent view deduplication, opening hours and forecast-slot consistency.
- Versioned additive migrations: 002_review_quality.sql, 003_review_media.sql.
- A request to test those migrations on isolated Neon branch dev-review-2026-10-27
  (br-little-meadow-b9qiabdc) was rejected by the approval gate. It was NOT retried through another tool.
- No production migration or deployment has been performed. Approval for the two migrations on the review branch
  is required before a database-backed preview can be declared verified.

## Remaining / not represented as completed

- Device-file uploads: requires provisioned object storage and its configured credentials; the form currently supports URLs, preview and focal position.
- Static social-card prerendering for GitHub Pages.
- Final visual review with loaded photos on mobile/desktop; the local image-host downloads timed out.
- Stronger human-judged Arabic relevance/typo/negation evaluation and recommender-vs-popularity/diversity evaluation.
- Hosted AI outage root cause and deployment verification; health endpoints were not reachable from the current inspection tool.
- Release after passing CI, approved review-database migration and an explicit production deployment decision.
