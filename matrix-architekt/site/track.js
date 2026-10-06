/* First-Party-Tracking mit Opt-in. Keine Cookies, keine Drittanbieter.
   Events gehen erst nach Zustimmung an MA_CONFIG.TRACK_WEBHOOK_URL (n8n). */
(function () {
  var C = window.MA_CONFIG || {};
  var KEY = 'ma_consent';
  var queue = [];
  var sid = null;
  function consent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function sessionId() {
    if (sid) return sid;
    try { sid = sessionStorage.getItem('ma_sid'); if (!sid) { sid = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('ma_sid', sid); } }
    catch (e) { sid = 'na'; }
    return sid;
  }
  function send(ev) {
    if (!C.TRACK_WEBHOOK_URL) { if (window.console) console.log('[track]', ev.event, ev.props || ''); return; }
    var body = JSON.stringify(ev);
    try {
      if (navigator.sendBeacon) { navigator.sendBeacon(C.TRACK_WEBHOOK_URL, new Blob([body], { type: 'application/json' })); return; }
    } catch (e) {}
    try { fetch(C.TRACK_WEBHOOK_URL, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function () {}); } catch (e) {}
  }
  function track(event, props) {
    var ev = { event: event, props: props || {}, page: location.pathname.split('/').pop() || 'index.html', ts: new Date().toISOString(), sid: sessionId() };
    if (consent() === 'yes') send(ev); else if (consent() === null) queue.push(ev);
  }
  window.MA = window.MA || {};
  window.MA.track = track;

  // Automatisch: Klicks auf Elemente mit data-track="event_name" (data-pos als Position)
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (el) track(el.getAttribute('data-track'), { pos: el.getAttribute('data-pos') || '', text: (el.textContent || '').trim().slice(0, 40) });
  });

  // Banner nur, wenn noch nicht entschieden und ein Webhook konfiguriert ist
  function banner() {
    if (consent() !== null || !C.TRACK_WEBHOOK_URL) { if (consent() === null) queue = []; return; }
    var b = document.createElement('div');
    b.id = 'consent';
    b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Statistik-Einwilligung');
    b.innerHTML = '<p>Darf ich zählen, welche Bereiche dieser Seite genutzt werden? Ohne Cookies, ohne Drittanbieter, nur Seitenaufrufe und Klicks. Details in der <a href="datenschutz.html">Datenschutzerklärung</a>.</p>' +
      '<div class="consent-actions"><button type="button" id="consent-yes">Ja, zählen</button><button type="button" id="consent-no">Nein</button></div>';
    document.body.appendChild(b);
    document.getElementById('consent-yes').addEventListener('click', function () { setConsent('yes'); queue.forEach(send); queue = []; b.remove(); });
    document.getElementById('consent-no').addEventListener('click', function () { setConsent('no'); queue = []; b.remove(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();
  track('pageview', { ref: document.referrer ? document.referrer.replace(/^https?:\/\//, '').split('/')[0] : '' });

  // Auf claude.ai: interne Links auf die Artefakt-Adressen umbiegen (Vorschau)
  if (/claude(usercontent)?\.(ai|com)$/.test(location.hostname) && C.ARTIFACTS) {
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
      var h = a.getAttribute('href').split('#')[0].split('?')[0];
      if (C.ARTIFACTS[h]) a.href = C.ARTIFACTS[h];
    });
  }
})();
