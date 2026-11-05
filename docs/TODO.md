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
- [x] Add a PostgreSQL 16 CI service, validate the Alembic chain on PostgreSQL, and test JSON persistence plus database constraints against PostgreSQL.
- [ ] Add frontend tests for key user flows: login/register, subject creation, topic/concept progress, calendar note persistence, and exam create/edit/delete from both views.
- [x] Verify the syllabus-import UI TypeScript check and production build pass in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983099966).
- [x] Verify the 21-test syllabus/backend suite and full SQLite migration chain in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983287215).
- [x] Add CI execution for the backend pytest suite on development pushes and relevant pull requests.
- [x] Add CI checks for frontend TypeScript and production build.
- [x] Add Alembic configuration, the initial seven-table baseline, and the follow-up source-page-reference migration; CI validates upgrade, metadata consistency, and downgrade on SQLite.
- [ ] Document and execute safe baseline adoption for existing databases, then switch application startup away from `Base.metadata.create_all()` once all environments are migrated.
- [x] Require a unique 32+ character JWT secret and explicit non-local CORS origins in production; disable startup create_all in production while retaining the local-development default.
- [ ] Add frontend interaction tests for the key authenticated flows and continue the cross-screen API error/loading/empty-state and accessibility pass.

## Academics completion

- [x] Add subject editing for name, course code, and description in the UI and API.
- [x] Add optional semester/term and academic-year metadata, plus term filtering to subject management.
- [x] Add inline rename controls for topics and concepts, backed by ownership-checked partial PATCH endpoints. Reordering and richer descriptions remain future work.
- [x] Make manual syllabus construction a first-class path: add chapters/subchapters from scratch and add concepts directly within their chapter, independently of PDF import.
- [x] Replace the native confidence slider with a themed five-step accessible choice control; polish interaction states, transitions, and reduced-motion behavior in the Academics workspace.
- [x] Add PDF upload and selectable-text extraction with conservative chapter/concept heading detection and page references. Scanned PDF OCR remains unsupported.
- [x] Add an editable draft review/confirmation step; imported items are only persisted after explicit confirmation and append to existing syllabus content.
- [ ] Add syllabus versioning and migration-backed schema support.
- [ ] Expand readiness/revision from current self-assessment counts into explainable, exam-aware recommendations.
- [ ] Add review history and consider spaced-repetition scheduling.
- [ ] Consider prerequisite relationships after the core syllabus/revision flows are stable.

## Home / Overview

- [x] Expand the Overview with recent concept activity, continue-learning shortcuts, revision suggestions, upcoming exam summaries, and optional subject term filtering.
- [x] Add weekly calendar navigation/view and clarify that exams are academic events while day notes are personal date notes.
- [x] Return curated quote fallbacks when the quote provider is unavailable or unconfigured, and cache successful daily quote responses for one hour.
- [x] Add a calendar retry affordance and loading semantics; keep calendar errors local to the calendar panel.
- [ ] Add broader empty/loading/error states across remaining screens.
- [x] Add an in-process cache for successful daily quote responses and curated fallbacks when API Ninjas is unavailable or unconfigured. The provider remains optional.

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

