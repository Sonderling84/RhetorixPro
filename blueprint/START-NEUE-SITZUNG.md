# Start-Text für eine neue Sitzung (einfach in die neue Sitzung einfügen und Fotos anhängen)

> Mach mir das Bauplan-Standard-Paket für dieses Objekt nach `blueprint/bauplan_app/Bauplan-STANDARD-PAKET-2026-10-12.md`.
> Einrichtung: `bash blueprint/setup_cloud.sh`. App-Skripte liegen in `blueprint/app_tools/`; Blender-Python ist `/tmp/bl/bin/python`; Builder: `app_tools/bauplan_builder_blender_b.py` mit `BAUPLAN_BOOL_SOLVER=MANIFOLD BAUPLAN_NO_PBR=1 BAUPLAN_OHNE_ALTERUNG=1`.
> Erkennung: wenn `OPENROUTER_API_KEY` gesetzt ist, mit `bauplan_app/foto_zu_haus.py` (Modell `qwen/qwen3.7-plus`), sonst selbst aus den Fotos.
> Mehrere Baukörper (Satellitenbild): `bauplan_app/anlage.py`, Beispiel `b268/v2/`.
> Ausgabe: 1 Stückliste, 2 Ansichten, 3 3D vorne/hinten, 4 Nacht, 5 Vergleich mit den Fotos, `ABSCHLUSS_<tag>.md` mit Zeit und Tokens.
> Ergebnis in `blueprint/<tag>/paket/` committen und auf den Branch `claude/blueprint-eckhaus-1940` pushen, dann `PAKETE-ABLEGEN.bat` um das Haus ergänzen.
> Keine Objektnamen mit „Strasse/Weg/Baum/Hecke“ (werden in den Ansichten ausgeblendet). Vor jedem Lauf die Syntax geänderter Skripte prüfen.

**Ablauf:** Fotos (am besten mehrere plus Satellitenbild) → Erkennung → `haus.json` → Stückliste → Blender → 5 Blätter.
