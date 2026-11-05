# Atlas Architecture

This document describes the code and behavior currently present in the repository. The README describes the broader product vision and roadmap; it should not be read as proof that every planned feature is implemented. Update this document as the implementation changes.

## Product and current scope

Atlas is intended to connect university coursework with independent learning and a personal knowledge space. The implemented application is an early, single-page workspace with bearer-token authentication and a FastAPI/PostgreSQL backend.

The current working slice includes:

- Account registration, login, and sign-out.
- A subject list with create, edit, and delete actions for subject name, course code, description, and optional term/semester metadata; subjects can be filtered by term in Academics.
- An Academics workspace for a subject: nested topics and concepts, manual and PDF syllabus construction, named syllabus snapshots, concept self-assessments, review history, suggested next-review dates, exam-aware revision suggestions, and exam management.
- An Overview with subject/concept summaries, continue-learning shortcuts, recent review activity, upcoming exams, and a calendar with monthly and weekly navigation. Date notes and exams remain separate records.
- Daily and random quotations from an external API Ninjas provider. Successful quotes are cached in-process and a stale cached quote can be served during provider outages; the API key remains optional.
- A dark celestial visual treatment and a reduced-motion-aware animated background.

Explore and My Universe are navigation destinations with placeholder content. Syllabus PDFs can be uploaded, parsed into an editable draft, and explicitly confirmed into the subject's topic/concept tree. There is no OCR for scanned PDFs, personal knowledge repository, adaptive revision scheduler, AI gateway, or data export yet. The current revision feature is a transparent 1/3/7/14-day heuristic based on the student's self-assessment.

## System shape

```text
Browser (Next.js / React / TypeScript)
  ├─ localStorage bearer token
  └─ frontend/lib/api.ts ── HTTP /api/v1 ── FastAPI
                                              ├─ auth and ownership checks
                                              ├─ SQLAlchemy models and sessions
                                              └─ PostgreSQL
                                                   ├─ users, subjects, day_notes
                                                   └─ topics (with optional source page refs), concepts (with optional source page refs), progress, exams

FastAPI ── cached API Ninjas provider adapter ── quotation endpoints
Docker Compose ── local PostgreSQL service
```

### Frontend

The App Router entry is `frontend/app/page.tsx`. It handles authentication state, navigation, subject loading, the Overview shell, and top-level errors. It composes the Academics and calendar components rather than implementing their detailed interactions inline.

`frontend/lib/api.ts` is the shared JSON request helper. It reads the bearer token from browser local storage, adds it to requests, disables fetch caching, and turns non-success responses into errors. The API base URL comes from `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000/api/v1`. The Academics UI includes term filtering, named syllabus snapshots, concept review history, and exam-aware revision suggestions.

The API is called directly from client components. The browser does not connect to PostgreSQL. The Overview requests a user-scoped aggregate endpoint; it renders only actual concept progress, recorded reviews, and upcoming exams. It does not calculate a grade prediction or invent a readiness percentage.

### Backend

`backend/app/main.py` creates the FastAPI application, configures CORS, mounts the routers under `/api/v1`, and optionally creates missing tables at startup in local development. Production configuration disables this fallback and requires Alembic migrations. The health check is `/health`.

Each protected route obtains the current user through `backend/app/security.py`. Subject, topic, concept, progress, exam, and calendar operations are scoped to that user directly or through ownership checks. SQLAlchemy sessions are supplied through `backend/app/db.py`.

### Persistence and schema

The database URL is supplied by settings and targets PostgreSQL by default. `docker-compose.yml` runs a local PostgreSQL 16 container with a persistent named volume. Alembic revision `0002_source_pages` adds nullable JSON page-reference columns to topics and concepts. Revision `0003_academic_planning` adds optional subject term metadata, next-review timestamps, syllabus snapshot storage, and concept review history. CI validates the migration chain on SQLite and PostgreSQL.

