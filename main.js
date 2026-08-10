const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, session, systemPreferences, globalShortcut, clipboard } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Debug-Log in Datei
const LOG_FILE = '/tmp/rhetorix_debug.log';
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}
fs.writeFileSync(LOG_FILE, ''); // Clear
log('=== RhetorixPro Main Process Start ===');

// Plattform-Helfer. macOS ist vollständig umgesetzt; Windows-Zweige sind additiv
// hinzugefügt (noch nicht auf echter Windows-Hardware getestet — siehe WINDOWS.md).
const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

// Markierten Text der Vordergrund-App in die Zwischenablage kopieren (Cmd/Strg+C), dann cb().
function copySelection(cb) {
  if (IS_MAC) {
    exec(`osascript -e 'tell application "System Events" to keystroke "c" using command down'`, () => cb());
  } else if (IS_WIN) {
    exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^c')"`, () => cb());
  } else {
    cb();
  }
}

const { bootstrap } = require('./hermes-bootstrap');
const { getLicenseStatus, activateLicense, deactivateLicense, getFeatures, initTrial } = require('./license-manager');
log('Modules loaded');

// Chromium Web Speech API aktivieren (Electron hat keinen eingebauten Google API-Key)
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

const APP_VERSION = '1.0.1';

// Autostart beim Login aktivieren
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true,
  path: app.getPath('exe'),
});
const SERVER_PORT = 3847;
const isDev = !app.isPackaged;

