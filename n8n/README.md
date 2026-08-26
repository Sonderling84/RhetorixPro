# n8n: Tracking → Google Drive

Dieser Workflow nimmt die Web-Statistik von Rhetorix Pro entgegen (die der
Consent-basierte Tracker sendet) und legt sie als JSON-Dateien in **Google Drive**
ab. So hast du die Daten zentral — unabhängig vom Browser des Besuchers.

Datei: [`rhetorix-tracking-to-drive.json`](rhetorix-tracking-to-drive.json)

## Was der Workflow macht

```
Webhook (POST)  →  Datei vorbereiten (Code)  →  In Google Drive speichern
```

Er versteht **beide** Pakete, die die App schickt:
- laufende Events: `{ "source": "rhetorix-pro", "events": [ … ] }`
- den „In Drive sichern"-Bericht: `{ "source": "rhetorix-pro", "type": "report", "report": { … } }`

Pro Aufruf entsteht eine Datei `rhetorix-events-<Zeit>.json` bzw.
`rhetorix-report-<Zeit>.json`.

## Einrichtung (einmalig)

1. **Importieren:** n8n → *Workflows → Import from File* → diese JSON wählen.
2. **Google Drive verbinden:** den Node **„In Google Drive speichern"** öffnen →
   bei *Credential* dein Google-Drive-Konto verbinden (OAuth). Optional im Node
   einen **Ziel-Ordner** wählen (sonst landet es in „Meine Ablage"). Tipp: vorher
   einen Ordner „Rhetorix Pro Analytics" anlegen.
3. **Aktivieren:** Workflow oben rechts auf **Active** schalten.
4. **Webhook-URL kopieren:** im Webhook-Node die **Production-URL** kopieren, z. B.
   `https://<dein-n8n>/webhook/rhetorix-track`.

## Mit der Seite verbinden

Die öffentliche Seite muss wissen, wohin sie senden soll — über die Build-Variable
**`TRACK_ENDPOINT`**:

- **Repo → Settings → Secrets and variables → Actions → Variables → New variable**
  → Name `TRACK_ENDPOINT`, Wert = deine Webhook-URL von oben.
- Der Deploy-Workflow reicht sie automatisch in den Build (`deploy-pages.yml`).
  Beim nächsten Deploy sendet die Seite dann an n8n.

> Desktop-/Server-Version: braucht das nicht — dort läuft das Tracking über den
> lokalen Server und speichert direkt in Drive.

## Testen (ohne die Seite)

```bash
curl -X POST "https://<dein-n8n>/webhook/rhetorix-track" \
  -H "Content-Type: application/json" \
  -d '{"source":"rhetorix-pro","events":[{"t":"pageview","ts":1756200000000,"p":"/","sid":"s1","vid":"v1"}]}'
```

Danach sollte in Drive eine `rhetorix-events-*.json` auftauchen.

## Hinweise

- **CORS:** Der Webhook ist auf `allowedOrigins: *` gestellt, damit der Browser von
  `github.io` senden darf. Für mehr Kontrolle dort deine Pages-Domain eintragen.
- **Viele kleine Dateien?** Der Tracker bündelt Events; bei viel Traffic kannst du
  im Workflow statt „Datei pro Aufruf" später auf **Google Sheets (Zeilen anhängen)**
  oder eine Datenbank umstellen — sag Bescheid, dann liefere ich die Variante.
- **Datenschutz:** Es kommen nur anonyme, einwilligungsbasierte Daten an (kein Name,
  keine E-Mail) — siehe `TRACKING.md`.
