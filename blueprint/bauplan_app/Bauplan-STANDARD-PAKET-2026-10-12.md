# Bauplan-App: Standard-Paket je Haus (verbindlich ab 12.10.2026, Tobi)

**Was Tobi bekommt (Definition 12.10.2026):**
- **Eingabe:** ein oder mehrere Fotos des Objekts, optional mit Hinweisen.
- **Erkennung:** OpenRouter-Bildmodell (`foto_zu_haus.py`) → `haus.json` → Stückliste der App.
- **Ausgabe:**
  1. Stückliste
  2. technische Darstellungen: Ansichten und 3D-Skizze vorne/hinten in Master Cyanotype
  3. komplette 3D-Skizze des Objekts im **Nacht-Look** (Neon dunkel)

**Regel:** Für jedes Haus wird ab sofort immer dasselbe Paket erzeugt. Alle Teile kommen aus derselben Geometrie, also aus der `haus.json`, der Stückliste und dem Blender-Modell. Es wird nichts frei gezeichnet und nichts per KI gemalt.

| Blatt | Inhalt | Stil |
|---|---|---|
| `1_STUECKLISTE_<tag>.png` | alle nummerierten Teile (T001 …) mit Maßen in cm | Master Cyanotype `#0044B8` |
| `2_ANSICHTEN_<tag>.png` | Ansicht Süd, West, Ost, Nord + Draufsicht (Röntgen) | Master Cyanotype |
| `3_3D_<tag>.png` | 3D-Skizze **von vorne** (Axonometrie SW) und **von hinten** (Axonometrie NO) | Master Cyanotype |
| `4_NACHT_<tag>.png` | Straßenecke, Iso SW, Vogel, Iso NO | Neon dunkel nach Tobis Vorlagen |
| `BAUPLAN_<tag>.blend`, `<tag>.glb` | Modell für Blender / 3D-Tab der App | – |

**Linienstil (Röntgen-Wireframe):** Freestyle mit sichtbaren Kanten (kräftig) und verdeckten Kanten (zart). Im Cyanotype-Stil sind sichtbare Kanten reinweiß und verdeckte hellblau auf Kobalt, mit Zeichenraster, Sonnendruck-Flecken und Papierkorn. Den alten Neon-Wireframe auf Navy (`neon_glow.py`) will Tobi für Pakete **nicht** mehr.

**Nacht-Look (Neon dunkel):** dunkle Klinkerfassade mit feinem, leuchtend blauem Plattenraster, halbtransparentes blau leuchtendes Glas, leuchtende Decken, blaue Kanten plus zarte Röntgen-Kanten, heller blaugrauer Platz, Keller ausgeblendet.

## Ein Befehl
```
BAUPLAN-PAKET.bat <tag> <haus_tag.json> ["TITEL"]
```
Die Kette: `bauplan_stueckliste.py` → `bauplan_builder_blender.py` (nur bauen, GLB) → `bp3d_rundum.py` (7 Linien-Kameras) → `nacht_render.py` (4 Kameras) → `paket_blaetter.py` + `nacht_blatt.py`.

Die Ablage passiert automatisch:
- `G:\Meine Ablage\Brain\02_Bauplan_Brain\Haeuser-Katalog\Haus_<tag>\`
- Asset-Bibliothek (Bluescreen-Tab): `G:\Meine Ablage\Bauplan-App\Training\Trainingssatz-100\models\kundensim\<tag>\` mit den Einzelansichten `BP3D_*` und den Blättern

Pfade über Umgebungsvariablen: `BLENDER`, `PY` (ComfyUI-Python mit PIL/numpy/cv2), `KATALOG`, `ASSETS`, `BAUPLAN_DEVICE` (GPU/CPU).

## Neue Dateien in `tools/`
- `bp3d_rundum.py`: Röntgen-Linien aus 11 möglichen Kameras (`BP3D_KAMERAS` wählt aus)
- `paket_blaetter.py`: Blätter 1–3 im Master-Cyanotype-Stil
- `nacht_render.py`: Nacht-Look aus der `.blend`
- `nacht_blatt.py`: Blatt 4 mit Leuchtschein
- `BAUPLAN-PAKET.bat`: der eine Befehl
- `ECKHAUS-ABLEGEN.bat`: legt das Eckhaus 1940 einmalig in Katalog und Asset-Bibliothek ab

## Erstes Haus: Eckhaus 1940 (`eckhaus1940`)
- Quelle: Referenzfoto „1940“ (Straßenecke, Ziegel, Schaufenster, Rundbogenfenster)
- 18,00 × 12,00 m, 2 Geschosse à 4,00 m, Flachdach mit Attika 1,30 m
- 26 Öffnungen, Rück- und Ostseite **INFERIERT**
- Stückliste: 318 Teile; Modell: 287 Objekte und 26 Ausschnitte
- Erzeugt in einer Claude-Code-Cloud-Sitzung mit bpy 5.2.2, CPU, ohne PBR und ohne `material_alterung`
- Ergebnisse: GitHub `Sonderling84/RhetorixPro`, Branch `claude/blueprint-eckhaus-1940`, Ordner `blueprint/`
- Offen: Rundbögen, Gesims und Markisen fehlen als Bauteile in der Stückliste (Fenster sind rechteckig)
