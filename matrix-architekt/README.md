# Matrix Architekt – Landingpage, Kundenbereich, Erkenntnis-Blog

Statische Website für **ganster.tech** (Hostinger). Kein Build nötig, alles in `site/`.

```
site/
  index.html          Landingpage (Beta-Programm, Pilotkunden)
  portal.html         Kundenbereich: Login per E-Mail-Code, Objekt, Plan-Upload (Supabase)
  erkenntnisse.html   Erkenntnis-Blog mit Kategorien + JSON-Feed
  impressum.html      Vorlage, Platzhalter ausfüllen
  datenschutz.html    Vorlage, Platzhalter ausfüllen
  feed.json           Der Erkenntnis-Feed. Neue Einträge hier eintragen.
  config.js           EINE Konfigurationsdatei: Kontakt, Beta-Plätze, Supabase, Tracking
  site.css / track.js / fonts/ / media/
build-artifacts.py    Erzeugt Vorschau-Fragmente für claude.ai (optional)
```

## Vor dem Livegang (Checkliste)

1. `site/config.js`: `KONTAKT_EMAIL`, `BUILDS_GESAMT`, `PLAETZE_FREI` auf echte Werte setzen.
2. `site/impressum.html` und `site/datenschutz.html`: Platzhalter in `[eckigen Klammern]` ausfüllen, roten Kasten löschen.
3. `site/feed.json`: Die Werte `builds_geprueft` ehrlich setzen (die Startwerte sind Schätzungen aus dem Fusion-Skill).
4. Medien nach `site/media/` (siehe `site/media/README.md`). Ohne Medien bleibt die Galerie unsichtbar, das ist gewollt.
5. Supabase einrichten (unten), sonst läuft der Kundenbereich im Demo-Modus.
6. Optional Tracking: n8n-Webhook in `TRACK_WEBHOOK_URL`. Erst dann erscheint das Einwilligungs-Banner.

## Deploy auf ganster.tech (Hostinger)

Automatisch per GitHub Action `.github/workflows/deploy-ganster-tech.yml`: Jeder Push auf `main`,
der `matrix-architekt/site/` ändert, lädt den Ordner per FTPS hoch.

Einmalig im Repo unter **Settings → Secrets and variables → Actions** anlegen:

| Secret | Wert (aus dem Hostinger hPanel → Dateien → FTP-Konten) |
|---|---|
| `HOSTINGER_FTP_HOST` | FTP-Host, z. B. `ftp.ganster.tech` oder die angezeigte IP |
| `HOSTINGER_FTP_USER` | FTP-Benutzername |
| `HOSTINGER_FTP_PASSWORD` | FTP-Passwort |
| `HOSTINGER_FTP_DIR` | `/public_html/` (bei mehreren Domains `/domains/ganster.tech/public_html/`) |

Danach: **Actions → Deploy Matrix Architekt to ganster.tech → Run workflow**. Ab dann automatisch.
Manuell geht es genauso: den Inhalt von `site/` per FTP oder Dateimanager nach `public_html/` kopieren.

Im hPanel außerdem: SSL für ganster.tech aktivieren (Let's Encrypt, kostenlos) und "HTTPS erzwingen".

## Supabase einrichten (Kundenbereich, ca. 10 Minuten)

1. https://supabase.com → New project (Region Frankfurt). Project Settings → API: **Project URL** und **anon public key** in `site/config.js` eintragen.
2. Authentication → Email Templates → **Magic Link**: Code in die Mail einbauen:
   ```html
   <h2>Dein Anmeldecode für Matrix Architekt</h2>
   <p>Code: <strong>{{ .Token }}</strong> (10 Minuten gültig)</p>
   ```
   Authentication → Providers → Email: Email OTP aktiv lassen.
3. SQL Editor → ausführen:
   ```sql
   create table public.einreichungen (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
     email text, objekt text not null, typ text, planstil text default 'unklar',
     geschosse int, wandstaerken text, notizen text,
     blog_optin boolean default false, dateien jsonb default '[]'::jsonb,
     status text default 'neu', created_at timestamptz default now()
   );
   alter table public.einreichungen enable row level security;
   create policy "eigene lesen" on public.einreichungen for select using (auth.uid() = user_id);
   create policy "eigene anlegen" on public.einreichungen for insert with check (auth.uid() = user_id);

   insert into storage.buckets (id, name, public, file_size_limit) values ('bauplaene', 'bauplaene', false, 26214400);
   create policy "upload eigener ordner" on storage.objects for insert
     with check (bucket_id = 'bauplaene' and auth.uid()::text = (storage.foldername(name))[1]);
   create policy "eigene dateien lesen" on storage.objects for select
     using (bucket_id = 'bauplaene' and auth.uid()::text = (storage.foldername(name))[1]);
   ```
4. Jeder Kunde sieht nur seine Einreichungen. Du siehst alles im Dashboard (Table Editor, Storage).
5. Optional: Database → Webhooks → INSERT auf `einreichungen` → n8n-Webhook (Benachrichtigung, Drive-Ablage).

## Tracking (First-Party, Opt-in)

`track.js` schickt Events als JSON an `TRACK_WEBHOOK_URL` (n8n-Webhook), erst nach Klick auf "Ja, zählen".
Keine Cookies, keine Drittanbieter. Events:

| Event | Wo |
|---|---|
| `pageview` | jede Seite |
| `cta_click` (pos: nav, hero, portal, blog-side) | alle CTA-Buttons |
| `hero_start` | E-Mail-Formular im Hero abgeschickt |
| `portal_code_sent`, `portal_login` | Kundenbereich Schritt 1 |
| `objekt_saved` (typ, planstil) | Schritt 2 |
| `upload_done` (files, arten), `upload_error` | Schritt 3 |
| `blog_open`, `blog_filter`, `feed_copied`, `rule_copied` | Erkenntnis-Blog |
| `mail_copy` | Mail-Adresse kopiert |

n8n-Workflow dafür: Webhook (POST) → Set (Felder) → Google Sheets oder Drive-JSON, inaktiv anlegen, Sticky Notes, wie gewohnt.

## Erkenntnis-Feed pflegen

Neuen Eintrag in `site/feed.json` unter `eintraege` anhängen, `aktualisiert` hochsetzen, pushen. Fertig.
Schema steht oben in der Datei. `fix_automatisch: true` nur für Regeln, die ein System ohne Rückfrage anwenden darf.
