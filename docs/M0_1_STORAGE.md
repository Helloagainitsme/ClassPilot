# M0.1 — Confidential persistence and safe restore

Implemented 24 November 2026. This is a bounded foundation milestone, not completion of the full M1 product scope or approval for real-child deployment.

## What changed

The existing Electron, vanilla JavaScript/CSS, built-in SQLite and AES-256-GCM architecture remains in place. The agreed dashboard layout is retained. No dependencies were added or upgraded.

- `lib/vault-store.cjs` owns authentication, encrypted persistence, format migration, backup and restore. It can be tested directly without Electron.
- `lib/workspace.cjs` validates workspace records and references, prevents overwriting existing assessment/observation evidence, and derives change events in the backend.
- One encrypted envelope contains live data, change history and any migrated legacy SQL rows. A single revision-checked SQLite transaction commits both state and audit changes. Failed saves do not publish new in-memory state.
- The renderer submits its expected revision, rolls back rejected mutations, retains typed modal/grid values for retry, and shows success after persistence. Separate renderer audit writes were removed.
- Restore collects the backup password locally, clears the input before IPC, validates/authenticates the selected file and stages a clean encrypted image. The prior workspace has an encrypted recovery snapshot. Replacement failures trigger rollback.
- IPC checks the exact approved local document and main frame. A single-instance lock reduces concurrent desktop writers. Backend revision checks also reject stale saves, backups and restores.

## Storage format 2

The database contains only:

| Table | Stored fields |
|---|---|
| `private_vault` | Salt, random IV, GCM tag, encrypted envelope, revision and fixed row ID |
| `app_meta` | Numeric schema/storage version identifiers |

The encrypted envelope contains `format`, `data`, `audit` and `legacyTables`. Audit identifiers, previous/new values and educational remarks are encrypted along with the live records. `history()` is a trusted backend/test API; it is not exposed through preload.

AES-256-GCM authenticates the format label `ClassPilot/vault/2` as additional data. Old builds cannot decrypt this format and silently overwrite it through their old blank-workspace fallback. Do not use an older executable against an upgraded vault. The key is derived with the existing scrypt parameters; fresh 12-byte IVs are used on writes, and key buffers are cleared on lock.

The combined encrypted document/history limit remains 18 MiB. Reaching it rejects the save and retains the previously committed state. Large-history scaling and history-retention UI remain future work; history is never silently trimmed.

## Legacy migration

Migration starts only after password authentication. SQLite structure/integrity, known table names, supported versions, encryption and live record structure are checked first. Unknown tables/triggers, unsupported future versions, malformed state or authentication failures stop the operation without replacing the source.

All rows from the nine recognized legacy audit/framework/level/cycle/event/link tables are copied into `legacyTables` inside the encrypted envelope. Legacy `app_meta` rows are archived too. They are retained as source history, not silently promoted into a second live record authority. Existing legacy mistakes/orphan references in that archive are preserved for later review.

A fresh database and an encrypted recovery image are written and authenticated before replacement. This avoids copying plaintext tables and SQLite free pages into new backups. A legacy WAL is checkpointed before replacement so it cannot be replayed against the new encrypted image. The tests include committed evidence left only in a WAL after a simulated crash.

Old external backups, exports, `.before-restore` copies and files outside the selected live database are **not** automatically rewritten or deleted. Migration does not promise forensic erasure of released filesystem blocks, SSD snapshots, operating-system backups or previously copied plaintext files. Use an approved retention process for those artifacts.

## Back up

In Settings, select **Save encrypted backup** and choose a destination different from the working database. Backup builds a fresh two-table encrypted image from committed state; it does not copy arbitrary legacy database pages. A stale session cannot export an outdated snapshot as the current workspace.

Keep the backup password separately and securely. No password is recoverable or embedded in the backup. CSV/JSON report exports are still plaintext and require separate protection.

## Restore

1. Unlock the current workspace, then open Settings → Restore backup.
2. Enter the password used to create the backup. It may differ from the current workspace password.
3. Choose the backup in the native file picker. Cancel leaves the current workspace unchanged.
4. ClassPilot checks the candidate read-only, authenticates it, validates its data and builds a fresh encrypted replacement. Arbitrary candidate database bytes are never installed wholesale.
5. An encrypted recovery snapshot of the previous workspace is retained beside the live file. After successful replacement, unlock using the restored backup's password.

