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
- [AI Gateway](#ai-gateway)
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
- An AI-assisted interface that helps students learn without locking them into a particular AI provider.

The application is not intended to replace university learning platforms, note-taking applications, or AI chatbots individually. Its purpose is to provide a cohesive environment that connects these activities.

## What Atlas is not

Atlas is not intended to become:

- Another generic to-do list with an academic theme.
- A platform that measures learning exclusively through streaks or hours spent studying.
- An AI chatbot wrapped around a university syllabus.
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
- AI should assist learning rather than become a mandatory dependency.
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
- Recently edited knowledge nodes and notes.
- Recently saved research sources.
- Questions and topics the student wants to revisit.

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

**Purpose:** Provide an environment for independent learning beyond university coursework.

Explore is where students can follow curiosity without needing to justify every activity through examination preparation.

It should support both spontaneous discovery and structured exploration.

### 3.0 PDF reading library

Explore includes a private PDF reading library for independent study.

Students can upload PDFs from their device or import them from public HTTP(S) links. Atlas stores the document in the student's account so it remains available with reading progress, bookmarks, and notes.

The reading workspace is powered by a bundled PDF.js renderer rather than the browser's built-in viewer. It provides smooth continuous scrolling, page thumbnails, PDF document outline, in-document text search, zoom, fit-to-width, fit-to-page, and a distraction-free focus mode. Atlas tracks the visible page while scrolling and persists reading progress and page bookmarks. Students can select text, save page-relative highlights, and attach notes to either a page or a selected passage.

The initial reader supports PDFs up to 12 MB. Password-protected documents and scanned-document OCR are not supported. Highlights and notes are stored by Atlas as document annotations; they do not modify the underlying PDF file.

### 3.1 User-built knowledge graph

Explore is centred on a personal, interactive 3D knowledge graph rendered with Three.js.

The graph is built by the student, not generated automatically. Students can create and edit nodes such as:

- Topics and concepts.
- Questions and unresolved doubts.
- Personal notes and claims.
- External sources.

Students can drag nodes into their preferred positions and create labelled, directed connections between them. Example relationship labels include:

- Related to.
- Builds upon.
- Prerequisite of.
- Contrasts with.
- Supports.
- Example of.
- Quoted from.

Node positions, notes, source links, and relationships are persisted in the student's account. The graph is intended to be a working model of the student's own understanding, not an automatically generated mind map.

### 3.2 Integrated research browser

Explore combines web search and reading with the knowledge graph.

The intended workflow is:

1. Search the web from inside Explore.
2. Open a result in Atlas's built-in article reading view.
3. Read the extracted page without leaving the research workspace.
4. Save a source as a graph node.
5. Select a passage and capture it as a personal note linked to its source.
6. Connect that source or note to other ideas in the graph.

Web search is provided through the keyless DuckDuckGo wrapper (`ddgs`) on the backend, using India/English search defaults. No API key or subscription is required. Because this is an unofficial wrapper over a public search service, requests may be throttled; Atlas bounds result counts and timeouts and reports retryable rate limits. Search results are transient; only sources explicitly saved by the student are added to their knowledge graph.

The built-in reader fetches public HTML pages and extracts their readable article content. It is not a full Chromium browser: websites that require client-side JavaScript, authentication, or block server-side access may need to be opened in the original browser. PDFs remain supported through the dedicated PDF reading library.

### 3.3 Student-controlled exploration

The student decides what belongs in the graph and how ideas relate. Atlas does not automatically create nodes, infer relationships, or rewrite personal notes. AI-assisted suggestions may be considered later as an opt-in enhancement, after the manual knowledge-building workflow is dependable.

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
- Knowledge graph nodes and source references.
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

Connections should be created and managed by the student, with AI-assisted suggestions available as an optional enhancement.

### 4.5 Knowledge graph

The primary student-built 3D knowledge graph now lives in Explore, where independent research, source reading, notes, and manually created relationships come together. My Universe may later provide broader views over that shared knowledge, including filters across academic subjects, personal notes, and independently explored ideas.

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

**AI providers**
- Configure supported AI providers.
- Manage provider preferences.
- Add API credentials where applicable.
- Select a preferred provider.
- Configure model preferences.

**Data management**
- Export personal information.
- Manage stored data.
- Account management.
- Future backup and restore functionality.

---

# AI Gateway

The AI Gateway is a cross-application capability rather than a standalone chatbot module.

Its purpose is to provide a common interface between Atlas and external AI providers.

Atlas should not require users to depend on a single AI provider.

### Design goals

- Support multiple AI providers.
- Keep provider integration separate from application logic.
- Allow provider selection.
- Support contextual prompts.
- Avoid mandatory paid API dependencies.
- Allow the application to function without AI integrations.

### Provider abstraction

The intended architecture is:

```text
             Atlas
               │
          AI Gateway
               │
       Provider Interface
               │
       ┌───────┼────────┐
       │       │        │
     OpenAI  Anthropic  Gemini
       │       │        │
       └───────┼────────┘
               │
        Other Providers
```

Each provider should implement a common interface so that application features do not need to know the details of individual APIs.

### Contextual prompts

The AI Gateway should eventually be able to construct prompts using relevant application context.

Depending on the user's request, this may include:

- Current subject.
- Relevant syllabus topics.
- Selected concept.
- Existing notes.
- Exploration history.
- Saved knowledge.
- User-defined learning preferences.

Only relevant context should be included.

### Avoiding mandatory API costs

A major design consideration is avoiding mandatory paid API keys.

Atlas should support an experience where students can use their preferred external AI applications when direct API access is unavailable or undesirable.

A possible approach is an AI handoff workflow:

1. Atlas constructs a contextual prompt.
2. The student chooses an external AI provider.
3. Atlas opens the selected provider with the prompt where supported.
4. The student continues the interaction externally.

Direct API integrations can be added as optional capabilities.

The application must remain useful without them.

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
2. Search for an interesting topic or ask a question.
3. Open useful sources in the integrated research reader.
4. Capture important passages as personal notes.
5. Create concepts, questions, and claims in the graph.
6. Connect the ideas with relationships that you define.

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
   Authentication  AI Gateway   File Processing
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
- AI provider integrations.
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
| Backend framework | FastAPI | REST API |
| Backend language | Python | Application logic |
| ORM | SQLAlchemy | Database interaction |
| Database | PostgreSQL | Persistent storage |
| Containerisation | Docker | Local infrastructure |
| API communication | HTTP / REST | Frontend-backend communication |

Additional technologies may be introduced as individual modules mature.

The architecture should favour lightweight dependencies and avoid adding infrastructure without a clear requirement.

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

### AIProviderConfiguration

Stores user-specific AI provider preferences and configuration metadata.

Sensitive credentials should be handled securely and never exposed through ordinary API responses.

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
- User-owned knowledge graph node and labelled-edge CRUD with persisted 3D positions.
- Three.js graph canvas with node dragging, orbit/zoom, connection creation, and connection inspection/removal.
- Brave Search API proxy and a built-in public-HTML article reader with an address bar.
- Save sources and capture selected passages as personal notes linked to their source.
- Search results remain transient; saved graph content is explicitly user-selected.

**My Universe**
- Create and manage notes.
- Save and retrieve concepts.
- Manage questions.
- Create and manage knowledge connections.

**AI Gateway**
- Retrieve supported providers.
- Manage provider preferences.
- Generate contextual prompts.
- Perform provider handoffs.
- Execute direct AI requests when configured.

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
3. API credentials for external AI providers must not be exposed to the frontend unnecessarily.
4. Personal notes and learning records should not be sent to AI providers without an intentional feature requiring that context.
5. Context sent to AI providers should be limited to what is relevant.
6. Users should retain control over their stored information.
7. Destructive actions should have appropriate safeguards.
8. AI-generated content should be distinguishable from user-authored information.
9. Academic readiness should be based on recorded data rather than fabricated estimates.

Privacy and security should be considered at the design stage rather than added as an afterthought.

---

# Development Status

Atlas is being developed incrementally.

The product vision is broader than the current implementation. The following table distinguishes the intended features from the work that has actually been started.

**Status definitions**

- **Implemented:** A working implementation exists in the project.
- **Partial:** The basic functionality exists, but the complete intended experience is not available.
- **Planned:** Part of the product design, but not yet implemented.
- **Future:** A longer-term enhancement.

| Component | Status |
|---|---|
| Next.js application foundation | Implemented |
| Dark celestial design foundation | Implemented |
| User authentication | Implemented |
| Subject CRUD | Implemented |
| PostgreSQL integration | Implemented |
| Docker database setup | Implemented |
| Home dashboard | Partial |
| Academic calendar | Partial |
| Calendar day notes | Partial |
| Rotating quotations and transitions | Partial |
| Academics backend models | Partial |
| Topic hierarchy | Partial |
| Concept management | Partial |
| Concept progress tracking | Partial |
| Academic readiness | Partial |
| Examination management | Partial |
| Subject workspace UI | In progress |
| Manual syllabus creation | Partial |
| PDF syllabus extraction | Planned |
| Syllabus review and confirmation | Planned |
| Syllabus versioning | Planned |
| Revision recommendation engine | Planned |
| Prerequisite awareness | Future |
| User-built 3D knowledge graph | Implemented |
| Integrated web search and article reader | Partial |
| Exploration sessions | Superseded by the user-built graph |
| AI Gateway | Planned |
| External AI provider handoff | Planned |
| Direct AI API integrations | Planned |
| My Universe | Planned |
| Personal notes system | Planned |
| Saved concepts and resources | Planned |
| Knowledge connections in Explore | Implemented |
| My Universe graph views and cross-module filters | Future |
| AI-assisted knowledge connections | Future |
| Data export and backup | Future |

*This is a project-level status snapshot, not a claim that every partially implemented feature has been fully tested or production-hardened. Verify the current repository before treating an item as complete.*

---

# Roadmap

The development roadmap prioritises a useful academic foundation before introducing more advanced discovery and AI capabilities.

## Phase 1 — Foundation

- Establish the application structure.
- Set up authentication.
- Integrate PostgreSQL.
- Create the primary navigation.
- Establish the visual design system.
- Implement the Home dashboard.
- Implement subject management.

## Phase 2 — Academics

- Complete the subject workspace.
- Implement topic hierarchy management.
- Implement concept management.
- Implement concept progress tracking.
- Implement academic readiness summaries.
- Integrate examination management.
- Support manual syllabus creation.

## Phase 3 — Syllabus Intelligence

- Implement PDF upload.
- Extract text from syllabus documents.
- Detect headings and hierarchy.
- Preserve page references.
- Flag uncertain extraction results.
- Build the syllabus review interface.
- Allow users to confirm and save extracted structures.
- Introduce syllabus versioning.

## Phase 4 — Revision and Academic Intelligence

- Develop explainable revision recommendations.
- Improve examination-aware revision suggestions.
- Introduce review history.
- Explore spaced-repetition scheduling.
- Introduce prerequisite relationships.
- Improve academic progress visualisation.

## Phase 5 — Explore

- Build out the user-owned 3D knowledge graph and manual relationship workflows.
- Integrate web search and an in-app research reader.
- Connect PDF documents and page annotations to graph sources.
- Add graph filtering, saved-knowledge search, and larger-graph navigation.
- Link knowledge nodes to academic subjects, topics, and concepts.
- Keep AI-assisted suggestions optional and defer direct integrations.

## Phase 6 — My Universe

- Build a broader personal knowledge repository over the shared graph.
- Add cross-module collections, filters, and retrieval.
- Expand independent notes and personal questions.
- Connect personal knowledge to academic concepts without duplicating canonical records.

## Phase 7 — AI Gateway

- Establish a provider abstraction.
- Implement contextual prompt construction.
- Support external AI handoffs.
- Add optional direct provider integrations.
- Introduce AI-assisted discovery and knowledge organisation.

## Phase 8 — Refinement

- Improve search across the application.
- Introduce data export and backup.
- Improve mobile experience.
- Improve accessibility.
- Add automated testing.
- Improve performance and reliability.
- Evaluate deployment and production requirements.

---

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

Configure the required environment variables using the repository's environment template. To enable the integrated web search in Explore, set `BRAVE_SEARCH_API_KEY` in the backend environment. Search remains unavailable when this optional key is not configured. Keep the key server-side; do not add it to a `NEXT_PUBLIC_` variable.

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
- Avoid tightly coupling frontend components to individual AI providers.
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