# ClassPilot AI — Independent Technical Audit

**Report finalized:** 23 November 2026, Africa/Casablanca  
**Evidence collected:** 19 November 2026; source hashes and baseline checks reconfirmed on 23 November 2026  
**Application:** `classpilot-desktop` 0.1.0  
**Scope:** Initial technical audit only. No application source, dependency versions, architecture, or features changed.

## 1. Executive summary

ClassPilot has a useful Electron desktop foundation and a substantial teaching-workspace interface. It is an early prototype, with significant functional gaps and confirmed privacy and data-integrity defects. The evidence does **not** support the existing claim that the foundational milestone, immutable framework versioning, or complete assessment history is finished.

**Recommendation: continue the existing Electron/vanilla JavaScript/Node SQLite architecture, while refactoring selected components.** A replacement application or immediate framework migration is not justified. Preserve the sidebar, dashboard cards, original-group views, simultaneous active-subject panels, and prominent student positioning summaries from the agreed design.

The highest-priority findings are:

1. **Some educational records are plaintext outside the encrypted vault.** Individual assessment/observation audit entries contain full JSON, including remarks, in ordinary SQLite tables. Database backups include these tables and therefore are not fully encrypted.
2. **Restore replaces the working database before authenticating the selected backup.** A file with a vault-shaped row but unusable ciphertext passes the current validation. A recovery copy exists, but automatic recovery is absent.
3. **The migration function is never called.** Its corrected SQL works when invoked explicitly in an isolated probe, but normal create/unlock does not run it. Simply adding a call would also expose more educational data in plaintext and create an unsynchronized second store.
4. **Historical framework versioning is not operational.** Editing a level changes how old assessment records are labeled; archiving a level can remove its historical chart points. Competency and level definitions are edited in place.
5. **Official state and audit writes are not atomic.** Most CRUD occurs in the renderer, whole-class assessment bypasses audit logging, and failed saves leave mutated state visible.
6. **Archived students remain in active counts and bulk assessment rosters.** Original/remediation membership changes also overwrite current values without dated history.
7. **The existing tests pass but largely test copied examples.** They do not establish that production CRUD, migrations, versioning, backups, or IPC work.
8. **The Import Center and real AI modules are absent.** There is no XLSX/CSV import pipeline, annual-plan extraction, OpenAI adapter, conversation agent, knowledge base, or automatic scheduler.

The weighted scope estimate is **23/100, approximately one quarter of the complete specified product**, with a planning range of 20–30%. This estimates implemented capability, including incomplete prototype paths; it is not an acceptance-test pass rate or a production-readiness score. Section 11 explains the calculation.

Syntax checks and both existing test scripts passed. Additional synthetic probes executed actual backend and renderer source and confirmed both useful behavior and defects. A Windows desktop launch was attempted with isolated application data, but the local Electron runtime stopped at a Windows sandbox folder-access error before UI verification. No installer was built or installed. Dependency vulnerability status remains **unknown** because the npm advisory endpoint failed.

The recommended next deliverable is a bounded **storage, restore, and audit-integrity foundation milestone**, followed by historical definitions and assessment correctness. No implementation milestone was started in this audit session, as expressly requested.

## 2. Scope, method, and evidence boundaries

### 2.1 Material reviewed

The review covered the complete application source inventory: `main.cjs`, `preload.cjs`, `app/index.js`, `app/index.html`, `app/app.css`, and all three login files. It also covered both test scripts, `package.json`, `package-lock.json`, `.gitignore`, Windows launch/build scripts, and `.github/workflows/build-windows.yml`.

Documentation reviewed: `AGENTS.md`, `CLAUDE.md`, both READMEs, `READ_THIS_FIRST.md`, `START_HERE_CLAUDE.md`, `START_WITH_CLAUDE.txt`, `PROMPT_FOR_CODEX.txt`, and all Markdown files under `docs`: the master development prompt, project specification, Import Center specification, acceptance tests, implementation roadmap, feature matrix, development status, and decisions. Both supplied dashboard reference PNGs were visually inspected.

The master development prompt defines the final product scope. The current explicit audit-only request takes precedence over older handoff instructions to implement immediately. Existing feature/status documents were treated as claims to verify, rather than proof.

### 2.2 Verification levels

| Evidence label | Meaning and limit |
|---|---|
| Source | A path exists or a defect is identifiable in actual application code. Does not establish successful execution. |
| Backend probe | Actual `main.cjs` evaluated in a Node VM with real crypto and in-memory SQLite; Electron and filesystem effects mocked. Establishes the exercised logic, not Windows integration. |
| Renderer probe | Actual `app/index.js` evaluated in an isolated VM with synthetic state and a stub desktop bridge/DOM. Establishes exercised selectors, mutations, and generated HTML, not a live browser or real persistence. |
| Existing test | A repository test script completed. Its actual coverage is described in section 9. |
| Desktop/installer | Requires successful execution in the real Windows/Electron environment. This was not established. |

Only fictional canary records and the supplied fictional demo were used. No existing teacher vault, real pupil records, imports, attachments, credentials, or API secrets were opened. The audit made no AI provider calls. Temporary diagnostic scripts/cache/profile files were confined to ignored directories under `node_modules`; the requested report is the only intentional project-content change.

### 2.3 Environment and source identity

| Item | Observed value |
|---|---|
| OS/shell | Windows / PowerShell |
| External Node | 24.21.0 |
| npm | 11.19.0, via `npm.cmd` |
| Electron dependency | 45.1.0, exact pin |
| Electron bundled Node | 24.22.1, observed during executable diagnostic |
| electron-builder | Installed/locked 26.18.0; declared `^26.0.12` |
| Git | Initialized, branch `master`, no commits; application files untracked |

The following SHA-256 values matched on both audit dates. They identify the reviewed source in the absence of a Git commit:

| File | SHA-256 |
|---|---|
| `main.cjs` | `05DC147D76180FB7D0A57447B7C4D723AE57FF52FA21F75E294321A1CDCD4CD9` |
| `preload.cjs` | `CF74711A595CBDBA8E9B3F4F0102BF0C6F851DE975FCABE0F5651AD54D92354A` |
| `app/index.js` | `A37A8B3F7AA307A540242662B46FE380906C2F4B53B86BBD911B2C98880ED082` |
| `app/login.js` | `93FA01576F73A742F631E34381BF558DAB714F973ED8C52213D8366DD02CF6FC` |
| `package.json` | `47460E03AECDB29225128EAC7FD240A930F9AAB3CACEC1ADA1CC7D10D07CD71A` |
| `package-lock.json` | `9F5A2262F7234C2BD86B2F6CDE45D1926BC5F5E69E9B511077D44CDA391AA058` |

