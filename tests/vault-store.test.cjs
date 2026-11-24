'use strict';

// Every record is invented. Tests exercise the production storage service on
// isolated temporary databases, never Electron's application-data directory.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, randomUUID, scryptSync, createCipheriv, createDecipheriv } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { spawnSync } = require('node:child_process');
const { VaultStore, STORAGE_VERSION } = require('../lib/vault-store.cjs');

function isolated(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classpilot-storage-test-'));
  const stores = [];
  const store = (name = 'workspace.sqlite', options) => {
    const instance = new VaultStore(path.join(dir, name), options);
    stores.push(instance);
    return instance;
  };
  t.after(() => {
    for (const instance of stores) {
      try { instance.close(); } catch { /* A failure case may already be closed. */ }
    }
    const resolved = path.resolve(dir);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('classpilot-storage-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { dir, store, file: name => path.join(dir, name) };
}

const password = () => randomBytes(24).toString('hex');
const options = () => ({ subjects: ['fr', 'math'], lang: 'en', mode: 'empty' });

function fictionalData(tag = 'A') {
  return {
    lang: 'en', planLang: 'fr', activeSubjects: ['fr', 'math'],
    students: [{ id: 'SYNTHETIC-1', pseudo: randomUUID(),
      name: `SYNTHETIC_STUDENT_CANARY_${tag}`, massar: `SYNTHETIC_ID_CANARY_${tag}`,
      group: 'Groupe 1', grade: '2', added: '2026-11-20' }],
    competencies: { fr: [{ id: 'C-FR-1', name: 'Invented reading objective',
      description: 'Synthetic success criterion', order: 1, active: true, archived: false }], math: [] },
    levels: { fr: [{ id: 'L-FR-1', name: 'Synthetic starting level',
      description: 'Invented observable task', order: 1, archived: false }], math: [] },
    assessments: [{ id: `A-PRE-${tag}`, studentId: 'SYNTHETIC-1', subject: 'fr',
      type: 'pre', date: '2026-11-20', levelId: 'L-FR-1', score: 0,
      note: `SYNTHETIC_ASSESSMENT_NOTE_${tag}` }],
    observations: [{ id: `O-${tag}`, studentId: 'SYNTHETIC-1', subject: 'fr',
      competencyId: 'C-FR-1', date: '2026-11-20',
      text: `SYNTHETIC_OBSERVATION_${tag} — progrès fictifs — ملاحظة افتراضية` }],
    results: { 'SYNTHETIC-1': { fr: { 'C-FR-1': 'guided' }, math: {} } },
    groups: [{ id: 'G-FR-1', name: 'Invented support group', subject: 'fr',
      focus: 'Synthetic objective', members: ['SYNTHETIC-1'] }],
    plans: [{ id: `P-${tag}`, studentId: 'SYNTHETIC-1', subject: 'fr',
      objective: 'Invented practice', activities: ['Synthetic guided task'],
      status: 'suggested', created: '2026-11-20' }],
    weeklySessions: { fr: 6, math: 5 }
  };
}

function populated(store, pass, tag = 'A') {
  const created = store.create(pass, options());
  const data = fictionalData(tag);
  store.save(data, created.revision);
  return store.snapshot();
}

function readDatabase(filename, fn) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try { return fn(db); } finally { db.close(); }
}

function changeDatabase(filename, fn) {
  const db = new DatabaseSync(filename);
  try { fn(db); } finally { db.close(); }
}

function assertCiphertextOnly(filename, canaries) {
  const bytes = fs.readFileSync(filename);
  for (const canary of canaries) {
    assert.equal(bytes.includes(Buffer.from(canary, 'utf8')), false,
      'A synthetic identity/evidence canary must not appear in persisted bytes');
  }
  readDatabase(filename, db => {
    const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
    assert.deepEqual(tables, ['app_meta', 'private_vault']);
    assert.equal(Number(db.prepare('SELECT value FROM app_meta WHERE key=?').get('storage_version').value), STORAGE_VERSION);
  });
}

function fileList(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(dir, entry.name);
    return entry.isDirectory() ? fileList(filename) : [filename];
  });
}

