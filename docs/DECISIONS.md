# ClassPilot — Architectural and Engineering Decisions

## 2026-11-18: Implementation of Milestone 1 Core

### Decision: Relational Schema vs. Encrypted Blob
**Context:** The application currently stores all pedagogical data in an encrypted JSON blob within a single SQLite table. `MASTER_DEVELOPMENT_PROMPT.md` requires a normalized relational model, but also requires "audited encryption" (SQLCipher).
**Decision:** We will maintain the encrypted vault for sensitive student records and assessment details to ensure immediate "at-rest" security using the existing `aes-256-gcm` implementation. However, we are introducing structured SQL tables for Audit Logs (`competency_audit_log`, `framework_audit_log`) and will transition towards a hybrid model where IDs and non-sensitive metadata are relational, while PII and detail payloads remain encrypted.
**Consequence:** Enables backend-enforced audit trails and relational querying for dashboards without sacrificing the primary privacy requirement.

### Decision: Versioning Strategy for Competencies and Frameworks
**Context:** Requirement for "complete versioning" to preserve historical assessment meaning.
**Decision:** We will use an "Immutable Version" pattern. Substantive changes to a competency or positioning level (criteria, thresholds, description) will generate a new `version_id` (timestamp-based UUID). Assessments will record the `version_id` of the framework active at the time of the event.
**Consequence:** Historical assessments remain valid even if the teacher redefines the level criteria later. The UI will show "Version Mismatch" warnings when comparing non-comparable framework versions.

### Decision: Backend-Enforced Audit Logging
**Context:** Requirement that audit logging is not dependent on frontend calls.
**Decision:** New IPC handlers (`competency-update`, `assessment-record`, etc.) will replace the generic `vault-save` for material pedagogical changes. The backend will perform the update and write to the audit log table within a single logical operation.
**Consequence:** Improved data integrity and compliance with pedagogical standards.

## Next Steps
- Implement `version_id` in the data schema.
- Migrate from generic `vault-save` to granular IPC handlers.
- Add "Version History" view to the student dashboard.