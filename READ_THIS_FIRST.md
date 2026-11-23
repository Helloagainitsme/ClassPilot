# ClassPilot — Codex handoff package

This folder contains the existing **ClassPilot v0.1 Electron source** plus design requirements and instructions for further development. **This is not a compiled Windows EXE and is not production-ready.**

## Fastest workflow on Windows

1. Extract this ZIP to a folder, e.g. `Documents\\ClassPilot`.
2. Open that folder as a project in **Codex on Windows**, Codex CLI, or your editor with the Codex extension. (If using Codex Cloud, create a private Git repository with this folder and connect the repository to a cloud environment.)
3. Open `AGENTS.md`, `docs/PROJECT_SPEC.md`, `docs/IMPORT_CENTER_SPEC.md` and `docs/ACCEPTANCE_TESTS.md`.
4. Paste the text in `PROMPT_FOR_CODEX.txt` as the first coding task.
5. Have Codex inspect the existing code, install dependencies, run checks and produce a staged implementation plan before beginning feature modules.
6. Use fictional student data only until the application passes privacy, security and deployment review.

## Codebase reality

- Existing architecture: **Electron 45 + vanilla JS/CSS + Node `node:sqlite`**, packaged with electron-builder, rather than the Tauri/React architecture mentioned earlier as an option.
- Existing major screens: class/group dashboards, student detail, editable subjects and competencies, positioning levels, assessments, observations, remediation grouping, basic rule-based planning preview.
- Existing limits: no genuine AI API, no n8n integration, no finished full XLSX/CSV Import Center or reliable PDF/PPT annual-plan parser, no full event-sourced competency history, no finished real-student privacy compliance review, and Windows installer not verified on Windows.
- Treat existing application as a prototype with source code to audit, test and improve; do **not** assume every feature is production-complete.

## Included files

- `AGENTS.md` — persistent Codex project instructions
- `PROMPT_FOR_CODEX.txt` — exact opening prompt to paste
- `docs/PROJECT_SPEC.md` — complete functional requirements and business rules
- `docs/IMPORT_CENTER_SPEC.md` — detailed Excel/CSV/document import workflows and acceptance criteria
- `docs/ACCEPTANCE_TESTS.md` — testable acceptance stories
- `docs/IMPLEMENTATION_ROADMAP.md` — staged delivery priorities
- `docs/screenshots/` — sample dashboard and individual profile, for UI reference only
- Existing `README.md`, `README_FR.md`, application source, build scripts and CI workflow

## External resources to add later (not required for first pass)

- Annual teaching progressions and subject curricula (PDF/PPTX/Excel/Word), after removing unnecessary personal data.
- Actual French and Mathematics assessment-level definitions and scoring rules.
- Sanitized assessment workbook (headers and invented records only) for import tests.
- Your preferred report templates.
- n8n webhook/API details **without passwords or production secrets**; store any real credentials only in an approved secrets manager or local environment variables.

Do not upload real pupil names, Massar identifiers, guardian contacts, or unredacted assessment files into public repositories or prompts.
