/**
 * webAnalytics.ts — First-Party Web-Tracking für Rhetorix Pro
 * ------------------------------------------------------------
 * Erfasst Seitenaufrufe (Hash-Routen), Klicks, Sessions und eigene Events
 * komplett selbst — ohne Google Analytics, ohne Fremd-Cookies.
 *
 * Daten fließen (in dieser Reihenfolge, je nach Umgebung):
 *   1. lokaler Puffer im localStorage (immer)  → Bericht als JSON abrufbar
 *   2. optional per POST an einen Endpoint:
 *        - konfiguriert via TRACK_ENDPOINT (z. B. n8n-Webhook) → n8n legt in
 *          Google Drive / "Second Brain" ab
 *        - sonst same-origin /api/track (Desktop-/Server-Modus)
 *
 * Datenschutz: keine Formular-/Eingabeinhalte, keine E-Mail/Namen, nur
 * anonyme IDs. Opt-out jederzeit möglich (Einstellungen).
 * Auf der statischen GitHub-Pages-Seite ist für DSGVO-Konformität ein
 * Consent-Banner sinnvoll — siehe TRACKING.md.
 */

type Props = Record<string, unknown>;

interface RxEvent {
  t: string;          // event type/name
  ts: number;         // timestamp (ms)
  p?: string;         // path (hash route)
  ref?: string;       // referrer (nur session_start)
  props?: Props;      // zusätzliche Daten
  sid: string;        // session id
  vid: string;        // visitor id (anonym)
}

const K = {
  events: 'rx_evts',
  session: 'rx_sess',
  visitor: 'rx_vid',
  optout: 'rx_track_off',
} as const;

const MAX_EVENTS = 3000;        // rollierender Puffer
const SESSION_GAP = 30 * 60_000; // 30 min Inaktivität = neue Session
const FLUSH_SIZE = 8;
const FLUSH_MS = 12_000;

// ---- Utils ---------------------------------------------------------------

const now = () => Date.now();

function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  } catch { /* noop */ }
  return 'x' + Math.random().toString(36).slice(2) + now().toString(36);
}

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch { /* Speicher voll / privat */ }
}

function isOptedOut(): boolean {
  return lsGet(K.optout) === '1';
}

function currentPath(): string {
  // HashRouter: alles nach dem # ist die Route; Query strippen
  const h = (location.hash || '').replace(/^#/, '') || '/';
  return h.split('?')[0].slice(0, 200);
}

function isStaticHost(): boolean {
  try { return /github\.io$/i.test(location.hostname); } catch { return false; }
}

function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

function resolveEndpoint(): string {
  // 1) explizit konfiguriert (Build-Zeit oder Laufzeit)
  let configured = '';
  try {
    // via vite define ersetzt; sonst zur Laufzeit setzbar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    configured = ((typeof process !== 'undefined' && (process as any).env && (process as any).env.TRACK_ENDPOINT) as string) || '';
  } catch { /* noop */ }
  const runtime = (typeof window !== 'undefined' && (window as any).__RX_TRACK_ENDPOINT__) || '';
  if (configured) return configured;
  if (runtime) return runtime;
  // 2) statische Seite ohne Backend → nur lokal puffern
  if (isStaticHost()) return '';
  // 3) Desktop/Server: same-origin
  return '/api/track';
}

// ---- Session / Visitor ---------------------------------------------------

function visitorId(): string {
  let v = lsGet(K.visitor);
  if (!v) { v = uid(); lsSet(K.visitor, v); }
  return v;
}

interface Session { id: string; start: number; last: number; }

function getSession(): { session: Session; isNew: boolean } {
  const raw = lsGet(K.session);
  const t = now();
  if (raw) {
    try {
      const s = JSON.parse(raw) as Session;
      if (s && s.id && t - s.last < SESSION_GAP) {
        s.last = t;
        lsSet(K.session, JSON.stringify(s));
        return { session: s, isNew: false };
      }
    } catch { /* fällt durch zu neuer Session */ }
  }
  const s: Session = { id: uid(), start: t, last: t };
  lsSet(K.session, JSON.stringify(s));
  return { session: s, isNew: true };
}

// ---- Event-Puffer --------------------------------------------------------

function readEvents(): RxEvent[] {
  const raw = lsGet(K.events);
  if (!raw) return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}
function writeEvents(evts: RxEvent[]): void {
  const trimmed = evts.length > MAX_EVENTS ? evts.slice(evts.length - MAX_EVENTS) : evts;
  lsSet(K.events, JSON.stringify(trimmed));
}

// ---- Sende-Warteschlange -------------------------------------------------

let queue: RxEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flush(false); }, FLUSH_MS);
}

