# ClassPilot — Functional Requirements and Product Specification

**Revision:** 1.0 • **Primary audience:** development agents and reviewers • **Target:** Windows desktop, offline first, reusable by Moroccan primary school teachers and potentially others.

## 1. Purpose

Build an installable, maintainable Windows application for managing teacher-defined subjects, competency mastery, placement/positioning frameworks, pre-tests and post-tests, classroom observations, student work, original and remedial groups, progress charts, pedagogical reports, and teacher-approved AI weekly remediation plans. The product should make it fast to answer: **Where is this learner now? Which specific competencies have they demonstrated? What intervention should be tried next?**

Main learning cycle: diagnostic → explicit teaching → observation → assessment → remediation → reassessment → adjustment.

**Important:** Do not hard-code a single school, grade, curriculum, set of subjects, 39 pupils or the two example groups. Those are sample workflows, not implementation limits.

## 2. Users and organizational scope

- Teacher profile: isolated data, interface language, optional school info, academic years, grade/classes.
- Class enrollment: students may move across classes/academic years while previous records survive.
- Subject configuration belongs to a teacher and potentially to a class/year; initial setup offers checkbox list and custom subjects.
- Initially single local teacher profile is acceptable; design clean boundary for future multi-teacher use.
- For demo, 39 **fictional** students: Group 1 = 20; Group 2 = 19. Real counts configurable.

## 3. Initial setup

Flow: secure teacher workspace creation → language (Arabic/French/English) → year/grade/classes → subject checkboxes → competency library → positioning-level library → import/add students → teaching timetable → dashboard. Support later reconfiguration without deleting past work.

### Subject activation — strict requirement

- **Multiple checkboxes** select which subjects appear. Not a single-select dropdown.
- All activated subjects appear **simultaneously** on overall and individual dashboards.
- Unchecked subjects should be ignored by working assessments, default analyses, weekly planning, and menus except settings/catalog.
- Reactivation restores historical associations; deactivation doesn't delete them.
- Examples: Mathematics, French, Arabic, Scientific Activity; other teachers may choose English, Social Studies, Islamic Education, Arts, etc.

## 4. General dashboard

- View All Students, Group 1, Group 2, and any additional teacher-defined original group **independently**.
- Group selection scopes summary stats, student roster, subject-level charts and reports; no fake aggregation.
- Top summary: number of enrolled students, recently assessed, awaiting assessment, targeted remediation, plan approvals.
- A card/section for **every active subject at once** with positioning distributions, competency mastery, recent assessment summaries and current priority competencies.
- Charts: positioning level distribution at start/current; comparable pre-test vs post-test; progress by competency; breakdown by group; students who need re-assessment.
- Filters by class/year/time range and suitable drill-down.
- Distinguish unknown/not assessed from failed/not mastered.

## 5. Individual student dashboard — layout priority

**At the very top, alongside student identity**, display summary of: baseline **pre-test/test de positionnement**, current/latest positioning, assessment dates and a concise comparison for each activated subject. These assessment summaries are pedagogical facts, NOT permanent legal identity fields. They update when a new valid test is added. Display original group separately from remediation group(s).

Immediately below: cards for every active subject simultaneously, with positioning, current competencies, progress, recent comments and next intervention. Each expands to competency list, assessment history, notes and work.

Sections in detail:
- Private identity header (full name, optional national pupil ID only stored locally, teacher/class/year, private random internal ID).
- Placement and pre/post positioning summary **above the fold**, per active subject.
- Mastery competency breakdown: not assessed / not acquired / with guidance / independent / consolidated. Teacher-configurable scale.
- Chronological assessment timeline (not overwritten), side-by-side test comparison, charts only for comparable instruments/versions.
- Dated observations/logs in Arabic/French/English; attach local files and link to competency, teaching stage and intervention.
- Intervention history, peer partner, remedial group memberships, current teacher-approved weekly plan and follow-up outcomes.
- Quick add assessment, quick add observation, quick change competency status with explicit evidence.

## 6. Competency Manager — per active subject

Teacher may upload annual progression and lesson files (PDF, PowerPoint, Word, Excel), or start manually. AI can **suggest** competencies with source page/slide where feasible, but imported content needs teacher approval before becoming official definitions.

