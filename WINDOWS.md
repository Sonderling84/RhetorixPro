# Rhetorix Pro — Windows

Rhetorix Pro ist eine Electron-App. Die **Oberfläche und der Electron-Rahmen sind
plattformunabhängig**. Der native Kern (Diktat/Transkription, globales Einfügen,
Vorlesen) war ursprünglich macOS-only und wurde für Windows **additiv** portiert
(macOS bleibt unverändert). Stand: build-fähig, Runtime auf echter Windows-Hardware
**noch nicht getestet**.

## Windows-Build automatisch bauen (GitHub Actions)

1. GitHub → Tab **Actions** → Workflow **„Build Windows"** → **Run workflow**
   (oder ein Tag `v*` pushen).
2. Nach dem Lauf unter **Artifacts** den Installer `rhetorix-pro-windows-installer` laden.
3. Läuft auch im **privaten** Repo (Actions ist privat nutzbar).

Der Build erzeugt einen NSIS-Installer (`dist_electron/*.exe`). Die **Oberfläche
startet damit sofort**. Für die nativen Funktionen siehe unten.

## Was auf Windows noch eingerichtet werden muss

Die App verlässt sich auf zwei externe Programme, die auf macOS via Homebrew
vorliegen. Auf Windows müssen sie vorhanden sein — entweder im `PATH` oder als
gebündelte Binaries. Pfade sind per Umgebungsvariable überschreibbar:

| Zweck        | ENV-Variable          | Windows-Default                                   |
|--------------|-----------------------|---------------------------------------------------|
| Transkription| `WHISPER_SERVER_BIN`  | `whisper-server.exe` (im PATH)                    |
| Modell       | `WHISPER_MODEL`       | `resources/whisper/ggml-base.bin`                 |
| Audio-Konv.  | `FFMPEG_BIN`          | `ffmpeg.exe` (im PATH)                            |

**Damit das Diktat auf Windows funktioniert**, ist noch zu erledigen:

1. **whisper.cpp für Windows** bereitstellen (`whisper-server.exe`) und das Modell
   `ggml-base.bin` (~140 MB) mitliefern — z. B. über electron-builder
   `extraResources` in `package.json` nach `resources/whisper/`.
2. **ffmpeg.exe** mitliefern oder in den `PATH` legen.
3. Danach den Windows-Build erneut über Actions erzeugen und live testen.

## Bereits portiert (additiv, macOS unverändert)

- **Kopieren** markierter Text (F2/F3): macOS = AppleScript, Windows = PowerShell `SendKeys ^c`.
- **Einfügen** (globales Diktat): macOS = AppleScript, Windows = PowerShell `SendKeys ^v`.
- **Vorlesen** (ElevenLabs MP3): macOS = `afplay`, Windows = Windows Media Player via PowerShell.
- **Whisper/ffmpeg-Pfade**: plattform- und ENV-abhängig auflösbar.

> Hinweis: Die Windows-Zweige sind implementiert, aber noch nicht auf echter
> Windows-Hardware verifiziert. Erwartbare Feinarbeit: Fokus-/Timing der SendKeys,
> MP3-Playback-Dauer, Rechte für globale Tastenkürzel.
