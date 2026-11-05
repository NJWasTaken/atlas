# Atlas TODO

This backlog is based on the [README roadmap](../README.md#roadmap) and the implementation currently present in the repository. The README is the product-level source for intended behavior; this list distinguishes that vision from unfinished code. Re-check both documents as features land.

## Recently completed

- [x] Fix concept-progress PATCH handling so omitted fields retain their stored values instead of being overwritten by schema defaults. Regression coverage remains part of the automated-test task below.

## Near-term: make the current slice dependable

- [x] Establish an isolated pytest/FastAPI test harness and add backend API regression tests for authentication, duplicate registration, subject and academic-resource ownership, topic hierarchy validation, partial progress PATCH behavior, readiness counts, calendar-note ownership/range validation, and exam CRUD/ownership.
- [x] Run the initial 10-test backend API suite successfully in GitHub Actions.
- [x] Expand backend regression coverage for topic updates, required-field validation, concept deletion, calendar-note update/delete, and exam validation/ownership.
- [x] Run the expanded 15-test backend API suite successfully in GitHub Actions.
- [x] Verify subject/concept partial-update endpoints and ownership validation in the expanded backend suite.
- [x] Add PostgreSQL-backed integration coverage for academic JSON persistence and timezone-aware review timestamps; current branch adds a PostgreSQL service to backend CI (awaiting fresh CI result).
- [x] Add mock-backed Playwright browser tests for sign-in, subject/term creation, manual topic/concept creation, progress save, weekly calendar navigation, and day-note persistence (awaiting fresh CI result). Exam CRUD browser coverage remains to be expanded.
- [x] Verify the syllabus-import UI TypeScript check and production build pass in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983099966).
- [x] Verify the 21-test syllabus/backend suite and full SQLite migration chain in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983287215).
- [x] Add CI execution for the backend pytest suite on development pushes and relevant pull requests.
- [x] Add CI checks for frontend TypeScript and production build.
- [x] Add Alembic configuration, the initial seven-table baseline, and the follow-up source-page-reference migration; CI validates upgrade, metadata consistency, and downgrade on SQLite.
- [ ] Document and execute safe baseline adoption for existing databases, then switch application startup away from `Base.metadata.create_all()` once all environments are migrated.
- [x] Require a unique 32+ character JWT secret, explicit comma-separated CORS origins, and disabled automatic table creation in production settings; local development retains its convenience defaults.
- [ ] Continue improving API error/loading/empty states and accessibility across all screens; this pass adds calendar retry states, quote-provider fallback messaging, and clearer Overview loading/empty content.

## Academics completion

- [x] Add subject editing for name, course code, and description in the UI and API.
- [x] Add optional subject term/semester metadata and term filtering to the Academics subject picker.
- [x] Add inline rename controls for topics and concepts, backed by ownership-checked partial PATCH endpoints. Reordering and richer descriptions remain future work.
- [x] Make manual syllabus construction a first-class path: add chapters/subchapters from scratch and add concepts directly within their chapter, independently of PDF import.
- [x] Replace the native confidence slider with a themed five-step accessible choice control; polish interaction states, transitions, and reduced-motion behavior in the Academics workspace.
- [x] Add PDF upload and selectable-text extraction with conservative chapter/concept heading detection and page references. Scanned PDF OCR remains unsupported.
- [x] Add an editable draft review/confirmation step; imported items are only persisted after explicit confirmation and append to existing syllabus content.
- [x] Add named syllabus snapshots with list/detail APIs and migration-backed JSON snapshots; the UI can save and inspect historical snapshots (restore/compare remains future work).
- [x] Expand readiness with concept-level explanations, review reasons, and priority informed by proximity to the next exam; no grade prediction or fabricated percentage is shown.
- [x] Record review history and calculate a transparent suggested next-review interval from the user's self-assessment (1/3/7/14-day heuristic; adaptive scheduling remains future work).
- [ ] Consider prerequisite relationships after the core syllabus/revision flows are stable.

## Home / Overview

- [x] Expand Overview with recent review activity, continue-learning shortcuts, per-subject concept summaries, upcoming exams, and revision suggestions grounded in recorded progress.
- [x] Add weekly/monthly calendar navigation and document that exam dates are academic events while day notes remain separate personal notes; a general event model is not implemented.
- [x] Add calendar sync retry/error states and quote-provider cache/stale fallback messaging so a quote outage does not block the rest of Overview.
- [x] Add a small server-side quote-provider adapter and process-local caching (daily: 6 hours; random: 1 minute), with stale-cache fallback. API Ninjas still requires `X_API_KEY` for an initial fetch.

## Explore

- [ ] Build the discovery interface and exploration-session model/API.
- [ ] Support saving discoveries and questions for later.
- [ ] Add contextual prompts and learning paths.
- [ ] Connect independent exploration to subjects, topics, and concepts.
- [ ] Keep direct AI integrations optional; allow external AI handoff as an initial alternative.

## My Universe

- [ ] Implement personal notes and saved resources/concepts.
- [ ] Add personal questions and retrieval/search.
- [ ] Implement user-created knowledge connections.
- [ ] Build a visual knowledge graph after the underlying knowledge entities and links are stable.
- [ ] Explore AI-assisted connections only after the user-controlled model is established.

## AI Gateway

- [ ] Define provider-neutral configuration and request/response contracts.
- [ ] Build contextual prompt construction with explicit user-controlled context.
- [ ] Support external provider handoff.
- [ ] Add opt-in direct provider integrations only when required; do not make a paid provider a core dependency.

## Release readiness and refinement

- [ ] Add data export and backup/restore workflows.
- [ ] Improve mobile layouts, keyboard navigation, screen-reader support, and reduced-motion behavior across all views.
- [ ] Add search across subjects, concepts, notes, and saved items as those modules become available.
- [ ] Measure and improve performance, reliability, logging, and operational error reporting.
- [ ] Define deployment, secrets management, database backup, and production monitoring requirements.