Line references below refer to this snapshot. The renderer contains very long compressed lines, so a single referenced line can contain several operations.

## 3. Current technical architecture

| Layer | Actual implementation | Assessment |
|---|---|---|
| Desktop host | Electron `BrowserWindow`, local HTML, CommonJS main process | Suitable starting point for a standalone Windows product. |
| Renderer | Vanilla JS template rendering, one mutable `db` object, full `innerHTML` rerender, delegated DOM events | Preserves the agreed design, but domain logic, analytics, state, persistence, localization, and UI are tightly coupled. |
| Bridge | Frozen `window.classPilotDesktop`, explicit methods in `preload.cjs:3–18` | Narrower than exposing raw IPC, but most methods are synchronous and payload validation is weak. |
| Main process | Authentication, crypto, SQLite, backup/restore, audit inserts, limited student operations in `main.cjs` | Privileged responsibilities are in the correct process; mutation authority is still largely in the renderer. |
| Authoritative live data | Whole JSON document encrypted into the single `private_vault` row | Current UI reads this document, not normalized assessment/framework tables. Every save rewrites it. |
| Additional SQLite data | Plaintext audit tables, framework/level/cycle/event tables, `app_meta` | Hybrid store is incomplete. Relational tables are not a coherent live repository. |
| Authentication/crypto | Password-derived scrypt key; AES-256-GCM; random salt and nonce | Real authenticated encryption for the vault blob, not whole-database encryption. |
| Packaging | electron-builder, ASAR, NSIS x64 and portable scripts, GitHub Windows workflow | Configuration exists; build/install behavior unverified. |
| AI/network | Local rule template only; renderer CSP blocks connections; no provider adapter | No real OpenAI, n8n, sync, agent, retrieval, or scheduler. |

The live write path is approximately:

```text
Renderer mutates complete in-memory document
  -> optional separate audit IPC insert into plaintext SQLite
  -> synchronous vault-save IPC
  -> shallow validation, serialize, AES-GCM encrypt
  -> UPDATE one private_vault row
```

Audit insertion and vault update are separate operations. The revision counter increases, but a caller supplies no expected revision to prevent stale writes. The database is located under Electron's per-user `userData` directory (`main.cjs:18`), rather than the source/install directory. There is one local teacher workspace, not an implemented multiple-profile model.

The vault key uses scrypt with `N=32768`, `r=8`, `p=1`, a 24-byte salt and a 32-byte key; encryption uses a fresh 12-byte IV (`main.cjs:140–152`, `253–261`). The encrypted JSON limit is 18 MiB (`16`, `141–147`). This protects that blob at rest, while leaving separate SQL columns outside that protection.

## 4. Detailed feature implementation matrix

Classification applies to the **complete requested module**. A partial module can contain individually verified behavior. “Implemented and verified” requires evidence covering its requested scope; none of the broad modules meets that standard in this audit. “Defective” denotes a central implemented behavior with a confirmed material defect. Missing subfeatures are stated explicitly.

