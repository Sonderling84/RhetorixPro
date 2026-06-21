/**
 * Hermes Bootstrap - Holt API-Keys aus Hermes Zentrale
 * Wird VOR dem App-Start ausgeführt
 */

const HERMES_URL = 'http://127.0.0.1:7474';

async function getHermesToken() {
  const res = await fetch(`${HERMES_URL}/api/token/ui`);
  if (!res.ok) throw new Error(`Hermes Token-Endpoint: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function getCredential(token, service, key) {
  const res = await fetch(`${HERMES_URL}/api/credential/${service}/${key}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Hermes Credential ${service}/${key}: ${res.status}`);
  const data = await res.json();
  if (data.error || !data.value) {
    throw new Error(`Hermes: ${data.error || 'Credential nicht gefunden'}`);
  }
  return data.value;
}

async function bootstrap() {
  try {
    const token = await getHermesToken();
    const geminiKey = await getCredential(token, 'Google_AI', 'api_key');
    process.env.GEMINI_API_KEY = geminiKey;
    console.log('[Hermes] Gemini API Key geladen');
    return true;
  } catch (err) {
    console.warn(`[Hermes] Nicht erreichbar: ${err.message}`);
    console.warn('[Hermes] Fallback: Manueller Key-Input oder .env');
    return false;
  }
}

module.exports = { bootstrap, getHermesToken, getCredential };
