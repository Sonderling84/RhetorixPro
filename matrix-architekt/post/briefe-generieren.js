#!/usr/bin/env node
/* Baut aus adressen.csv personalisierte Anschreiben (PDF) und die Beilage (PDF).
   Aufruf:  node briefe-generieren.js [adressen.csv]
   Ausgabe: out/anschreiben-<nr>-<firma>.pdf, out/anschreiben-alle.pdf, out/beilage.pdf
   Braucht: Node 18+ und Playwright (npm i playwright && npx playwright install chromium)
   Absenderdaten unten in ABSENDER eintragen. */
const fs = require('fs'), path = require('path');
const ABSENDER = {
  ABSENDER_ZEILE: 'VIBELINK · Tobias Ganster · [Straße Nr] · [PLZ Ort]',   // <<< eintragen
  KONTAKT_EMAIL: 'kontakt@ganster.tech',                                  // <<< eintragen
  TELEFON: '[Telefon]',                                                   // <<< eintragen
};
const here = __dirname, out = path.join(here, 'out');
fs.mkdirSync(out, { recursive: true });
const iso = fs.readFileSync(path.join(here, 'rohbau-iso.svg'), 'utf8');
const de = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const heute = new Date(), frist = new Date(Date.now() + 21 * 864e5);
function csv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  const head = lines[0].split(',').map(s => s.trim());
  return lines.slice(1).map(l => { const cells = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch; }
    cells.push(cur); return Object.fromEntries(head.map((h, i) => [h, (cells[i] || '').trim()])); });
}
function fill(tpl, row) {
  const v = Object.assign({}, ABSENDER, { ISO: iso, DATUM: de(heute), FRIST: de(frist),
    ANREDE: row.anrede || 'Sehr geehrte Damen und Herren,', NAME: row.name || '', FIRMA: row.firma || '', STRASSE: row.strasse || '', PLZ_ORT: row.plz_ort || '' });
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] || '');
}
const slug = s => (s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)) || 'adresse';
(async () => {
  const { chromium } = require('playwright');
  const rows = csv(fs.readFileSync(process.argv[2] || path.join(here, 'adressen.csv'), 'utf8'));
  const tpl = fs.readFileSync(path.join(here, 'anschreiben.html'), 'utf8');
  const beilage = fill(fs.readFileSync(path.join(here, 'beilage.html'), 'utf8'), {});
  const pages = rows.map(r => fill(tpl, r));
  const browser = await chromium.launch(); const pg = await browser.newPage();
  async function pdf(html, file) {
    const tmp = path.join(here, '_tmp.html'); fs.writeFileSync(tmp, html);
    await pg.goto('file://' + tmp, { waitUntil: 'networkidle' }); await pg.waitForTimeout(300);
    await pg.pdf({ path: file, preferCSSPageSize: true, printBackground: true });
    fs.unlinkSync(tmp);
  }
  for (let i = 0; i < rows.length; i++) await pdf(pages[i], path.join(out, `anschreiben-${String(i + 1).padStart(3, '0')}-${slug(rows[i].firma || '')}.pdf`));
  const bodies = pages.map(h => h.match(/<body>([\s\S]*?)<\/body>/)[1]).join('');
  await pdf(pages[0].replace(/<body>[\s\S]*?<\/body>/, '<body>' + bodies + '</body>'), path.join(out, 'anschreiben-alle.pdf'));
  await pdf(beilage, path.join(out, 'beilage.pdf'));
  await browser.close();
  console.log(`${rows.length} Anschreiben, Sammel-PDF und Beilage in ${out}/`);
})();
