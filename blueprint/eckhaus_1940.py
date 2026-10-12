"""Blueprint-Skizze: Eckgebäude (Geschäftshaus um 1940) aus Referenzfoto.

Erzeugt eckhaus_1940.svg (Vektor). PNG-Export per Chromium headless.
Alle Maße sind aus dem Foto geschätzt (Maßstab 1:100, 1 m = S px).
"""
import math
import sys

# Stil: "blau" = Master Cyanotype (Standard), "neon" = Neon-Blueprint dunkel
STIL = sys.argv[1] if len(sys.argv) > 1 else "blau"

S = 38            # px pro Meter (1:100 Darstellung)
W, H = 1800, 1380
if STIL == "neon":       # dunkle Fassaden, fast schwarzer Grund, leuchtende Fenster, Cyan-Konturen
    PAGE, BG, LN, GLAS = "#03060c", "#0a1322", "#7fdcff", "url(#glas)"
else:                    # Master Cyanotype Kobalt (Bauplan-Brain, Abschnitt 31)
    PAGE = BG = GLAS = "#0044b8"
    LN = "#ffffff"

out = []


def add(s):
    out.append(s)


def m(v):
    return v * S


def line(x1, y1, x2, y2, w=1.2, op=1, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
        f'stroke="{LN}" stroke-width="{w}" stroke-opacity="{op}"{d}/>')


def rect(x, y, w, h, sw=1.2, fill=BG, op=1, fop=1):
    add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
        f'fill="{fill}" fill-opacity="{fop}" stroke="{LN}" stroke-width="{sw}" stroke-opacity="{op}"/>')


def path(d, sw=1.2, fill=BG, op=1, fop=1):
    add(f'<path d="{d}" fill="{fill}" fill-opacity="{fop}" stroke="{LN}" '
        f'stroke-width="{sw}" stroke-opacity="{op}" stroke-linejoin="round"/>')


def text(x, y, s, size=13, anchor="start", weight="normal", op=1, rot=None, ls=0):
    r = f' transform="rotate({rot} {x:.1f} {y:.1f})"' if rot is not None else ""
    add(f'<text x="{x:.1f}" y="{y:.1f}" fill="{LN}" fill-opacity="{op}" font-size="{size}" '
        f'font-family="DejaVu Sans Condensed, DejaVu Sans, sans-serif" text-anchor="{anchor}" '
        f'font-weight="{weight}" letter-spacing="{ls}"{r}>{s}</text>')


def tick(x, y):
    line(x - 4, y + 4, x + 4, y - 4, 1.4)


def hdim(x1, x2, y, label, ext_from=None):
    line(x1, y, x2, y, 0.9, 0.9)
    tick(x1, y)
    tick(x2, y)
    if ext_from is not None:
        line(x1, ext_from, x1, y + 6, 0.6, 0.6)
        line(x2, ext_from, x2, y + 6, 0.6, 0.6)
    text((x1 + x2) / 2, y - 5, label, 12, "middle")


def level(x, y, label, left=True):
    """Höhenkote (Dreieck + Text)."""
    path(f"M{x:.1f},{y:.1f} l-6,-9 h12 z", 1, BG)
    line(x - 30 if left else x - 10, y, x + 10 if left else x + 30, y, 0.8)
    text(x + (-36 if left else 36), y - 4, label, 11, "end" if left else "start")


def leader(x1, y1, x2, y2, label, anchor="start"):
    add(f'<circle cx="{x1:.1f}" cy="{y1:.1f}" r="2.5" fill="{LN}"/>')
    line(x1, y1, x2, y2, 0.8, 0.9)
    hx = x2 + (60 if anchor == "start" else -60)
    line(x2, y2, hx, y2, 0.8, 0.9)
    tx = x2 + 2 if anchor == "start" else x2 - 2
    text(tx, y2 - 4, label, 11, anchor)


