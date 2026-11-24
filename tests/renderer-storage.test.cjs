'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');

// These probes execute the production renderer with a minimal DOM/IPC double.
// They cover its storage boundary; they do not claim live Electron or visual QA.
const rendererSource = fs.readFileSync(path.join(__dirname, '../app/index.js'), 'utf8');
const exportForProbe = `
globalThis.rendererProbe = {
  data: () => structuredClone(db), ui: () => structuredClone(ui),
  revision: () => savedRevision, submitForm, restoreBackup, handleAction,
  renderModal, setSaved
};
`;
const sourceForProbe = rendererSource.replace(/\}\)\(\);\s*$/, exportForProbe + '})();');
assert.notEqual(sourceForProbe, rendererSource, 'Production renderer closure must be found');

function fictionalWorkspace() {
  return {
    lang: 'en', planLang: 'en', activeSubjects: ['fr', 'math'],
    students: [{id: 'STU-001', pseudo: 'synthetic-reference', name: 'Fictional learner',
      group: 'Groupe 1', grade: '2', added: '2026-11-01'}],
    competencies: {
      fr: [{id: 'C-FR', name: 'Synthetic reading', description: '', active: true, archived: false, order: 1}],
      math: [{id: 'C-MATH', name: 'Synthetic counting', description: '', active: true, archived: false, order: 1}]
    },
    levels: {
      fr: [{id: 'L-FR', name: 'Synthetic first level', description: '', order: 1, archived: false}],
      math: [{id: 'L-MATH', name: 'Synthetic first level', description: '', order: 1, archived: false}]
    },
    assessments: [{id: 'PRE-1', studentId: 'STU-001', subject: 'fr', type: 'pre',
      date: '2026-11-01', levelId: 'L-FR', score: '0', note: 'SYNTHETIC_BASELINE_NOTE'}],
    observations: [], results: {'STU-001': {fr: {'C-FR': 'notAssessed'}, math: {}}},
    groups: [], plans: [], weeklySessions: {fr: 1, math: 1}
  };
}

function harness(options = {}) {
  const state = {failSave: Boolean(options.failSave), saveCalls: [], restoreCalls: [],
    renderCount: 0, toasts: [], controls: new Map(), events: new Map(), revision: 7};
  const root = {textContent: ''};
  let rootHtml = '';
  Object.defineProperty(root, 'innerHTML', {
    get: () => rootHtml,
    set: value => { rootHtml = value; state.renderCount++; }
  });
  const document = {
    documentElement: {},
    getElementById: id => id === 'app' ? root : state.controls.get('#' + id) || null,
    querySelector(selector) {
      if (selector === '#app') return root;
      if (selector === '.toast') return null;
      return state.controls.get(selector) || null;
    },
    querySelectorAll: () => [],
    createElement() {
      return {className: '', textContent: '', setAttribute() {}, remove() {}};
    },
    body: {classList: {toggle() {}}, appendChild: element => state.toasts.push(element.textContent)},
    addEventListener: (name, fn) => state.events.set(name, fn)
  };
  const bridge = {
    initial: () => ({ok: true, mode: options.mode || 'existing', revision: state.revision,
      data: structuredClone(options.data || fictionalWorkspace())}),
    save(data, revision) {
      state.saveCalls.push({data: structuredClone(data), revision});
      if (state.failSave) return {ok: false, error: 'Synthetic storage failure'};
      return {ok: true, revision: ++state.revision};
    },
    restore(password) {
      state.restoreCalls.push(password);
      if (options.onRestore) return options.onRestore(password);
      return Promise.resolve({ok: false, canceled: true});
    },
    lock() {}, backup: async () => ({ok: true})
  };
  class SyntheticFormData {
    constructor(form) { this.values = form.values; }
    entries() { return Object.entries(this.values); }
  }
  const context = {
    window: {classPilotDesktop: bridge, scrollTo() {}, print() {}}, document,
    crypto: webcrypto, structuredClone, FormData: SyntheticFormData,
    setTimeout: () => 0, clearTimeout() {}, confirm: () => true, console,
    URL, Blob
  };
  vm.runInNewContext(sourceForProbe, context, {filename: 'app/index.js'});
  return {state, root, api: context.rendererProbe};
}

