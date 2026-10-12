# -*- coding: utf-8 -*-
# NEON-GLOW: weisse Linien (Freestyle) -> gluehende Cyan-Linien auf dunklem Navy mit Bodenraster + Bloom.
# Reine Bildverarbeitung, die Geometrie bleibt 1:1. Aufruf (ComfyUI-Python): neon_glow.py <in.png> <out.png> [raster 0/1]
import sys, cv2, numpy as np
IN, OUT = sys.argv[1], sys.argv[2]; RASTER = len(sys.argv) > 3 and sys.argv[3] == '1'
g = cv2.imread(IN, cv2.IMREAD_GRAYSCALE); h, w = g.shape
lines = cv2.threshold(g, 60, 255, cv2.THRESH_BINARY)[1].astype(np.float32) / 255.0
bg = np.zeros((h, w, 3), np.float32); bg[:] = (0.09, 0.035, 0.02)   # BGR: dunkles Navy
# leichter Vertikalverlauf
grad = np.linspace(1.4, 0.7, h, dtype=np.float32)[:, None, None]; bg = bg * grad
if RASTER:
    ras = np.zeros((h, w), np.float32); yh = int(h * 0.62)
    for x in range(0, w, 48): cv2.line(ras, (x, yh), (x, h), 1.0, 1)
    for y in range(yh, h, 36): cv2.line(ras, (0, y), (w, y), 1.0, 1)
    ras = cv2.GaussianBlur(ras, (0, 0), 0.8) * 0.18
    bg += ras[:, :, None] * np.array([0.9, 0.6, 0.15], np.float32)
core = lines[:, :, None] * np.array([1.0, 0.95, 0.75], np.float32)          # BGR: fast weiss-cyan
glow1 = cv2.GaussianBlur(lines, (0, 0), 2.5)[:, :, None] * np.array([1.0, 0.75, 0.25], np.float32) * 0.9
glow2 = cv2.GaussianBlur(lines, (0, 0), 9)[:, :, None] * np.array([1.0, 0.55, 0.1], np.float32) * 0.6
glow3 = cv2.GaussianBlur(lines, (0, 0), 24)[:, :, None] * np.array([0.8, 0.35, 0.05], np.float32) * 0.35
img = np.clip(bg + glow3 + glow2 + glow1 + core, 0, 1)
cv2.imwrite(OUT, (img * 255).astype(np.uint8)); print('OK', OUT)
