# n8n-Diagnose — n8n.srv1540535.hstgr.cloud

_Stand: 2026-08-26 · erstellt via n8n REST-API (Key „CLAUDE-CODE")_

## Server
- ✅ Erreichbar (HTTP 200, ~0,8 s), `/healthz` = ok, Auth = E-Mail/Passwort
- **33 Workflows** insgesamt (13 aktiv / 20 aus) — Dashboard zeigte nur 6
- „0 Produktionsausführungen" auf dem Dashboard war **irreführend** — echte Executions laufen bis #13716

## Aktuelle Fehler (aus Execution-Historie)
| Workflow | Node | Fehler | Ursache |
|---|---|---|---|
| **App-Werbung** (täglich 10:00) | App-Post (Telegram) | `Bad Request: wrong file identifier/HTTP URL` (400) | Bild-URL/File-ID ungültig |
| **Twitch/Kick → Telegram** | Live-Post (Telegram) | `Bad Request: wrong file identifier/HTTP URL` (400) | Bild-URL/File-ID ungültig |
| **Blog-Autopilot** | Ollama Model | `fetch failed / other side closed` | **Ollama-Server down** |
| **VibeLink – Mail-Strecke** | Mail an mich (Gmail) | `refresh token invalid/expired` | **Gmail-OAuth neu verbinden** |

## Workflows ohne Trigger (können NIE automatisch laufen)
- „NASCAR Bilder Daily Poster – Hermes Integration"
- „[CIS] Ingest – Skool (E-Mail Parse)"

---

## Fokus: E-Mail-Workflows

### „Email Agend" (AKTIV, id=hhpeG06PXJidf3pU)
**Was er tut:** Gmail-Trigger (pollt jede Minute) → **AI Text Classifier** ordnet jede neue Mail
GENAU EINER von 16 Kategorien zu → passendes **Gmail-Label** wird gesetzt.

Kategorien: BusinessMails, GefaehrlichSpam, HomepageBlogNewsletter, Kunst, Marketing, Muell,
Newsletter, PinterestLinkedIn, RechnungenAmazon, RechnungenMahnungen, SocialMedia, TikTokCapcut,
TwitchDiscordKick, undefiniert, wichtigeEmails, youtube.

**🐞 Bug 1 — falsches Eingabefeld (kritisch):**
Der Classifier bekommt als `inputText`:
```
={{ $json.name }}
```
Der Gmail-Trigger liefert aber **kein Feld `name`** → der Classifier bekommt **leeren Text** →
klassifiziert ins Blaue / schlägt fehl. **Muss** auf Betreff + Snippet zeigen, z. B.:
```
=Betreff: {{ $json.subject || $json.Subject }}
Von: {{ $json.from || $json.From }}
Inhalt: {{ $json.snippet || $json.textPlain || $json.text }}
```

**🐞 Bug 2 — Classifier-LLM = Ollama (aktuell down):**
Der „Text Classifier" hängt am **Ollama Model (llama3.2:3b, „Ollama VPS")**. Ollama ist derzeit
nicht erreichbar (siehe Blog-Autopilot-Fehler). → Empfehlung: auf **Google Gemini** umstellen
(Credential „Google Gemini(PaLM) Api account" ist vorhanden — der andere Email-Workflow nutzt es
bereits). Gemini als Hosted-API ist deutlich stabiler als self-hosted Ollama.

**Status:** 0 gespeicherte Executions → seit Aktivierung kam entweder keine neue Mail, oder er
scheiterte still (passt zu Bug 1/2).

**Kleinere Punkte:**
- `RechnungenAmazon` und `RechnungenMahnungen` haben **identische Beschreibung** (Copy-Paste) →
  Classifier kann sie nicht sauber trennen.
- 16 Kategorien, aber 17 Label-Nodes → 1 Label wird nie sauber angesteuert.

### „Email Agend" (AUS, id=swZK1AtEHpMixFdW) — NICHT einfach löschen!
Ist **kein sauberes Duplikat**. Enthält zusätzlich eine **eigene CIS/Obsidian-Pipeline**
(Webhook → Obsidian-Markdown bauen → Obsidian REST API → High-Score-Filter → Daily Digest),
die im aktiven Workflow **nicht** existiert. Der Mail-Teil nutzt hier **Google Gemini** statt Ollama.
→ Vor dem Löschen: Obsidian-Teil sichern oder in eigenen Workflow auslagern.

---

## Empfohlene nächste Schritte
1. **Email Agend (aktiv):** `inputText` fixen (`$json.name` → Betreff/Snippet) + Classifier auf Gemini umstellen.
2. **App-Werbung / Twitch→Telegram:** ungültige Bild-URL/File-ID im Telegram-Node prüfen.
3. **VibeLink Mail-Strecke:** Gmail-Credential neu autorisieren.
4. **Ollama VPS** neu starten (falls weiter genutzt) — betrifft mehrere Workflows.
5. **Inaktiven Email-Workflow** aufräumen (Obsidian-Teil retten, dann entscheiden).
6. Trigger-lose Workflows (NASCAR, Skool) mit Trigger versehen oder archivieren.
