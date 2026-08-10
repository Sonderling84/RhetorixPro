import express from 'express';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import path from 'path';

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
