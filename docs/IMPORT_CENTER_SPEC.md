# ClassPilot — Import Center: full data-import requirements

**Status:** required planned module, **not** a claim that imports already work in the current v0.1 source. Build and test progressively. Use **fictional records** for examples, fixtures and demonstrations.

## 1. Import Center as a first-class module

Add **Import Data / Importer des données / استيراد البيانات** to the navigation and teacher setup. Import Center supports XLSX and CSV for structured records, and separate document ingestion (PDF/DOCX/PPTX/XLSX) for annual teaching plans and lesson materials. Do not silently interpret document extraction as a verified competency definition.

## 2. Import matrix

| Data | Supported inputs | Behavior |
|---|---|---|
| Student roster and identifiers | XLSX, CSV | Import names, local national pupil ID when permitted, classroom, original group, academic year; generate a random internal student reference; do not send identities to AI |
| Initial and later positioning tests | XLSX, CSV | Import subject-specific initial/diagnostic/pre-test, interim and post-test records; allow date, original group, framework+version, positioning level, remarks, scores; never overwrite historical tests |
| Competency evaluations | XLSX, CSV | Map columns or multiple rows to specific competencies and independent statuses; preserve evidence date/method and history |
| Subject competency libraries | XLSX, CSV; proposed extraction from PDF/DOCX/PPTX | Create **draft** competencies linked to subject/level, descriptions, criteria and source; teacher reviews before activation |
| Positioning level libraries | XLSX, CSV | Name, order, description, observable criteria, thresholds, subject, grade and version; detect conflicting labels |
| Original/remediation groups and membership | XLSX, CSV | Preserve original group separately from subject-specific remediation group; import membership dates if available |
| Teacher observations and intervention histories | XLSX, CSV | Import date, subject, competency, stage, remark, intervention and outcome; map to students without exposing identities to AI |
| Teaching timetable / subject sessions | XLSX, CSV | Import days, periods, lesson duration and subject constraints; provide edit/approval screen |
| Annual/weekly pedagogical plans | PDF, DOCX, PPTX, XLSX | Extract proposed objectives/competencies, periods and sources for human review; retain source location/page when possible; no automatic activation |

**Useful formats:** support a single sheet, multiple sheets, one-row-per-student wide exports, long-form test records, and a workbook with separate subjects or test dates. Detect and confirm source structure; do not assume a fixed vendor column layout. Provide a downloadable sample/template per import type.

## 3. Import wizard UX

1. Choose category (students, tests, competencies, levels, groups, observations, schedule, planning) and optional class/year/subject.
2. Select file. Show filename, type, sheet names, row count, column headers and sample rows.
3. Offer automatic **suggested** column mapping for French, Arabic and English labels, but allow manual corrections and saved per-format mappings.
4. Preview exact actions: new rows, possible duplicates, updates explicitly requested, skipped records and errors. Show source row numbers and field-specific reasons.
5. Resolve missing/ambiguous student, subject, competency and level mappings. Do not match students only on name without user confirmation; do not force a national ID field.
6. Validate entire import with a dry run; enforce mandatory fields and date/score/level validity. No silent partial destructive import.
7. Require explicit user confirmation, then import within a transaction where practical; if partially applied for legitimate reasons, provide an auditable row-by-row summary.
8. Produce summary and downloadable error report, record import job provenance (timestamp, teacher, source filename hash, mapping version, imported record IDs) and allow safe rollback or correction of the import job.

## 4. Non-destructive & privacy rules

- **Never overwrite a previous assessment or dated observation because a later file contains a newer result.** New valid test results append events.
- Reimport the same workbook must not create duplicate student profiles or identical assessment events. Show candidates and allow the teacher to decide in an explicit review.
- Preserve accented French and Arabic, Excel serial dates, leading zeros in identifiers, empty cells and distinct `not assessed` vs `not acquired` values.
- Keep raw imported files and temporary data private, encrypted where persistent and removed according to retention setting. Identifiable files must stay local unless explicitly authorized.
- Version competency and positioning frameworks: if definitions change, old results remain interpretable.
- Do not automatically merge the two original class groups or confuse them with remediation groups.
- Existing historical exports may contain multiple tabs, inconsistent headers and test labels such as `test de positionnement`, `pré-test`, `post-test`. The wizard should propose mappings and let the teacher verify them.
- Import operation must be offline-capable for local XLSX/CSV processing. Optional AI document extraction may need internet and consent; offer a manual fallback.

## 5. Acceptance tests

- Import fictional workbook of 39 students, 20 in Group 1 and 19 in Group 2; correctly scoped counts, charts and student lists immediately reflect assignments.
- Import initial French positioning for all students; individual header and group charts update. Import later post-test; initial positioning is preserved and comparable data can show progression.
- Import two sheets with mathematics and French evaluations; data associates with the correct active subject and competency; inactive subjects are not silently activated.
- Import a workbook twice; no duplicate assessment rows without confirmation; show duplicates and a review flow.
- Import workbooks with missing names, unknown level labels, invalid dates, malformed scores and repeated IDs; no silent bad data, provide actionable row-by-row errors.
- Import Arabic and French text with accented characters and right-to-left remarks without corruption.
- Import a small positioning levels XLSX; descriptions and criteria become teacher-reviewed definitions passed accurately to the AI's pseudonymized educational payload.
- Teacher cancels at preview stage; no persisted records modified.
- Undo a recent import safely; unrelated records and preexisting history remain intact.
- Where the current app lacks the infrastructure for an import type, implement UI disabled with accurate "coming in milestone" notice—not a fake successful import.

## 6. Implementation guidance

Build file parsing and schema validation in trusted application backend, not with dangerous filesystem access from the browser renderer. Use safe file pickers and strict validation. Keep import components modular by data category. Write deterministic automated tests using wholly synthetic test records, including bilingual columns, mixed sheets and duplicate cases.
