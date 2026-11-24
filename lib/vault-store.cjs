'use strict';

const {DatabaseSync} = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const {randomBytes, randomUUID, scryptSync, createCipheriv, createDecipheriv} = require('node:crypto');
const {MAX_BYTES, SUBJECTS, clone, validateWorkspace, assertAppendOnly, auditChanges} = require('./workspace.cjs');

const STORAGE_VERSION = 2;
const MAX_FILE_BYTES = 128 * 1024 * 1024;
const AUTHENTICATED_FORMAT = Buffer.from('ClassPilot/vault/2', 'utf8');
const LEGACY_TABLES = [
  'competency_audit_log', 'framework_audit_log', 'assessment_audit_log',
  'positioning_frameworks', 'positioning_levels', 'positioning_level_competencies',
  'positioning_level_prerequisites', 'assessment_cycles', 'assessment_events'
];
const SAFE_ERROR = 'Cannot authenticate or validate this vault. Check its password and backup format.';
function derive(password, salt) {
  if (typeof password !== 'string' || password.length === 0 || password.length > 1024) throw new Error(SAFE_ERROR);
  return scryptSync(password, salt, 32, {N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024});
}
function seal(envelope, key) {
  const content = Buffer.from(JSON.stringify(envelope));
  if (content.length > MAX_BYTES) throw new Error('The encrypted workspace and its history exceed the 18 MB limit. No changes were saved.');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  // Older builds cannot decrypt this format and silently replace it with a blank workspace.
  cipher.setAAD(AUTHENTICATED_FORMAT);
  const encrypted_json = Buffer.concat([cipher.update(content), cipher.final()]);
  return {iv, auth_tag: cipher.getAuthTag(), encrypted_json};
}
function unseal(record, key, legacy = false) {
  const decipher = createDecipheriv('aes-256-gcm', key, record.iv);
  if (!legacy) decipher.setAAD(AUTHENTICATED_FORMAT);
  decipher.setAuthTag(record.auth_tag);
  return JSON.parse(Buffer.concat([decipher.update(record.encrypted_json), decipher.final()]).toString('utf8'));
}
function checkRecord(record) {
  if (!record || record.salt?.length !== 24 || record.iv?.length !== 12 || record.auth_tag?.length !== 16 ||
      !record.encrypted_json?.length || record.encrypted_json.length > MAX_BYTES ||
      !Number.isSafeInteger(record.revision) || record.revision < 1) throw new Error(SAFE_ERROR);
}
function configure(connection) {
  connection.exec('PRAGMA trusted_schema=OFF; PRAGMA busy_timeout=3000;');
}
function inspect(connection) {
  configure(connection);
  if (connection.prepare('PRAGMA quick_check').all().some(item => Object.values(item)[0] !== 'ok')) throw new Error(SAFE_ERROR);
  const objects = connection.prepare("SELECT type,name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%'").all();
  const tables = objects.filter(item => item.type === 'table').map(item => item.name);
  if (objects.some(item => !['table', 'index'].includes(item.type)) ||
      tables.some(name => !['private_vault', 'app_meta', ...LEGACY_TABLES].includes(name)) ||
      !tables.includes('private_vault')) throw new Error(SAFE_ERROR);
  const vaultColumns = connection.prepare('PRAGMA table_info(private_vault)').all().map(column => column.name).sort();
  if (vaultColumns.join(',') !== ['id', 'salt', 'iv', 'auth_tag', 'encrypted_json', 'revision'].sort().join(',')) throw new Error(SAFE_ERROR);
  const meta = tables.includes('app_meta') ? connection.prepare('SELECT key,value FROM app_meta').all() : [];
  for (const item of meta) {
    if (['schema_version', 'storage_version'].includes(item.key) &&
        (!/^\d+$/.test(item.value) || Number(item.value) > STORAGE_VERSION)) {
      throw new Error('This workspace requires a newer version of ClassPilot. No changes were made.');
    }
  }
  const rows = connection.prepare('SELECT id,salt,iv,auth_tag,encrypted_json,revision FROM private_vault').all();
  if (rows.length !== 1 || rows[0].id !== 1) throw new Error(SAFE_ERROR);
  checkRecord(rows[0]);
  return {record: rows[0], tables, meta};
}
function readCandidate(filename, password) {
  if (!path.isAbsolute(filename) || !fs.statSync(filename).isFile() || fs.statSync(filename).size > MAX_FILE_BYTES) throw new Error(SAFE_ERROR);
  let connection, key;
  try {
    connection = new DatabaseSync(filename, {readOnly: true});
    configure(connection);
    connection.exec('BEGIN');
    const inspected = inspect(connection);
    key = derive(password, inspected.record.salt);
    const secureFormat = inspected.meta.some(item => item.key === 'storage_version' && item.value === String(STORAGE_VERSION));
    const decoded = unseal(inspected.record, key, !secureFormat);
    let envelope, migrated = false;
    if (decoded?.format !== undefined) {
      if (decoded.format !== STORAGE_VERSION || !Array.isArray(decoded.audit) || !decoded.legacyTables ||
          typeof decoded.legacyTables !== 'object' || Array.isArray(decoded.legacyTables) ||
          inspected.tables.some(name => LEGACY_TABLES.includes(name))) throw new Error(SAFE_ERROR);
      envelope = {...decoded, data: validateWorkspace(decoded.data)};
      // History is backend-owned. Validate bounded JSON before carrying it through a restore.
      if (Buffer.byteLength(JSON.stringify(envelope)) > MAX_BYTES) throw new Error(SAFE_ERROR);
      if (!inspected.meta.some(item => item.key === 'storage_version' && item.value === String(STORAGE_VERSION))) throw new Error(SAFE_ERROR);
      if (inspected.meta.length !== 2 || inspected.meta.some(item => !['schema_version', 'storage_version'].includes(item.key)) ||
          inspected.meta.some(item => item.value !== String(STORAGE_VERSION))) throw new Error(SAFE_ERROR);
    } else {
      if (inspected.meta.some(item => item.key === 'storage_version' && Number(item.value) >= STORAGE_VERSION)) throw new Error(SAFE_ERROR);
      const legacyTables = {};
      for (const table of LEGACY_TABLES) {
        if (inspected.tables.includes(table)) legacyTables[table] = connection.prepare(`SELECT * FROM ${table}`).all();
      }
      if (inspected.meta.length) legacyTables.app_meta = inspected.meta;
      envelope = {format: STORAGE_VERSION, data: validateWorkspace(decoded), audit: [], legacyTables};
      // Serialize/parse drops SQLite null-prototypes while preserving every row and field.
      envelope = clone(envelope);
      migrated = true;
    }
    if (envelope.data.students.length && (!envelope.data.competencies || !envelope.data.levels)) throw new Error(SAFE_ERROR);
    seal(envelope, key); // Enforce the combined data + history limit before touching any live file.
    return {envelope, key, salt: Buffer.from(inspected.record.salt), revision: inspected.record.revision, migrated};
  } catch (error) {
    key?.fill(0);
    if (error.message.includes('newer version')) throw error;
    throw new Error(SAFE_ERROR);
  } finally {
    if (connection?.isTransaction) connection.exec('ROLLBACK');
    connection?.close();
  }
}
function writeImage(filename, envelope, key, salt, revision) {
  let connection;
  try {
    connection = new DatabaseSync(filename);
    configure(connection);
    connection.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON;
      CREATE TABLE private_vault (id INTEGER PRIMARY KEY CHECK(id=1),salt BLOB NOT NULL,iv BLOB NOT NULL,
      auth_tag BLOB NOT NULL,encrypted_json BLOB NOT NULL,revision INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE app_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
    const encrypted = seal(envelope, key);
    connection.exec('BEGIN IMMEDIATE');
    connection.prepare('INSERT INTO private_vault VALUES(1,?,?,?,?,?)')
      .run(salt, encrypted.iv, encrypted.auth_tag, encrypted.encrypted_json, revision);
    const meta = connection.prepare('INSERT INTO app_meta VALUES(?,?)');
    meta.run('schema_version', String(STORAGE_VERSION));
    meta.run('storage_version', String(STORAGE_VERSION));
    connection.exec('COMMIT');
    // Read what was actually written, authenticate it, and check SQLite before replacement.
    const record = inspect(connection).record;
    if (JSON.stringify(unseal(record, key)) !== JSON.stringify(envelope)) throw new Error(SAFE_ERROR);
  } finally {
    connection?.close();
  }
}
function removeTemporary(filename) {
  // Only private task-generated sibling names are passed here; never follow a renderer path.
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try { fs.unlinkSync(filename + suffix); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

class VaultStore {
  constructor(filename, {fault = () => {}} = {}) {
    if (!path.isAbsolute(filename)) throw new Error('The vault path must be absolute.');
    this.filename = filename;
    this.fault = fault;
    this.connection = null;
    this.session = null;
    this.mode = 'existing';
  }
  status() {
    if (!fs.existsSync(this.filename)) return {exists: false};
    let connection;
    try {
      connection = new DatabaseSync(this.filename, {readOnly: true});
      configure(connection);
      const table = connection.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='private_vault'").get();
      if (!table) throw new Error(SAFE_ERROR);
      return {exists: Boolean(connection.prepare('SELECT id FROM private_vault WHERE id=1').get())};
    } finally { connection?.close(); }
  }
  _open() {
    if (!this.connection) {
      this.connection = new DatabaseSync(this.filename);
      configure(this.connection);
      this.connection.exec('PRAGMA synchronous=FULL; PRAGMA secure_delete=ON;');
    }
    return this.connection;
  }
  _closeConnection() { this.connection?.close(); this.connection = null; }
  _requireSession() { if (!this.session) throw new Error('The private data vault is locked.'); return this.session; }
  _assertCurrent() {
    const session = this._requireSession();
    const current = this._open().prepare('SELECT revision FROM private_vault WHERE id=1').get();
    if (current?.revision !== session.revision) throw new Error('The workspace changed elsewhere. Lock and reopen it before continuing.');
  }
  create(password, {subjects = ['fr', 'math'], lang = 'fr', mode = 'empty'} = {}) {
    if (this.status().exists) throw new Error('A data vault already exists.');
    if (typeof password !== 'string' || password.length < 10) throw new Error('Use a password with at least 10 characters.');
    if (!Array.isArray(subjects) || !subjects.length || new Set(subjects).size !== subjects.length ||
        subjects.some(subject => !SUBJECTS.includes(subject)) || !['fr', 'en', 'ar'].includes(lang) ||
        !['empty', 'sample'].includes(mode)) throw new Error('Invalid workspace setup.');
    const data = validateWorkspace({students: [], assessments: [], activeSubjects: subjects, lang, planLang: lang, firstRunMode: mode});
    const salt = randomBytes(24), key = derive(password, salt);
    const envelope = {format: STORAGE_VERSION, data, audit: [], legacyTables: {}};
    const stage = this.filename + '.stage-' + randomUUID();
    try {
      // An empty legacy shell may exist after old login status checks. Never erase populated tables.
      if (fs.existsSync(this.filename)) {
        const old = new DatabaseSync(this.filename, {readOnly: true});
        try {
          configure(old);
          const tables = old.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
          for (const {name} of tables) {
            if (!['private_vault', 'app_meta', ...LEGACY_TABLES].includes(name) ||
                old.prepare(`SELECT COUNT(*) n FROM ${name}`).get().n !== 0) throw new Error(SAFE_ERROR);
          }
        } finally { old.close(); }
      }
      fs.mkdirSync(path.dirname(this.filename), {recursive: true});
      writeImage(stage, envelope, key, salt, 1);
      fs.renameSync(stage, this.filename);
      this.session = {envelope, key, salt, revision: 1};
      this.mode = mode;
      return this.snapshot();
    } catch (error) { key.fill(0); throw error; }
    finally { removeTemporary(stage); }
  }
  unlock(password) {
    if (this.session) throw new Error('Lock the current workspace before unlocking another one.');
    const candidate = readCandidate(this.filename, password);
    try {
      if (candidate.migrated) this._replace(candidate, null);
      this.session = candidate;
      // Resume a setup interrupted before its first renderer save; never replace nonempty data.
      const starter = !candidate.envelope.data.competencies && !candidate.envelope.data.students.length && !candidate.envelope.data.assessments.length;
      this.mode = starter ? (candidate.envelope.data.firstRunMode === 'sample' ? 'sample' : 'empty') : 'existing';
      return {...this.snapshot(), migrated: candidate.migrated};
    } catch (error) { candidate.key.fill(0); throw error; }
  }
  snapshot() {
    const session = this._requireSession();
    return {data: clone(session.envelope.data), revision: session.revision, mode: this.mode};
  }
  history() {
    const {envelope} = this._requireSession();
    return clone({audit: envelope.audit, legacyTables: envelope.legacyTables});
  }
  save(value, expectedRevision) {
    const session = this._requireSession();
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== session.revision) {
      throw new Error('The workspace changed elsewhere. Lock and reopen it before saving.');
    }
    const data = validateWorkspace(value);
    assertAppendOnly(session.envelope.data, data);
    const changes = auditChanges(session.envelope.data, data);
    const envelope = {...session.envelope, data, audit: [...session.envelope.audit, ...changes]};
    const encrypted = seal(envelope, session.key);
    const connection = this._open();
    connection.exec('BEGIN IMMEDIATE');
    try {
      const result = connection.prepare(`UPDATE private_vault SET iv=?,auth_tag=?,encrypted_json=?,revision=revision+1
        WHERE id=1 AND revision=?`).run(encrypted.iv, encrypted.auth_tag, encrypted.encrypted_json, expectedRevision);
      if (result.changes !== 1) throw new Error('The workspace changed elsewhere. Lock and reopen it before saving.');
      this.fault('beforeCommit');
      connection.exec('COMMIT');
    } catch (error) { connection.exec('ROLLBACK'); throw error; }
    this.session = {...session, envelope, revision: session.revision + 1};
    if (data.competencies) this.mode = 'existing';
    return {revision: this.session.revision};
  }
  backup(destination) {
    const session = this._requireSession();
    this._assertCurrent();
    if (!path.isAbsolute(destination) || path.resolve(destination).toLowerCase() === path.resolve(this.filename).toLowerCase()) {
      throw new Error('Choose a backup destination separate from the working vault.');
    }
    const stage = destination + '.stage-' + randomUUID();
    try {
      writeImage(stage, session.envelope, session.key, session.salt, session.revision);
      fs.renameSync(stage, destination);
      return {path: destination};
    } finally { removeTemporary(stage); }
  }
  _replace(candidate, current) {
    const stage = this.filename + '.stage-' + randomUUID();
    const recovery = this.filename + '.recovery-' + randomUUID() + '.sqlite';
    let replaced = false;
    const preserved = current || candidate;
    try {
      // Recovery is built from decrypted/validated records, never copied from legacy plaintext bytes.
      writeImage(recovery, preserved.envelope, preserved.key, preserved.salt, preserved.revision);
      writeImage(stage, candidate.envelope, candidate.key, candidate.salt, candidate.revision);
      this.fault('afterStage');
      this.fault('beforeReplace');
      this._closeConnection();
      // Never replay a legacy database's WAL against its freshly encrypted replacement.
      if (fs.existsSync(this.filename + '-wal') || fs.existsSync(this.filename + '-journal')) {
        const old = new DatabaseSync(this.filename);
        try {
          configure(old);
          const checkpoint = old.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
          if (checkpoint && Object.values(checkpoint)[0] !== 0) throw new Error('The workspace is in use. Close other instances and retry.');
        } finally { old.close(); }
      }
      fs.renameSync(stage, this.filename);
      replaced = true;
      this.fault('afterReplace');
      this.fault('beforeReopen');
      const connection = this._open();
      const actual = inspect(connection).record;
      if (JSON.stringify(unseal(actual, candidate.key)) !== JSON.stringify(candidate.envelope)) throw new Error(SAFE_ERROR);
    } catch (error) {
      this._closeConnection();
      if (replaced) {
        // The original encrypted recovery remains available even if a second OS failure prevents rollback.
        const rollback = this.filename + '.stage-' + randomUUID();
        try {
          writeImage(rollback, preserved.envelope, preserved.key, preserved.salt, preserved.revision);
          fs.renameSync(rollback, this.filename);
        } catch {
          throw new Error('Recovery is required. Keep the encrypted recovery file beside the vault and restart ClassPilot.');
        } finally { removeTemporary(rollback); }
      }
      throw error;
    } finally { removeTemporary(stage); }
    return recovery;
  }
  restore(source, password) {
    const current = this._requireSession();
    this._assertCurrent();
    if (path.resolve(source).toLowerCase() === path.resolve(this.filename).toLowerCase()) {
      throw new Error('Choose a backup file separate from the working vault.');
    }
    const candidate = readCandidate(source, password);
    try {
      this._replace(candidate, current);
      this.lock();
      return {requiresLogin: true};
    } finally { candidate.key.fill(0); }
  }
  lock() {
    this._closeConnection();
    this.session?.key.fill(0);
    this.session = null;
  }
  close() { this.lock(); }
}

module.exports = {VaultStore, STORAGE_VERSION, MAX_BYTES};
