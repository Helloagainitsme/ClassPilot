'use strict';
// Offline desktop shell. Storage and recovery are testable without Electron.
const {app, BrowserWindow, ipcMain, dialog, session} = require('electron');
const {join} = require('node:path');
const {pathToFileURL} = require('node:url');
const {VaultStore} = require('./lib/vault-store.cjs');

let mainWindow;
let vault;
const localPages = new Set(['login.html', 'index.html'].map(name => pathToFileURL(join(__dirname, 'app', name)).href));
const assetRoot = pathToFileURL(join(__dirname, 'app') + '/').href;
function store() {
  if (!vault) vault = new VaultStore(join(app.getPath('userData'), 'classpilot-data.sqlite'));
  return vault;
}
function authorized(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents ||
      !localPages.has(event.sender.getURL()) ||
      event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Unauthorized request.');
}
function result(fn) {
  try { return {ok: true, ...fn()}; }
  catch (error) { return {ok: false, error: String(error.message || 'The operation failed.')}; }
}
function loadScreen(name) { return mainWindow.loadFile(join(__dirname, 'app', name)); }
function registerSync(channel, handler) {
  ipcMain.on(channel, (event, args) => {
    event.returnValue = result(() => { authorized(event); return handler(args); });
  });
}
function registerIpc() {
  registerSync('vault-info', () => store().status());
  registerSync('vault-create', args => {
    store().create(args?.password, {mode: args?.mode, subjects: args?.subjects, lang: args?.lang});
    setImmediate(() => loadScreen('index.html'));
    return {};
  });
  registerSync('vault-unlock', args => {
    const opened = store().unlock(args?.password);
    setImmediate(() => loadScreen('index.html'));
    return {migrated: opened.migrated};
  });
  registerSync('vault-initial', () => store().snapshot());
  registerSync('vault-save', args => store().save(args?.data, args?.expectedRevision));
  registerSync('vault-lock', () => {
    store().lock();
    setImmediate(() => loadScreen('login.html'));
    return {};
  });
  // No independent audit-write IPC: store.save commits official state and derived history together.
  ipcMain.handle('vault-backup', async event => {
    try {
      authorized(event);
      store().snapshot();
      const answer = await dialog.showSaveDialog(mainWindow, {
        title: 'Encrypted ClassPilot backup',
        defaultPath: `ClassPilot-Backup-${new Date().toISOString().slice(0, 10)}.sqlite`,
        filters: [{name: 'ClassPilot encrypted backup', extensions: ['sqlite']}]
      });
      if (answer.canceled || !answer.filePath) return {ok: false, canceled: true};
      return {ok: true, ...store().backup(answer.filePath)};
    } catch (error) { return {ok: false, error: String(error.message || 'Backup failed.')}; }
  });
  ipcMain.handle('vault-restore', async (event, args) => {
    try {
      authorized(event);
      store().snapshot();
      if (typeof args?.password !== 'string' || !args.password || args.password.length > 1024) {
        throw new Error('Enter the password belonging to the backup.');
      }
      const answer = await dialog.showOpenDialog(mainWindow, {
        title: 'Restore encrypted ClassPilot backup', properties: ['openFile'],
        filters: [{name: 'ClassPilot database', extensions: ['sqlite']}]
      });
      if (answer.canceled || !answer.filePaths?.[0]) return {ok: false, canceled: true};
      const restored = store().restore(answer.filePaths[0], args.password);
      setImmediate(() => loadScreen('login.html'));
      return {ok: true, ...restored};
    } catch (error) { return {ok: false, error: String(error.message || 'Restore failed.')}; }
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 660, show: false,
    backgroundColor: '#f4f6fa', autoHideMenuBar: true,
    webPreferences: {preload: join(__dirname, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged}
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!localPages.has(url)) event.preventDefault(); });
  loadScreen('login.html');
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  registerIpc();
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      const allowed = localPages.has(details.url) || details.url.startsWith(assetRoot) ||
        details.url.startsWith('devtools:') || details.url.startsWith('blob:') || details.url.startsWith('data:');
      callback({cancel: !allowed});
    });
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', () => vault?.close());
}
