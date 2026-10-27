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
- All CI jobs passed on code commit 5a99e6ef619be7ceaf02571f041a3841b865d373 in run 40442830765:
  API TypeScript, production web build, 50 API tests, 5 web tests, 28 AI tests,
  17 browser journeys and 5 Pages/mobile tests. CI success is not a claim of production availability.
- Continuation: API TypeScript check passed locally. The local Windows dependency install is incomplete
  (workspace symlinks were denied and some optional/native packages are incomplete), so full verification runs in GitHub CI.
- Added regression tests: complete media catalogue, draft privacy, booking-price snapshots,
  analytics ranges, preserved coordinates/images, concurrent view deduplication, opening hours and forecast-slot consistency.
- Versioned additive migrations: 002_review_quality.sql, 003_review_media.sql.
- The initial migration request was denied and was not bypassed. After explicit user approval,
  migrations 002 and 003 were applied atomically to dev-review-2026-10-27 (br-little-meadow-b9qiabdc).
  Independent reads confirmed 30 sourced covers, 282 captured booking prices and 9 daily schedules;
  event/booking/interaction counts remained 30 / 282 / 7,792.
- Production was checked read-only: only 001_init.sql is recorded and none of the three review columns exist.
  No production migration, service configuration change, restart, redeploy or merge has been performed.
- See review-validation-2026-10-27.md for the database verification and Render observations.

## Remaining / not represented as completed

- Device-file uploads: requires provisioned object storage and its configured credentials; the form currently supports URLs, preview and focal position.
- Static social-card prerendering for GitHub Pages.
- Final visual review with loaded photos on mobile/desktop; the local image-host downloads timed out.
- Stronger human-judged Arabic relevance/typo/negation evaluation and recommender-vs-popularity/diversity evaluation.
- Hosted AI root cause and recovery remain unresolved. The user confirmed My Workspace and logs/events/metrics
  were inspected. API logs contain AI HTTP 502 failures. No explicit crash/OOM event was returned.
  Current HTTP availability could not be established from the inspection environment.
  Live services have empty HTTP health-check paths, unlike render.yaml. Production recovery requires approval.
- Release after final visual/preview verification and an explicit production deployment decision; CI and review-branch migrations have passed.
