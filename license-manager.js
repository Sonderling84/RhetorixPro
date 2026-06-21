/**
 * License Manager — Rhetorix Pro
 * Abo-Modell mit Trial, Monthly, Yearly Plans
 * Validierung gegen Hermes Zentrale / externen Lizenz-Server
 */

const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Lazy — app.getPath() erst nach 'ready' Event verfügbar
function getLicenseFile() {
  return path.join(app.getPath('userData'), 'license.json');
}
const PRODUCT_ID = 'rhetorix-pro';
const TRIAL_DAYS = 14;

// Machine-ID generieren (deterministisch pro Rechner)
function getMachineId() {
  const os = require('os');
  const raw = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || 'unknown'}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
}

// Lizenz-Daten laden
function loadLicense() {
  try {
    if (fs.existsSync(getLicenseFile())) {
      return JSON.parse(fs.readFileSync(getLicenseFile(), 'utf-8'));
    }
  } catch {}
  return null;
}

// Lizenz-Daten speichern
function saveLicense(data) {
  const dir = path.dirname(getLicenseFile());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getLicenseFile(), JSON.stringify(data, null, 2));
}

// Trial starten (beim ersten App-Start)
function initTrial() {
  const existing = loadLicense();
  if (existing) return existing;

  const trialData = {
    plan: 'trial',
    activatedAt: Date.now(),
    expiresAt: Date.now() + (TRIAL_DAYS * 24 * 60 * 60 * 1000),
    machineId: getMachineId(),
    product: PRODUCT_ID,
  };
  saveLicense(trialData);
  return trialData;
}

// Lizenz-Status prüfen
function getLicenseStatus() {
  const license = loadLicense();
  if (!license) {
    return initTrial();
  }

  const now = Date.now();

  // Trial abgelaufen?
  if (license.plan === 'trial' && license.expiresAt && now > license.expiresAt) {
    return { ...license, expired: true, daysLeft: 0 };
  }

  // Abo abgelaufen?
  if (license.expiresAt && now > license.expiresAt) {
    return { ...license, expired: true, daysLeft: 0 };
  }

  const daysLeft = license.expiresAt
    ? Math.ceil((license.expiresAt - now) / (24 * 60 * 60 * 1000))
    : Infinity;

  return { ...license, expired: false, daysLeft };
}

// Online-Validierung gegen Lizenz-Server
async function validateOnline(licenseKey) {
  const machineId = getMachineId();
  const HERMES_URL = process.env.HERMES_URL || 'http://127.0.0.1:7474';

  try {
    const res = await fetch(`${HERMES_URL}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: PRODUCT_ID,
        key: licenseKey,
        machineId,
      }),
    });

    if (!res.ok) {
      return { valid: false, error: `Server: ${res.status}` };
    }

    const data = await res.json();
    if (data.valid) {
      // Lizenz lokal speichern
      saveLicense({
        plan: data.plan || 'pro',
        licenseKey,
        activatedAt: Date.now(),
        expiresAt: data.expiresAt || null,
        machineId,
        product: PRODUCT_ID,
        lastValidated: Date.now(),
      });
    }
    return data;
  } catch (err) {
    return { valid: false, error: 'Server nicht erreichbar', offline: true };
  }
}

// Lizenz-Key aktivieren
async function activateLicense(licenseKey) {
  if (!licenseKey || licenseKey.length < 8) {
    return { valid: false, error: 'Ungültiger Key' };
  }
  return validateOnline(licenseKey);
}

// Lizenz deaktivieren (zurück zu Trial/Expired)
function deactivateLicense() {
  const license = loadLicense();
  if (license) {
    saveLicense({
      plan: 'expired',
      activatedAt: license.activatedAt,
      expiresAt: 0,
      machineId: getMachineId(),
      product: PRODUCT_ID,
    });
  }
}

// Feature-Gating: Welche Features hat der Plan?
function getFeatures(plan) {
  const features = {
    trial: {
      dictation: true,
      trainer: true,
      brainstorm: true,
      maxSessionsPerDay: 5,
      exportPdf: false,
      googleDrive: false,
      gmail: false,
      unlimitedHistory: false,
    },
    pro: {
      dictation: true,
      trainer: true,
      brainstorm: true,
      maxSessionsPerDay: Infinity,
      exportPdf: true,
      googleDrive: true,
      gmail: true,
      unlimitedHistory: true,
    },
    expired: {
      dictation: false,
      trainer: false,
      brainstorm: false,
      maxSessionsPerDay: 0,
      exportPdf: false,
      googleDrive: false,
      gmail: false,
      unlimitedHistory: false,
    },
  };
  return features[plan] || features.expired;
}

module.exports = {
  getMachineId,
  loadLicense,
  saveLicense,
  initTrial,
  getLicenseStatus,
  validateOnline,
  activateLicense,
  deactivateLicense,
  getFeatures,
  PRODUCT_ID,
  TRIAL_DAYS,
};