let mainWindow = null;
let dictationWindow = null;
let tray = null;
let expressServer = null;
let previousFrontApp = null; // Ziel-App für paste merken
let lastOriginalText = '';   // F1: letzter Original-Diktat-Text
let lastOptimizedText = '';  // F2: letzter optimierter Text

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    backgroundColor: '#020617',
  });

  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  // Eco-Mode: Wenn das Hauptfenster minimiert/versteckt ist, dem Renderer sagen,
  // dass er das Hintergrund-Video + Dauer-Animationen pausiert (spart GPU/CPU).
  // Diktat läuft davon unberührt weiter (eigenes Overlay-Fenster + globale Shortcuts).
  const sendEco = (on) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try { mainWindow.webContents.send('eco-mode', on); } catch { /* */ }
    }
  };
  mainWindow.on('minimize', () => { log('[Eco] Fenster minimiert → Eco AN'); sendEco(true); });
  mainWindow.on('hide', () => { log('[Eco] Fenster versteckt → Eco AN'); sendEco(true); });
  mainWindow.on('restore', () => sendEco(false));
  mainWindow.on('show', () => sendEco(false));
  mainWindow.on('focus', () => sendEco(false));

  // Frontend console.log/error/warn → Debug-Log-File umleiten
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const prefix = ['LOG', 'WARN', 'ERR'][level] || 'LOG';
    log(`[Renderer/${prefix}] ${message}`);
  });

  mainWindow.once('ready-to-show', () => {
    // Wenn mit --hidden gestartet (Autostart), im Tray bleiben
    const startHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;
    if (!startHidden) {
      mainWindow.show();
    } else {
      log('Gestartet im Hintergrund (Tray-Modus)');
    }
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('close', (e) => {
    if (app.isQuitting) return;
    e.preventDefault();
    mainWindow.hide();
  });
}

function createDictationWindow() {
  const isMac = process.platform === 'darwin';
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const overlayW = 520;
  const overlayH = 280;

  dictationWindow = new BrowserWindow({
    width: overlayW,
    height: overlayH,
    x: Math.round((screenW - overlayW) / 2),
    y: screenH - overlayH - 40, // 40px vom unteren Rand
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
    show: false,
    resizable: false,
  });

  dictationWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  dictationWindow.setAlwaysOnTop(true, 'screen-saver', 1); // Höchste Ebene

  // macOS: Panel-Level damit es über allen Apps schwebt
  if (process.platform === 'darwin') {
    dictationWindow.setWindowButtonVisibility(false);
  }

  // Lade eine spezielle Route für das Overlay
  dictationWindow.loadURL(`http://localhost:${SERVER_PORT}/#/dictation-overlay`);

  dictationWindow.on('blur', () => {
    // Optional: dictationWindow.hide() wenn der Nutzer woanders hinklickt.
    // Machen wir vorerst nicht, damit das Fenster beim Nachdenken offen bleibt.
  });
  
  dictationWindow.on('close', (e) => {
    if (app.isQuitting) return;
    e.preventDefault();
    dictationWindow.hide();
  });
}

function createTray() {
  // macOS Template Image: wird automatisch für Light/Dark Mode eingefärbt
  const iconPath = path.join(__dirname, 'assets', 'tray-iconTemplate.png');
  try {
    const { nativeImage } = require('electron');
    const img = nativeImage.createFromPath(iconPath);
    img.setTemplateImage(true);
    tray = new Tray(img);
  } catch (err) {
    log('[Tray] Icon nicht gefunden oder Fehler: ' + err.message);
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: `Rhetorix Pro v${APP_VERSION}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Diktat starten',
      accelerator: 'Shift+Space',
      click: () => {
        if (dictationWindow) {
          dictationWindow.showInactive();
          dictationWindow.webContents.send('global-dictation-toggle');
        }
      },
    },
    { type: 'separator' },
    { label: 'Fenster zeigen', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Rhetorix Pro — Shift+Space für Diktat');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

// Lazy Gemini Key: Holt den Key aus Hermes falls nicht im process.env
async function ensureGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    log('[Hermes] Key nicht im Speicher, hole on-demand...');
    const { getHermesToken, getCredential } = require('./hermes-bootstrap');
    const token = await getHermesToken();
    const key = await getCredential(token, 'Google_AI', 'api_key');
    process.env.GEMINI_API_KEY = key;
    log('[Hermes] Gemini Key nachgeladen!');
    return key;
  } catch (err) {
    log('[Hermes] Key nachladen fehlgeschlagen: ' + err.message);
    return null;
  }
}

// Lazy ElevenLabs Key: Holt den Key aus Hermes falls nicht im process.env
async function ensureElevenLabsKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  try {
    log('[Hermes] ElevenLabs Key nicht im Speicher, hole on-demand...');
    const { getHermesToken, getCredential } = require('./hermes-bootstrap');
    const token = await getHermesToken();
    const key = await getCredential(token, 'ElevenLabs', 'api_key');
    process.env.ELEVENLABS_API_KEY = key;
    log('[Hermes] ElevenLabs Key nachgeladen!');
    return key;
  } catch (err) {
    log('[Hermes] ElevenLabs Key nachladen fehlgeschlagen: ' + err.message);
    return null;
  }
}

// Retry-Helper für Gemini API (503/429)
async function geminiRequestWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (data.error && (data.error.code === 503 || data.error.code === 429)) {
      if (attempt < maxRetries) {
        const waitMs = Math.min(2000 * Math.pow(2, attempt), 10000); // 2s, 4s, 8s
        log(`[Gemini] ${data.error.code} — Retry ${attempt + 1}/${maxRetries} in ${waitMs}ms`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
    }
    return data;
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    try {
      const express = require('express');
      const cookieParser = require('cookie-parser');

      const server = express();
      server.use(express.json({ limit: '50mb' }));
      server.use(cookieParser());

      // Gemini API Key Endpoint
      server.get('/api/gemini-key', async (req, res) => {
        const key = await ensureGeminiKey();
        if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not configured — Hermes nicht erreichbar' });
        res.json({ key });
      });

      // ElevenLabs Key Endpoint
      server.get('/api/elevenlabs-key', async (req, res) => {
        const key = await ensureElevenLabsKey();
        if (!key) return res.status(500).json({ error: 'ELEVENLABS_API_KEY nicht konfiguriert' });
        res.json({ key });
      });

      // ElevenLabs Text-to-Speech Proxy
      server.post('/api/tts', async (req, res) => {
        try {
          const { text, voiceId } = req.body;
          if (!text) return res.status(400).json({ error: 'Kein Text angegeben' });

          const key = await ensureElevenLabsKey();
          if (!key) return res.status(500).json({ error: 'ElevenLabs Key nicht verfügbar' });

          // Default Voice: Nicole (deutsch, weiblich, natürlich)
          const voice = voiceId || 'piTKgcLEGmPE4e6mEKli';
          const model = 'eleven_flash_v2_5';

          log(`[TTS] ElevenLabs Request: ${text.substring(0, 60)}... (Voice: ${voice})`);

          const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
            method: 'POST',
            headers: {
              'xi-api-key': key,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
              text,
              model_id: model,
              voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0 }
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            log(`[TTS] ElevenLabs Fehler ${response.status}: ${errText.substring(0, 200)}`);
            return res.status(response.status).json({ error: `ElevenLabs ${response.status}: ${errText.substring(0, 100)}` });
          }

          const audioBuffer = await response.arrayBuffer();
          const base64 = Buffer.from(audioBuffer).toString('base64');
          log(`[TTS] ElevenLabs OK: ${Math.round(audioBuffer.byteLength / 1024)} KB Audio`);
          res.json({ audio: base64, mimeType: 'audio/mpeg' });
        } catch (err) {
          log('[TTS] Fehler: ' + err.message);
          res.status(500).json({ error: err.message });
        }
      });

      // ElevenLabs Voices auflisten
      server.get('/api/tts/voices', async (req, res) => {
        try {
          const key = await ensureElevenLabsKey();
          if (!key) return res.status(500).json({ error: 'ElevenLabs Key nicht verfügbar' });

          const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': key },
          });
          const data = await response.json();
          // Nur relevante Felder zurückgeben
          const voices = (data.voices || []).map(v => ({
            voice_id: v.voice_id,
            name: v.name,
            labels: v.labels,
            preview_url: v.preview_url,
          }));
          res.json({ voices });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });

      // Text-Optimierung via Gemini
      server.post('/api/optimize-text', async (req, res) => {
        try {
          const { text } = req.body;
          if (!text) return res.status(400).json({ error: 'Kein Text angegeben' });

          const apiKey = await ensureGeminiKey();
          if (!apiKey) return res.status(500).json({ error: 'Gemini Key nicht verfügbar' });

          const { GoogleGenAI } = require('@google/genai');
          const ai = new GoogleGenAI({ apiKey });
          const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: `Du bist ein professioneller Textoptimierer. Verbessere den folgenden diktierten Text:
- Korrigiere Grammatik und Rechtschreibung
- Verbessere Ausdruck und Stil
- Mache den Text flüssiger und professioneller
- Behalte die Ich-Perspektive und den Inhalt 1:1 bei
- Antworte NUR mit dem optimierten Text, ohne Erklärung

Text: ${text}`,
          });

          res.json({ text: result.text || text });
        } catch (err) {
          log('[Optimize] Fehler: ' + err.message);
          res.status(500).json({ error: err.message });
        }
      });

      // Lizenz Endpoint
      server.post('/api/license/validate', async (req, res) => {
        const status = getLicenseStatus();
        res.json({ valid: !status.expired, plan: status.plan, daysLeft: status.daysLeft });
      });

      // Lokale Whisper-Transkription via whisper-server
      const os = require('os');
      const crypto = require('crypto');
      const { execFile, spawn } = require('child_process');

      // Ein Whisper-Server mit ggml-base (schnell genug für Live + Finale)
      const WHISPER_SERVER_PORT = 8178;
      // Pfade per ENV überschreibbar; Default macOS (Homebrew), Windows sucht gebündelte Binaries.
      const WHISPER_SERVER_BIN = process.env.WHISPER_SERVER_BIN || (IS_WIN ? 'whisper-server.exe' : '/opt/homebrew/bin/whisper-server');
      const WHISPER_MODEL = process.env.WHISPER_MODEL || (IS_WIN ? path.join(process.resourcesPath || __dirname, 'whisper', 'ggml-base.bin') : '/opt/homebrew/share/whisper-cpp/models/ggml-base.bin');
      const FFMPEG_BIN = process.env.FFMPEG_BIN || (IS_WIN ? 'ffmpeg.exe' : '/opt/homebrew/bin/ffmpeg');

      async function ensureWhisperServer() {
        try {
          const res = await fetch(`http://127.0.0.1:${WHISPER_SERVER_PORT}/health`);
          if (res.ok) return true;
        } catch {}
        log('[Whisper] Server nicht erreichbar, starte...');
        const child = spawn(WHISPER_SERVER_BIN, [
          '-m', WHISPER_MODEL, '-l', 'de', '--port', String(WHISPER_SERVER_PORT)
        ], { detached: true, stdio: 'ignore' });
        child.unref();
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 500));
          try {
            const res = await fetch(`http://127.0.0.1:${WHISPER_SERVER_PORT}/health`);
            if (res.ok) { log('[Whisper] Server gestartet (ggml-base)!'); return true; }
          } catch {}
        }
        log('[Whisper] Server konnte nicht gestartet werden');
        return false;
      }

      async function whisperTranscribe(audioBuffer) {
        const ok = await ensureWhisperServer();
        if (!ok) throw new Error('Whisper-Server nicht verfügbar');

        const tmpIn = path.join(os.tmpdir(), `rh_${crypto.randomBytes(4).toString('hex')}.webm`);
        const tmpWav = tmpIn.replace('.webm', '.wav');
        fs.writeFileSync(tmpIn, audioBuffer);

        await new Promise((resolve, reject) => {
          execFile(FFMPEG_BIN, [
            '-i', tmpIn, '-ar', '16000', '-ac', '1', '-f', 'wav', tmpWav, '-y'
          ], { timeout: 10000 }, (err) => {
            if (err) reject(err); else resolve();
          });
        });

        const fileBuffer = fs.readFileSync(tmpWav);
        const boundary = '----WhisperBoundary' + crypto.randomBytes(8).toString('hex');
        const body = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
          fileBuffer,
          Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`),
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nde\r\n`),
          Buffer.from(`--${boundary}--\r\n`)
        ]);

        const res = await fetch(`http://127.0.0.1:${WHISPER_SERVER_PORT}/inference`, {
          method: 'POST',
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          body
        });
        const data = await res.json();

        try { fs.unlinkSync(tmpIn); } catch {}
        try { fs.unlinkSync(tmpWav); } catch {}

        return (data.text || '').trim();
      }

      // Übersetzung des transkribierten Textes via Gemini.
      // targetLang ist die deutsche Adjektiv-Form aus der LANGUAGES-Liste (z.B. "Englische"),
      // sodass "ins ${targetLang}" grammatikalisch passt ("ins Englische").
      async function translateText(text, targetLang) {
        const apiKey = await ensureGeminiKey();
        if (!apiKey) throw new Error('Gemini Key nicht verfügbar');
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: `Du bist ein professioneller Übersetzer. Übersetze den folgenden Text ins ${targetLang}.
- Übersetze sinngemäß und natürlich, nicht wörtlich
- Behalte Tonfall und Ich-Perspektive bei
- Gib NUR die Übersetzung zurück, ohne Anführungszeichen und ohne Erklärung

Text: ${text}`,
        });
        return (result.text || '').trim();
      }

      // Reine Übersetzung (für Nachträgliches Umschalten der Zielsprache im Ergebnis)
      server.post('/api/translate', async (req, res) => {
        try {
          const { text, translateTo } = req.body;
          if (!text || !text.trim()) return res.status(400).json({ error: 'Kein Text angegeben' });
          if (!translateTo || translateTo === 'none') return res.json({ text });
          const translated = await translateText(text, translateTo);
          res.json({ text: translated, original: text, translatedTo: translateTo });
        } catch (err) {
          log('[Translate] FEHLER: ' + err.message);
          res.status(500).json({ error: err.message });
        }
      });

      // Live-Transkription via schnelles Whisper-base
      server.post('/api/transcribe-live', async (req, res) => {
        try {
          const { audio } = req.body;
          if (!audio) return res.json({ text: '' });
          const text = await whisperTranscribe(Buffer.from(audio, 'base64'));
          res.json({ text });
        } catch (err) {
          log('[TranscribeLive] FEHLER: ' + err.message);
          res.json({ text: '', error: err.message });
        }
      });

      // Finale Transkription via lokales Whisper (+ optionale Übersetzung)
      server.post('/api/transcribe', async (req, res) => {
        try {
          const { audio, translateTo } = req.body;
          if (!audio) return res.status(400).json({ error: 'Kein Audio-Daten erhalten' });

          log('[Transcribe] Anfrage erhalten, Audio-Größe: ' + Math.round(audio.length / 1024) + ' KB');

          const text = await whisperTranscribe(Buffer.from(audio, 'base64'));
          log('[Transcribe] Whisper Text: ' + text.substring(0, 200));

          if (!text || text.length < 2) {
            return res.json({ text: '', feedback: 'Nichts erkannt — bitte lauter/deutlicher sprechen', quality: 'poor' });
          }

          // Optionale Übersetzung — Whisper liefert Deutsch, Gemini übersetzt in die Zielsprache
          if (translateTo && translateTo !== 'none') {
            try {
              const translated = await translateText(text, translateTo);
              log('[Transcribe] Übersetzt (' + translateTo + '): ' + translated.substring(0, 200));
              return res.json({
                text: translated,
                original: text,
                translatedTo: translateTo,
                feedback: 'Übersetzt (' + translateTo + ')',
                quality: 'good',
              });
            } catch (tErr) {
              log('[Transcribe] Übersetzung fehlgeschlagen: ' + tErr.message);
              // Fallback: deutschen Originaltext liefern statt hart zu scheitern
              return res.json({
                text,
                original: text,
                feedback: 'Übersetzung fehlgeschlagen — Original eingefügt',
                quality: 'good',
              });
            }
          }

          res.json({ text, feedback: 'Lokal transkribiert (Whisper)', quality: 'good' });
        } catch (err) {
          log('[Transcribe] FEHLER: ' + err.message);
          res.status(500).json({ error: err.message });
        }
      });

      // Statische Dateien aus dist/ servieren
      const distPath = path.join(__dirname, 'dist');
      server.use(express.static(distPath));
      // Express 5: Wildcard braucht benannten Parameter
      server.get('{*path}', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });

      expressServer = server.listen(SERVER_PORT, '127.0.0.1', () => {
        console.log(`[Server] Running on http://127.0.0.1:${SERVER_PORT}`);
        resolve();
      });

      expressServer.on('error', (err) => {
        console.error('[Server] Port-Fehler:', err.message);
        reject(err);
      });
    } catch (err) {
      console.error('[Server] Start-Fehler:', err);
      reject(err);
    }
  });
}