function form(name, values) { return {dataset: {form: name}, values}; }

test('restore instructions retain French accents and Arabic text', () => {
  for (const [lang, title] of [['fr','Restaurer une sauvegarde chiffrée'],['ar','استرجاع نسخة احتياطية مشفرة']]) {
    const data=fictionalWorkspace();data.lang=lang;
    const h=harness({data});h.api.handleAction('restore-vault');
    assert.ok(h.api.renderModal().includes(title));
  }
});

test('failed profile save preserves typed form, restores committed state and retries same revision', () => {
  const h = harness({failSave: true});
  h.api.handleAction('student-edit:STU-001');
  const renderCount = h.state.renderCount;
  const edit = form('student-edit', {name: 'Fictional edited learner', group: 'Groupe 2', massar: ''});
  h.api.submitForm(edit);
  assert.equal(h.api.data().students[0].name, 'Fictional learner');
  assert.equal(edit.values.name, 'Fictional edited learner');
  assert.equal(h.api.ui().modal, 'student-edit');
  assert.equal(h.state.renderCount, renderCount, 'Failed save must not rebuild and clear the form');
  assert.equal(h.api.revision(), 7);
  assert.equal(h.state.saveCalls[0].revision, 7);
  assert.match(h.state.toasts.at(-1), /Saving failed/);
  assert(!h.state.toasts.includes('Student profile updated'));
  h.state.failSave = false;
  h.api.submitForm(edit);
  assert.equal(h.state.saveCalls[1].revision, 7);
  assert.equal(h.api.revision(), 8);
  assert.equal(h.api.data().students[0].name, 'Fictional edited learner');
  assert.equal(h.api.ui().modal, null);
  assert.equal(h.state.toasts.at(-1), 'Student profile updated');
});

test('assessment retry sends one state mutation without renderer audit IPC and preserves zero', () => {
  const h = harness({failSave: true});
  h.api.handleAction('open:assessment');
  const entry = form('assessment', {studentId: 'STU-001', subject: 'fr', type: 'post',
    date: '2026-11-02', levelId: 'L-FR', score: '0', note: 'SYNTHETIC_POST_NOTE'});
  h.api.submitForm(entry);
  assert.equal(h.api.data().assessments.length, 1);
  assert.equal(h.api.ui().modal, 'assessment');
  assert.equal(entry.values.note, 'SYNTHETIC_POST_NOTE');
  h.state.failSave = false;
  h.api.submitForm(entry);
  const saved = h.api.data();
  assert.equal(saved.assessments.length, 2);
  assert.equal(saved.assessments[0].id, 'PRE-1');
  assert.equal(saved.assessments[1].score, '0');
  assert.equal(saved.assessments[1].note, 'SYNTHETIC_POST_NOTE');
  assert.equal(h.state.saveCalls.length, 2, 'One save per attempt; no separate audit bridge exists');
});

test('failed bulk save retains grid inputs and does not duplicate failed entries on retry', () => {
  const h = harness({failSave: true});
  h.state.controls.set('#bulkDate', {value: '2026-11-03'});
  const level = {value: 'L-FR'}, score = {value: '0'}, note = {value: 'SYNTHETIC_BULK_NOTE'};
  h.state.controls.set('[data-bulk-level="STU-001"]', level);
  h.state.controls.set('[data-bulk-score="STU-001"]', score);
  h.state.controls.set('[data-bulk-note="STU-001"]', note);
  const renderCount = h.state.renderCount;
  h.api.handleAction('bulk-save');
  assert.equal(h.api.data().assessments.length, 1);
  assert.equal(h.state.renderCount, renderCount);
  assert.equal(note.value, 'SYNTHETIC_BULK_NOTE');
  h.state.failSave = false;
  h.api.handleAction('bulk-save');
  assert.equal(h.api.data().assessments.length, 2);
  assert.equal(h.api.data().assessments[1].score, '0');
  assert.equal(h.state.saveCalls.length, 2);
});