| ID | Functional module | Classification | Actual evidence and remaining scope |
|---|---|---|---|
| F01 | First-time installation and configuration | Partially implemented | Password, empty/sample choice, language and subject checkboxes exist (`app/login.html:4–6`, `login.js:7–17`; backend creation probe). No complete teacher/year/class/group/framework/timetable wizard. Installer not verified. |
| F02 | Teacher profiles | Not implemented | One vault; constant “Teacher” identity. No profile creation/switching or profile-scoped ownership. OS-user storage is not a teacher-profile manager. |
| F03 | Academic years and classes | Not implemented | Fixed grade/year labels; no entities, enrollments, rollover or class/year filtering (`app/index.js:8–10`, `85`, `132`). |
| F04 | Student management | Partially implemented | Create/edit/search/archive/restore paths exist. Archive filtering, deletion references and membership history are defective; duplicate handling, stable random primary identity, reenrollment and arbitrary group configuration are missing (`90`, `104`, `113–114`, `132`; `main.cjs:305–307`). |
| F05 | School subject activation | Partially implemented | Renderer probes verify simultaneous French+Math panels and retained assessments through disable/reactivate. Nine fixed subjects; no custom catalogue or teacher/class/year scope (`4`, `42`, `99`, `155`). Full default-report/AI scope not established. |
| F06 | General dashboard | Partially implemented | Stored-state-derived subject cards, counts, group views and recent activity (`87`). Archived students remain counted; missing coverage distinctions, periods and class/year filters. |
| F07 | Independent original-group dashboards | Partially implemented | Probe verified demo split 20/19; dynamic group tabs scope roster/chart calculations (`63–70`, `87`). Group setup is limited to two dropdown choices; no dated membership history; archive filtering defective. |
| F08 | Individual student dashboards | Partially implemented | Initial/current positioning and all active subject cards appear together at top in generated HTML (`71`, `89–90`). Latest post-test is not a separate summary; cycles, full evidence history, work and intervention views missing. Live visual QA unverified. |
| F09 | Charts and analytics | Defective | Actual-state calculations exist (`47–72`), but mutable/archived levels change historical charts, comparisons ignore definition compatibility, same-day latest selection is ambiguous, and missing competency evidence displays 0%. |
| F10 | Competency Manager | Partially implemented | Add/edit/order/activate/archive/restore exist (`92`, `104`, `112`, `132`). Definition versioning, structured success criteria/prerequisites/provenance, scale management and backend-enforced evidence history are absent. |
| F11 | Positioning Levels Manager | Partially implemented | Name, description, order, archive/restore exist (`93`, `104`, `132`). No working multiple-framework/version selection, immutable criteria history or compatibility checks. SQL table declarations alone do not implement these workflows. |
| F12 | Initial positioning tests | Partially implemented | `pre` type, baseline selector and top summary exist (`65–71`, `104`, `132`). Initial positioning and pre-test cannot be configured separately; no cycle/instrument/version-safe association. |
| F13 | Pre-tests and post-tests | Partially implemented | Individual records append to vault and initial/latest selectors exist. No operational cycle manager, separate latest-post header or trustworthy framework comparison (`65–72`, `132`). |
| F14 | Intermediate assessments | Partially implemented | `mid` supported in individual and bulk forms. Shared validation, history, framework and latest-selection limitations remain (`82`, `104`, `132`). |
| F15 | Whole-class assessment entry | Partially implemented | Original-group grid has level/score/note inputs and appends records (`74–83`, `114–126`). No backend batch command, per-entry audit/version association, deduplication or retained draft when scope changes. Keyboard/accessibility behavior not live-tested. |
| F16 | Excel and CSV Import Center | Not implemented | No import route, parser, sheet selection, mapping, preview, validation, duplicate review, transaction, import provenance or rollback. CSV export is not an importer. |
| F17 | Annual teaching plan imports | Not implemented | Button displays a planned-feature notice (`92`, `131`). No PDF/DOCX/PPTX/XLSX extraction, manual structured import pipeline or teacher-review staging. |
| F18 | Learning journal | Partially implemented | Dated student/subject/competency observations append and display (`95`, `104`, `132`). No search/filter, correction trail, teaching stage, attachment or intervention integration. |
| F19 | Teacher observations | Partially implemented | Add/list text implemented; original text retained during tested language changes. Missing templates, context/outcomes, correction/version history and privacy review. Full observation JSON is also copied into plaintext SQL audit. |
| F20 | Student work portfolios | Not implemented | No attachment API, encrypted file store, preview, metadata handling or retention workflow. “Observations and work” label does not establish attachment support. |
| F21 | Remediation groups | Partially implemented | Separate subject and member list, group creation/member assignment (`96`, `104`, `132`). Changes replace membership arrays; no dated history, interventions/outcomes or complete group management. |
| F22 | Peer learning | Not implemented | No pair entities, pairing UI, assignment history or reviewed recommendation flow. |
| F23 | Teaching progression and timetables | Partially implemented | Per-subject weekly session counts only (`99`, `155`). No actual days, periods, durations, calendar, upcoming objectives or delivered-lesson tracking. |
| F24 | Individual and group weekly plans | Partially implemented | Manual individual rule-based proposal and approval flag (`97`, `111`, `131`). No group plans, plan editor, calendar fit, scheduled/delivered/evaluated lifecycle or outcome evidence. |
| F25 | PDF and Excel reports | Not implemented | Existing report page provides browser print, CSV and whole JSON export (`98`, `110`, `131`). No dedicated PDF/XLSX report generation, report scope/period options or verified Arabic print layout. |
| F26 | French, Arabic and English | Partially implemented | Dictionaries and RTL CSS exist; renderer probe verified `lang=ar`, `dir=rtl`, preserved notes and independent plan-language setting. Login is English-only; multiple actions/notices hardcoded; Arabic screen/print/accessibility QA incomplete. |
| F27 | Offline functionality | Partially implemented | Existing local paths have no provider dependency; CSP/network gate prohibit normal remote renderer requests. Crypto/selectors tested in isolation. Actual desktop persistence/restart not verified; many required offline workflows do not exist yet. |
| F28 | OpenAI API integration | Not implemented | No SDK/provider adapter, Responses API request, credential configuration, proxy or connection test. Current planning is explicitly a local simulation. |
| F29 | Conversational pedagogical agent | Not implemented | No chat threads, streaming/cancel/retry, controlled tools, drafts or conversation history. |
| F30 | AI knowledge base and memory | Not implemented | No resource ingestion, approved source snippets, local retrieval/index, thread summaries or memory contracts. |
| F31 | Automatic weekly planning | Not implemented | No scheduler/jobs/missed-run queue/idempotency. Manual template generation is not automatic planning. |
| F32 | Student pseudonymization | Partially implemented | Random `pseudo` values and illustrative privacy preview (`23`, `25`, `97`, `132`). Operational student keys are sequential `STU-…`; no real outbound allowlisted DTO, free-text gate, identity isolation or captured-request privacy test. |
| F33 | Security, backups and restoration | Defective | Vault AES-GCM roundtrip and wrong-password rejection verified. Plaintext audit records, incomplete backup confidentiality and pre-authentication replacement confirmed. IPC/scope/schema/key-lifecycle gaps remain; actual backup roundtrip not verified. |
| F34 | Windows installer | Implemented but not verified | NSIS x64 config, ASAR/file allowlist, scripts and Windows CI exist (`package.json:20–27`). No built/installed/upgrade-tested artifact. Local desktop launch was blocked by environment ACLs. |

The status distribution is 20 partially implemented, 11 not implemented, 2 defective, and 1 implemented but not verified. This distribution is descriptive, not the completion-percentage formula.

## 5. Functionality actually verified

These are deliberately narrower claims than “the application works.”

| Verified behavior | Evidence | Limits |
|---|---|---|
| Four application JS files parse | `npm.cmd run check`, passed twice | Syntax only. |
| Vault encrypt/decrypt roundtrip; wrong password rejected | Actual backend source, real scrypt/AES-GCM and in-memory SQLite | Mocked Electron/filesystem; not a desktop restart test. |
| Corrected migration statement executes and preserves numeric zero | Actual `migrateDataIfNeeded()` invoked in memory | Normal lifecycle does not call it. Does not prove safe upgrade. |
| Fictional demo has 39 students, 20/19 original-group split | Actual renderer source VM | Not an installed-app database acceptance test. |
| French and Math visible simultaneously on student summary/cards | Actual renderer generated HTML | No screenshot from current running app. |
| Subject deactivation/reactivation retains demo assessments | Renderer probe retained all 78 French assessment records | Full report/AI/scoped-profile behavior not covered. |
| Form score string `"0"` retained | Actual renderer form-submission probe | Does not establish complete score validation. |
| Arabic language/RTL attributes set; original note retained | Actual renderer probe | Visual shaping, mixed-direction layout and PDF output not verified. |
| Dependency tree is internally consistent | `npm.cmd ls --depth=0 --json` and `npm.cmd ls --all --json` | Does not establish a vulnerability-free supply chain. |

The screenshots supplied with the project were useful for confirming design continuity. They are reference artifacts, not evidence of a successful current-source launch.

## 6. Confirmed defects and other technical risks

Priorities: **P0** blocks handling real pupil data or relying on recovery; **P1** can compromise record meaning, saved state or history; **P2** is a significant correctness/usability gap. These are engineering priorities, not CVSS scores.