function stopServer() {
  if (expressServer) {
    expressServer.close();
    expressServer = null;
  }
}

// IPC Handlers
ipcMain.handle('get-app-version', () => APP_VERSION);
ipcMain.handle('get-license-status', () => getLicenseStatus());
ipcMain.handle('activate-license', async (_event, key) => activateLicense(key));
ipcMain.handle('deactivate-license', () => { deactivateLicense(); return { success: true }; });
ipcMain.handle('get-features', () => {
  const status = getLicenseStatus();
  return { ...status, features: getFeatures(status.plan) };
});
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.hide());

ipcMain.handle('insert-global-text', async (_event, text) => {
  // Overlay verstecken
  if (dictationWindow) dictationWindow.hide();

  // Text in Zwischenablage
  clipboard.writeText(text);

  if (process.platform === 'darwin') {
    // Ziel-App aktivieren (falls Overlay den Fokus hatte) → dann Cmd+V
    const targetApp = previousFrontApp;
    const script = targetApp
      ? `tell application "${targetApp}" to activate\ndelay 0.25\ntell application "System Events" to keystroke "v" using command down`
      : `delay 0.3\ntell application "System Events" to keystroke "v" using command down`;

    log(`[InsertText] Paste in: ${targetApp || '(aktuelles Fenster)'}`);
    exec(`osascript -e '${script}'`, (err) => {
      if (err) log('[InsertText] AppleScript Fehler: ' + err.message);
    });
  } else if (IS_WIN) {
    // Windows: Strg+V in die Vordergrund-App senden
    exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 250; [System.Windows.Forms.SendKeys]::SendWait('^v')"`, (err) => {
      if (err) log('[InsertText] Windows-Paste Fehler: ' + err.message);
    });
  } else {
    log('[InsertText] Plattform wird derzeit nicht für auto-paste unterstützt.');
  }

  return { success: true };
});

