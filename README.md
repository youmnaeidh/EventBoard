# EventBoard v2

[العربية](README.ar.md) · [AI model card](docs/ai.md) · [Visual system](docs/design.md)

**Madinah's events in one place — nearest to you, most popular, bookable, reviewed — with AI-assisted discovery and organizer analytics.**

> v2 is an independent portfolio upgrade of my 2023 Taibah University graduation project
> (the original was a static front-end). Same identity (logo, colours, Madinah video, Arabic-first
> experience); everything underneath was rebuilt as a full-stack, data-driven product.

Live demo (after verified cutover): https://youmnaeidh.github.io/EventBoard/ · Demo accounts: `demo@eventboard.demo` (attendee) and `organizer@eventboard.demo` (organizer), password `Demo#2026`.

---

## Why this project exists

I once spent days looking for a pottery workshop in Madinah and found out a studio nearby had run one — the day before. Events start and end
without reaching the people who'd have loved them, and organizers can't see what people are asking for. EventBoard connects both sides:
attendees find the right event quickly; organizers see demand *before* they plan.

## What changed from v1 to v2

| | v1 (2023 / 2026 portfolio edition) | **v2** |
|---|---|---|
| Architecture | Static HTML/CSS/JS, browser storage, CSV | React + TypeScript SPA · Node/Express API · PostgreSQL · Python AI service |
| Data | Synthetic CSV, per-browser | Real relational model, transactions, migrations, seed + refresh |
| Accounts & booking | None | Cookie/short-lived bearer sessions, roles, bookings with seat locking (no overselling), tickets with QR, reviews tied to attendance |
| Search | Keyword filters | Arabic natural-language search ("ابغى شي عائلي الليلة") that shows what it understood |
| Recommendations | Rule-based | Hybrid (content + collaborative + popularity + proximity + freshness) that **explains each recommendation** |
| Organizer tools | Report on local clicks | Attendance **forecast with a confidence interval**, best-slot advice, demand-gap analysis, per-event funnel |
| Quality | Manual | 33 API tests (real Postgres) · 27 AI tests · 5 web unit tests · 17 Playwright journeys · CI |

## Features

**For visitors** — events happening tonight/this weekend; nearest-first using GPS or a district (kept in the browser only); popularity ranking from the last
14 days of behaviour; map view; filters (category, district, price, booking); favourites; share; booking with seat stepper and QR ticket; verified reviews;
an events assistant that only answers from events that exist.

