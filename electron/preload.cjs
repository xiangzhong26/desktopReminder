const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  getState: () => ipcRenderer.invoke('state:get'),
  saveTask: (task) => ipcRenderer.invoke('task:save', task),
  deleteTask: (id) => ipcRenderer.invoke('task:delete', id),
  startWork: () => ipcRenderer.invoke('work:start'),
  stopWork: () => ipcRenderer.invoke('work:stop'),
  completeReminder: (taskId) => ipcRenderer.invoke('reminder:complete', taskId),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('settings:launch', enabled),
  showMain: () => ipcRenderer.send('window:show-main'),
  closePet: (taskId) => ipcRenderer.send('pet:close', taskId),
  dragPet: (data) => ipcRenderer.send('pet:drag', data),
  onState: (callback) => {
    const listener = (_, state) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
  onPetAlert: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('pet:alert', listener);
    return () => ipcRenderer.removeListener('pet:alert', listener);
  },
  onPetBond: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('pet:bond', listener);
    return () => ipcRenderer.removeListener('pet:bond', listener);
  },
});
