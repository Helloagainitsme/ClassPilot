# ClassPilot Windows Desktop — v0.1 (working MVP)

ClassPilot is an **offline-first student progress and remediation application for Windows**. This is an early working software project, not a finished or approved school deployment. It is based on the validated ClassPilot interface prototype.

## What you can do in this build

- Create a password-protected local teacher workspace and choose the application language (French, English or Arabic with RTL support).
- Select school subjects with **checkboxes at first launch**, and update those settings later. Only active subjects appear in dashboards.
- Begin with a blank workspace, or load **39 fictional students** for demonstration (20 in Group 1 and 19 in Group 2).
- Add individual student profiles with an internal reference, original group, and optional Massar ID stored only in the encrypted local database.
- Review overall dashboards and **Group 1 / Group 2 dashboards** independently, with positioning distribution and competency charts.
- View each student's **initial pre-test and latest positioning** at the top of the student profile.
- Add, edit, enable/disable, archive and restore per-subject competencies and positioning-level definitions.
- Record individual positioning tests (pre-test, intermediate, post-test) and student observations.
- Record a whole original group's positioning tests using **Class assessment grid / Saisie collective** in a single operation.
- Change an individual student's competency mastery status, with updates reflected in class progress.
- Create subject-specific remediation groups and assign their members.
- View an offline, **rule-based preview** of weekly interventions, which requires teacher approval. **No real AI service is connected in v0.1.**
- Export assessments as CSV and data as JSON (plaintext: protect these exports).
- Save and restore password-encrypted SQLite backups.

## Requirements

- Windows 10/11, 64-bit.
- Node.js LTS (recommend Node 24), available from <https://nodejs.org/>.
- Internet connection **once**, to download the Electron tooling when installing the source dependencies. Afterwards the application runs offline.

## Start ClassPilot on Windows (development / preview)

1. Extract the provided ZIP into a folder.
2. Install Node.js LTS from <https://nodejs.org/> if it is not already installed.
3. Double-click `RUN_CLASS_PILOT.cmd`.
4. On the first run, create a strong password and select your languages and **active school subjects**.
5. Choose **Empty classroom** for a fresh start or **Sample classroom** to explore the interface.

Changes are saved to an encrypted SQLite file under Electron's application `userData` folder (normally within `%APPDATA%`). The app does not depend on the extracted source directory to keep existing student records.

## Create an installable Windows .exe

1. Double-click `BUILD_WINDOWS_INSTALLER.cmd` while connected to the internet.
2. When the process finishes, look in the `dist` folder.
3. Run `ClassPilot-Setup-0.1.0.exe` on Windows.

Alternatively, upload the project folder to a GitHub repository and run the workflow under `.github/workflows/build-windows.yml` on a Windows runner to generate the installer artifact. This ZIP does **not** contain a compiled `.exe`; it contains the full buildable desktop application.

## Data security and limitations

- The local records are stored in a SQLite database as a single encrypted AES-256-GCM vault; password-derived keys use scrypt. This is encrypted **at rest**, not end-to-end synchronization.
- Passwords are **not recoverable**. Backups are encrypted but require the original vault password (or the password belonging to the restored vault).
- There is **no external AI network connection**, no n8n sync, and no cloud processing in this build.
- Please do not enter actual students' personal information until your institution has approved the software's use and the applicable privacy/security requirements have been checked. This is not yet security-audited software.
- Student enrollment imports from XLSX, curricular PDF/PPTX imports, student work attachments, rich historic competency event logs, schedule-driven weekly plans, and real AI/n8n integration are **not yet built**.
- There is no automatic software updater, multi-user permission management, mass file importer, or formally verified encrypted sync.
- A competency status in v0.1 is the current status only; unlike assessments, **changes to competency status are not yet event-sourced as a complete history**. This must be added before production use.
- Some translations, particularly newly added bulk entry and security controls, are not yet fully localized.
- The current student identity field stores one local Massar ID, but external AI is disabled and must never be given those fields in later versions.
- The app has not been tested as a packaged Windows installer in this environment. Build and installation are provided as reproducible steps.

## Development architecture

- Electron 45 / Chromium desktop window
- Vanilla JavaScript + CSS for the teaching workspace
- Node's built-in `node:sqlite` API in Electron's main process
- AES-256-GCM encrypted local data vault, authenticated by teacher password
- Context-isolated sandboxed renderer, no Node.js integration in the UI, no third-party network requests
- NSIS Windows installer generated by electron-builder 26

## Useful scripts

```sh
npm install
npm start
npm run check
npm run build:win
```

## Next development milestones

1. Real Windows installer packaging and user acceptance tests.
2. Full competency assessment event history and better student management (edit, move, archive).
3. Reliable spreadsheet import, annual progression import and file attachments.
4. Secure and pseudonymized AI/n8n pipeline with teacher-approved weekly plans.
5. Multi-teacher profiles, institutional deployments, audit logging and comprehensive security review.