test('student archive and restore use one revisioned save each', () => {
  const h = harness();
  h.api.handleAction('archive-student:STU-001');
  assert.equal(h.api.data().students[0].archived, true);
  assert.equal(h.api.data().students[0].archivedBy, 'Teacher');
  assert.equal(h.state.saveCalls.length, 1);
  assert.equal(h.state.saveCalls[0].revision, 7);
  h.api.handleAction('restore-student:STU-001');
  assert.equal(h.api.data().students[0].archived, undefined);
  assert.equal(h.state.saveCalls.length, 2);
  assert.equal(h.state.saveCalls[1].revision, 8);
});

function restoreForm(password) {
  const input = {value: password, focused: false, focus() { this.focused = true; }};
  const submit = {disabled: false, textContent: ''}, cancel = {disabled: false};
  const element = {
    dataset: {form: 'restore-vault'}, isConnected: true,
    elements: {namedItem: () => input},
    querySelector: () => submit,
    closest: () => ({querySelectorAll: () => [submit, cancel]})
  };
  return {element, input, submit, cancel};
}

test('restore clears password before IPC, blocks duplicate requests and preserves workspace on cancellation', async () => {
  let resolveRestore;
  const pending = new Promise(resolve => { resolveRestore = resolve; });
  const f = restoreForm('synthetic-backup-only-secret');
  const h = harness({onRestore(password) {
    assert.equal(f.input.value, '', 'Password field cleared before opening native picker');
    assert.equal(password, 'synthetic-backup-only-secret');
    return pending;
  }});
  const before = h.api.data();
  h.api.handleAction('restore-vault');
  const restoring = h.api.restoreBackup(f.element);
  assert.equal(f.submit.disabled, true);
  await h.api.restoreBackup(f.element);
  assert.equal(h.state.restoreCalls.length, 1);
  assert(!JSON.stringify(h.api.data()).includes('synthetic-backup-only-secret'));
  resolveRestore({ok: false, canceled: true});
  await restoring;
  assert.deepEqual(h.api.data(), before);
  assert.equal(h.api.revision(), 7);
  assert.equal(h.api.ui().modal, 'restore-vault');
  assert.equal(f.input.value, '');
  assert.equal(f.input.focused, true);
  assert.equal(f.submit.disabled, false);
  assert.equal(h.state.saveCalls.length, 0);
});

test('wrong backup password keeps current workspace and allows a fresh password attempt', async () => {
  const h = harness({onRestore: async () => ({ok: false, error: 'Incorrect password or corrupted backup.'})});
  const before = h.api.data();
  const f = restoreForm('synthetic-incorrect-secret');
  h.api.handleAction('restore-vault');
  await h.api.restoreBackup(f.element);
  assert.deepEqual(h.api.data(), before);
  assert.equal(h.api.ui().modal, 'restore-vault');
  assert.equal(f.input.value, '');
  assert.match(h.state.toasts.at(-1), /Incorrect password/);
  assert.equal(h.state.saveCalls.length, 0);
});

test('failed first save blocks the new workspace until an explicit retry succeeds', () => {
  const starter = {students: [], assessments: [], activeSubjects: ['fr'], lang: 'en', planLang: 'en'};
  const h = harness({mode: 'empty', data: starter, failSave: true});
  assert.match(h.root.innerHTML, /Workspace setup could not be saved/);
  assert.match(h.root.innerHTML, /retry-initial-save/);
  h.state.failSave = false;
  h.api.handleAction('retry-initial-save');
  assert(!h.root.innerHTML.includes('retry-initial-save'));
  assert.equal(h.api.revision(), 8);
  assert.equal(h.api.data().students.length, 0);
});

test('an incomplete existing workspace is not silently replaced with a blank model', () => {
  const h = harness({data: {students: [], assessments: [], activeSubjects: ['fr']}});
  assert.match(h.root.textContent, /could not be loaded safely/);
  assert.equal(h.state.saveCalls.length, 0);
  assert.equal(h.api, undefined);
});
