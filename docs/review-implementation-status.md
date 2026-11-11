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
- Server-rendered `/api/share/:slug` pages provide Open Graph/Twitter metadata for published events;
  draft events remain inaccessible, and shared links lead back to the Pages event detail.
- Optional private image uploads accept JPEG/PNG/WebP, re-encode to WebP without EXIF data,
  and enforce organizer ownership. Without private S3 credentials, the upload control is disabled
  and existing URL-based covers still work.

## Verification and release gates

- First saved batch: all CI jobs passed before this continuation.
- All CI jobs passed on code commit 5a99e6ef619be7ceaf02571f041a3841b865d373 in run 40442830765:
  API TypeScript, production web build, 50 API tests, 5 web tests, 28 AI tests,
  17 browser journeys and 5 Pages/mobile tests. CI success is not a claim of production availability.
- Continuation: API TypeScript check passed locally. The local Windows dependency install is incomplete
  (workspace symlinks were denied and some optional/native packages are incomplete), so full verification runs in GitHub CI.
- Added regression tests: complete media catalogue, draft privacy, booking-price snapshots,
  analytics ranges, preserved coordinates/images, concurrent view deduplication, opening hours and forecast-slot consistency.
- Latest PR-head commit `e2b45e59c7e07d6602e7935aa432344f9ed5e9a6` passed GitHub CI run
  `42964147403` (11 November). Local Linux `npm ci`, full web/API TypeScript production build,
  and all 5 web tests passed independently. Local Python tests could not run because pytest is absent;
  GitHub's Python CI job is part of the successful run.
- Read-only live probes on 11 November returned HTTP 200 from API `/api/health` and AI `/health`;
  `/api/recommendations?limit=2` returned `mode: ai` and two items. This proves that path worked
  at probe time, not that every AI request is reliable.
- All 19 distinct Unsplash image URLs used by the 30-cover catalogue returned HTTP 200
  in a lightweight retrieval check (11 November); providers may change them later.
- Versioned additive migrations: 002_review_quality.sql, 003_review_media.sql.
- The initial migration request was denied and was not bypassed. After explicit user approval,
  migrations 002 and 003 were applied atomically to dev-review-2026-10-27 (br-little-meadow-b9qiabdc).
  Independent reads confirmed 30 sourced covers, 282 captured booking prices and 9 daily schedules;
  event/booking/interaction counts remained 30 / 282 / 7,792.
- Production was checked read-only on 11 November: only `001_init.sql` is recorded;
  the database still has 30 events, of which 8 have image URLs.
  No production migration, service configuration change, restart, redeploy or merge has been performed.
- See review-validation-2026-10-27.md for the database verification and Render observations.

## Remaining / not represented as completed

- Live device-file uploads require private object-store configuration and end-to-end verification;
  the implemented upload API and UI are intentionally disabled without these credentials.
- Social platforms still need a real crawl test of `/api/share/:slug` after deployment.
- Final visual review with loaded photos on mobile/desktop; the local image-host downloads timed out.
- Stronger human-judged Arabic relevance/typo/negation evaluation and recommender-vs-popularity/diversity evaluation.
- Earlier API logs contained AI HTTP 502 failures. The latest read-only health and recommendation
  probes succeeded, but the intermittent cause remains unconfirmed. Both services still have empty
  HTTP health-check paths, unlike `render.yaml`, and automatic deployment is disabled.
- Render API/AI services track `release/eventboard-v2-pages`, which has diverged from this PR branch.
  A reviewed release-branch merge and a manual deploy are needed; merging PR #3 to `main` alone
  cannot update these services. Do not merge to `main` before the backend/database rollout.
- Production release requires an explicit deployment decision and safe ordering: review production
  backup/rollback options, apply additive migrations 002/003, deploy the compatible API and AI,
  verify real journeys, then merge PR #3 and verify GitHub Pages. CI success alone is not deployment.
