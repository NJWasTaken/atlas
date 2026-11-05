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
- [ ] Add PostgreSQL-backed integration coverage for database-specific behavior before treating backend validation as complete.
- [ ] Add frontend tests for key user flows: login/register, subject creation, topic/concept progress, calendar note persistence, and exam create/edit/delete from both views.
- [x] Verify the syllabus-import UI TypeScript check and production build pass in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983099966).
- [x] Verify the 21-test syllabus/backend suite and full SQLite migration chain in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983287215).
- [x] Add CI execution for the backend pytest suite on development pushes and relevant pull requests.
- [x] Add CI checks for frontend TypeScript and production build.
- [x] Add Alembic configuration, the initial seven-table baseline, and the follow-up source-page-reference migration; CI validates upgrade, metadata consistency, and downgrade on SQLite.
- [ ] Document and execute safe baseline adoption for existing databases, then switch application startup away from `Base.metadata.create_all()` once all environments are migrated.
- [ ] Review production configuration: require a strong JWT secret, define safe CORS origins, document required environment variables, and avoid development fallback credentials outside local development.
- [ ] Improve API error/loading/empty states and accessibility across the current screens.

## Academics completion

- [x] Add subject editing for name, course code, and description in the UI and API.
- [ ] Add semester/term metadata and filtering to subject management.
- [x] Add inline rename controls for topics and concepts, backed by ownership-checked partial PATCH endpoints. Reordering and richer descriptions remain future work.
- [x] Add PDF upload and selectable-text extraction with conservative chapter/concept heading detection and page references. Scanned PDF OCR remains unsupported.
- [x] Add an editable draft review/confirmation step; imported items are only persisted after explicit confirmation and append to existing syllabus content.
- [ ] Add syllabus versioning and migration-backed schema support.
- [ ] Expand readiness/revision from current self-assessment counts into explainable, exam-aware recommendations.
- [ ] Add review history and consider spaced-repetition scheduling.
- [ ] Consider prerequisite relationships after the core syllabus/revision flows are stable.

## Home / Overview

- [ ] Expand the Overview beyond the current subject summary, calendar, and quotation into recent activity, continue-learning shortcuts, concept summaries, and revision suggestions.
- [ ] Add weekly calendar navigation/view and clarify how academic dates, day notes, and any future general calendar events relate.
- [ ] Improve calendar error/loading states and handle quote-provider unavailability without blocking the rest of the Overview.
- [ ] Consider caching or a provider abstraction for quotations; the current quote endpoints call API Ninjas and require `X_API_KEY`.

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

