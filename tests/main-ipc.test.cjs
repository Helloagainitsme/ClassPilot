'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL} = require('node:url');

async function shell() {
  const root = path.resolve(__dirname, '..');
  const handlers = new Map(), asyncHandlers = new Map(), pending = [];
  const calls = [], requests = [], navigations = [];
  let windows = [];
  const state = {canceled: false, failRestore: false};
  class Store {
    constructor() {}
    status() { return {exists: true}; }
    snapshot() { return {data: {}, revision: 4, mode: 'existing'}; }
    save(data, revision) { calls.push({type: 'save', data, revision}); return {revision: 5}; }
    restore(file, password) {
      calls.push({type: 'restore', file, password});
      if (state.failRestore) throw new Error('Synthetic authentication rejection');
      return {requiresLogin: true};
    }
    backup(file) { calls.push({type: 'backup', file}); return {path: file}; }
    close() {}
  }
  class Window {
    constructor() {
      this.webContents = {mainFrame: {}, getURL: () => this.url,
        setWindowOpenHandler() {}, on: (name, callback) => { if (name === 'will-navigate') navigations.push(callback); }};
      windows.push(this);
    }
    once() {}
    loadFile(filename) { this.url = pathToFileURL(filename).href; }
    static getAllWindows() { return windows; }
  }
  const electron = {
    app: {requestSingleInstanceLock: () => true, getPath: () => root, on() {},
      whenReady: () => Promise.resolve(), quit() {}},
    BrowserWindow: Window,
    ipcMain: {on: (name, callback) => handlers.set(name, callback), handle: (name, callback) => asyncHandlers.set(name, callback)},
    dialog: {
      showOpenDialog: async () => { calls.push({type: 'picker'}); return state.canceled ? {canceled: true} : {filePaths: [path.join(root, 'synthetic-backup.sqlite')]}; },
      showSaveDialog: async () => ({canceled: true})
    },
    session: {defaultSession: {setPermissionRequestHandler() {}, webRequest: {onBeforeRequest: callback => requests.push(callback)}}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'main.cjs'), 'utf8'), {
    __dirname: root, setImmediate: callback => pending.push(callback),
    require(name) { if (name === 'electron') return electron; if (name === './lib/vault-store.cjs') return {VaultStore: Store}; return require(name); }
  });
  await Promise.resolve();
  const window = windows[0];
  const event = () => ({sender: window.webContents, senderFrame: window.webContents.mainFrame});
  return {handlers, asyncHandlers, calls, state, window, event, requests, navigations, pending, root};
}

test('IPC accepts only the approved main frame and returns safe failures for unrelated documents/frames', async () => {
  const app = await shell();
  const good = app.event();
  app.handlers.get('vault-info')(good);
  assert.equal(good.returnValue.ok, true);
  for (const bad of [{...app.event(), senderFrame: {}}, {...app.event(), sender: {getURL: () => app.window.url}}]) {
    app.handlers.get('vault-info')(bad);
    assert.equal(bad.returnValue.ok, false);
  }
  app.window.url = pathToFileURL(path.join(app.root, 'untrusted.html')).href;
  const bad = app.event(); app.handlers.get('vault-info')(bad);
  assert.equal(bad.returnValue.ok, false);
  assert.equal(app.calls.length, 0);
});

test('save carries expected revision and independent audit/student mutation IPC is absent', async () => {
  const app = await shell(), event = app.event();
  const data = {synthetic: true};
  app.handlers.get('vault-save')(event, {data, expectedRevision: 4});
  assert.equal(event.returnValue.revision, 5);
  assert.equal(app.calls[0].data, data);
  assert.equal(app.calls[0].revision, 4);
  for (const removed of ['log-assessment-change', 'log-competency-change', 'log-framework-change', 'student-delete']) {
    assert.equal(app.handlers.has(removed), false);
  }
});

test('restore requires a password; cancel/rejection does not navigate away or report success', async () => {
  const app = await shell(), restore = app.asyncHandlers.get('vault-restore');
  assert.equal((await restore(app.event(), {})).ok, false);
  assert.equal(app.calls.length, 0);
  app.state.canceled = true;
  const canceled = await restore(app.event(), {password: 'synthetic-only-value'});
  assert.equal(canceled.canceled, true);
  assert.equal(app.calls.filter(call => call.type === 'restore').length, 0);
  app.state.canceled = false; app.state.failRestore = true;
  const failed = await restore(app.event(), {password: 'synthetic-only-value'});
  assert.equal(failed.ok, false);
  assert.equal(app.pending.length, 0);
});

test('local asset allowlist and navigation gate exclude remote and unrelated local content', async () => {
  const app = await shell();
  for (const [url, allowed] of [
    [pathToFileURL(path.join(app.root, 'app', 'app.css')).href, true],
    [pathToFileURL(path.join(app.root, 'private-data.json')).href, false],
    ['https://example.invalid/script.js', false]
  ]) {
    let answer;
    app.requests[0]({url}, value => { answer = value; });
    assert.equal(answer.cancel, !allowed);
  }
  let prevented = false;
  app.navigations[0]({preventDefault() { prevented = true; }}, 'file:///untrusted.html');
  assert.equal(prevented, true);
});
