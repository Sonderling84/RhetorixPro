# -*- coding: utf-8 -*-
# BP3D-BLATT: alle Rundum-Ansichten (BP3D_<key>_<tag>.png) auf ein Planblatt.
# Stil "neon": Ansichten vorher mit tools/neon_glow.py eingefaerbt (NEONGLOW_<key>_<tag>.png).
# Stil "blau": Master Cyanotype (#0044B8), weisse Linien, verdeckte Kanten heller blau.
# Aufruf: python bp3d_blatt.py <dir> <tag> <neon|blau> <out.png>
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

D_, TAG, STIL, OUT = sys.argv[1:5]
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
ANS = [('iso_sw', 'AXONOMETRIE SÜDWEST · STRASSENECKE'), ('iso_so', 'AXONOMETRIE SÜDOST'),
       ('iso_no', 'AXONOMETRIE NORDOST · RÜCKSEITE'), ('iso_nw', 'AXONOMETRIE NORDWEST'),
       ('vogel', 'VOGELPERSPEKTIVE'), ('ecke', 'AUGENHÖHE · WIE FOTO'),
       ('elev_sued', 'ANSICHT SÜD · HAUPTFASSADE'), ('elev_west', 'ANSICHT WEST · SEITENFASSADE'),
       ('elev_ost', 'ANSICHT OST'), ('elev_nord', 'ANSICHT NORD · RÜCKSEITE'),
       ('drauf', 'DRAUFSICHT · RÖNTGEN')]
ANS = [a for a in ANS if os.path.exists(os.path.join(D_, f'BP3D_{a[0]}_{TAG}.png'))]

if STIL == 'neon':
    BG, LINE, TXT, SOFT = (4, 9, 23), (140, 225, 255), (225, 245, 255), (110, 190, 235)
else:
    BG, LINE, TXT, SOFT = (0, 0x44, 0xB8), (255, 255, 255), (255, 255, 255), (200, 220, 255)


def kachel(key):
    if STIL == 'neon':
        return Image.open(os.path.join(D_, f'NEONGLOW_{key}_{TAG}.png')).convert('RGB')
    g = np.asarray(Image.open(os.path.join(D_, f'BP3D_{key}_{TAG}.png')).convert('L')).astype(np.float32) / 255
    h, w = g.shape
    base = np.empty((h, w, 3), np.float32); base[:] = np.array(BG, np.float32) / 255
    # feines Zeichenraster (Master Cyanotype)
    ras = np.zeros((h, w), np.float32); ras[:, ::40] = 1; ras[::40, :] = 1; ras[:, ::200] = 2; ras[::200, :] = 2
    base += (ras * 0.045)[..., None]
    # sichtbar (hell) = reinweiss, verdeckt (grau) = helles Kobalt
    sicht = np.clip((g - 0.55) / 0.35, 0, 1); verd = np.clip(g / 0.42, 0, 1) * (1 - sicht)
    out = base * (1 - verd[..., None] * 0.55) + np.array([0.55, 0.72, 1.0], np.float32) * verd[..., None] * 0.55
    out = out * (1 - sicht[..., None]) + np.array([1, 1, 1], np.float32) * sicht[..., None]
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


COLS, TW, TH, GAP, M = 4, 800, 600, 26, 60
rows = (len(ANS) + 1 + COLS - 1) // COLS          # +1 Feld fuer Schriftfeld
W = M * 2 + COLS * TW + (COLS - 1) * GAP
H = 170 + rows * (TH + 44) + (rows - 1) * GAP + M
sheet = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(sheet)
d.rectangle([18, 18, W - 19, H - 19], outline=LINE, width=4)
d.rectangle([30, 30, W - 31, H - 31], outline=SOFT, width=1)
d.text((M, 62), 'ECKGEBÄUDE 1940 · BP3D RUNDUM', font=ImageFont.truetype(FB, 54), fill=TXT)
d.text((M + 2, 128), 'Röntgen-Wireframe aus der Bauplan-App-Kette: haus.json → Stückliste → Blender → Freestyle-Linien',
       font=ImageFont.truetype(F, 24), fill=SOFT)
ft = ImageFont.truetype(FB, 22)
for i, (key, titel) in enumerate(ANS):
    r, c = divmod(i, COLS)
    x = M + c * (TW + GAP); y = 170 + r * (TH + 44 + GAP)
    d.text((x, y + 6), f'{i + 1:02d}  {titel}', font=ft, fill=TXT)
    t = kachel(key).resize((TW, TH), Image.LANCZOS)
    sheet.paste(t, (x, y + 40))
    d.rectangle([x, y + 40, x + TW - 1, y + 40 + TH - 1], outline=SOFT, width=1)

# Schriftfeld im letzten Feld
i = len(ANS); r, c = divmod(i, COLS)
x = M + c * (TW + GAP); y = 170 + r * (TH + 44 + GAP) + 40
meta = json.load(open(os.path.join(D_, 'stueckliste_meta.json'), encoding='utf-8')) if os.path.exists(os.path.join(D_, 'stueckliste_meta.json')) else {}
d.rectangle([x, y, x + TW - 1, y + TH - 1], outline=LINE, width=3)
d.text((x + 24, y + 26), 'BAUPLAN · ECKGEBÄUDE 1940', font=ImageFont.truetype(FB, 34), fill=TXT)
rows_ = [('PROJEKT', 'Wohn- & Geschäftshaus, 2-geschossig'),
         ('MASSE', '18,00 × 12,00 m · Attika +9,90 m'),
         ('STÜCKLISTE', f"{meta.get('anzahl_teile', '–')} nummerierte Teile (T001 …)"),
         ('KETTE', 'bauplan_stueckliste → builder_blender'),
         ('STIL', 'Neon-Blueprint dunkel' if STIL == 'neon' else 'Master Cyanotype #0044B8'),
         ('QUELLE', 'Foto „1940“ · Rück/Ost INFERIERT'),
         ('DATUM', '12.10.2026')]
fk, fv = ImageFont.truetype(F, 15), ImageFont.truetype(FB, 24)
for j, (k, v) in enumerate(rows_):
    yy = y + 92 + j * 68
    d.line([x + 20, yy - 8, x + TW - 20, yy - 8], fill=SOFT, width=1)
    d.text((x + 24, yy), k, font=fk, fill=SOFT); d.text((x + 24, yy + 20), v, font=fv, fill=TXT)
if STIL != 'neon':   # Sonnendruck-Papier: Flecken, Korn, Vignette
    import cv2
    a = np.asarray(sheet).astype(np.float32) / 255; hh, ww = a.shape[:2]; rng = np.random.default_rng(7)
    n = cv2.resize(rng.random((hh // 120 + 2, ww // 120 + 2)).astype(np.float32), (ww, hh), interpolation=cv2.INTER_CUBIC)
    n = cv2.GaussianBlur(n, (0, 0), 60) - 0.5
    hell = a.min(axis=2, keepdims=True) > 0.85            # weisse Linien/Text bleiben rein
    yy, xx = np.mgrid[0:hh, 0:ww]
    vig = 1 - 0.18 * (((xx - ww / 2) / (ww / 2)) ** 2 + ((yy - hh / 2) / (hh / 2)) ** 2) / 2
    b = a * (1 + 0.25 * n)[..., None] * vig[..., None] + rng.normal(0, 0.02, (hh, ww, 1)).astype(np.float32)
    a = np.where(hell, a, b)
    sheet = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
sheet.save(OUT); print('OK', OUT, sheet.size)
