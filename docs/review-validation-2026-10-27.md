# Review-branch migration validation — 27 October 2026

## Authorization and scope

The user explicitly approved migrations 002_review_quality.sql and 003_review_media.sql
on the isolated review database, and inspection of Render resources in My Workspace.
No production service or database mutation was authorized or performed.

- Code: 5a99e6ef619be7ceaf02571f041a3841b865d373, draft PR #3.
- Neon project: rapid-king-63350061; database: eventboard.
- Review branch: dev-review-2026-10-27 / br-little-meadow-b9qiabdc.
- Parent production branch: br-blue-math-b9qtx54w.
- Migration sources were fetched at the exact code commit and compared with the reviewed files.
- Migration blobs: 002 = 9272865b617ebd6b33a091fabe0328a86aba2590;
  003 = 89242ef050ea5bd1d74eb01da00b555f42c91a4b.

## Execution

The first approved transaction failed before any changes because the database connector accepts
one command per prepared statement. A read verified zero new columns and zero review migration records.
The same versioned SQL was then split at statement boundaries (respecting quoted strings and comments),
without changing its content, and executed in one transaction on the explicit review branch/compute.

The transaction used the migration advisory lock, applied 002 then 003, recorded both migration names,
and checked that row counts and photo completeness were preserved. A failure would roll back the transaction.
A separate read after commit independently verified the outcome.

| Check | Before | After |
| --- | ---: | ---: |
| Events | 30 | 30 |
| Bookings | 282 | 282 |
| Interactions | 7,792 | 7,792 |
| Sourced and credited covers | Not yet migrated | 30 |
| Captured booking unit prices | Column absent | 282 |
| Daily schedules | Details column absent | 9 |
| Negative captured prices | Not applicable | 0 |
| Review migrations recorded | 0 | 2 |

The view-deduplication index exists. Six synthetic view-source categories are present.
All 30 existing events are synthetic; no non-sample event was present in this review snapshot.
Existing rows were not deleted or reseeded.

Production was queried read-only after the review migration: schema_migrations still contains
only 001_init.sql, and events.details, events.publication_status and bookings.unit_price_sar
are absent. This verifies that the review migrations did not run on production.

## Render inspection — observations, not inferred causes

Workspace My Workspace (tea-db8pd449v7es73ddgdp0) was confirmed by the user before inspection.

| Service | Resource | Inspected live code |
| --- | --- | --- |
| API | srv-dbanuvrbc2fs73c49h9g | 0a95ef3767c1c7d95105d5d58d237570a0f98253 |
| AI | srv-db9ckg0m7kps73csqn7g | 0a95ef3767c1c7d95105d5d58d237570a0f98253 |

- Both services report Free Docker, Frankfurt, not suspended, and automatic deployment off.
- Their deployed commit predates this review PR. The linked release branch is five commits ahead;
  the comparison returned only documentation, workflow, test and screenshot changes, not application code.
- API runtime logs include repeated AI upstream HTTP 502 responses, including
  /v1/recommend at 2026-10-27T03:08:58.778007867Z (UTC).
- The last AI application logs returned show successful Uvicorn startup on port 10000
  on 20 October, followed by root-path 404 requests. A root-path 404 alone does not prove a broken service.
- Event history returned successful deployment/build events, not an explicit OOM, crash or health-failure reason.
- Recent API memory readings were below its reported limit; AI metrics returned no data.
  Empty metrics are not proof of zero instances or of an OOM.
- Both live service configurations report an empty healthCheckPath. Version-controlled render.yaml
  specifies /api/health and /health. This configuration drift is verified, but not proven to cause the 502s.
- Browser retrieval could not reach the two public health URLs. Local GET probes timed out after
  12 seconds for both services. These probes do not distinguish inspection-network restrictions,
  cold starts and a genuine service outage. Current end-to-end hosted availability is unverified.

## Next production decision

A controlled AI-service redeploy from the linked stable release branch is a possible diagnostic/recovery step,
not a guaranteed fix. It affects the published service and needs explicit approval.
The current connector deploy action does not support pinning a commit or updating healthCheckPath.
Do not represent it as an exact-instance restart or silently alter service settings, paid plans,
credentials, production database state, or auto-deploy policy.

After any approved recovery, verify /health plus actual search/forecast requests and inspect new logs.
This review validation is not a full hosted preview or production release.
