# Private event covers and share previews

This batch is prepared for PR #3. It is not enabled on the public deployment yet.

## Behavior

- Organizers can upload a JPEG, PNG or WebP (10 MiB maximum input). The API decodes a static image within a 16-million-pixel bound, rotates it, resizes it to at most 1600 pixels and encodes a WebP without EXIF/GPS metadata. Stored output is capped at 2 MiB.
- A private S3-compatible bucket stores the covers. The API authorizes each read: unpublished or unattached uploads belong to their uploader; published event covers are readable publicly. Reads are not cached so unpublishing revokes API access. Third-party social platforms can retain their own previews after fetching a published image.
- Event creation and updates write publication status, image and details in a single statement. Organizers cannot attach another account's internal upload path.
- The Pages client uses bearer-authenticated blob requests for private previews, keeps the previous image after upload failure and blocks saves while an upload is pending.
- Public share links use `/api/share/:slug`, which returns escaped Open Graph/Twitter metadata in the original HTML. Drafts return 404, including for their owner. Current event data is used on every request.

## Configuration

Set `PUBLIC_API_URL`, `PUBLIC_WEB_URL` and `WEB_HASH_ROUTER` to the deployed origins and routing mode. For uploads, set `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `IMAGE_BUCKET` on the API only. Use a private bucket. Without these settings, URL-based covers remain available and device uploads are disabled.

No new database migration is introduced by this batch. The earlier review migrations 002 and 003 are still required before deploying the review branch. A private review bucket named `event-covers` was provisioned; its credentials have not been configured on the public API.

## Verification

Added six API upload/privacy tests, three raw-HTML share tests, and one cross-origin Pages upload/preview test. Storage calls are mocked in the API tests; decoding uses real Sharp. The browser test mocks the upload endpoints and checks bearer authorization, pending state, preserved images on failure and mobile width. These tests do not claim a live object-store integration check.

The final PR-head commit `e2b45e5` passed GitHub CI run `42964147403`, including its
automated API, web, AI and browser verification. A separate Linux check passed `npm ci`,
production web/API builds and all five web tests. Live object-store integration has not
been verified because the API's private storage credentials are not configured.

Before release: complete CI, test the configured private store end to end, review loaded-photo screenshots and verify public API/Pages behavior after deployment.
