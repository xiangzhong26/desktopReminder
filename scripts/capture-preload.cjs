const { contextBridge, ipcRenderer } = require('electron');

const now = Date.now();
const tasks = [
  { id: 'stretch', name: '站起来伸展', intervalMinutes: 20, color: '#59CFA8', enabled: true, createdAt: now },
  { id: 'water', name: '喝一杯水', intervalMinutes: 45, color: '#63A9F5', enabled: true, createdAt: now },
  { id: 'eyes', name: '眺望远处', intervalMinutes: 30, color: '#F47DA5', enabled: true, createdAt: now },
];
const state = {
  tasks,
  sessions: [
    { id: 'morning', start: now - 7.2e6, end: now - 4.8e6 },
    { id: 'active', start: now - 2.28e6, end: null },
  ],
  completions: Array.from({ length: 12 }, (_, index) => ({ id: `done-${index}`, taskId: tasks[index % 3].id, at: now - index * 180000 })),
  pending: { stretch: 0, water: 1, eyes: 0 },
  activeSessionId: 'active',
  launchAtLogin: false,
};

contextBridge.exposeInMainWorld('desktopAPI', {
  getState: () => Promise.resolve(state),
  saveTask: () => Promise.resolve(state),
  deleteTask: () => Promise.resolve(state),
  startWork: () => Promise.resolve(state),
  stopWork: () => Promise.resolve(state),
  completeReminder: () => Promise.resolve(state),
  setLaunchAtLogin: () => Promise.resolve(state),
  showMain: () => {}, closePet: () => {}, dragPet: () => {},
  onState: () => () => {},
  onPetAlert: (callback) => { const listener = (_, data) => callback(data); ipcRenderer.on('pet:alert', listener); return () => ipcRenderer.removeListener('pet:alert', listener); },
  onPetBond: () => () => {},
});