# ---------------------------------------------------------------- Fassade
def elevation(x0, yg, width, bays, win_w, door_bay, title, lamp_at=None,
              notes=False):
    """Zeichnet eine Fassade. x0 = linke Kante, yg = Geländelinie (px)."""
    Y = lambda h: yg - m(h)          # Höhe in m -> y px
    X = lambda v: x0 + m(v)          # Abstand in m -> x px
    pier = 0.8                       # Eckpfeiler
    pil = 0.45                       # Zwischenpfeiler
    inner = width - 2 * pier
    bay = inner / bays

    # Geländelinie + Gehweg
    line(X(-1.5), yg, X(width + 1.5), yg, 2.2)
    for i in range(int((width + 3) / 0.6)):
        xx = X(-1.5) + i * m(0.6)
        line(xx, yg, xx - 8, yg + 8, 0.6, 0.5)

    # Brandwand-Silhouette (Gesamtumriss)
    rect(X(0), Y(10.4), m(width), m(10.4), 2.2)

    # Ziegelschraffur (wird von Bauteilen überdeckt)
    hb = 0.0
    while hb < 10.4:
        line(X(0), Y(hb), X(width), Y(hb), 0.4, 0.22)
        hb += 0.22

    # Sockel Naturstein
    rect(X(0), Y(0.5), m(width), m(0.5), 1.4)
    for i in range(int(width / 1.2) + 1):
        line(X(i * 1.2), Y(0.5), X(i * 1.2), yg, 0.6, 0.6)

    # --- Erdgeschoss: Schaufenster je Achse
    for b in range(bays):
        bx = pier + b * bay + pil / 2
        bw = bay - pil
        # Sturz / Rahmen
        rect(X(bx), Y(4.2), m(bw), m(3.7), 1.4)
        # Oberlicht (Transom) mit Sprossen
        rect(X(bx + 0.1), Y(4.1), m(bw - 0.2), m(0.6), 0.9, GLAS)
        n = max(3, int(bw / 0.5))
        for k in range(1, n):
            xx = X(bx + 0.1 + k * (bw - 0.2) / n)
            line(xx, Y(4.1), xx, Y(3.5), 0.6, 0.8)
        if b == door_bay:
            # Tür mittig, seitliche Schaufenster
            dw = 1.1
            dx = bx + (bw - dw) / 2
            for sx, sw in ((bx + 0.1, dx - bx - 0.25), (dx + dw + 0.15, bx + bw - dx - dw - 0.25)):
                rect(X(sx), Y(3.4), m(sw), m(2.3), 0.9, GLAS)    # Glas
                rect(X(sx), Y(1.1), m(sw), m(0.6), 0.9)          # Brüstungspaneel
                rect(X(sx + 0.1), Y(1.0), m(sw - 0.2), m(0.4), 0.5)
                for k in range(3):                              # Spiegelung
                    gx = X(sx) + m(sw) * (0.25 + k * 0.12)
                    line(gx, Y(3.1), gx + 14, Y(3.3), 0.6, 0.35)
            rect(X(dx), Y(3.4), m(dw), m(2.9), 1.3)               # Tür
            rect(X(dx + 0.15), Y(3.25), m(dw - 0.3), m(1.6), 0.8, GLAS)
            rect(X(dx + 0.15), Y(1.4), m(dw - 0.3), m(0.7), 0.6)
            add(f'<circle cx="{X(dx + dw - 0.2):.1f}" cy="{Y(1.6):.1f}" r="2.2" fill="none" stroke="{LN}"/>')
        else:
            rect(X(bx + 0.1), Y(3.4), m(bw - 0.2), m(2.3), 0.9, GLAS)
            mid = bx + bw / 2
            line(X(mid), Y(3.4), X(mid), Y(1.1), 0.8)
            rect(X(bx + 0.1), Y(1.1), m(bw - 0.2), m(0.6), 0.9)
            for half in (0, 1):
                px = bx + 0.2 + half * (bw / 2 - 0.1)
                rect(X(px), Y(1.0), m(bw / 2 - 0.3), m(0.4), 0.5)
            for k in range(3):
                gx = X(bx + 0.1) + m(bw - 0.2) * (0.2 + k * 0.08)
                line(gx, Y(3.0), gx + 18, Y(3.3), 0.6, 0.35)
            # Wandleuchte über Schaufenster
            add(f'<path d="M{X(mid)-6:.1f},{Y(3.45):.1f} h12 l-3,6 h-6 z" fill="{BG}" stroke="{LN}" stroke-width="0.8"/>')

    # Pfeiler EG (Ziegel sichtbar -> nur Kanten)
    for b in range(bays + 1):
        if b in (0, bays):
            continue
        px = pier + b * bay - pil / 2
        line(X(px), Y(4.2), X(px), Y(0.5), 0.9)
        line(X(px + pil), Y(4.2), X(px + pil), Y(0.5), 0.9)

    # Gurtgesims / Schildband
    rect(X(-0.05), Y(4.45), m(width + 0.1), m(0.25), 1.4)
    rect(X(0.4), Y(4.85), m(width - 0.8), m(0.4), 0.9)
    rect(X(-0.1), Y(4.95), m(width + 0.2), m(0.1), 1.2)

    # --- Obergeschoss: Rundbogenfenster
    for b in range(bays):
        cx = pier + b * bay + bay / 2
        x1, x2 = cx - win_w / 2, cx + win_w / 2
        r = win_w / 2
        top = 7.6 if win_w > 1.4 else 7.8
        # Fensterbank
        rect(X(x1 - 0.2), Y(5.75), m(win_w + 0.4), m(0.18), 1.2)
        rect(X(x1 - 0.1), Y(5.6), m(win_w + 0.2), m(0.07), 0.6, op=0.7)
        # Bogen-Überdachung (Stein-Hood) mit Ohren
        hr = r + 0.22
        path(f"M{X(cx - hr - 0.15):.1f},{Y(top):.1f} h{m(0.15):.1f} "
             f"A{m(hr):.1f},{m(hr):.1f} 0 0 1 {X(cx + hr):.1f},{Y(top):.1f} "
             f"h{m(0.15):.1f} v{-m(0.18):.1f} h{-m(0.15):.1f} "
             f"A{m(hr + 0.08):.1f},{m(hr + 0.08):.1f} 0 0 0 {X(cx - hr):.1f},{Y(top + 0.18):.1f} "
             f"h{-m(0.15):.1f} z", 1.2)
        # Schlussstein
        ks = Y(top + hr + 0.2)
        path(f"M{X(cx - 0.17):.1f},{ks:.1f} h{m(0.34):.1f} l{-m(0.06):.1f},{m(0.42):.1f} "
             f"h{-m(0.22):.1f} z", 1.2)
        # Fensteröffnung
        path(f"M{X(x1):.1f},{Y(5.75):.1f} V{Y(top):.1f} "
             f"A{m(r):.1f},{m(r):.1f} 0 0 1 {X(x2):.1f},{Y(top):.1f} V{Y(5.75):.1f} z", 1.5, GLAS)
        # Rahmen innen
        rr = r - 0.1
        path(f"M{X(x1 + 0.1):.1f},{Y(5.85):.1f} V{Y(top):.1f} "
             f"A{m(rr):.1f},{m(rr):.1f} 0 0 1 {X(x2 - 0.1):.1f},{Y(top):.1f} V{Y(5.85):.1f} z", 0.7, GLAS)
        # Sprossen: Kämpfer + Mittelpfosten + Halbsprossen (2-über-2)
        mid_h = (5.85 + top) / 2 + 0.15
        line(X(x1 + 0.1), Y(mid_h), X(x2 - 0.1), Y(mid_h), 1.0)
        line(X(x1 + 0.1), Y(top), X(x2 - 0.1), Y(top), 0.7)
        line(X(cx), Y(5.85), X(cx), Y(top + rr), 0.8)
        line(X(x1 + 0.1), Y((5.85 + mid_h) / 2), X(x2 - 0.1), Y((5.85 + mid_h) / 2), 0.5, 0.7)
        line(X(x1 + 0.1), Y((mid_h + top) / 2), X(x2 - 0.1), Y((mid_h + top) / 2), 0.5, 0.7)
        # Spiegelung
        line(X(x1 + 0.25), Y(6.4), X(x1 + 0.45), Y(6.9), 0.6, 0.35)

    # --- Hauptgesims: Konsolfries, Zahnschnitt, Abdeckung
    rect(X(0), Y(9.1), m(width), m(0.12), 1.0)
    cx_ = 0.5
    while cx_ < width - 0.5:
        path(f"M{X(cx_):.1f},{Y(9.1):.1f} v{-m(0.35):.1f} h{m(0.28):.1f} v{m(0.35):.1f} "
             f"l{-m(0.06):.1f},{m(0.12):.1f} h{-m(0.16):.1f} z", 0.8)
        cx_ += 0.6
    rect(X(-0.1), Y(9.6), m(width + 0.2), m(0.15), 1.2)
    dx_ = 0.1
    while dx_ < width - 0.1:
        rect(X(dx_), Y(9.85), m(0.12), m(0.2), 0.6)
        dx_ += 0.24
    rect(X(-0.15), Y(10.0), m(width + 0.3), m(0.15), 1.2)
    rect(X(-0.2), Y(10.4), m(width + 0.4), m(0.15), 1.5)

    # --- Eckpfeiler (Lisenen) bis über Attika
    for px in (0, width - pier):
        rect(X(px), Y(10.9), m(pier), m(10.9 - 0.5), 1.6, fop=0)
        rect(X(px - 0.08), Y(11.1), m(pier + 0.16), m(0.2), 1.6)
        rect(X(px - 0.04), Y(10.9), m(pier + 0.08), m(0.08), 0.9)
        # Steinbänder im Pfeiler
        for hh in (4.2, 6.6, 9.1):
            rect(X(px), Y(hh + 0.18), m(pier), m(0.18), 0.9)
        # Ziegelversatz andeuten
        hb = 0.7
        k = 0
        while hb < 10.7:
            off = 0.2 if k % 2 else 0.45
            line(X(px + off), Y(hb), X(px + off), Y(hb + 0.22), 0.4, 0.35)
            hb += 0.22
            k += 1

    # --- Markise (gestreift, mit Volant) über allen Achsen
    a_top, a_bot, a_val = 4.15, 3.05, 0.25
    ax1, ax2 = pier + 0.05, width - pier - 0.05
    path(f"M{X(ax1):.1f},{Y(a_top):.1f} H{X(ax2):.1f} V{Y(a_bot):.1f} H{X(ax1):.1f} z", 1.4)
    sw_ = 0.32
    sx_ = ax1
    k = 0
    while sx_ < ax2 - 0.01:
        e = min(sx_ + sw_, ax2)
        if k % 2 == 0:
            add(f'<rect x="{X(sx_):.1f}" y="{Y(a_top):.1f}" width="{m(e - sx_):.1f}" '
                f'height="{m(a_top - a_bot):.1f}" fill="{LN}" fill-opacity="0.18"/>')
        line(X(sx_), Y(a_top), X(sx_), Y(a_bot), 0.5, 0.8)
        sx_ += sw_
        k += 1
    # Volant mit Bögen
    d = f"M{X(ax1):.1f},{Y(a_bot):.1f}"
    sx_ = ax1
    while sx_ < ax2 - 0.01:
        e = min(sx_ + sw_, ax2)
        d += f" V{Y(a_bot - a_val + 0.06):.1f} Q{X((sx_ + e) / 2):.1f},{Y(a_bot - a_val - 0.08):.1f} {X(e):.1f},{Y(a_bot - a_val + 0.06):.1f}"
        sx_ = e
    d += f" V{Y(a_bot):.1f} z"
    path(d, 1.0, fop=1)
    # Markisenarme
    for ax in (ax1 + 0.3, ax2 - 0.3):
        line(X(ax), Y(4.3), X(ax), Y(a_bot), 0.6, 0.6, "4 3")

    # --- Kandelaber
    if lamp_at is not None:
        lx = X(lamp_at)
        rect(lx - m(0.25), Y(0.4), m(0.5), m(0.4), 1.2)
        path(f"M{lx - m(0.18):.1f},{Y(0.4):.1f} L{lx - m(0.07):.1f},{Y(1.4):.1f} "
             f"V{Y(4.0):.1f} H{lx + m(0.07):.1f} V{Y(1.4):.1f} L{lx + m(0.18):.1f},{Y(0.4):.1f} z", 1.2)
        for hh in (1.4, 2.6, 3.9):
            rect(lx - m(0.12), Y(hh + 0.08), m(0.24), m(0.08), 0.8)
        rect(lx - m(0.14), Y(4.15), m(0.28), m(0.15), 1.0)
        add(f'<circle cx="{lx:.1f}" cy="{Y(4.5):.1f}" r="{m(0.33):.1f}" fill="{BG}" stroke="{LN}" stroke-width="1.3"/>')
        add(f'<path d="M{lx - 4:.1f},{Y(4.83):.1f} h8 l-4,-6 z" fill="{LN}"/>')
        for a in range(0, 360, 45):     # Lichtstrahlen
            r1, r2 = m(0.45), m(0.62)
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            line(lx + r1 * ca, Y(4.5) + r1 * sa, lx + r2 * ca, Y(4.5) + r2 * sa, 0.6, 0.5)

    # --- Bemaßung
    yd = yg + m(1.15)
    hdim(X(0), X(width), yd + 22, f"{width:.2f}".replace(".", ",") + " m", ext_from=yg + 4)
    xs = [0, pier] + [pier + (b + 1) * bay for b in range(bays)] + [width]
    xs = sorted(set(round(v, 3) for v in xs))
    for a, b in zip(xs, xs[1:]):
        hdim(X(a), X(b), yd, f"{b - a:.2f}".replace(".", ","))
    # Höhenkoten links
    lx_ = X(-0.6)
    for hh, lab in ((0, "±0,00"), (4.2, "+4,20"), (9.1, "+9,10"), (10.55, "+10,55"), (11.1, "+11,10")):
        level(lx_, Y(hh), lab)

    # Titel
    text(X(width / 2), Y(12.3), title, 17, "middle", "bold", ls=2)
    line(X(width / 2) - 150, Y(12.3) + 7, X(width / 2) + 150, Y(12.3) + 7, 1.2)
    text(X(width / 2), Y(12.3) + 24, "M 1:100", 11, "middle", op=0.85)
    return X, Y


