# Atlas

> Go beyond. Plus ultra.

Atlas is an academic workspace designed to help students move beyond studying purely for examinations.

Structured education often turns learning into a cycle of lectures, assignments, deadlines, and examinations. Students end up optimising for marks and short-term retention rather than genuine understanding, curiosity, and long-term knowledge.

Atlas aims to change that by bringing academic planning, syllabus management, learning progress, personal exploration, notes, and knowledge connections into one cohesive environment. Rather than treating learning as a collection of disconnected tasks, Atlas treats it as an evolving body of knowledge that students can build, revisit, and expand.

The long-term goal is to create a digital space where students can manage their academic responsibilities without losing sight of why they wanted to learn in the first place.

---

## Table of Contents

- [Vision](#vision)
- [Design Philosophy](#design-philosophy)
- [Core Experience](#core-experience)
- [Application Modules](#application-modules)
  - [Home](#1-home)
  - [Academics](#2-academics)
  - [Explore](#3-explore)
  - [My Universe](#4-my-universe)
  - [Settings](#5-settings)
- [Key User Journeys](#key-user-journeys)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Data Model](#data-model)
- [API Design](#api-design)
- [Design System](#design-system)
- [Privacy and Data Principles](#privacy-and-data-principles)
- [Development Status](#development-status)
- [Roadmap](#roadmap)
- [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

# Vision

**Academic progress and intellectual curiosity should reinforce each other, not compete.**

A student should be able to prepare for an examination, understand a difficult concept, follow an interesting question outside their syllabus, and connect that discovery to something they learned months ago.

Atlas is intended to serve as:

- An academic companion for managing subjects, syllabi, examinations, and revision.
- A learning tracker focused on understanding rather than merely completed tasks.
- An exploration environment for discovering topics outside formal coursework.
- A personal knowledge space for collecting notes, concepts, questions, and ideas.

The application complements university learning platforms and note-taking applications by bringing academic planning, reading, and personal knowledge into one cohesive workspace.

## What Atlas is not

Atlas is not intended to become:

- Another generic to-do list with an academic theme.
- A platform that measures learning exclusively through streaks or hours spent studying.
- A rigid study planner that dictates how a student must learn.
- A grade prediction system that presents fabricated precision as academic readiness.

The emphasis is on helping students understand where they stand, decide what deserves attention, and develop their own intellectual interests.

---

# Design Philosophy

Atlas follows four central product principles.

### 1. Safety

Learning should feel like a process, not a performance.

Students should be able to record uncertainty, acknowledge weak understanding, and revisit forgotten material without feeling penalised. Progress tracking should encourage reflection rather than create additional academic pressure.

### 2. Curiosity

The syllabus is a starting point, not a boundary.

Students should be encouraged to explore related concepts, ask questions, discover unfamiliar fields, and follow interesting connections beyond their prescribed coursework.

### 3. University

Atlas is designed around the realities of university education.

Subjects, semesters, syllabi, chapters, concepts, examinations, and academic deadlines form the foundation of the application.

### 4. Companion

Atlas should feel like a personal workspace that grows alongside its user.

It should help organise information and provide useful suggestions without becoming controlling or intrusive.

## Design priorities

- Academic confidence takes priority over gamification.
- Grades and examination preparation remain important, but should not define the entire learning experience.
- Students retain control over their learning progress and organisation.
- Information should be explainable, editable, and easy to retrieve.
- The interface should remain calm and readable even when displaying large amounts of information.

---

# Core Experience

Atlas is organised into five primary destinations:

| Module | Purpose |
|---|---|
| Home | A consolidated overview of academic activity and learning |
| Academics | Structured management of university coursework |
| Explore | Independent learning and discovery |
| My Universe | Personal knowledge, notes, and connections |
| Settings | Personalisation and application configuration |

These modules are intended to work together rather than operate as isolated features.

For example:

1. A student encounters a concept in a university subject.
2. They record their understanding in Academics.
3. They discover a related concept through Explore.
4. They save the discovery to My Universe.
5. They connect it to an existing concept or note.
6. They revisit the connection while studying for an examination.

This creates a continuous learning workflow instead of separate academic and personal knowledge systems.

---

# Application Modules

## 1. Home

**Purpose:** Provide a central overview of the student's academic and learning activity.

Home is the first destination when opening Atlas. It should answer three questions:

- What is happening academically?
- What should I pay attention to next?
- What have I been learning recently?

### Planned features

**Academic overview**
- Overview of enrolled subjects.
- Upcoming examinations and important academic dates.
- Quick access to subjects and their syllabi.
- A summary of concept progress.
- Important revision suggestions.

**Calendar**
- Monthly and weekly calendar views.
- Academic events and examination dates.
- Personal notes attached to individual dates.
- Ability to create, edit, and delete calendar entries.
- Synchronisation with academic events managed elsewhere in Atlas.

**Continue learning**
- Recently accessed subjects.
- Recently studied concepts.
- Recently explored topics.
- Quick links to unfinished learning activities.

**Recent exploration**
- Recently visited exploration sessions.
- Saved concepts and discoveries.
- Questions or topics the student wants to revisit.

**Daily inspiration**
- A rotating collection of quotations related to learning, science, creativity, and curiosity.
- Smooth transitions between quotations.
- The ability to move between quotations manually.

### Design intent

Home should not become an overwhelming analytics dashboard.

It should provide enough information to help a student orient themselves without turning every visit into a reminder of unfinished work.

---

## 2. Academics

**Purpose:** Provide a structured workspace for university coursework, syllabus management, and academic revision.

Academics is the foundation of Atlas.

Students should be able to represent their university subjects as structured collections of topics and concepts, track their understanding, and identify what deserves revision.

### 2.1 Subject management

Students can create and manage academic subjects.

Each subject should support:

- Subject name.
- Subject description.
- Semester or academic term.
- Optional subject colour or visual identity.
- Associated syllabus.
- Examination dates.
- Topic and concept hierarchy.

Subject management should support creating, editing, viewing, and deleting subjects.

### 2.2 Syllabus management

A syllabus is represented as a structured hierarchy rather than a flat document.

Atlas should support two methods of syllabus creation.

**Manual entry**

Students can manually create:

- Units or chapters.
- Topics.
- Subtopics.
- Individual concepts.

They should be able to edit names, descriptions, ordering, and hierarchy.

**PDF import**

Students can upload a syllabus PDF and have Atlas extract its contents.

The intended workflow is:

1. Upload a syllabus PDF.
2. Extract text from the document.
3. Identify potential headings, chapters, units, and subtopics.
4. Build a proposed topic hierarchy.
5. Preserve page references wherever possible.
6. Flag uncertain or low-confidence detections.
7. Present the extracted hierarchy for user review.
8. Allow the student to edit the structure.
9. Confirm and save the syllabus.

The student must remain in control of the final syllabus structure.

PDF extraction should never silently create an incorrect syllabus hierarchy.

Scanned-document OCR can be added as a later enhancement.

**Syllabus versioning**

The longer-term design should support multiple syllabus versions, allowing students to retain previous versions when coursework or academic requirements change.

### 2.3 Topic and concept hierarchy

A subject contains topics, which may contain nested topics and concepts.

An example:

```text
Machine Learning
│
├── Unit 1: Introduction
│   ├── Introduction to Machine Learning
│   ├── Types of Learning
│   └── Model Evaluation
│
├── Unit 2: Regression
│   ├── Linear Regression
│   │   ├── Cost Functions
│   │   └── Gradient Descent
│   └── Logistic Regression
│
└── Unit 3: Classification
    ├── Decision Trees
    ├── Random Forests
    └── Support Vector Machines
```

Students should be able to:

- Add and remove topics.
- Nest topics under other topics.
- Reorder topics.
- Add concepts to topics.
- Edit concept descriptions.
- Navigate the hierarchy without losing context.

The hierarchy should remain flexible enough to support different academic structures.

### 2.4 Concept progress tracking

Atlas should track learning at the concept level.

Instead of simply marking a chapter as complete, students can describe their understanding of individual concepts.

Each concept should support the following dimensions:

| Dimension | Values |
|---|---|
| Exposure | Not started, studied |
| Understanding | Not assessed, weak, developing, strong |
| Recall | Not assessed, needs practice, comfortable |
| Confidence | 1–5 |
| Last reviewed | Date and time |
| Personal notes | Free-form text |

These dimensions intentionally represent different aspects of learning.

For example, a student may have studied a concept but still have weak understanding. They may understand a topic when reading their notes but struggle to recall it independently.

Atlas should preserve these distinctions.

### 2.5 Academic readiness

The readiness system should help students understand the state of their syllabus.

It should provide:

- Distribution of concepts by understanding level.
- Concepts that have not been assessed.
- Concepts requiring additional revision.
- Concepts with poor recall.
- Recently reviewed concepts.
- Important topics that may deserve attention.

Readiness suggestions should be explainable.

For example:

- "Several concepts in Unit 2 have not been assessed yet."
- "These three concepts are marked as weak."
- "You have not reviewed these concepts recently."
- "Recall practice may help reinforce these topics."

Atlas should not invent examination scores, grade predictions, or arbitrary readiness percentages.

If a numerical metric is introduced later, its calculation must be transparent and meaningful.

### 2.6 Revision recommendations

The longer-term revision system should combine:

- Understanding level.
- Recall confidence.
- Time since last review.
- Concept importance.
- Examination proximity.
- Prerequisite relationships.

It should suggest what to revisit and explain why.

Prerequisite relationships may eventually help identify foundational concepts that should be understood before attempting advanced material.

Importantly, discovering that a prerequisite is weak must not automatically downgrade the student's recorded progress on an advanced concept.

### 2.7 Examination management

Students should be able to:

- Create examinations.
- Associate examinations with subjects.
- Set examination dates and times.
- Edit or delete examination entries.
- View upcoming examinations.
- See relevant syllabus information alongside examination dates.

The examination system should integrate with Home and the calendar.

---

## 3. Explore

**Purpose:** Provide a calm, dependable environment for reading and annotating PDFs.

Explore is deliberately narrow: the PDF being read is the centre of the experience. It is not a general research workspace or a second knowledge-management system.

### 3.0 Private PDF library

Students can upload PDFs from their device or import them from public HTTP(S) links. Atlas stores each document in the student's account so it remains available with its reading position, bookmarks, and annotations.

### 3.1 Reading experience

The reader is powered by a bundled PDF.js renderer. It should make long-form reading feel effortless through:

- Continuous vertical reading with stable, visible-page tracking.
- Page thumbnails and the document's own outline/bookmarks.
- Fast in-document search with clear result navigation.
- Fit-width, fit-page, and precise manual zoom.
- Keyboard navigation and a distraction-free focus mode.
- Carefully tuned paper, sepia, and dark reading themes.
- Durable reading progress so a document reopens where the student stopped.

### 3.2 PDF annotations

Annotations belong to the document and to the passage or page they mark.

The reader should support:

- Text highlights in a small, intentional colour palette.
- Underline and strike-through markup.
- Optional comments anchored to selected passages.
- A navigable annotation list that jumps back to the original page and passage.
- Reliable persistence and a downloadable copy with standard PDF annotations.

There is no standalone notes area in Explore. A comment exists only as part of an annotation on the PDF. Atlas stores annotation overlays separately and never silently modifies the original upload.

**Current reader implementation:** Atlas uses a custom PDF.js canvas/text-layer renderer with nearby-page rendering and measured page dimensions to improve mixed-size document scrolling. Reading position and bookmarks persist with the document; paper, sepia, and dark reading-surround preferences persist per document without filtering the PDF page itself. Existing annotations can be edited (mark type, colour, and comment), and failed annotation saves/edits/deletions can be retried in place. Lector was evaluated but deferred until its PDF.js peer-version guidance supports Atlas's PDF.js 6.x runtime. Automated browser coverage includes long mixed-size documents, outline/no-outline behaviour, keyboard zoom, and mobile layout; manual screen-reader, physical touch-device, and real-world PDF review remain release checks.

### 3.3 Explicit non-goals

Explore does not include topic workspaces, discovery sessions, standalone notes, whiteboards, knowledge graphs, web article capture, social features, or automatic knowledge organization. Its job is to make reading and marking up a PDF exceptionally good.

The initial reader supports PDFs up to 50 MB. New Explore PDFs are stored on the Atlas host's local filesystem; PostgreSQL stores metadata and annotations. Configure `ATLAS_PDF_STORAGE_DIR` to point to persistent disk and include that directory in backups. Existing database-backed PDFs remain readable. Password-protected documents and scanned-document OCR are not supported.

---

## 4. My Universe

**Purpose:** Act as the student's personal knowledge repository.

My Universe is intended to contain everything a student finds worth remembering.

Unlike Academics, which follows the structure of university coursework, My Universe is organised around the student's own interests and understanding.

### 4.1 Saved concepts

Students should be able to save:

- Concepts.
- Topics.
- Interesting explanations.
- Questions.
- External resources.
- Discoveries from Explore.

Saved items should support categorisation and search.

### 4.2 Notes

Notes should be available across Atlas.

Students should be able to create notes independently or attach them to:

- Subjects.
- Topics.
- Concepts.
- Exploration sessions.
- Saved resources.

Notes should support editing, timestamps, and contextual references.

The longer-term goal is to make notes interconnected rather than isolated text documents.

### 4.3 Questions

Students should be able to maintain a collection of questions.

Examples include:

- Questions they could not answer during a lecture.
- Topics they want to investigate.
- Questions discovered while exploring.
- Unresolved doubts about a concept.

Questions may eventually support statuses such as:

- Open.
- Investigating.
- Answered.
- Revisit later.

### 4.4 Knowledge connections

A defining long-term feature of My Universe is the ability to connect ideas.

Students should be able to establish relationships between concepts.

Possible relationships include:

- Related to.
- Prerequisite of.
- Builds upon.
- Contrasts with.
- Example of.
- Applied in.

For example:

```text
Gradient Descent
      │
      ├── Used in → Neural Networks
      │
      ├── Related to → Optimization
      │
      └── Builds upon → Calculus
```

Connections should be created and managed explicitly by the student.

### 4.5 Knowledge graph

A visual knowledge graph is part of the longer-term My Universe experience, after the foundational notes, saved items, questions, and explicit connections are in place. It is planned, not implemented.

---

## 5. Settings

**Purpose:** Allow students to personalise Atlas and manage their application configuration.

### Planned features

**Profile**
- User profile information.
- Display name.
- Academic information.
- University and course details.

**Academic preferences**
- Current semester.
- Academic calendar preferences.
- Default subject organisation.
- Revision preferences.

**Appearance**
- Dark and light themes, if supported.
- Accent colour preferences.
- Interface density.
- Typography preferences.

**Integrations**
- Optional Spotify study companion.
- Playlist associations for subjects or study activities.
- Integration controls that do not affect core Atlas functionality.

**Data management**
- Export personal information.
- Manage stored data.
- Account management.
- Future backup and restore functionality.

---

---

# Key User Journeys

The modules are designed around a few core workflows.

## Journey 1: Starting a new semester

1. Create a new subject.
2. Enter subject details.
3. Upload a syllabus PDF or create the syllabus manually.
4. Review the extracted or manually created hierarchy.
5. Confirm the syllabus.
6. Add examination dates.
7. Begin tracking concepts.

## Journey 2: Studying a difficult concept

1. Open a subject in Academics.
2. Navigate to a topic.
3. Select a concept.
4. Review existing notes.
5. Update understanding and recall.
6. Record confidence.
7. Identify whether additional revision is needed.

## Journey 3: Preparing for an examination

1. Open the relevant subject.
2. Review its syllabus.
3. Check the concept progress distribution.
4. Identify weak or unassessed concepts.
5. Review concepts with poor recall.
6. Follow revision recommendations.
7. Update progress as understanding improves.

## Journey 4: Exploring something outside the syllabus

1. Open Explore.
2. Import or open a PDF that interests you.
3. Read, search, bookmark, and annotate useful passages.
4. Save a relevant discovery or source reference to My Universe.
5. Add a note or question about the idea.
6. Connect it to existing knowledge when a useful relationship becomes clear.

## Journey 5: Building a personal knowledge network

1. Save concepts from Academics or Explore.
2. Create personal notes.
3. Link related concepts.
4. Organise saved knowledge.
5. Explore the resulting network of ideas.

---

# System Architecture

Atlas is intended to follow a **modular monolith architecture**.

The application is divided into logical modules, but they share a common backend, authentication system, and database.

This approach keeps the initial development and deployment manageable while preserving the ability to separate services later if the application genuinely requires it.

## High-level architecture

```text
                     User
                      │
                      ▼
              Next.js Frontend
                      │
                      ▼
                 REST API
                      │
                  FastAPI
                      │
        ┌─────────────┼─────────────┐
        │             │             │
     Academics     Explore       My Universe
        │             │             │
        └─────────────┼─────────────┘
                      │
                Shared Services
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   Authentication  Application services   File Processing
        │             │             │
        └─────────────┼─────────────┘
                      │
                  PostgreSQL
```

### Frontend

The frontend is responsible for:

- Rendering the user interface.
- Navigation between modules.
- Managing local interaction state.
- Displaying academic and personal knowledge.
- Communicating with the backend through API requests.
- Providing responsive layouts.

### Backend

The backend is responsible for:

- Authentication and authorisation.
- Business logic.
- Data validation.
- Subject and syllabus management.
- Concept progress.
- Examination management.
- Personal knowledge management.
- File processing.

### Database

PostgreSQL acts as the primary relational database.

It stores structured application information such as:

- Users.
- Subjects.
- Syllabi.
- Topics.
- Concepts.
- Progress records.
- Examinations.
- Notes.
- Saved items.
- Knowledge connections.

### File processing

File processing is intended to handle uploaded documents such as syllabus PDFs.

The initial implementation should focus on text-based PDF extraction and heading detection.

More advanced processing, including OCR and document understanding, can be introduced independently.

---

# Technology Stack

The current project uses the following technologies.

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend framework | Next.js | Web application |
| UI library | React | Component-based interface |
| Language | TypeScript | Frontend type safety |
| Styling | CSS | Visual design and layouts |
| Icons | Lucide React | Interface icons |
| Desktop shell | Tauri v2 / Rust | Native window and local service lifecycle |
| Desktop database | SQLite | Local structured data |
| Backend framework | FastAPI | REST API |
| Backend language | Python | Application logic |
| ORM | SQLAlchemy | Database interaction |
| Database | PostgreSQL | Persistent storage |
| Containerisation | Docker | Local infrastructure |
| API communication | HTTP / REST | Frontend-backend communication |

Additional technologies may be introduced as individual modules mature.

The architecture should favour lightweight dependencies and avoid adding infrastructure without a clear requirement. The desktop target is Tauri v2: a bundled Next.js frontend and FastAPI sidecar, SQLite for desktop structured data, and PDF files stored under the operating system's per-user Atlas application-data directory. PostgreSQL remains the development and CI database.

---

# Data Model

The following describes the intended logical data model. It includes both existing academic structures and planned application entities.

The exact implementation may evolve as features are developed.

## Core entities

### User

Represents an Atlas account.

Suggested fields:

- `id`
- `email`
- `password_hash`
- `display_name`
- `created_at`
- `updated_at`

### Subject

Represents a university subject belonging to a user.

Suggested fields:

- `id`
- `user_id`
- `name`
- `description`
- `semester`
- `created_at`
- `updated_at`

### SyllabusVersion

Represents a version of a subject's syllabus.

Suggested fields:

- `id`
- `subject_id`
- `version_name`
- `source_file`
- `extracted_content`
- `created_at`

### Topic

Represents a topic, unit, chapter, or subtopic.

Suggested fields:

- `id`
- `subject_id`
- `parent_topic_id`
- `name`
- `description`
- `position`
- `created_at`
- `updated_at`

The `parent_topic_id` field enables hierarchical topic structures.

### Concept

Represents an individual learning concept.

Suggested fields:

- `id`
- `topic_id`
- `name`
- `description`
- `created_at`
- `updated_at`

### ConceptProgress

Stores a user's progress for a concept.

Suggested fields:

- `id`
- `user_id`
- `concept_id`
- `exposure`
- `understanding`
- `recall`
- `confidence`
- `last_reviewed_at`
- `notes`
- `updated_at`

A unique constraint should prevent duplicate progress records for the same user and concept.

### Exam

Represents an examination or assessment.

Suggested fields:

- `id`
- `user_id`
- `subject_id`
- `title`
- `exam_date`
- `description`
- `created_at`
- `updated_at`

## Planned knowledge entities

### ExplorationSession

Stores a learning or discovery session.

Suggested fields:

- `id`
- `user_id`
- `title`
- `description`
- `created_at`
- `updated_at`

### ExplorationItem

Stores individual concepts, questions, or resources associated with a session.

### Note

Stores user-created notes and their contextual associations.

Suggested fields:

- `id`
- `user_id`
- `title`
- `content`
- `created_at`
- `updated_at`

### SavedItem

Represents a saved concept, topic, resource, or discovery.

### KnowledgeConnection

Represents a relationship between two knowledge entities.

Suggested fields:

- `id`
- `user_id`
- `source_type`
- `source_id`
- `target_type`
- `target_id`
- `relationship_type`
- `created_at`

---

# API Design

The backend exposes a versioned REST API.

The intended API prefix is:

```text
/api/v1
```

The API should follow consistent conventions for:

- Authentication.
- Request validation.
- Response structures.
- Error handling.
- Resource ownership.
- Pagination where required.

## Academics endpoints

The following describes the intended API surface.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/subjects` | List subjects |
| POST | `/subjects` | Create subject |
| GET | `/subjects/{id}` | Retrieve subject |
| PATCH | `/subjects/{id}` | Update subject |
| DELETE | `/subjects/{id}` | Delete subject |
| GET | `/subjects/{id}/topics` | List topic hierarchy |
| POST | `/subjects/{id}/topics` | Create topic |
| PATCH | `/topics/{id}` | Update topic |
| DELETE | `/topics/{id}` | Delete topic |
| GET | `/subjects/{id}/concepts` | List subject concepts |
| POST | `/topics/{id}/concepts` | Create concept |
| DELETE | `/concepts/{id}` | Delete concept |
| GET | `/concepts/{id}/progress` | Retrieve progress |
| PATCH | `/concepts/{id}/progress` | Update progress |
| GET | `/subjects/{id}/readiness` | Retrieve readiness summary |
| GET | `/exams` | List examinations |
| POST | `/exams` | Create examination |
| PATCH | `/exams/{id}` | Update examination |
| DELETE | `/exams/{id}` | Delete examination |

## Planned API groups

**Syllabus**
- Upload syllabus.
- Extract document content.
- Retrieve extraction results.
- Confirm extracted hierarchy.
- Manage syllabus versions.

**Explore**
- Private PDF library with local upload and public-URL import.
- PDF.js reading room with continuous scrolling, page thumbnails, document outline, in-document text search, zoom and fit controls.
- Persistent reading position, bookmarks, text highlights, page-linked annotations and notes, and distraction-free focus mode.
- Create exploration sessions.
- Retrieve exploration sessions.
- Update sessions.
- Add and remove exploration items.

**My Universe**
- Create and manage notes.
- Save and retrieve concepts.
- Manage questions.
- Create and manage knowledge connections.


All user-owned resources must be checked against the authenticated user. Knowing a resource ID must never be sufficient to access another user's data.

---

# Design System

Atlas uses a dark, celestial-inspired visual identity.

The interface should feel calm, spacious, and focused on learning.

### Visual direction

- Deep navy backgrounds.
- Warm ivory text.
- Muted gold for restrained emphasis.
- Teal, blue, lilac, and coral for semantic colour variation.
- Clear typography and generous spacing.
- Subtle transitions and animations.
- Minimal decorative effects.

### Colour semantics

| Colour | Intended use |
|---|---|
| Navy | Primary application background |
| Ivory | Primary text |
| Muted gold | Highlights and selected emphasis |
| Teal | Positive progress and learning activity |
| Blue | Academic information and navigation |
| Lilac | Exploration and discovery |
| Coral | Attention, weak areas, and warnings |

Colours should communicate meaning rather than exist solely for decoration.

### Interaction principles

- Transitions should feel smooth and intentional.
- Interactive elements should provide clear feedback.
- Important text should remain readable.
- Animations should not interfere with navigation.
- Responsive behaviour should work across desktop, tablet, and mobile layouts.
- Empty states should guide users towards meaningful actions.

The application should avoid excessive gradients, glowing effects, and visual clutter.

---

# Privacy and Data Principles

Atlas contains personal academic information and potentially sensitive learning records.

The following principles should guide development:

1. Users should only be able to access their own private resources.
2. Authentication credentials must be securely hashed.
3. Users should retain control over their stored information.
4. Destructive actions should have appropriate safeguards.
5. Academic readiness should be based on recorded data rather than fabricated estimates.

Privacy and security should be considered at the design stage rather than added as an afterthought.

---

# Development Status

Atlas is being developed incrementally. The product vision is broader than the current implementation; this snapshot distinguishes working functionality from planned work.

| Component | Status |
|---|---|
| Next.js application and celestial design foundation | Implemented |
| Authentication and subject management | Implemented |
| Home overview, calendar, date notes and quotations | Implemented |
| Manual syllabus construction and PDF syllabus import/review | Implemented |
| Syllabus versioning, concept review history and prerequisites | Implemented |
| Academic readiness and examination management | Implemented |
| Explore private PDF library and PDF.js reader | Implemented |
| PDF bookmarks, annotations, editing and annotated-copy export | Implemented |
| Large-document nearby-page virtualization | Implemented; further performance work planned |
| FastAPI desktop sidecar and SQLite runtime | Implemented |
| Tauri desktop release pipeline | Implemented; installed-app validation remains |
| Tauri user-data compatibility with the legacy Atlas profile | Implemented in runtime; real upgrade validation remains |
| Configurable managed PDF library location | Planned |
| Efficient authenticated PDF byte-range delivery | Planned |
| Balanced Explore library, reader and large-document refinement | In progress |
| My Universe: notes, saved resources, questions and connections | Planned |
| My Universe visual knowledge graph | Planned |
| Optional Spotify study companion | Planned |
| Data export, backup and restore | Planned |
| Built-in AI integrations or chatbot | Out of scope |

*Implemented does not mean every platform and real-world edge case has completed manual release validation. See [the architecture](docs/ARCHITECTURE.md) and [the active backlog](docs/TODO.md) for precise status.*

---

# Roadmap

The roadmap reflects the current product decisions:

- **Reliability first.** Protect local data and make the desktop runtime predictable before expanding the product.
- **Tauri v2** is the desktop target.
- **Managed PDF storage.** Users will choose where Atlas keeps its managed PDF library; Atlas will own the directory structure and migration.
- **Explore gets balanced investment** across the library experience, reading/annotation ergonomics, and large-document performance.
- **My Universe is a full personal knowledge environment:** notes, saved concepts/resources, questions, explicit relationships, search, and eventually a visual graph.
- **Spotify is an optional study companion.** It must never be required for Atlas to work.
- **No built-in AI integrations or chatbot.** Atlas remains user-directed and explainable.

## Phase 1 — Desktop reliability

- Validate Tauri startup, health checks, process shutdown, and diagnostics.
- Verify SQLite migrations from the previous desktop schema.
- Verify the legacy Atlas user-data directory is reused.
- Test clean installation, relaunch, upgrade, and uninstall/reinstall on supported platforms.
- Verify that databases, PDFs, reading positions, bookmarks, annotations, and the instance secret survive upgrades.
- Reconcile desktop documentation with the shipped runtime and release workflow.

## Phase 2 — Managed PDF storage

- Add a native Tauri folder picker for the parent location of an Atlas-managed PDF library.
- Keep the current profile-local PDF directory as the default.
- Persist storage configuration outside the database.
- Migrate existing PDFs using a journalled copy-and-verify workflow with checksums.
- Preserve originals until the new library is verified and the database points to it safely.
- Handle missing drives, permission changes, insufficient space, interrupted copies, and recovery.
- Keep hosted/server storage configured through `ATLAS_PDF_STORAGE_DIR`.

## Phase 3 — Explore reliability and experience

- Implement authenticated HTTP Range delivery and URL-based PDF.js loading.
- Audit rendering lifecycle, lazy text extraction, cancellation, and memory cleanup.
- Improve document library organisation and navigation.
- Refine reading and annotation interactions without broadening Explore into a second knowledge-management system.
- Validate long, mixed-dimension and representative real-world PDFs.
- Complete manual screen-reader and physical touch-device checks.

## Phase 4 — My Universe

- Implement independent notes and contextual links to subjects, concepts, documents, and saved resources.
- Add saved concepts, topics, resources, and discoveries.
- Add personal questions with investigation/revisit states.
- Add explicit typed relationships between knowledge items.
- Add unified search and a useful personal knowledge home.
- Introduce a visual knowledge graph after the underlying data model and retrieval workflows are dependable.

## Phase 5 — Integrations and refinement

- Add an optional Spotify study companion, beginning with playlists associated with study activities or subjects.
- Keep Spotify authentication and availability separate from core Atlas functionality.
- Add playback/session controls only where supported and useful.
- Complete accessibility, responsive UX, performance, and data portability work.

## Implementation sequence

| PR | Focus |
|---|---|
| 1 | Tauri desktop runtime reliability and migration validation |
| 2 | Configurable managed PDF storage and safe migration |
| 3 | Authenticated PDF byte-range delivery |
| 4 | Balanced Explore performance, library and reader refinement |
| 5 | My Universe foundations: notes, saved items and questions |
| 6 | My Universe connections, graph and unified search |
| 7 | Optional Spotify study companion |

## Desktop application

Tauri v2 is the desktop release target. The release workflow builds Windows x64 NSIS, macOS Intel and Apple Silicon DMGs, and Linux x64 AppImage/DEB installers. The bundled application consists of:

- A Rust/Tauri native shell that manages the window and local service lifecycle.
- A bundled FastAPI sidecar.
- A bundled Node runtime and Next.js standalone frontend.
- SQLite for desktop structured data.
- An Atlas-managed PDF directory under the per-user application-data profile.

The Tauri runtime intentionally reuses the legacy Electron `Atlas` profile location to avoid creating a second empty profile after migration. The release workflow has switched to Tauri, but clean-install, real upgrade, relaunch, and uninstall/reinstall checks remain release-readiness requirements. Installers are currently unsigned. See [desktop-tauri/README.md](desktop-tauri/README.md) for build and validation details.

# Running Locally

Atlas is designed to be developed locally with a Next.js frontend, a FastAPI backend, and PostgreSQL.

## Prerequisites

- Node.js and npm.
- Python 3.
- Docker and Docker Compose.
- Git.

## Clone the repository

```bash
git clone https://github.com/NJWasTaken/atlas.git
cd atlas
```

## Start the database

Use the repository's Docker Compose configuration:

```bash
docker compose up -d
```

The exact database configuration, ports, and credentials should be taken from the project's Compose and environment configuration.

## Backend setup

Create and activate a Python virtual environment:

```bash
cd backend

python -m venv .venv
```

On Windows:

```powershell
.venv\Scripts\activate
```

On macOS or Linux:

```bash
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Configure the required environment variables using the repository's environment template.

Start the development server using the project's FastAPI entry point. For the standard application entry point:

```bash
uvicorn app.main:app --reload
```

The API documentation should be available at:

```text
http://localhost:8000/docs
```

## Frontend setup

Open a separate terminal:

```bash
cd frontend
npm install
```

Configure the frontend environment variables using the repository's environment template.

Start the development server:

```bash
npm run dev
```

The frontend is typically available at:

```text
http://localhost:3000
```

> **Note:** These are the intended local development steps. Environment variable names, database configuration, migration commands, and any project-specific startup scripts should be verified against the current repository files.

---

# Project Structure

The project is organised into separate frontend and backend applications.

An indicative structure is:

```text
atlas/
│
├── frontend/
│   ├── app/
│   │   ├── components/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── lib/
│   │   └── api.ts
│   │
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
│
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── subjects.py
│   │   │   └── academics.py
│   │   │
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── academics_models.py
│   │   ├── academics_schemas.py
│   │   ├── db.py
│   │   └── security.py
│   │
│   └── requirements.txt
│
├── docker-compose.yml
├── README.md
└── .gitignore
```

This is a representative structure, not a guarantee that every planned module already has a corresponding directory or file.

As the application grows, frontend and backend modules should be organised by responsibility rather than allowing the main application files to become monolithic.

---

# Contributing

Atlas is an evolving project. New features should support the overall goal of creating a cohesive personal learning environment.

When implementing a new feature:

1. Identify the module it belongs to.
2. Define how it interacts with existing modules.
3. Keep business logic in the backend where appropriate.
4. Reuse shared components and services.
5. Preserve the existing visual identity.
6. Ensure user-owned resources are properly authorised.
7. Add validation and meaningful error handling.
8. Update documentation when behaviour or architecture changes.
9. Test the implementation before marking it complete.

### Architectural guidelines

- Prefer modularity over unnecessary microservices.
- Keep academic progress data explicit and explainable.
- Preserve user control over generated or extracted information.
- Avoid introducing mandatory paid dependencies.
- Use database migrations when changing existing schemas.
- Do not silently discard user data during structural changes.

---

# The Bigger Picture

Atlas is ultimately an attempt to make learning feel like something students own.

A university syllabus provides structure. Examinations provide deadlines. Academics helps students manage those responsibilities.

But learning does not stop at the end of a semester.

The things a student discovers while studying, the questions they develop, the connections they make, and the concepts they revisit over time should have a place of their own.

Atlas aims to bring all of that together.

**Not just a place to track what you've studied, but a place to build what you know.**

---

*Atlas — Learn with direction. Explore without limits.*