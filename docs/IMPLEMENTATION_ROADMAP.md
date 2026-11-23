# ClassPilot — Recommended delivery roadmap

Codex should first compare this roadmap to the code that actually exists, report any gap and adjust order on engineering grounds. **Do not represent future stages as already complete.**

## M0 — Audit and maintainability foundation (first task)

- Inspect existing `main.cjs`, `preload.cjs`, `app/index.js`, persistence/encryption/IPC, external dependencies and scripts.
- Run `npm install`, `npm run check` and whatever tests exist; note environmental limits.
- Perform targeted threat review: Electron security, identity/pedagogy separation, backup/exports, sync readiness, data loss hazards.
- Add automated test harness, safe fake fixtures, schema version and migration plan, and baseline smoke tests for subject toggles and group counts.
- Make the smallest robust architectural changes needed to support later modules, preserving working interface.
- Deliver a summary + exact verification commands + prioritized backlog.

## M1 — Reliable student/subject/competency core

- Full student create/edit/archive/re-enroll; teacher/year/class scope boundaries.
- Create reusable Import Center foundation (file picker, sheet/column preview, schema mapping, validation, review-before-commit, safe errors); import student rosters XLSX/CSV in M1.
- Editable subject catalogue, checkbox activation in onboarding/settings and consistent dashboard scope.
- Versioned competency manager per subject, assessment evidence history (event records), archiving and restores.
- Encrypted local persistence, migration tests, backup/restore verification.

## M2 — Positioning frameworks + assessments

- Level manager with descriptions, criteria, reorder/versioning and per-subject framework selection.
- Individual pre-/intermediate-/post-test data entry; bulk class/group grid; imported CSV/XLSX mapping with validation.
- Import competency assessment results, positioning level libraries and original/remedial group memberships; prevent duplicates, keep history and log import jobs.
- Initial and current positioning summaries at top of individual dashboard, group-specific comparison charts.

## M3 — Pedagogical workflow

- Detailed journals, attachment vault, saved remark templates, intervention history, original/remediation groups and peer pairs.
- Complete Import Center for competencies, observations/interventions and timetables (XLSX/CSV); import annual/weekly plans PDF/DOCX/PPTX/XLSX with *human-approved* competency extraction and traceable provenance. Follow `docs/IMPORT_CENTER_SPEC.md`.
- Accurate reports and print exports (PDF/Excel), Arabic/French readability.

## M4 — AI/n8n and weekly plans

- Secure payload builder with pseudonymization + redaction tests + opt-in permissions.
- Secure server adapter to n8n, simulated mock mode, error/retry/timeout handling, no embedded client secrets.
- Evidence-linked, per-subject planning respecting teacher's schedule, individual and group differentiation; human approval.
- Optional secure sync only if explicitly needed for plans generated when laptop is closed.

## M5 — Product hardening and delivery

- Real Windows x64 installer testing, release workflow, upgrade path, multilingual QA, accessibility, performance, optional separate teacher profile integration, privacy and independent security review.

## Per milestone definition of done

Code merged and runs; critical paths covered by automated tests; historical data preserved; privacy boundary verified; interface screens usable with fictional data; Windows build or environment limitation documented; user-facing change summary and next steps included.
