const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PET_W = 92;
const PET_H = 108;
const HUB_SIZE = 62;
let mainWindow;
let hubWindow;
let tray;
let quitting = false;
let hubProgrammaticUntil = 0;
let lastHubBounds;
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
  try { return { ...defaults(), ...JSON.parse(fs.readFileSync(dataFile(), 'utf8')) }; }
  catch { return defaults(); }
}

let state;
function persist() {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(dataFile(), JSON.stringify(state, null, 2));
  broadcast();
}

function broadcast() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('state:changed', state);
  for (const [taskId, pet] of petWindows) {
    if (!pet.win.isDestroyed()) pet.win.webContents.send('state:changed', state);
    if (!state.tasks.some((task) => task.id === taskId && task.enabled)) closePet(taskId);
  }
}

function appUrl(query = '') {
  return process.env.VITE_DEV_SERVER_URL
    ? `${process.env.VITE_DEV_SERVER_URL}${query}`
    : `file://${path.join(__dirname, '../dist/index.html')}${query}`;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 860, height: 600, minWidth: 760, minHeight: 520,
    title: 'MochiMinder', backgroundColor: '#F6FAF8',
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadURL(appUrl());
  mainWindow.on('close', (event) => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
}

function makeOverlayWindow(options) {
  const win = new BrowserWindow({
    ...options, frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: false, hasShadow: false, alwaysOnTop: true, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  return win;
}

function hubStartPosition() {
  const area = screen.getPrimaryDisplay().workArea;
  return { x: area.x + area.width - 190, y: area.y + area.height - 115 };
}

function slotOffset(index, count) {
  const presets = {
    1: [[0, -69]],
    2: [[-57, -45], [57, -45]],
    3: [[-62, -28], [0, -72], [62, -28]],
    4: [[-62, -30], [0, -73], [62, -30], [0, 45]],
  };
  if (presets[count]) return presets[count][index];
  const angle = -Math.PI / 2 + (Math.PI * 2 * index / count);
  return [Math.round(Math.cos(angle) * 76), Math.round(Math.sin(angle) * 66)];
}

function centerOf(bounds) { return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function desiredPosition(pet) {
  if (!pet.attachedTo) return pet.win.getBounds();
  const anchorBounds = pet.attachedTo === 'hub'
    ? hubWindow?.getBounds()
    : petWindows.get(pet.attachedTo)?.win.getBounds();
  if (!anchorBounds) return pet.win.getBounds();
  const anchorCenter = centerOf(anchorBounds);
  return { x: Math.round(anchorCenter.x + pet.offset.x - PET_W / 2), y: Math.round(anchorCenter.y + pet.offset.y - PET_H / 2) };
}

function setPetPosition(pet, x, y) {
  if (!pet || pet.win.isDestroyed()) return;
  pet.programmaticUntil = Date.now() + 90;
  pet.lastBounds = { ...pet.win.getBounds(), x: Math.round(x), y: Math.round(y) };
  pet.win.setPosition(Math.round(x), Math.round(y), false);
}

function moveFollowers(anchorId, dx, dy) {
  for (const pet of petWindows.values()) {
    if (pet.attachedTo !== anchorId || pet.roaming) continue;
    const bounds = pet.win.getBounds();
    setPetPosition(pet, bounds.x + dx, bounds.y + dy);
    moveFollowers(pet.taskId, dx, dy);
  }
}

function animatePetTo(pet, target, duration = 430) {
  if (!pet || pet.win.isDestroyed()) return;
  if (pet.animation) clearInterval(pet.animation);
  const from = pet.win.getBounds(); const started = Date.now();
  pet.win.webContents.send('pet:bond', { phase: 'snap' });
  pet.animation = setInterval(() => {
    if (pet.win.isDestroyed()) return clearInterval(pet.animation);
    const t = Math.min(1, (Date.now() - started) / duration);
    const spring = 1 - Math.exp(-7 * t) * Math.cos(11 * t);
    setPetPosition(pet, from.x + (target.x - from.x) * spring, from.y + (target.y - from.y) * spring);
    if (t >= 1) { clearInterval(pet.animation); pet.animation = null; setPetPosition(pet, target.x, target.y); }
  }, 16);
}

function reparentChildren(pet, newAnchor) {
  for (const child of petWindows.values()) {
    if (child.attachedTo !== pet.taskId) continue;
    const childCenter = centerOf(child.win.getBounds());
    const anchorBounds = newAnchor === 'hub' ? hubWindow?.getBounds() : petWindows.get(newAnchor)?.win.getBounds();
    if (anchorBounds) {
      const anchorCenter = centerOf(anchorBounds);
      child.attachedTo = newAnchor;
      child.offset = { x: childCenter.x - anchorCenter.x, y: childCenter.y - anchorCenter.y };
    } else child.attachedTo = null;
  }
}

function detachPet(pet) {
  if (!pet.attachedTo) return;
  const previousAnchor = pet.attachedTo;
  reparentChildren(pet, previousAnchor);
  pet.attachedTo = null;
  pet.win.webContents.send('pet:bond', { phase: 'break' });
}

function createsCycle(petId, anchorId) {
  let cursor = anchorId;
  while (cursor && cursor !== 'hub') {
    if (cursor === petId) return true;
    cursor = petWindows.get(cursor)?.attachedTo;
  }
  return false;
}

function tryAttach(pet) {
  if (!pet || pet.roaming || pet.win.isDestroyed()) return;
  const petCenter = centerOf(pet.win.getBounds());
  const candidates = [];
  if (hubWindow && !hubWindow.isDestroyed()) candidates.push({ id: 'hub', center: centerOf(hubWindow.getBounds()) });
  for (const other of petWindows.values()) {
    if (other.taskId !== pet.taskId && !other.win.isDestroyed() && !createsCycle(pet.taskId, other.taskId))
      candidates.push({ id: other.taskId, center: centerOf(other.win.getBounds()) });
  }
  candidates.sort((a, b) => distance(petCenter, a.center) - distance(petCenter, b.center));
  const nearest = candidates[0];
  if (!nearest || distance(petCenter, nearest.center) > 112) return;

  pet.attachedTo = nearest.id;
  if (nearest.id === 'hub') {
    pet.offset = { ...pet.homeOffset };
  } else {
    const dx = petCenter.x - nearest.center.x; const dy = petCenter.y - nearest.center.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    pet.offset = { x: dx / length * 66, y: dy / length * 54 };
  }
  animatePetTo(pet, desiredPosition(pet));
}

function onPetMoved(pet) {
  if (pet.roaming || Date.now() < pet.programmaticUntil || pet.win.isDestroyed()) return;
  const bounds = pet.win.getBounds();
  if (pet.lastBounds) moveFollowers(pet.taskId, bounds.x - pet.lastBounds.x, bounds.y - pet.lastBounds.y);
  pet.lastBounds = bounds;
  if (pet.attachedTo) {
    const target = desiredPosition(pet);
    const displacement = Math.hypot(bounds.x - target.x, bounds.y - target.y);
    if (displacement > 47) detachPet(pet);
    else pet.win.webContents.send('pet:bond', { phase: 'stretch', strength: Math.min(1, displacement / 47) });
  }
  clearTimeout(pet.settleTimer);
  pet.settleTimer = setTimeout(() => {
    if (pet.attachedTo) animatePetTo(pet, desiredPosition(pet), 360);
    else tryAttach(pet);
  }, 180);
}

function createHub() {
  if (hubWindow && !hubWindow.isDestroyed()) return;
  const pos = hubStartPosition();
  hubWindow = makeOverlayWindow({ width: HUB_SIZE, height: HUB_SIZE, x: pos.x, y: pos.y, focusable: true });
  lastHubBounds = hubWindow.getBounds();
  hubWindow.loadURL(appUrl('?view=hub'));
  hubWindow.on('move', () => {
    if (!hubWindow || hubWindow.isDestroyed()) return;
    const bounds = hubWindow.getBounds();
    if (Date.now() < hubProgrammaticUntil) { lastHubBounds = bounds; return; }
    const dx = bounds.x - lastHubBounds.x; const dy = bounds.y - lastHubBounds.y;
    lastHubBounds = bounds; moveFollowers('hub', dx, dy);
  });
  hubWindow.on('closed', () => { hubWindow = null; });
}

function createPet(task, index, count) {
  if (petWindows.has(task.id)) return;
  createHub();
  const hubCenter = centerOf(hubWindow.getBounds()); const [ox, oy] = slotOffset(index, count);
  const win = makeOverlayWindow({ width: PET_W, height: PET_H, x: Math.round(hubCenter.x + ox - PET_W / 2), y: Math.round(hubCenter.y + oy - PET_H / 2), focusable: true });
  const pet = { taskId: task.id, win, slot: index, homeOffset: { x: ox, y: oy }, offset: { x: ox, y: oy }, attachedTo: 'hub', programmaticUntil: 0, roaming: false, lastBounds: win.getBounds(), settleTimer: null, animation: null };
  const query = `?view=pet&id=${encodeURIComponent(task.id)}&name=${encodeURIComponent(task.name)}&color=${encodeURIComponent(task.color)}`;
  win.loadURL(appUrl(query));
  win.on('move', () => onPetMoved(pet));
  win.on('closed', () => petWindows.delete(task.id));
  petWindows.set(task.id, pet);
}

function closePet(id) {
  const pet = petWindows.get(id);
  if (pet) {
    clearTimeout(pet.settleTimer); if (pet.animation) clearInterval(pet.animation);
    reparentChildren(pet, pet.attachedTo);
    if (!pet.win.isDestroyed()) pet.win.destroy();
  }
  petWindows.delete(id);
}

function startReminder(task) {
  clearReminder(task.id);
  reminderTimers.set(task.id, setInterval(() => triggerReminder(task.id), Math.max(1, task.intervalMinutes) * 60 * 1000));
}
function clearReminder(id) { const timer = reminderTimers.get(id); if (timer) clearInterval(timer); reminderTimers.delete(id); }

function roamPet(pet) {
  detachPet(pet); pet.roaming = true;
  const area = screen.getDisplayMatching(pet.win.getBounds()).workArea;
  const waypoints = [{ x: pet.win.getBounds().x, y: pet.win.getBounds().y }];
  for (let i = 0; i < 5; i++) waypoints.push({
    x: area.x + 8 + Math.random() * Math.max(1, area.width - PET_W - 16),
    y: area.y + 8 + Math.random() * Math.max(1, area.height - PET_H - 16),
  });
  const started = Date.now(); const segmentMs = 980;
  pet.animation = setInterval(() => {
    if (pet.win.isDestroyed()) return clearInterval(pet.animation);
    const elapsed = Date.now() - started; const segment = Math.min(4, Math.floor(elapsed / segmentMs));
    const t = Math.min(1, (elapsed - segment * segmentMs) / segmentMs);
    const eased = .5 - Math.cos(Math.PI * t) / 2; const from = waypoints[segment]; const to = waypoints[segment + 1];
    const arc = Math.sin(Math.PI * t) * (segment % 2 ? -34 : 34);
    setPetPosition(pet, from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased - Math.abs(arc));
    if (elapsed >= segmentMs * 5) { clearInterval(pet.animation); pet.animation = null; pet.roaming = false; pet.lastBounds = pet.win.getBounds(); }
  }, 16);
}

function triggerReminder(taskId) {
  if (!state.activeSessionId) return;
  state.pending[taskId] = (state.pending[taskId] || 0) + 1; persist();
  const pet = petWindows.get(taskId);
  if (pet && !pet.win.isDestroyed()) { pet.win.webContents.send('pet:alert', { pending: state.pending[taskId] }); roamPet(pet); }
}

function beginActivePets() {
  const activeTasks = state.tasks.filter((task) => task.enabled);
  createHub(); activeTasks.forEach((task, index) => { createPet(task, index, activeTasks.length); startReminder(task); });
}

function endActivePets() {
  for (const id of [...reminderTimers.keys()]) clearReminder(id);
  for (const id of [...petWindows.keys()]) closePet(id);
  if (hubWindow && !hubWindow.isDestroyed()) hubWindow.destroy(); hubWindow = null;
}

function setupTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '../assets/tray.png'))); tray.setToolTip('MochiMinder');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 MochiMinder', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: '开始工作', click: () => startWork(), enabled: !state.activeSessionId },
    { label: '结束工作', click: () => stopWork(), enabled: !!state.activeSessionId },
    { type: 'separator' }, { label: '退出', click: () => { quitting = true; stopWork(); app.quit(); } },
  ]));
  tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
}
function refreshTray() { if (tray) { tray.destroy(); setupTray(); } }

