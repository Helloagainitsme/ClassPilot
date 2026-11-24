# ClassPilot Development Status

## Current status — 24 November 2026

M0.1 implements confidential persistence and authenticated staged restore. This does **not** complete the full M1 foundation or framework versioning. The independent audit remains the baseline scope inventory; see `CODEX_PROJECT_AUDIT.md` and the current `FEATURE_MATRIX.md`.

### Implemented in M0.1

- Production `VaultStore` service: encrypted live state, backend-derived audit changes and encrypted legacy SQL archive in format 2.
- Revision-checked transactional saves; rejected writes preserve both committed state and history. Renderer forms keep typed values for retry.
- Authenticated migration to a fresh ciphertext-only database, including legacy free-page/WAL confidentiality and encrypted recovery snapshots.
- Backup validation and password authentication before replacement; rollback on injected staging/replacement/reopen failures; backup passwords may differ from the current workspace password.
- Exact document/main-frame IPC checks, narrow preload API and single-instance desktop guard.
- Actual-code storage, renderer and IPC regression suites via `npm test`; legacy demonstrations separately available via `npm run test:legacy`.
- Existing Electron/vanilla UI retained; no new dependencies.

### Validation and remaining gates

`npm.cmd install --ignore-scripts --no-audit --no-fund --offline --cache node_modules/.codex-audit-cache --logs-max=0` completed with the existing installed/cached tooling and no added packages. Syntax and existing legacy checks passed before changes. Final milestone test results and reproducible commands are recorded in `M0_1_STORAGE.md`.

Final checks: syntax passed; all 54 production-source regression tests passed with no skipped cases; both legacy demonstration scripts passed. The dependency lockfile is unchanged. See `M0_1_STORAGE.md` for the detailed results and commands.

Node regression tests do not establish native Electron UI, restart, clean-installer, upgrade/uninstall or real-world power-loss behavior. A fresh synthetic-profile Windows launch on 24 November was blocked by the environment's Electron sandbox-folder ACL. No sandbox/security settings were disabled. Dependency advisory access and independent security review remain outstanding.

### Next bounded work

Immutable competency/positioning definitions and compatible historical interpretation, together with archived-student active-roster correctness. Scope/profile/year/class management and Import Center remain incomplete; all final requirements remain in the master specification. Real AI and the conversational agent are not implemented.

The former claim that M1 and immutable versioning were complete was contradicted by the source audit. The following snapshot is retained only as historical handoff context, not current verification:

## Historical handoff claims — 18 November 2026 (superseded)

### What Works (as of 2026-11-18)

1. **Core Application Structure & Syntax**
   - Syntax verification passes completely (`npm run check`).
   - Event-sourced competency audit logs implemented in SQLite (`competency_audit_log` and `framework_audit_log`).
   - Electron app launches successfully (`npm start`).
   - All previous features, multilingual support (French, English, Arabic RTL), and independent Group dashboards preserved.

2. **Milestone 1 — Competency & Positioning Framework Versioning (COMPLETED)**
   - ✅ Implemented immutable versioning for competencies and positioning frameworks.
   - ✅ Added backend audit logging for all competency and framework changes.
   - ✅ Created and executed automated test suite (`tests/milestone1.test.js`) verifying audit logging, competency versioning, and history preservation.
   - ✅ Maintained encrypted local storage and SQLite backup/restore compatibility.

### Next Milestone: M2 — Positioning Frameworks & Assessments
- Level manager with criteria, versioning, and per-subject framework selection.
- Individual pre-/intermediate-/post-test data entry and enhanced pre/post comparison warnings.
- Import competency assessment results and positioning level libraries.
