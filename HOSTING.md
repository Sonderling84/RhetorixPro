# Hosting & SEO — Rhetorix Pro im Web

Rhetorix Pro gibt es in zwei Varianten:

| | **Desktop (Electron)** | **Web (GitHub Pages)** |
|---|---|---|
| Start | Installer (`Build Windows`-Workflow) | Browser-Link |
| Gemini-Key | lokal / eigener Server | in den Build eingebaut (öffentlich sichtbar!) |
| Rhetorik-Training, Diktat, Analyse | ✅ | ✅ |
| Google Drive / Gmail-Versand | ✅ (lokaler Server) | ❌ (braucht den Server) |
| Lizenz-System, ElevenLabs-Stimmen | ✅ (lokaler Server) | ❌ |

Die Web-Variante ist die **öffentliche, von Google auffindbare Seite**. Für den vollen
Funktionsumfang (Drive, Gmail, Lizenz) ist die Desktop-App gedacht.

---

## 1. GitHub Pages aktivieren (einmalig)

1. Repo → **Settings → Pages**
2. Unter **Build and deployment → Source**: **„GitHub Actions"** auswählen.

Danach veröffentlicht der Workflow `.github/workflows/deploy-pages.yml` bei jedem
Push auf `main` automatisch. Live-Adresse:

```
https://sonderling84.github.io/rhetorixpro/
```

Der Workflow lässt sich auch manuell starten: **Actions → „Deploy to GitHub Pages" → Run workflow**.

## 2. Gemini-Key hinterlegen

1. Repo → **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `GEMINI_API_KEY`, Wert: dein Google-AI-Studio-Key.

Ohne dieses Secret baut die Seite trotzdem — die KI-Funktionen bleiben dann aber leer.

### ⚠️ Wichtig zur Sicherheit
Bei einer statischen Web-Seite wird der Gemini-Key **in den JavaScript-Build eingebaut
und ist damit im Browser öffentlich lesbar.** Das ist bauartbedingt bei reinen
Frontend-Apps so. Empfehlungen:

- Nutze für die öffentliche Web-Version einen **separaten, eingeschränkten Key**
  (Google AI Studio / Google Cloud → API-Key auf die Pages-Domain per
  *HTTP-Referrer* beschränken, Kontingent begrenzen).
- Für den **privaten** Key: die Desktop-App verwenden, dort bleibt der Key lokal.

## 3. SEO — was schon eingebaut ist

- `index.html`: Titel, `description`, Open-Graph- & Twitter-Cards, `canonical`,
  strukturierte Daten (`schema.org/SoftwareApplication`).
- `public/robots.txt` und `public/sitemap.xml` (nach dem Build unter dem Pages-Pfad
  erreichbar).
- Social-Vorschaubild `public/og-image.png` (1200×630), Favicon & App-Icon.

### Nächste Schritte für die Google-Sichtbarkeit
1. **Google Search Console** öffnen → Property `https://sonderling84.github.io/rhetorixpro/`
   hinzufügen (Präfix-Property).
2. Dort die **Sitemap** einreichen: `sitemap.xml`.
3. Über „URL-Prüfung" die Startseite indexieren lassen.

> Hinweis: Bei einem **Projekt-Pages-Repo** liegt die Seite unter `…/rhetorixpro/`.
> Crawler suchen `robots.txt` zusätzlich auf der Domain-Wurzel
> (`sonderling84.github.io/robots.txt`) — die gehört zum Nutzer-Root, nicht zu diesem
> Projekt. Für maximale SEO-Wirkung wäre eine **eigene Domain** (Custom Domain in den
> Pages-Settings) ideal; dann liegen `robots.txt` und `sitemap.xml` auf der Wurzel.