# ---------------------------------------------------------------- Kopf + Raster
add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
add(f'<rect width="{W}" height="{H}" fill="{PAGE}"/>')
if STIL == "neon":
    add('<defs><linearGradient id="glas" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#3d8cff"/><stop offset="1" stop-color="#0d3a9a"/></linearGradient>'
        '<filter id="glow" x="-5%" y="-5%" width="110%" height="110%">'
        '<feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b1"/>'
        '<feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b2"/>'
        '<feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>'
        '</filter></defs>')
    add('<g filter="url(#glow)">')
add('<defs><radialGradient id="vig" cx="50%" cy="45%" r="75%">'
    '<stop offset="60%" stop-color="#000" stop-opacity="0"/>'
    '<stop offset="100%" stop-color="#000" stop-opacity="0.28"/></radialGradient></defs>')
for gx in range(0, W, 19):
    line(gx, 0, gx, H, 0.5 if gx % 95 else 0.9, 0.07 if gx % 95 else 0.13)
for gy in range(0, H, 19):
    line(0, gy, W, gy, 0.5 if gy % 95 else 0.9, 0.07 if gy % 95 else 0.13)
# Blattrahmen
rect(24, 24, W - 48, H - 48, 2.5, fop=0)
rect(32, 32, W - 64, H - 64, 0.8, fop=0)

