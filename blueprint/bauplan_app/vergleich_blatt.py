# -*- coding: utf-8 -*-
# VERGLEICH-BLATT (Blatt 5, Tobi 12.10.2026): Referenzfotos oben, Modell-Ansichten unten - zum Abgleich auf einen Blick.
# Aufruf: python vergleich_blatt.py <foto_ordner> <render_dir> <tag> <out.png> ["TITEL"]
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont, ImageOps

FD, RD, TAG, OUT = sys.argv[1:5]
TITEL = sys.argv[5] if len(sys.argv) > 5 else TAG.upper()


def _font(*namen):
    for n in namen:
        for d in ('/usr/share/fonts/truetype/dejavu/', 'C:/Windows/Fonts/'):
            if os.path.exists(d + n): return d + n
    return namen[-1]
F = _font('DejaVuSans.ttf', 'arial.ttf'); FB = _font('DejaVuSans-Bold.ttf', 'arialbd.ttf')
BG, WH, SO = (0, 0x44, 0xB8), (255, 255, 255), (200, 220, 255)

fotos = sorted(f for f in glob.glob(os.path.join(FD, '*')) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')))[:6]
modell = [(k, t) for k, t in (('NACHT_ecke', 'Modell · Straßenecke (Nacht)'), ('BP3D_iso_sw', 'Modell · 3D vorne'),
                              ('BP3D_iso_no', 'Modell · 3D hinten'), ('BP3D_elev_sued', 'Modell · Ansicht Süd'),
                              ('NACHT_vogel', 'Modell · Vogelperspektive'), ('BP3D_elev_nord', 'Modell · Ansicht Nord'))
          if os.path.exists(os.path.join(RD, f'{k}_{TAG}.png'))]

COLS = 3; TW, TH, GAP, M = 760, 570, 24, 60
reihen_f = (len(fotos) + COLS - 1) // COLS; reihen_m = (len(modell) + COLS - 1) // COLS
W = 2 * M + COLS * TW + (COLS - 1) * GAP
H = 170 + (reihen_f + reihen_m) * (TH + 44 + GAP) + 110
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.rectangle([18, 18, W - 19, H - 19], outline=WH, width=4); d.rectangle([30, 30, W - 31, H - 31], outline=SO, width=1)
d.text((M, 58), f'VERGLEICH · {TITEL}', font=ImageFont.truetype(FB, 50), fill=WH)
d.text((M + 2, 122), 'Oben: Referenzfotos des Kunden  ·  Unten: Ansichten aus dem Bauplan-Modell (gleiche Geometrie wie Stückliste)',
       font=ImageFont.truetype(F, 22), fill=SO)


def blau(img):   # BP3D-Linienbild (weiss auf schwarz) -> Master Cyanotype
    import numpy as np
    g = np.asarray(img.convert('L')).astype('float32') / 255
    base = np.array(BG, 'float32') / 255
    out = base * (1 - g[..., None]) + g[..., None]
    return Image.fromarray((out.clip(0, 1) * 255).astype('uint8'))


def kachel(img, x, y, titel):
    d.text((x, y + 6), titel, font=ImageFont.truetype(FB, 22), fill=WH)
    img = ImageOps.fit(img.convert('RGB'), (TW, TH), Image.LANCZOS, centering=(0.5, 0.45))
    im.paste(img, (x, y + 40)); d.rectangle([x, y + 40, x + TW - 1, y + 39 + TH], outline=SO, width=1)


y0 = 160
for i, f in enumerate(fotos):
    r, c = divmod(i, COLS)
    kachel(Image.open(f), M + c * (TW + GAP), y0 + r * (TH + 44 + GAP), f'Foto {i + 1} · {os.path.splitext(os.path.basename(f))[0][:34]}')
y1 = y0 + reihen_f * (TH + 44 + GAP) + 10
d.line([M, y1 - 14, W - M, y1 - 14], fill=SO, width=2)
for i, (k, t) in enumerate(modell):
    r, c = divmod(i, COLS)
    kachel((blau if k.startswith('BP3D') else (lambda x: x))(Image.open(os.path.join(RD, f'{k}_{TAG}.png'))), M + c * (TW + GAP), y1 + r * (TH + 44 + GAP), t)
im.save(OUT); print('OK', OUT, im.size)
