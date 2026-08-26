/**
 * webAnalytics.ts — First-Party Web-Tracking für Rhetorix Pro
 * ------------------------------------------------------------
 * Erfasst Seitenaufrufe (Hash-Routen), Klicks, Sessions und eigene Events
 * komplett selbst — ohne Google Analytics, ohne Fremd-Cookies.
 *
 * DSGVO / Consent (Opt-in):
 *   Tracking ist standardmäßig AUS. Es wird erst erfasst & gesendet, wenn der
 *   Nutzer im schlanken Consent-Banner zustimmt (rx_consent = 'granted').
 *   Ablehnen (oder in den Einstellungen deaktivieren) = 'denied' → nichts.
 *
 * Datenfluss (je nach Umgebung):
 *   1. lokaler Puffer im localStorage (immer, wenn zugestimmt) → JSON-Bericht
 *   2. optional per POST an einen Endpoint:
 *        - TRACK_ENDPOINT (z. B. n8n-Webhook) → n8n legt in Drive/"Second Brain" ab
 *        - sonst same-origin /api/track (Desktop-/Server-Modus)
 *
 * Es werden keine Formular-/Eingabeinhalte, keine Namen/E-Mails erfasst,
 * nur anonyme IDs.
 */

type Props = Record<string, unknown>;

interface RxEvent {
  t: string;          // event type/name
  ts: number;         // timestamp (ms)
  p?: string;         // path (hash route)
  props?: Props;      // zusätzliche Daten
  sid: string;        // session id
  vid: string;        // visitor id (anonym)
}

const K = {
  events: 'rx_evts',
  session: 'rx_sess',
  visitor: 'rx_vid',
  consent: 'rx_consent', // 'granted' | 'denied' | (fehlt = noch nicht entschieden)
} as const;

const MAX_EVENTS = 3000;
const SESSION_GAP = 30 * 60_000;
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

// ---- Consent -------------------------------------------------------------

function getConsent(): 'granted' | 'denied' | null {
  const v = lsGet(K.consent);
  return v === 'granted' || v === 'denied' ? v : null;
}
/** Tracking ist nur aktiv, wenn ausdrücklich zugestimmt wurde. */
function isActive(): boolean {
  return getConsent() === 'granted';
}

function currentPath(): string {
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
  let configured = '';
  try {
    configured = ((typeof process !== 'undefined' && (process as any).env && (process as any).env.TRACK_ENDPOINT) as string) || '';
  } catch { /* noop */ }
  const runtime = (typeof window !== 'undefined' && (window as any).__RX_TRACK_ENDPOINT__) || '';
  if (configured) return configured;
  if (runtime) return runtime;
  if (isStaticHost()) return '';   // statische Seite ohne Backend → nur lokal
  return '/api/track';             // Desktop/Server
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
    } catch { /* neue Session */ }
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
      if (!ok) queue = batch.concat(queue);
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

