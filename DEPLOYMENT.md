# EventBoard v2 deployment — GitHub Pages + Render + Neon (free-tier)

**Public GitHub Pages URL:** https://youmnaeidh.github.io/EventBoard/
**Website:** React static files on GitHub Pages at `/EventBoard/` (HashRouter); API on Render `eventboard-api`; AI on Render `eventboard-ai`; database on **Neon Free PostgreSQL**.
**The release branch does not publish the frontend. After cutover, successful CI on `main` triggers Pages deployment.**

## Keep the existing site running
1. Back up the existing `main` repository and retain its commit history.
2. Push these v2 files to a separate branch, e.g. `release/eventboard-v2-pages`, and run the CI checks. Do NOT merge/overwrite existing `main` yet.
3. Create a **Neon Free** PostgreSQL project, copy its **DIRECT** (non-pooler) URL; migration uses `pg_advisory_lock` (incompatible with transaction poolers).
4. Connect Render to the v2 branch using the settings in `render.yaml`. The target is two free web services (API and AI), **no Render Postgres**. Both services and Neon already exist; reuse them instead of creating duplicates.
5. Set `DATABASE_URL` in the Render API Environment to the secret DIRECT Neon URL; never commit the connection string. The `PUBLIC_WEB_ORIGIN` value should be `https://youmnaeidh.github.io` (bare origin, no `/EventBoard/`).
6. Set `AI_SERVICE_URL=https://eventboard-ai.onrender.com` on Render API and use the same secret `AI_SERVICE_TOKEN` in both services. Free web services cannot receive private-network traffic, so use the authenticated public HTTPS endpoint.
7. Check `https://<actual-api-domain>/api/health`, AI `/health`, and CORS responses from the Pages origin. Record the actual API domain.
8. Build `npm run build:pages -w apps/web` with `VITE_API_BASE_URL=https://<actual-api-domain>` (no `/api` suffix). Preview using `npm run preview -w apps/web -- --mode github-pages --host 127.0.0.1 --port 4173` so the server uses the same `/EventBoard/` base. Test login, register, search, event detail, images/video/fonts, favorites, bookings, ticket, cancellation, organizer forecast and map, including refresh/deep links and mobile widths.
9. The workflow defaults to the verified public API origin `https://eventboard-api-orv8.onrender.com`. The optional Actions variable `EVENTBOARD_API_URL` can override it; it is a public URL, not a secret. Do not publish until hosted verification passes.
10. Prior to merging v2 into `main`, in repository **Settings > Pages** change **Build and deployment Source** to **GitHub Actions**. This protects against an automatic `main`-root GitHub Pages deployment that would break when the old static `index.html` disappears. Switching may temporarily affect publishing; coordinate it at cutover time.
11. Only after tests pass, merge v2 into `main`. Successful CI then triggers **Publish EventBoard v2 to GitHub Pages**; manual dispatch is also available. The workflow checks the Pages source, warms the free services, builds and browser-tests the Pages bundle, publishes, then runs the Desktop/Mobile tests against the actual public URL.
12. Only then remove/archive the old static source from the published branch (without losing the old commit history), update README, and update portfolio links. No need to change the public Pages URL.

## Security & browser behavior
- GitHub Pages `github.io` and Render `onrender.com` are cross-site. The original `SameSite=Lax` cookie cannot reliably authenticate cross-site `fetch` calls; third-party cookies are blocked in common browsers.
- For the GitHub Pages demo, API accepts `Authorization: Bearer` for authenticated endpoints, and returns a token ONLY to the exact configured trusted browser origin. UI holds the **8-hour** token in **sessionStorage**, not long-lived localStorage; it clears it on logout or 401. This is a pragmatic **demo-only** compromise: tokens in JavaScript storage may be stolen by XSS. Do not collect real customer personal data or deploy this approach to production without implementing a stronger auth architecture (e.g. a same-site BFF/custom-domain solution).
- CORS is restricted to `https://youmnaeidh.github.io`, not `*`. No cross-origin credentialed cookies are required. `PUBLIC_WEB_ORIGIN` is NOT a secret.
- `ANTHROPIC_API_KEY` is optional and might incur cost. Forecasting/recommendations can run without it.
- Demo event records, organizer data, reservations and ratings are synthetic. Do not treat the demo as a real booking system.
- Render Free can sleep, so initial requests may take longer. Both services share the workspace's monthly free instance hours; do not add artificial keep-alive pings. Neon Free also has resource quotas. See [Render's free-tier limits](https://render.com/docs/free) and [Neon plans](https://neon.com/docs/introduction/plans).

## Verification status
- Both production builds and all 89 tests passed in [CI run 39154465651](https://github.com/youmnaeidh/EventBoard/actions/runs/39154465651), using PostgreSQL, Python AI and browser integration.
- AI is deployed on Render Free at `https://eventboard-ai.onrender.com`; `/health` returned HTTP 200 on October 19, 2026, without a paid LLM configuration.
- API is live on Render Free at `https://eventboard-api-orv8.onrender.com`. Neon Free PostgreSQL 16 is provisioned in Frankfurt; the startup migration and seed succeeded, and database row counts were verified directly on October 19.
- All five hosted browser checks passed in [run 39211414937](https://github.com/youmnaeidh/EventBoard/actions/runs/39211414937), covering real Render/Neon requests from the intended Pages browser origin, including AI forecasts and mobile layout. The workflow saved actual screenshots to the release branch.
- The owner confirmed switching Pages to GitHub Actions on October 19. PR #2 was merged as `de6caa91d5aabfae5c535f4b81ac715b3848a946`. [Main CI 39283205856](https://github.com/youmnaeidh/EventBoard/actions/runs/39283205856) is queued during GitHub's announced Actions/Pages incident. Automatic Pages publication follows successful CI. The configuration job will independently verify the source when runners resume; public-site verification and portfolio publication are still pending.
- [Release status](docs/release-status.md) records test evidence, commits, the v1 archive and outstanding live-deployment gates.
