# Web-Tracking & Statistik — Rhetorix Pro

Rhetorix Pro erfasst Nutzungsdaten **selbst** (First-Party), ohne Google Analytics
und ohne Fremd-Cookies. Modul: [`utils/webAnalytics.ts`](utils/webAnalytics.ts),
initialisiert in [`index.tsx`](index.tsx).

## Was wird erfasst?

| Event | Wann | Felder |
|---|---|---|
| `session_start` | Erster Aufruf / nach 30 min Pause | Referrer, Sprache, Bildschirm, grober User-Agent, Modus |
| `pageview` | Beim Laden + jedem Routenwechsel (`#/…`) | Route, Titel |
| `click` | Klick auf Button / Link / `[data-track]` | Label (Text/aria-label), Element-Typ |
| `login` | Google-Login erfolgreich | Provider |
| *eigene* | `track('name', {...})` | frei |

**Nicht** erfasst: Eingabe-/Formularinhalte, Namen, E-Mails, Passwörter, keine
Genauigkeit über das oben Genannte hinaus. IDs (`sid` Session, `vid` Besucher)
sind zufällig und anonym.

## Wohin fließen die Daten? (3 Wege, automatisch gewählt)

1. **Immer:** lokaler Puffer im Browser (`localStorage`, rollierend max. 3000 Events).
   Daraus wird jederzeit der JSON-Bericht gebaut.
2. **Desktop-/Server-Version:** POST an `/api/track` → Server schreibt nach
   `analytics/events.jsonl`. Bericht speicherbar direkt in **Google Drive**
   (nutzt die vorhandene Drive-Anbindung).
3. **Öffentliche Web-Seite (GitHub Pages, statisch):** optional POST an einen
   **`TRACK_ENDPOINT`** (z. B. **n8n-Webhook**) → n8n legt die Daten ab, wo du
   willst (Google Drive, „Second Brain", Datenbank …).

## Bericht abrufen & sichern

- **In der App:** *Einstellungen → Statistik & Datenschutz* →
  „JSON-Bericht" (Download) bzw. „In Drive sichern".
- **Server-API:** `GET http://127.0.0.1:3847/api/analytics/report`
- **Konsole:** `RhetorixTracker.buildReport()` · `RhetorixTracker.downloadReport()` ·
  `await RhetorixTracker.saveReport()`

Der Bericht ist aggregiert: Gesamtzahlen (Sessions, Besucher, Seitenaufrufe,
Klicks, Logins), Events pro Typ, Top-Routen und Top-Klicks.

## n8n anbinden (für die öffentliche Seite)

1. In n8n einen **Webhook-Node** anlegen (POST), URL kopieren.
2. Beim Build setzen: `TRACK_ENDPOINT=https://<dein-n8n>/webhook/rhetorix`
   (lokal in `.env`, in GitHub Actions als Repo-Variable/Secret).
   Der Wert wird über `vite.config.ts` in den Build eingebaut.
3. Im Webhook-Node **CORS** für die Pages-Domain erlauben
   (`https://sonderling84.github.io`).
4. Dahinter z. B. einen **Google-Drive-Node** hängen → Datei anlegen/anhängen.

Der Client sendet gebündelt (`{ source, events: [...] }`), beim Verlassen der
Seite zusätzlich per `sendBeacon`. „In Drive sichern" schickt außerdem
`{ source, type:'report', report }` an denselben Endpoint.

## Eigene Events feuern

```ts
import { track } from './utils/webAnalytics';
track('license_activate', { plan: 'pro' });
// oder aus jeder Komponente/Konsole:
window.RhetorixTracker.track('cta_click', { id: 'preis' });
```

Oder ganz ohne Code: einem Element `data-track="Mein Label"` geben — der Klick
wird automatisch mit diesem Label erfasst.

## Datenschutz (DSGVO)

- Opt-out jederzeit in den Einstellungen (`localStorage` `rx_track_off`).
- Daten bleiben **first-party** und fließen nur an deine eigene Infrastruktur
  (Server/Drive/n8n) — nicht an Dritte.
- **Hinweis:** Für die öffentliche Web-Seite in der EU ist trotz anonymer Daten
  in der Regel ein **Consent-Banner** + Datenschutzerklärung nötig, sobald Daten
  an einen Server gesendet werden. Das ist hier bewusst schlank gehalten; ein
  Consent-Gate lässt sich vor `initWebAnalytics()` schalten. Rechtlich final bitte
  prüfen (lassen).