| ID | Priority | Finding, trigger and consequence | Evidence |
|---|---|---|---|
| B01 | P0 | Recording an individual assessment/observation copies its full JSON into plaintext SQL. Remarks remain readable without the vault key. Backups contain the same data. | `main.cjs:25–69`, `169`, `184`, `198`, `315–316`; `app/index.js:132`; backend canary probe. |
| B02 | P0 | Restore checks only for a vault row, then replaces the current database before ciphertext/password/schema validation. Unusable backup can displace working data. | `main.cjs:327–340`; actual handler with malformed ciphertext and mocked copies returned success. |
| B03 | P1 | Normal create/unlock never invokes migration; `app_meta` stays empty. Unversioned table creation still occurs before login. | `main.cjs:19–134`, `206`, `250–287`; call-site search and actual-source probe. |
| B04 | P1 | Editing a competency/level overwrites its definition. Historical labels resolve current level names, so renaming changes old results' displayed meaning. No UI call records framework versions. | `app/index.js:47`, `112`, `132`; `preload.cjs:13`; renderer edit probe made zero framework-audit calls. |
| B05 | P1 | Archiving/reordering a level alters historical plots. Archiving the test level reduced probe chart points from 3 to 0. Compatible-framework checks are absent. | `app/index.js:45`, `70`, `72`; renderer probe. |
| B06 | P1 | Audit and official data persist separately; bulk assessments skip audit/version linkage. Failure can leave evidence of an uncommitted change or a committed change with no audit. | `main.cjs:154–204`, `289–304`; `app/index.js:114–126`, `132–151`. No crash-injection durability test performed. |
| B07 | P1 | Renderer mutates first and generally ignores failed save results. Forms close and unsaved edits remain visible; success messages may precede persistence. | `app/index.js:53`, `111–112`, `132–151`; failed-save bridge probe retained changed name. |
| B08 | P1 | Archiving a student does not remove them from active roster/dashboard/bulk counts; profile still uses active badge. | `app/index.js:63–64`, `79`, `87`, `90`, `118`; probe counts remained 39 and 20 after archive. |
| B09 | P1 | Original-group edit and remediation member changes overwrite current fields without dated history. Prior assignments cannot be reconstructed. | `app/index.js:132`; source. |
| B10 | P1 | Generic save accepts malformed records/unknown subjects because only three top-level arrays are checked. Persisting `students:[null]` succeeds. | `main.cjs:154–160`, `289`; backend probe. |
| B11 | P1 | Student delete guards ignore plans, competency result maps and SQL audit references. Synthetic delete succeeded while leaving a result map and plan referring to the removed student. | `main.cjs:307`; actual IPC-handler probe. No delete button is required for the exposed bridge defect to exist. |
| B12 | P2 | Two assessments on the same date sort only by date; stable sorting can keep the earlier inserted event as current/latest. | `app/index.js:48–49`, `66`; probe selected the older of two same-day entries. |
| B13 | P2 | Missing competency evidence becomes 0% mastery in headline calculations. “Not assessed” is available in detailed badges but not distinguished by the aggregate. | `app/index.js:50`, `68–69`, `87`, `89`; empty-results probe. |
| B14 | P2 | Quoting CSV values does not neutralize spreadsheet formula text. A note beginning `=2+3` remains formula-capable in spreadsheet applications. | `app/index.js:110`, `131`; CSV probe. No spreadsheet execution was needed or attempted. |
| B15 | P2 | Bulk group/subject/type changes rerender and lose unsaved inputs. Repeated saves append duplicate assessments. No draft, warning or idempotency protection. | `app/index.js:82`, `114–126`, `155`; source. |
| B16 | P2 | Add/edit student group choices hardcode Group 1/2, despite dynamic group rendering. No usable arbitrary original-group setup; editing a custom-group record risks reassignment. | `app/index.js:63–64`, `104`; source. |
| B17 | P2 | Only latest 90 assessment rows and five student-history entries render, without full-history pagination. Older stored events lack a complete browsing path. | `app/index.js:90`, `94`; source. |
| B18 | P2 | Incomplete stored state can fall back to a blank model without a recovery message; a later save can replace the original payload. | `app/index.js:30`, `36`, `151`; source risk, not a real-vault destructive test. |

Additional unexercised risks: multiple processes may overwrite the whole vault because no single-instance lock or expected-revision check exists; large classrooms/histories repeatedly serialize/encrypt the entire document synchronously; renderer analytics repeatedly filter the full assessment array. No load benchmark or concurrency-loss test was performed, so these are design risks rather than measured failures.

### 6.1 Known issue verification

| Previously reported issue | Current verdict |
|---|---|
| Unsupported `db.transaction()` | **Not present in current application source.** Installed `DatabaseSync` has no `transaction` method. Migration uses explicit `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`. |
| 19 placeholders for 18 columns | **Corrected.** `main.cjs:235` contains 18 placeholders for 18 columns; actual-source migration SQL executed. |
| Loss of zero score | **Corrected for migration `score` and ordinary form input.** Numeric zero becomes `"0"` at `main.cjs:234`; FormData `"0"` is truthy. Complete numeric/max-score validation remains absent; `maxScore` still uses a generic fallback. |
| Unsafe migration timing | **Unresolved in a different form.** Lock guard exists, but migration is never invoked. Unversioned schema DDL still runs before authentication. |
| Incomplete historical framework versioning | **Confirmed.** Mutable definitions and default `v1` are not an immutable version model. |
| Sensitive records outside encrypted vault | **Confirmed** for educational text and linked assessment/observation JSON. No real data was inspected. |
| Incomplete backend CRUD | **Confirmed.** Most mutations remain renderer operations followed by whole-vault save. |
| Insufficient testing | **Confirmed.** Existing tests mainly exercise copied schema/logic. |
| Dependency vulnerabilities | **Not determined.** Advisory service failed; no clean bill of health or specific vulnerable-package count is justified. Electron pin is behind available stable updates. |
| Missing Git commits | **Confirmed.** Repository has no commits and no recoverable committed baseline. |

## 7. Security and privacy assessment

### 7.1 Useful defenses already present

- Main window sets `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, and `webSecurity:true` (`main.cjs:278`).
- Popup creation is denied; permission requests denied; renderer resource requests restricted to local/data/blob/devtools schemes (`280–281`, `343–347`).
- CSP restricts scripts to bundled local files and disables renderer connections (`app/index.html:6`); no remote script or provider client was found in reviewed source.
- Preload exposes named methods instead of raw `ipcRenderer`; identity/Massar fields are inside the encrypted JSON document in the normal vault path.
- AES-GCM provides authenticated encryption for that document, with a real password KDF. Wrong-password rejection was exercised.

These controls materially reduce attack surface. They do not compensate for plaintext copies or unsafe recovery paths.

### 7.2 Gaps and required boundaries

| Area | Current gap / implication |
|---|---|
| At-rest confidentiality | Audit notes, evidence and JSON are ordinary SQLite values. Migration would additionally populate plaintext assessment notes. “Encrypted SQLite database/backup” is too broad a claim. |
| Backup confidentiality/recovery | `backup()` copies the entire hybrid database. Restore does not authenticate first, enforce schema compatibility or run a tested automatic rollback. `.before-restore` is a raw database copy and inherits plaintext tables. |
| IPC sender validation | `authorized()` checks webContents identity and any `file://` URL, not the exact approved document or sender frame (`main.cjs:274`). Same webContents at an unrelated local URL passed the probe. No exploitable navigation chain was demonstrated. |
| IPC arguments | Whole-document save and variadic log calls lack domain schemas, ID/scope checks, bounded text or semantic validation. Caller-supplied “Teacher” is not an authenticated actor model. |
| Identity/pedagogy separation | Both coexist in the renderer/vault document; a random pseudo field alone does not implement an isolated identity map or safe outbound contract. |
| AI privacy boundary | No actual sender/DTO builder, free-text review/block gate, consent/retention configuration or captured-request redaction tests. The absence of AI today prevents that channel's use; it is not proof future integration is safe. |
| Session/key lifecycle | Manual lock exists; no inactivity lock. Key references are set to null without explicit buffer zeroing. No crash/memory-dump hardening evidence. Password recovery is absent and documented as unavailable. |
| Exports | CSV/JSON are plaintext. Full JSON includes the complete current model, not a privacy-minimized report. Warning text is not a per-export review flow; CSV formula protection missing. |
| Repository hygiene | `.gitignore` excludes common SQLite/dependency/build files, but not all secrets, raw imports, exported CSV/JSON, attachments or alternate-extension backups. This is an accidental-commit risk, not evidence such files are present. |
| Dependencies/release | Electron pin requires update review; advisory verification failed; no signed/installed release evidence or independent security review. |

