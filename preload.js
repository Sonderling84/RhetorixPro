const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Lizenz-System
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  activateLicense: (key) => ipcRenderer.invoke('activate-license', key),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  getFeatures: () => ipcRenderer.invoke('get-features'),
  // Globales Diktat
  insertGlobalText: (text) => ipcRenderer.invoke('insert-global-text', text),
  hideDictationOverlay: () => ipcRenderer.send('hide-dictation-overlay'),
  onGlobalDictationStart: (callback) => {
    ipcRenderer.on('global-dictation-start', () => callback());
    return () => ipcRenderer.removeAllListeners('global-dictation-start');
  },
  onGlobalDictationToggle: (callback) => {
    ipcRenderer.on('global-dictation-toggle', () => callback());
    return () => ipcRenderer.removeAllListeners('global-dictation-toggle');
  },
  // Aufnahme-Status an main melden (damit Space global registriert/deregistriert wird)
  notifyRecordingStarted: () => ipcRenderer.send('dictation-recording-started'),
  notifyRecordingStopped: () => ipcRenderer.send('dictation-recording-stopped'),
  // Stop-Signal von main empfangen (globale Leertaste während Aufnahme)
  onGlobalDictationStop: (callback) => {
    ipcRenderer.on('global-dictation-stop', () => callback());
    return () => ipcRenderer.removeAllListeners('global-dictation-stop');
  }
});
