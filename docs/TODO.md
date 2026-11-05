# Atlas TODO

This backlog is based on the [README roadmap](../README.md#roadmap) and the implementation currently present in the repository. The README is the product-level source for intended behavior; this list distinguishes that vision from unfinished code. Re-check both documents as features land.

## Recently completed

- [x] Fix concept-progress PATCH handling so omitted fields retain their stored values instead of being overwritten by schema defaults. Regression coverage remains part of the automated-test task below.

## Near-term: make the current slice dependable

- [x] Establish an isolated pytest/FastAPI test harness and add backend API regression tests for authentication, duplicate registration, subject and academic-resource ownership, topic hierarchy validation, partial progress PATCH behavior, readiness counts, calendar-note ownership/range validation, and exam CRUD/ownership.
- [x] Run the initial 10-test backend API suite successfully in GitHub Actions.
- [ ] Expand backend coverage for remaining topic/concept CRUD edge cases and PostgreSQL integration before treating backend validation as complete.
- [ ] Add frontend tests for key user flows: login/register, subject creation, topic/concept progress, calendar note persistence, and exam create/edit/delete from both views.
- [x] Add CI execution for the backend pytest suite on development pushes and relevant pull requests.
- [ ] Add CI checks for frontend TypeScript/build.
- [ ] Introduce Alembic migrations before changing deployed database schemas; replace startup-only `Base.metadata.create_all()` as the schema-evolution mechanism.
- [ ] Review production configuration: require a strong JWT secret, define safe CORS origins, document required environment variables, and avoid development fallback credentials outside local development.
- [ ] Improve API error/loading/empty states and accessibility across the current screens.

## Academics completion

- [ ] Complete subject management with edit/update support and semester/term metadata; the API currently supports listing, creating, and deleting subjects.
- [ ] Add UI controls to rename/reorder topics and edit concepts; topic update exists in the API, but the workspace UI does not expose it.
- [ ] Add syllabus editing/import workflows. Manual topic and concept entry exists, but there is no syllabus document upload or extraction.
- [ ] Implement PDF upload and text extraction, identify headings/hierarchy, and retain page references.
- [ ] Add a draft review/confirmation step before imported syllabus data is saved.
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