text(60, 82, "ECKGEBÄUDE · GESCHÄFTSHAUS UM 1940", 28, weight="bold", ls=3)
text(62, 106, "Blueprint-Skizze nach Referenzfoto · Ansichten &amp; Grundriss Erdgeschoss", 14, op=0.85)

# ---------------------------------------------------------------- Ansichten
YG = 640
# Ansicht B: Seitenfassade (im Foto links, entlang der Straße)
elevation(150, YG, 12.0, 4, 1.15, door_bay=None, title="ANSICHT B · SEITENFASSADE",
          lamp_at=9.6)
# Ansicht A: Hauptfassade (im Foto rechts, zur Kreuzung)
XA, YA = elevation(800, YG, 18.0, 4, 1.6, door_bay=1, title="ANSICHT A · HAUPTFASSADE")

# Beschriftungen Hauptfassade
leader(XA(17.1), YA(9.9), XA(19.5), YA(11.5), "Hauptgesims mit Konsolfries")
leader(XA(15.6), YA(8.75), XA(19.5), YA(9.6), "Rundbogenfenster, Schlussstein")
leader(XA(17.6), YA(6.6), XA(19.5), YA(7.6), "Eckpfeiler Ziegel, Steinbänder")
leader(XA(16.0), YA(4.6), XA(19.5), YA(5.6), "Gurtgesims / Schildband")
leader(XA(15.2), YA(3.5), XA(19.5), YA(3.9), "Markise, gestreift")
leader(XA(14.0), YA(2.4), XA(19.5), YA(2.4), "Schaufenster m. Oberlicht")
leader(XA(16.6), YA(0.3), XA(19.5), YA(1.0), "Sockel Naturstein")

