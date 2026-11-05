# Atlas Architecture

This document describes the code and behavior currently present in the repository. The README describes the broader product vision and roadmap; it should not be read as proof that every planned feature is implemented. Update this document as the implementation changes.

## Product and current scope

Atlas is intended to connect university coursework with independent learning and a personal knowledge space. The implemented application is an early, single-page workspace with bearer-token authentication and a FastAPI/PostgreSQL backend.

The current working slice includes:

- Account registration, login, and sign-out.
- A subject list with create, edit, and delete actions for subject name, course code, description, optional term, and academic year; the Overview can filter subjects by term.
- An Academics workspace for a subject: nested topics and concepts with inline renaming, concept self-assessments, readiness counts, and exam management.
- An Overview calendar with monthly and weekly navigation, editable date notes, and exams shown on their dates. Exams can be edited or deleted from either the Academics workspace or the Overview calendar. Calendar notes remain personal date notes; exams remain academic events.
- Daily and random quotations from API Ninjas when configured, with curated fallbacks, per-endpoint in-process caching (daily: six hours; random: one minute), and stale-cache fallback so provider outages do not block the Overview.
- A dark celestial visual treatment and a reduced-motion-aware animated background.

Explore and My Universe are navigation destinations with placeholder content. Syllabus PDFs can be uploaded, parsed into an editable draft, and explicitly confirmed into the subject's topic/concept tree. Structural syllabus changes create version snapshots that can be inspected and restored. Concept check-ins are recorded as review history and receive a simple next-review interval based on understanding and recall. There is no OCR for scanned PDFs, adaptive spaced-repetition algorithm, personal knowledge repository, AI gateway, or data export yet.

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

The App Router entry is `frontend/app/page.tsx`. It handles authentication state, navigation, subject loading, the Overview shell, recent learning/revision summaries, quote loading, and top-level errors. Overview cards deep-link into the matching subject and concept in Academics. It composes the Academics and calendar components rather than implementing their detailed interactions inline.

`frontend/lib/api.ts` is the shared JSON request helper. It reads the bearer token from browser local storage, adds it to requests, disables fetch caching, and turns non-success responses into errors. The API base URL comes from `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000/api/v1`.

The API is called directly from client components. The browser does not connect to PostgreSQL. The Overview calls `/api/v1/overview` for aggregate concept readiness, recent check-ins, continue-learning shortcuts, explainable revision candidates, due-review counts, and upcoming exams. Subject term filtering is client-side over the authenticated subject list.

### Backend

`backend/app/main.py` creates the FastAPI application, configures CORS from explicit allowed origins, and mounts the routers under `/api/v1`. In development it retains the `create_all()` startup convenience; production startup does not create tables and expects Alembic migrations to be applied before launch. The health check is `/health`.

Each protected route obtains the current user through `backend/app/security.py`. Subject, topic, concept, progress, exam, and calendar operations are scoped to that user directly or through ownership checks. SQLAlchemy sessions are supplied through `backend/app/db.py`.

### Persistence and schema

The database URL is supplied by settings and targets PostgreSQL by default. `docker-compose.yml` runs a local PostgreSQL 16 container with a persistent named volume. Alembic revisions `0002_source_pages` through `0005_concept_prerequisites` add source-page metadata, subject term/year metadata, syllabus-version/review-history tables, and concept prerequisite relationships. CI validates the migration chain on SQLite and PostgreSQL.