Wrong passwords, modified tags/ciphertext, invalid SQLite, unknown schemas and failed staging do not replace the live workspace or discard its unlocked session. Tests inject failures before and after replacement/reopening and verify rollback preserves data, history and revision. These are simulated failures, not a power-loss or installer certification.

### Recovery files and exceptional OS failure

Recovery files are named `classpilot-data.sqlite.recovery-<random-id>.sqlite` in the application's per-user data directory. Their contents are encrypted; the filename contains no pupil identifiers. A migration recovery uses the legacy vault password. A pre-restore recovery uses the previous workspace password.

Normally rollback is automatic. If replacement and rollback both fail because of an additional filesystem/OS failure, keep every recovery file. Close ClassPilot before manual recovery, preserve copies in a private location, and restore a reviewed recovery file with the previous password. If the application cannot unlock the live file at all, an administrator can place a copy of the verified recovery image at the live database path while ClassPilot is closed. Do not delete the previous files until successful unlock and record/history checks. This exceptional manual procedure has not been tested as a Windows support workflow.

Recovery images are deliberately not automatically pruned in this milestone; deleting historical recovery material needs a retention policy. Any orphan `.stage-<random-id>` files produced by an abrupt process termination contain ciphertext, not educational plaintext, but should still be treated as private backup material.

## Verification

From the repository root in PowerShell:

```powershell
npm.cmd install --ignore-scripts --no-audit --no-fund --offline --cache node_modules/.codex-audit-cache --logs-max=0
npm.cmd run check
npm.cmd test
npm.cmd run test:legacy
```

The offline install command succeeded with the existing cached tooling and added no packages. The real regression suite imports the production storage service and evaluates actual renderer/IPC source. The older copied-SQL demonstrations remain available separately as `test:legacy`; they are not evidence of immutable framework versioning.

Final local results on 24 November 2026:

| Check | Result |
|---|---|
| `npm.cmd run check` | Passed: six application/storage JavaScript files parse |
| `npm.cmd test` | 54 passed, 0 failed, 0 skipped |
| `npm.cmd run test:legacy` | Both legacy demonstration scripts passed |
| `git diff --check` | Passed |
| Synthetic native Electron smoke | Blocked before rendering by the existing Electron sandbox-directory ACL error; no security settings changed |
| Windows installer build/install | Not performed; remains unverified |

The dependency lockfile is unchanged. A repository scan found no obvious provider-token/private-key signatures or tracked data/build artifacts in the reviewed files; this is a focused check, not a secret-scanner certification or permission to use real pupil records.

Coverage includes password rejection, restart persistence, encrypted canary bytes, all legacy archive tables, freed-page/WAL migration, differing backup passwords, altered ciphertext/tags, schema/data rejection, append-only evidence, revision conflicts, atomic failed saves, restore rollback, renderer retry, password clearing and IPC frame/origin rejection. All fixtures are invented and use isolated temporary directories.

Development launch and build commands remain:

```powershell
npm.cmd start
npm.cmd run build:win
npm.cmd run build:portable
```

The native Electron launch and Windows installer remain separate verification gates. The M0.1 synthetic-profile launch on 24 November failed before rendering because the Electron directory ACL denied sandbox access, as in the original audit. No sandbox or OS security settings were weakened. Do not infer installer success from Node tests.

## Scope still open

Immutable framework definitions, historical comparison fixes, archived-student roster filtering, multiple teacher/year/class scopes, a history browser, correction events, attachment storage, Import Center, reporting improvements and AI remain later milestones. Validation may reject previously malformed legacy records; they are preserved in the original source rather than silently repaired. Institutional and independent privacy/security review remain necessary before real-child use.

## Changed files

Core: `main.cjs`, `preload.cjs`, `app/index.js`, `lib/vault-store.cjs`, `lib/workspace.cjs`. Verification: `tests/vault-store.test.cjs`, `tests/renderer-storage.test.cjs`, `tests/main-ipc.test.cjs`. Delivery: `package.json`, `.github/workflows/build-windows.yml`, `.gitignore`. Documentation: README, feature/status/decision documents and this runbook. The historical audit report remains unchanged.