**For organizers** — create/edit events with a **live forecast panel** (expected registrations, 80% range, what drives the number, three best slots you can try
with one click); per-event analytics (funnel, daily views, sources, ratings); a **demand-gap report** (what people searched for and couldn't find — e.g. pottery).

**AI & data** — see [docs/ai.md](docs/ai.md) for algorithms, evaluation numbers and limits.

## Architecture

```mermaid
flowchart LR
  Browser["React SPA<br/>(Vite, RTL, Leaflet)"] -- "Cross-origin API / bearer token" --> API["Express API<br/>TypeScript, zod, pg"]
  API -- SQL --> PG[("PostgreSQL 16")]
  API -- "Bearer token · circuit breaker · fallbacks" --> AI["FastAPI AI service<br/>search · recommend · forecast · demand · assistant"]
  AI -. optional .-> LLM["Claude API<br/>(assistant wording only)"]
```

- The API owns all data and authentication. The AI service is **stateless**: it receives the events/behaviour it needs in each request and returns
  scores, reasons and forecasts. Users are re-indexed before the interaction matrix leaves the API; no personal data is sent.
- **If the AI service is down** the API keeps working: search falls back to keyword matching, recommendations to interests + popularity, insights to simple
  grouping; the assistant and forecast report "unavailable" instead of failing the page.
- The Render API can also serve a built web app in Docker-only mode, but the public v2 demo uses GitHub Pages + CORS restricted to the GitHub Pages origin with short-lived bearer authentication.

Stack: React 18, TypeScript, Vite, TanStack Query, React Router, Leaflet · Node 22, Express 4, zod, `pg` (parameterised SQL), bcrypt, helmet, rate limiting ·
PostgreSQL 16 · Python 3.12, FastAPI, scikit-learn, NumPy/SciPy/pandas.

## Run it

**Docker (everything):**
```bash
docker compose up --build        # http://localhost:4000  (seeds sample data on first start)
```

**Local development:**
```bash
cp .env.example .env             # then edit: DATABASE_URL, JWT_SECRET, AI_SERVICE_TOKEN
npm install
npm run migrate && npm run seed  # or just start the API: it migrates and seeds an empty database
npm run dev:api                  # http://localhost:4000
npm run dev:web                  # http://localhost:5173 (proxies /api)

cd services/ai && pip install -r requirements.txt
AI_SERVICE_TOKEN=<same as the API> python -m uvicorn app.main:app --port 8001
```
The site works without the AI service (reduced features). `ANTHROPIC_API_KEY` is optional and only changes how the assistant phrases answers.

## Tests

```bash
npm test                                  # API (needs Postgres: TEST_DATABASE_URL) + web unit tests
(cd services/ai && python -m pytest -q)   # AI service
npm run build && npm run test:e2e         # Playwright, against a running stack (see playwright.config.ts)
```
Highlights: six concurrent bookings on a 3-seat event never oversell; the API↔AI contract is tested against a stub server (including token and
circuit-breaker behaviour); e2e covers search → book → ticket → cancel, reviews, favourites, organizer create/edit/delete with the live forecast, and
overflow checks on mobile.

## Deploy

`Dockerfile` (web + API), `services/ai/Dockerfile`, `docker-compose.yml`, `render.yaml` and `.github/workflows/ci.yml` are included. Set `JWT_SECRET`,
`AI_SERVICE_TOKEN` and `DATABASE_URL` (+ `DATABASE_SSL=true` on managed Postgres). Set `AUTO_SEED=false` for a real deployment. Use [`DEPLOYMENT.md`](DEPLOYMENT.md) to deploy the free-tier architecture: GitHub Pages (static website), Render Free (API + AI), and external Neon Free PostgreSQL. Use Neon's **direct/non-pooled** connection string due to session-level locks in startup migrations.

## Security & privacy notes

- Passwords hashed with bcrypt; JWT in an `httpOnly`, `SameSite=Lax` cookie for same-origin development, or an 8-hour access token held in `sessionStorage` for the cross-origin public demo; login/register rate-limited; identical error for wrong email or password.
- All SQL parameterised; every input validated with zod; Arabic error messages; strict CSP via helmet; reviews limited to events that started; organizers can only touch their own events.
- Behaviour tracking is limited to an anonymous random visitor id stored in the browser, used to personalise recommendations. Location is optional, rounded to ~100 m and kept in `sessionStorage`; it is sent only as query parameters on read requests.

## Known limits (said plainly)

- **All activity data is synthetic** (30 sample events, ~140 users, ~8k interactions, an 800-row forecast training set). Metrics in `docs/ai.md` describe the pipeline on that data, not real-world accuracy.
- The forecast's seasonal/weekday effects are assumptions I encoded when generating training data; swap in real bookings to retrain (`ForecastModel.fit`).
- The Claude-backed assistant path and the optional dense-embedding search are implemented and unit-tested with mocks, but were not exercised with a live API key / model weights during development.
- No offline evaluation of the recommender yet (needs real interaction data to be meaningful).
- Deployment files were written but not executed in my build environment; the production build was started with production-only dependencies as a check.
- Map tiles come from OpenStreetMap at runtime.

## Repository layout

```
apps/api        Express + TypeScript API, SQL migrations, seed data, tests
apps/web        React SPA (pages, components, hand-written SVG charts), unit tests
services/ai     FastAPI service: Arabic NLP, search, recommender, forecast, demand gaps, assistant, tests
e2e             Playwright journeys
docs            AI model card & talking points
```

## Credits

Original EventBoard concept, identity and 2023 content: Taibah University graduation project (team project; I led the team). Madinah video, logo and
event artwork are from the original project. v2 design, architecture, code and data work: Yomna Eid.


## Hosting on the original GitHub Pages URL

The v2 **static frontend** is built for `https://youmnaeidh.github.io/EventBoard/` and deployed with the opt-in `.github/workflows/deploy-pages.yml` workflow; the backend and AI run on Render Free, with Neon Free PostgreSQL. See [DEPLOYMENT.md](DEPLOYMENT.md). Do not trigger cutover until the backend and full demo are verified.