function flush(useBeacon: boolean): void {
  const endpoint = resolveEndpoint();
  if (!endpoint || queue.length === 0) { queue = []; return; }
  const batch = queue;
  queue = [];
  const body = JSON.stringify({ source: 'rhetorix-pro', events: batch });
  try {
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(endpoint, blob);
      if (!ok) queue = batch.concat(queue); // zurücklegen, später erneut
      return;
    }
  } catch { /* fällt zu fetch */ }
  try {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: isStaticHost() ? 'omit' : 'same-origin',
    }).catch(() => { /* offline / kein Backend: egal, liegt lokal */ });
  } catch { /* noop */ }
}

// ---- Kern: Event aufnehmen ----------------------------------------------

function record(type: string, props?: Props, extra?: Partial<RxEvent>): void {
  if (isOptedOut()) return;
  try {
    const { session } = getSession();
    const ev: RxEvent = {
      t: type,
      ts: now(),
      p: currentPath(),
      sid: session.id,
      vid: visitorId(),
      ...(props ? { props } : {}),
      ...extra,
    };
    const all = readEvents();
    all.push(ev);
    writeEvents(all);
    queue.push(ev);
    if (queue.length >= FLUSH_SIZE) flush(false);
    else scheduleFlush();
  } catch { /* niemals die App crashen lassen */ }
}

// ---- Auto-Instrumentierung ----------------------------------------------

function describeTarget(el: Element | null): { label: string; kind: string } | null {
  let node: Element | null = el;
  for (let i = 0; node && i < 4; i++) {
    const dt = node.getAttribute?.('data-track');
    if (dt) return { label: dt.slice(0, 120), kind: 'data-track' };
    const tag = node.tagName?.toLowerCase();
    if (tag === 'button' || tag === 'a' || node.getAttribute?.('role') === 'button') {
      const label =
        node.getAttribute?.('aria-label') ||
        node.getAttribute?.('title') ||
        (node.textContent || '').trim().replace(/\s+/g, ' ') ||
        node.getAttribute?.('href') ||
        tag;
      return { label: (label || tag).slice(0, 120), kind: tag };
    }
    node = node.parentElement;
  }
  return null;
}

let lastPath = '';
function trackPageview(): void {
  const p = currentPath();
  if (p === lastPath) return;
  lastPath = p;
  record('pageview', { title: (document.title || '').slice(0, 160) });
}

let wired = false;
function wire(): void {
  if (wired) return;
  wired = true;

  // Seitenaufrufe (HashRouter feuert hashchange)
  window.addEventListener('hashchange', trackPageview, { passive: true } as any);

  // Klicks (Capture-Phase, damit auch gestoppte Events erfasst werden)
  window.addEventListener('click', (e) => {
    if (isOptedOut()) return;
    const info = describeTarget(e.target as Element);
    if (info) record('click', { label: info.label, kind: info.kind });
  }, true);

  // "Anmeldung": Google-Login-Erfolg (vom Server per postMessage gemeldet)
  window.addEventListener('message', (e) => {
    if (e?.data?.type === 'GOOGLE_AUTH_SUCCESS') record('login', { provider: 'google' });
  });

  // Beim Verlassen/Verstecken: Rest senden
  const finalFlush = () => flush(true);
  window.addEventListener('pagehide', finalFlush);
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') finalFlush(); });
  window.addEventListener('beforeunload', finalFlush);
}