function startWork() {
  if (state.activeSessionId) return state;
  const session = { id: crypto.randomUUID(), start: Date.now(), end: null };
  state.sessions.push(session); state.activeSessionId = session.id; persist(); beginActivePets(); refreshTray(); return state;
}
function stopWork() {
  if (!state.activeSessionId) return state;
  const active = state.sessions.find((session) => session.id === state.activeSessionId); if (active) active.end = Date.now();
  state.activeSessionId = null; persist(); endActivePets(); refreshTray(); return state;
}

app.whenReady().then(() => {
  state = loadState(); const dangling = state.sessions.find((session) => !session.end);
  if (dangling) { dangling.end = Date.now(); state.activeSessionId = null; persist(); }
  createMainWindow(); setupTray(); app.on('activate', () => { mainWindow ? mainWindow.show() : createMainWindow(); });
});
app.on('before-quit', () => { quitting = true; if (state?.activeSessionId) stopWork(); });
app.on('window-all-closed', () => {});

ipcMain.handle('state:get', () => state);
ipcMain.handle('task:save', (_, task) => {
  const existing = task.id && state.tasks.find((item) => item.id === task.id);
  if (existing) Object.assign(existing, task, { intervalMinutes: Math.max(1, Number(task.intervalMinutes)) });
  else state.tasks.push({ ...task, id: crypto.randomUUID(), intervalMinutes: Math.max(1, Number(task.intervalMinutes)), enabled: true, createdAt: Date.now() });
  persist(); if (state.activeSessionId) { endActivePets(); beginActivePets(); } return state;
});
ipcMain.handle('task:delete', (_, id) => { state.tasks = state.tasks.filter((task) => task.id !== id); delete state.pending[id]; clearReminder(id); closePet(id); persist(); return state; });
ipcMain.handle('work:start', () => startWork());
ipcMain.handle('work:stop', () => stopWork());
ipcMain.handle('reminder:complete', (_, taskId) => { if ((state.pending[taskId] || 0) > 0) state.pending[taskId] -= 1; state.completions.push({ id: crypto.randomUUID(), taskId, at: Date.now() }); persist(); return state; });
ipcMain.handle('settings:launch', (_, enabled) => { state.launchAtLogin = !!enabled; app.setLoginItemSettings({ openAtLogin: !!enabled }); persist(); return state; });
ipcMain.on('window:show-main', () => { mainWindow.show(); mainWindow.focus(); });
ipcMain.on('pet:close', (_, taskId) => closePet(taskId));
ipcMain.on('pet:drag', (_, { taskId, phase, dx = 0, dy = 0 }) => {
  const pet = petWindows.get(taskId);
  if (!pet || pet.roaming || pet.win.isDestroyed()) return;
  if (phase === 'start') {
    if (pet.animation) { clearInterval(pet.animation); pet.animation = null; }
    pet.dragStart = pet.win.getBounds(); pet.dragLast = pet.dragStart;
    return;
  }
  if (phase === 'move' && pet.dragStart) {
    const next = { x: Math.round(pet.dragStart.x + dx), y: Math.round(pet.dragStart.y + dy) };
    const stepX = next.x - pet.dragLast.x; const stepY = next.y - pet.dragLast.y;
    pet.programmaticUntil = Date.now() + 100;
    pet.win.setPosition(next.x, next.y, false); pet.lastBounds = { ...pet.win.getBounds(), ...next }; pet.dragLast = { ...pet.lastBounds };
    moveFollowers(pet.taskId, stepX, stepY);
    if (pet.attachedTo) {
      const target = desiredPosition(pet); const displacement = Math.hypot(next.x - target.x, next.y - target.y);
      if (displacement > 47) detachPet(pet);
      else pet.win.webContents.send('pet:bond', { phase: 'stretch', strength: Math.min(1, displacement / 47) });
    }
    return;
  }
  if (phase === 'end') {
    pet.dragStart = null; pet.dragLast = null;
    if (pet.attachedTo) animatePetTo(pet, desiredPosition(pet), 360); else tryAttach(pet);
  }
});
