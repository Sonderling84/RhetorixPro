const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require('electron');
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

const { bootstrap } = require('./hermes-bootstrap');
const { getLicenseStatus, activateLicense, deactivateLicense, getFeatures, initTrial } = require('./license-manager');
log('Modules loaded');

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

const APP_VERSION = '1.0.0';
const SERVER_PORT = 3847;
const isDev = !app.isPackaged;

let mainWindow = null;
let tray = null;
let expressServer = null;

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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('close', (e) => {
    if (app.isQuitting) return;
    e.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  try {
    tray = new Tray(iconPath);
  } catch {
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    { label: `Rhetorix Pro v${APP_VERSION}`, enabled: false },
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

  tray.setToolTip('Rhetorix Pro');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

function startServer() {
  return new Promise((resolve, reject) => {
    try {
      const express = require('express');
      const cookieParser = require('cookie-parser');

      const server = express();
      server.use(express.json());
      server.use(cookieParser());

      // Gemini API Key Endpoint
      server.get('/api/gemini-key', (req, res) => {
        const key = process.env.GEMINI_API_KEY;
        if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        res.json({ key });
      });

      // Lizenz Endpoint
      server.post('/api/license/validate', async (req, res) => {
        const status = getLicenseStatus();
        res.json({ valid: !status.expired, plan: status.plan, daysLeft: status.daysLeft });
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
  createTray();
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
