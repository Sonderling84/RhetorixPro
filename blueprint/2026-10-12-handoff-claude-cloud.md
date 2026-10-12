# Handoff 12.10.2026: Bauplan-Paket aus Fotos (Claude Code Cloud)

**Sitzung:** Claude Code in der Cloud, Modell Opus 5.5 (`claude-opus-5-5`), Auftraggeber Tobi (vom iPhone)
**Code:** GitHub `Sonderling84/RhetorixPro`, Branch `claude/blueprint-eckhaus-1940`, Ordner `blueprint/`
**Kosten der Sitzung:** ca. 37 $. Die Sitzung war sehr lang und hat die Kette erst aufgebaut. Künftig: pro Haus eine neue, kurze Sitzung.

---

## 1. Was Tobi bekommt (verbindliche Definition)
- **Eingabe:** ein oder mehrere Fotos, bei großen Gebäuden zusätzlich ein Satellitenbild (Google Maps von oben).
- **Erkennung:** OpenRouter-Bildmodell (Qwen, `qwen/qwen3.7-plus`) → `haus.json` → Stückliste der App. Ohne Schlüssel vermisst Claude selbst.
- **Paket je Haus:**

| Blatt | Inhalt |
|---|---|
| `1_STUECKLISTE` | alle nummerierten Teile mit Maßen, bei über 300 Teilen zusätzlich als JPG |
| `2_ANSICHTEN` | Süd, West, Ost, Nord, Draufsicht (Röntgen) |
| `3_3D` | 3D-Skizze von vorne (Iso SW) und von hinten (Iso NO) |
| `4_NACHT` | Nacht-Look: Straßenecke, Iso SW, Vogel, Iso NO |
| `5_VERGLEICH` | Referenzfotos oben, Modell unten (seit 12.10. Pflicht) |
| `ABSCHLUSS_<tag>.md` | Zeit je Schritt, Tokens und Kosten (OpenRouter) |

Dazu kommen `BAUPLAN_<tag>.blend`, `<tag>.glb` (3D-Tab) und die Einzelansichten `BP3D_*`.

- **Stile:**
  - Blätter 1–3 in **Master Cyanotype** `#0044B8`: weiße sichtbare Kanten, hellblaue verdeckte Kanten, Raster, Sonnendruck-Papier. Tobi mag den Neon-Wireframe auf Navy (`neon_glow.py`) für Pakete **nicht**.
  - Blatt 4 im **Nacht-Look** nach Tobis Adobe-Stock-Vorlagen (nur Stilvorbild): dunkle Klinkerfassade mit feinem blauem Plattenraster, halbtransparentes leuchtendes Glas, leuchtende Decken, blaue Kanten und zarte Röntgen-Kanten, heller blaugrauer Platz.

## 2. Fertige Häuser

| Tag | Objekt | Teile | Quelle | Ordner |
|---|---|---|---|---|
| `eckhaus1940` | Eckgebäude 1940 (KI-Foto, Instagram) | 318 | 1 Foto | `blueprint/bauplan_app/` (paket_eckhaus1940, nacht, ansichten) |
| `beethoven9` | Beethovenstr. 9 / Kantstr. 31, Riegelsberg | 214 | 6 Fotos + App-Lauf `kant24v2` | `blueprint/beethoven9/paket/` |
| `b268` | B268 Nr. 9, Riegelsberg, Wohnanlage aus 4 Baukörpern | 1549 | 6 Fotos + Satellitenbild | `blueprint/b268/paket/`, Lageplan in `b268/v2/` |

**Ablage auf `G:` und in der Asset-Sammlung:** zu Hause `PAKETE-ABLEGEN.bat` (Drive `Bauplan-App/tools`) doppelklicken. Sie holt alle 3 Häuser von GitHub nach `Brain\02_Bauplan_Brain\Haeuser-Katalog\Haus_<tag>` und `Bauplan-App\Training\Trainingssatz-100\models\kundensim\<tag>`. **Noch nicht ausgeführt.** Die Bilder konnten aus der Cloud nicht ins Drive (Drive-Upload nur für Text praktikabel).

## 3. Neue und geänderte Werkzeuge

