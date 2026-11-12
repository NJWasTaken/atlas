# Atlas TODO

This backlog is based on the [README roadmap](../README.md#roadmap) and the implementation currently present in the repository. The README is the product-level source for intended behavior; this list distinguishes that vision from unfinished code. Re-check both documents as features land.

## Contribution workflow

- Make small fixes, copy changes, and isolated polish directly on the working branch; do not open a PR solely for these changes.
- Open a PR for a substantial, cohesive feature or architectural change with a clear scope, meaningful tests, and documentation updates where needed.
- Group related implementation, regression coverage, and UX work into one reviewable change rather than splitting it into several small PRs.

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
- [x] Preserve the selected concept and next-review feedback when a progress save refreshes subject readiness.
- [x] Verify the syllabus-import UI TypeScript check and production build pass in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983099966).
- [x] Verify the 21-test syllabus/backend suite and full SQLite migration chain in [GitHub Actions](https://github.com/NJWasTaken/atlas/actions/runs/41983287215).
- [x] Add CI execution for the backend pytest suite on development pushes and relevant pull requests.
- [x] Add CI checks for frontend TypeScript and production build.
- [x] Add Alembic configuration and five ordered revisions (initial baseline, source-page references, subject term/year metadata, syllabus versions/review history, and concept prerequisites); CI validates upgrade, metadata consistency, and downgrade on SQLite and PostgreSQL.
- [x] Add a dry-run schema adoption helper that detects revisions `0001`–`0005`, rejects partial/incompatible schemas, and requires both `--backup-verified` and `--apply` before stamping. Production startup now leaves schema management to Alembic and no longer runs `Base.metadata.create_all()`; local development retains the convenience behavior. **Still pending per environment:** verify a restorable backup, run the helper, and apply migrations only after inspecting the detected revision.
- [x] Require a unique 32+ character JWT secret and explicit non-local CORS origins in production; disable startup create_all in production while retaining the local-development default.
- [x] Add frontend interaction tests for the key authenticated flows and complete the first cross-screen mutation/error/empty-state pass: confirm destructive subject/topic/concept/exam/note actions, keep subject-save errors inside the modal, prevent modal dismissal during saves, separate calendar sync errors from failed writes, announce successful mutations, and provide clear filtered-empty states. A broader keyboard/screen-reader/responsive audit remains in Release readiness.

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
- [x] Return curated quote fallbacks when the quote provider is unavailable or unconfigured; cache daily quotes for six hours, fetch random quotes afresh, and avoid repeating the previous random result when the provider repeats or fails.
- [x] Add a calendar retry affordance and loading semantics; keep calendar errors local to the calendar panel.
- [x] Add explicit subject-list loading/error/retry states on Home, local Overview-summary loading/error feedback, Academics workspace loading/error/retry states, and an announced calendar sync state.
- [x] Guard Academics workspace requests against out-of-order responses when switching subjects.
- [x] Add a Playwright regression test for a transient subject-list API failure followed by a successful retry.
- [x] Complete the first cross-screen pass for destructive-action confirmation, modal save/error handling, pending-state protection, calendar mutation feedback, and term-filter empty states. Remaining full accessibility/responsive work is tracked under Release readiness.

## Explore — PDF reader only

**Product direction:** Explore is a focused PDF reading room. It is not a general research workspace or knowledge-management surface. No topic workspaces, standalone notes, whiteboards, knowledge graphs, or web research capture. The PDF is the primary object; annotations are anchored to selected passages and remain attached to that document.

- [x] Private PDF library with device upload and public-URL import, per-user ownership, document metadata, and durable reading position.
- [x] Bundled PDF.js reader with continuous scrolling, page navigation, thumbnails, document outline, text search, zoom/fit, bookmarks, and focus mode.
- [x] Persist page bookmarks and page-relative text-selection highlights/annotations per document.
- [x] Validate PDFs, enforce the 50 MB limit, reject encrypted files, validate public import hosts, and cover ownership and persistence with tests.
- [x] First reader shell refinement — give the PDF canvas more room, calm the toolbar/sidebar, improve focus-mode framing, and add a responsive annotation surface while retaining the celestial theme.
- [x] Add reader keyboard shortcuts: Ctrl/Cmd+F for search, arrow/PageUp/PageDown navigation, +/- zoom, and Escape to clear the active selection.
- [x] Add browser regression coverage for fit-width, fit-page, manual +/- zoom, page indicators, page navigation, and reading-position restoration.
- [ ] Validate reading ergonomics against a representative set of real PDFs, including unusually tall/wide pages and very long documents.
- [x] Rendering quality/performance pass — mount full PDF canvas/text layers only for the current page and four pages either side; retain lightweight scroll slots and measure nearby page dimensions so mixed-size documents keep a more accurate scroll track.
- [x] Evaluate Lector against the custom PDF.js renderer. Defer adoption: current Lector docs require pdfjs-dist ^5.5.207 while Atlas uses 6.4.299, and Lector has an open PDF.js 6.x compatibility issue. Keep the custom renderer until the dependency gap closes and a migration spike proves feature parity.
- [x] Selection-first annotations — floating toolbar for highlight, underline, strike-through, and anchored comment; four highlight colours; selected-text and page context.
- [x] Add an annotation list with page-jump navigation and deletion; preserve legacy page-only notes as page-comment annotations during migration.
- [x] Add locked highlighter/underline modes with a persistent colour choice for repeated marking.
- [x] Annotation management — search/filter by passage, type, and colour; edit mark type, colour, and comment; provide retryable recovery for failed create, update, and delete mutations.
- [ ] Add freehand ink/area markup only if it fits naturally into the reading flow and can be persisted accessibly.
- [x] Export a separate PDF copy with standard highlight, underline, and strike-through annotations embedded; never modify the original upload.
- [x] Add paper, sepia, and dark reading themes with per-document persistence; themes affect the reading surround, not source-page pixels, to preserve contrast across different PDFs.
- [ ] Review theme contrast against a representative set of real source PDFs and displays.
- [x] Add reader accessibility foundations: semantic navigation tabs, live page status, visible keyboard focus, arrow-key tab navigation, larger touch targets, mobile layout refinements, and reduced-motion handling.
- [ ] Complete manual screen-reader and real-device touch/mobile testing before claiming full accessibility completion.

**Explicit non-goals:** standalone notes, whiteboards, topic workspaces, knowledge graphs, web article research, social/sharing features, and automatic knowledge organization.

### Design references

- [Zotero PDF Reader](https://www.zotero.org/support/pdf_reader) — selection popovers, fast colour selection, locked highlighter/underline modes, annotation lists, and page-jump navigation. Borrow the reading/annotation loop, not its standalone note editor.
- [Lector](https://github.com/anaralabs/lector) — React/PDF.js primitives and virtualized page rendering; evaluate as a possible replacement for the current custom page layer after checking PDF.js version compatibility.
- [PDF.js](https://github.com/mozilla/pdf.js) — keep this as the rendering foundation rather than implementing a PDF engine.
- [Okular](https://okular.kde.org/) — practical annotation tools, document navigation, and keyboard-oriented workflows.
- [Stirling PDF](https://docs.stirlingpdf.com/Functionality/Read-and-Annotate/) — annotation review and standards-friendly PDF export patterns.
- [Folio](https://github.com/owenpkent/folio) — reading-first ergonomics, focus, and accessibility ideas; treat as an evolving reference rather than a proven production baseline.

## Next substantial change: PDF reader reliability and accessibility

The next PR should finish the remaining reader work as one cohesive quality pass before starting another product module.

1. [x] Add representative browser fixtures for mixed portrait/landscape/tall pages, a 120-page document, and documents with and without outlines. Real-world PDF sampling remains a manual follow-up.
2. [x] Cover fit-width, fit-page, manual zoom shortcuts, page indicators, outline navigation, and reading-position restoration in Playwright.
3. [x] Evaluate Lector and record the compatibility-based defer decision; do not replace the renderer until PDF.js 6.x support is available and migration parity is demonstrated.
4. [x] Add mark type/colour editing and retry recovery for failed annotation create, update, and delete operations.
5. [x] Persist paper/sepia/dark theme per document and tune the ambient reading surface without filtering source-page pixels. Review contrast on real PDFs remains open.
6. [x] Add semantic controls, keyboard tab navigation, focus visibility, mobile/touch-target styling, and reduced-motion coverage. Manual assistive-technology and physical-device checks remain open.
7. [x] Add automated regression coverage and update reader documentation/status.

Keep freehand ink/area markup out of this PR unless the evaluation shows it is essential to the reading workflow; it is explicitly optional.

## Next substantial change: zero-cost large PDF support

Keep these follow-up PRs separate and do not add a paid object-storage dependency.

1. [ ] **Efficient private PDF delivery:** implement authenticated HTTP Range support (206 Partial Content, Content-Range, Accept-Ranges, correct length/cache headers) for locally stored files; switch PDF.js to URL-based loading rather than downloading the full file into an ArrayBuffer; test range boundaries, invalid ranges, ownership, and browser behavior.
2. [ ] **Large-document reader performance:** audit page virtualization, lazy text extraction, canvas/text-layer lifecycle, cancellation of obsolete renders, and memory cleanup; stress-test with the 44 MB textbook and long/mixed-dimension PDFs while preserving annotations and reading behavior.
3. [ ] **Local storage operations:** document/configure persistent PDF storage for deployment, handle disk-full and storage failures, and provide coordinated local PDF + PostgreSQL backup/restore guidance. No cloud storage service or recurring storage cost.

## My Universe

- [ ] Implement personal notes and saved resources/concepts.
- [ ] Add personal questions and retrieval/search.

## Release readiness and refinement

- [ ] Add data export and backup/restore workflows.
- [ ] Complete a full mobile-layout, keyboard-navigation, screen-reader, and reduced-motion audit across all views. The current PR adds live announcements for the newly hardened async states but does not claim full accessibility completion.
- [ ] Add search across subjects, concepts, notes, and saved items as those modules become available.
- [ ] Measure and improve performance, reliability, logging, and operational error reporting.
- [ ] Define deployment, secrets management, database backup, and production monitoring requirements.

