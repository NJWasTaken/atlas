# Atlas Architecture

This document describes the code and behavior currently present in the repository. The README describes the broader product vision and roadmap; it should not be read as proof that every planned feature is implemented. Update this document as the implementation changes.

## Product and current scope

Atlas is intended to connect university coursework with independent learning and a personal knowledge space. The implemented application is an early, single-page workspace with bearer-token authentication and a FastAPI/PostgreSQL backend.

The current working slice includes:

- Account registration, login, and sign-out.
- A subject list with create, edit, and delete actions for subject name, course code, description, optional term, and academic year; the Overview can filter subjects by term.
- An Academics workspace for a subject: nested topics and concepts with inline renaming, concept self-assessments, readiness counts, and exam management.
- An Overview calendar with monthly and weekly navigation, editable date notes, and exams shown on their dates. Exams can be edited or deleted from either the Academics workspace or the Overview calendar. Calendar notes remain personal date notes; exams remain academic events.
- Daily and random quotations from API Ninjas when configured, with a curated fallback and one-hour in-process cache for successful daily quotes so provider outages do not block the Overview.
- A dark celestial visual treatment and a reduced-motion-aware animated background.

Explore and My Universe are navigation destinations with placeholder content. Syllabus PDFs can be uploaded, parsed into an editable draft, and explicitly confirmed into the subject's topic/concept tree. There is no OCR for scanned PDFs, personal knowledge repository, revision scheduler, AI gateway, or data export yet.

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

