#!/usr/bin/env bash
# PAKET-CLOUD: komplettes Bauplan-Standard-Paket in einer Claude-Code-Cloud-Sitzung, ein Befehl.
#   bash blueprint/paket_cloud.sh <tag> <haus_tag.json | anlage_tag.json | fotos-ordner> "<TITEL>" [fotos-ordner]
#   - haus_*.json   : ein Baukoerper (Schema bauplan_stueckliste.py)
#   - anlage_*.json : mehrere Baukoerper (anlage.py, Lageplan aus Satellitenbild)
#   - fotos-ordner  : OpenRouter-Erkennung (OPENROUTER_API_KEY noetig, Modell OPENROUTER_MODEL, Standard qwen/qwen3.7-plus)
# Ergebnis: blueprint/<tag>/paket/ (1 Stueckliste, 2 Ansichten, 3 3D, 4 Nacht, 5 Vergleich, ABSCHLUSS, .blend, .glb)
set -euo pipefail
TAG=$1; EIN=$(realpath "$2"); TITEL=${3:-$TAG}; FOTOS=${4:-}
B=$(cd "$(dirname "$0")" && pwd); A=$B/bauplan_app; T=$B/app_tools; PY=/tmp/bl/bin/python
[ -x $PY ] || bash $B/setup_cloud.sh
O=/tmp/paket_$TAG; rm -rf $O; mkdir -p $O/render; START=$(date +%s)
ZIEL=$B/$TAG; mkdir -p $ZIEL/paket/ansichten

if [ -d "$EIN" ]; then                       # Fotos -> OpenRouter
  FOTOS=${FOTOS:-$EIN}; export OPENROUTER_MODEL=${OPENROUTER_MODEL:-qwen/qwen3.7-plus}
  echo "[0] OpenRouter ($OPENROUTER_MODEL) vermisst die Fotos"
  python3 $A/foto_zu_haus.py "$EIN" $TAG $O/haus_$TAG.json; EIN=$O/haus_$TAG.json; cp $EIN $ZIEL/
fi
echo "[1] Stueckliste"
case "$(basename $EIN)" in
  anlage_*) python3 $A/anlage.py "$EIN" $T $O/stueckliste_$TAG.json | tail -1 ;;
  *)        python3 $T/bauplan_stueckliste.py "$EIN" $O/stueckliste_$TAG.json | grep -E "STUECKLISTE|!!" ;;
esac
echo "[2] Blender baut das Modell"
cd $O
BAUPLAN_BOOL_SOLVER=MANIFOLD BAUPLAN_NO_PBR=1 BAUPLAN_OHNE_ALTERUNG=1 BAUPLAN_GLB=$O/$TAG.glb \
  $PY $T/bauplan_builder_blender_b.py -- $O/stueckliste_$TAG.json $O $TAG 8 1 2>&1 | grep -E "^GEBAUT|Traceback|Error" || true
rb() { $PY -c "
import bpy, sys
bpy.ops.wm.open_mainfile(filepath='$O/BAUPLAN_$TAG.blend')
sys.argv = ['x', '--', '$O/render', '$TAG', '$2']
exec(open('$A/$1').read())" 2>&1 | grep -E "^(BP3D|NACHT)|Traceback|Error" | grep -c . ; }
echo "[3] Linien-Ansichten:  $(BP3D_KAMERAS=iso_sw,iso_no,elev_sued,elev_nord,elev_west,elev_ost,drauf rb bp3d_rundum.py 1) Bilder"
echo "[4] Nacht-Look:        $(rb nacht_render.py 16) Bilder"
echo "[5] Blaetter"
python3 $A/paket_blaetter.py $O/render $O/stueckliste_$TAG.json $TAG $O "$TITEL" >/dev/null
python3 $A/nacht_blatt.py $O/render $TAG $O/4_NACHT_$TAG.png "$TITEL" $O/stueckliste_$TAG.json >/dev/null
if [ -n "$FOTOS" ]; then python3 $A/vergleich_blatt.py "$FOTOS" $O/render $TAG $O/5_VERGLEICH_$TAG.png "$TITEL" >/dev/null; fi
python3 $A/abschluss.py $O $TAG $START | sed -n '/Zeit je Schritt/,$p'
cp $O/[1-5]_*.* $O/ABSCHLUSS_$TAG.md $O/$TAG.glb $O/BAUPLAN_$TAG.blend $O/stueckliste_$TAG.json $ZIEL/paket/ 2>/dev/null || true
cp $O/render/*.png $ZIEL/paket/ansichten/
echo "FERTIG -> $ZIEL/paket"