// ---- Öffentliche API -----------------------------------------------------

export function initWebAnalytics(): void {
  try {
    if (typeof window === 'undefined') return;
    wire();
    const { isNew } = getSession();
    if (isNew) {
      record('session_start', {
        referrer: (document.referrer || '').slice(0, 200),
        lang: navigator.language,
        screen: `${screen.width}x${screen.height}`,
        ua: navigator.userAgent.slice(0, 200),
        mode: isDesktop() ? 'desktop' : (isStaticHost() ? 'web-static' : 'web'),
      });
    }
    lastPath = '';
    trackPageview();
  } catch { /* noop */ }
}

/** Eigenes Event feuern, z. B. track('license_activate', { plan }) */
export function track(name: string, props?: Props): void {
  record(String(name).slice(0, 60), props);
}

export function setTrackingEnabled(enabled: boolean): void {
  if (enabled) { try { localStorage.removeItem(K.optout); } catch { /* noop */ } }
  else lsSet(K.optout, '1');
}
export function trackingEnabled(): boolean { return !isOptedOut(); }

/** Aggregierter Bericht aus dem lokalen Puffer. */
export function buildReport(): Record<string, unknown> {
  const evts = readEvents();
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
    if (e.ts < first) first = e.ts;
    if (e.ts > last) last = e.ts;
    if (e.t === 'pageview' && e.p) byRoute[e.p] = (byRoute[e.p] || 0) + 1;
    if (e.t === 'click') {
      const lbl = String((e.props?.label as string) || '?');
      byClick[lbl] = (byClick[lbl] || 0) + 1;
    }
  }
  const sortTop = (o: Record<string, number>, n = 20) =>
    Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, count: v }));

  return {
    product: 'Rhetorix Pro',
    generatedAt: new Date().toISOString(),
    range: {
      from: first === Infinity ? null : new Date(first).toISOString(),
      to: last ? new Date(last).toISOString() : null,
    },
    totals: {
      events: evts.length,
      sessions: sessions.size,
      visitors: visitors.size,
      pageviews: byType['pageview'] || 0,
      clicks: byType['click'] || 0,
      logins: byType['login'] || 0,
    },
    eventsByType: byType,
    topRoutes: sortTop(byRoute),
    topClicks: sortTop(byClick),
  };
}

/** Bericht als JSON-Datei herunterladen. */
export function downloadReport(): void {
  try {
    const report = buildReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `rhetorix-analytics-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { /* noop */ }
}

/**
 * Bericht sichern: im Desktop-/Server-Modus in Google Drive (nutzt die
 * bestehende Drive-Anbindung des Servers). Fällt sonst auf einen konfigurierten
 * Endpoint (n8n) bzw. den Download zurück.
 */
export async function saveReport(): Promise<{ ok: boolean; where: string; detail?: string }> {
  const report = buildReport();
  // 1) Server → Google Drive
  try {
    const res = await fetch('/api/analytics/save-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, where: 'google-drive', detail: data?.name || data?.id };
    }
  } catch { /* kein Server erreichbar */ }
  // 2) konfigurierter Endpoint (n8n)
  const endpoint = resolveEndpoint();
  if (endpoint && endpoint !== '/api/track') {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'rhetorix-pro', type: 'report', report }),
      });
      if (res.ok) return { ok: true, where: 'endpoint' };
    } catch { /* noop */ }
  }
  // 3) Fallback: Download
  downloadReport();
  return { ok: false, where: 'download', detail: 'Kein Backend erreichbar — Bericht wurde heruntergeladen.' };
}

// Bequemer Zugriff aus der Konsole / aus Komponenten
try {
  if (typeof window !== 'undefined') {
    (window as any).RhetorixTracker = {
      track, buildReport, downloadReport, saveReport,
      setEnabled: setTrackingEnabled, enabled: trackingEnabled,
    };
  }
} catch { /* noop */ }
