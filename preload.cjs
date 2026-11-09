const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('petHost', {
  initial: () => ipcRenderer.invoke('pet:initial'),
  settings: callback => ipcRenderer.on('pet:settings', (_event, state) => callback(state)),
  action: callback => ipcRenderer.on('pet:play', (_event, id) => callback(id)),
  voicePreview: callback => ipcRenderer.on('pet:voice-preview', (_event, id) => callback(id)),
  menuClosed: callback => ipcRenderer.on('pet:menu-closed', () => callback()),
  menu: () => ipcRenderer.send('pet:menu'),
  pass: value => ipcRenderer.send('pet:pass', value),
  drag: phase => {
    if (['start', 'move', 'end'].includes(phase)) ipcRenderer.send('pet:drag-' + phase);
  },
});
