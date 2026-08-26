import express from 'express';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = parseInt(process.env.PORT || '3847', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());
app.use(cookieParser());

// Gemini API Key Endpoint (Frontend holt den Key vom eigenen Server)
app.get('/api/gemini-key', (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  res.json({ key });
});

const getOAuthClient = (req: express.Request) => {
  const config = req.headers['x-google-config'] ? JSON.parse(req.headers['x-google-config'] as string) : {};

  const clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = config.appUrl || process.env.APP_URL || `http://localhost:${PORT}`;

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${appUrl}/auth/google/callback`
  );
};

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/gmail.send'
];

app.get('/api/auth/google/url', (req, res) => {
  try {
    const client = getOAuthClient(req);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    res.json({ url });
  } catch (error) {
    res.status(400).json({ error: 'Invalid configuration' });
  }
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const client = getOAuthClient(req);
    const { tokens } = await client.getToken(code as string);
    res.cookie('google_drive_tokens', JSON.stringify(tokens), {
      httpOnly: true,
      secure: false, // localhost
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Authentication failed.');
  }
});

app.get('/api/auth/google/status', (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  res.json({ isAuthenticated: !!tokens });
});

app.post('/api/drive/folders', async (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  if (!tokens) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = getOAuthClient(req);
    client.setCredentials(JSON.parse(tokens));
    const drive = google.drive({ version: 'v3', auth: client });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name)',
    });
    res.json(response.data.files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list folders' });
  }
});

app.post('/api/drive/create-folder', async (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  const { name } = req.body;
  if (!tokens) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = getOAuthClient(req);
    client.setCredentials(JSON.parse(tokens));
    const drive = google.drive({ version: 'v3', auth: client });
    const response = await drive.files.create({
      requestBody: { name, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id, name',
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

app.post('/api/drive/upload', async (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  const { name, content, folderId } = req.body;
  if (!tokens) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = getOAuthClient(req);
    client.setCredentials(JSON.parse(tokens));
    const drive = google.drive({ version: 'v3', auth: client });
    const response = await drive.files.create({
      requestBody: { name, parents: folderId ? [folderId] : [], mimeType: 'text/plain' },
      media: { mimeType: 'text/plain', body: content },
      fields: 'id, name',
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

app.post('/api/drive/list-files', async (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  const { folderId } = req.body;
  if (!tokens) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = getOAuthClient(req);
    client.setCredentials(JSON.parse(tokens));
    const drive = google.drive({ version: 'v3', auth: client });
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
    });
    res.json(response.data.files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.post('/api/drive/get-file-content', async (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  const { fileId } = req.body;
  if (!tokens) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = getOAuthClient(req);
    client.setCredentials(JSON.parse(tokens));
    const drive = google.drive({ version: 'v3', auth: client });
    const response = await drive.files.get({ fileId, alt: 'media' });
    res.send(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get file content' });
  }
});

app.post('/api/gmail/send', async (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  const { to, subject, body } = req.body;
  if (!tokens) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = getOAuthClient(req);
    client.setCredentials(JSON.parse(tokens));
    const gmail = google.gmail({ version: 'v1', auth: client });

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${to}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      body,
    ];
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Gmail send error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Lizenz-Validierung Endpoint
app.post('/api/license/validate', async (req, res) => {
  const { licenseKey, machineId } = req.body;
  if (!licenseKey) return res.status(400).json({ error: 'No license key' });

  // Validierung gegen Lizenz-Server (Hermes oder externer Service)
  try {
    const hermesUrl = process.env.HERMES_URL || 'http://127.0.0.1:7474';
    const response = await fetch(`${hermesUrl}/api/license/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: 'rhetorix-pro', key: licenseKey, machineId }),
    });
    const data = await response.json();
    res.json(data);
  } catch {
    // Fallback: Offline-Modus — lokale Validierung
    res.json({ valid: true, offline: true, plan: 'trial', expiresAt: null });
  }
});