# ---------------------------------------------------------------- Grundriss EG
PX, PY = 150, 790          # linke obere Ecke (Rückseite)
PW, PD = 18.0, 12.0        # Hauptfassade = unten, Seitenfassade = links
T = 0.4
GX = lambda v: PX + m(v)
GY = lambda v: PY + m(v)

text(GX(PW / 2), PY - 22, "GRUNDRISS ERDGESCHOSS", 17, "middle", "bold", ls=2)
line(GX(PW / 2) - 130, PY - 15, GX(PW / 2) + 130, PY - 15, 1.2)

# Wandkörper (schraffiert)
add('<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" '
    f'patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="{LN}" '
    'stroke-width="1" stroke-opacity="0.75"/></pattern></defs>')
outer = f"M{GX(0)},{GY(0)} H{GX(PW)} V{GY(PD)} H{GX(0)} Z"
inner = f"M{GX(T)},{GY(T)} V{GY(PD - T)} H{GX(PW - T)} V{GY(T)} Z"
add(f'<path d="{outer} {inner}" fill="url(#hatch)" fill-rule="evenodd" stroke="{LN}" stroke-width="1.8"/>')

# Öffnungen Hauptfassade (unten) – Schaufenster
pier, pil = 0.8, 0.45
bayA = (PW - 2 * pier) / 4
for b in range(4):
    x1 = pier + b * bayA + pil / 2
    x2 = x1 + bayA - pil
    rect(GX(x1), GY(PD - T) - 0.5, m(x2 - x1), m(T) + 1, 0, fill=BG, op=0)
    line(GX(x1), GY(PD - T), GX(x1), GY(PD), 1.4)
    line(GX(x2), GY(PD - T), GX(x2), GY(PD), 1.4)
    if b == 1:   # Eingang mit Türschwenk
        dw = 1.1
        dx = x1 + (bayA - pil - dw) / 2
        for gx1, gx2 in ((x1, dx), (dx + dw, x2)):
            line(GX(gx1), GY(PD - T / 2) - 2, GX(gx2), GY(PD - T / 2) - 2, 0.8)
            line(GX(gx1), GY(PD - T / 2) + 2, GX(gx2), GY(PD - T / 2) + 2, 0.8)
        line(GX(dx), GY(PD - T), GX(dx), GY(PD - T - dw), 1.2)
        add(f'<path d="M{GX(dx):.1f},{GY(PD - T - dw):.1f} A{m(dw):.1f},{m(dw):.1f} 0 0 1 '
            f'{GX(dx + dw):.1f},{GY(PD - T):.1f}" fill="none" stroke="{LN}" stroke-width="0.7" stroke-dasharray="4 3"/>')
        text(GX(dx + dw / 2), GY(PD) + 34, "EINGANG", 11, "middle")
        path(f"M{GX(dx + dw / 2) - 6:.1f},{GY(PD) + 20:.1f} l6,-10 l6,10 z", 1, LN)
    else:
        line(GX(x1), GY(PD - T / 2) - 2, GX(x2), GY(PD - T / 2) - 2, 0.8)
        line(GX(x1), GY(PD - T / 2) + 2, GX(x2), GY(PD - T / 2) + 2, 0.8)

