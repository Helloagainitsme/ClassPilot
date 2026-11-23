# ClassPilot — Acceptance Tests (must become automated where practical)

## Subject activation

- Given a new teacher selects French + Math, both render **at the same time** on class and individual dashboard; Arabic/Science do not render except in settings.
- Activating Science adds it to every relevant dashboard; it starts unassessed, not mastered.
- Disabling French hides its active tracking/AI sections, **without deleting historical assessment records**. Reactivating returns them.
- Another teacher profile can enable different subjects without altering the first teacher's configuration.

## Groups

- Fictional sample has 39 students: Group 1 contains 20, Group 2 contains 19. All Students totals 39, group filter lists/counts/charts reflect each group separately.
- Adding a new student to Group 2 updates group count, subject charts (where assessed) and roster without reassigning Group 1 students.
- Assigning student to French remedial group does **not** change the student's original Group 1/2 or Math remediation membership.
- Past remediation membership dates and recorded interventions are retained after moves.

## Student identity and placement

- Open a student profile: name/private identity appears locally (if authorized); directly below it, **initial pre-test and latest positioning per active subject**, dates, and comparison are visible without scrolling deep into the page.
- A new post-test changes current/latest position but does **not** overwrite pre-test or older assessments.
- When no pre-test exists, show 'Not assessed' rather than invent data.

## Competencies

- Add a French competency; it appears for every relevant student as Not assessed.
- Record mastery with support; later independent and consolidated assessments each create dated evidence records. History shows all transitions.
- Rename a competency without silently misrepresenting historic scored results; version history is available.
- Archive/disable a competency: no active tracking but prior observations/results remain available and restoration is possible.
- Distinguish competency mastery from positioning level: assigning 'Mots simples 2' does not automatically mark lower competencies mastered.

## Positioning framework

- Configure French levels: Débutant, Lettre, Syllabe, Mots simples 1, Mots simples 2, Phrase with editable teacher-approved descriptions.
- Add/remove/reorder levels without wiping past student tests.
- AI/pedagogical recommendation payload includes current descriptions and scoring criteria, not just names.
- Switching to new framework version warns when pre/post comparisons are not directly comparable.

## Assessments and history

- Enter an initial pre-test and later post-test for French in same student; both persist across app restart and can be compared if compatible.
- Enter classwide pre-tests for 20 fictional Group 1 students in keyboard-friendly grid; no duplicate or cross-group edits.
- Import a fictional Excel workbook with missing/invalid rows; preview errors and reject invalid rows without partial destructive overwrite.
- Import 39 fictional students from XLSX; Group 1 has 20, Group 2 has 19; roster and independent group charts remain correct after restart.
- Import a French `test de positionnement` spreadsheet followed by `post-test`: students' initial assessments remain preserved and latest positioning updates at the top of their profiles.
- Import competencies, positioning level descriptions and observable criteria from structured workbooks with teacher approval; historical versions survive edits.
- Reimport the same file without accidental duplicate students/assessment events; allow matching/mapping review and record an import audit trail.
- Review/cancel an import without modifying persisted records; error report identifies bad sheet/row/column.
- Workbook with Arabic/French headers, several subject sheets, Excel date cells and leading-zero identifiers imports without corruption.
- Import student-group membership separately from per-subject remediation membership.
- Full imports are defined in `docs/IMPORT_CENTER_SPEC.md`; do not mark this module complete after implementing only test imports.
- For non-comparable test versions, display both values but do not claim improvement based on direct score subtraction.

## Observation / intervention

- Add dated French guided-practice note; it appears in student learning history, under French and can be filtered.
- Attach a fake work sample; it remains local until explicitly shared and is absent from default AI payload.
- Mark intervention delivered/evaluated, recording outcome without rewriting the original plan.

## AI security and planning

- Assemble an AI payload from synthetic student records with a name, a Massar ID, a guardian phone, and free-text containing identifying text; assert all direct identifiers are absent and block/flag indirect identifiers rather than silently sending them.
- Server credentials/API keys never appear in renderer bundle, Git, client logs, or readable exports.
- With AI/n8n unavailable, core assessments and dashboards work offline, and AI feature displays an accurate offline/unavailable state.
- AI plan proposal references actual assessment evidence, approved competency definitions and configured weekly teaching timetable.
- Teacher must approve plan before it becomes scheduled; no AI action directly alters assessment/mastery/group membership.

## Localization / UX

- Switch interface English -> French -> Arabic; Arabic layout uses RTL and preserves original entered remarks.
- Class-level observations and pre/post results can be entered with keyboard only.
- Reports with French and Arabic text show sensible page layout and do not leak identifiers in pseudonymous mode.

## Persistence / backups / Windows

- Data survives restart; backup/export + restore recover matching record counts, histories and notes.
- Wrong backup password returns a safe error; corrupted files do not erase working data.
- New schema upgrade migrates existing encrypted workspaces or clearly protects against incompatible versions.
- Windows build generates a verifiable installer; clean-install on Windows 10/11, launch, create workspace, enter demo record, restart, uninstall/reinstall without unintended data loss.

**Fixture policy:** exclusively invented people and invented educational results. Never use real student uploads for automated testing.