No embedded OpenAI key was found in the reviewed application source. This statement is limited to the inspected files and is not an exhaustive secret-scanner certification. No legal compliance determination is made. Real-child deployment remains outside the verified safety boundary described by the project requirements.

Electron's official security guidance supports exact sender validation, restricted navigation and maintained runtime updates. The current defenses should be retained and tightened incrementally. [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

## 8. Database, migrations, and historical integrity

### 8.1 Current schema and authority

The schema contains `private_vault`, three audit tables, `app_meta`, positioning frameworks/levels and link tables, assessment cycles, and assessment events (`main.cjs:23–133`). Live UI state still comes from the vault JSON. There are no complete teacher/year/class/enrollment relational entities, and the new framework/event tables have no normal read/CRUD integration.

The tables declare IDs and some indexes/NOT NULL constraints but no foreign-key references, enum checks or score/date validation. The installed Node SQLite environment enables foreign-key enforcement by default; the defect is that this schema declares no relationships for it to enforce.

### 8.2 Migration defects

1. `migrateDataIfNeeded()` has no call site. Create/unlock leave `app_meta` empty, as verified against actual source.
2. `dbInit()` performs unversioned DDL before authentication. There is no sequenced, tested schema migration registry.
3. `current >= SCHEMA_VERSION` silently accepts future versions (`main.cjs:211`) instead of refusing writes by older software.
4. There is no pre-migration backup, integrity validation, explicit recovery workflow or fixture set for prior released formats.
5. Migration creates framework IDs but assigns assessment `framework_id=null` and `framework_version_id='v1'` (`222`, `236`). That does not preserve a test's actual definition snapshot.
6. `INSERT OR IGNORE` may silently skip conflicting/invalid rows and still commit the schema marker. A probe with `studentId:null` inserted no event and committed version 1. An undefined binding instead threw and rolled back; not all invalid rows behave identically.
7. Schema promotion writes notes/criteria into plaintext tables and has no ongoing synchronization with later vault updates.

The explicit transaction and corrected placeholder/zero handling are improvements. **Do not repair this by merely calling the current migration function**: confidentiality, reference integrity, authoritative storage and rollback must be designed together.

### 8.3 History is not event-sourced yet

Individual positioning tests append in the vault, but competency mastery is overwritten in `results`. A separate audit row is sometimes added; it is not the backend source from which current state is derived. Framework edits do not create immutable version rows. Assessment fields default to `v1`; competency “version” uses an event timestamp, not a referenced definition version. Bulk records omit the individual form's audit/version fields.

Original and remediation memberships are current fields/arrays, not effective-dated events. Definition archiving is visually available, but historical interpretation changes. There is no complete correction chain recording superseded events and reasons. These gaps directly affect auditability and whether pre/post results are comparable.

## 9. Automated tests, diagnostics, and Windows validation

### 9.1 Actual command results

Commands were run from `C:\projects\classpilot`. Baseline syntax and both existing scripts passed on 19 November and again on 23 November against identical source hashes.

| Command | Actual result | What it establishes |
|---|---|---|
| `node --version` | `v24.21.0` | External test runtime present. |
| `npm.cmd --version` | `11.19.0` | npm launcher usable. `npm` via `npm.ps1` was blocked by PowerShell execution policy; no global policy changed. |
| `npm.cmd run check` | PASS, exit 0 | Syntax of main, preload, app renderer and login renderer. |
| `node tests/milestone1.test.js` | PASS, exit 0; 3 cases | Direct inserts/selects in its copied audit-table schema and simulated version labels. |
| `node tests/migration_test.js` | PASS, exit 0 | Its separately defined migration preserves a zero score. |
| `npm.cmd ls --depth=0 --json` | PASS, exit 0 | Installed Electron 45.1.0 and builder 26.18.0 satisfy manifest. |
| `npm.cmd ls --all --json` | PASS, exit 0; no dependency-tree problems | Tree consistency, not security. |
| `npm.cmd audit --json --ignore-scripts --fetch-retries=0 --fetch-timeout=15000 --cache node_modules/.codex-audit-cache --logs-max=0` | FAILED, exit 1, advisory bulk endpoint request failed; repeated 23 November | No vulnerability inventory obtained. |
| `npm.cmd install --dry-run --ignore-scripts --offline --no-audit --no-fund --package-lock=false --cache node_modules/.codex-audit-cache --logs-max=0` | FAILED, exit 1, `ENOTCACHED` for Electron metadata | Noninstalling resolution attempt only. No dependencies installed or lockfile changed. |
| `git status --short` / `git branch --show-current` | All project content untracked / `master` | No tracked baseline. |
| `git log -1 --format="%h %s"` | FAILED, no commits | Missing history confirmed. |
| Actual-source backend VM diagnostic | PASS assertions; defects reproduced | Crypto, migration SQL/zero, absent lifecycle migration, plaintext notes, shallow validation, orphan delete, unsafe restore logic. See Appendix A. |
| Actual-source renderer VM diagnostics | Checks completed; defects reproduced | Group counts, subject visibility/retention, RTL, string zero, mutable history, archive counts, same-day order, failed-save state, CSV formula text. |
| Isolated Electron launch | BLOCKED before usable UI | Runtime environment error described below. |
| Installer build / install / upgrade / uninstall | NOT RUN | No installer reliability claim possible. |

A normal `npm install`/`npm ci` was intentionally not run: the current audit-only instruction forbids installing new dependencies, and dependencies already existed. The dry run did not replace this with an actual install. No automatic vulnerability fixes or updates were applied.

### 9.2 Why passing tests do not substantiate the existing status claims

