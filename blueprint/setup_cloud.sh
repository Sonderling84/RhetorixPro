#!/usr/bin/env bash
# Einrichtung einer neuen Claude-Code-Cloud-Sitzung fuer das Bauplan-Paket (ca. 2-3 Minuten).
# Danach: python3 blueprint/bauplan_app/... siehe START-NEUE-SITZUNG.md
set -e
cd "$(dirname "$0")"
pip install -q opencv-python-headless numpy pillow 2>&1 | tail -1
if [ ! -x /tmp/bl/bin/python ]; then
  python3 -m venv /tmp/bl && /tmp/bl/bin/pip install -q bpy==5.2.2 2>&1 | tail -1
fi
/tmp/bl/bin/python -c "import bpy; print('Blender', bpy.app.version_string)"