Existing models use integer primary keys. `Base.metadata.create_all()` remains available only as a local-development convenience; it creates missing tables but does not manage schema changes. Production settings require a strong non-default JWT secret, explicit CORS origins, and `CREATE_TABLES_ON_STARTUP=false`, so production must use Alembic. Alembic is configured with an initial baseline and subsequent versioned migrations. The full migration chain and 21 API tests passed in [run #41983287215](https://github.com/NJWasTaken/atlas/actions/runs/41983287215). Production no longer runs `create_all()`; local development retains it until every existing environment has been safely adopted. Do not remove the development fallback until each database has been stamped/upgraded and verified.

For a fresh database, run `cd backend && python -m alembic upgrade head` before starting the API. For an existing database created by the old `create_all()` flow, first take and verify a restorable backup. From `backend/`, run `python -m scripts.adopt_existing_database` for a dry-run schema check. The helper checks required baseline tables/columns and detects whether source-page and academic-planning migrations are already reflected in the schema. Only after reviewing the detected revision and confirming the backup, run `python -m scripts.adopt_existing_database --backup-verified --apply`, then `python -m alembic upgrade head`. The helper only stamps; it never mutates application tables. It deliberately aborts on partial/unknown schemas or an existing `alembic_version` table. The structural preflight is not a substitute for reviewing database types, indexes, constraints, and a backup. **Do not run `upgrade head` against an existing un-stamped database**: the initial migration creates the tables and is not an in-place schema repair.

The current entities are:

| Entity | Purpose |
|---|---|
| `User` | Account email, password hash, and owned subjects |
| `Subject` | A user's subject name, optional code/description, and optional term label |
| `SyllabusVersion` | Named, immutable JSON snapshot of a subject's topic/concept structure |
| `ConceptReview` | Historical self-assessment record and its suggested next-review timestamp |
| `DayNote` | One note per user and calendar date |
| `Topic` | Subject syllabus node with optional parent topic |
| `Concept` | Learning item belonging to a topic |
| `ConceptProgress` | Per-user exposure, understanding, recall, confidence, notes, last-reviewed and next-review timestamps |
| `Exam` | User-owned exam associated with a subject and a date/time |

`backend/app/academics_models.py` defines topic, concept, progress, and exam tables. Topics and concepts include optional JSON source-page references for imported syllabus material; `backend/app/models.py` defines users, subjects, and day notes. Foreign keys and ORM cascades connect the records. Progress is unique per user/concept, and confidence is constrained to 1–5 when supplied.

Concept-progress updates use partial PATCH semantics: only fields explicitly supplied by the client are changed. Omitted exposure, understanding, recall, confidence, and notes values are preserved rather than reset to schema defaults.

### API surface currently mounted

| Router | Current routes |
|---|---|
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Overview | `GET /overview` |
| Calendar notes | `GET /calendar?start=…&end=…`, `PUT /calendar/{day}`, `DELETE /calendar/{day}` |
| Quotes | `GET /quotes/daily`, `GET /quotes/random` |
| Academics | Subject topic listing/creation; topic update/deletion; subject concept listing; concept creation/update/deletion; syllabus PDF draft/confirm; syllabus version list/create/read; progress get/update; concept review history; exam-aware subject readiness; exam list/create/update/delete |
| Subjects | `GET /subjects?term=…`, `POST /subjects`, `PATCH /subjects/{subject_id}`, `DELETE /subjects/{subject_id}` |

All API routes are mounted under `/api/v1` except `/health`. The calendar range is limited to 63 days. Quote endpoints require authentication. If the provider is unavailable, the backend serves the last successful cached quote when one exists; an initial fetch still requires the API Ninjas key.

Subject updates use a partial PATCH contract with user ownership checks. The subject modal supports editing name, course code, description, and term. The Academics subject picker can filter by term. The Academics workspace supports manual chapter/subchapter creation, contextual concept creation within a chapter, inline renaming, and PDF import as an alternative. The manual builder and importer are separate entry points; both persist through the existing topic/concept APIs. Topic and concept edits use partial PATCH requests, preserving fields not included in the request. Concept confidence uses a five-step themed choice control rather than the browser-native range slider, with reduced-motion-aware transitions and visible keyboard focus.

## Main user flows

### Sign-in and subjects

The root page restores a token from local storage, shows registration/login when unauthenticated, and loads the user's subjects after authentication. Creating, editing, and deleting subjects updates the overview and Academics workspace.

### Academics

`AcademicsWorkspace.tsx` loads the selected subject's topics, concepts, readiness summary, and exams. Topic nesting is represented by `parent_topic_id`. Topics and concepts can be renamed inline; edits are saved through ownership-checked PATCH endpoints. Concept progress is stored per user. Each progress save appends a review-history record and calculates a suggested next review: 1 day for weak/needs-practice, 3 days for developing or low confidence, 14 days for strong + comfortable recall + confidence 4–5, and 7 days otherwise. This is a transparent first scheduling heuristic, not an adaptive learning model. Readiness suggestions include concept/topic names, the reason for review, and proximity to the next exam; the dashboard does not convert these into a predicted grade. Exam changes use the same persistent exam endpoints used by the Overview calendar. Users can explicitly save named syllabus snapshots and inspect their captured topic/concept counts; snapshots are historical copies and are not automatically restored into the live syllabus.

The syllabus importer accepts PDF uploads up to 12 MB and 100 pages, extracts selectable text with `pypdf`, and uses conservative heading/bullet heuristics to suggest top-level chapters and concepts. The API returns an ephemeral draft with warnings and page references; the upload itself is not stored. The user can rename/remove/add chapters and concepts in the review UI. A separate manual builder supports creating chapters and nested chapters from scratch, while each expanded chapter has its own contextual add-concept form. Only the separate confirm endpoint persists the reviewed structure. Confirmed page references are stored as nullable JSON arrays on topics and concepts and shown in the syllabus tree. Scanned/image-only PDFs are rejected with a clear OCR-not-supported message; OCR and complex multi-column layouts remain future work. Import appends to the existing syllabus rather than replacing it.

### Overview calendar

`DashboardCalendar.tsx` requests day notes for the visible month grid (42 days) or week grid (7 days) and loads the user's exam list. Notes and exams remain separate data: notes are edited through `/calendar/{day}`, while exams are changed through `/exams/{exam_id}`. Exam markers are derived from exam dates; selecting a day displays its exam details and allows editing or deletion. Calendar sync errors have a local retry action and do not block the rest of Overview.

### Quotations and visual layer

Daily/random quote requests are proxied by a backend provider adapter to API Ninjas, keeping the provider key out of the browser. Successful daily quotes are cached for six hours and random quotes for one minute in-process; a stale successful quote is used as a graceful fallback if the provider becomes unavailable. The quote card also has a local, un-attributed fallback message, and quote failures do not prevent Overview data from loading. The global celestial background is rendered by `CelestialBackground.tsx`; the separate `QuoteRipple.tsx` component exists but is not part of the current page composition.

## Configuration and local development

- Copy `.env.example` to `.env` and set local values. `.env` is intentionally ignored and must not be committed.
- Start PostgreSQL with `docker compose up -d db`.
- Install backend dependencies from `backend/requirements.txt`, then run the FastAPI app from the backend directory with Uvicorn.
- Install frontend dependencies from `frontend/package-lock.json` / `frontend/package.json`, then use the frontend development or build scripts.
- Configure `NEXT_PUBLIC_API_URL` for the frontend and backend settings such as `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, and `X_API_KEY` as appropriate.

The README's [Running Locally](../README.md#running-locally) section is the detailed setup guide.

## Automated tests

The backend suite lives in `backend/tests/`. API tests use an isolated in-memory SQLite database; the PostgreSQL integration test uses `ATLAS_TEST_DATABASE_URL` and is skipped when that variable is absent. It exercises JSON persistence and timezone-aware review timestamps against a real PostgreSQL service. Migration-adoption detection is tested against legacy, source-page, current, and partial schemas.

From the repository root:

```bash
cd backend
pip install -r requirements.txt
python -m pytest
```

The current branch adds 36 backend tests in total: 35 SQLite/API/unit tests plus one PostgreSQL-only integration test. The backend workflow validates migration upgrade/check/downgrade on SQLite, migration upgrade/check on PostgreSQL, and the full pytest suite against the PostgreSQL service. A fresh result for this branch is pending; the earlier 21-test baseline passed in [GitHub Actions run #41983287215](https://github.com/NJWasTaken/atlas/actions/runs/41983287215).

Frontend browser flows live in `frontend/e2e/`. The Playwright suite mocks the API and covers sign-in, subject and term creation/filtering, manual chapter/concept creation, progress save, weekly calendar navigation, day-note persistence, and exam create/edit/delete across Academics and Overview. The frontend workflow runs `npm ci`, TypeScript checking, a production Next.js build, and Chromium browser tests. A fresh result for this branch is pending; the earlier syllabus-import UI build passed in [GitHub Actions run #41983099966](https://github.com/NJWasTaken/atlas/actions/runs/41983099966).

## File guide

This list covers the tracked project source, documentation, and configuration files. Generated dependencies and build output (`node_modules`, `.next`, Python virtual environments, caches, and bytecode) are deliberately excluded. Next.js may generate an ignored `frontend/next-env.d.ts` locally. `.env` is a local ignored file and is not documented by value.

### Repository root

| File | Responsibility |
|---|---|
| `.env.example` | Names and development examples for database, JWT, frontend API URL, and quote-provider settings. Copy to ignored `.env` and replace unsafe development values for real use. |
| `.gitignore` | Excludes local environment files, dependencies, build output, caches, and other generated/local files. |
| `docker-compose.yml` | Starts the local PostgreSQL service and named data volume. |
| `.github/workflows/backend-tests.yml` | Runs backend pytest tests and validates Alembic upgrade/check/downgrade on development pushes and relevant pull requests. |
| `.github/workflows/frontend-checks.yml` | Runs frontend TypeScript checking, a production Next.js build, and Playwright browser-flow tests. |
| `README.md` | Product vision, requirements, data/API design, roadmap, setup instructions, and representative project structure. |

### `docs/`

| File | Responsibility |
|---|---|
| `ARCHITECTURE.md` | Current implementation and file guide; this document. |
| `MODULE_A_IMPLEMENTATION.md` | Notes for the first Academics backend slice, including endpoints, schema compatibility, and suggested next steps. Some next-slice bullets predate the current UI; use this architecture and `TODO.md` for current status. |
| `TODO.md` | Ordered implementation backlog derived from the README and checked against the code currently present. |
| `pytest.ini` | Backend pytest import path and test discovery configuration. |
| `tests/conftest.py` | Isolated in-memory database fixture and authenticated API test helpers. |
| `tests/test_api.py` | Backend API regression tests for authentication, ownership, academics, calendar, exams, and Overview. |
| `tests/test_migration_adoption.py` | Tests safe Alembic revision detection for legacy and partially migrated schemas. |
| `tests/test_postgres_integration.py` | PostgreSQL-backed persistence and timezone integration test. |
| `tests/test_quotes.py` | Quote cache and provider-outage fallback tests. |

### `backend/`

| File | Responsibility |
|---|---|
| `requirements.txt` | Pinned Python runtime dependencies for FastAPI, SQLAlchemy, PostgreSQL, configuration, JWT, password hashing, pytest/HTTP testing, and Alembic. |
| `alembic.ini` | Alembic configuration; the database URL is read from backend settings/environment. |
| `app/__init__.py` | Marks `app` as a Python package. |
| `app/main.py` | Builds the FastAPI application, configures CORS, gates local-only table creation, mounts routers, and exposes the health endpoint. |
| `app/db.py` | SQLAlchemy base, engine, session factory, and request-scoped database dependency. |
| `migrations/env.py` | Connects Alembic to application settings and SQLAlchemy model metadata. |
| `migrations/versions/0001_initial_schema.py` | Initial schema baseline for users, subjects, day notes, topics, concepts, progress, and exams. |
| `migrations/versions/0002_source_pages.py` | Adds nullable JSON page-reference columns to topics and concepts. |
| `migrations/versions/0003_academic_planning.py` | Adds subject terms, review scheduling, syllabus snapshots, and concept review history. |
| `scripts/adopt_existing_database.py` | Dry-run/guarded revision detection and Alembic stamping for verified existing databases. |
| `migrations/script.py.mako` | Template for future versioned schema revisions. |
| `app/models.py` | Core `User`, `Subject`, and `DayNote` ORM models. |
| `app/academics_models.py` | `Topic`, `Concept`, `ConceptProgress`, and `Exam` ORM models and relationships, including imported source-page references. |
| `app/syllabus_import.py` | Bounded PDF text extraction, conservative heading detection, warnings, and page-reference capture. |
| `app/schemas.py` | Pydantic request/response types for authentication, quotes, subjects, and calendar notes. |
| `app/academics_schemas.py` | Pydantic validation and response types for topics, concepts, progress, and exams. |
| `app/security.py` | Password hashing/verification, JWT creation, and bearer-token current-user dependency. |
| `app/core/__init__.py` | Marks the core configuration directory as a Python package. |
| `app/core/config.py` | Reads backend settings from environment and `.env`; validates production JWT, CORS, and schema-creation settings. |
| `app/routers/__init__.py` | Marks the router directory as a Python package. |
| `app/routers/auth.py` | Registration, login, and authenticated current-user endpoint. |
| `app/routers/subjects.py` | Authenticated subject listing/filtering, creation, editing, and deletion. |
| `app/routers/calendar.py` | Authenticated date-note list, upsert, and delete endpoints, including range validation. |
| `app/routers/quotes.py` | Authenticated daily/random quote endpoints, API Ninjas provider adapter, process-local cache, and stale fallback. |
| `app/routers/academics.py` | Ownership-checked topic/concept/progress/review-history/readiness/exam operations, syllabus draft/confirm/version endpoints, and Overview aggregation. |

### `frontend/`

| File | Responsibility |
|---|---|
| `package.json` | Frontend dependencies and development/build/start/lint scripts. |
| `package-lock.json` | Locked frontend dependency tree for reproducible installs. |
| `next.config.mjs` | Next.js configuration; currently uses the framework defaults. |
| `tsconfig.json` | Strict TypeScript compiler and Next.js project settings. |
| `postcss.config.mjs` | PostCSS plugin configuration for Tailwind CSS and Autoprefixer. |
| `tailwind.config.ts` | Tailwind content paths and Atlas color, font, and shadow tokens. |
| `academics-readable.css` | Readability-oriented type sizes, semantic colors, and responsive adjustments. |
| `academics-workspace.css` | Styling for the Academics subject workspace, syllabus, progress, readiness, and exam controls. |
| `atlas-calendar-styles.css` | Calendar, day-note editor, and exam marker/detail/edit/delete styling; also contains quote transition styles. |
| `app/globals.css` | Global application theme, layout, navigation, authentication, and shared component styling. |
| `app/layout.tsx` | Root App Router layout; imports global styles, sets metadata, and mounts the celestial background. |
| `app/page.tsx` | Main client page: auth state/forms, navigation, overview, subject operations, quote loading, and module composition. |
| `app/components/AcademicsWorkspace.tsx` | Subject-level topics/concepts/progress/readiness UI and exam create/edit/delete controls. |
| `app/components/DashboardCalendar.tsx` | Monthly Overview calendar, date-note editing, and display/edit/delete of exams on selected dates. |
| `app/components/CelestialBackground.tsx` | Three.js/React Three Fiber animated star-map background with reduced-motion support. |
| `app/components/QuoteRipple.tsx` | Reusable Three.js ripple effect component; currently not mounted by the page. |
| `lib/api.ts` | Shared frontend HTTP helper and local-storage token access. |

## Known architectural boundaries

- The application is a prototype, not yet a production deployment architecture.
- Authentication tokens are stored in browser local storage; refresh/revocation flows are not implemented.
- Startup `create_all()` is not a substitute for versioned database migrations. Alembic baseline scaffolding is present and CI-validated, but startup still uses `create_all()` pending a safe existing-database adoption plan.
- A pytest-based backend API suite and GitHub Actions workflow now exist, and the expanded 15-test suite has passed in CI. Frontend TypeScript/build CI is configured; automated frontend interaction tests and PostgreSQL-backed integration tests are still outstanding.
- The Overview calendar currently provides a monthly grid and date notes; it is not a full event-planning system or weekly calendar.
- Explore, My Universe, syllabus document ingestion, AI integrations, and data export remain future work.