`tests/milestone1.test.js:20` copies table initialization; its cases insert SQL rows directly (`74`, `87`, `101`). The “versioning” case supplies two version strings to that copied table. It never edits a competency through application code, proves immutable definitions, or checks UI history. Its encryption helper is unused.

`tests/migration_test.js:35` defines another migration function instead of calling production migration. It does not cover lifecycle invocation, prior format upgrades, failed upgrade recovery, or preservation of framework references.

Neither existing suite imports `main.cjs`, `preload.cjs`, or the renderer. There is no `test` npm script. Missing automated coverage includes actual domain commands, invalid IPC/sender handling, backup restore/corruption, immutable definitions and membership history, archive filters, imports, privacy/redaction, UI keyboard behavior, and installer upgrades. The audit probes improve evidence for this report but are **not** a checked-in regression suite or a substitute for integration tests.

The milestone test also orders version rows solely by timestamp; same-timestamp ordering is not a reliable version-order guarantee. Existing temporary fictional SQLite files were removed by the passing tests.

### 9.3 Windows desktop launch limitation

A diagnostic bootstrap under the ignored `node_modules/.cache/classpilot-audit` directory loaded the unchanged application and redirected both `userData` and session data into a new synthetic profile before requiring `main.cjs`. It was launched with:

```powershell
$auditElectronFlag = $env:ELECTRON_RUN_AS_NODE
try {
    $env:ELECTRON_RUN_AS_NODE = $null
    & .\node_modules\electron\dist\electron.exe .\node_modules\.cache\classpilot-audit\desktop-smoke.cjs
} finally {
    $env:ELECTRON_RUN_AS_NODE = $auditElectronFlag
}
```

The inherited `ELECTRON_RUN_AS_NODE` flag initially made Electron behave as Node; it was cleared only in the diagnostic process environment. After diagnostic bootstrap setup was corrected, the final attempt failed with:

```text
FATAL: electron/shell/browser/win/install_dir_access.cc:52
Sandboxed processes cannot read C:\projects\classpilot\node_modules\electron\dist:
its ACL has an entry for an AppContainer package SID but none for ALL APPLICATION PACKAGES.
```

An OS encryption-provider error was also emitted. The fatal sandbox-access diagnostic is an **environment blocker**, not evidence of a functional ClassPilot application bug. The process exit status alone was misleadingly zero; the fatal log and lack of a usable app mean launch verification failed. No ACL changes, sandbox disabling or Windows security-policy changes were attempted. The diagnostic processes were stopped; no current UI screenshot or real workspace was inspected. Normal desktop startup, restart persistence, visual QA and installer behavior remain unverified.

### 9.4 Packaging and CI

NSIS x64, stable app ID, ASAR, shortcuts, and a constrained packaged-file allowlist are configured. These are useful foundations. No signing/installer-validation evidence exists.

The Windows workflow installs dependencies, runs syntax checks and builds; it does **not** run either test script (`.github/workflows/build-windows.yml:22–28`). It uses `npm install`, not immutable `npm ci`, omits lockfile/test-only changes from push paths, and triggers on `main` while the local branch is `master`. Signing identity autodiscovery is disabled. The CMD launch helper conditionally installs dependencies if the Electron executable is missing; the build helper always runs installation. Neither runs the tests.

Installer packaging, Windows 10/11 compatibility, clean installation, offline first-run, upgrade, uninstall/reinstall retention, and unsigned/signed distribution behavior require a dedicated Windows test account or machine. None is claimed verified here.

## 10. Architecture evaluation and recommendations

| Dimension | Assessment | Recommended action |
|---|---|---|
| Maintainability | Small dependency surface, familiar stack, clear process split; dense monolithic UI/main functions and mixed domain/persistence concerns | Extract modules incrementally: selectors, domain validation/commands, storage, history, migration/restore, rendering and localization. Keep the interface stable. |
| Scalability | Suitable direction for a local classroom application; whole-document serialization, 18 MiB cap and repeated scans constrain long histories/attachments | Establish representative synthetic benchmarks; move toward one authoritative indexed model as history/imports grow. Keep attachments outside the JSON blob in an encrypted managed store. |
| Security | Real blob encryption and process isolation; serious plaintext-copy, IPC/schema and recovery gaps | Fix confidentiality of every persisted path; enforce schemas/ownership in main; authenticate restore before replacement; retain sandbox/CSP and tighten exact-document/frame authorization. |
| Performance | Synchronous KDF/IPC/SQLite and full rerenders can block interaction; no measurements prove acceptable long-term performance | Measure before optimization; use asynchronous bounded commands and retained form drafts where appropriate. |
| Data integrity | Appending some tests is a good baseline; definitions, membership and competency state lack reliable historical authority | Introduce stable random IDs, scoped ownership, immutable definition snapshots, append-only evidence/corrections, atomic audited commands and expected-revision protection. |
| Extensibility | Electron/SQLite/JS can support imports, reports and a controlled agent; current whole-vault bridge is too permissive | Define narrow backend interfaces first, then isolated import/report/provider modules. No raw SQL/filesystem/network capability for renderer or AI. |
| Delivery | Build configuration exists; no reproducible tested release pipeline | Add actual tests to CI, lockfile-consistent install and validated Windows upgrade/recovery gates. |

**Continue the stack and refactor selected components.** React/TypeScript or a different database encryption driver may be evaluated later against concrete requirements, packaging/ABI tests and migration recovery. They are not prerequisites to correcting current defects, and replacing the renderer would not by itself fix privacy or historical integrity.

For storage, first document a single authority and encryption boundary. An interim encrypted event/snapshot model can preserve safety while relational indexing is introduced carefully; any future SQLCipher-compatible or other encrypted database route needs a separate measured decision and migration test. Do not silently normalize child-related text into plaintext SQL for convenience.