Teacher controls: add/edit/reorder/group/split/merge/archive/restore/deactivate/reactivate competencies; assign title, rich description, grade, subject, domain, period/unit, observable criteria, prerequisites, assessment instrument, mastery thresholds and provenance. Maintain stable ID and versions when definitions/thresholds change. Allow copy/export/import of definitions for other teachers without personal pupil data.

When activated, competency appears in all relevant students' subject cards as `Not assessed` unless a valid historic result already exists. When archived, no new default tracking; old evidence kept. A `mastered` status cannot be inferred merely because a student has a high positioning level.

**Historical tracking:** every competence assessment/observation should be recorded as an append-only, dated evidence/event record, from which current state is derived. Track who changed state and why; allow correction with traceable change record rather than silently overwriting history.

## 7. Positioning-Level Manager — per active subject

Distinct from competencies. Support frameworks per subject, grade or remediation phase with level definitions and ordered progression **only when meaningful**. Teacher can create/edit/reorder/archive/restore levels, define descriptive text, observable behaviors, tasks, promotion criteria, source/period, optional associated competencies, prerequisites, and version history.

Example French only (teacher must validate): `Débutant` → `Lettre` → `Syllabe` → `Mots simples 1` → `Mots simples 2` → `Phrase`. Do not assume official national wording or thresholds. AI must see **level criteria and descriptions**, not just labels. Other subjects may need categorical or non-linear levels; do not force a one-dimensional hierarchy.

Changing the level framework must not rewrite historic student results from earlier versions. Provide compatible-comparison warnings.

## 8. Assessments

- Supported assessment types: `test de positionnement initial / pré-test`, intermediate, `post-test`, competency assessment, follow-up reassessment, teacher custom types.
- Each assessment: date, subject, student, teacher/class/year, framework+version, optional level, item scoring/rubric, competencies assessed, comments, source/evidence and metadata.
- Chronological history, multiple assessments over time, pre/post side-by-side where comparable, proper missing data handling.
- Individual entry from student profile and **fast whole-class/group assessment grid** with keyboard navigation, save and validation.
- Excel/CSV import with header mapping, preview, error reporting and deduplication; no automated accidental overwrite of past tests.
- Different instruments, criteria or framework versions must not be presented as straightforward numeric growth unless comparability established.

## 8A. Import Center — essential independent module

The application must contain a fully functional **Import Center** for teachers' existing educational files, not only a PDF curriculum extractor or one Excel import button. It covers XLSX/CSV student rosters, initial/ongoing/post-test results, competency assessments, competency libraries, positioning levels and descriptions, original/remediation group membership, observations/interventions and teaching timetables. Annual/weekly teaching progressions must be ingestible as PDF, Word, PowerPoint and Excel documents, with human-reviewed extraction.

Imports must be usable in onboarding and through the main sidebar. Show sheet selection, configurable column mapping (French/Arabic/English), import preview, validation, duplicate detection, errors, confirmation, transaction-safe save, import history and rollback/correction. Preserve old assessments and group/competency versions. Do not send names/Massar/student data to external AI. For exact matrix, workflow and test criteria, read **`docs/IMPORT_CENTER_SPEC.md`**. This module is **not complete in v0.1**.

## 9. Journals and student work

- Fast teacher-entry form: subject, student/group, competency, date, stage of instruction (opening, modeling, guided practice, independent practice, closing, reassessment), qualitative performance, remarks, attachments.
- Teacher-defined frequently used remark templates.
- Full text search, filter by subject/competency/date; secure local attachment management.
- Never send raw attached work to AI by default; apply explicit permission and removal of identifying information.

## 10. Original groups, remediation groups, peer learning

- Original Group 1 / Group 2 (20/19 example) persist independently from other groups and may be used as filters for assessment grid and charts.
- Remediation group membership **per subject**, with effective dates, objectives and interventions; keep membership history.
- Teacher can create and change peer pairs; optional recommendations require approval.
- Optional seating arrangement / desk view later; not core blocker.

## 11. Pedagogical plans and scheduling

