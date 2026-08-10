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
  // Letzten Diktat-Text an main melden (für F1/F2 TTS)
  notifyDictationResult: (original, optimized) => ipcRenderer.send('dictation-result', { original, optimized }),
  // Stop-Signal von main empfangen (globale Leertaste während Aufnahme)
  onGlobalDictationStop: (callback) => {
    ipcRenderer.on('global-dictation-stop', () => callback());
    return () => ipcRenderer.removeAllListeners('global-dictation-stop');
  },
  // Übersetzungs-Popup (F2): main → Overlay mit übersetztem Text
  onShowTranslation: (callback) => {
    ipcRenderer.on('show-translation', (_e, payload) => callback(payload));
    return () => ipcRenderer.removeAllListeners('show-translation');
  },
  // Master-Schalter: Übersetzer an/aus (gated F2 im Main-Prozess)
  setTranslatorActive: (active) => ipcRenderer.send('set-translator-active', active),
  // Eco-Mode: main → Renderer (Fenster minimiert/versteckt → Video/Animationen pausieren)
  onEcoMode: (callback) => {
    ipcRenderer.on('eco-mode', (_e, on) => callback(on));
    return () => ipcRenderer.removeAllListeners('eco-mode');
  },
  // Vorlese-Stimme (ElevenLabs voiceId) an den Main-Prozess melden
  setTtsVoice: (voiceId) => ipcRenderer.send('set-tts-voice', voiceId)
});
