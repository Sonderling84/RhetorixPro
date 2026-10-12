#!/usr/bin/env bash
# BAUPLAN-PAKET (Standard je Haus): haus.json -> Stueckliste -> Blender-Modell -> Linien-Renders -> 3 Blaetter
#   1_STUECKLISTE  2_ANSICHTEN (S/W/O/N + Draufsicht)  3_3D (vorne + hinten)  + BAUPLAN.blend + .glb
# Aufruf:  bauplan_paket.sh <haus.json> <tag> <tools_dir> <blender_python> <out_dir> [titel]
#   tools_dir      = Bauplan-App/tools (bauplan_stueckliste.py, bauplan_builder_blender.py, bauteile_*.py ...)
#   blender_python = Python mit bpy 5.2 (pip install bpy) - oder Blender-eigenes Python
set -euo pipefail
HAUS=$1; TAG=$2; TOOLS=$3; PY=$4; OUT=$(realpath -m "$5"); TITEL=${6:-$TAG}
HIER=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT/render"

echo "[1/4] Stueckliste"
python3 "$TOOLS/bauplan_stueckliste.py" "$HAUS" "$OUT/stueckliste_$TAG.json" | grep -E "STUECKLISTE|!!" || true

echo "[2/4] Blender baut das Modell"
BAUPLAN_NO_PBR=1 BAUPLAN_OHNE_ALTERUNG=1 BAUPLAN_GLB="$OUT/$TAG.glb" \
  "$PY" "$TOOLS/bauplan_builder_blender.py" -- "$OUT/stueckliste_$TAG.json" "$OUT" "$TAG" 8 1 | grep -E "^GEBAUT|Error" || true

echo "[3/4] Linien-Renders (parallel)"
r() { BP3D_KAMERAS=$1 "$PY" -c "
import bpy, sys
bpy.ops.wm.open_mainfile(filepath='$OUT/BAUPLAN_$TAG.blend')
sys.argv = ['x', '--', '$OUT/render', '$TAG', '1']
exec(open('$HIER/bp3d_rundum.py').read())" 2>&1 | grep -E "^BP3D|Traceback|Error" || true; }
r iso_sw,elev_sued & r iso_no,elev_nord & r elev_west,elev_ost,drauf & wait

echo "[4/4] Blaetter"
python3 "$HIER/paket_blaetter.py" "$OUT/render" "$OUT/stueckliste_$TAG.json" "$TAG" "$OUT" "$TITEL"
ls -1 "$OUT"/*.png
