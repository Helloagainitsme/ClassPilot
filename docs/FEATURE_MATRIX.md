# ClassPilot Feature Matrix

## Overview
Tracks progress on implementing required features across milestones per MASTER_DEVELOPMENT_PROMPT.md

## Environment Setup (M0)

| Feature | Milestone | Status | Test Command | Evidence |
|---------|-----------|---------|--------------|----------|
| Electron desktop app structure | M0 | ✅ COMPLETE | npm run check | Source code syntax verification |
| Basic vault encryption | M0 | ✅ COMPLETE | - | Maintains AES-256-GCM encryption |
| Profile isolation | M0 | ✅ COMPLETE | - | Separate teacher profiles |
| Offline-first operation | M0 | ✅ COMPLETE | - | No network dependencies |
| Windows build scripts | M0 | ✅ COMPLETE | npm run build:win | electron-builder config |

## Student & Subject Core (M1)

| Feature | Milestone | Status | Test Command | Evidence |
|---------|-----------|---------|--------------|----------|
| Student CRUD operations | M1 | ❌ INCOMPLETE | - | Basic student creation works, edit/archive not implemented |
| Student enrollment with group assignment | M1 | ✅ COMPLETE | - | Group-based filtering functional |
| Subject activation via checkboxes | M1 | ✅ COMPLETE | - | Only active subjects display |
| Competency manager per subject | M1 | ✅ COMPLETE | node tests/milestone1.test.js | Versioning and audit logs tested |
| Positioning framework manager | M1 | ✅ COMPLETE | node tests/milestone1.test.js | Versioning and audit logs tested |
| Assessment evidence history | M1 | ✅ COMPLETE | node tests/milestone1.test.js | Competency audit logging implemented in SQLite |
| Encrypted local persistence | M1 | ✅ COMPLETE | - | AES-256-GCM vault functional |
| Backup/restore | M1 | ✅ COMPLETE | - | SQLite backup/restore works |

## Positioning & Assessments (M2)

| Feature | Milestone | Status | Test Command | Evidence |
|---------|-----------|---------|--------------|----------|
| Level manager with criteria | M2 | ❌ INCOMPLETE | - | Level definitions lack version history |
| Initial/pre/post-test cycles | M2 | ✅ COMPLETE | - | Test types and positioning work |
| Class/group bulk assessment grid | M2 | ✅ COMPLETE | - | Saisie collective functional |
| Pre/post comparison | M2 | ✅ COMPLETE | - | Side-by-side comparisons available |
| Pre/post compatibility warnings | M2 | ❌ INCOMPLETE | - | Not implemented |
| Level framework switching | M2 | ❌ INCOMPLETE | - | Historical results integrity not guaranteed |

## Import Center (M4)

| Feature | Milestone | Status | Test Comment | Evidence |
|---------|-----------|---------|--------------|----------|
| Student roster XLSX/CSV import | M4 | ❌ INCOMPLETE | - | Import Center not implemented |
| Assessment import with preview | M4 | ❌ INCOMPLETE | - | Import functionality missing |
| Competency library import | M4 | ❌ INCOMPLETE | - | Extraction not implemented |
| Positioning level library import | M4 | ❌ INCOMPLETE | - | Import module absent |
| Annual plan import PDF/DOCX | M4 | ❌ INCOMPLETE | - | Document processing not available |

## Pedagogical Workflow (M3)

| Feature | Milestone | Status | Test Command | Evidence |
|---------|-----------|---------|--------------|----------|
| Learning journal/observations | M3 | ❌ INCOMPLETE | - | CRUD exists but attachment management missing |
| Work samples/attachments | M3 | ❌ INCOMPLETE | - | Attachment storage not implemented |
| Intervention history | M3 | ❌ INCOMPLETE | - | Track/delivery status not available |
| Peer pairs & groups | M3 | ❌ INCOMPLETE | - | Remediation groups exist but peer pairing missing |
| Timetable & academic calendar | M3 | ❌ INCOMPLETE | - | Schedule management not available |
| Manual weekly planning | M3 | ❌ INCOMPLETE | - | Planning module not implemented |

## AI Integration (M5)

| Feature | Milestone | Status | Test Comment | Evidence |
|---------|-----------|---------|--------------|----------|
| AI agent infrastructure | M5 | ❌ INCOMPLETE | - | No agent framework implemented |
| OpenAI integration | M5 | ❌ INCOMPLETE | - | Provider adapter not built |
| Controlled AI tools | M5 | ❌ INCOMPLETE | - | Tool system not available |
| Weekly plan proposals | M5 | ❌ INCOMPLETE | - | AI planning not functional |
| Local teaching knowledge base | M5 | ❌ INCOMPLETE | - | Resource management not available |

## Reports & Exports (M3)

| Feature | Milestone | Status | Test Command | Evidence |
|---------|-----------|---------|--------------|----------|
| Student reports PDF | M3 | ❌ INCOMPLETE | - | Report generation not available |
| Excel exports | M3 | ❌ INCOMPLETE | - | Only CSV/JSON exports exist |
| Group comparisons | M3 | ❌ INCOMPLETE | - | Group analysis not available |

## Security & Privacy (M5)

| Feature | Milestone | Status | Test Comment | Evidence |
|---------|-----------|---------|--------------|----------|
| Data privacy controls | M5 | ❌ INCOMPLETE | - | Pseudonymization not implemented |
| AI data security | M5 | ❌ INCOMPLETE | - | Payload redaction not available |
| n8n integration | M5 | ❌ INCOMPLETE | - | Server adapter not built |
| Access controls | M5 | ❌ INCOMPLETE | - | Permission management not available |

## Localization (M5)

| Feature | Milestone | Status | Test Command | Evidence |
|---------|-----------|---------|--------------|----------|
| RTL support (Arabic) | M5 | ✅ COMPLETE | - | RTL interface functional |
| Arabic text shaping | M5 | ✅ COMPLETE | - | Arabic font rendering works |
| French/English support | M5 | ✅ COMPLETE | - | Multilingual interface works |

## Remaining Critical Blocker

The largest missing piece for M1 is **comprehensive competency event history** – current status changes are not appended as dated audit records. This affects accountability and reporting.

Other major gaps: Import Center (M4), full teaching workflow (M3), AI agent (M5), robust reporting, and secure production release.

## Priority for Next Milestone

Implement **foundational improvements** per M0/M1 that address critical data integrity issues while preserving existing working UI. Focus on:

1. **Event-sourced competency history** (M1 priority)
2. **Safe database migrations** for historical data preservation
3. **Enhanced backup/restore** reliability

Deliver a working baseline before claiming progress beyond M1 scope.