- Teacher enters timetable with sessions/week, duration, actual meeting days and subject-specific constraints (example config six French, five Mathematics, two Scientific Activity sessions; do not hard-code).
- Weekly plans reflect **actual upcoming progression**, individual evidence, diagnosed prerequisites and previous intervention outcomes.
- Support explicit instruction: opening, modeling, guided practice, independent work, closing/check.
- Individual and group plans with target competency, baseline/position, activity, materials, differentiation, duration/frequency, measurable success criterion, reassessment plan, evidence references.
- Plan states: Proposed → Teacher edited/approved → Scheduled → Delivered → Evaluated; Reject/Regenerate with clear history.
- AI may propose regrouping or prioritization, not autonomously change outcomes or classifications.
- Distinguish rule-based demo planning in current app from **real AI integration**.

## 12. Privacy, security and AI/n8n integration

- Separate identifiable student records and pseudonymized learning records. Identity map stays local or in a separately secured identity service; never send actual name, Massar, parent name/contact, address or school-identifying notes to external AI.
- Random persistent IDs, not name-derived IDs; pseudonymization is not anonymization. Remove indirect identifiers from free text and files; user consent/authorization and institutional policy where needed.
- Local password + encrypted database with secure key derivation and locking; hardened Electron IPC and content security; safe export/backup, restore and recovery testing.
- n8n VPS orchestration via secure server-side API only; no embedded API keys in Electron renderer or Git. Minimize outgoing payloads to teacher-approved learning fields. Avoid sending entire unfiltered database. Secure transport, authorization, request validation, audit, sensible retention and retry control.
- Server-driven plans while desktop app closed require intentionally synchronized and encrypted pseudonymous records; do not assume cloud always has access.
- Ensure teacher explicitly approves suggestions before operational use. Do not use real pupil data in demos, test fixtures, logs, code repositories or development requests.
- Before processing real children's information: institution approval, relevant Moroccan CNDP/09-08 review, data processor and cross-border transfer review where applicable, independent security review.

## 13. Localization and accessibility

French / English / Arabic. Full RTL support in Arabic for navigation, tables and forms. Interface language independent of student remarks and plan output language; preserve source text. Accessible contrast, keyboard navigability and responsive resizing. Accurate PDF/Excel exports with Arabic and French labels.

## 14. Exports/reports

- Student report with top-level pre/post/current placement, competency evidence over time, notes and interventions.
- Original-group / remediation-group comparison; class pre/post report, per-subject distribution and progression charts, weekly plan report.
- PDF, spreadsheet-friendly Excel/CSV (Word later). Privileged exports of identifying content require confirmation and display privacy warning. Pseudonymized exports offered where possible.

## 15. Technical boundary and current source

Current code: Electron 45 with CommonJS `main.cjs`, context-isolated `preload.cjs`, vanilla JS/CSS UI under `app/`, Node `node:sqlite` with AES-256-GCM app data vault, `electron-builder`, scripts in `package.json`. Preserve and improve. Consider modularization and typed schemas/migrations as technical debt reduction. Real native Windows packaging/installer testing is required.

### Known incomplete areas (as of v0.1)

- Comprehensive competency event history, robust student edit/archive/movement and scope isolation.
- Complete Import Center (student lists, group membership, assessments, competencies, levels, notes/timetables) with XLSX/CSV mapping/preview/validation/history; annual-plan PDF/PPTX/DOCX/XLSX parsing and human-approved extraction. See `docs/IMPORT_CENTER_SPEC.md`.
- Student work attachments and versioned frameworks.
- Advanced reporting, real AI/n8n and secure sync.
- Automated tests, formal security review, complete localization and Windows-installed testing.

## 16. Nonfunctional acceptance targets

- Works without internet for all basic record/assessment/observation/competency operations.
- Keeps data across restarts and upgrades; tested migrations and encrypted backup restore.
- Group filtering is consistent across counts, charts, student lists and reports.
- Every cross-subject scope respects teacher's checkbox selections.
- No silent data loss on deactivation or archival.
- No unsupported claims about privacy or real-world assessment validity.
- Windows x64 installer can be built and clean-installed; app starts and loads the encrypted workspace; tests verify upgrades/restore.
