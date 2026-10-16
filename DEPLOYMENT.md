# EventBoard v2 deployment — GitHub Pages + Render + Neon (free-tier)

**Public GitHub Pages URL:** https://youmnaeidh.github.io/EventBoard/
**Website:** React static files on GitHub Pages at `/EventBoard/` (HashRouter); API on Render `eventboard-api`; AI on Render `eventboard-ai`; database on **Neon Free PostgreSQL**.
**The project includes an opt-in workflow; it will NOT overwrite the old site automatically.**

## Keep the existing site running
1. Back up the existing `main` repository and retain its commit history.
2. Push these v2 files to a separate branch, e.g. `release/eventboard-v2-pages`, and run the CI checks. Do NOT merge/overwrite existing `main` yet.
3. Create a **Neon Free** PostgreSQL project, copy its **DIRECT** (non-pooler) URL; migration uses `pg_advisory_lock` (incompatible with transaction poolers).
4. Connect Render to the v2 branch, create a Blueprint using `render.yaml`. It creates two free web services (API and AI), **no Render Postgres**.
5. Set `DATABASE_URL` in the Render API Environment to the secret DIRECT Neon URL; never commit the connection string. The `PUBLIC_WEB_ORIGIN` value should be `https://youmnaeidh.github.io` (bare origin, no `/EventBoard/`).
6. Once deployed, take the REAL URL of the AI service and set it as `AI_SERVICE_URL` on Render API. Redeploy if necessary.
7. Check `https://<actual-api-domain>/api/health`, AI `/health`, and CORS responses from the Pages origin. Record the actual API domain.
8. Build `npm run build:pages -w apps/web` with `VITE_API_BASE_URL=https://<actual-api-domain>` (no `/api` suffix). Preview the `apps/web/dist` artifact and test: login, register, event search, event detail, image and video, favorites, bookings, ticket, cancellation, organizer forecast and map, including browser refresh/deep links.
9. Configure GitHub repository Actions variable `EVENTBOARD_API_URL` to the confirmed Render API origin. Do not publish until it is healthy.
10. Prior to merging v2 into `main`, in repository **Settings > Pages** change **Build and deployment Source** to **GitHub Actions**. This protects against an automatic `main`-root GitHub Pages deployment that would break when the old static `index.html` disappears. Switching may temporarily affect publishing; coordinate it at cutover time.
11. Only after tests pass, merge v2 into `main` and manually run **Actions > Publish EventBoard v2 to GitHub Pages > Run workflow**. The action checks Render API health and builds the Pages bundle. Confirm the same URL above shows the new UI.
12. Only then remove/archive the old static source from the published branch (without losing the old commit history), update README, and update portfolio links. No need to change the public Pages URL.

## Security & browser behavior
- GitHub Pages `github.io` and Render `onrender.com` are cross-site. The original `SameSite=Lax` cookie cannot reliably authenticate cross-site `fetch` calls; third-party cookies are blocked in common browsers.
- For the GitHub Pages demo, API accepts `Authorization: Bearer` for authenticated endpoints, and returns a token ONLY to the exact configured trusted browser origin. UI holds the **8-hour** token in **sessionStorage**, not long-lived localStorage; it clears it on logout or 401. This is a pragmatic **demo-only** compromise: tokens in JavaScript storage may be stolen by XSS. Do not collect real customer personal data or deploy this approach to production without implementing a stronger auth architecture (e.g. a same-site BFF/custom-domain solution).
- CORS is restricted to `https://youmnaeidh.github.io`, not `*`. No cross-origin credentialed cookies are required. `PUBLIC_WEB_ORIGIN` is NOT a secret.
- `ANTHROPIC_API_KEY` is optional and might incur cost. Forecasting/recommendations can run without it.
- Demo event records, organizer data, reservations and ratings are synthetic. Do not treat the demo as a real booking system.
- Render Free can sleep and may have usage limits, so initial requests may take longer. Neon Free has quotas but no fixed 30-day expiry.

## Verification status
- Static compatibility changes: implemented in source.
- Full Node build, API tests, E2E browser + deployment: must be verified in CI and on live hosting before replacing the current public link.
- No production deployment, API URL, Neon database, or GitHub repository replacement is asserted by this file.
