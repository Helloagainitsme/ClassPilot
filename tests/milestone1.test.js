/**
 * Milestone 1 - Foundation & Data Integrity Test Suite
 * Tests competency versioning, audit logging, and basic CRUD.
 * Uses fictional data only.
 */
const { DatabaseSync } = require('node:sqlite');
const { randomUUID, randomBytes, scryptSync, createCipheriv, createDecipheriv } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

// Mock Electron app path for testing
const testDbPath = path.join(__dirname, 'test-classpilot.sqlite');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const db = new DatabaseSync(testDbPath);

// Helper for UUID
const uid = () => randomUUID();

// Initialize tables (logic copied from main.cjs)
function initTables() {
  db.exec('CREATE TABLE IF NOT EXISTS private_vault (id INTEGER PRIMARY KEY CHECK(id=1), salt BLOB NOT NULL, iv BLOB NOT NULL, auth_tag BLOB NOT NULL, encrypted_json BLOB NOT NULL, revision INTEGER NOT NULL DEFAULT 1);');
  db.exec(`CREATE TABLE IF NOT EXISTS competency_audit_log (
    id TEXT PRIMARY KEY,
    teacher_ref TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    student_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    competency_id TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    change_reason TEXT,
    evidence TEXT,
    source TEXT,
    version_id TEXT NOT NULL
  );`);
  db.exec(`CREATE TABLE IF NOT EXISTS framework_audit_log (
    id TEXT PRIMARY KEY,
    teacher_ref TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_data TEXT,
    new_data TEXT NOT NULL,
    reason TEXT,
    version_id TEXT NOT NULL
  );`);
}

// Encryption mock
const testKey = Buffer.alloc(32, 'test-key');
function encrypt(data) {
  const content = Buffer.from(JSON.stringify(data), 'utf8');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', testKey, iv);
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), encrypted };
}

// Test cases
async function runTests() {
  console.log('--- Starting Milestone 1 Tests ---');
  initTables();

  // 1. Test Audit Log Insertion
  console.log('Test 1: Competency Audit Logging...');
  const studentId = 'STU-001';
  const subId = 'fr';
  const compId = uid();
  const v1 = 'v1.0.0';

  db.prepare('INSERT INTO competency_audit_log (id, teacher_ref, timestamp, student_id, subject_id, competency_id, previous_status, new_status, change_reason, evidence, source, version_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
    uid(), 'TestTeacher', new Date().toISOString(), studentId, subId, compId, 'notAssessed', 'mastered', 'Initial assessment', 'Teacher observation', 'interface', v1
  );

  const row = db.prepare('SELECT * FROM competency_audit_log WHERE student_id = ?').get(studentId);
  if (row && row.new_status === 'mastered') {
    console.log('✅ Competency audit log successfully created.');
  } else {
    throw new Error('❌ Failed to create competency audit log.');
  }

  // 2. Test Framework Audit Logging
  console.log('Test 2: Framework Audit Logging...');
  db.prepare('INSERT INTO framework_audit_log (id, teacher_ref, timestamp, entity_type, entity_id, entity_name, action, previous_data, new_data, reason, version_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    uid(), 'TestTeacher', new Date().toISOString(), 'competency', compId, 'Reading Fluency', 'create', null, JSON.stringify({name: 'Reading Fluency'}), 'New subject curriculum', v1
  );

  const fRow = db.prepare('SELECT * FROM framework_audit_log WHERE entity_id = ?').get(compId);
  if (fRow && fRow.action === 'create') {
    console.log('✅ Framework audit log successfully created.');
  } else {
    throw new Error('❌ Failed to create framework audit log.');
  }

  // 3. Test Versioning logic (simulation)
  console.log('Test 3: Framework Versioning Logic...');
  const v2 = 'v1.1.0';
  db.prepare('INSERT INTO framework_audit_log (id, teacher_ref, timestamp, entity_type, entity_id, entity_name, action, previous_data, new_data, reason, version_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    uid(), 'TestTeacher', new Date().toISOString(), 'competency', compId, 'Reading Fluency', 'update', fRow.new_data, JSON.stringify({name: 'Reading Fluency', criteria: 'Reads 40 wpm'}), 'Refining criteria', v2
  );

  const versions = db.prepare('SELECT version_id FROM framework_audit_log WHERE entity_id = ? ORDER BY timestamp DESC').all(compId);
  if (versions.length === 2 && versions[0].version_id === v2) {
    console.log('✅ Framework versioning preserved history.');
  } else {
    throw new Error('❌ Failed to preserve framework version history.');
  }

  console.log('--- All Milestone 1 Tests Passed ---');
  db.close();
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
