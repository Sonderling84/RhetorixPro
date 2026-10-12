# -*- coding: utf-8 -*-
# PAKET-BLAETTER (Standard je Haus, Tobi 12.10.2026): drei Blaetter im Master-Cyanotype-Stil (#0044B8)
#   1  STUECKLISTE_<tag>.png   alle nummerierten Teile mit Massen
#   2  ANSICHTEN_<tag>.png     Ansicht Sued / West / Ost / Nord + Draufsicht (Roentgen)
#   3  3D_<tag>.png            3D-Skizze von vorne (Axonometrie SW) und von hinten (Axonometrie NO)
# Eingabe: Ordner mit BP3D_<key>_<tag>.png (bp3d_rundum.py) + stueckliste_<tag>.json
# Aufruf: python paket_blaetter.py <render_dir> <stueckliste.json> <tag> <out_dir> [titel]
import sys, os, json
from collections import Counter
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

RD, SLP, TAG, OUTD = sys.argv[1:5]
TITEL = sys.argv[5] if len(sys.argv) > 5 else TAG
F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FM = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
BG = (0, 0x44, 0xB8); WH = (255, 255, 255); SO = (200, 220, 255)
SL = json.load(open(SLP, encoding='utf-8')); T = SL['teile']; META = SL['meta']
os.makedirs(OUTD, exist_ok=True)
fnt = lambda p, s: ImageFont.truetype(p, s)