ipcMain.on('hide-dictation-overlay', () => {
  if (dictationWindow) dictationWindow.hide();
});

// Letzten Diktat-Text speichern (für F1/F2)
ipcMain.on('dictation-result', (_e, { original, optimized }) => {
  if (original) lastOriginalText = original;
  if (optimized) lastOptimizedText = optimized;
  log(`[TTS] Texte gespeichert — Original: ${original?.substring(0,40)}…`);
});

// ElevenLabs TTS: Text → MP3 → afplay
function playElevenLabsTTS(text) {
  if (!text?.trim()) { log('[TTS] Kein Text zum Vorlesen'); return; }
  const http = require('http');
  const fs = require('fs');
  const postData = JSON.stringify({ text: text.trim(), voiceId: ttsVoiceId || undefined });
  const options = {
    hostname: '127.0.0.1',
    port: SERVER_PORT,
    path: '/api/elevenlabs-tts',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  };
  const req = http.request(options, (res) => {
    if (res.statusCode !== 200) { log(`[TTS] Server Fehler: ${res.statusCode}`); return; }
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      const tmpFile = '/tmp/rhetorix_tts.mp3';
      fs.writeFileSync(tmpFile, Buffer.concat(chunks));
      if (IS_WIN) {
        // Windows: MP3 über den Windows Media Player (PowerShell) abspielen
        const ps = `Add-Type -AssemblyName presentationCore; $p=New-Object System.Windows.Media.MediaPlayer; $p.Open([uri]'${tmpFile.replace(/\\/g, '/')}'); $p.Play(); Start-Sleep -Milliseconds 300; while($p.NaturalDuration.HasTimeSpan -eq $false){Start-Sleep -Milliseconds 100}; Start-Sleep -Seconds ([int][math]::Ceiling($p.NaturalDuration.TimeSpan.TotalSeconds)+1)`;
        exec(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, (err) => {
          if (err) log('[TTS] Windows-Playback Fehler: ' + err.message);
          else log('[TTS] Vorlesen abgeschlossen');
        });
      } else {
        exec(`afplay "${tmpFile}"`, (err) => {
          if (err) log('[TTS] afplay Fehler: ' + err.message);
          else log('[TTS] Vorlesen abgeschlossen');
        });
      }
    });
  });
  req.on('error', (err) => log('[TTS] HTTP Fehler: ' + err.message));
  req.write(postData);
  req.end();
}

