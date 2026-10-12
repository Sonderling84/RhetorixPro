# -*- coding: utf-8 -*-
# NACHT-BLATT: Bloom auf die Nacht-Renders (leuchtende Fenster/Kanten) + 2x2-Planblatt.
# Aufruf: python nacht_blatt.py <dir> <tag> <out.png>
import sys, os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

D_, TAG, OUT = sys.argv[1:4]
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
ANS = [('ecke', 'STRASSENECKE · AUGENHÖHE'), ('iso_sw', 'AXONOMETRIE SÜDWEST'),
       ('vogel', 'VOGELPERSPEKTIVE'), ('iso_no', 'AXONOMETRIE NORDOST · RÜCKSEITE')]
ANS = [a for a in ANS if os.path.exists(os.path.join(D_, f'NACHT_{a[0]}_{TAG}.png'))]


def bloom(path):
    a = cv2.imread(path).astype(np.float32) / 255
    hell = np.clip(a - 0.35, 0, 1)                       # nur Fenster und Kanten leuchten
    g = cv2.GaussianBlur(hell, (0, 0), 4) * 0.8 + cv2.GaussianBlur(hell, (0, 0), 16) * 0.6 + cv2.GaussianBlur(hell, (0, 0), 40) * 0.35
    out = np.clip(a + g, 0, 1)
    out = cv2.cvtColor((out * 255).astype(np.uint8), cv2.COLOR_BGR2RGB)
    return Image.fromarray(out)


BG, LINE, TXT, SOFT = (3, 7, 18), (90, 180, 255), (220, 240, 255), (90, 150, 210)
TW, TH, GAP, M = 1200, 900, 30, 60
W = M * 2 + 2 * TW + GAP; H = 190 + 2 * (TH + 50) + GAP + 150
sheet = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(sheet)
d.rectangle([18, 18, W - 19, H - 19], outline=LINE, width=3); d.rectangle([30, 30, W - 31, H - 31], outline=SOFT, width=1)
d.text((M, 60), 'ECKGEBÄUDE 1940 · NACHT', font=ImageFont.truetype(FB, 60), fill=TXT)
d.text((M + 2, 134), 'Aus dem Bauplan-Modell (318 Teile) · dunkle Fassade, leuchtende Fenster, Cyan-Kanten',
       font=ImageFont.truetype(F, 26), fill=SOFT)
for i, (key, titel) in enumerate(ANS):
    r, c = divmod(i, 2); x = M + c * (TW + GAP); y = 190 + r * (TH + 50 + GAP)
    d.text((x, y + 8), f'{i + 1:02d}  {titel}', font=ImageFont.truetype(FB, 26), fill=TXT)
    im = bloom(os.path.join(D_, f'NACHT_{key}_{TAG}.png')).resize((TW, TH), Image.LANCZOS)
    im.save(os.path.join(os.path.dirname(OUT) or '.', f'NACHT_{key}_{TAG}.png'))
    sheet.paste(im, (x, y + 46)); d.rectangle([x, y + 46, x + TW - 1, y + 46 + TH - 1], outline=SOFT, width=1)
y = H - 130
d.line([M, y, W - M, y], fill=SOFT, width=1)
fk, fv = ImageFont.truetype(F, 16), ImageFont.truetype(FB, 24)
for j, (k, v) in enumerate([('PROJEKT', 'Wohn- & Geschäftshaus 1940'), ('MASSE', '18,00 × 12,00 m · 2 Geschosse'),
                            ('KETTE', 'haus.json → Stückliste → Blender'), ('STIL', 'Neon dunkel (Vorlage Tobi)'), ('DATUM', '12.10.2026')]):
    x = M + j * (W - 2 * M) // 5
    d.text((x, y + 20), k, font=fk, fill=SOFT); d.text((x, y + 44), v, font=fv, fill=TXT)
sheet.save(OUT); print('OK', OUT, sheet.size)
