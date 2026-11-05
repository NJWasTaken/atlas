# Atlas TODO

This backlog is based on the [README roadmap](../README.md#roadmap) and the implementation currently present in the repository. The README is the product-level source for intended behavior; this list distinguishes that vision from unfinished code. Re-check both documents as features land.

## Recently completed

- [x] Fix concept-progress PATCH handling so omitted fields retain their stored values instead of being overwritten by schema defaults. Regression coverage remains part of the automated-test task below.
- [x] Ensure every random-quote request fetches a fresh quote instead of replaying the one-minute cache; retain the last successful random quote only as an outage fallback and cover both behaviors with backend tests.

## Near-term: make the current slice dependable

- [x] Establish an isolated pytest/FastAPI test harness and add backend API regression tests for authentication, duplicate registration, subject and academic-resource ownership, topic hierarchy validation, partial progress PATCH behavior, readiness counts, calendar-note ownership/range validation, and exam CRUD/ownership.
- [x] Run the initial 10-test backend API suite successfully in GitHub Actions.
- [x] Expand backend regression coverage for topic updates, required-field validation, concept deletion, calendar-note update/delete, and exam validation/ownership.
- [x] Run the expanded 15-test backend API suite successfully in GitHub Actions.
- [x] Verify subject/concept partial-update endpoints and ownership validation in the expanded backend suite.
- [x] Configure a PostgreSQL 16 CI service, Alembic upgrade/check/downgrade validation, and integration coverage for JSON persistence and database constraints.
- [x] Add Playwright browser tests for sign-in, subject/term creation and filtering, manual chapter/concept creation, progress saves, weekly calendar notes, and exam create/edit/delete across Academics and Overview.
- [x] Verify the syllabus-import UI TypeScript check and production build pass in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983099966).
- [x] Verify the 21-test syllabus/backend suite and full SQLite migration chain in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983287215).
- [x] Add CI execution for the backend pytest suite on development pushes and relevant pull requests.
- [x] Add CI checks for frontend TypeScript and production build.
- [x] Add Alembic configuration and five ordered revisions (initial baseline, source-page references, subject term/year metadata, syllabus versions/review history, and concept prerequisites); CI validates upgrade, metadata consistency, and downgrade on SQLite and PostgreSQL.
- [x] Add a dry-run schema adoption helper that detects revisions `0001`–`0005`, rejects partial/incompatible schemas, and requires both `--backup-verified` and `--apply` before stamping. Production startup now leaves schema management to Alembic and no longer runs `Base.metadata.create_all()`; local development retains the convenience behavior. **Still pending per environment:** verify a restorable backup, run the helper, and apply migrations only after inspecting the detected revision.
- [x] Require a unique 32+ character JWT secret and explicit non-local CORS origins in production; disable startup create_all in production while retaining the local-development default.
- [x] Add frontend interaction tests for the key authenticated flows. Continue the cross-screen API error/loading/empty-state and accessibility pass.

## Academics completion

- [x] Add subject editing for name, course code, and description in the UI and API.
- [x] Add optional semester/term and academic-year metadata, plus term filtering to subject management.
- [x] Add inline rename controls for topics and concepts, backed by ownership-checked partial PATCH endpoints. Reordering and richer descriptions remain future work.
- [x] Make manual syllabus construction a first-class path: add chapters/subchapters from scratch and add concepts directly within their chapter, independently of PDF import.
- [x] Replace the native confidence slider with a themed five-step accessible choice control; polish interaction states, transitions, and reduced-motion behavior in the Academics workspace.
- [x] Add PDF upload and selectable-text extraction with conservative chapter/concept heading detection and page references. Scanned PDF OCR remains unsupported.
- [x] Add an editable draft review/confirmation step; imported items are only persisted after explicit confirmation and append to existing syllabus content.
- [x] Add migration-backed syllabus snapshots, automatic version capture for structural edits/imports, version inspection, and restore with pre-restore checkpointing.
- [x] Flush pending structural edits and prerequisite links before creating version snapshots.
- [x] Add exam-aware readiness context, due-review counts, and explainable priorities for weak, unassessed, recall-practice, and overdue concepts.
- [x] Record each concept check-in in review history and calculate a transparent next-review interval from understanding and recall. This is a simple heuristic, not an adaptive SM-2 scheduler.
- [x] Add same-subject concept prerequisites with ownership checks, self/cross-subject/cycle validation, a themed editor, and versioned restore support.

## Home / Overview

- [x] Expand the Overview with aggregate concept readiness, recent concept activity, direct continue-learning shortcuts, revision suggestions, upcoming exam summaries, and optional subject term filtering.
- [x] Add weekly calendar navigation/view and clarify that exams are academic events while day notes are personal date notes.
- [x] Return curated quote fallbacks when the quote provider is unavailable or unconfigured; cache daily quotes for six hours and random quotes for one minute, with stale-cache fallback after provider failures.
- [x] Add a calendar retry affordance and loading semantics; keep calendar errors local to the calendar panel.
- [x] Add explicit subject-list loading/error/retry states on Home, local Overview-summary loading/error feedback, Academics workspace loading/error/retry states, and an announced calendar sync state.
- [x] Guard Academics workspace requests against out-of-order responses when switching subjects.
- [x] Add a Playwright regression test for a transient subject-list API failure followed by a successful retry.
- [ ] Continue the cross-screen pass for individual mutations, modal/dialog feedback, and edge-case empty states.

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
- [ ] Complete a full mobile-layout, keyboard-navigation, screen-reader, and reduced-motion audit across all views. The current PR adds live announcements for the newly hardened async states but does not claim full accessibility completion.
- [ ] Add search across subjects, concepts, notes, and saved items as those modules become available.
- [ ] Measure and improve performance, reliability, logging, and operational error reporting.
- [ ] Define deployment, secrets management, database backup, and production monitoring requirements.