function record(type: string, props?: Props): void {
  if (!isActive()) return; // ohne Zustimmung: nichts erfassen/senden
  try {
    const { session } = getSession();
    const ev: RxEvent = {
      t: type,
      ts: now(),
      p: currentPath(),
      sid: session.id,
      vid: visitorId(),
      ...(props ? { props } : {}),
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
  window.addEventListener('hashchange', trackPageview, { passive: true } as any);
  window.addEventListener('click', (e) => {
    if (!isActive()) return;
    const info = describeTarget(e.target as Element);
    if (info) record('click', { label: info.label, kind: info.kind });
  }, true);
  window.addEventListener('message', (e) => {
    if (e?.data?.type === 'GOOGLE_AUTH_SUCCESS') record('login', { provider: 'google' });
  });
  const finalFlush = () => flush(true);
  window.addEventListener('pagehide', finalFlush);
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') finalFlush(); });
  window.addEventListener('beforeunload', finalFlush);
}

let started = false;
/** Startet die Erfassung (session_start + erster pageview). Idempotent pro Load. */
function startTracking(): void {
  if (started || !isActive()) return;
  started = true;
  try {
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

// ---- Consent-Banner (schlank, vanilla, dark-aware) ----------------------

function removeBanner(): void {
  try { document.getElementById('rx-consent')?.remove(); } catch { /* noop */ }
}

function showConsentBanner(): void {
  try {
    if (typeof document === 'undefined') return;
    if (getConsent() !== null) return;          // schon entschieden
    if (document.getElementById('rx-consent')) return;

    const dark = document.documentElement.classList.contains('dark');
    const reduce = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const c = dark
      ? { bg: '#0f172a', bd: '#1e293b', tx: '#e2e8f0', sub: '#94a3b8', ghostTx: '#cbd5e1', ghostBd: '#334155' }
      : { bg: '#ffffff', bd: '#e5e7eb', tx: '#0f172a', sub: '#64748b', ghostTx: '#334155', ghostBd: '#e5e7eb' };

    const wrap = document.createElement('div');
    wrap.id = 'rx-consent';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Einwilligung zur anonymen Statistik');
    wrap.style.cssText = [
      'position:fixed', 'left:12px', 'right:12px', 'bottom:12px', 'z-index:2147483000',
      'margin:0 auto', 'max-width:640px',
      'display:flex', 'flex-wrap:wrap', 'align-items:center', 'gap:12px',
      `background:${c.bg}`, `border:1px solid ${c.bd}`, 'border-radius:16px',
      'padding:14px 16px', 'box-shadow:0 12px 40px rgba(0,0,0,.28)',
      `color:${c.tx}`,
      'font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif', 'font-size:13px', 'line-height:1.45',
      reduce ? '' : 'animation:rxSlideUp .35s ease',
    ].join(';');

    const text = document.createElement('div');
    text.style.cssText = 'flex:1 1 260px;min-width:220px';
    text.innerHTML =
      `<strong style="display:block;font-size:13px;font-weight:800;letter-spacing:.02em">Anonyme Statistik</strong>` +
      `<span style="color:${c.sub};font-weight:500">Wir zählen anonym Seitenaufrufe &amp; Klicks, um Rhetorix Pro zu verbessern — ohne Fremd-Cookies, ohne Google Analytics. ` +
      `<a href="#/datenschutz" style="color:#3b82f6;text-decoration:underline;font-weight:600">Mehr</a></span>`;

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:8px;flex:0 0 auto;margin-left:auto';

    const mkBtn = (label: string, primary: boolean) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = [
        'cursor:pointer', 'border-radius:10px', 'padding:10px 16px',
        'font-family:inherit', 'font-size:12px', 'font-weight:800',
        'letter-spacing:.03em', 'transition:filter .15s', 'white-space:nowrap',
      ].join(';');
      // Mit !important gegen globale "html.dark button"-Regeln der App durchsetzen
      b.style.setProperty('background', primary ? '#2563eb' : 'transparent', 'important');
      b.style.setProperty('color', primary ? '#ffffff' : c.ghostTx, 'important');
      b.style.setProperty('border', `1px solid ${primary ? '#2563eb' : c.ghostBd}`, 'important');
      b.onmouseenter = () => { b.style.filter = 'brightness(1.08)'; };
      b.onmouseleave = () => { b.style.filter = 'none'; };
      return b;
    };

    const deny = mkBtn('Ablehnen', false);
    const accept = mkBtn('Einverstanden', true);
    deny.addEventListener('click', () => setConsent(false));
    accept.addEventListener('click', () => setConsent(true));

    btns.appendChild(deny);
    btns.appendChild(accept);
    wrap.appendChild(text);
    wrap.appendChild(btns);

    if (!reduce && !document.getElementById('rx-consent-style')) {
      const st = document.createElement('style');
      st.id = 'rx-consent-style';
      st.textContent = '@keyframes rxSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}';
      document.head.appendChild(st);
    }

    const mount = () => { document.body.appendChild(wrap); try { accept.focus(); } catch { /* noop */ } };
    if (document.body) mount();
    else window.addEventListener('DOMContentLoaded', mount, { once: true });
  } catch { /* Banner ist optional — nie die App blockieren */ }
}

// ---- Öffentliche API -----------------------------------------------------

export function initWebAnalytics(): void {
  try {
    if (typeof window === 'undefined') return;
    wire(); // Listener immer verdrahten; sie erfassen erst nach Zustimmung
    if (isActive()) startTracking();
    else if (getConsent() === null) showConsentBanner();
  } catch { /* noop */ }
}

/** Zustimmung setzen (true = erlauben → Tracking startet sofort, false = ablehnen). */
export function setConsent(granted: boolean): void {
  lsSet(K.consent, granted ? 'granted' : 'denied');
  removeBanner();
  if (granted) startTracking();
}

/** Eigenes Event feuern, z. B. track('license_activate', { plan }) */
export function track(name: string, props?: Props): void {
  record(String(name).slice(0, 60), props);
}

// Kompatible Namen für die Einstellungen (Toggle = Zustimmung an/aus)
export function setTrackingEnabled(enabled: boolean): void { setConsent(enabled); }
export function trackingEnabled(): boolean { return isActive(); }
/** Consent-Status für die UI: 'granted' | 'denied' | null (noch offen). */
export function consentStatus(): 'granted' | 'denied' | null { return getConsent(); }

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
 * Bericht sichern: Desktop-/Server-Modus → Google Drive (bestehende Anbindung).
 * Sonst → konfigurierter Endpoint (n8n) bzw. Download.
 */
export async function saveReport(): Promise<{ ok: boolean; where: string; detail?: string }> {
  const report = buildReport();
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
  downloadReport();
  return { ok: false, where: 'download', detail: 'Kein Backend erreichbar — Bericht wurde heruntergeladen.' };
}

// Bequemer Zugriff aus der Konsole / aus Komponenten
try {
  if (typeof window !== 'undefined') {
    (window as any).RhetorixTracker = {
      track, buildReport, downloadReport, saveReport,
      setConsent, consentStatus,
      setEnabled: setTrackingEnabled, enabled: trackingEnabled,
    };
  }
} catch { /* noop */ }