FastAPI ── optional API Ninjas request ── quotation endpoints
Docker Compose ── local PostgreSQL service
```

### Frontend

The App Router entry is `frontend/app/page.tsx`. It handles authentication state, navigation, subject loading, the Overview shell, and top-level errors. It composes the Academics and calendar components rather than implementing their detailed interactions inline.

`frontend/lib/api.ts` is the shared JSON request helper. It reads the bearer token from browser local storage, adds it to requests, disables fetch caching, and turns non-success responses into errors. The API base URL comes from `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000/api/v1`.

The API is called directly from client components. The browser does not connect to PostgreSQL. The Overview calls `/api/v1/overview` for recent concept check-ins, continue-learning shortcuts, explainable revision candidates, and upcoming exams. Subject term filtering is client-side over the authenticated subject list.

### Backend

`backend/app/main.py` creates the FastAPI application, configures CORS from explicit allowed origins, and mounts the routers under `/api/v1`. In development it retains the `create_all()` startup convenience; production startup does not create tables and expects Alembic migrations to be applied before launch. The health check is `/health`.

Each protected route obtains the current user through `backend/app/security.py`. Subject, topic, concept, progress, exam, and calendar operations are scoped to that user directly or through ownership checks. SQLAlchemy sessions are supplied through `backend/app/db.py`.

### Persistence and schema

The database URL is supplied by settings and targets PostgreSQL by default. `docker-compose.yml` runs a local PostgreSQL 16 container with a persistent named volume. Alembic revision `0002_source_pages` adds nullable JSON page-reference columns to topics and concepts; backend CI validates the full migration chain on SQLite.

Existing models use integer primary keys. `Base.metadata.create_all()` remains enabled at application startup for backward-compatible local development; it creates missing tables but does not manage schema changes. Alembic is now configured with an initial baseline migration covering the current seven tables. The backend CI workflow upgrades an empty SQLite database through both revisions, checks the final schema against SQLAlchemy metadata, and downgrades it again. The full migration chain and 21 API tests passed in [run #41983287215](https://github.com/NJWasTaken/atlas/actions/runs/41983287215). Production startup now leaves schema management to Alembic and does not run `create_all()`. Development keeps the old convenience behavior. Existing databases still require verified backup/schema comparison and explicit Alembic stamping/upgrades before production deployment.

For a fresh database, run `cd backend && python -m alembic upgrade head` before starting the API. For a database already created by the old `create_all()` flow, take a verified backup and compare its schema to the baseline first; only then mark it as already at the baseline with `python -m alembic stamp 0001_initial`. **Do not run `upgrade head` against an existing un-stamped database**: the initial migration creates the tables and is not an in-place schema repair.

The current entities are:

| Entity | Purpose |
|---|---|
| `User` | Account email, password hash, and owned subjects |
| `Subject` | A user's subject name, optional code/description, term, and academic year |
| `DayNote` | One note per user and calendar date |
| `Topic` | Subject syllabus node with optional parent topic |
| `Concept` | Learning item belonging to a topic |
| `ConceptProgress` | Per-user exposure, understanding, recall, confidence, notes, and review timestamps |
| `Exam` | User-owned exam associated with a subject and a date/time |

`backend/app/academics_models.py` defines topic, concept, progress, and exam tables. Topics and concepts include optional JSON source-page references for imported syllabus material; `backend/app/models.py` defines users, subjects (including optional term and academic year), and day notes. Foreign keys and ORM cascades connect the records. Progress is unique per user/concept, and confidence is constrained to 1–5 when supplied.

Concept-progress updates use partial PATCH semantics: only fields explicitly supplied by the client are changed. Omitted exposure, understanding, recall, confidence, and notes values are preserved rather than reset to schema defaults.

### API surface currently mounted

| Router | Current routes |
|---|---|
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Subjects | `GET /subjects`, `POST /subjects`, `PATCH /subjects/{subject_id}`, `DELETE /subjects/{subject_id}` |
| Calendar notes | `GET /calendar?start=…&end=…`, `PUT /calendar/{day}`, `DELETE /calendar/{day}` |
| Quotes | `GET /quotes/daily`, `GET /quotes/random` |
| Academics | Subject topic listing/creation; topic update/deletion; subject concept listing; concept creation/update/deletion; syllabus PDF draft extraction and explicit confirmation; progress get/update; subject readiness; exam list/create/update/delete |
| Overview | Authenticated recent concept activity, continue-learning candidates, revision suggestions, and upcoming exams |

All API routes are mounted under `/api/v1` except `/health`. The calendar range is limited to 63 days. Quote endpoints require authentication; API Ninjas is used when configured, otherwise a curated fallback is returned. Successful daily provider responses are cached in-process for one hour.

Subject updates use a partial PATCH contract with user ownership checks. The subject modal supports editing name, course code, and description. The Academics workspace supports manual chapter/subchapter creation, contextual concept creation within a chapter, inline renaming, and PDF import as an alternative. The manual builder and importer are separate entry points; both persist through the existing topic/concept APIs. Topic and concept edits use partial PATCH requests, preserving fields not included in the request. Concept confidence uses a five-step themed choice control rather than the browser-native range slider, with reduced-motion-aware transitions and visible keyboard focus.

## Main user flows

### Sign-in and subjects

The root page restores a token from local storage, shows registration/login when unauthenticated, and loads the user's subjects after authentication. Creating, editing, and deleting subjects updates the overview and Academics workspace.

### Academics

`AcademicsWorkspace.tsx` loads the selected subject's topics, concepts, readiness summary, and exams. Topic nesting is represented by `parent_topic_id`. Topics and concepts can be renamed inline; edits are saved through ownership-checked PATCH endpoints. Concept progress is stored per user. Exam changes use the same persistent exam endpoints used by the Overview calendar.

The syllabus importer accepts PDF uploads up to 12 MB and 100 pages, extracts selectable text with `pypdf`, and uses conservative heading/bullet heuristics to suggest top-level chapters and concepts. The API returns an ephemeral draft with warnings and page references; the upload itself is not stored. The user can rename/remove/add chapters and concepts in the review UI. A separate manual builder supports creating chapters and nested chapters from scratch, while each expanded chapter has its own contextual add-concept form. Only the separate confirm endpoint persists the reviewed structure. Confirmed page references are stored as nullable JSON arrays on topics and concepts and shown in the syllabus tree. Scanned/image-only PDFs are rejected with a clear OCR-not-supported message; OCR, complex multi-column layouts, and version history remain future work. Import appends to the existing syllabus rather than replacing it.

### Overview calendar

`DashboardCalendar.tsx` requests day notes for the visible month grid (42 days) or selected week (7 days), and loads the user's exam list. A retry control re-runs both calendar data requests. Notes and exams remain separate data: notes are personal date notes edited through `/calendar/{day}`, while exams are academic events changed through `/exams/{exam_id}`. Exam markers are derived from exam dates; selecting a day displays its exam details and allows editing or deletion.

### Quotations and visual layer

Daily/random quote requests are proxied by the backend to API Ninjas, keeping the provider key out of the browser. The global celestial background is rendered by `CelestialBackground.tsx`; the separate `QuoteRipple.tsx` component exists but is not part of the current page composition.

## Configuration and local development

- Copy `.env.example` to `.env` and set local values. `.env` is intentionally ignored and must not be committed.
- Start PostgreSQL with `docker compose up -d db`.
- Install backend dependencies from `backend/requirements.txt`, then run the FastAPI app from the backend directory with Uvicorn.
- Install frontend dependencies from `frontend/package-lock.json` / `frontend/package.json`, then use the frontend development or build scripts.
- Configure `NEXT_PUBLIC_API_URL` for the frontend and backend settings such as `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_ORIGIN`, and `X_API_KEY` as appropriate.

The README's [Running Locally](../README.md#running-locally) section is the detailed setup guide.

## Backend tests

The backend test suite lives in `backend/tests/` and uses pytest with FastAPI's `TestClient`. Each test gets an isolated in-memory SQLite database; it does not connect to or modify the configured PostgreSQL development database. The app factory accepts `create_tables=False` so tests can import and exercise the API without running the normal startup table-creation hook.

From the repository root, install the backend dependencies and run:

```bash
cd backend
pip install -r requirements.txt
python -m pytest
```

The 21-test API suite covers authentication, duplicate registration, subject update/ownership/null validation, academic-resource ownership, topic hierarchy validation and updates, concept update/ownership/null validation, syllabus PDF draft/confirm ownership and page-reference persistence, parser heading/page extraction and scanned-PDF rejection, required-field validation, partial concept-progress PATCH behavior, readiness counts, concept deletion, calendar-note CRUD/ownership/range validation, and exam CRUD/ownership/validation. The suite and complete SQLite migration-chain validation passed in [GitHub Actions run #41983287215](https://github.com/NJWasTaken/atlas/actions/runs/41983287215). The 17-test suite passed in [GitHub Actions run #41981043499](https://github.com/NJWasTaken/atlas/actions/runs/41981043499). These tests provide a fast regression layer; PostgreSQL-specific integration behavior and broader remaining CRUD edge cases still need coverage. A GitHub Actions workflow runs this suite on pushes to `main` and `work/**`, and on pull requests targeting `main` when backend files change. It also validates the Alembic baseline by upgrading an empty SQLite database, checking for metadata drift, and downgrading to base. A separate frontend workflow installs the locked npm dependencies, runs TypeScript checking, and builds the production Next.js app on matching frontend changes. The syllabus-import UI passed the frontend checks in [GitHub Actions run #41983099966](https://github.com/NJWasTaken/atlas/actions/runs/41983099966); automated frontend interaction tests have not yet been added. The initial 10-test suite passed in [GitHub Actions run #41979038349](https://github.com/NJWasTaken/atlas/actions/runs/41979038349). The expanded 15-test suite passed in [GitHub Actions run #41979455642](https://github.com/NJWasTaken/atlas/actions/runs/41979455642). PostgreSQL-backed integration coverage remains outstanding.

## File guide

This list covers the tracked project source, documentation, and configuration files. Generated dependencies and build output (`node_modules`, `.next`, Python virtual environments, caches, and bytecode) are deliberately excluded. Next.js may generate an ignored `frontend/next-env.d.ts` locally. `.env` is a local ignored file and is not documented by value.

### Repository root

| File | Responsibility |
|---|---|
| `.env.example` | Names and development examples for database, JWT, frontend API URL, and quote-provider settings. Copy to ignored `.env` and replace unsafe development values for real use. |
| `.gitignore` | Excludes local environment files, dependencies, build output, caches, and other generated/local files. |
| `docker-compose.yml` | Starts the local PostgreSQL service and named data volume. |
| `.github/workflows/backend-tests.yml` | Runs backend pytest tests and validates Alembic upgrade/check/downgrade on development pushes and relevant pull requests. |
| `.github/workflows/frontend-checks.yml` | Runs frontend TypeScript checking and a production Next.js build. |
| `README.md` | Product vision, requirements, data/API design, roadmap, setup instructions, and representative project structure. |

### `docs/`

| File | Responsibility |
|---|---|
| `ARCHITECTURE.md` | Current implementation and file guide; this document. |
| `MODULE_A_IMPLEMENTATION.md` | Notes for the first Academics backend slice, including endpoints, schema compatibility, and suggested next steps. Some next-slice bullets predate the current UI; use this architecture and `TODO.md` for current status. |
| `TODO.md` | Ordered implementation backlog derived from the README and checked against the code currently present. |
| `pytest.ini` | Backend pytest import path and test discovery configuration. |
| `tests/conftest.py` | Isolated in-memory database fixture and authenticated API test helpers. |
| `tests/test_api.py` | Backend API regression tests for authentication, ownership, academics, calendar, exams, quote fallback, and Overview data. |
| `tests/test_postgres_integration.py` | PostgreSQL-specific JSON persistence and constraint integration coverage. |
| `tests/test_config.py` | Production settings validation tests. |

### `backend/`

| File | Responsibility |
|---|---|
| `requirements.txt` | Pinned Python runtime dependencies for FastAPI, SQLAlchemy, PostgreSQL, configuration, JWT, password hashing, pytest/HTTP testing, and Alembic. |
| `alembic.ini` | Alembic configuration; the database URL is read from backend settings/environment. |
| `app/__init__.py` | Marks `app` as a Python package. |
| `app/main.py` | Builds the FastAPI application, configures CORS, defers optional table creation to startup, mounts routers, and exposes the health endpoint. |
| `app/db.py` | SQLAlchemy base, engine, session factory, and request-scoped database dependency. |
| `migrations/env.py` | Connects Alembic to application settings and SQLAlchemy model metadata. |
| `migrations/versions/0001_initial_schema.py` | Initial schema baseline for users, subjects, day notes, topics, concepts, progress, and exams. |
| `migrations/versions/0002_source_pages.py` | Adds nullable JSON page-reference columns to topics and concepts. |
| `migrations/script.py.mako` | Template for future versioned schema revisions. |
| `app/models.py` | Core `User`, `Subject`, and `DayNote` ORM models. |
| `app/academics_models.py` | `Topic`, `Concept`, `ConceptProgress`, and `Exam` ORM models and relationships, including imported source-page references. |
| `app/syllabus_import.py` | Bounded PDF text extraction, conservative heading detection, warnings, and page-reference capture. |
| `app/schemas.py` | Pydantic request/response types for authentication, quotes, subjects, and calendar notes. |
| `app/academics_schemas.py` | Pydantic validation and response types for topics, concepts, progress, and exams. |
| `app/security.py` | Password hashing/verification, JWT creation, and bearer-token current-user dependency. |
| `app/core/__init__.py` | Marks the core configuration directory as a Python package. |
| `app/core/config.py` | Reads backend settings from environment and `.env`, with development defaults. |
| `app/routers/__init__.py` | Marks the router directory as a Python package. |
| `app/routers/auth.py` | Registration, login, and authenticated current-user endpoint. |
| `app/routers/subjects.py` | Authenticated subject listing, creation, editing, and deletion. |
| `app/routers/calendar.py` | Authenticated date-note list, upsert, and delete endpoints, including range validation. |
| `app/routers/quotes.py` | Authenticated daily/random quote endpoints and the server-side API Ninjas client. |
| `app/routers/academics.py` | Ownership-checked topic/concept/progress/readiness/exam operations and syllabus draft/confirm endpoints. |
| `app/routers/overview.py` | User-scoped recent learning activity, continue-learning candidates, revision suggestions, and upcoming exam summary. |

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