// Auto-Hide-Timer für das Übersetzungs-Popup
let translationHideTimer = null;

// Master-Schalter: Übersetzer standardmäßig AUS. Wird vom Renderer (Toggle) gesetzt.
let translatorActive = false;
ipcMain.on('set-translator-active', (_e, active) => {
  translatorActive = !!active;
  log('[Übersetzen] Master-Schalter: ' + (translatorActive ? 'AN' : 'AUS'));
});

// Gewählte Vorlese-Stimme (ElevenLabs voiceId). null = Server-Default.
let ttsVoiceId = null;
ipcMain.on('set-tts-voice', (_e, voiceId) => {
  ttsVoiceId = voiceId || null;
  log('[TTS] Vorlese-Stimme gesetzt: ' + (ttsVoiceId || '(Default)'));
});

// F2: markierten Fremdtext aus beliebiger App ins Deutsche übersetzen
// → als Popup im Overlay anzeigen UND vorlesen. Kein Live-Mitlesen fremder Apps,
//   sondern gezielt der markierte Text (Cmd+C wie bei F3).
function translateSelectionToGerman() {
  // 1) Markierten Text kopieren (Cmd/Strg+C simulieren)
  copySelection(() => {
    setTimeout(async () => {
      const src = clipboard.readText();
      if (!src || !src.trim()) { log('[Übersetzen] Kein Text markiert/kopiert'); return; }
      log('[Übersetzen] Quelle: ' + src.substring(0, 80));
      try {
        // 2) Übersetzen via lokalem Server (Gemini) → Deutsch
        const res = await fetch(`http://127.0.0.1:${SERVER_PORT}/api/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: src, translateTo: 'Deutsche' }),
        });
        const data = await res.json();
        const german = (data && data.text) ? data.text : src;
        log('[Übersetzen] Deutsch: ' + german.substring(0, 80));

        // 3a) Popup im Overlay anzeigen
        if (dictationWindow) {
          if (!dictationWindow.isVisible()) dictationWindow.showInactive();
          dictationWindow.webContents.send('show-translation', { text: german, original: src });
          if (translationHideTimer) clearTimeout(translationHideTimer);
          translationHideTimer = setTimeout(() => { if (dictationWindow) dictationWindow.hide(); }, 30000);
        }
        // 3b) Vorlesen (ElevenLabs, multilingual)
        playElevenLabsTTS(german);
      } catch (err) {
        log('[Übersetzen] Fehler: ' + err.message);
      }
    }, 250);
  });
}

// Space global registrieren während Aufnahme läuft
ipcMain.on('dictation-recording-started', () => {
  const ok = globalShortcut.register('Space', () => {
    log('[Dictation] Globale Leertaste → Aufnahme stoppen');
    if (dictationWindow) dictationWindow.webContents.send('global-dictation-stop');
  });
  log(`[Dictation] Globaler Space-Shortcut: ${ok ? 'aktiv' : 'fehlgeschlagen'}`);
});

ipcMain.on('dictation-recording-stopped', () => {
  globalShortcut.unregister('Space');
  log('[Dictation] Globaler Space-Shortcut deregistriert');
});

// App Lifecycle
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  log(`[RhetorixPro] v${APP_VERSION} startet...`);

  // Mikrofon-Permission für Electron erlauben (Web Speech API / getUserMedia)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'audio', 'speech'];
    log(`Permission-Request: ${permission}`);
    if (allowed.includes(permission)) {
      log(`Permission erlaubt: ${permission}`);
      callback(true);
    } else {
      log(`Permission abgelehnt: ${permission}`);
      callback(false);
    }
  });

  // Permission-Check-Handler: Gibt true zurück für alle Media-Permissions
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowed = ['media', 'microphone', 'audioCapture', 'audio', 'speech'];
    log(`Permission-Check: ${permission} → ${allowed.includes(permission) ? 'OK' : 'NEIN'}`);
    return allowed.includes(permission);
  });

  // macOS: System-Mikrofon-Zugriff anfordern
  if (process.platform === 'darwin' && systemPreferences.askForMediaAccess) {
    const micAccess = await systemPreferences.askForMediaAccess('microphone');
    log(`macOS Mikrofon-Zugriff: ${micAccess ? 'erlaubt' : 'verweigert'}`);
  }

  // macOS: Accessibility-Permission prüfen (für globales Paste via AppleScript)
  if (process.platform === 'darwin') {
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    log(`macOS Accessibility: ${isTrusted ? 'erlaubt' : 'NICHT erlaubt'}`);
    if (!isTrusted) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Bedienungshilfen benötigt',
        message: 'Rhetorix Pro braucht die Berechtigung "Bedienungshilfen", um Text in andere Apps einzufügen.',
        detail: 'Bitte erlaube Rhetorix Pro unter:\nSystemeinstellungen → Datenschutz & Sicherheit → Bedienungshilfen',
        buttons: ['Einstellungen öffnen', 'Später'],
      }).then(({ response }) => {
        if (response === 0) {
          // Öffne direkt die Accessibility-Einstellungen
          exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
        }
      });
    }
  }

  // Lizenz prüfen / Trial initialisieren
  const license = initTrial();
  log(`Lizenz: ${license.plan}`);

  // Hermes Bootstrap — Key laden
  await bootstrap();
  log('Hermes bootstrap done');

  // Server starten (in-process)
  try {
    await startServer();
    log(`Server laeuft auf Port ${SERVER_PORT}`);
  } catch (err) {
    log(`Server-Start FEHLER: ${err.message}\n${err.stack}`);
    dialog.showErrorBox('Server-Fehler', `Backend konnte nicht starten: ${err.message}`);
    app.quit();
    return;
  }

  createWindow();
  createDictationWindow();
  createTray();

  // Globalen Shortcut registrieren: Shift+Space
  // 3-Schritt-Flow: 1) Start Aufnahme → 2) Stop/Review → 3) Einfügen
  // Funktioniert systemweit in jeder App
  const SHORTCUT_PRIMARY = 'Shift+Space';
  const SHORTCUT_FALLBACK = 'CommandOrControl+Shift+Space';
  const SHORTCUT_F5 = 'F5';

  function triggerDictation(label) {
    log(`Globaler Shortcut ${label} gedrückt!`);
    if (dictationWindow) {
      if (!dictationWindow.isVisible()) {
        // Aktive App vor Overlay-Öffnen merken (für späteren Paste)
        exec(`osascript -e 'tell application "System Events" to get name of first process where it is frontmost'`, (err, stdout) => {
          if (!err && stdout.trim()) {
            const appName = stdout.trim();
            // Rhetorix selbst nicht speichern
            if (appName !== 'Rhetorix Pro' && appName !== 'Electron') {
              previousFrontApp = appName;
              log(`[Dictation] Ziel-App gespeichert: ${previousFrontApp}`);
            }
          }
        });
        // showInactive() zeigt Overlay OHNE die App zu aktivieren
        // → Hauptfenster bleibt versteckt, Ziel-App behält Fokus
        dictationWindow.showInactive();
      }
      dictationWindow.webContents.send('global-dictation-toggle');
    }
  }

  const ret = globalShortcut.register(SHORTCUT_PRIMARY, () => triggerDictation(SHORTCUT_PRIMARY));
  if (ret) {
    log(`Globaler Shortcut ${SHORTCUT_PRIMARY} erfolgreich registriert.`);
  } else {
    log(`Shortcut ${SHORTCUT_PRIMARY} fehlgeschlagen — versuche Fallback...`);
    const retFallback = globalShortcut.register(SHORTCUT_FALLBACK, () => triggerDictation(SHORTCUT_FALLBACK));
    log(retFallback ? `Fallback ${SHORTCUT_FALLBACK} aktiv.` : 'Auch Fallback fehlgeschlagen.');
  }

  // F5 zusätzlich registrieren (MacBook Mikrofon-Taste)
  const retF5 = globalShortcut.register(SHORTCUT_F5, () => triggerDictation(SHORTCUT_F5));
  log(retF5 ? `F5-Shortcut aktiv.` : `F5-Shortcut fehlgeschlagen (evtl. von macOS belegt).`);

  // F1 → Original-Text vorlesen
  const retF1 = globalShortcut.register('F1', () => {
    log('[TTS] F1 → Original vorlesen');
    if (lastOriginalText) playElevenLabsTTS(lastOriginalText);
    else log('[TTS] Noch kein Diktat-Text vorhanden');
  });
  log(retF1 ? 'F1 (Original TTS) aktiv.' : 'F1 fehlgeschlagen.');

  // F2 → Markierten Fremdtext ins Deutsche übersetzen (Popup + vorlesen)
  // Nur aktiv, wenn der Übersetzer-Master-Schalter an ist.
  const retF2 = globalShortcut.register('F2', () => {
    if (!translatorActive) { log('[Übersetzen] F2 ignoriert — Übersetzer ist AUS'); return; }
    log('[Übersetzen] F2 → markierten Text ins Deutsche übersetzen');
    translateSelectionToGerman();
  });
  log(retF2 ? 'F2 (Übersetzen → Deutsch) aktiv.' : 'F2 fehlgeschlagen.');

  // F3 → Markierten Text aus beliebiger App vorlesen
  const retF3 = globalShortcut.register('F3', () => {
    log('[TTS] F3 → Markierten Text vorlesen');
    // Kopiere markierten Text (Cmd/Strg+C)
    copySelection(() => {
      setTimeout(() => {
        const text = clipboard.readText();
        if (text?.trim()) playElevenLabsTTS(text);
        else log('[TTS] Kein Text markiert/kopiert');
      }, 250);
    });
  });
  log(retF3 ? 'F3 (Markierter Text TTS) aktiv.' : 'F3 fehlgeschlagen.');
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.isQuitting = true;
    app.quit();
  }
});
