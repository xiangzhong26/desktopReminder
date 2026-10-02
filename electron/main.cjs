const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
let tray;
let quitting = false;
const petWindows = new Map();
const reminderTimers = new Map();
const dataFile = () => path.join(app.getPath('userData'), 'mochiminder-data.json');

const defaults = () => ({
  tasks: [
    { id: crypto.randomUUID(), name: '站起来伸展', intervalMinutes: 20, color: '#59CFA8', enabled: true, createdAt: Date.now() },
    { id: crypto.randomUUID(), name: '喝一杯水', intervalMinutes: 45, color: '#63A9F5', enabled: true, createdAt: Date.now() },
  ],
  sessions: [], completions: [], pending: {}, activeSessionId: null, launchAtLogin: false,
});

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    return { ...defaults(), ...parsed };
  } catch { return defaults(); }
}

let state;
function persist() {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(dataFile(), JSON.stringify(state, null, 2));
  broadcast();
}

function broadcast() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('state:changed', state);
  for (const [taskId, win] of petWindows) {
    if (!win.isDestroyed()) win.webContents.send('state:changed', state);
    if (!state.tasks.some((t) => t.id === taskId && t.enabled)) closePet(taskId);
  }
}

function appUrl(query = '') {
  const dev = process.env.VITE_DEV_SERVER_URL;
  return dev ? `${dev}${query}` : `file://${path.join(__dirname, '../dist/index.html')}${query}`;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180, height: 780, minWidth: 940, minHeight: 650,
    title: 'MochiMinder', backgroundColor: '#EFFAF5',
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadURL(appUrl());
  mainWindow.on('close', (event) => {
    if (!quitting) { event.preventDefault(); mainWindow.hide(); }
  });
}

function petPosition(index) {
  const display = screen.getPrimaryDisplay().workArea;
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: display.x + display.width - 164 - col * 152, y: display.y + display.height - 190 - row * 174 };
}

function createPet(task, index) {
  if (petWindows.has(task.id)) return;
  const pos = petPosition(index);
  const win = new BrowserWindow({
    width: 150, height: 175, x: pos.x, y: pos.y,
    frame: false, transparent: true, resizable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const q = `?view=pet&id=${encodeURIComponent(task.id)}&name=${encodeURIComponent(task.name)}&color=${encodeURIComponent(task.color)}`;
  win.loadURL(appUrl(q));
  win.on('closed', () => petWindows.delete(task.id));
  petWindows.set(task.id, win);
}

function closePet(id) {
  const win = petWindows.get(id);
  if (win && !win.isDestroyed()) win.destroy();
  petWindows.delete(id);
}

function startReminder(task) {
  clearReminder(task.id);
  const timer = setInterval(() => triggerReminder(task.id), Math.max(1, task.intervalMinutes) * 60 * 1000);
  reminderTimers.set(task.id, timer);
}

function clearReminder(id) {
  const timer = reminderTimers.get(id);
  if (timer) clearInterval(timer);
  reminderTimers.delete(id);
}

function triggerReminder(taskId) {
  if (!state.activeSessionId) return;
  state.pending[taskId] = (state.pending[taskId] || 0) + 1;
  persist();
  const win = petWindows.get(taskId);
  if (win && !win.isDestroyed()) {
    const display = screen.getDisplayMatching(win.getBounds()).workArea;
    win.webContents.send('pet:alert', { pending: state.pending[taskId] });
    const start = Date.now();
    const mover = setInterval(() => {
      if (win.isDestroyed() || Date.now() - start > 5000) return clearInterval(mover);
      const x = display.x + Math.floor(Math.random() * Math.max(1, display.width - 150));
      const y = display.y + Math.floor(Math.random() * Math.max(1, display.height - 175));
      win.setPosition(x, y, true);
    }, 520);
  }
}

function beginActivePets() {
  state.tasks.filter((t) => t.enabled).forEach((task, index) => { createPet(task, index); startReminder(task); });
}

function endActivePets() {
  for (const id of reminderTimers.keys()) clearReminder(id);
  for (const id of [...petWindows.keys()]) closePet(id);
}

function setupTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '../assets/tray.png')));
  tray.setToolTip('MochiMinder');
  const menu = Menu.buildFromTemplate([
    { label: '打开 MochiMinder', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: '开始工作', click: () => startWork(), enabled: !state.activeSessionId },
    { label: '结束工作', click: () => stopWork(), enabled: !!state.activeSessionId },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; stopWork(); app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
}

function refreshTray() { if (tray) { tray.destroy(); setupTray(); } }

function startWork() {
  if (state.activeSessionId) return state;
  const session = { id: crypto.randomUUID(), start: Date.now(), end: null };
  state.sessions.push(session); state.activeSessionId = session.id;
  persist(); beginActivePets(); refreshTray(); return state;
}

function stopWork() {
  if (!state.activeSessionId) return state;
  const active = state.sessions.find((s) => s.id === state.activeSessionId);
  if (active) active.end = Date.now();
  state.activeSessionId = null; persist(); endActivePets(); refreshTray(); return state;
}

app.whenReady().then(() => {
  state = loadState();
  const dangling = state.sessions.find((s) => !s.end);
  if (dangling) { dangling.end = Date.now(); state.activeSessionId = null; persist(); }
  createMainWindow(); setupTray();
  app.on('activate', () => { mainWindow ? mainWindow.show() : createMainWindow(); });
});
app.on('before-quit', () => { quitting = true; if (state?.activeSessionId) stopWork(); });
// Keep running in the system tray when every visible window is closed.
app.on('window-all-closed', () => {});

ipcMain.handle('state:get', () => state);
ipcMain.handle('task:save', (_, task) => {
  const existing = task.id && state.tasks.find((t) => t.id === task.id);
  if (existing) Object.assign(existing, task, { intervalMinutes: Math.max(1, Number(task.intervalMinutes)) });
  else state.tasks.push({ ...task, id: crypto.randomUUID(), intervalMinutes: Math.max(1, Number(task.intervalMinutes)), enabled: true, createdAt: Date.now() });
  persist();
  if (state.activeSessionId) { endActivePets(); beginActivePets(); }
  return state;
});
ipcMain.handle('task:delete', (_, id) => {
  state.tasks = state.tasks.filter((t) => t.id !== id); delete state.pending[id]; clearReminder(id); closePet(id); persist(); return state;
});
ipcMain.handle('work:start', () => startWork());
ipcMain.handle('work:stop', () => stopWork());
ipcMain.handle('reminder:complete', (_, taskId) => {
  if ((state.pending[taskId] || 0) > 0) state.pending[taskId] -= 1;
  state.completions.push({ id: crypto.randomUUID(), taskId, at: Date.now() }); persist(); return state;
});
ipcMain.handle('settings:launch', (_, enabled) => {
  state.launchAtLogin = !!enabled;
  app.setLoginItemSettings({ openAtLogin: !!enabled }); persist(); return state;
});
ipcMain.on('window:show-main', () => { mainWindow.show(); mainWindow.focus(); });
ipcMain.on('pet:close', (_, taskId) => closePet(taskId));