// This is a legacy-format fixture builder, not a copied migration. Migration
// itself is always executed through the production VaultStore.unlock/restore.
function legacyFixture(filename, pass, data = fictionalData('LEGACY'), extra = {}) {
  const salt = randomBytes(24), iv = randomBytes(12);
  const key = scryptSync(pass, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const db = new DatabaseSync(filename);
  try {
    db.exec(`
      PRAGMA secure_delete=OFF;
      CREATE TABLE private_vault (id INTEGER PRIMARY KEY CHECK(id=1), salt BLOB NOT NULL,
        iv BLOB NOT NULL, auth_tag BLOB NOT NULL, encrypted_json BLOB NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE competency_audit_log (id TEXT PRIMARY KEY, teacher_ref TEXT NOT NULL,
        timestamp TEXT NOT NULL, student_id TEXT NOT NULL, subject_id TEXT NOT NULL,
        competency_id TEXT NOT NULL, previous_status TEXT, new_status TEXT NOT NULL,
        change_reason TEXT, evidence TEXT, source TEXT, version_id TEXT NOT NULL);
      CREATE TABLE framework_audit_log (id TEXT PRIMARY KEY, teacher_ref TEXT NOT NULL,
        timestamp TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
        entity_name TEXT NOT NULL, action TEXT NOT NULL, previous_data TEXT,
        new_data TEXT NOT NULL, reason TEXT, version_id TEXT NOT NULL);
      CREATE TABLE assessment_audit_log (id TEXT PRIMARY KEY, teacher_ref TEXT NOT NULL,
        timestamp TEXT NOT NULL, student_id TEXT NOT NULL, subject_id TEXT NOT NULL,
        assessment_id TEXT NOT NULL, action TEXT NOT NULL, previous_data TEXT,
        new_data TEXT NOT NULL, reason TEXT, framework_version_id TEXT NOT NULL);
      CREATE TABLE positioning_frameworks (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL,
        name TEXT NOT NULL, description TEXT, scope TEXT, version_id TEXT NOT NULL,
        version_note TEXT, active INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE positioning_levels (id TEXT PRIMARY KEY, framework_id TEXT NOT NULL,
        subject_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, observable_criteria TEXT,
        order_index INTEGER NOT NULL, version_id TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE positioning_level_competencies (level_id TEXT NOT NULL, competency_id TEXT NOT NULL,
        PRIMARY KEY(level_id, competency_id));
      CREATE TABLE positioning_level_prerequisites (level_id TEXT NOT NULL, prerequisite_level_id TEXT NOT NULL,
        PRIMARY KEY(level_id, prerequisite_level_id));
      CREATE TABLE assessment_cycles (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL, name TEXT NOT NULL,
        framework_id TEXT, start_date TEXT, end_date TEXT, type TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE assessment_events (id TEXT PRIMARY KEY, student_id TEXT NOT NULL,
        subject_id TEXT NOT NULL, framework_id TEXT, framework_version_id TEXT NOT NULL,
        cycle_id TEXT, type TEXT NOT NULL, date TEXT NOT NULL, level_id TEXT, score TEXT,
        max_score TEXT, rubric TEXT, competency_ids TEXT, note TEXT, source TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    `);
    db.prepare('INSERT INTO private_vault (id,salt,iv,auth_tag,encrypted_json,revision) VALUES (1,?,?,?,?,?)')
      .run(salt, iv, cipher.getAuthTag(), encrypted, 7);
    db.prepare('INSERT INTO app_meta VALUES (?,?)').run('schema_version', '1');
    const canary = 'SYNTHETIC_LEGACY_PLAINTEXT_CANARY';
    db.prepare('INSERT INTO competency_audit_log VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
      'CL-1', 'SyntheticTeacher', '2026-11-20', 'SYNTHETIC-1', 'fr', 'C-FR-1',
      'notAssessed', 'guided', canary, canary, 'fixture', 'v1');
    db.prepare('INSERT INTO framework_audit_log VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'FL-1', 'SyntheticTeacher', '2026-11-20', 'level', 'L-FR-1', 'Synthetic',
      'create', null, JSON.stringify({ description: canary }), canary, 'v1');
    db.prepare('INSERT INTO assessment_audit_log VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'AL-1', 'SyntheticTeacher', '2026-11-20', 'SYNTHETIC-1', 'fr', 'A-PRE-LEGACY',
      'create', null, JSON.stringify({ note: canary }), canary, 'v1');
    db.prepare('INSERT INTO positioning_frameworks VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'FW-1', 'fr', 'Synthetic', canary, 'class', 'v1', 'fixture', 1, 0, '2026-11-20', '2026-11-20');
    db.prepare('INSERT INTO positioning_levels VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'L-FR-1', 'FW-1', 'fr', 'Synthetic', canary, canary, 1, 'v1', 0, '2026-11-20', '2026-11-20');
    db.prepare('INSERT INTO positioning_level_competencies VALUES (?,?)').run('L-FR-1', 'C-FR-1');
    db.prepare('INSERT INTO positioning_level_prerequisites VALUES (?,?)').run('L-FR-1', 'LEGACY-PREREQUISITE');
    db.prepare('INSERT INTO assessment_cycles VALUES (?,?,?,?,?,?,?,?)').run(
      'CYCLE-1', 'fr', 'Synthetic cycle', 'FW-1', '2026-11-20', null, 'pre', '2026-11-20');
    db.prepare('INSERT INTO assessment_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      'AE-1', 'SYNTHETIC-1', 'fr', 'FW-1', 'v1', 'CYCLE-1', 'pre', '2026-11-20',
      'L-FR-1', '0', '', '', '[]', canary, 'fixture', 0, '2026-11-20', '2026-11-20');
    const freeCanary = 'SYNTHETIC_FREED_PAGE_CANARY';
    db.prepare('INSERT INTO assessment_audit_log VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'DELETED', 'SyntheticTeacher', '2026-11-20', 'SYNTHETIC-1', 'fr', 'DELETED',
      'create', null, freeCanary.repeat(512), null, 'v1');
    db.prepare('DELETE FROM assessment_audit_log WHERE id=?').run('DELETED');
    if (extra.schemaVersion !== undefined) {
      db.prepare('UPDATE app_meta SET value=? WHERE key=?').run(String(extra.schemaVersion), 'schema_version');
    }
    if (extra.sql) db.exec(extra.sql);
    return { canary, freeCanary };
  } finally { key.fill(0); db.close(); }
}

test('construction/status does not create a vault; ciphertext survives restart and wrong password', t => {
  const env = isolated(t), pass = password(), store = env.store();
  assert.deepEqual(store.status(), { exists: false });
  assert.equal(fs.existsSync(env.file('workspace.sqlite')), false);
  const saved = populated(store, pass);
  const history = store.history();
  assert.ok(history.audit.length > 0);
  const exposed = store.snapshot();
  exposed.data.students[0].name = 'SYNTHETIC_MUTATION';
  assert.deepEqual(store.snapshot(), saved, 'Snapshots must not alias authoritative session state');
  const exposedHistory = store.history();
  exposedHistory.audit.length = 0;
  assert.deepEqual(store.history(), history, 'Audit snapshots must not alias retained history');
  store.close();
  const reopened = env.store();
  assert.throws(() => reopened.unlock(password()));
  assert.throws(() => reopened.snapshot());
  const initial = reopened.unlock(pass);
  assert.deepEqual(initial.data, saved.data);
  assert.equal(initial.revision, saved.revision);
  assert.deepEqual(reopened.history(), history);
  assertCiphertextOnly(env.file('workspace.sqlite'), [saved.data.students[0].name,
    saved.data.students[0].massar, saved.data.assessments[0].note, saved.data.observations[0].text]);
});

test('an interrupted first-run setup resumes and older encryption readers fail closed', t => {
  for (const mode of ['empty', 'sample']) {
    const env = isolated(t), pass = password(), store = env.store();
    store.create(pass, {...options(), mode});
    store.close();
    const resumed = env.store();
    const opened = resumed.unlock(pass);
    assert.equal(opened.mode, mode);
    assert.deepEqual(opened.data.students, []);
    assert.deepEqual(opened.data.assessments, []);
    readDatabase(env.file('workspace.sqlite'), connection => {
      const record = connection.prepare('SELECT * FROM private_vault WHERE id=1').get();
      const key = scryptSync(pass, record.salt, 32, {N:32768,r:8,p:1,maxmem:64*1024*1024});
      try {
        const oldReader = createDecipheriv('aes-256-gcm', key, record.iv);
        oldReader.setAuthTag(record.auth_tag);
        assert.throws(() => Buffer.concat([oldReader.update(record.encrypted_json), oldReader.final()]));
      } finally { key.fill(0); }
    });
  }
});

test('a committed assessment and competency change retain zero and gain encrypted backend audit', t => {
  const env = isolated(t), pass = password(), store = env.store();
  const before = populated(store, pass), oldHistory = store.history();
  const next = structuredClone(before.data);
  next.assessments.push({ id: 'A-POST', studentId: 'SYNTHETIC-1', subject: 'fr', type: 'post',
    date: '2026-11-21', levelId: 'L-FR-1', score: 0, note: 'SYNTHETIC_NEW_EVIDENCE_CANARY' });
  next.results['SYNTHETIC-1'].fr['C-FR-1'] = 'mastered';
  const result = store.save(next, before.revision);
  assert.ok(result.revision > before.revision);
  assert.equal(String(store.snapshot().data.assessments.at(-1).score), '0');
  assert.deepEqual(store.snapshot().data.assessments[0], before.data.assessments[0]);
  assert.ok(store.history().audit.length > oldHistory.audit.length);
  assert.ok(JSON.stringify(store.history()).includes('SYNTHETIC_NEW_EVIDENCE_CANARY'));
  store.close();
  const reopened = env.store();
  assert.equal(reopened.unlock(pass).data.results['SYNTHETIC-1'].fr['C-FR-1'], 'mastered');
  assertCiphertextOnly(env.file('workspace.sqlite'), ['SYNTHETIC_NEW_EVIDENCE_CANARY']);
});

test('first completed sample save is not regenerated on renderer reload', t => {
  const env = isolated(t), pass = password(), store = env.store();
  const initial = store.create(pass, {...options(), mode: 'sample'});
  assert.equal(initial.mode, 'sample');
  const data = fictionalData('COMPLETED-SETUP');
  store.save(data, initial.revision);
  assert.equal(store.snapshot().mode, 'existing');
  assert.deepEqual(store.snapshot().data, data);
});

test('failed commit preserves both official state and audit after reopening', t => {
  const env = isolated(t), pass = password();
  let fail = false;
  const store = env.store('workspace.sqlite', { fault(point) {
    if (fail && point === 'beforeCommit') throw new Error('Synthetic commit failure');
  } });
  const before = populated(store, pass), history = store.history();
  const next = structuredClone(before.data);
  next.results['SYNTHETIC-1'].fr['C-FR-1'] = 'consolidated';
  next.observations.push({ id: 'O-FAILED', studentId: 'SYNTHETIC-1', subject: 'fr',
    date: '2026-11-21', text: 'SYNTHETIC_FAILED_SAVE_CANARY' });
  fail = true;
  assert.throws(() => store.save(next, before.revision));
  assert.deepEqual(store.snapshot(), before);
  assert.deepEqual(store.history(), history);
  store.close();
  const reopened = env.store();
  assert.deepEqual(reopened.unlock(pass).data, before.data);
  assert.deepEqual(reopened.history(), history);
});

test('stale revision cannot overwrite another session and validation leaves saved state intact', t => {
  const env = isolated(t), pass = password(), first = env.store();
  const before = populated(first, pass), second = env.store();
  second.unlock(pass);
  const next = structuredClone(before.data);
  next.students[0].name = 'SYNTHETIC_NEWER_SESSION';
  first.save(next, before.revision);
  assert.throws(() => second.save(before.data, before.revision));
  assert.deepEqual(second.snapshot().data, before.data);
  const current = first.snapshot();
  for (const invalid of [
    { ...current.data, students: [null] },
    { ...current.data, activeSubjects: ['unknown-subject'] },
    { ...current.data, assessments: [...current.data.assessments, {
      id: 'A-UNKNOWN-STUDENT', studentId: 'missing-student', subject: 'fr',
      type: 'pre', date: '2026-11-20', score: 0 }] }
  ]) assert.throws(() => first.save(invalid, current.revision));
  assert.deepEqual(first.snapshot(), current);
  const copy = env.store();
  assert.equal(copy.unlock(pass).data.students[0].name, 'SYNTHETIC_NEWER_SESSION');
});

test('existing dated evidence is append-only and inactive subjects retain history', t => {
  const env = isolated(t), pass = password(), store = env.store();
  const before = populated(store, pass), history = store.history();
  const altered = structuredClone(before.data);
  altered.assessments[0].score = 9;
  assert.throws(() => store.save(altered, before.revision));
  const removed = structuredClone(before.data);
  removed.assessments = [];
  assert.throws(() => store.save(removed, before.revision));
  const noteAltered = structuredClone(before.data);
  noteAltered.observations[0].text = 'SYNTHETIC_REWRITTEN_NOTE';
  assert.throws(() => store.save(noteAltered, before.revision));
  assert.deepEqual(store.snapshot(), before);
  assert.deepEqual(store.history(), history);
  const disabled = structuredClone(before.data);
  disabled.activeSubjects = ['math'];
  store.save(disabled, before.revision);
  assert.deepEqual(store.snapshot().data.assessments, before.data.assessments);
  assert.deepEqual(store.snapshot().data.observations, before.data.observations);
});

test('legacy migration preserves every populated table and removes current-file/free-page plaintext', t => {
  const env = isolated(t), pass = password(), source = env.file('workspace.sqlite');
  const data = fictionalData('LEGACY');
  const { canary, freeCanary } = legacyFixture(source, pass, data);
  assert.ok(fs.readFileSync(source).includes(Buffer.from(canary)));
  assert.ok(fs.readFileSync(source).includes(Buffer.from(freeCanary)), 'Fixture must contain stale plaintext pages');
  const store = env.store();
  const opened = store.unlock(pass);
  assert.equal(opened.migrated, true);
  assert.deepEqual(opened.data, data);
  assert.equal(String(opened.data.assessments[0].score), '0');
  const archive = store.history().legacyTables;
  for (const table of ['competency_audit_log', 'framework_audit_log', 'assessment_audit_log',
    'positioning_frameworks', 'positioning_levels', 'positioning_level_competencies',
    'positioning_level_prerequisites', 'assessment_cycles', 'assessment_events']) {
    assert.equal(archive[table].length, 1, `Preserve legacy ${table} row count`);
  }
  assert.ok(JSON.stringify(archive).includes(canary));
  assert.equal(archive.assessment_events[0].score, '0');
  assert.equal(opened.revision >= 7, true);
  store.close();
  const canaries = [canary, freeCanary, data.students[0].name, data.assessments[0].note];
  for (const file of fileList(env.dir)) {
    const contents = fs.readFileSync(file);
    for (const value of canaries) assert.equal(contents.includes(Buffer.from(value)), false,
      'Migration must not leave a raw plaintext recovery/stage/WAL copy');
  }
  assertCiphertextOnly(source, canaries);
  const reopened = env.store();
  assert.equal(reopened.unlock(pass).migrated, false);
  assert.deepEqual(reopened.history().legacyTables, archive);
});

test('legacy migration fails without replacing or mutating source when password/schema/data are invalid', async t => {
  for (const variant of ['wrong-password', 'future-schema', 'unknown-table', 'trigger', 'invalid-data']) {
    await t.test(variant, sub => {
      const env = isolated(sub), pass = password(), source = env.file('workspace.sqlite');
      const data = fictionalData('LEGACY');
      if (variant === 'invalid-data') data.students = [null];
      const extra = variant === 'future-schema' ? { schemaVersion: STORAGE_VERSION + 1 }
        : variant === 'unknown-table' ? { sql: 'CREATE TABLE unrecognized_data (value TEXT)' }
        : variant === 'trigger' ? { sql: 'CREATE TRIGGER untrusted_trigger AFTER UPDATE ON private_vault BEGIN SELECT 1; END' }
        : {};
      legacyFixture(source, pass, data, extra);
      const bytes = fs.readFileSync(source), store = env.store();
      assert.throws(() => store.unlock(variant === 'wrong-password' ? password() : pass));
      assert.deepEqual(fs.readFileSync(source), bytes);
      assert.throws(() => store.snapshot());
    });
  }
});

test('tampered ciphertext and future secure-format metadata are rejected without overwriting source', async t => {
  for (const variant of ['ciphertext', 'tag', 'schema_version', 'storage_version']) {
    await t.test(variant, sub => {
      const env = isolated(sub), pass = password(), original = env.store();
      populated(original, pass);
      original.close();
      changeDatabase(env.file('workspace.sqlite'), db => {
        if (variant.endsWith('_version')) {
          db.prepare('INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)')
            .run(variant, String(STORAGE_VERSION + 1));
        } else {
          const field = variant === 'tag' ? 'auth_tag' : 'encrypted_json';
          const bytes = Buffer.from(db.prepare(`SELECT ${field} AS value FROM private_vault WHERE id=1`).get().value);
          bytes[0] ^= 1;
          db.prepare(`UPDATE private_vault SET ${field}=? WHERE id=1`).run(bytes);
        }
      });
      const before = fs.readFileSync(env.file('workspace.sqlite')), reopened = env.store();
      assert.throws(() => reopened.unlock(pass));
      assert.deepEqual(fs.readFileSync(env.file('workspace.sqlite')), before);
      assert.throws(() => reopened.snapshot());
    });
  }
});

test('encrypted backup restores with its own password, retains history and leaves encrypted recovery', t => {
  const env = isolated(t), localPass = password(), donorPass = password();
  const local = env.store(), donor = env.store('donor.sqlite');
  const localBefore = populated(local, localPass, 'LOCAL');
  const donorBefore = populated(donor, donorPass, 'DONOR');
  const donorHistory = donor.history(), backup = env.file('reviewed-backup.sqlite');
  donor.backup(backup);
  const backupBytes = fs.readFileSync(backup), localBytes = fs.readFileSync(env.file('workspace.sqlite'));
  assertCiphertextOnly(backup, [donorBefore.data.students[0].name,
    donorBefore.data.assessments[0].note, donorBefore.data.observations[0].text]);
  assert.throws(() => local.restore(backup, password()));
  assert.deepEqual(local.snapshot(), localBefore);
  assert.deepEqual(fs.readFileSync(env.file('workspace.sqlite')), localBytes);
  const result = local.restore(backup, donorPass);
  assert.equal(result.requiresLogin, true);
  assert.throws(() => local.snapshot());
  assert.throws(() => local.unlock(localPass));
  const restored = local.unlock(donorPass);
  assert.deepEqual(restored.data, donorBefore.data);
  assert.ok(local.history().audit.length >= donorHistory.audit.length);
  assert.deepEqual(fs.readFileSync(backup), backupBytes, 'Restore never modifies the source backup');
  let foundRecovery = false;
  for (const file of fileList(env.dir).filter(file => ![env.file('workspace.sqlite'), env.file('donor.sqlite'), backup].includes(file))) {
    if (!fs.readFileSync(file).subarray(0, 16).equals(Buffer.from('SQLite format 3\0'))) continue;
    const recovery = env.store(path.relative(env.dir, file));
    try { if (recovery.unlock(localPass).data.students[0].name === localBefore.data.students[0].name) foundRecovery = true; }
    catch { /* Other files may belong to a different encrypted snapshot. */ }
    finally { recovery.close(); }
  }
  assert.equal(foundRecovery, true, 'An authenticated encrypted pre-restore recovery must remain available');
});

test('corrupt and incompatible backups never change the unlocked live workspace', async t => {
  for (const variant of ['not-sqlite', 'no-vault', 'invalid-shape', 'unknown-table', 'future-version']) {
    await t.test(variant, sub => {
      const env = isolated(sub), pass = password(), local = env.store();
      const before = populated(local, pass), history = local.history();
      const candidate = env.file('invalid-backup.sqlite');
      if (variant === 'not-sqlite') fs.writeFileSync(candidate, 'Synthetic invalid SQLite bytes');
      else if (variant === 'no-vault') changeDatabase(candidate, db => db.exec('CREATE TABLE unrelated (id TEXT)'));
      else {
        const data = fictionalData('BAD-BACKUP');
        if (variant === 'invalid-shape') data.students = [null];
        legacyFixture(candidate, pass, data, variant === 'future-version'
          ? { schemaVersion: STORAGE_VERSION + 1 }
          : variant === 'unknown-table' ? { sql: 'CREATE TABLE unrecognized_data (value TEXT)' } : {});
      }
      const bytes = fs.readFileSync(env.file('workspace.sqlite'));
      assert.throws(() => local.restore(candidate, pass));
      assert.deepEqual(local.snapshot(), before);
      assert.deepEqual(local.history(), history);
      assert.deepEqual(fs.readFileSync(env.file('workspace.sqlite')), bytes);
    });
  }
});

test('backup/restore cannot select the working database as their target/source', t => {
  const env = isolated(t), pass = password(), store = env.store();
  const before = populated(store, pass), history = store.history();
  const filename = env.file('workspace.sqlite'), bytes = fs.readFileSync(filename);
  assert.throws(() => store.backup(filename));
  assert.throws(() => store.restore(filename, pass));
  assert.deepEqual(store.snapshot(), before);
  assert.deepEqual(store.history(), history);
  assert.deepEqual(fs.readFileSync(filename), bytes);
});

test('restoring a legitimate legacy backup preserves archived rows with the backup password', t => {
  const env = isolated(t), localPass = password(), backupPass = password(), local = env.store();
  populated(local, localPass, 'LOCAL');
  const data = fictionalData('LEGACY'), candidate = env.file('legacy-backup.sqlite');
  const { canary, freeCanary } = legacyFixture(candidate, backupPass, data);
  const sourceBytes = fs.readFileSync(candidate);
  assert.equal(local.restore(candidate, backupPass).requiresLogin, true);
  assert.throws(() => local.snapshot());
  assert.deepEqual(local.unlock(backupPass).data, data);
  const archive = local.history().legacyTables;
  assert.equal(archive.assessment_events[0].score, '0');
  assert.equal(archive.competency_audit_log.length, 1);
  assert.equal(archive.positioning_levels.length, 1);
  assert.ok(JSON.stringify(archive).includes(canary));
  assert.deepEqual(fs.readFileSync(candidate), sourceBytes, 'Legacy backup is never rewritten in place');
  assertCiphertextOnly(env.file('workspace.sqlite'), [canary, freeCanary, data.students[0].name]);
});

test('legacy migration faults preserve data and all archived table rows for a safe retry', async t => {
  for (const failurePoint of ['afterStage', 'afterReplace']) {
    await t.test(failurePoint, sub => {
      const env = isolated(sub), pass = password(), data = fictionalData('LEGACY');
      const source = env.file('workspace.sqlite');
      const { canary } = legacyFixture(source, pass, data);
      const bytes = fs.readFileSync(source);
      let armed = true, hit = false;
      const store = env.store('workspace.sqlite', { fault(point) {
        if (armed && point === failurePoint) { hit = true; throw new Error('Synthetic migration failure'); }
      } });
      assert.throws(() => store.unlock(pass));
      assert.equal(hit, true);
      assert.throws(() => store.snapshot());
      if (failurePoint === 'afterStage') assert.deepEqual(fs.readFileSync(source), bytes);
      armed = false;
      const retried = store.unlock(pass);
      assert.deepEqual(retried.data, data);
      assert.equal(retried.revision, 7);
      const history = store.history();
      for (const table of ['competency_audit_log', 'framework_audit_log', 'assessment_audit_log',
        'positioning_frameworks', 'positioning_levels', 'positioning_level_competencies',
        'positioning_level_prerequisites', 'assessment_cycles', 'assessment_events']) {
        assert.equal(history.legacyTables[table].length, 1);
      }
      assert.ok(JSON.stringify(history).includes(canary));
      assertCiphertextOnly(source, [canary, data.students[0].name]);
    });
  }
});

test('a stale session cannot create a misleading backup or replace a newer committed workspace', t => {
  const env = isolated(t), pass = password(), first = env.store(), stale = env.store();
  const before = populated(first, pass), donorPass = password(), donor = env.store('donor.sqlite');
  stale.unlock(pass);
  populated(donor, donorPass, 'DONOR');
  const candidate = env.file('reviewed-backup.sqlite'); donor.backup(candidate);
  const next = structuredClone(before.data);
  next.students[0].name = 'SYNTHETIC_NEWER_COMMITTED_WORKSPACE';
  first.save(next, before.revision);
  const current = first.snapshot(), bytes = fs.readFileSync(env.file('workspace.sqlite'));
  const staleDestination = env.file('stale-backup.sqlite');
  assert.throws(() => stale.backup(staleDestination));
  assert.equal(fs.existsSync(staleDestination), false);
  assert.throws(() => stale.restore(candidate, donorPass));
  assert.deepEqual(stale.snapshot().data, before.data);
  assert.equal(stale.snapshot().revision, before.revision);
  assert.deepEqual(first.snapshot(), current);
  assert.deepEqual(fs.readFileSync(env.file('workspace.sqlite')), bytes);
});

test('secure backups with unexpected schema columns or metadata cannot be installed', async t => {
  for (const variant of ['extra-column', 'extra-metadata']) {
    await t.test(variant, sub => {
      const env = isolated(sub), pass = password(), local = env.store(), donor = env.store('donor.sqlite');
      const before = populated(local, pass, 'LOCAL'), donorPass = password();
      populated(donor, donorPass, 'DONOR');
      const candidate = env.file('malformed-secure-backup.sqlite'); donor.backup(candidate);
      changeDatabase(candidate, db => {
        if (variant === 'extra-column') {
          db.exec('ALTER TABLE private_vault ADD COLUMN plaintext_note TEXT');
          db.prepare('UPDATE private_vault SET plaintext_note=? WHERE id=1').run('SYNTHETIC_UNEXPECTED_PLAINTEXT');
        } else {
          db.prepare('INSERT INTO app_meta (key,value) VALUES (?,?)').run('unrecognized_metadata', 'SYNTHETIC_UNEXPECTED_METADATA');
        }
      });
      const bytes = fs.readFileSync(env.file('workspace.sqlite'));
      assert.throws(() => local.restore(candidate, donorPass));
      assert.deepEqual(local.snapshot(), before);
      assert.deepEqual(fs.readFileSync(env.file('workspace.sqlite')), bytes);
    });
  }
});

test('legacy WAL evidence is preserved before fresh encrypted replacement without residual sidecar plaintext', t => {
  const env = isolated(t), pass = password(), source = env.file('workspace.sqlite');
  legacyFixture(source, pass);
  // End only this isolated synthetic writer abruptly to emulate a previous
  // crash. No external database handle remains open during Windows replacement.
  const prepared = spawnSync(process.execPath, ['-e', `
    const fs=require('node:fs');
    const {DatabaseSync}=require('node:sqlite');
    const db=new DatabaseSync(process.argv[1]);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
    db.prepare('INSERT INTO assessment_audit_log VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      'WAL-ONLY','SyntheticTeacher','2026-11-20','SYNTHETIC-1','fr','WAL-ONLY',
      'create',null,'SYNTHETIC_WAL_EVIDENCE_CANARY',null,'v1');
    fs.writeSync(1,'prepared');
    process.kill(process.pid,'SIGKILL');
  `, source], { encoding: 'utf8', timeout: 10000 });
  assert.equal(prepared.stdout, 'prepared', 'The synthetic writer must commit before termination');
  assert.ok(fs.existsSync(source + '-wal'));
  assert.ok(fs.readFileSync(source + '-wal').includes(Buffer.from('SYNTHETIC_WAL_EVIDENCE_CANARY')));
  const store = env.store();
  store.unlock(pass);
  const rows = store.history().legacyTables.assessment_audit_log;
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.id === 'WAL-ONLY').new_data, 'SYNTHETIC_WAL_EVIDENCE_CANARY');
  store.close();
  for (const file of fileList(env.dir)) {
    assert.equal(fs.readFileSync(file).includes(Buffer.from('SYNTHETIC_WAL_EVIDENCE_CANARY')), false);
  }
});

test('restore failure injection preserves prior state, history, revision and unlocked session', async t => {
  for (const failurePoint of ['afterStage', 'beforeReplace', 'afterReplace', 'beforeReopen']) {
    await t.test(failurePoint, sub => {
      const env = isolated(sub), pass = password(), donorPass = password();
      let armed = false, hit = false;
      const local = env.store('workspace.sqlite', { fault(point) {
        if (armed && point === failurePoint) { hit = true; throw new Error('Synthetic replacement failure'); }
      } });
      const before = populated(local, pass, 'LOCAL'), history = local.history();
      const donor = env.store('donor.sqlite');
      populated(donor, donorPass, 'DONOR');
      const source = env.file('backup.sqlite'); donor.backup(source);
      const bytes = fs.readFileSync(env.file('workspace.sqlite'));
      armed = true;
      assert.throws(() => local.restore(source, donorPass));
      assert.equal(hit, true, 'Fault seam must exercise the intended replacement phase');
      assert.deepEqual(local.snapshot(), before);
      assert.deepEqual(local.history(), history);
      if (['afterStage', 'beforeReplace'].includes(failurePoint)) {
        assert.deepEqual(fs.readFileSync(env.file('workspace.sqlite')), bytes);
      }
      armed = false;
      local.close();
      const reopened = env.store();
      assert.deepEqual(reopened.unlock(pass).data, before.data);
      assert.equal(reopened.snapshot().revision, before.revision);
      assert.deepEqual(reopened.history(), history);
    });
  }
});
