"""Lichtpause-Gravur: Foto -> Cyanotype-Blueprint im Kupferstich-Stil.

Nachbau des Brain-Standards (02_Bauplan_Brain, Abschnitt 31 + "Lichtpause-Gravur"):
Kanten in drei Maßstäben, helle Flächen als belichtetes Papier, Diagonal-
schraffur in Glas/Schatten, Himmel beruhigt, Zeichenraster nur auf freien
Flächen, Zirkelbögen oben rechts, Maßlinie unten, Doppelrahmen, Papierkorn,
Vignette, Kobaltblau #0044B8 mit Sonnendruck-Flecken. Deterministisch (Seed).

Aufruf: python lichtpause_gravur.py <foto.png> <out.png> [--crop x0,y0,x1,y1] [--seed N]
"""
import argparse

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BLAU = (0x00, 0x44, 0xB8)          # Master Cyanotype Kobalt (RGB)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def xdog(g, sigma, k=1.6, p=22.0, eps=0.0, phi=12.0):
    """Extended Difference of Gaussians -> tuschartige Linien (0..1, 1 = Linie)."""
    a = cv2.GaussianBlur(g, (0, 0), sigma)
    b = cv2.GaussianBlur(g, (0, 0), sigma * k)
    d = (1 + p) * a - p * b
    e = np.where(d >= eps, 1.0, 1.0 + np.tanh(phi * (d - eps)))
    return np.clip(1.0 - e, 0, 1)


def hatch(h, w, spacing, angle, width=1):
    img = np.zeros((h, w), np.uint8)
    diag = int(np.hypot(h, w))
    c, s = np.cos(np.radians(angle)), np.sin(np.radians(angle))
    for t in range(-diag, diag, spacing):
        x0, y0 = w / 2 + t * c - diag * s, h / 2 + t * s + diag * c
        x1, y1 = w / 2 + t * c + diag * s, h / 2 + t * s - diag * c
        cv2.line(img, (int(x0), int(y0)), (int(x1), int(y1)), 255, width, cv2.LINE_AA)
    return img.astype(np.float32) / 255


