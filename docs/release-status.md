# EventBoard v2 release verification

Updated **2026-10-19, after 19:08 Asia/Riyadh**. The verified release is merged into `main`; public cutover is queued, not yet verified.

## Deployment state

| Component | State | Evidence / next gate |
|---|---|---|
| Public website | Last published build: v1 | v2 publication and public browser checks await GitHub Actions; the backup branch remains at `a823c530c4fdf065638cb4c73d55095776e75389` |
| v2 source | Verified release merged into `main` | PR #2 merged as `de6caa91d5aabfae5c535f4b81ac715b3848a946`; history continues from v1 |
| AI service | Live on Render Free | [AI health endpoint](https://eventboard-ai.onrender.com/health); deployment `dep-dbanundg1s2s73crav8g` completed October 19 |
| API service | Live on Render Free | [API health endpoint](https://eventboard-api-orv8.onrender.com/api/health); deployment `dep-dbanv0bbc2fs73c49jtg` completed October 19 |
| Neon Free | Provisioned and seeded | `eventboard-v2`, PostgreSQL 16, Frankfurt; migrations completed and row counts independently verified |
| GitHub Pages v2 | Tested; automatic publication queued | Owner confirmed the source change to GitHub Actions; configuration recheck and main CI await runners during a GitHub incident |
| Portfolio | Current public site retained | v2 text, stack and screenshot update prepared on `release/eventboard-v2-portfolio`; publish after the public demo works |

Both services are in **My Workspace**, Frankfurt, on the **Free Docker** plan, running commit `0a95ef3767c1c7d95105d5d58d237570a0f98253`. Auto-deploy is disabled during staging. API startup applied `001_init.sql` and populated the synthetic dataset. A direct read from Neon on October 19 confirmed 30 events, 138 users, 278 bookings and 106 reviews before hosted browser verification. Counts can change as demo visitors and tests use the app.

The Neon project is `rapid-king-63350061`, production branch `br-blue-math-b9qtx54w`, database `eventboard`, in the account's verified Free organization. The API uses the direct connection with certificate verification. Database credentials, JWT secret and the shared AI token are stored in service environments, not in Git. No paid LLM key was configured.

## Verification evidence

[Release CI run 39154465651](https://github.com/youmnaeidh/EventBoard/actions/runs/39154465651) **passed all jobs** on commit `0a95ef3767c1c7d95105d5d58d237570a0f98253`:

| Check | Result |
|---|---|
| API tests against PostgreSQL 16 | 35 passed |
| Python AI tests | 27 passed |
| Web unit tests | 5 passed |
| Core browser journeys | 17 passed |
| Pages and cross-origin browser journeys | 5 passed |
| Total | **89 passed** |
| Web/API production build | Passed |
| Pages production build | Passed |
| Local dependency audit on October 18 | 0 vulnerabilities |

CI runs PostgreSQL and the actual Python service. Hosted integration is checked separately by [Verify hosted v2 before cutover](https://github.com/youmnaeidh/EventBoard/actions/workflows/verify-hosted.yml): Playwright serves the built frontend at the intended Pages browser origin inside the test while requests go to the real Render API, AI service and Neon database. This verifies CORS and browser authentication before changing the public v1 site. After publication, the deployment workflow repeats the browser tests against the actual public website without frontend interception.

**Hosted verification passed on October 19:** [run 39211414937](https://github.com/youmnaeidh/EventBoard/actions/runs/39211414937), commit `d296ba15aed3d6e2c4b10f454befa406979e3465`, **5/5 tests in 17.4 seconds**. Both health endpoints returned `status: ok`; AI reported `llm: false`, `dense: false`. Registration, bearer login/reload/logout, persisted favourites, booking/ticket/cancellation, organizer dashboard and actual API-to-AI forecasting passed against Render and Neon. Desktop and mobile widths of 390px and 320px passed. Earlier hosted failures were test synchronization races: logout needed to finish before checking token removal, and the optimistic favourite toggle needed its server save to finish before reload; both checks now wait for completion.

[Pages configuration run 39211137081](https://github.com/youmnaeidh/EventBoard/actions/runs/39211137081) reported `Pages source: legacy`. The publication job was correctly skipped on the release branch. The owner subsequently confirmed switching the source to GitHub Actions at 19:08 Asia/Riyadh. Attempt 2 of that read-only configuration job remains queued, so its independent confirmation is pending.

The browser suites cover registration/login/logout, favourites, booking persistence and cancellation, QR ticket, search, organizer create/edit/delete, forecasts and responsive layouts. The Pages suite additionally exercises bearer authentication without third-party cookies, hash-route refreshes, images/video/fonts, mobile navigation and focus handling at 390px and 320px widths.

The hosted verification workflow saves its successful Desktop/Mobile screenshots in [`docs/screenshots`](screenshots). These show the built Pages frontend with the hosted services; they are not evidence of a completed public cutover.

Earlier failures were corrected before the passing run: cancellation tests now choose an upcoming event; the organizer edit form waits for existing data; mobile anchors preserve hash routes; preview uses the GitHub Pages base mode; and Vite peer dependencies are aligned across workspaces.

## Release commits

| Commit | Change |
|---|---|
| `1c811d6` | Import the full approved v2 ZIP while retaining Git history |
| `91e4f15` | Run CI on the release branch before public cutover |
| `de91b24` | Use GET readiness probes for FastAPI |
| `bf75c3d` | Add five Pages/cross-origin/browser checks |
| `a0c0455` | Match cancellation UI and tests to the event start policy |
| `458c91d` | Verify PostgreSQL TLS certificates; exclude secrets from Docker contexts |
| `975b722` | Preserve hash routes for anchors; avoid organizer form load races |
| `2630acf` | Patch router and build/test dependencies |
| `9e5b5a1` | Run the Pages preview with its production base mode |
| `0a95ef3` | Deduplicate Vite peer dependencies across the monorepo |
| `afbcef5` | Verify the built Pages frontend against live Render and Neon before cutover |
| `ef05993` | Wait for logout completion; prepare CI-gated Pages deployment and public browser checks |
| `d296ba1` | Wait for the favourite save before testing persistence after reload |
| `e27dbdb` | Save actual hosted Desktop/Mobile screenshots after all five browser checks passed |
| `b8408a8` | Document verified free deployments and release gates |
| `de6caa9` | Merge the verified v2 release into `main`, preserving history |

This documentation commit adds the verified test evidence, screenshots, deployment status and revised English/Arabic README.

## v1 preservation

The backup branch preserves the original `main` commit from before v2. A separate complete-history Git bundle named `EventBoard-v1-history.bundle` was created, verified with `git bundle verify`, and saved as a private archive for the owner.

- Size: 8,277,014 bytes.
- SHA-256: `bb96eba25cee2ca020fd01d5534c912eadc295a963b4b95b3e9c2c79a5c5c26e`.
- The archive contains the backup ref and its complete reachable history.

Archiving does not remove history from the public repository. Preserving v1 as an ancestor means its code remains publicly retrievable after v2 is merged. A private copy would not make existing public commits, forks or cached copies private. No history rewrite or deletion has been performed.

## Remaining release gates

1. Allow [main CI 39283205856](https://github.com/youmnaeidh/EventBoard/actions/runs/39283205856) to run after GitHub recovers. GitHub reported an Actions, Pages and Webhooks incident beginning October 19 at 15:49 UTC (18:49 Asia/Riyadh), with delayed workflows and site builds: [official status](https://www.githubstatus.com/).
2. Successful CI automatically triggers Pages publication, including a source-setting check, hosted integration checks and post-deployment tests on the real public URL. The new frontend has not yet been confirmed publicly deployed.
3. Merge [portfolio PR #1](https://github.com/youmnaeidh/portfolio/pull/1) only after those public-site checks pass, then verify the portfolio's live EventBoard link and screenshot.

## Free-tier and data limits

- All seeded activity and forecast training data are synthetic. Tickets are demo records, not real bookings; model metrics do not establish real-world predictive accuracy.
- [Render Free](https://render.com/docs/free) services sleep after inactivity. API and AI share the workspace's monthly free instance hours, so they cannot both remain running continuously for a full month within that allowance. No keep-alive automation is configured.
- [Neon Free](https://neon.com/docs/introduction/plans) has resource quotas. This project intentionally does not use Render's expiring free PostgreSQL product.
- No paid service, private-network AI endpoint, persistent Render disk or paid LLM is required by this architecture.
