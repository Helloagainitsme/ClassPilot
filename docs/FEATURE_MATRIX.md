# ClassPilot Feature Matrix

Updated 24 November 2026. The historical audit remains unchanged as the baseline; this matrix records M0.1 changes without claiming full M1 completion. All master-specification requirements remain in scope.

## M0.1 verified storage boundary

| Requirement | Current evidence | Limits |
|---|---|---|
| Encrypted live data, backend change history and legacy archive | lib/vault-store.cjs; production disk/canary tests | Full security audit and attachment store pending |
| Atomic revisioned state plus audit | lib/workspace.cjs and VaultStore.save; commit-failure/CAS tests | Full framework/event model and history UI pending |
| Legacy migration and authenticated staged restore | Wrong password, corruption, future schema, legacy row/free-page/WAL, replacement-fault tests | Native power-loss/installed Windows workflow unverified |
| Renderer failure recovery and minimal IPC | Actual-source renderer and main-frame IPC tests | Live visual/keyboard/localization QA incomplete |

Run `npm.cmd run check`, `npm.cmd test` and `npm.cmd run test:legacy`. Operational details and remaining gates: [M0.1 storage runbook](M0_1_STORAGE.md).

## Product modules

Classification covers each complete requested module. A partially implemented module can contain verified subfeatures.

| ID | Functional module | Classification | Evidence and remaining scope |
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
| F10 | Competency Manager | Partially implemented | Add/edit/order/activate/archive/restore retained. Backend now preserves encrypted change deltas atomically. Immutable definition versions, structured criteria/prerequisites/provenance and history UI remain unfinished. |
| F11 | Positioning Levels Manager | Partially implemented | Name, description, order, archive/restore exist (`93`, `104`, `132`). No working multiple-framework/version selection, immutable criteria history or compatibility checks. SQL table declarations alone do not implement these workflows. |
| F12 | Initial positioning tests | Partially implemented | `pre` type, baseline selector and top summary exist (`65–71`, `104`, `132`). Initial positioning and pre-test cannot be configured separately; no cycle/instrument/version-safe association. |
| F13 | Pre-tests and post-tests | Partially implemented | Individual records append to vault and initial/latest selectors exist. No operational cycle manager, separate latest-post header or trustworthy framework comparison (`65–72`, `132`). |
| F14 | Intermediate assessments | Partially implemented | `mid` supported in individual and bulk forms. Shared validation, history, framework and latest-selection limitations remain (`82`, `104`, `132`). |
| F15 | Whole-class assessment entry | Partially implemented | Original-group assessment grid retained. Every saved batch now participates in backend-derived encrypted audit and atomic vault persistence. Draft retention across scope changes, deduplication, complete semantic grid navigation and framework-version linkage remain unfinished. |
| F16 | Excel and CSV Import Center | Not implemented | No import route, parser, sheet selection, mapping, preview, validation, duplicate review, transaction, import provenance or rollback. CSV export is not an importer. |
| F17 | Annual teaching plan imports | Not implemented | Button displays a planned-feature notice (`92`, `131`). No PDF/DOCX/PPTX/XLSX extraction, manual structured import pipeline or teacher-review staging. |
| F18 | Learning journal | Partially implemented | Dated student/subject/competency observations append and display (`95`, `104`, `132`). No search/filter, correction trail, teaching stage, attachment or intervention integration. |
| F19 | Teacher observations | Partially implemented | Dated notes retained in the encrypted live document and backend audit, with append-only existing evidence. Templates, teaching context/outcomes, correction workflow and privacy review remain unfinished. |
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
| F33 | Security, backups and restoration | Partially implemented | Format 2 storage, encrypted audit/archive, migration and authenticated restore have production-service regression coverage. Native Windows UI/installer, full privacy review and remaining session/scope controls are unverified. See M0_1_STORAGE.md. |
| F34 | Windows installer | Implemented but not verified | NSIS x64 config, ASAR/file allowlist, scripts and Windows CI exist (`package.json:20–27`). No built/installed/upgrade-tested artifact. Local desktop launch was blocked by environment ACLs. |