# Öffnungen Seitenfassade (links) – Schaufenster
bayB = (PD - 2 * pier) / 4
for b in range(4):
    y1 = pier + b * bayB + pil / 2
    y2 = y1 + bayB - pil
    rect(GX(0) - 0.5, GY(y1), m(T) + 1, m(y2 - y1), 0, fill=BG, op=0)
    line(GX(0), GY(y1), GX(T), GY(y1), 1.4)
    line(GX(0), GY(y2), GX(T), GY(y2), 1.4)
    line(GX(T / 2) - 2, GY(y1), GX(T / 2) - 2, GY(y2), 0.8)
    line(GX(T / 2) + 2, GY(y1), GX(T / 2) + 2, GY(y2), 0.8)

# Innenwand Lager / Nebenräume
add(f'<rect x="{GX(T):.1f}" y="{GY(4.0):.1f}" width="{m(PW - 2 * T):.1f}" height="{m(0.2):.1f}" '
    f'fill="url(#hatch)" stroke="{LN}" stroke-width="1.2"/>')
rect(GX(7.0), GY(3.9) - 1, m(1.0), m(0.2) + 2, 0, op=0)          # Durchgang
add(f'<path d="M{GX(7.0):.1f},{GY(4.0):.1f} A{m(1.0):.1f},{m(1.0):.1f} 0 0 1 {GX(8.0):.1f},{GY(3.0):.1f}" '
    f'fill="none" stroke="{LN}" stroke-width="0.7" stroke-dasharray="4 3"/>')
line(GX(8.0), GY(4.0), GX(8.0), GY(3.0), 1.2)
# WC
add(f'<rect x="{GX(13.0):.1f}" y="{GY(T):.1f}" width="{m(0.15):.1f}" height="{m(3.6):.1f}" '
    f'fill="url(#hatch)" stroke="{LN}" stroke-width="1"/>')