**`blueprint/bauplan_app/`** (alles auch im Drive `Bauplan-App/tools`):
- `foto_zu_haus.py`: OpenRouter-Bildmodell vermisst ein oder mehrere Fotos (Ordner oder Liste) und schreibt `haus.json`. Normalisiert die Antwort (Grenzen, Pflichtfelder, keine Überlappungen) und protokolliert Tokens, Kosten und Sekunden in `verbrauch_openrouter.json`.
- `anlage.py`: mehrere Baukörper (je eine `haus.json`) mit Drehung 0/90/180/270 und Lageplan-Versatz zu **einer** Stückliste. Dazu Zusatzteile: Balkonanlagen an jeder Seite (Platte, Glasbrüstung, Handlauf, Stahlstützen, Pergola mit Glasdach) und Treppenhaus-Kerne.
- `bp3d_rundum.py`: Freestyle-Röntgen-Linien aus 11 Kameras (`BP3D_KAMERAS` wählt aus), GPU per `BAUPLAN_DEVICE=GPU`.
- `nacht_render.py`: Nacht-Look aus der `.blend`.
- `paket_blaetter.py`: Blätter 1–3. `nacht_blatt.py`: Blatt 4. `vergleich_blatt.py`: Blatt 5. `abschluss.py`: Zeit und Tokens.
- `BAUPLAN-PAKET.bat`: **Windows, ein Befehl** von Foto/Ordner/`haus.json` bis zum Paket inklusive Ablage in Katalog und Asset-Sammlung.
- `PAKETE-ABLEGEN.bat`: die 3 Cloud-Häuser von GitHub auf `G:` legen.

**`blueprint/`** (Cloud):
- `setup_cloud.sh`: bpy 5.2.2 und OpenCV, ca. 1 min.
- `paket_cloud.sh`: **ein Befehl** für das ganze Paket, getestet in 2,5 min.
- `app_tools/`: Kopie der App-Skripte.
- `START-NEUE-SITZUNG.md`: Start-Text und Regeln für die nächste Sitzung.

## 4. Wichtige Befunde
- **Boolean EXACT ist der Flaschenhals.** `bauplan_builder_blender.py` schneidet Fenster mit `solver='EXACT'`. Bei Beethoven 9 hing das Speichern endlos, beim Eckhaus kostete es 6 min pro Render. Mit `MANIFOLD` (Blender 5) dauert Bauen und Rendern Sekunden. In der Cloud läuft die Kopie `app_tools/bauplan_builder_blender_b.py` mit Umschaltung `BAUPLAN_BOOL_SOLVER`. **Das Original im Drive ist unverändert**, die Umschaltung dort einbauen, wenn Tobi zustimmt.
- **Ausblend-Schlüsselwörter:** Objektnamen mit „strasse/weg/baum/hecke/rasen/gehweg“ blenden die Render-Skripte aus. Ein Baukörper „Strassenhaus“ verschwand deshalb, er heißt jetzt „Vorderhaus“.
- **Satellitenbild ist Pflicht bei großen Anlagen.** Ohne Bild von oben lagen Grundriss und Lage der Baukörper bei B268 deutlich daneben (19 m statt 33 m, zwei getrennte Häuser statt eines Komplexes).
- **Die Stückliste kann nicht:**
  - Rundbögen, Gesims, Markisen,
  - Schleppgauben (Zwerchhaus nur mit Flachdach, nur Nordseite),
  - mehr als 1 Kamin,
  - Putzfelder oder Farbwechsel an der Fassade,
  - Hanglage (nur Ecken-Höhen),
  - die Dachgeschoss-Treppe bei nur 1 Vollgeschoss.
- **Drive-Upload aus der Cloud:** Text geht (`textContent`), Bilder praktisch nicht. Base64 per Bash hat die Berechtigungsprüfung blockiert. Deshalb sind die `.bat`-Dateien ohne `goto`, sie laufen auch mit LF-Zeilenenden.

## 5. Offen / nächste Schritte
1. Zu Hause `PAKETE-ABLEGEN.bat` ausführen und prüfen, ob die Asset-Sammlung (Bluescreen-Tab) die Blätter richtig einsortiert.
2. `OPENROUTER_API_KEY` als Network Secret in der Cloud-Umgebung setzen, dann den ersten Lauf mit Qwen machen (Vergleich zur Claude-Erkennung bei Beethoven 9).
3. Mit Tobis Zustimmung die Umschaltung `BAUPLAN_BOOL_SOLVER` (MANIFOLD) im Original-Builder einbauen.
4. Optional die Stückliste erweitern: Schleppgaube, zweiter Kamin, Putzfelder/Farbzonen, Hanglage pro Baukörper.
5. `abschluss.py` mit der neuen Schritt-Reihenfolge ins Drive nachladen. Das ist die letzte kleine Änderung, bisher nur auf GitHub.