// ElevenLabs TTS Endpoint
app.post('/api/elevenlabs-tts', async (req, res) => {
  const { text, voiceId = 'EXAVITQu4vr4xnSDxMaL' } = req.body; // Bella (weiblich, multilingual)
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ElevenLabs API Key nicht konfiguriert' });
  if (!text?.trim()) return res.status(400).json({ error: 'Kein Text angegeben' });

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ===========================================================================
// Web-Analytics: Events empfangen, Bericht bauen, in Google Drive sichern
// ===========================================================================

const DATA_DIR = process.env.RX_DATA_DIR || path.join(process.cwd(), 'analytics');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* noop */ }
}

function appendEvents(events: any[]) {
  if (!Array.isArray(events) || events.length === 0) return;
  ensureDataDir();
  const lines = events
    .filter(e => e && typeof e === 'object')
    .map(e => JSON.stringify({ ...e, _recv: Date.now() }))
    .join('\n');
  if (lines) { try { fs.appendFileSync(EVENTS_FILE, lines + '\n'); } catch { /* noop */ } }
}

function readAllEvents(): any[] {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return [];
    return fs.readFileSync(EVENTS_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function buildServerReport() {
  const evts = readAllEvents();
  const byType: Record<string, number> = {};
  const byRoute: Record<string, number> = {};
  const byClick: Record<string, number> = {};
  const sessions = new Set<string>();
  const visitors = new Set<string>();
  let first = Infinity, last = 0;
  for (const e of evts) {
    byType[e.t] = (byType[e.t] || 0) + 1;
    if (e.sid) sessions.add(e.sid);
    if (e.vid) visitors.add(e.vid);
    if (typeof e.ts === 'number') { if (e.ts < first) first = e.ts; if (e.ts > last) last = e.ts; }
    if (e.t === 'pageview' && e.p) byRoute[e.p] = (byRoute[e.p] || 0) + 1;
    if (e.t === 'click') { const l = String(e.props?.label || '?'); byClick[l] = (byClick[l] || 0) + 1; }
  }
  const top = (o: Record<string, number>, n = 20) =>
    Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));
  return {
    product: 'Rhetorix Pro',
    generatedAt: new Date().toISOString(),
    range: { from: first === Infinity ? null : new Date(first).toISOString(), to: last ? new Date(last).toISOString() : null },
    totals: {
      events: evts.length, sessions: sessions.size, visitors: visitors.size,
      pageviews: byType['pageview'] || 0, clicks: byType['click'] || 0, logins: byType['login'] || 0,
    },
    eventsByType: byType, topRoutes: top(byRoute), topClicks: top(byClick),
  };
}

// Leichtes CORS für die Analytics-Routen (falls eine gehostete Frontend-Seite
// an einen selbst-gehosteten Server sendet).
app.use('/api/track', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.post('/api/track', (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events
    : (req.body && req.body.t ? [req.body] : []);
  appendEvents(events);
  res.sendStatus(204);
});

app.get('/api/analytics/report', (_req, res) => {
  res.json(buildServerReport());
});

app.post('/api/analytics/save-drive', async (req, res) => {
  const tokens = req.cookies.google_drive_tokens;
  if (!tokens) return res.status(401).json({ error: 'Google Drive nicht verbunden' });

  const report = req.body?.report && typeof req.body.report === 'object'
    ? req.body.report
    : buildServerReport();

  try {
    const client = getOAuthClient(req);
    client.setCredentials(JSON.parse(tokens));
    const drive = google.drive({ version: 'v3', auth: client });

    // Ziel-Ordner finden oder anlegen
    const folderName = 'Rhetorix Pro Analytics';
    let folderId: string | undefined;
    const found = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
      fields: 'files(id, name)',
    });
    folderId = found.data.files?.[0]?.id || undefined;
    if (!folderId) {
      const created = await drive.files.create({
        requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
      });
      folderId = created.data.id || undefined;
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const fileName = `rhetorix-report-${stamp}.json`;
    const uploaded = await drive.files.create({
      requestBody: { name: fileName, parents: folderId ? [folderId] : [], mimeType: 'application/json' },
      media: { mimeType: 'application/json', body: JSON.stringify(report, null, 2) },
      fields: 'id, name, webViewLink',
    });
    res.json({ id: uploaded.data.id, name: uploaded.data.name, webViewLink: uploaded.data.webViewLink });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Upload fehlgeschlagen' });
  }
});

// Production: Statische Dateien servieren
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Nur starten wenn direkt aufgerufen (nicht als Modul importiert)
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
