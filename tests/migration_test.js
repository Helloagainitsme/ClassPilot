const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(__dirname, 'migration_test.sqlite');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new DatabaseSync(dbPath);
const SCHEMA_VERSION = 1;

// Setup tables
db.exec('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
db.exec(`CREATE TABLE IF NOT EXISTS assessment_events (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    framework_id TEXT,
    framework_version_id TEXT NOT NULL,
    cycle_id TEXT,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    level_id TEXT,
    score TEXT,
    max_score TEXT,
    rubric TEXT,
    competency_ids TEXT,
    note TEXT,
    source TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)`);

// Test migration logic
function runMigration(openedData) {
    db.exec('BEGIN IMMEDIATE');
    try {
        if (openedData.assessments) {
            for (const a of openedData.assessments) {
                const score = (a.score === undefined || a.score === null) ? '' : String(a.score);
                db.prepare('INSERT OR IGNORE INTO assessment_events (id,student_id,subject_id,framework_id,framework_version_id,cycle_id,type,date,level_id,score,max_score,rubric,competency_ids,note,source,is_deleted,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
                    a.id || 'id-' + Math.random(), a.studentId, a.subject, null, 'v1', null, 'pre', '2026-11-19', null, score, '', '', '[]', 'note', 'vault-migration', 0, '2026-11-19', '2026-11-19'
                );
            }
        }
        db.prepare('INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)').run('schema_version', String(SCHEMA_VERSION));
        db.exec('COMMIT');
    } catch (e) {
        db.exec('ROLLBACK');
        throw e;
    }
}

// Data with 0 score (should be preserved as '0')
const mockData = {
    assessments: [
        { studentId: 'S1', subject: 'fr', score: 0 },
        { studentId: 'S2', subject: 'math', score: 10 }
    ]
};

runMigration(mockData);

const rows = db.prepare('SELECT score FROM assessment_events').all();
console.log('Results:', rows);

const score0 = rows.find(r => r.score === '0');
if (score0) {
    console.log('✅ Zero score preserved.');
} else {
    throw new Error('❌ Zero score NOT preserved!');
}

db.close();
fs.unlinkSync(dbPath);
console.log('Migration test passed.');