def smooth_noise(h, w, scale, rng):
    n = rng.random((max(2, h // scale), max(2, w // scale))).astype(np.float32)
    n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
    return cv2.GaussianBlur(n, (0, 0), scale / 2)


def gravur(rgb, seed=7):
    rng = np.random.default_rng(seed)
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    roh = g.astype(np.float32) / 255           # ohne Kontrastanhebung (für Himmelmaske)
    g = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(g)
    gf = g.astype(np.float32) / 255
    h, w = g.shape

    # --- Kanten in drei Maßstäben (fein/mittel/grob)
    fein = xdog(gf, 0.8, p=30, phi=18)
    mittel = xdog(gf, 1.6, p=24, phi=14)
    grob = cv2.Canny(cv2.GaussianBlur(g, (0, 0), 3.0), 30, 80).astype(np.float32) / 255
    grob = cv2.dilate(grob, np.ones((2, 2), np.uint8))
    linien = np.clip(0.55 * fein + 0.8 * mittel + 0.9 * grob, 0, 1)

    # --- Himmel beruhigen: helle, texturarme Fläche, von oben zusammenhängend
    blur = cv2.GaussianBlur(roh, (0, 0), 6)
    gx = cv2.Sobel(cv2.GaussianBlur(roh, (0, 0), 2), cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(cv2.GaussianBlur(roh, (0, 0), 2), cv2.CV_32F, 0, 1)
    textur = cv2.GaussianBlur(np.hypot(gx, gy), (0, 0), 8)
    kand = ((blur > 0.6) & (textur < 0.12)).astype(np.uint8)
    kand = cv2.morphologyEx(kand, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab = cv2.connectedComponents(kand)
    himmel = np.zeros_like(kand)
    for i in np.unique(lab[:5, :]):
        if i:
            himmel[lab == i] = 1
    himmel = cv2.GaussianBlur(himmel.astype(np.float32), (0, 0), 10)
    print('Himmelanteil', round(float(himmel.mean()), 3))
    linien *= (1 - 0.85 * himmel)

    # --- Schraffur in dunklen Flächen (Glas, Schatten): Dichte nach Dunkelheit
    dunkel = 1 - cv2.GaussianBlur(gf, (0, 0), 2.5)
    h1 = hatch(h, w, 7, 45)
    h2 = hatch(h, w, 7, -45)
    h3 = hatch(h, w, 4, 45)
    schraffur = (h1 * np.clip((dunkel - 0.45) * 4, 0, 1)
                 + h2 * np.clip((dunkel - 0.62) * 4, 0, 1)
                 + h3 * np.clip((dunkel - 0.78) * 5, 0, 1))
    schraffur = np.clip(schraffur, 0, 1) * 0.55 * (1 - himmel)

    # --- belichtetes Papier: helle Flächen leicht aufgehellt
    papier = np.clip((cv2.GaussianBlur(gf, (0, 0), 4) - 0.55) * 1.4, 0, 0.35) * (1 - himmel)

    # --- Zeichenraster nur dort, wo das Bild frei ist
    belegt = cv2.GaussianBlur(linien + schraffur, (0, 0), 14)
    frei = np.clip(1 - belegt * 4, 0, 1)
    raster = np.zeros((h, w), np.float32)
    step = max(24, w // 48)
    raster[:, ::step] = 1
    raster[::step, :] = 1
    raster[:, ::step * 5] = 2
    raster[::step * 5, :] = 2
    raster = np.clip(raster, 0, 2) * 0.09 * frei

    weiss = np.clip(linien * 0.95 + schraffur + papier + raster, 0, 1)

    # --- Kobaltgrund mit Sonnendruck-Flecken, Papierkorn, Vignette
    base = np.empty((h, w, 3), np.float32)
    base[:] = np.array(BLAU, np.float32) / 255
    flecken = smooth_noise(h, w, 90, rng) - 0.5
    base *= (1 + 0.22 * flecken)[..., None]
    korn = rng.normal(0, 0.025, (h, w)).astype(np.float32)
    leinwand = (hatch(h, w, 3, 0) * 0.5 + hatch(h, w, 3, 90) * 0.5) * 0.025
    base += (korn + leinwand)[..., None]
    yy, xx = np.mgrid[0:h, 0:w]
    vig = 1 - 0.35 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / 2
    base *= vig[..., None]

    tinte = np.array([0.97, 0.98, 1.0], np.float32)
    out = base * (1 - weiss[..., None]) + tinte * weiss[..., None]
    return (np.clip(out, 0, 1) * 255).astype(np.uint8)


def blatt(img, titel, unter):
    """Doppelrahmen, Zirkelbögen oben rechts, Maßlinie unten, Schriftfeld."""
    h, w = img.shape[:2]
    M, FOOT = 60, 170
    W, H = w + 2 * M, h + M + FOOT
    rng = np.random.default_rng(3)
    bg = np.empty((H, W, 3), np.float32)
    bg[:] = np.array(BLAU, np.float32) / 255
    bg *= (1 + 0.2 * (smooth_noise(H, W, 110, rng) - 0.5))[..., None]
    bg += rng.normal(0, 0.025, (H, W)).astype(np.float32)[..., None]
    sheet = Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8))
    sheet.paste(Image.fromarray(img), (M, M))
    d = ImageDraw.Draw(sheet, "RGBA")
    wcol = (245, 248, 255, 255)
    soft = (245, 248, 255, 150)

    d.rectangle([18, 18, W - 19, H - 19], outline=wcol, width=4)
    d.rectangle([30, 30, W - 31, H - 31], outline=wcol, width=1)
    d.rectangle([M, M, M + w, M + h], outline=wcol, width=2)

    # Zirkelbögen oben rechts
    cx, cy = M + w - 40, M + 40
    for r in (120, 190, 260, 330):
        d.arc([cx - r, cy - r, cx + r, cy + r], 90, 180, fill=soft, width=2)
    d.line([cx - 345, cy, cx + 10, cy], fill=soft, width=1)
    d.line([cx, cy - 10, cx, cy + 345], fill=soft, width=1)
    for a in range(95, 180, 15):
        t = np.radians(a)
        d.line([cx + 325 * np.cos(t), cy + 325 * np.sin(t),
                cx + 340 * np.cos(t), cy + 340 * np.sin(t)], fill=wcol, width=1)
    d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], outline=wcol, width=2)

    # Maßlinie unten unter dem Bild
    y = M + h + 34
    d.line([M, y, M + w, y], fill=wcol, width=1)
    for x in (M, M + w):
        d.line([x, M + h + 8, x, y + 10], fill=soft, width=1)
        d.line([x - 7, y + 7, x + 7, y - 7], fill=wcol, width=2)
    for i in range(1, 10):
        x = M + w * i / 10
        d.line([x, y - 5, x, y + 5], fill=wcol, width=1)
    f_s = ImageFont.truetype(FONT, 18)
    d.text((M + w / 2, y - 8), "ca. 18,00 m  ·  Hauptfassade (perspektivisch)", font=f_s,
           fill=wcol, anchor="ms")

    # Schriftfeld
    f_t = ImageFont.truetype(FONT_B, 34)
    f_u = ImageFont.truetype(FONT, 18)
    ty = H - FOOT + 60
    d.text((M, ty), titel, font=f_t, fill=wcol)
    d.text((M + 2, ty + 48), unter, font=f_u, fill=(235, 242, 255, 220))
    bx = W - M - 430
    d.rectangle([bx, ty - 6, W - M, ty + 80], outline=wcol, width=2)
    d.line([bx, ty + 37, W - M, ty + 37], fill=wcol, width=1)
    d.line([bx + 215, ty - 6, bx + 215, ty + 80], fill=wcol, width=1)
    f_k = ImageFont.truetype(FONT, 12)
    f_v = ImageFont.truetype(FONT_B, 16)
    for (x, yy, k, v) in ((bx, ty - 6, "STIL", "Lichtpause-Gravur"), (bx + 215, ty - 6, "BLAU", "#0044B8 Kobalt"),
                          (bx, ty + 37, "DATUM", "12.10.2026"), (bx + 215, ty + 37, "BLATT", "2 / 2")):
        d.text((x + 10, yy + 5), k, font=f_k, fill=(235, 242, 255, 170))
        d.text((x + 10, yy + 19), v, font=f_v, fill=wcol)
    return sheet


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("foto")
    ap.add_argument("out")
    ap.add_argument("--crop", default=None, help="x0,y0,x1,y1 in Originalpixeln")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--breite", type=int, default=1500)
    a = ap.parse_args()

    rgb = np.array(Image.open(a.foto).convert("RGB"))
    if a.crop:
        x0, y0, x1, y1 = map(int, a.crop.split(","))
        rgb = rgb[y0:y1, x0:x1]
    s = a.breite / rgb.shape[1]
    rgb = cv2.resize(rgb, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
    g = gravur(rgb, a.seed)
    blatt(g, "ECKGEBÄUDE 1940 · LICHTPAUSE-GRAVUR",
          "Cyanotype nach Referenzfoto · Master-Standard Bauplan-Brain").save(a.out)
    print("ok", a.out)