Electron 45 is within the current supported major-release window, but the exact installed 45.1.0 is behind the official stable 45.4.1 listed at the final review. The latter includes upstream component fixes. This is reason to evaluate an update in a tested maintenance milestone, not proof of a particular CVE in this lockfile. [Official release listing](https://releases.electronjs.org/?channel=stable), [45.4.1 release notes](https://releases.electronjs.org/release/v45.4.1), [support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines).

### 10.1 Technical debt and documentation contradictions

- `docs/DEVELOPMENT_STATUS.md` says M1 is complete with immutable framework versions and preserved history; edit paths contradict this.
- `docs/FEATURE_MATRIX.md` claims profile isolation, backup/restore and versioning complete, while also acknowledging incomplete history and framework versioning elsewhere. It is not a reliable release checklist.
- `docs/DECISIONS.md` describes a hybrid store and future granular commands, but treats relational audit detail as non-sensitive even though actual payloads include educational remarks. Several stated next steps are still absent.
- Old and new roadmap milestone numbering differ. Future tracking should use the master prompt's M0–M7 sequence and map legacy items explicitly.
- Prototype wording remains in desktop UI and exports; some pages describe an unsecured HTML demo or claim 39 fictional profiles independent of actual roster state. Correct wording after functional truth is established.
- No committed baseline, central `test` script, actual-code test imports, complete UI accessibility strategy, or validated migration/release process exists.

Existing status/decision files were not rewritten during this audit. This report records the discrepancies so the next authorized engineering milestone can reconcile them with evidence.

## 11. Estimated completion and calculation

**Weighted implemented scope: 23/100, approximately one quarter, with an uncertainty range of 20–30%.** The large interface footprint should not be confused with finished persistence, history, imports, planning, privacy or release workflows.

Weights represent relative product scope/risk, not lines of code or measured engineering days. Coverage fractions credit actual prototype paths, discount material defects/missing subflows, and give no credit for labels, SQL table declarations alone, or planned notices. This is an engineering estimate, not a mechanical conversion from the five feature-status labels.

| Workstream | Weight / 100 | Estimated capability coverage | Earned points |
|---|---:|---:|---:|
| Foundation, authentication, security and profiles | 15 | 25% | 3.75 |
| Students, classes, subjects and original groups | 12 | 35% | 4.20 |
| Competencies, positioning definitions and historical integrity | 15 | 20% | 3.00 |
| Assessment entry, dashboards and trustworthy analytics | 18 | 45% | 8.10 |
| Import Center and reviewed annual-plan imports | 12 | 0% | 0.00 |
| Journal, portfolio, remediation/peers, timetable and manual plans | 10 | 15% | 1.50 |
| Reports, localization and accessibility | 8 | 25% | 2.00 |
| OpenAI agent, knowledge base, privacy pipeline and automation | 7 | 0% | 0.00 |
| Windows delivery and release QA | 3 | 15% | 0.45 |
| **Total** | **100** | | **23.00** |

Formula: `sum(workstream weight × estimated coverage fraction) = 23`. No calendar completion date is defensible before the foundation defects are resolved and reliable throughput/test coverage are measured. The broad-module matrix has no fully verified end-to-end module; the estimate explicitly includes incomplete and unaccepted capability.

## 12. Prioritized development roadmap

This is a recommendation for subsequent authorized work, preserving all agreed modules. It follows the master prompt's M0–M7 labels rather than the conflicting older roadmap numbering.

| Order | Milestone | Concrete deliverable | Exit evidence |
|---|---|---|---|
| 1 | M0/M1 — storage and recovery foundation | Establish committed fictional baseline; test production storage code; close plaintext-copy paths; validated atomic writes; authenticated restore/recovery and explicit schema compatibility policy | Synthetic privacy canaries absent from unencrypted persistence; rejected corrupt/incompatible backups leave working data intact; save/audit failure tests; actual Windows startup once environment permits |
| 2 | M1 — scope and roster integrity | Teacher/year/class/enrollment boundaries, configurable original groups, archive filters, stable random identity, non-destructive movement; preserve subject checkboxes | 39/20/19 tests plus arbitrary groups; no archived students in active operations; isolation and membership-history tests; restart persistence |
| 3 | M2 — pedagogical definitions | Immutable competency/framework/level versions, structured criteria and provenance, backend commands, teaching progression/timetable foundation | Editing/archiving definitions preserves old result meaning; explicit compatibility; teacher-managed settings, no inferred mastery |
| 4 | M3 — assessments/dashboard correctness | Typed cycles/events, correction chain, batch entry, zero/missing validation, retained drafts, deterministic current/pre/post selectors, comparable charts | Matched cohorts/coverage shown, same-day order tested, top baseline/current/latest-post per active subject, bulk atomicity/deduplication and keyboard checks |
| 5 | M4 — Import Center, staged by target | Start roster and assessment XLSX/CSV early after required storage contracts; complete competencies, levels, groups, notes and timetable imports; reviewed annual-plan document pipeline | Preview/mapping/row errors, Arabic/French/leading zeros/date handling, repeated import, transaction, provenance, cancellation and safe rollback; no fake successful import |
| 6 | M5 — teaching workflow/reports | Encrypted work portfolio, journal/corrections/templates, remediation and peer history, interventions, manual individual/group weekly plans, offline PDF/XLSX | Plan delivery/outcome lifecycle; attachment privacy/restore; Arabic/French report QA; Excel roundtrip and formula protection |
| 7 | M6 — optional AI | Authenticated provider adapter, synthetic/mock mode, allowlisted scoped tools/DTOs, privacy gate, contextual conversation, local KB, reviewed plans, usage controls and scheduler | Captured outbound canary tests, prompt-injection/tool/scope tests, provider errors/cancel/retry/caps, no official changes without teacher approval, authorized retention gate |
| 8 | M7 — product release | Comprehensive regression, accessibility/RTL, load/offline/recovery, signing guidance and actual Windows install/upgrade/uninstall validation | Recorded Windows test matrix and artifacts; dependency/security review; independent privacy/security review before real-child deployment |

Packaging smoke checks should begin early; they are not a reason to defer fixing known privacy/data-loss risks. The final release gate remains distinct from the ability to generate an EXE.

## 13. Recommended next implementation milestone

**Proposed bounded milestone: “M0.1 — Confidential persistence and safe restore.”** This audit does not execute it.

Deliver a small storage service extracted from the current main process, with tests that exercise its real functions. Preserve existing screens and live data format unless a tested migration is necessary. The milestone should:

1. Establish an audited local Git baseline and feature branch, expand privacy-safe exclusions, and add a single reproducible test command without a UI rewrite.
2. Ensure new audit/evidence writes and backups cannot contain plaintext educational content. Specify secure recovery/migration of existing synthetic legacy copies, including SQLite residual-page and backup-retention implications; stopping future inserts alone is insufficient.
3. Introduce a validated mutation boundary for the affected assessment/status operations so the official change and audit commit succeed or fail together. Make failed saves leave forms/state recoverable.
4. Authenticate/decrypt/validate a candidate backup, check format/schema/integrity, and stage replacement before touching the working store. Provide tested rollback and restart behavior. Do not log raw backup content.
5. Define migration version guards and a pre-upgrade backup/recovery contract; **do not enable the current plaintext duplicate-table promotion unchanged**.

Acceptance should use only synthetic fixtures and cover wrong password, altered ciphertext/tag, missing/invalid schema, future version, interrupted replacement, rejected save, audit failure, and confidentiality of stored/backup bytes. A successful restore must recover matching students, subjects, assessments, notes and history; every rejected restore must leave the original workspace usable.

Explicitly outside this bounded milestone: full normalized schema rollout, all profile/class features, complete framework manager, Import Center, attachment portfolio, AI, and renderer framework migration. Those remain in the roadmap and are not waived.

### 13.1 Exact verification and future run/build commands

The following checks were executed and can be rerun against the current source:

```powershell
Set-Location C:\projects\classpilot
npm.cmd run check
node tests/milestone1.test.js
node tests/migration_test.js
npm.cmd ls --depth=0 --json
npm.cmd ls --all --json
git status --short
git log -1 --format="%h %s"
```

The following are existing product commands, supplied for a future controlled Windows test account with fictional data. They were **not** verified as successful launch/build commands in this audit, and normal startup uses that account's application data:

```powershell
npm.cmd start
npm.cmd run build:win
npm.cmd run build:portable
```

The configured NSIS output is `dist/ClassPilot-Setup-0.1.0.exe`. This is an expected artifact path, not an artifact delivered by this audit. No source/dependency installation, Git staging/commit, build, deployment or feature implementation was performed.

## Appendix A — Reproducible actual-source backend diagnostic

This read-only application-source diagnostic writes no files. It evaluates the actual backend with Electron/filesystem effects mocked and real in-memory SQLite/crypto. The probe deliberately asserts current defects as well as useful behavior; after fixes, the defect assertions should fail or be replaced by proper regression tests. It is not an application integration test or a safe-restore certification.

From the repository root, use a PowerShell literal here-string piped to `node`:

```powershell
@'
const fs = require('node:fs'), vm = require('node:vm');
const assert = require('node:assert/strict');
const db = new (require('node:sqlite').DatabaseSync)(':memory:');
const handlers = new Map(), copies = [];
const wc = {getURL: () => 'file:///synthetic-audit.html'};
const badBackup = {
  prepare: () => ({get: () => ({
    salt: Buffer.alloc(24), iv: Buffer.alloc(12), auth_tag: Buffer.alloc(16),
    encrypted_json: Buffer.from('invalid')
  })}), close() {}
};
const electron = {
  app: {getPath: () => '.', whenReady: () => ({then() {}}), on() {}},
  ipcMain: {
    on: (name, fn) => handlers.set(name, fn),
    handle: (name, fn) => handlers.set(name, fn)
  },
  dialog: {showOpenDialog: async () => ({filePaths: ['FAKE_BACKUP']})}
};
const box = {
  module: {exports: {}}, Buffer, console, process, __dirname: '.',
  setImmediate() {}, externalWC: wc,
  require(name) {
    if (name === 'electron') return electron;
    if (name === 'node:sqlite') return {DatabaseSync: function(path) {
      return path === 'FAKE_BACKUP' ? badBackup : db;
    }};
    if (name === 'node:fs') return {copyFileSync: (...args) => copies.push(args)};
    return require(name);
  }
};
const exportsForProbe = `
module.exports = {
  createVault, openVault, persist, migrateDataIfNeeded, logAssessmentChange,
  setup() { mainWindow = {webContents: externalWC}; },
  state() { return openedData; },
  lock() { cryptoKey = null; openedData = null; }
};`;
vm.runInNewContext(fs.readFileSync('main.cjs', 'utf8') + exportsForProbe, box);
const m = box.module.exports;
const pass = require('node:crypto').randomBytes(24).toString('hex');
m.setup(); m.createVault(pass, 'empty', ['fr'], 'en');
const data = {
  students: [{id: 'FAKE-1', name: 'SYNTHETIC_IDENTITY_CANARY'}],
  activeSubjects: ['fr'],
  assessments: [{id: 'A-1', studentId: 'FAKE-1', subject: 'fr', score: 0,
    note: 'SYNTHETIC_NOTE_CANARY'}],
  observations: [], groups: [],
  levels: {fr: [{id: 'L-1', name: 'Synthetic', order: 1}]}
};
m.persist(data);
const encrypted = db.prepare('SELECT encrypted_json FROM private_vault').get();
assert(!Buffer.from(encrypted.encrypted_json).includes(Buffer.from(data.students[0].name)));
m.lock(); assert.throws(() => m.openVault('wrong-synthetic-value'));
m.openVault(pass);
assert.equal(m.state().students[0].name, data.students[0].name);
assert.equal(db.prepare('SELECT COUNT(*) n FROM app_meta').get().n, 0);
console.log('PASS vault roundtrip/wrong password; CONFIRMED migration not invoked');
m.logAssessmentChange('SyntheticTeacher', 'FAKE-1', 'fr', 'A-1', 'create', null,
  JSON.stringify(data.assessments[0]), 'Synthetic', 'v1');
assert(db.prepare('SELECT new_data FROM assessment_audit_log').get()
  .new_data.includes('SYNTHETIC_NOTE_CANARY'));
console.log('CONFIRMED plaintext note');
m.migrateDataIfNeeded();
assert.equal(db.prepare('SELECT score FROM assessment_events').get().score, '0');
console.log('PASS actual migration SQL and numeric zero');
m.persist({students: [null], activeSubjects: ['unknown'], assessments: []});
console.log('CONFIRMED malformed state accepted');
m.persist({students: [{id: 'FAKE-1'}], activeSubjects: ['fr'], assessments: [],
  observations: [], groups: [], results: {'FAKE-1': {fr: {C: 'mastered'}}},
  plans: [{id: 'P-1', studentId: 'FAKE-1'}]});
const event = {sender: wc};
handlers.get('student-delete')(event, {studentId: 'FAKE-1', confirm: true});
assert.equal(event.returnValue.ok, true);
assert.equal(m.state().students.length, 0);
assert(m.state().results['FAKE-1']);
assert.equal(m.state().plans[0].studentId, 'FAKE-1');
console.log('CONFIRMED orphan results and plan after deletion');
(async () => {
  const result = await handlers.get('vault-restore')({sender: wc});
  assert.equal(result.ok, true); assert.equal(copies.length, 2);
  console.log('CONFIRMED malformed backup accepted (filesystem mocked)');
})().catch(error => { console.error(error); process.exitCode = 1; });
'@ | node
```

## Appendix B — Audit deliverable and remaining verification

**Project-content file created:** `docs/CODEX_PROJECT_AUDIT.md`. No existing application, dependency, test, status or specification file was edited. No Git commit was created; the initial snapshot remains uncommitted as found.

Outstanding evidence: a functioning advisory scan; actual Windows app startup/restart with synthetic data; real backup/restore and migration recovery; full accessibility/RTL visual checks; PDF/XLSX export checks once implemented; synthetic load/concurrency measurements; actual installer clean-install/upgrade/uninstall; and independent privacy/security review. These gaps limit release claims but do not prevent the next local foundation milestone.
