# Start-Text für eine neue Sitzung

**Einfügen und Fotos anhängen** (am besten mehrere Seiten und ein Satellitenbild):

```
Wechsle auf den Branch claude/blueprint-eckhaus-1940 und lies blueprint/START-NEUE-SITZUNG.md.
Mach danach das Bauplan-Standard-Paket für diese Fotos. Name: <Adresse>.
```

## Anleitung für Claude in der neuen Sitzung
1. **Einrichten:** `bash blueprint/setup_cloud.sh` (ca. 1 min: Blender 5.2 als bpy, OpenCV).
2. **Fotos ablegen:** nach `blueprint/<tag>/fotos/`, Satellitenbild als `*_satellit*.jpg`.
3. **Erkennung:**
   - Ist `OPENROUTER_API_KEY` gesetzt → direkt `bash blueprint/paket_cloud.sh <tag> blueprint/<tag>/fotos "<TITEL>"` (Qwen `qwen/qwen3.7-plus`).
   - Sonst selbst `blueprint/<tag>/haus_<tag>.json` schreiben (Vorlagen: `beethoven9/haus_beethoven9.json`, Schema in `app_tools/bauplan_stueckliste.py`). Vorher im Drive nach einem App-Lauf zur Adresse suchen (`haus.json`, `SKIZZE_*`).
   - **Mehrere Baukörper / Wohnanlage:** Lageplan aus dem Satellitenbild, `anlage_<tag>.json` wie `b268/v2/b268_v2.py` → `anlage.py`.
4. **Paket bauen:** `bash blueprint/paket_cloud.sh <tag> <haus_*.json | anlage_*.json> "<TITEL>" blueprint/<tag>/fotos` (ca. 2–4 min).
5. **Prüfen:** `5_VERGLEICH` ansehen und Abweichungen ehrlich nennen.
6. **Abliefern:** die Blätter schicken (Stückliste über 30 MB → die JPG-Kopie). Dann `blueprint/<tag>/` committen, auf `claude/blueprint-eckhaus-1940` pushen und `bauplan_app/PAKETE-ABLEGEN.bat` um das Haus ergänzen.

## Regeln (Tobi, 12.10.2026)
- **SCHNELLMODUS ist Standard:** keine Rückfragen und **nicht** das 5-Phasen-Protokoll (Erfassen/Rückfragen/Skizze/Abgleich/Freigabe). Alles aus den Fotos schätzen, Unsicheres als INFERIERT markieren und direkt das Paket liefern. Höchstens **eine** Rückfrage, und nur wenn ohne sie gar nichts geht (z. B. kein Foto). Tobi korrigiert danach anhand des Vergleichs-Blatts.
- **Nur Skizze gewünscht** („nur die Bluescreen-Skizze“): Blätter 2 + 3 (Ansichten + 3D in Master Cyanotype), keine Nacht/kein Vergleich, wenn nicht verlangt.
- **Paket:** 1 Stückliste, 2 Ansichten (S/W/O/N + Draufsicht), 3 3D vorne/hinten (Master Cyanotype `#0044B8`), 4 Nacht-Look (Neon dunkel), 5 Vergleich mit den Fotos, `ABSCHLUSS_<tag>.md` mit Zeit und Tokens.
- **Geometrie:** Alles kommt aus derselben Geometrie (`haus.json` → Stückliste → Blender). Nichts frei malen.
- **Objektnamen:** keine Namen mit „Strasse/Weg/Baum/Hecke/Rasen“, die Render-Skripte blenden sie aus.
- **Syntax:** Vor jedem Lauf die geänderten Skripte prüfen (`python3 -c "import ast;…"`).
- **Inferiert:** Was man nicht sieht, wird als INFERIERT markiert.