Existing models use integer primary keys. Alembic revision `0001_initial` is the seven-table baseline, followed by the source-page, subject-term, and syllabus-version/review-history revisions. Production startup does not call `Base.metadata.create_all()`; migrations must be applied before the API starts. Development retains `create_all()` for local convenience. Existing databases still require a verified backup, schema comparison, and explicit Alembic stamping/upgrades before production deployment. The earlier SQLite baseline and 21-test suite passed in [run #41983287215](https://github.com/NJWasTaken/atlas/actions/runs/41983287215); the expanded PostgreSQL workflow is now configured and its result is pending.

For a fresh database, run `cd backend && python -m alembic upgrade head` before starting the API. For a database already created by the old `create_all()` flow, take a verified backup and compare its schema carefully. If it matches the original seven-table baseline without the later migration columns, stamp `0001_initial` and then upgrade to head. For existing databases, `python -m scripts.adopt_existing_database` performs a read-only schema check and reports the matching revision (`0001_initial` through `0005_concept_prerequisites`). It refuses partial schemas and existing Alembic version tables. Only after taking and verifying a restorable backup should an operator rerun it with `--backup-verified --apply`, then run `python -m alembic upgrade head`. The helper only stamps; it does not alter application tables. **Do not run `upgrade head` against an existing un-stamped database** without first verifying and stamping its exact schema. This adoption has not been executed against any existing user database.

The current entities are:

| Entity | Purpose |
|---|---|
| `User` | Account email, password hash, and owned subjects |
| `Subject` | A user's subject name, optional code/description, term, and academic year |
| `DayNote` | One note per user and calendar date |
| `Topic` | Subject syllabus node with optional parent topic |
| `Concept` | Learning item belonging to a topic |
| `ConceptProgress` | Per-user exposure, understanding, recall, confidence, notes, last review, and suggested next-review timestamp |
| `ConceptReview` | Immutable per-user snapshots of each concept check-in |
| `SyllabusVersion` | Numbered JSON snapshots of a subject's topic/concept/prerequisite tree, with restore history |
| `ConceptPrerequisite` | Directed same-subject prerequisite links between concepts; self-links and cycles are rejected |
| `Exam` | User-owned exam associated with a subject and a date/time |

`backend/app/academics_models.py` defines topic, concept, progress, review-history, syllabus-version, and exam tables. Topics and concepts include optional JSON source-page references for imported syllabus material; `backend/app/models.py` defines users, subjects (including optional term and academic year), and day notes. Foreign keys and ORM cascades connect the records. Progress is unique per user/concept, and confidence is constrained to 1–5 when supplied.

Concept-progress updates use partial PATCH semantics: only fields explicitly supplied by the client are changed. Omitted exposure, understanding, recall, confidence, and notes values are preserved rather than reset to schema defaults. Each successful check-in creates a `ConceptReview` snapshot and calculates `next_review_at`: weak/needs-practice gets 2 days, developing 4 days, strong 7 days, and strong plus comfortable recall 14 days (unassessed defaults to 1 day). This is a transparent heuristic, not an adaptive learning model.

### API surface currently mounted

| Router | Current routes |
|---|---|
| Authentication | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Subjects | `GET /subjects`, `POST /subjects`, `PATCH /subjects/{subject_id}`, `DELETE /subjects/{subject_id}` |
| Calendar notes | `GET /calendar?start=…&end=…`, `PUT /calendar/{day}`, `DELETE /calendar/{day}` |
| Quotes | `GET /quotes/daily`, `GET /quotes/random` |
| Academics | Topic/concept CRUD; syllabus PDF draft/confirm; version list/detail/create/restore; progress get/update; concept review history; prerequisite get/replace; exam-aware readiness; exam CRUD |
| Overview | Authenticated recent concept activity, continue-learning candidates, revision suggestions, and upcoming exams |

All API routes are mounted under `/api/v1` except `/health`. The calendar range is limited to 63 days. Quote endpoints require authentication; API Ninjas is used when configured, otherwise a curated fallback is returned. Successful provider responses are cached in-process for six hours (daily) or one minute (random); a stale cached quote is served if the provider later fails. Curated fallback quotes keep a first-time or unconfigured dashboard usable.

Subject updates use a partial PATCH contract with user ownership checks. The subject modal supports name, course code, description, optional semester/term, and academic year; the Overview can filter the subject grid by term. The Academics workspace supports manual chapter/subchapter creation, contextual concept creation within a chapter, inline renaming, and PDF import as an alternative. The manual builder and importer are separate entry points; both persist through the existing topic/concept APIs. Topic and concept edits use partial PATCH requests, preserving fields not included in the request. Concept confidence uses a five-step themed choice control rather than the browser-native range slider, with reduced-motion-aware transitions and visible keyboard focus.

## Main user flows

### Sign-in and subjects

The root page restores a token from local storage, shows registration/login when unauthenticated, and loads the user's subjects after authentication. Creating, editing, and deleting subjects updates the overview and Academics workspace.

### Academics

`AcademicsWorkspace.tsx` loads the selected subject's topics, concepts, readiness summary, exams, syllabus versions, and prerequisite links. Users can add same-subject prerequisites for a concept; the API rejects self-links, cross-subject links, and cycles. Topic nesting is represented by `parent_topic_id`. Topics and concepts can be renamed inline; edits are saved through ownership-checked PATCH endpoints and create a new syllabus snapshot. Concept progress is stored per user, each check-in is recorded in review history, and the selected concept displays its next suggested review date. Overview learning/revision shortcuts deep-link to the matching subject and concept. Exam changes use the same persistent exam endpoints used by the Overview calendar.

The syllabus importer accepts PDF uploads up to 12 MB and 100 pages, extracts selectable text with `pypdf`, and uses conservative heading/bullet heuristics to suggest top-level chapters and concepts. The API returns an ephemeral draft with warnings and page references; the upload itself is not stored. The user can rename/remove/add chapters and concepts in the review UI. A separate manual builder supports creating chapters and nested chapters from scratch, while each expanded chapter has its own contextual add-concept form. Only the separate confirm endpoint persists the reviewed structure. Confirmed page references are stored as nullable JSON arrays on topics and concepts and shown in the syllabus tree. Each structural change, prerequisite update, and confirmed import records a numbered snapshot; users can inspect versions and restore an older tree, with both the pre-restore state and restored state retained in history. Existing concept IDs are reused during restore where possible so progress and review history survive; prerequisites are restored with the syllabus tree. Scanned/image-only PDFs are rejected with a clear OCR-not-supported message; OCR and complex multi-column layouts remain future work. Import appends to the existing syllabus rather than replacing it.

### Overview calendar

`DashboardCalendar.tsx` requests day notes for the visible month grid (42 days) or selected week (7 days), and loads the user's exam list. A retry control re-runs both calendar data requests. Notes and exams remain separate data: notes are personal date notes edited through `/calendar/{day}`, while exams are academic events changed through `/exams/{exam_id}`. Exam markers are derived from exam dates; selecting a day displays its exam details and allows editing or deletion.

### Quotations and visual layer

Daily/random quote requests are proxied by the backend to API Ninjas when configured, keeping the provider key out of the browser. Curated fallbacks keep the Overview usable without the provider; successful daily quotes are cached for one hour in the API process. The global celestial background is rendered by `CelestialBackground.tsx`; the separate `QuoteRipple.tsx` component exists but is not part of the current page composition.

## Configuration and local development

- Copy `.env.example` to `.env` and set local values. `.env` is intentionally ignored and must not be committed.
- Start PostgreSQL with `docker compose up -d db`.
- Install backend dependencies from `backend/requirements.txt`, then run the FastAPI app from the backend directory with Uvicorn.
- Install frontend dependencies from `frontend/package-lock.json` / `frontend/package.json`, then use the frontend development or build scripts.
- Configure `NEXT_PUBLIC_API_URL` for the frontend and backend settings such as `DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT`, `FRONTEND_ORIGIN`/`CORS_ORIGINS`, and optional `X_API_KEY`.
- Production requires a unique JWT secret of at least 32 characters and explicit trusted CORS origins; localhost and wildcard CORS origins are rejected. Production startup does not run `create_all()`, so deploy the Alembic head before launching the API.

The README's [Running Locally](../README.md#running-locally) section is the detailed setup guide.

## Backend tests

The backend test suite lives in `backend/tests/` and uses pytest with FastAPI's `TestClient`. Each test gets an isolated in-memory SQLite database; it does not connect to or modify the configured PostgreSQL development database. The app factory accepts `create_tables=False` so tests can import and exercise the API without running the normal startup table-creation hook.

From the repository root, install the backend dependencies and run:

```bash
cd backend
pip install -r requirements.txt
python -m pytest
```

The backend suite covers API behavior, production settings, migration-adoption detection, quote caching/fallback, and PostgreSQL persistence. The PostgreSQL 16 CI service validates migration upgrade/check/downgrade and runs database-specific integration coverage. Frontend CI runs TypeScript checking, a production build, and Playwright browser flows for authentication, subject/term creation and filtering, manual syllabus construction, progress saves, weekly calendar notes, and exam create/edit/delete. The migration-adoption tests cover each supported revision and reject partial schemas; the helper has not been run against an existing user database.

## File guide

This list covers the tracked project source, documentation, and configuration files. Generated dependencies and build output (`node_modules`, `.next`, Python virtual environments, caches, and bytecode) are deliberately excluded. Next.js may generate an ignored `frontend/next-env.d.ts` locally. `.env` is a local ignored file and is not documented by value.

### Repository root

| File | Responsibility |
|---|---|
| `.env.example` | Development examples for database, JWT, environment, CORS, frontend API URL, and optional quote-provider settings. Copy to ignored `.env`; replace development secrets and configure explicit origins in production. |
| `.gitignore` | Excludes local environment files, dependencies, build output, caches, and other generated/local files. |
| `docker-compose.yml` | Starts the local PostgreSQL service and named data volume. |
| `.github/workflows/backend-tests.yml` | Runs backend tests, validates Alembic upgrade/check/downgrade on SQLite and PostgreSQL 16, and executes PostgreSQL integration coverage. |
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
| `tests/test_api.py` | 27 API regression tests for authentication, ownership, academics, calendar, exams, quote fallback, Overview data, review history, syllabus version restore, and prerequisite graph validation. |
| `tests/test_config.py` | Production settings validation tests. |
| `tests/test_postgres_integration.py` | PostgreSQL-specific JSON persistence and constraint integration coverage. |
| `scripts/adopt_existing_database.py` | Read-only existing-schema detection and guarded Alembic stamping after a verified backup. |
| `tests/test_migration_adoption.py` | Covers legacy, source-page, subject metadata, review/version, prerequisite, and partial-schema detection. |
| `tests/test_quotes.py` | Quote cache and stale-provider-fallback regression tests. |
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
| `migrations/versions/0003_subject_term.py` | Adds optional term and academic-year fields to subjects. |
| `migrations/versions/0004_syllabus_versions_reviews.py` | Adds syllabus snapshots, concept review history, and next-review scheduling. |
| `migrations/versions/0005_concept_prerequisites.py` | Adds same-subject concept prerequisite relationships. |
| `migrations/script.py.mako` | Template for future versioned schema revisions. |
| `app/models.py` | Core `User`, `Subject`, and `DayNote` ORM models. |
| `app/academics_models.py` | `Topic`, `Concept`, `ConceptProgress`, `ConceptReview`, `ConceptPrerequisite`, `SyllabusVersion`, and `Exam` ORM models and relationships, including imported source-page references. |
| `app/syllabus_import.py` | Bounded PDF text extraction, conservative heading detection, warnings, and page-reference capture. |
| `app/schemas.py` | Pydantic request/response types for authentication, quotes, subjects, and calendar notes. |
| `app/academics_schemas.py` | Pydantic validation and response types for topics, concepts, progress, and exams. |
| `app/security.py` | Password hashing/verification, JWT creation, and bearer-token current-user dependency. |
| `app/core/__init__.py` | Marks the core configuration directory as a Python package. |
| `app/core/config.py` | Reads backend settings from environment and `.env`; validates strong production JWT secrets and explicit trusted CORS origins. |
| `app/routers/__init__.py` | Marks the router directory as a Python package. |
| `app/routers/auth.py` | Registration, login, and authenticated current-user endpoint. |
| `app/routers/subjects.py` | Authenticated subject listing, creation, editing, and deletion. |
| `app/routers/calendar.py` | Authenticated date-note list, upsert, and delete endpoints, including range validation. |
| `app/routers/quotes.py` | Authenticated daily/random quote endpoints, per-endpoint TTL caching, curated fallbacks, and stale-cache recovery. |
| `app/routers/academics.py` | Ownership-checked topic/concept/progress/review-history/readiness/exam and syllabus version/draft/confirm/restore endpoints. |
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
| `app/components/DashboardCalendar.tsx` | Monthly/weekly Overview calendar, date-note editing, retry states, and display/edit/delete of exams on selected dates. |
| `e2e/atlas.spec.cjs` | Playwright browser flows for sign-in, academics, progress, calendar notes, and exam management. |
| `playwright.config.cjs` | Chromium browser-test configuration and local Next.js test server. |
| `app/components/CelestialBackground.tsx` | Three.js/React Three Fiber animated star-map background with reduced-motion support. |
| `app/components/QuoteRipple.tsx` | Reusable Three.js ripple effect component; currently not mounted by the page. |
| `lib/api.ts` | Shared frontend HTTP helper and local-storage token access. |

## Known architectural boundaries

- The application is a prototype, not yet a production deployment architecture.
- Authentication tokens are stored in browser local storage; refresh/revocation flows are not implemented.
- Startup `create_all()` is not a substitute for versioned database migrations. Production does not run it; local development still does. Existing database baseline adoption remains an operator task requiring a verified backup and schema comparison.
- The backend suite includes API, configuration, quote-cache, migration-adoption, and PostgreSQL integration coverage. GitHub Actions validates the SQLite and PostgreSQL migration chains and runs Playwright browser flows after the frontend typecheck/build. The existing-database adoption helper remains an explicit operator action requiring a verified backup; it has not been run against a user database.
- The Overview provides monthly and weekly calendar views, date notes, exam events, recent learning activity, revision nudges, and upcoming exams; it is not a general-purpose event planner.
- Explore, My Universe, scanned-PDF OCR, adaptive spaced repetition, AI integrations, and data export remain future work.