rect(GX(15.6), GY(1.2), m(0.5), m(0.7), 0.8)
add(f'<ellipse cx="{GX(15.85):.1f}" cy="{GY(2.2):.1f}" rx="{m(0.22):.1f}" ry="{m(0.3):.1f}" fill="{BG}" stroke="{LN}" stroke-width="0.8"/>')
# Treppe
sx0, sy0 = 9.0, T
for i in range(13):
    line(GX(sx0 + i * 0.28), GY(sy0), GX(sx0 + i * 0.28), GY(sy0 + 1.2), 0.7)
rect(GX(sx0), GY(sy0), m(3.4), m(1.2), 1.0, fop=0)
add(f'<path d="M{GX(sx0 + 0.1):.1f},{GY(sy0 + 0.6):.1f} H{GX(sx0 + 3.2):.1f}" stroke="{LN}" stroke-width="0.9" marker-end="url(#arr)"/>')
add(f'<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">'
    f'<path d="M0,0 L8,4 L0,8 z" fill="{LN}"/></marker></defs>')
text(GX(sx0 + 1.7), GY(sy0 + 1.6), "Treppe OG", 10, "middle", op=0.85)

# Stützen im Verkaufsraum
for cxm in (6.0, 12.0):
    rect(GX(cxm) - 5, GY(8.0) - 5, 10, 10, 1.2, fill=LN, fop=0.6)
for cxm in (6.0, 12.0):
    line(GX(cxm), GY(4.3), GX(cxm), GY(PD - 0.5), 0.5, 0.45, "10 4 2 4")
line(GX(0.5), GY(8.0), GX(PW - 0.5), GY(8.0), 0.5, 0.45, "10 4 2 4")
# Ladentheke
rect(GX(11.0), GY(5.2), m(5.5), m(0.6), 1.0)
rect(GX(16.5) - m(0.6), GY(5.2), m(0.6), m(2.2), 1.0)
# Regale an der Wand
rect(GX(PW - T - 0.5), GY(4.6), m(0.5), m(6.4), 0.8)
for i in range(1, 8):
    line(GX(PW - T - 0.5), GY(4.6 + i * 0.8), GX(PW - T), GY(4.6 + i * 0.8), 0.5, 0.7)

text(GX(8.5), GY(9.0), "VERKAUFSRAUM", 15, "middle", "bold", ls=2)
text(GX(8.5), GY(9.0) + 18, "ca. 125 m²", 11, "middle", op=0.85)
text(GX(4.0), GY(2.3), "LAGER", 13, "middle", "bold", ls=2)
text(GX(4.0), GY(2.3) + 16, "ca. 22 m²", 11, "middle", op=0.85)
text(GX(15.5), GY(3.4), "WC", 11, "middle", "bold")
text(GX(13.75), GY(5.0) - 4, "Theke", 10, "middle", op=0.85)

# Bemaßung Grundriss
hdim(GX(0), GX(PW), GY(PD) + 70, "18,00 m", ext_from=GY(PD) + 4)
line(GX(PW) + 40, GY(0), GX(PW) + 40, GY(PD), 0.9)
tick(GX(PW) + 40, GY(0))
tick(GX(PW) + 40, GY(PD))
line(GX(PW) + 4, GY(0), GX(PW) + 46, GY(0), 0.6, 0.6)
line(GX(PW) + 4, GY(PD), GX(PW) + 46, GY(PD), 0.6, 0.6)
text(GX(PW) + 34, GY(PD / 2), "12,00 m", 12, "middle", rot=-90)

# Ansichtspfeile A / B
def view_marker(x, y, lab, angle):
    add(f'<g transform="translate({x:.1f},{y:.1f}) rotate({angle})">'
        f'<circle r="13" fill="{BG}" stroke="{LN}" stroke-width="1.4"/>'
        f'<path d="M-13,0 A13,13 0 0 1 13,0 L0,-24 Z" fill="{LN}"/></g>')
    text(x, y + 4.5, lab, 12, "middle", "bold")
view_marker(GX(12.5), GY(PD) + 40, "", 0)
text(GX(12.5), GY(PD) + 44.5, "A", 12, "middle", "bold")
view_marker(GX(0) - 46, GY(PD / 2), "", 90)
text(GX(0) - 46, GY(PD / 2) + 4.5, "B", 12, "middle", "bold")