def cyanotype(key):
    """Freestyle-Graustufen -> Kobalt: sichtbar reinweiss, verdeckt helles Kobalt, feines Zeichenraster."""
    g = np.asarray(Image.open(os.path.join(RD, f'BP3D_{key}_{TAG}.png')).convert('L')).astype(np.float32) / 255
    h, w = g.shape
    base = np.empty((h, w, 3), np.float32); base[:] = np.array(BG, np.float32) / 255
    ras = np.zeros((h, w), np.float32); ras[:, ::40] = 1; ras[::40, :] = 1; ras[:, ::200] = 2; ras[::200, :] = 2
    base += (ras * 0.045)[..., None]
    sicht = np.clip((g - 0.55) / 0.35, 0, 1); verd = np.clip(g / 0.42, 0, 1) * (1 - sicht)
    out = base * (1 - verd[..., None] * 0.55) + np.array([0.55, 0.72, 1.0], np.float32) * verd[..., None] * 0.55
    out = out * (1 - sicht[..., None]) + sicht[..., None]
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def papier(sheet):
    """Sonnendruck-Flecken, Papierkorn, Vignette; weisse Linien/Text bleiben rein."""
    a = np.asarray(sheet).astype(np.float32) / 255; hh, ww = a.shape[:2]; rng = np.random.default_rng(7)
    n = cv2.resize(rng.random((hh // 120 + 2, ww // 120 + 2)).astype(np.float32), (ww, hh), interpolation=cv2.INTER_CUBIC)
    n = cv2.GaussianBlur(n, (0, 0), 60) - 0.5
    yy, xx = np.mgrid[0:hh, 0:ww]
    vig = 1 - 0.18 * (((xx - ww / 2) / (ww / 2)) ** 2 + ((yy - hh / 2) / (hh / 2)) ** 2) / 2
    b = a * (1 + 0.25 * n)[..., None] * vig[..., None] + rng.normal(0, 0.02, (hh, ww, 1)).astype(np.float32)
    a = np.where(a.min(axis=2, keepdims=True) > 0.85, a, b)
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def rahmen(W, H, titel, unter):
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    d.rectangle([18, 18, W - 19, H - 19], outline=WH, width=4); d.rectangle([30, 30, W - 31, H - 31], outline=SO, width=1)
    d.text((60, 58), titel, font=fnt(FB, 50), fill=WH); d.text((62, 124), unter, font=fnt(F, 22), fill=SO)
    return im, d


def schriftfeld(d, x, y, w, blatt):
    rows = [('PROJEKT', META.get('name', TITEL)[:44]),
            ('MASSE', f"{META['breite_cm'] / 100:.2f} × {META['tiefe_cm'] / 100:.2f} m · {META['geschosse']} Geschosse".replace('.', ',')),
            ('STÜCKLISTE', f'{len(T)} nummerierte Teile'), ('BLATT', blatt)]
    d.rectangle([x, y, x + w, y + 60 + 62 * len(rows)], outline=WH, width=3)
    d.text((x + 20, y + 16), 'BAUPLAN-APP · MASTER CYANOTYPE', font=fnt(FB, 22), fill=WH)
    for j, (k, v) in enumerate(rows):
        yy = y + 58 + j * 62; d.line([x + 14, yy, x + w - 14, yy], fill=SO, width=1)
        d.text((x + 20, yy + 8), k, font=fnt(F, 14), fill=SO); d.text((x + 20, yy + 26), v, font=fnt(FB, 22), fill=WH)


# ---------- 1 Stueckliste ----------
cols = 3; per = (len(T) + cols - 1) // cols; lh = 19; cw = 760
im, d = rahmen(120 + cols * cw, 240 + per * lh + 80, f'STÜCKLISTE · {TITEL} · {len(T)} TEILE',
               'Koordinaten in cm · Ursprung SW-Ecke Außenwand · x = Ost, y = Nord, z = oben · 0,00 = OK Bodenplatte')
d.text((62, 156), '   '.join(f'{k} {v}' for k, v in Counter(p['kat'] for p in T).most_common()), font=fnt(FM, 18), fill=WH)
d.line([60, 196, im.width - 60, 196], fill=SO, width=1)
for i, p in enumerate(T):
    c, r = divmod(i, per); x = 60 + c * cw; y = 214 + r * lh
    b = p.get('box') or p.get('bbox')
    dim = f'{b[3] - b[0]:.0f}×{b[4] - b[1]:.0f}×{b[5] - b[2]:.0f}' if b else ('Netz' if 'mesh' in p else '')
    d.text((x, y), f"{p['id']:<5}{p['kat'][:10]:<11}{p['name'][:38]:<39}{dim}", font=fnt(FM, 15), fill=WH if p['kat'] != 'ausschnitt' else SO)
papier(im).save(os.path.join(OUTD, f'1_STUECKLISTE_{TAG}.png'))

# ---------- 2 Ansichten ----------
A = [('elev_sued', 'ANSICHT SÜD · FRONT'), ('elev_west', 'ANSICHT WEST'), ('elev_ost', 'ANSICHT OST'),
     ('elev_nord', 'ANSICHT NORD · RÜCKSEITE'), ('drauf', 'DRAUFSICHT · RÖNTGEN')]
A = [a for a in A if os.path.exists(os.path.join(RD, f'BP3D_{a[0]}_{TAG}.png'))]
TW, TH, GAP = 1000, 750, 30
im, d = rahmen(120 + 3 * TW + 2 * GAP, 190 + 2 * (TH + 48) + GAP + 60, f'ANSICHTEN · {TITEL}',
               'Orthogonale Ansichten aus dem Bauplan-Modell · sichtbare Kanten weiß, verdeckte Kanten hellblau')
for i, (k, t) in enumerate(A):
    r, c = divmod(i, 3); x = 60 + c * (TW + GAP); y = 180 + r * (TH + 48 + GAP)
    d.text((x, y + 6), f'{i + 1:02d}  {t}', font=fnt(FB, 24), fill=WH)
    im.paste(cyanotype(k).resize((TW, TH), Image.LANCZOS), (x, y + 42)); d.rectangle([x, y + 42, x + TW - 1, y + 41 + TH], outline=SO)
schriftfeld(d, 60 + 2 * (TW + GAP) + 60, 180 + TH + 48 + GAP + 120, TW - 120, '2 / 3')
papier(im).save(os.path.join(OUTD, f'2_ANSICHTEN_{TAG}.png'))

# ---------- 3 3D vorne / hinten ----------
V = [('iso_sw', '3D VON VORNE · AXONOMETRIE SÜDWEST'), ('iso_no', '3D VON HINTEN · AXONOMETRIE NORDOST')]
TW, TH = 1500, 1125
im, d = rahmen(120 + 2 * TW + GAP, 190 + TH + 48 + 460, f'3D-SKIZZE · {TITEL}',
               'Röntgen-Wireframe: man sieht durch das Haus auf Decken, Treppe und Rückwand')
for i, (k, t) in enumerate(V):
    x = 60 + i * (TW + GAP); y = 180
    d.text((x, y + 6), t, font=fnt(FB, 28), fill=WH)
    im.paste(cyanotype(k).resize((TW, TH), Image.LANCZOS), (x, y + 46)); d.rectangle([x, y + 46, x + TW - 1, y + 45 + TH], outline=SO)
schriftfeld(d, im.width - 60 - 700, 180 + TH + 70, 700, '3 / 3')
papier(im).save(os.path.join(OUTD, f'3_3D_{TAG}.png'))
print('PAKET', OUTD)