# Nordpfeil
nx, ny = GX(PW) + 120, GY(1.3)
add(f'<circle cx="{nx}" cy="{ny}" r="26" fill="none" stroke="{LN}" stroke-width="1.2"/>')
add(f'<path d="M{nx},{ny - 32} L{nx + 9},{ny + 14} L{nx},{ny + 6} L{nx - 9},{ny + 14} Z" fill="{LN}"/>')
text(nx, ny - 38, "N", 14, "middle", "bold")

# Ecke / Kreuzung Hinweis
text(GX(0) - 18, GY(PD) + 52, "KREUZUNG", 10, "end", op=0.8, ls=1)
line(GX(0) - 8, GY(PD) + 8, GX(0) - 2, GY(PD) + 2, 0.8, 0.8)

# ---------------------------------------------------------------- Legende + Schriftfeld
LX, LY = 1110, 880
rect(LX, LY, 650, 170, 1.4, fop=0)
text(LX + 16, LY + 26, "LEGENDE &amp; HINWEISE", 13, weight="bold", ls=2)
add(f'<rect x="{LX + 18}" y="{LY + 42}" width="36" height="16" fill="url(#hatch)" stroke="{LN}"/>')
text(LX + 66, LY + 55, "Mauerwerk Ziegel, tragend (geschnitten)", 11)
line(LX + 18, LY + 76, LX + 54, LY + 76, 0.8); line(LX + 18, LY + 80, LX + 54, LY + 80, 0.8)
text(LX + 66, LY + 82, "Schaufenster / Verglasung", 11)
line(LX + 18, LY + 102, LX + 54, LY + 102, 0.6, 0.6, "10 4 2 4")
text(LX + 66, LY + 106, "Achsraster / Stützenachse", 11)
for i, s in enumerate([
        "Maße aus Foto geschätzt, Perspektive entzerrt.",
        "Geschosshöhen typisch für Bauzeit um 1940.",
        "Skizze – keine Bauvorlage, kein Aufmaß.",
        "Grundriss-Aufteilung frei interpretiert."]):
    text(LX + 360, LY + 55 + i * 22, s, 11, op=0.9)
line(LX + 340, LY + 40, LX + 340, LY + 150, 0.6, 0.6)

TX, TY = 1110, 1080
rect(TX, TY, 650, 250, 2, fop=0)
rows = [(TY, 60), (TY + 60, 48), (TY + 108, 48), (TY + 156, 48), (TY + 204, 46)]
for y, h in rows[1:]:
    line(TX, y, TX + 650, y, 1)
line(TX + 325, TY + 60, TX + 325, TY + 250, 1)
text(TX + 18, TY + 38, "BAUPLAN · ECKGEBÄUDE 1940", 22, weight="bold", ls=2)

def cell(x, y, k, v):
    text(x + 12, y + 17, k, 9, op=0.7, ls=1)
    text(x + 12, y + 38, v, 14, weight="bold")

cell(TX, TY + 60, "ZEICHNUNG", "Ansichten A/B + Grundriss EG")
cell(TX + 325, TY + 60, "MASSSTAB", "1:100 (Skizze)")
cell(TX, TY + 108, "GEBÄUDETYP", "Wohn- &amp; Geschäftshaus, 2-gesch.")
cell(TX + 325, TY + 108, "BAUSTIL", "Ziegel-Gründerzeit / Main Street")
cell(TX, TY + 156, "QUELLE", "Referenzfoto „1940“")
cell(TX + 325, TY + 156, "DATUM", "12.10.2026")
cell(TX, TY + 204, "GEZEICHNET", "Bauplan-App · KI-Skizze")
cell(TX + 325, TY + 204, "BLATT", "1 / 2")

if STIL == "neon":
    add('</g>')
# Sonnendruck-Papier: Flecken + Korn (nur Cyanotype)
if STIL != "neon":
  add('<filter id="flecken" x="0" y="0" width="100%" height="100%">'
    '<feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="7"/>'
    '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0.05  0 0 0 0 0.2  0 0 0 0.9 -0.3"/></filter>'
    '<filter id="korn" x="0" y="0" width="100%" height="100%">'
    '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>'
    '<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.12 0"/></filter>')
  add(f'<rect width="{W}" height="{H}" filter="url(#flecken)"/>')
  add(f'<rect width="{W}" height="{H}" filter="url(#korn)"/>')
add(f'<rect width="{W}" height="{H}" fill="url(#vig)"/>')
add("</svg>")

ziel = __file__.replace(".py", "_neon.svg" if STIL == "neon" else ".svg")
with open(ziel, "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("ok")
