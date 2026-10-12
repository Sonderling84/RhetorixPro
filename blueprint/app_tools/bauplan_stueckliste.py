# -*- coding: utf-8 -*-
# BAUPLAN-STUECKLISTE: aus einer Hausbeschreibung (haus_*.json) den NUMMERIERTEN Bauplan erzeugen.
# Jedes Teil hat Nummer, Kategorie, Name, Koordinaten in cm (Welt: x=Ost, y=Nord, z=oben,
# Ursprung = Suedwest-Ecke der Aussenwand, OK Bodenplatte = z 0) und Material.
# Der Blender-Builder (bauplan_builder_blender.py) arbeitet die Liste stur Teil fuer Teil ab -
# ohne raeumliches "Verstehen". Wie eine IKEA-Anleitung.
# Aufruf: bauplan_stueckliste.py <haus.json> <out_stueckliste.json>
import sys, json, math, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

H = json.load(open(sys.argv[1], encoding='utf-8'))
OUT = sys.argv[2]

W = H['breite_cm']; D = H['tiefe_cm']; NF = H['geschosse']
GH = H['geschosshoehe_cm']; DK = H['deckenstaerke_cm']; T = H['aussenwand_cm']
SOCKEL = H.get('sockel_cm', 30)
roof = H['dach']; vor = H.get('vorbau'); balk = H.get('balkon')
if roof.get('typ') == 'sattel' and H.get('zwerchgiebel') and roof.get('first_richtung', 'x') == 'x':   # 08.10. Vergleichstest: Zwerchgiebel gab es nur bei walm_plateau -> Satteldach still OHNE Quergiebel. Jetzt: Satteldach mit Quergiebel = walm_plateau mit Walm erst am First (= Giebelenden)
    roof = dict(roof, typ='walm_plateau', plateau_cm=roof.get('plateau_cm', 1), walm_ab_cm=roof.get('first_cm') - 2); H['dach'] = roof
    print('HINWEIS: Satteldach + Zwerchgiebel -> walm_plateau mit Giebelenden (Baustein Quergiebel)')
# Blockmodell (block3d.py -> haus['bloecke']): je Geschoss Segmente {x0_cm, x1_cm, vorsprung_cm | leer}. Nur mit Flachdach.
BL = H.get('bloecke') if roof['typ'] == 'flach' else None
if H.get('bloecke') and roof['typ'] != 'flach': print('  !! bloecke ignoriert (nur Flachdach-Bloecke werden gebaut)')
def segs_of(f):
    if BL and f < len(BL): return [dict(sg) for sg in BL[f]]
    return [{'x0_cm': 0, 'x1_cm': W, 'vorsprung_cm': 0}]
def yfront(f, x):
    for sg in segs_of(f):
        if not sg.get('leer') and sg['x0_cm'] <= x <= sg['x1_cm']:
            yl, yr = yfr(sg); return yl + (yr - yl) * (x - sg['x0_cm']) / max(1, sg['x1_cm'] - sg['x0_cm'])
    return 0
def prism(poly, z0, z1):   # senkrechtes Prisma ueber einem 2D-Polygon (x,y) - fuer schraege Fronten im Grundriss
    n = len(poly); verts = [[x, y, z0] for x, y in poly] + [[x, y, z1] for x, y in poly]
    faces = [list(range(n))[::-1], list(range(n, 2 * n))] + [[i, (i + 1) % n, (i + 1) % n + n, i + n] for i in range(n)]
    return {'verts': [[round(v, 1) for v in vv] for vv in verts], 'faces': faces}
def yfr(sg):   # Front-y links/rechts eines Segments (Vorsprung > 0 = nach Sueden = negatives y)
    yl = -sg.get('vorsprung_cm', 0); return yl, -sg.get('vorsprung_rechts_cm', sg.get('vorsprung_cm', 0))
def runs_of(f):   # zusammenhaengende bebaute Bereiche [xa, xb, [segs]]
    out = []
    for sg in segs_of(f):
        if sg.get('leer'): continue
        if out and abs(out[-1][1] - sg['x0_cm']) < 1: out[-1][1] = sg['x1_cm']; out[-1][2].append(sg)
        else: out.append([sg['x0_cm'], sg['x1_cm'], [sg]])
    return out
MAT = H.get('materialien', {})
DETAILS = H.get('details', True) is not False and not os.environ.get('BAUPLAN_NO_DETAILS')   # 24.09.: Fensterbaenke, Rinnen, Vordach, PV, Garage

parts = []
def add(kat, name, **kw):
    nr = len(parts) + 1
    p = {'nr': nr, 'id': f"T{nr:02d}", 'kat': kat, 'name': name}; p.update(kw); parts.append(p); return p
def box(x0, y0, z0, x1, y1, z1): return [round(x0, 1), round(y0, 1), round(z0, 1), round(x1, 1), round(y1, 1), round(z1, 1)]

def z_floor(f): return f * (GH + DK)
GEL = (H.get('gelaende') or {}).get('ecken_cm')   # 26.09.: Gelaendehoehen an den Hausecken aus dem Bauplan (cm, +-0 = OK FFB EG)
def gel_z(x, y):   # bilinear aus SW/SE/NW/NE, ausserhalb des Hauses begrenzt fortgesetzt
    if not GEL: return 0.0
    u = min(1.6, max(-0.6, x / W)); v = min(1.6, max(-0.6, y / D))
    return GEL.get('SW', 0) * (1 - u) * (1 - v) + GEL.get('SE', 0) * u * (1 - v) + GEL.get('NW', 0) * (1 - u) * v + GEL.get('NE', 0) * u * v
def _ccw(poly):
    a = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    return poly if a > 0 else poly[::-1]
def _strecke(a, b, d=2):   # schmales Rechteck (Breite 2d) entlang a->b, fuer schraege Gelaender
    dx_, dy_ = b[0] - a[0], b[1] - a[1]; L_ = math.hypot(dx_, dy_) or 1; nx_, ny_ = -dy_ / L_ * d, dx_ / L_ * d
    return _ccw([(a[0] - nx_, a[1] - ny_), (b[0] - nx_, b[1] - ny_), (b[0] + nx_, b[1] + ny_), (a[0] + nx_, a[1] + ny_)])

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bauteile_gelaender.py'), encoding='utf-8').read())   # 05.10. sauberes Holzgelaender
# ---------- 1. Fundament ----------
add('fundament', 'Bodenplatte', box=box(0, 0, -20, W, D, 0), material='beton')
for sg in segs_of(0):
    if not sg.get('leer') and max(sg.get('vorsprung_cm', 0), sg.get('vorsprung_rechts_cm', 0)) > 0: yl, yr = yfr(sg); add('fundament', 'Bodenplatte Vorsprung %d-%d' % (sg['x0_cm'], sg['x1_cm']), mesh=prism([(sg['x0_cm'], min(yl, 0)), (sg['x1_cm'], min(yr, 0)), (sg['x1_cm'], 0.5), (sg['x0_cm'], 0.5)], -20, 0), material='beton')

# ---------- 2. Waende je Geschoss ----------
# Jede Wand: seite (S/N/E/W), geschoss, along = Bereich entlang der Wand (S/N: x von West; E/W: y von Sued)
walls = []
def wall(name, f, seite, along0, along1, x0, y0, x1, y1):
    z0 = z_floor(f); z1 = z0 + GH
    p = add('wand', name, geschoss=f, seite=seite, along=[along0, along1], box=box(x0, y0, z0, x1, y1, z1), material='putz')
    walls.append(p); return p

for f in range(NF):
    fl = 'EG' if f == 0 else f'{f}.OG'
    # --- Suedwand (Front), ggf. mit Ruecksprung (Vorbau EG / Loggia OG) ---
    if BL:
        z0f = z_floor(f); nruns = len(runs_of(f))
        for xa, xb, sgs in runs_of(f):
            for sg in sgs:
                yl, yr = yfr(sg)
                if yl == yr: wall('Suedwand %s Block %d-%d (Vorsprung %d cm)' % (fl, sg['x0_cm'], sg['x1_cm'], sg.get('vorsprung_cm', 0)), f, 'S', sg['x0_cm'], sg['x1_cm'], sg['x0_cm'], yl, sg['x1_cm'], yl + T)
                else:   # schraege Front im Grundriss: Prisma, Wandliste bekommt bbox + ramp fuer die Oeffnungen
                    pw = add('wand', 'Suedwand %s Block %d-%d (schraeg, Vorsprung %d > %d cm)' % (fl, sg['x0_cm'], sg['x1_cm'], -yl, -yr), geschoss=f, seite='S', along=[sg['x0_cm'], sg['x1_cm']],
                             mesh=prism([(sg['x0_cm'], yl), (sg['x1_cm'], yr), (sg['x1_cm'], yr + T), (sg['x0_cm'], yl + T)], z0f, z0f + GH),
                             bbox=box(sg['x0_cm'], min(yl, yr), z0f, sg['x1_cm'], max(yl, yr) + T, z0f + GH), ramp=[yl, yr], material='putz')
                    walls.append(pw)
            for a, b in zip(sgs, sgs[1:]):   # Ruecksprung-Wange zwischen zwei Bloecken verschiedener Tiefe (Front-y an der Grenze)
                ya, yb = yfr(a)[1], yfr(b)[0]; xb_ = a['x1_cm']
                if ya < yb: add('wand', 'Blockwange %s x=%d (Ost)' % (fl, xb_), geschoss=f, seite='S-wange', along=[0, 0], box=box(xb_ - T, ya, z0f, xb_, yb + T, z0f + GH), material='putz')
                elif ya > yb: add('wand', 'Blockwange %s x=%d (West)' % (fl, xb_), geschoss=f, seite='S-wange', along=[0, 0], box=box(xb_, yb, z0f, xb_ + T, ya + T, z0f + GH), material='putz')
            y_w, y_e = yfr(sgs[0])[0], yfr(sgs[-1])[1]
            wall('Nordwand %s' % fl + (' Block %d-%d' % (xa, xb) if nruns > 1 or xa > 0 or xb < W else ''), f, 'N', xa, xb, xa, D - T, xb, D)
            wall('Westwand %s' % fl + (' x=%d' % xa if xa > 0 else ''), f, 'W', y_w + T, D - T, xa, y_w + T, xa + T, D - T)
            wall('Ostwand %s' % fl + (' x=%d' % xb if xb < W else ''), f, 'E', y_e + T, D - T, xb - T, y_e + T, xb, D - T)
        if H.get('mittelwand'):
            mw = H['mittelwand']; d2 = mw.get('dicke_cm', 17.5) / 2
            for xa, xb, sgs in runs_of(f):
                if mw.get('richtung', 'x') == 'x': add('wand', 'Mittelwand %s (tragend, 17,5 cm)' % fl, geschoss=f, seite='M', along=[max(xa + T, T + 160), xb - T], box=box(max(xa + T, T + 160), mw['pos_cm'] - d2, z0f, xb - T, mw['pos_cm'] + d2, z0f + GH), material='putz')
                elif xa + T < mw['pos_cm'] < xb - T: add('wand', 'Mittelwand %s (tragend, 17,5 cm)' % fl, geschoss=f, seite='M', along=[T, D - T], box=box(mw['pos_cm'] - d2, T, z0f, mw['pos_cm'] + d2, D - T, z0f + GH), material='putz')
        continue
    rs = None
    if vor and vor.get('seite') == 'S':
        if f == 0 and not vor.get('nur_og'):
            rs = (vor['von_cm'], vor['bis_cm'], vor['ruecksprung_cm'])
        elif f == 1 and vor.get('loggia_og'):
            rs = (vor['loggia_og']['von_cm'], vor['loggia_og']['bis_cm'], vor['ruecksprung_cm'])
    if rs:
        a, b, r = rs
        if a > 0: wall(f'Suedwand {fl} links (buendig)', f, 'S', 0, a, 0, 0, a, T)
        wall(f'Suedwand {fl} Mitte (zurueckgesetzt {r} cm)', f, 'S', a, b, a, r, b, r + T)
        if b < W: wall(f'Suedwand {fl} rechts (buendig)', f, 'S', b, W, b, 0, W, T)
        if a > 0: add('wand', f'Ruecksprung-Wange {fl} links', geschoss=f, seite='W', along=[T, r], box=box(a - T, T, z_floor(f), a, r, z_floor(f) + GH), material='putz')
        if b < W: add('wand', f'Ruecksprung-Wange {fl} rechts', geschoss=f, seite='E', along=[T, r], box=box(b, T, z_floor(f), b + T, r, z_floor(f) + GH), material='putz')
    else:
        wall(f'Suedwand {fl}', f, 'S', 0, W, 0, 0, W, T)
    # --- Nordwand (Rueckseite) ---
    wall(f'Nordwand {fl}', f, 'N', 0, W, 0, D - T, W, D)
    # --- Ost/West (stossen zwischen S und N) ---
    wall(f'Westwand {fl}', f, 'W', T, D - T, 0, T, T, D - T)
    wall(f'Ostwand {fl}', f, 'E', T, D - T, W - T, T, W, D - T)
    # --- tragende Mittelwand (aus haus_normalisieren bei Spannweite > 6 m, R09); Luecke an der Treppe (Westwand) ---
    if H.get('mittelwand'):
        mw = H['mittelwand']; d2 = mw.get('dicke_cm', 17.5) / 2; zf = z_floor(f)
        if mw.get('richtung', 'x') == 'x': add('wand', f'Mittelwand {fl} (tragend, 17,5 cm)', geschoss=f, seite='M', along=[T + 160, W - T], box=box(T + 160, mw['pos_cm'] - d2, zf, W - T, mw['pos_cm'] + d2, zf + GH), material='putz')
        else: add('wand', f'Mittelwand {fl} (tragend, 17,5 cm)', geschoss=f, seite='M', along=[T, D - T], box=box(mw['pos_cm'] - d2, T, zf, mw['pos_cm'] + d2, D - T, zf + GH), material='putz')

# ---------- 2b. Erker (Rueckseite/Seite): vorspringender Baukoerper mit eigener Vorderwand, Wangen, Boden- und Dachplatte ----------
# Die Erker-Vorderwand wird VOR die Hauptwand in die Wandliste gestellt, damit Oeffnungen in ihrem Bereich dort geschnitten werden.
for ei, E in enumerate(H.get('erker', []), 1):
    seite = E.get('seite', 'N'); pos = E['pos_cm']; eb = E['breite_cm']; et = E['tiefe_cm']; fl = E.get('geschosse', [0])
    z0 = z_floor(min(fl)); z1 = z_floor(max(fl)) + GH
    if seite == 'N':
        x0, x1 = pos - eb / 2, pos + eb / 2; y0, y1 = D, D + et
        front = add('wand', f'Erker {ei} Vorderwand', geschoss=min(fl), geschosse=list(fl), seite='N', along=[x0, x1], box=box(x0, y1 - T, z0, x1, y1, z1), material='putz')
        walls.insert(0, front)
        add('wand', f'Erker {ei} Wange West', geschoss=min(fl), seite='W', along=[y0, y1], box=box(x0, y0, z0, x0 + T, y1, z1), material='putz')
        add('wand', f'Erker {ei} Wange Ost', geschoss=min(fl), seite='E', along=[y0, y1], box=box(x1 - T, y0, z0, x1, y1, z1), material='putz')
        add('decke', f'Erker {ei} Bodenplatte', box=box(x0, y0, z0 - DK, x1, y1, z0), material='beton_hell')
        add('dach', f'Erker {ei} Dachplatte (Flachdach)', box=box(x0 - 15, y0, z1, x1 + 15, y1 + 15, z1 + DK), material='dach_flach')
        # Hauptwand hinter dem Erker oeffnen (Durchgang ueber die Erkerbreite)
        add('ausschnitt', f'Erker {ei} Durchbruch Hauptwand', ziel='__N__', box=box(x0 + T + 10, D - T - 6, z0 + 5, x1 - T - 10, D + 6, z1 - 30), quelle='Erker', geschosse=fl)
        # Seitenfenster in den Wangen
        for wn, wx in (('West', x0), ('Ost', x1 - T)):
            for f in fl:
                add('ausschnitt', f'Erker {ei} Seitenfenster {wn} G{f}', ziel='__ERKERWANGE__', box=box(wx - 6, y0 + 40, z_floor(f) + 90, wx + T + 6, y1 - 40, z_floor(f) + 90 + 130), quelle='Erker', erker_wange=(ei, wn), oeffnung=None)

# ---------- 3. Decken ----------
# 26.09. (Tobi: 'es muss immer eine Decke drin sein, am besten auch das Treppenhaus'): Decken ohne Doppelungen + Treppenloch ueber der Treppe
TL = None
if NF > 1 and H.get('treppe', True):
    _st = max(12, round((GH + DK) / 18)); _rs = (GH + DK) / _st; _rn = min(30, max(25, 63 - 2 * _rs))
    _tx0 = H.get('treppe_x_cm') or ((runs_of(1)[0][0] if BL and runs_of(1) else 0) + T + 40); _ty0 = D - T - 120   # 05.10. Holzhaus: Treppenlage waehlbar (Loggia an der Treppenecke)
    TL = (_tx0 - 10, _ty0 - _st * _rn - 5, _tx0 + 110, _ty0 - max(0, math.floor((GH - 210) / _rs)) * _rn)   # 05.10. Pruefagent: Loch so lang, dass ueber jeder Stufe >= 2,10 m frei sind   # x0, y0, x1, y1 des Treppenlochs in der Decke ueber EG (unten 90 cm zu fuer Kopfhoehe am Antritt)
_decke_da = set()
def add_decke(name, x0, y0, x1, y1, z0, z1, f):
    key = (round(x0), round(y0), round(x1), round(y1), round(z0))
    if key in _decke_da: return
    _decke_da.add(key)
    if f == 0 and TL and TL[0] < x1 and TL[2] > x0 and TL[1] < y1 and TL[3] > y0:
        hx0, hy0, hx1, hy1 = max(TL[0], x0), max(TL[1], y0), min(TL[2], x1), min(TL[3], y1)
        for i, (a0, b0, a1, b1) in enumerate(((x0, y0, hx0, y1), (hx1, y0, x1, y1), (hx0, y0, hx1, hy0), (hx0, hy1, hx1, y1))):
            if a1 - a0 > 1 and b1 - b0 > 1: add('decke', f'{name} Stueck {i + 1} (um Treppenloch)', box=box(a0, b0, z0, a1, b1, z1), material='beton_hell')
        add('gelaender', 'Absturzsicherung Treppenloch Ost', box=box(hx1 - 4, hy0, z1 + 5, hx1, hy1, z1 + 100), material='stahl')
        add('gelaender', 'Absturzsicherung Treppenloch Nord', box=box(hx0, hy1 - 4, z1 + 5, hx1, hy1, z1 + 100), material='stahl')
        return
    add('decke', name, box=box(x0, y0, z0, x1, y1, z1), material='beton_hell')
for f in range(NF):
    z0 = z_floor(f) + GH
    nm = 'Decke ueber EG (= Balkonplatte / Vorbau-Dach)' if f == 0 and vor else f'Decke ueber {"EG" if f == 0 else str(f) + ".OG"}'
    if BL:
        pieces = [sg for sg in segs_of(f) if not sg.get('leer')] + ([sg for sg in segs_of(f + 1) if not sg.get('leer')] if f + 1 < NF else [])
        for k, sg in enumerate(pieces, 1):
            yl, yr = yfr(sg)
            if yl == yr: add_decke('%s Teil %d (%d-%d)' % (nm, k, sg['x0_cm'], sg['x1_cm']), sg['x0_cm'], yl, sg['x1_cm'], D, z0, z0 + DK, f)
            else: add('decke', '%s Teil %d (%d-%d, schraeg)' % (nm, k, sg['x0_cm'], sg['x1_cm']), mesh=prism([(sg['x0_cm'], yl), (sg['x1_cm'], yr), (sg['x1_cm'], D), (sg['x0_cm'], D)], z0, z0 + DK), material='beton_hell')
    else: add_decke(nm, 0, 0, W, D, z0, z0 + DK, f)

def _sockel_nord():   # 27.09. Tobi: bodentiefe Fenster/Tueren im EG Nord gehen bis zum Boden -> Sockelband dort unterbrechen
    lu = sorted((o['pos_cm'] - o['b_cm'] / 2 - 6, o['pos_cm'] + o['b_cm'] / 2 + 6) for o in H.get('oeffnungen', []) if o.get('seite') == 'N' and o.get('geschoss', 0) == 0 and o.get('bruestung_cm', 99) < SOCKEL)
    xa = -2
    for a_, b_ in lu + [(W + 2, W + 2)]:
        if a_ > xa: add('sockel', 'Sockelband Nord %d-%d' % (xa, a_), box=box(xa, D, 0, a_, D + 2, SOCKEL), material='sockel')
        xa = max(xa, b_)
# ---------- 4. Sockel (Band um das Haus, 2 cm vor der Wand) ----------
if BL:
    for sg in [sg for sg in segs_of(0) if not sg.get('leer')]:
        yl, yr = yfr(sg)
        add('sockel', 'Sockelband Sued %d-%d' % (sg['x0_cm'], sg['x1_cm']), mesh=prism([(sg['x0_cm'] - 2, yl - 2), (sg['x1_cm'] + 2, yr - 2), (sg['x1_cm'] + 2, yr), (sg['x0_cm'] - 2, yl)], 0, SOCKEL), material='sockel')
    for a, b in zip(segs_of(0), segs_of(0)[1:]):
        ya, yb = yfr(a)[1], yfr(b)[0]
        if ya != yb: add('sockel', 'Sockelband Wange x=%d' % a['x1_cm'], box=box(a['x1_cm'] - 2 if ya < yb else a['x1_cm'], min(ya, yb) - 2, 0, a['x1_cm'] if ya < yb else a['x1_cm'] + 2, max(ya, yb), SOCKEL), material='sockel')
    _sockel_nord()
    add('sockel', 'Sockelband West', box=box(-2, yfront(0, 0), 0, 0, D, SOCKEL), material='sockel')
    add('sockel', 'Sockelband Ost', box=box(W, yfront(0, W), 0, W + 2, D, SOCKEL), material='sockel')
else:
    add('sockel', 'Sockelband Sued', box=box(-2, -2, 0, W + 2, 0, SOCKEL), material='sockel')
    _sockel_nord()
    add('sockel', 'Sockelband West', box=box(-2, 0, 0, 0, D, SOCKEL), material='sockel')
    add('sockel', 'Sockelband Ost', box=box(W, 0, 0, W + 2, D, SOCKEL), material='sockel')

# ---------- 5. Stuetzen / Balkon-Gelaender ----------
for i, s in enumerate(H.get('stuetzen', []), 1):
    b = s['b_cm']; x = s['x_cm']; y = s.get('y_cm', b / 2)
    add('stuetze', f'Pfeiler {i} ({s.get("hinweis", "")})', box=box(x - b / 2, y - b / 2, 0, x + b / 2, y + b / 2, GH), material='putz')
if balk:
    zb = z_floor(1); a, b = balk['von_cm'], balk['bis_cm']; hg = balk['gelaender_hoehe_cm']; y = 6
    add('gelaender', 'Balkon-Handlauf', box=box(a, y - 2, zb + hg - 4, b, y + 2, zb + hg), material='stahl')
    for k, zz in enumerate((0.30, 0.55, 0.80), 1):
        add('gelaender', f'Balkon-Querstab {k}', box=box(a, y - 1, zb + hg * zz - 1, b, y + 1, zb + hg * zz + 1), material='stahl')
    n = max(2, int((b - a) / 110) + 1)
    for k in range(n):
        x = a + (b - a) * k / (n - 1)
        add('gelaender', f'Balkon-Pfosten {k + 1}', box=box(x - 2, y - 2, zb, x + 2, y + 2, zb + hg), material='stahl')

# ---------- 5c. Dachterrassen (OG fehlt am Rand): Glasbruestung vorne + aussen auf dem Dach des Geschosses darunter (2026-09-14) ----------
for ti, DT in enumerate(H.get('dachterrassen', []), 1):
    f = DT.get('geschoss', 1); a, b = DT['von_cm'], DT['bis_cm']; bt = DT.get('tiefe_cm', 300); hg = DT.get('gelaender_hoehe_cm', 100); zb = z_floor(f)
    try: yf = yfront(f - 1, (a + b) / 2)
    except Exception: yf = 0.0
    add('gelaender', f'Dachterrasse {ti} Glasbruestung vorne', box=box(a + 2, yf - 1, zb, b - 2, yf + 1, zb + hg), material='glas', quelle=DT.get('quelle', ''))
    add('gelaender', f'Dachterrasse {ti} Handlauf vorne', box=box(a, yf - 3, zb + hg - 3, b, yf + 3, zb + hg), material='stahl')
    if a <= 0:   # Westrand frei -> Bruestung an der Westkante nach hinten
        add('gelaender', f'Dachterrasse {ti} Glasbruestung West', box=box(0, yf, zb, 2, yf + bt, zb + hg), material='glas')
        add('gelaender', f'Dachterrasse {ti} Handlauf West', box=box(-1, yf, zb + hg - 3, 3, yf + bt, zb + hg), material='stahl')
    if b >= W:   # Ostrand frei
        add('gelaender', f'Dachterrasse {ti} Glasbruestung Ost', box=box(W - 2, yf, zb, W, yf + bt, zb + hg), material='glas')
        add('gelaender', f'Dachterrasse {ti} Handlauf Ost', box=box(W - 3, yf, zb + hg - 3, W + 1, yf + bt, zb + hg), material='stahl')
    for k in range(0, int((b - a) // 150) + 1):   # Pfosten alle 1,5 m
        x = a + min(b - a, k * 150); add('gelaender', f'Dachterrasse {ti} Pfosten {k + 1}', box=box(x - 2, yf - 3, zb, x + 2, yf + 3, zb + hg), material='stahl')
# ---------- 5b. Balkone (Rueckseite/Seiten): Platte + Gelaender (Stahl oder Glas) ----------
for bi, B in enumerate(H.get('balkone', []), 1):
    seite = B.get('seite', 'N'); f = B.get('geschoss', 1); a, b = B['von_cm'], B['bis_cm']; bt = B.get('tiefe_cm', 150); hg = B.get('gelaender_hoehe_cm', 105); art = B.get('gelaender', 'glas')
    zb = z_floor(f)
    if seite == 'N' and B.get('eckradius_cm'):   # 27.09. Tobi Street View: Dachbalkon mit runden Ecken (Platte + Stahlgelaender, waagrechte Staebe)
        y0, y1 = D, D + bt; r_ = min(B['eckradius_cm'], bt - 5, (b - a) / 2 - 5); nb_ = 8
        pf_ = [(a, y0)] + [(a + r_ - r_ * math.cos(math.pi / 2 * k / nb_), y1 - r_ + r_ * math.sin(math.pi / 2 * k / nb_)) for k in range(nb_ + 1)] \
              + [(b - r_ + r_ * math.sin(math.pi / 2 * k / nb_), y1 - r_ + r_ * math.cos(math.pi / 2 * k / nb_)) for k in range(nb_ + 1)] + [(b, y0)]
        add('balkon', f'Balkon {bi} Platte (runde Ecken)', mesh=prism(_ccw(pf_), zb - 18, zb), material='beton_hell')
        for si, (p1, p2) in enumerate(zip(pf_[:-1], pf_[1:]), 1):
            add('gelaender', f'Balkon {bi} Handlauf {si}', mesh=prism(_strecke(p1, p2), zb + hg - 4, zb + hg), material='stahl')
            for k, zz in enumerate((0.15, 0.3, 0.45, 0.6, 0.75), 1):
                add('gelaender', f'Balkon {bi} Stab {si}.{k}', mesh=prism(_strecke(p1, p2, 1), zb + hg * zz - 1, zb + hg * zz + 1), material='stahl')
        for k, (px_, py_) in enumerate([pf_[1], pf_[nb_ + 1], pf_[nb_ + 2], pf_[-2]] + [((a + b) / 2, y1)], 1):
            add('gelaender', f'Balkon {bi} Pfosten {k}', box=box(px_ - 2, py_ - 2, zb, px_ + 2, py_ + 2, zb + hg), material='stahl')
    elif seite == 'N':
        y0, y1 = D, D + bt
        add('balkon', f'Balkon {bi} Platte ({art}-Gelaender)', box=box(a, y0, zb - 18, b, y1, zb), material='beton_hell')
        if art == 'glas':
            add('gelaender', f'Balkon {bi} Glasbruestung vorne', box=box(a, y1 - 2, zb, b, y1, zb + hg), material='glas')
            add('gelaender', f'Balkon {bi} Glasbruestung West', box=box(a, y0, zb, a + 2, y1, zb + hg), material='glas')
            add('gelaender', f'Balkon {bi} Glasbruestung Ost', box=box(b - 2, y0, zb, b, y1, zb + hg), material='glas')
            add('gelaender', f'Balkon {bi} Handlauf', box=box(a, y1 - 4, zb + hg - 3, b, y1 + 1, zb + hg), material='stahl')
        elif art == 'holz':   # 05.10. Tobi: sauberes Holzgelaender (Pfosten, Handlauf, Fussleiste, geschwungene Bretter), vorne + beide Seiten
            gelaender_holz(f'Balkon {bi} Gelaender', [(a + 5, y0 + 5), (a + 5, y1 - 6), (b - 5, y1 - 6), (b - 5, y0 + 5)], zb, hg)
        else:
            add('gelaender', f'Balkon {bi} Handlauf', box=box(a, y1 - 4, zb + hg - 4, b, y1, zb + hg), material='stahl')
            for k, zz in enumerate((0.30, 0.55, 0.80), 1):
                add('gelaender', f'Balkon {bi} Querstab {k}', box=box(a, y1 - 3, zb + hg * zz - 1, b, y1 - 1, zb + hg * zz + 1), material='stahl')
            n = max(2, int((b - a) / 110) + 1)
            for k in range(n):
                x = a + (b - a) * k / (n - 1); add('gelaender', f'Balkon {bi} Pfosten {k + 1}', box=box(x - 2, y1 - 4, zb, x + 2, y1, zb + hg), material='stahl')
            add('gelaender', f'Balkon {bi} Seitenstab West', box=box(a, y0, zb + hg - 4, a + 4, y1, zb + hg), material='stahl')
            add('gelaender', f'Balkon {bi} Seitenstab Ost', box=box(b - 4, y0, zb + hg - 4, b, y1, zb + hg), material='stahl')

# 02.10. Regel keller_pflicht (Tobi): jedes Gebaeude bekommt einen Keller - Standard 2,70 m, ausser haus.json sagt ausdruecklich kein_keller
if not H.get('keller') and not H.get('kein_keller'):
    H['keller'] = dict(tiefe_cm=270); print('KELLER Standard 2,70 m ergaenzt (Regel keller_pflicht)')
# 26.09. Keller (Bauplan Beethovenstr.: UK -2,70): Kelleraussenwaende als Sockel-Bauteil, sichtbar wo das Gelaende faellt
if H.get('keller'):
    KT = H['keller'].get('tiefe_cm', 270) if isinstance(H['keller'], dict) else 270
    for nm_, bx in (('Sued', (0, 0, -KT, W, T, 0)), ('Nord', (0, D - T, -KT, W, D, 0)), ('West', (0, T, -KT, T, D - T, 0)), ('Ost', (W - T, T, -KT, W, D - T, 0))):
        add('sockel', f'Kelleraussenwand {nm_}', box=box(*bx), material='sockel')
        for ki_, KF in enumerate([k for k in H['keller'].get('fenster', []) if k.get('seite', 'S') == nm_[0]] if isinstance(H['keller'], dict) else [], 1):   # 27.09. Tobi: Hanglage -> Kellerfenster sichtbar
            kw_ = parts[-1] if ki_ == 1 else kw_; x0_, x1_ = KF['pos_cm'] - KF['b_cm'] / 2, KF['pos_cm'] + KF['b_cm'] / 2; z1_ = KF.get('oben_cm', -5); z0_ = z1_ - KF['h_cm']
            if nm_ == 'Sued': yy0_, yy1_ = -10, T + 10; gy_ = (4, 6)
            else: yy0_, yy1_ = D - T - 10, D + 10; gy_ = (D - 6, D - 4)
            add('ausschnitt', f'Kellerfenster {nm_} {ki_} Ausschnitt', ziel=kw_['id'], box=box(x0_, yy0_, z0_, x1_, yy1_, z1_), oeffnung=None)
            add('glas', f'Kellerfenster {nm_} {ki_} Glas', box=box(x0_ + 5, gy_[0], z0_ + 5, x1_ - 5, gy_[1], z1_ - 5), material='glas')
            fy_ = (0, 8) if nm_ == 'Sued' else (D - 8, D)
            rb_ = [(x0_, z0_, x0_ + 6, z1_), (x1_ - 6, z0_, x1_, z1_), (x0_, z0_, x1_, z0_ + 6), (x0_, z1_ - 6, x1_, z1_)] + ([((x0_ + x1_) / 2 - 3, z0_, (x0_ + x1_) / 2 + 3, z1_)] if KF.get('fluegel', 1) == 2 else [])
            for ri_, r_ in enumerate(rb_, 1): add('rahmen', f'Kellerfenster {nm_} {ki_} Rahmen {ri_}', box=box(r_[0], fy_[0], r_[1], r_[2], fy_[1], r_[3]), material=KF.get('rahmen', 'rahmen'))
    add('decke', 'Kellersohle', box=box(0, 0, -KT - 30, W, D, -KT), material='beton_hell')# ---------- 6. Dach ----------
ov = roof.get('ueberstand_cm', 0); ze = z_floor(NF - 1) + GH + DK   # Traufe = OK oberste Decke
if roof['typ'] in ('sattel', 'pult'):
    from pitched_roof import pitched_parts
    for part in pitched_parts(W, D, ze, ov, roof.get('neigung_grad', 30), roof['typ'], T, H.get('sparren_abstand_cm', 80), roof.get('first_richtung', 'y')):
        add(**part)
elif roof['typ'] == 'walm_plateau':   # 26.09. Bauplan Beethovenstr. (Schnitt + 4 Ansichten): Kniestock, alle Dachflaechen DN 45, oben abgeflacht (First-Plateau),
    # Zwerchhaus Gartenseite (Nord, Flachdach) + Zwerchgiebel Strassenseite (Sued, Satteldach 45 quer zum Hauptdach, z. B. Treppenhaus-Turm)
    KN = roof.get('kniestock_cm', 0); a45 = math.tan(math.radians(roof.get('neigung_grad', 45))); zt = roof['first_cm']
    ZW = [q for q in H.get('zwerchhaeuser', []) if q.get('seite', 'N') == 'N']; ZG = H.get('zwerchgiebel', [])
    def _kn(nm_, x0_, y0_, x1_, y1_):
        if KN and x1_ - x0_ > 1: add('wand', f'Kniestock {nm_}', box=box(x0_, y0_, ze, x1_, y1_, ze + KN), material='putz')
    def _luecken(items):
        xs = [0] + [v for q in sorted(items, key=lambda q: q['von_cm']) for v in (q['von_cm'], q['bis_cm'])] + [W]
        return [(xs[k], xs[k + 1]) for k in range(0, len(xs), 2)]
    for k, (xa, xb) in enumerate(_luecken(ZG), 1): _kn(f'Sued {k}', xa, 0, xb, T)
    for k, (xa, xb) in enumerate(_luecken(ZW), 1): _kn(f'Nord {k}', xa, D - T, xb, D)
    _kn('West', 0, T, T, D - T); _kn('Ost', W - T, T, W, D - T)
    ze2 = ze + KN; xa0, xa1, ya0, ya1 = -ov, W + ov, -ov, D + ov; ym = D / 2
    # Laengsseiten: Neigung aus Traufe + First (Plan ~35 Grad); Walmenden: Einrueckung aus der Ansicht (walm_einrueck_cm); plateau_cm = flaches Oberteil
    PL = roof.get('plateau_cm', 1); aL = (zt - ze2) / (D / 2 + ov - PL / 2); dx = roof.get('walm_einrueck_cm', (zt - ze2) / aL)
    zk = roof.get('walm_ab_cm')   # 26.09.: Krueppelwalm-Enden W/O - Giebel senkrecht bis walm_ab_cm, darueber Walm (Neigung) bis zum Plateau
    if zk: dx = (zt - zk) / a45
    px0, px1, py0, py1 = xa0 + dx, xa1 - dx, ym - PL / 2, ym + PL / 2
    zS = lambda y: ze2 + aL * (y - ya0); zNn = lambda y: ze2 + aL * (ya1 - y)
    V = [[xa0, ya0, ze2], [xa1, ya0, ze2], [xa1, ya1, ze2], [xa0, ya1, ze2], [px0, py0, zt], [px1, py0, zt], [px1, py1, zt], [px0, py1, zt]]
    if zk:   # Indizes 8-11: wo Laengsflaechen die Krueppelwalm-Hoehe erreichen
        yk = ya0 + (zk - ze2) / aL; ykn = ya1 - (zk - ze2) / aL
        V += [[xa0, yk, zk], [xa1, yk, zk], [xa1, ykn, zk], [xa0, ykn, zk]]
    sued = [0]
    for q in sorted(ZG, key=lambda q: q['von_cm']):   # Aussparungen Sued-Dachflaeche fuer die Zwerchgiebel
        q['_tiefe'] = min(py0 - 5, ((q.get('first_cm') or (q['wand_oben_cm'] + a45 * ((q['bis_cm'] - q['von_cm']) / 2 + q.get('ueberstand_cm', 30)))) - ze2) / aL - ov + 10)   # Wangen + Giebeldach reichen bis hier
        tq = min(q['_tiefe'], (q['wand_oben_cm'] - ze2) / aL - ov + 3)   # 26.09.: Aussparung nur bis dort, wo das Hauptdach die Wangenoberkante erreicht -> keine Loecher, Kehle entsteht von selbst
        i = len(V); V += [[q['von_cm'], ya0, ze2], [q['von_cm'], tq, zS(tq)], [q['bis_cm'], tq, zS(tq)], [q['bis_cm'], ya0, ze2]]; sued += [i, i + 1, i + 2, i + 3]
    sued += [1, 9, 5, 4, 8] if zk else [1, 5, 4]
    nord = [2]
    for q in sorted(ZW, key=lambda q: -q['von_cm']):
        tq = max(D - q.get('tiefe_cm', 160), D + ov - (q['oben_cm'] - ze2) / aL - 3)
        i = len(V); V += [[q['bis_cm'], ya1, ze2], [q['bis_cm'], tq, zNn(tq)], [q['von_cm'], tq, zNn(tq)], [q['von_cm'], ya1, ze2]]; nord += [i, i + 1, i + 2, i + 3]
    nord += [3, 11, 7, 6, 10] if zk else [3, 7, 6]
    F = [sued, [9, 10, 6, 5] if zk else [1, 2, 6, 5], nord, [11, 8, 4, 7] if zk else [3, 0, 4, 7]]
    add('dach', f'Walmdach {math.degrees(math.atan(aL)):.0f} Grad (Walm {math.degrees(math.atan((zt - ze2) / dx)):.0f}) mit First {round(zt)} cm, Traufe {round(ze2)} cm', mesh={'verts': V, 'faces': F}, material='dach', first_cm=round(zt))
    if PL > 20: add('dach', 'Dach-Plateau (flach, Blech)', box=box(px0, py0, zt - 4, px1, py1, zt + 2), material='dach_flach')
    DT_ = roof.get('plateau_terrasse')
    if PL > 20 and DT_:   # 27.09. Tobi (Google Earth): grosse flache Flaeche oben ist eine begehbare Dachterrasse -> Belag + Gelaender ringsum
        hg_ = DT_.get('gelaender_hoehe_cm', 100); ein_ = DT_.get('einrueck_cm', 15); zb_ = zt + 2
        add('decke', 'Dachterrasse Belag', box=box(px0 + 5, py0 + 5, zb_, px1 - 5, py1 - 5, zb_ + 3), material='holz')
        gx0_, gx1_, gy0_, gy1_ = px0 + ein_, px1 - ein_, py0 + ein_, py1 - ein_
        for nm_, (xa_, ya_, xb_, yb_) in (('Sued', (gx0_, gy0_, gx1_, gy0_)), ('Nord', (gx0_, gy1_, gx1_, gy1_)), ('West', (gx0_, gy0_, gx0_, gy1_)), ('Ost', (gx1_, gy0_, gx1_, gy1_))):
            hor_ = ya_ == yb_
            add('gelaender', f'Dachterrasse Handlauf {nm_}', box=box(xa_ - 3, ya_ - 3, zb_ + hg_ - 5, xb_ + 3, yb_ + 3, zb_ + hg_), material='stahl')
            for k_ in (1, 2, 3):
                zq_ = zb_ + k_ * hg_ / 4
                add('gelaender', f'Dachterrasse Querstab {nm_} {k_}', box=box(xa_ - 1.5, ya_ - 1.5, zq_ - 1.5, xb_ + 1.5, yb_ + 1.5, zq_ + 1.5), material='stahl')
            L_ = (xb_ - xa_) if hor_ else (yb_ - ya_); n_ = max(2, int(L_ // 150) + 1)
            for j_ in range(n_):
                t_ = j_ / (n_ - 1); px_ = xa_ + (xb_ - xa_) * t_; py_ = ya_ + (yb_ - ya_) * t_
                add('gelaender', f'Dachterrasse Pfosten {nm_} {j_ + 1}', box=box(px_ - 2.5, py_ - 2.5, zb_, px_ + 2.5, py_ + 2.5, zb_ + hg_), material='stahl')
    _tb = [] if zk else [('West', (xa0 - 4, ya0, ze2 - 22, xa0, ya1, ze2)), ('Ost', (xa1, ya0, ze2 - 22, xa1 + 4, ya1, ze2))]
    if zk:   # Giebeltrapez W/O zwischen Kniestock und Krueppelwalm + Ortgangbrett
        gp = [(0, ze2), (0, zS(0)), (yk, zk), (ykn, zk), (D, zNn(D)), (D, ze2)]
        for gn, (gx0, gx1) in (('West', (0, T)), ('Ost', (W - T, W))):
            vs_ = [[gx, y_, z_] for gx in (gx0, gx1) for (y_, z_) in gp]; n_ = len(gp)
            fs_ = [list(range(n_))[::-1], list(range(n_, 2 * n_))] + [[i, (i + 1) % n_, (i + 1) % n_ + n_, i + n_] for i in range(n_)]
            add('wand', f'Giebel Krueppelwalm {gn}', mesh={'verts': [[round(c, 1) for c in v] for v in vs_], 'faces': fs_}, material='putz')
        for fi_, GF in enumerate(H.get('giebelfenster', []), 1):   # 27.09. Tobi Street View: Fenster im obersten Stock an den Seiten
            gn_ = 'West' if GF['seite'] == 'W' else 'Ost'; xw0_, xw1_ = (0, T) if gn_ == 'West' else (W - T, W); xo_ = -1 if gn_ == 'West' else W + 1
            y0_, y1_ = GF['pos_cm'] - GF['b_cm'] / 2, GF['pos_cm'] + GF['b_cm'] / 2; z0_ = GF['unten_cm']; z1_ = z0_ + GF['h_cm']
            for q in [q for q in parts if q['kat'] == 'wand' and q['name'] in (f'Giebel Krueppelwalm {gn_}',) or (q['kat'] == 'wand' and q['name'].startswith(f'Kniestock {gn_}'))]:
                add('ausschnitt', f'Giebelfenster {fi_} in {q["name"][:30]}', ziel=q['id'], box=box(xw0_ - 10, y0_, z0_, xw1_ + 10, y1_, z1_), oeffnung=None)
            gx_ = (xw0_ + 6, xw0_ + 8) if gn_ == 'West' else (xw1_ - 8, xw1_ - 6)
            add('glas', f'Giebelfenster {fi_} {gn_} Glas', box=box(gx_[0], y0_ + 6, z0_ + 6, gx_[1], y1_ - 6, z1_ - 6), material='glas')
            fx_ = (xw0_ + 2, xw0_ + 10) if gn_ == 'West' else (xw1_ - 10, xw1_ - 2)
            for rn_, (ya2, yb2, za2, zb2) in (('links', (y0_, y0_ + 7, z0_, z1_)), ('rechts', (y1_ - 7, y1_, z0_, z1_)), ('unten', (y0_, y1_, z0_, z0_ + 7)), ('oben', (y0_, y1_, z1_ - 7, z1_)), ('Mitte', (GF['pos_cm'] - 3, GF['pos_cm'] + 3, z0_, z1_))):
                add('rahmen', f'Giebelfenster {fi_} {gn_} Rahmen {rn_}', box=box(fx_[0], ya2, za2, fx_[1], yb2, zb2), material='rahmen')
            if GF.get('franz_balkon'):
                gxx_ = (xo_ - 12, xo_ - 8) if gn_ == 'West' else (xo_ + 8, xo_ + 12)
                for k_, zz_ in enumerate((0.2, 0.4, 0.6, 0.8, 1.0), 1):
                    add('gelaender', f'Giebelfenster {fi_} {gn_} Gelaender Stab {k_}', box=box(gxx_[0], y0_ - 5, z0_ + 95 * zz_ - 2, gxx_[1], y1_ + 5, z0_ + 95 * zz_), material='stahl')
                for yy2 in (y0_ - 5, y1_ + 3):
                    add('gelaender', f'Giebelfenster {fi_} {gn_} Gelaender Pfosten', box=box(gxx_[0], yy2, z0_, gxx_[1], yy2 + 2, z0_ + 95), material='stahl')
        for gn, xo in (('West', xa0), ('Ost', xa1)):
            for sn, (ya_, yb_) in (('Sued', (ya0, yk)), ('Nord', (ykn, ya1))):
                za_, zb_ = (ze2, zk) if sn == 'Sued' else (zk, ze2)
                add('dach', f'Ortgang {gn} {sn}', mesh={'verts': [[xo - 3, ya_, za_ - 18], [xo + 3, ya_, za_ - 18], [xo + 3, yb_, zb_ - 18], [xo - 3, yb_, zb_ - 18], [xo - 3, ya_, za_ + 1], [xo + 3, ya_, za_ + 1], [xo + 3, yb_, zb_ + 1], [xo - 3, yb_, zb_ + 1]],
                    'faces': [[3, 2, 1, 0], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]}, material='blende')
    for sn_, its_, y0t, y1t in (('Sued', ZG, ya0 - 4, ya0), ('Nord', ZW, ya1, ya1 + 4)):
        lk = _luecken(its_)
        for k, (xa, xb) in enumerate(lk, 1):
            xa = xa0 if k == 1 else xa; xb = xa1 if k == len(lk) else xb
            if xb - xa > 1: _tb.append((f'{sn_} {k}', (xa, y0t, ze2 - 22, xb, y1t, ze2)))
    for nm_, bx in _tb: add('dach', f'Traufblende {nm_}', box=box(*bx), material='blende')
    for zi, z_ in enumerate(ZW, 1):   # Zwerchhaus Gartenseite (Flachdach, Tuer zum DG-Balkon)
        a_, b_, t_, zo = z_['von_cm'], z_['bis_cm'], z_.get('tiefe_cm', 160), z_['oben_cm']; tb = z_.get('tuer_b_cm', 160); th = z_.get('tuer_h_cm', 210); tc = (a_ + b_) / 2
        add('wand', f'Zwerchhaus {zi} Front links', box=box(a_, D - T, ze, tc - tb / 2, D, zo), material='putz')
        add('wand', f'Zwerchhaus {zi} Front rechts', box=box(tc + tb / 2, D - T, ze, b_, D, zo), material='putz')
        add('wand', f'Zwerchhaus {zi} Front Sturz', box=box(tc - tb / 2, D - T, ze + th, tc + tb / 2, D, zo), material='putz')
        add('wand', f'Zwerchhaus {zi} Wange West', box=box(a_, D - t_, ze, a_ + T, D - T, zo), material='putz')
        add('wand', f'Zwerchhaus {zi} Wange Ost', box=box(b_ - T, D - t_, ze, b_, D - T, zo), material='putz')
        add('dach', f'Zwerchhaus {zi} Flachdach', box=box(a_ - 15, D - t_ - 10, zo, b_ + 15, D + 15, zo + 18), material='blende')
        for nm_, bx in (('links', (tc - tb / 2, D - 12, ze, tc - tb / 2 + 7, D - 4, ze + th)), ('rechts', (tc + tb / 2 - 7, D - 12, ze, tc + tb / 2, D - 4, ze + th)),
                        ('oben', (tc - tb / 2, D - 12, ze + th - 7, tc + tb / 2, D - 4, ze + th)), ('Mitte', (tc - 3, D - 12, ze, tc + 3, D - 4, ze + th))):
            add('rahmen', f'Zwerchhaus {zi} Tuer Rahmen {nm_}', box=box(*bx), material='rahmen')
        add('glas', f'Zwerchhaus {zi} Tuer Glas', box=box(tc - tb / 2 + 7, D - 9, ze, tc + tb / 2 - 7, D - 7, ze + th - 7), material='glas')
    for gi, g in enumerate(ZG, 1):   # Zwerchgiebel Strassenseite: Wand bis wand_oben_cm, Giebeldreieck + Satteldach 45 quer (First in y-Richtung)
        a_, b_, wo = g['von_cm'], g['bis_cm'], g['wand_oben_cm']; tq = g['_tiefe']; xc = (a_ + b_) / 2; og2 = g.get('ueberstand_cm', 30); hb = (b_ - a_) / 2
        zf = wo + a45 * (hb + og2); zg = wo + a45 * hb; vg = g.get('vor_cm', 0); yg = -vg; zb0 = g.get('ab_cm', 0) if vg else ze   # vor_cm > 0: Turm springt vor (Treppenhaus), Waende ab EG/Podest
        pf_ = add('wand', f'Zwerchgiebel {gi} Front (bis {round(wo)})', box=box(a_, yg, zb0, b_, yg + T, wo), material='putz')
        EI = g.get('eingang') if vg else None; pe_ = None
        if EI:   # 26.09. Plan: im EG steht der Turm auf zwei Pfeilern, Haustuer liegt zurueck; erst darueber springt der Turm voll vor
            zE = EI.get('oben_cm', 255); ni = EI.get('nische_cm', 40); pw = EI.get('pfeiler_cm', 35); yE = yg + ni
            add('ausschnitt', f'Zwerchgiebel {gi} Eingang Portal', ziel=pf_['id'], box=box(a_ + pw, yg - 10, zb0 - 5, b_ - pw, yg + T + 10, zE), oeffnung=None)
            pe_ = add('wand', f'Zwerchgiebel {gi} Eingang Rueckwand', box=box(a_ + T, yE, zb0, b_ - T, yE + T, zE), material='putz')
            add('wand', f'Zwerchgiebel {gi} Eingang Laibung oben', box=box(a_ + pw, yg + T - 1, zE - 1, b_ - pw, yE + 1, zE + 20), material='putz')
            VD = EI.get('vordach')
            if VD:   # Vordach ueber dem Eingang, Segment vor dem Turm, laeuft seitlich bis an die Hauswand
                vb = VD.get('breite_cm', 390) / 2; vv = VD.get('vor_cm', 100); vt = VD.get('dicke_cm', 15)
                arc = [(xc + vb * math.cos(math.pi * k / 16), yg - vv * math.sin(math.pi * k / 16)) for k in range(17)]
                add('dach', f'Zwerchgiebel {gi} Vordach Eingang', mesh=prism(_ccw(arc + [(xc - vb, 0), (xc + vb, 0)]), zE, zE + vt), material=VD.get('material', 'beton_hell'))
                if VD.get('abdeckung'): add('dach', f'Zwerchgiebel {gi} Vordach Abdeckung', mesh=prism(_ccw([(xc + (vb + 3) * math.cos(math.pi * k / 16), yg - (vv + 3) * math.sin(math.pi * k / 16)) for k in range(17)] + [(xc - vb - 3, 0), (xc + vb + 3, 0)]), zE + vt, zE + vt + 4), material=VD['abdeckung'])
            HT = EI.get('haustuer')
            if HT:   # 27.09. Tobi Foto Eingang: weisse Haustuer mit Sanduhr-Glas, links/rechts Seitenteil mit je 3 Milchglasfeldern, Granitrahmen
                hb_, hh_, sl_ = HT.get('b_cm', 216) / 2, HT.get('h_cm', 235), HT.get('fluegel_cm', 110) / 2; zt_ = zb0 + hh_
                add('ausschnitt', f'Zwerchgiebel {gi} Haustuer Ausschnitt', ziel=pe_['id'], box=box(xc - hb_, yE - 10, zb0 - 5, xc + hb_, yE + T + 10, zt_), oeffnung=None)
                add('tuer', f'Zwerchgiebel {gi} Haustuer Fluegel', box=box(xc - sl_, yE + 4, zb0, xc + sl_, yE + 10, zt_), material='putz_weiss')
                add('glas', f'Zwerchgiebel {gi} Haustuer Glas (Sanduhr)', mesh=prism(_ccw([(xc - 16, yE + 3), (xc + 16, yE + 3), (xc + 16, yE + 4), (xc - 16, yE + 4)]), zb0 + 30, zt_ - 30), material='milchglas')
                for sn_, (xa_, xb_) in (('links', (xc - hb_, xc - sl_)), ('rechts', (xc + sl_, xc + hb_))):
                    add('tuer', f'Zwerchgiebel {gi} Haustuer Seitenteil {sn_}', box=box(xa_, yE + 4, zb0, xb_, yE + 10, zt_), material='putz_weiss')
                    for k_, (za_, zb2_) in enumerate(((0.08, 0.30), (0.38, 0.62), (0.70, 0.92)), 1):
                        add('glas', f'Zwerchgiebel {gi} Haustuer Seitenteil {sn_} Feld {k_}', box=box(xa_ + 10, yE + 3, zb0 + hh_ * za_, xb_ - 10, yE + 4, zb0 + hh_ * zb2_), material='milchglas')
                gr_ = HT.get('granit_cm', 16)
                for rn_, bb_ in (('links', (xc - hb_ - gr_, xc - hb_, zb0, zt_)), ('rechts', (xc + hb_, xc + hb_ + gr_, zb0, zt_)), ('oben', (xc - hb_ - gr_, xc + hb_ + gr_, zt_, zt_ + gr_))):
                    add('detail', f'Zwerchgiebel {gi} Haustuer Granitrahmen {rn_}', box=box(bb_[0], yE - 3, bb_[2], bb_[1], yE + 1, bb_[3]), material='stein')
            TR = EI.get('treppe')
            if TR and TR.get('form') == 'rund' and VD:   # 27.09. Tobi (Foto Eingang 2a): runder Stein-Podest unter dem Vordach, gerundete Stufen, EINE runde Saeule auf Sockel
                vb_ = VD.get('breite_cm', 390) / 2; vv_ = VD.get('vor_cm', 100); ns_ = TR.get('stufen', 2); st_ = TR.get('auftritt_cm', 28); h_ = TR.get('steigung_cm', 17)
                def _seg(ex_, ey_):
                    return _ccw([(xc + ex_ * math.cos(math.pi * k / 20), yg - ey_ * math.sin(math.pi * k / 20)) for k in range(21)])
                for k_ in range(ns_ + 1):   # k=0 Podest (oben), dann Stufen nach aussen/unten
                    add('decke', f'Zwerchgiebel {gi} Eingang {"Podest" if k_ == 0 else f"Stufe {k_}"} (rund)', mesh=prism(_seg(vb_ - 60 + k_ * st_, vv_ - 10 + k_ * st_), zb0 - (ns_ + 1) * h_, zb0 - k_ * h_), material='stein')
                if TR.get('saeule', True):   # 27.09. Tobi Frontalfoto: ZWEI weisse Rundsaeulen auf gelbem Sockel mit Granitfuss
                    for si_, sgn_ in enumerate((-1, 1)[:TR.get('saeulen', 1)] if TR.get('saeulen', 1) == 1 else (-1, 1), 1):
                        sx_ = xc + sgn_ * (vb_ - TR.get('saeule_abstand_cm', 45)); sy_ = yg - vv_ * TR.get('saeule_vor', 0.55); r_ = TR.get('saeule_r_cm', 12); sh_ = TR.get('sockel_h_cm', 60)
                        add('detail', f'Zwerchgiebel {gi} Vordach Saeulenfuss {si_} (Granit)', box=box(sx_ - 25, sy_ - 25, zb0, sx_ + 25, sy_ + 25, zb0 + 12), material='stein')
                        add('wand', f'Zwerchgiebel {gi} Vordach Saeulensockel {si_}', box=box(sx_ - 22, sy_ - 22, zb0 + 12, sx_ + 22, sy_ + 22, zb0 + sh_), material='putz')
                        add('detail', f'Zwerchgiebel {gi} Vordach Saeulensockel {si_} Abdeckung', box=box(sx_ - 24, sy_ - 24, zb0 + sh_, sx_ + 24, sy_ + 24, zb0 + sh_ + 4), material='stein')
                        add('wand', f'Zwerchgiebel {gi} Vordach Saeule {si_} (rund)', mesh=prism([(sx_ + r_ * math.cos(2 * math.pi * k / 16), sy_ + r_ * math.sin(2 * math.pi * k / 16)) for k in range(16)], zb0 + sh_ + 4, zE), material='putz_weiss')
            elif TR:   # Podest + gerade Stufen bis zum Gelaende
                pd_ = TR.get('podest_cm', 100); sb_ = TR.get('breite_cm', b_ - a_); st_ = TR.get('auftritt_cm', 30)
                x0t_, x1t_ = xc - sb_ / 2, xc + sb_ / 2
                zg_ = TR.get('gelaende_cm', gel_z(xc, yg - pd_))
                add('decke', f'Zwerchgiebel {gi} Eingang Podest', box=box(x0t_, yg - pd_, zg_ - 10, x1t_, yg, zb0), material='beton_hell')
                n_ = max(1, math.ceil((zb0 - zg_) / 17.5)); h_ = (zb0 - zg_) / n_
                for k_ in range(1, n_):
                    add('decke', f'Zwerchgiebel {gi} Eingang Stufe {k_}', box=box(x0t_, yg - pd_ - k_ * st_, zg_ - 10, x1t_, yg - pd_ - (k_ - 1) * st_, zb0 - k_ * h_), material='beton_hell')
                if VD and TR.get('stuetzen', True):
                    for sx_ in (-1, 1):
                        cx_ = xc + sx_ * min(100, vb - 30); cy_ = yg - 0.7 * VD.get('vor_cm', 100)
                        add('wand', f'Zwerchgiebel {gi} Vordach Stuetze {"West" if sx_ < 0 else "Ost"}', box=box(cx_ - 10, cy_ - 10, zb0, cx_ + 10, cy_ + 10, zE), material='putz')
        if vg:
            for wn, wx in (('West', a_), ('Ost', b_ - T)): add('wand', f'Zwerchgiebel {gi} Turm-Seite {wn}', box=box(wx, yg + T, zb0, wx + T, 0, wo), material='putz')   # 27.09. Tobi 'unsauber': Seitenwand bis Traufe Turm (vorher Luecke ueber DG-Boden)
            add('decke', f'Zwerchgiebel {gi} Turm-Bodenplatte', box=box(a_, yg, zb0 - 20, b_, 0, zb0), material='beton')
        add('wand', f'Zwerchgiebel {gi} Giebeldreieck', mesh={'verts': [[a_, yg, wo], [b_, yg, wo], [xc, yg, zg], [a_, yg + T, wo], [b_, yg + T, wo], [xc, yg + T, zg]], 'faces': [[0, 1, 2], [5, 4, 3], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]]}, material='putz')
        for wn, wx in (('West', a_), ('Ost', b_ - T)): add('wand', f'Zwerchgiebel {gi} Wange {wn}', box=box(wx, max(T, yg + T), ze, wx + T, tq, wo), material='putz')
        gv = [[a_ - og2, yg - og2, wo - 1], [xc, yg - og2, zf - 1], [b_ + og2, yg - og2, wo - 1], [a_ - og2, tq, wo - 1], [xc, tq, zf - 1], [b_ + og2, tq, wo - 1]]
        add('dach', f'Zwerchgiebel {gi} Satteldach 45 (First {round(zf)} cm)', mesh={'verts': gv, 'faces': [[0, 3, 4, 1], [1, 4, 5, 2]]}, material='dach', first_cm=round(zf))
        for fi, G in enumerate(g.get('fenster', []), 1):
            c_, gb, gh, gz = G['pos_cm'], G['b_cm'], G['h_cm'], G['z_cm']
            if G.get('granit_cm'):   # 27.09. Tobi Foto: Turmfenster mit breitem Granitrahmen, weiss, dreiteilig
                gr_ = G['granit_cm']; yy_ = yg
                for rn_, (xa_, xb_, za_, zb_) in (('links', (c_ - gb / 2 - gr_, c_ - gb / 2, gz - gr_, gz + gh + gr_)), ('rechts', (c_ + gb / 2, c_ + gb / 2 + gr_, gz - gr_, gz + gh + gr_)), ('unten', (c_ - gb / 2, c_ + gb / 2, gz - gr_, gz)), ('oben', (c_ - gb / 2, c_ + gb / 2, gz + gh, gz + gh + gr_))):
                    add('detail', f'Zwerchgiebel {gi} Fenster {fi} Granitrahmen {rn_}', box=box(xa_, yy_ - 3, za_, xb_, yy_ + 1, zb_), material='stein')
            if G.get('dreiteilig'):
                for k_, xm_ in enumerate((c_ - gb / 2 + gb * 0.22, c_ + gb / 2 - gb * 0.22), 1):
                    add('rahmen', f'Zwerchgiebel {gi} Fenster {fi} Pfosten {k_}', box=box(xm_ - 4, yg - 6, gz, xm_ + 4, yg - 1, gz + gh), material=G.get('rahmen', 'rahmen'))
                add('rahmen', f'Zwerchgiebel {gi} Fenster {fi} Kaempfer', box=box(c_ - gb / 2, yg - 6, gz + gh * 0.62, c_ + gb / 2, yg - 1, gz + gh * 0.62 + 7), material=G.get('rahmen', 'rahmen'))
            yw, zi_ = (yE, pe_) if (pe_ and gz + gh <= zE + 5) else (yg, pf_)   # Haustuer sitzt in der zurueckgesetzten Rueckwand
            add('glas', f'Zwerchgiebel {gi} Fenster {fi} Glas', box=box(c_ - gb / 2 + 7, yw - 4, gz + 7, c_ + gb / 2 - 7, yw - 2, gz + gh - 7), material='glas')
            for nm_, (xa_, xb_, za_, zb_) in (('links', (c_ - gb / 2, c_ - gb / 2 + 7, gz, gz + gh)), ('rechts', (c_ + gb / 2 - 7, c_ + gb / 2, gz, gz + gh)), ('unten', (c_ - gb / 2, c_ + gb / 2, gz, gz + 7)), ('oben', (c_ - gb / 2, c_ + gb / 2, gz + gh - 7, gz + gh))):
                add('rahmen', f'Zwerchgiebel {gi} Fenster {fi} Rahmen {nm_}', box=box(xa_, yw - 6, za_, xb_, yw + 2, zb_), material='rahmen')
            FT_ = H.get('fenster_teilung')
            if FT_ and zi_ is pf_:   # Giebel-/Turmfenster ebenfalls 2-fluegelig mit Oberlicht (Haustuer ausgenommen)
                if gb >= FT_.get('fluegel_ab_cm', 85): add('rahmen', f'Zwerchgiebel {gi} Fenster {fi} Fluegelpfosten', box=box(c_ - 3, yw - 6, gz + 7, c_ + 3, yw + 2, gz + gh - 7), material='rahmen')
                if FT_.get('oberlicht_cm') and gh >= FT_.get('oberlicht_ab_hoehe_cm', 110):
                    zk_ = gz + gh - 7 - FT_['oberlicht_cm']; add('rahmen', f'Zwerchgiebel {gi} Fenster {fi} Kaempfer', box=box(c_ - gb / 2, yw - 6, zk_ - 3, c_ + gb / 2, yw + 2, zk_ + 3), material='rahmen')
            if G.get('ausschnitt', True): add('ausschnitt', f'Zwerchgiebel {gi} Fenster {fi} Oeffnung', ziel=zi_['id'], box=box(c_ - gb / 2, yw - 10, gz, c_ + gb / 2, yw + T + 10, gz + gh), oeffnung=None)
elif roof['typ'] == 'krueppelwalm':   # 26.09. nach Bauplan (Tobi): Kniestock + Giebel bis walm_ab_cm, darueber kleiner Walm; First in x-Richtung (W > D)
    KN = roof.get('kniestock_cm', 0); og = roof.get('ortgang_cm', 30)
    ZW = H.get('zwerchhaeuser', [])
    def _kn(nm_, x0_, y0_, x1_, y1_):
        if x1_ - x0_ > 1: add('wand', f'Kniestock {nm_}', box=box(x0_, y0_, ze, x1_, y1_, ze + KN), material='putz')
    if KN:
        _kn('Sued', 0, 0, W, T); _kn('West', 0, T, T, D - T); _kn('Ost', W - T, T, W, D - T)
        xs = [0] + [v for z_ in sorted(ZW, key=lambda q: q['von_cm']) if z_.get('seite', 'N') == 'N' for v in (z_['von_cm'], z_['bis_cm'])] + [W]
        for k in range(0, len(xs), 2): _kn(f'Nord {k // 2 + 1}', xs[k], D - T, xs[k + 1], D)
    ze2 = ze + KN; zr = roof['first_cm']; zh = roof.get('walm_ab_cm', ze2 + (zr - ze2) * 0.5)
    ta = (zr - ze2) / (D / 2 + ov); yh = -ov + (zh - ze2) / ta; yh2 = D + ov - (zh - ze2) / ta; ym = D / 2
    hi = (zr - zh) / math.tan(math.radians(roof.get('walm_neigung_grad', 45))); xg0, xg1 = -og, W + og
    zN = lambda y: ze2 + ta * (D + ov - y)
    V = [[xg0, -ov, ze2], [xg1, -ov, ze2], [xg1, yh, zh], [xg1 - hi, ym, zr], [xg0 + hi, ym, zr], [xg0, yh, zh], [xg1, yh2, zh], [xg0, yh2, zh]]
    nord = [[xg1, D + ov, ze2]]
    for z_ in sorted([q for q in ZW if q.get('seite', 'N') == 'N'], key=lambda q: -q['von_cm']):   # Aussparung im Nord-Dach fuer das Zwerchhaus
        yt = D - z_.get('tiefe_cm', 270); nord += [[z_['bis_cm'], D + ov, ze2], [z_['bis_cm'], yt, zN(yt)], [z_['von_cm'], yt, zN(yt)], [z_['von_cm'], D + ov, ze2]]
    nord += [[xg0, D + ov, ze2]]; i0 = len(V); V += nord
    F = [[0, 1, 2, 3, 4, 5], list(range(i0, len(V))) + [7, 4, 3, 6], [2, 6, 3], [5, 4, 7]]
    add('dach', f'Krueppelwalmdach {math.degrees(math.atan(ta)):.0f} Grad, Walm ab {round(zh)} cm, First {round(zr)} cm', mesh={'verts': V, 'faces': F}, material='dach', first_cm=round(zr))
    yo = max(0.0, (zh - ze2) / ta - ov)
    for gx0, gx1, nm_ in ((0, T, 'West'), (W - T, W, 'Ost')):   # Giebeldreieck-Stumpf (Trapez) zwischen Traufe und Walmansatz
        pv = [[gx, y, z] for gx in (gx0, gx1) for (y, z) in ((0, ze2), (D, ze2), (D - yo, zh), (yo, zh))]
        add('wand', f'Giebel {nm_} (bis Walmansatz)', mesh={'verts': pv, 'faces': [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]}, material='putz')
    for zi, z_ in enumerate(ZW, 1):   # Zwerchhaus: Front in der Fassadenflucht, Seitenwaende bis ins Dach, Flachdach, Tuer (Balkon davor per balkone geschoss=NF)
        a_, b_, t_, zo = z_['von_cm'], z_['bis_cm'], z_.get('tiefe_cm', 270), z_['oben_cm']; tb = z_.get('tuer_b_cm', 160); th = z_.get('tuer_h_cm', 210); tc = (a_ + b_) / 2
        y0z, y1z = D - T, D
        add('wand', f'Zwerchhaus {zi} Front links', box=box(a_, y0z, ze, tc - tb / 2, y1z, zo), material='putz')
        add('wand', f'Zwerchhaus {zi} Front rechts', box=box(tc + tb / 2, y0z, ze, b_, y1z, zo), material='putz')
        add('wand', f'Zwerchhaus {zi} Front Sturz', box=box(tc - tb / 2, y0z, ze + th, tc + tb / 2, y1z, zo), material='putz')
        add('wand', f'Zwerchhaus {zi} Wange West', box=box(a_, D - t_, ze, a_ + T, D - T, zo), material='putz')
        add('wand', f'Zwerchhaus {zi} Wange Ost', box=box(b_ - T, D - t_, ze, b_, D - T, zo), material='putz')
        add('dach', f'Zwerchhaus {zi} Flachdach', box=box(a_ - 15, D - t_ - 10, zo, b_ + 15, D + 15, zo + 18), material='blende')
        for nm_, bx in (('links', (tc - tb / 2, y1z - 12, ze, tc - tb / 2 + 7, y1z - 4, ze + th)), ('rechts', (tc + tb / 2 - 7, y1z - 12, ze, tc + tb / 2, y1z - 4, ze + th)),
                        ('oben', (tc - tb / 2, y1z - 12, ze + th - 7, tc + tb / 2, y1z - 4, ze + th)), ('Mitte', (tc - 3, y1z - 12, ze, tc + 3, y1z - 4, ze + th))):
            add('rahmen', f'Zwerchhaus {zi} Tuer Rahmen {nm_}', box=box(*bx), material='rahmen')
        add('glas', f'Zwerchhaus {zi} Tuer Glas', box=box(tc - tb / 2 + 7, y1z - 9, ze, tc + tb / 2 - 7, y1z - 7, ze + th - 7), material='glas')
    for gi, G in enumerate(H.get('giebelfenster', []), 1):   # Fenster im Giebel (ueber dem Kniestock, eigene Kaesten: Giebel ist kein Geschoss)
        s_, c_, gb, gh, gz = G.get('seite', 'W'), G['pos_cm'], G['b_cm'], G['h_cm'], G['z_cm']
        xw = -3 if s_ == 'W' else W - 5; xo = xw + 8
        add('glas', f'Giebelfenster {gi} Glas', box=box(xw + 2, c_ - gb / 2 + 7, gz + 7, xw + 4, c_ + gb / 2 - 7, gz + gh - 7), material='glas')
        for nm_, (ya_, yb_, za_, zb_) in (('links', (c_ - gb / 2, c_ - gb / 2 + 7, gz, gz + gh)), ('rechts', (c_ + gb / 2 - 7, c_ + gb / 2, gz, gz + gh)), ('unten', (c_ - gb / 2, c_ + gb / 2, gz, gz + 7)), ('oben', (c_ - gb / 2, c_ + gb / 2, gz + gh - 7, gz + gh)), ('Kreuz', (c_ - 3, c_ + 3, gz, gz + gh))):
            add('rahmen', f'Giebelfenster {gi} Rahmen {nm_}', box=box(xw, ya_, za_, xo, yb_, zb_), material='rahmen')
elif roof['typ'] == 'walm':
    from walmdach_geometrie import walmdach
    mesh, zr = walmdach(W, D, ov, ze, roof['neigung_grad'])
    x0, x1, y0, y1 = -ov, W + ov, -ov, D + ov
    add('dach', f'Walmdach {roof["neigung_grad"]} Grad, Ueberstand {ov} cm, First {round(zr)} cm', mesh=mesh, material='dach', first_cm=round(zr))
    fb = 22
    add('dach', 'Traufblende Sued', box=box(x0, y0 - 4, ze - fb, x1, y0, ze), material='blende')
    add('dach', 'Traufblende Nord', box=box(x0, y1, ze - fb, x1, y1 + 4, ze), material='blende')
    add('dach', 'Traufblende West', box=box(x0 - 4, y0, ze - fb, x0, y1, ze), material='blende')
    add('dach', 'Traufblende Ost', box=box(x1, y0, ze - fb, x1 + 4, y1, ze), material='blende')
elif BL:
    at = roof.get('attika_cm', 25); NROOF = [0]
    def roof_piece(x0, x1, y0, y1, zt, tag, y0b=None):   # y0 = Front-y bei x0, y0b = Front-y bei x1 (schraeg), y1 = hintere Kante
        NROOF[0] += 1; y0b = y0 if y0b is None else y0b
        if y0 == y0b:
            add('dach', 'Flachdach %s Abdichtung' % tag, box=box(x0, y0, zt, x1, y1, zt + 4), material='dach_flach')
            add('dach', 'Attika %s Sued' % tag, box=box(x0, y0, zt, x1, y0 + T, zt + at), material='attika_blende')
        else:
            add('dach', 'Flachdach %s Abdichtung (schraeg)' % tag, mesh=prism([(x0, y0), (x1, y0b), (x1, y1), (x0, y1)], zt, zt + 4), material='dach_flach')
            add('dach', 'Attika %s Sued (schraeg)' % tag, mesh=prism([(x0, y0), (x1, y0b), (x1, y0b + T), (x0, y0 + T)], zt, zt + at), material='attika_blende')
        add('dach', 'Attika %s Nord' % tag, box=box(x0, y1 - T, zt, x1, y1, zt + at), material='attika_blende')
        add('dach', 'Attika %s West' % tag, box=box(x0, y0, zt, x0 + T, y1, zt + at), material='attika_blende')
        add('dach', 'Attika %s Ost' % tag, box=box(x1 - T, y0b, zt, x1, y1, zt + at), material='attika_blende')
    for f in range(NF):
        zt = z_floor(f) + GH + DK; above = [sg for sg in segs_of(f + 1) if not sg.get('leer')] if f + 1 < NF else []
        for sg in [sg for sg in segs_of(f) if not sg.get('leer')]:
            yl, yr = yfr(sg); fln = 'EG' if f == 0 else '%d.OG' % f
            yat = lambda x: yl + (yr - yl) * (x - sg['x0_cm']) / max(1, sg['x1_cm'] - sg['x0_cm'])
            cuts = sorted({sg['x0_cm'], sg['x1_cm']} | {v for a in above for v in (a['x0_cm'], a['x1_cm']) if sg['x0_cm'] < v < sg['x1_cm']})
            for xa, xb in zip(cuts, cuts[1:]):
                xm = (xa + xb) / 2; ab = next((a for a in above if a['x0_cm'] <= xm <= a['x1_cm']), None)
                if ab is None:
                    roof_piece(xa, xb, yat(xa), D, zt, '%s %d-%d' % (fln, xa, xb), yat(xb))
                    KR = roof.get('kragplatte_cm', 0)   # 24.09. Villa: auskragende Dachplatte (30 cm) ueber dem Block
                    if KR: add('dach', 'Kragplatte %s %d-%d' % (fln, xa, xb), box=box(xa - (KR if xa <= 0 or f == NF - 1 else KR / 2), min(yat(xa), yat(xb)) - KR, zt, xb + (KR if xb >= W or f == NF - 1 else KR / 2), D + KR, zt + 30), material='kragplatte')
                else:
                    al, ar = yfr(ab); yab = lambda x: al + (ar - al) * (x - ab['x0_cm']) / max(1, ab['x1_cm'] - ab['x0_cm'])
                    if yat(xm) < yab(xm) - 5: roof_piece(xa, xb, yat(xa), max(yab(xa), yab(xb)), zt, '%s Terrasse %d-%d' % (fln, xa, xb), yat(xb))
    if not NROOF[0]: print('  !! kein Flachdach-Teil erzeugt')
else:
    at = roof.get('attika_cm', 25)
    add('dach', 'Flachdach-Abdichtung', box=box(0, 0, ze, W, D, ze + 4), material='dach_flach')
    add('dach', 'Attika Sued', box=box(0, 0, ze, W, T, ze + at), material='attika_blende')
    add('dach', 'Attika Nord', box=box(0, D - T, ze, W, D, ze + at), material='attika_blende')
    add('dach', 'Attika West', box=box(0, T, ze, T, D - T, ze + at), material='attika_blende')
    add('dach', 'Attika Ost', box=box(W - T, T, ze, W, D - T, ze + at), material='attika_blende')


# ---------- 6a. Dacheinschnitte (27.09. Tobi: Beethoven Gartenseite - Balkon "aus dem Dach gefraest", kein Aufbau) ----------
for ei_, E in enumerate(H['dach'].get('einschnitte', []) if isinstance(H.get('dach'), dict) else [], 1):
    a_, b_ = E['von_cm'], E['bis_cm']; t_ = E.get('tiefe_cm', 120); zu_ = E.get('unten_cm', z_floor(E.get('geschoss', NF - 1))); zo_ = E['oben_cm']
    ov_ = E.get('ueberstand_cm', 60); zt_ = E.get('traufe_cm', 680); yb_ = D - t_          # Einschnitt nur Nordseite (Garten)
    cut_ = box(a_, yb_, zu_, b_, D + ov_ + 20, zo_)
    for q in [q for q in parts if q['kat'] in ('dach', 'wand') and (q['name'].startswith(('Walmdach', 'Krueppelwalmdach', 'Kniestock Nord', 'Traufblende Nord')))]:
        if 'box' in q:
            bx = q['box']
            if bx[3] <= a_ or bx[0] >= b_ or bx[4] <= yb_ or bx[5] <= zu_: continue
        add('ausschnitt', f'Dacheinschnitt {ei_} in {q["name"][:28]}', ziel=q['id'], box=cut_, oeffnung=None)
    add('wand', f'Dacheinschnitt {ei_} Rueckwand', box=box(a_, yb_ - 24, zu_, b_, yb_, zo_), material='putz')
    tb_, th_ = E.get('tuer_b_cm', 165), E.get('tuer_h_cm', 210); c_ = (a_ + b_) / 2
    rw_ = parts[-1]
    add('ausschnitt', f'Dacheinschnitt {ei_} Tuer', ziel=rw_['id'], box=box(c_ - tb_/2, yb_ - 30, zu_, c_ + tb_/2, yb_ + 6, zu_ + th_), oeffnung=None)
    add('glas', f'Dacheinschnitt {ei_} Tuer Glas', box=box(c_ - tb_/2 + 6, yb_ - 14, zu_ + 6, c_ + tb_/2 - 6, yb_ - 12, zu_ + th_ - 6), material='glas')
    for nm_, bb_ in (('links', (c_ - tb_/2, yb_ - 18, zu_, c_ - tb_/2 + 7, yb_ - 8, zu_ + th_)), ('rechts', (c_ + tb_/2 - 7, yb_ - 18, zu_, c_ + tb_/2, yb_ - 8, zu_ + th_)),
                     ('oben', (c_ - tb_/2, yb_ - 18, zu_ + th_ - 7, c_ + tb_/2, yb_ - 8, zu_ + th_)), ('mitte', (c_ - 3.5, yb_ - 18, zu_, c_ + 3.5, yb_ - 8, zu_ + th_))):
        add('rahmen', f'Dacheinschnitt {ei_} Tuerrahmen {nm_}', box=box(*bb_), material='rahmen')
    # Seitenwangen: Keil unter der Dachflaeche (DN 45), aussen bis Traufe, innen bis Oberkante Einschnitt
    for sx_, nm_ in ((a_ - 20, 'West'), (b_, 'Ost')):
        V = []
        ys_ = max(yb_, D + ov_ - (zo_ - zt_) / math.tan(math.radians(E.get('dach_neigung_grad', 45))))   # 27.09.: Wange folgt der Dachflaeche bis zur Einschnitt-Oberkante, dann waagrecht (sauberer Anschluss)
        for x_ in (sx_, sx_ + 20):
            V += [(x_, D + ov_, zu_), (x_, D + ov_, zt_ - 2), (x_, ys_, zo_), (x_, yb_, zo_), (x_, yb_, zu_)]
        add('wand', f'Dacheinschnitt {ei_} Wange {nm_}', mesh={'verts': V, 'faces': [[0, 1, 2, 3, 4], [9, 8, 7, 6, 5], [0, 5, 6, 1], [1, 6, 7, 2], [2, 7, 8, 3], [3, 8, 9, 4], [4, 9, 5, 0]]}, material=E.get('wangen_material', 'dach'))
        SF = E.get('seitenfenster')   # 27.09. Tobi: an den Seiten des Einschnitts sind Fenster
        if SF:
            fb_, fh_, fr_ = SF.get('b_cm', 60), SF.get('h_cm', 100), SF.get('bruestung_cm', 90)
            ym_ = yb_ + SF.get('pos_cm', t_ / 2); y0_, y1_ = ym_ - fb_ / 2, ym_ + fb_ / 2
            ztop_ = (zo_ if y1_ <= ys_ else zt_ + (D + ov_ - y1_) * math.tan(math.radians(E.get('dach_neigung_grad', 45)))) - 12   # unter der Wangenoberkante bleiben
            z0_ = zu_ + fr_; z1_ = min(z0_ + fh_, ztop_)
            xi_ = sx_ + 20 if nm_ == 'West' else sx_; sg_ = 1 if nm_ == 'West' else -1
            gx_ = sorted((xi_ + sg_ * 1, xi_ + sg_ * 3)); rx_ = sorted((xi_, xi_ + sg_ * 6))
            add('glas', f'Dacheinschnitt {ei_} Seitenfenster {nm_} Glas', box=box(gx_[0], y0_, z0_, gx_[1], y1_, z1_), material='glas')
            for rn_, rb_ in (('unten', (y0_ - 6, z0_ - 6, y1_ + 6, z0_)), ('oben', (y0_ - 6, z1_, y1_ + 6, z1_ + 6)), ('vorne', (y1_, z0_, y1_ + 6, z1_)), ('hinten', (y0_ - 6, z0_, y0_, z1_))):
                add('rahmen', f'Dacheinschnitt {ei_} Seitenfenster {nm_} Rahmen {rn_}', box=box(rx_[0], rb_[0], rb_[1], rx_[1], rb_[2], rb_[3]), material='rahmen')
    add('dach', f'Dacheinschnitt {ei_} Sturz', box=box(a_ - 20, yb_ - 24, zo_, b_ + 20, D + ov_ - (zo_ - zt_) / math.tan(math.radians(E.get('dach_neigung_grad', 45))), zo_ + 12), material='putz')
    K = E.get('konsole')
    if K:   # Konsole unter dem Balkon (Keil an der Wand)
        ka_, kb_, kt_ = K['von_cm'], K['bis_cm'], K.get('tiefe_cm', 100); kz0_, kz1_ = K['unten_cm'], K['oben_cm']
        V = []
        for x_ in (ka_, kb_):
            V += [(x_, D, kz0_), (x_, D, kz1_), (x_, D + kt_, kz1_), (x_, D + kt_, kz1_ - 20)]
        add('detail', f'Dacheinschnitt {ei_} Balkonkonsole', mesh={'verts': V, 'faces': [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]}, material='beton')

# ---------- 6a2. Dachflaechenfenster (27.09. Tobi Foto Rueckseite) ----------
for di_, DF in enumerate(H['dach'].get('dachfenster', []) if isinstance(H.get('dach'), dict) else [], 1):
    a45_ = math.tan(math.radians(DF.get('neigung_grad', 45))); ov2_ = H['dach'].get('ueberstand_cm', 50); ze_ = DF.get('traufe_cm', 680)
    x0_, x1_ = DF['x_cm'] - DF['b_cm'] / 2, DF['x_cm'] + DF['b_cm'] / 2; z0_ = DF['unten_cm']; z1_ = z0_ + DF['h_cm'] * math.sin(math.atan(a45_))
    yy = lambda z: D + ov2_ - (z - ze_) / a45_
    V = []
    for off_ in (1, 7):   # knapp ueber der Dachflaeche (Normalenversatz ~ in y und z)
        V += [(x0_, yy(z0_) + off_ * 0.7, z0_ + off_ * 0.7), (x1_, yy(z0_) + off_ * 0.7, z0_ + off_ * 0.7), (x1_, yy(z1_) + off_ * 0.7, z1_ + off_ * 0.7), (x0_, yy(z1_) + off_ * 0.7, z1_ + off_ * 0.7)]
    add('glas', f'Dachflaechenfenster {di_}', mesh={'verts': V, 'faces': [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]}, material='glas')

# ---------- 6b. Dachstuhl (Sparren) - sichtbar im Roentgen-Wireframe ----------
if roof['typ'] == 'walm':
    ang = math.radians(roof['neigung_grad']); hw = min(W, D) / 2 + ov; zr = ze + math.tan(ang) * hw
    L, Q = max(W, D), min(W, D)
    sp = H.get('sparren_abstand_cm', 80); n = 0
    x = -ov + hw  # Sparren nur im Bereich zwischen den Walmen (dort laufen sie Traufe -> First)
    while x <= L + ov - hw + 1:
        for (y0, y1) in ((-ov, Q / 2), (Q + ov, Q / 2)):   # Sued- und Nordseite
            n += 1
            verts = [[x - 5, y0, ze - 12], [x + 5, y0, ze - 12], [x + 5, y1, zr - 12], [x - 5, y1, zr - 12],
                     [x - 5, y0, ze], [x + 5, y0, ze], [x + 5, y1, zr], [x - 5, y1, zr]]
            faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]
            if D > W: verts = [[v[1], v[0], v[2]] for v in verts]; faces = [list(reversed(f)) for f in faces]
            add('dachstuhl', f'Sparren {n} ({"Sued" if y0 < 0 else "Nord"}, x={round(x)})', mesh={'verts': verts, 'faces': faces}, material='holz')
        x += sp
    if L > Q:
        pf = box(-ov + hw, Q / 2 - 8, zr - 26, L + ov - hw, Q / 2 + 8, zr - 10)
        if D > W: pf = [pf[1], pf[0], pf[2], pf[4], pf[3], pf[5]]
        add('dachstuhl', 'Firstpfette', box=pf, material='holz')

# ---------- 6c. Treppe EG -> OG (gerader Lauf an der Westwand) ----------
if NF > 1 and H.get('treppe', True):
    steps = max(12, round((GH + DK) / 18)); rise = (GH + DK) / steps; run = min(30, max(25, 63 - 2 * rise)); tx0 = H.get('treppe_x_cm') or ((runs_of(1)[0][0] if BL and runs_of(1) else 0) + T + 40); ty0 = D - T - 120   # DIN 18065: 2s+a = 59-65; Treppe im ersten bebauten OG-Bereich
    for k in range(steps):
        z0 = k * rise; y = ty0 - k * run
        add('treppe', f'Stufe {k + 1}', box=box(tx0, y - run, z0, tx0 + 100, y, z0 + rise), material='beton_hell')
    add('treppe', 'Treppen-Handlauf', box=box(tx0 + 98, ty0 - steps * run, 90, tx0 + 102, ty0, GH + DK + 90), material='stahl')

# ---------- 7. Oeffnungen: Ausschnitt + Rahmen + Glas/Blatt ----------
UEBERSPRUNGEN = []
def find_wall(seite, f, pos):
    cands = [w for w in walls if w['seite'] == seite and (f in w.get('geschosse', [w['geschoss']])) and w['along'][0] <= pos <= w['along'][1]]
    if not cands:
        UEBERSPRUNGEN.append(f'{seite} G{f} pos {pos}'); return None   # robust: Oeffnung ohne Wand wird uebersprungen, nie Abbruch
    return cands[0]
# Erker-Ausschnitte auf ihre Ziele mappen (Hauptwand Nord je Geschoss, Erker-Wangen)
for p in [p for p in parts if p['kat'] == 'ausschnitt' and p.get('ziel') in ('__N__', '__ERKERWANGE__')]:
    if p['ziel'] == '__N__':
        b = p['box']; fl = p.get('geschosse', [0])
        p['ziel'] = next(w['id'] for w in walls if w['seite'] == 'N' and w['geschoss'] == fl[0] and 'Erker' not in w['name'])
        for f in fl[1:]:
            wid = next(w['id'] for w in walls if w['seite'] == 'N' and w['geschoss'] == f and 'Erker' not in w['name'])
            add('ausschnitt', p['name'] + f' G{f}', ziel=wid, box=list(b), quelle='Erker')
    else:
        ei, wn = p['erker_wange']; p['ziel'] = next(w['id'] for w in parts if w['kat'] == 'wand' and w['name'] == f'Erker {ei} Wange {wn}')
        b = p['box']; ym = (b[1] + b[4]) / 2; xm = (b[0] + b[3]) / 2
        add('rahmen', p['name'] + ' Rahmen', box=box(xm - 4, b[1] + 6, b[2], xm + 4, b[4] - 6, b[2] + 7), material='rahmen')
        add('rahmen', p['name'] + ' Rahmen oben', box=box(xm - 4, b[1] + 6, b[5] - 7, xm + 4, b[4] - 6, b[5]), material='rahmen')
        add('glas', p['name'] + ' Glas', box=box(xm - 0.6, b[1] + 8, b[2] + 7, xm + 0.6, b[4] - 8, b[5] - 7), material='glas')

for i, o in enumerate(H['oeffnungen'], 1):
    f = o['geschoss']; w = find_wall(o['seite'], f, o['pos_cm'])
    if w is None: continue
    if f >= NF: UEBERSPRUNGEN.append(f"{o['seite']} G{f} (Geschoss fehlt)"); continue
    wb = w.get('box') or w['bbox']; z0 = z_floor(f) + o['bruestung_cm']; z1 = z0 + o['h_cm']
    if w.get('ramp'):   # schraege Front: Wand-y an der Oeffnungsposition, Ausschnitt um die Schraege innerhalb der Oeffnungsbreite vertieft
        yl_, yr_ = w['ramp']; x0_, x1_ = w['along']; yp = yl_ + (yr_ - yl_) * (o['pos_cm'] - x0_) / max(1, x1_ - x0_)
        dy = o['b_cm'] / 2 * abs(yr_ - yl_) / max(1, x1_ - x0_); wb = [wb[0], yp - dy, wb[2], wb[3], yp + T + dy, wb[5]]
    a0 = o['pos_cm'] - o['b_cm'] / 2; a1 = o['pos_cm'] + o['b_cm'] / 2
    OC = 6  # Ueberschnitt durch die Wand
    if o['seite'] in ('S', 'N'):
        cut = box(a0, wb[1] - OC, z0, a1 + (T + OC if o.get('eck') == 'E' else 0), wb[4] + OC, z1); fy0, fy1 = wb[1], wb[4]   # eck: Eckpfosten mit ausschneiden
        outer_y = wb[1] if o['seite'] == 'S' else wb[4]
    else:
        cut = box(wb[0] - OC, a0 - (T + OC if o.get('eck') == 'S' else 0), z0, wb[3] + OC, a1, z1); fx0, fx1 = wb[0], wb[3]
        outer_x = wb[0] if o['seite'] == 'W' else wb[3]
    typ = o['typ']; label = {'fenster': 'Fenster', 'haustuer': 'Haustuer', 'garagentor': 'Garagentor', 'balkontuer': 'Balkontuer', 'terrassentuer': 'Terrassentuer'}.get(typ, typ)
    nm = f'{label} {o["seite"]}{f}-{i} ({o["b_cm"]}x{o["h_cm"]}, BRH {o["bruestung_cm"]})'
    add('ausschnitt', f'Ausschnitt fuer {nm}', ziel=w['id'], box=cut, quelle=o.get('quelle', ''), oeffnung=i)
    if o.get('absturzsicherung') == 'franz_balkon':   # Franzoesischer Balkon: Glasscheibe 90 cm + Handlauf 8 cm vor der Fassade (MBO Ã‚Â§ 38, Regel R03)
        zb = z_floor(f); zt = zb + 90
        if o['seite'] in ('S', 'N'):
            yg = outer_y - 9 if o['seite'] == 'S' else outer_y + 9
            [add('gelaender', f'Franz. Balkon Stab {k_} {nm}', box=box(a0, yg - 1, zb + (zt - zb) * f_ - 1, a1, yg + 1, zb + (zt - zb) * f_ + 1), material='stahl') for k_, f_ in enumerate((0.12, 0.3, 0.48, 0.66, 0.84), 1)] if o.get('gelaender_stil') == 'stab' else add('gelaender', f'Franz. Balkon Glas {nm}', box=box(a0, yg - 0.8, zb + 8, a1, yg + 0.8, zt - 4), material='glas')
            add('gelaender', f'Franz. Balkon Handlauf {nm}', box=box(a0 - 2, yg - 2, zt - 4, a1 + 2, yg + 2, zt), material='stahl')
            for xa in (a0 + 2, a1 - 2): add('gelaender', f'Franz. Balkon Pfosten {nm}', box=box(xa - 2, yg - 2, zb, xa + 2, yg + 2, zt), material='stahl')
        else:
            xg = outer_x - 9 if o['seite'] == 'W' else outer_x + 9
            [add('gelaender', f'Franz. Balkon Stab {k_} {nm}', box=box(xg - 1, a0, zb + (zt - zb) * f_ - 1, xg + 1, a1, zb + (zt - zb) * f_ + 1), material='stahl') for k_, f_ in enumerate((0.12, 0.3, 0.48, 0.66, 0.84), 1)] if o.get('gelaender_stil') == 'stab' else add('gelaender', f'Franz. Balkon Glas {nm}', box=box(xg - 0.8, a0, zb + 8, xg + 0.8, a1, zt - 4), material='glas')
            add('gelaender', f'Franz. Balkon Handlauf {nm}', box=box(xg - 2, a0 - 2, zt - 4, xg + 2, a1 + 2, zt), material='stahl')
            for ya in (a0 + 2, a1 - 2): add('gelaender', f'Franz. Balkon Pfosten {nm}', box=box(xg - 2, ya - 2, zb, xg + 2, ya + 2, zt), material='stahl')
    FR = 7; FD = 8   # Rahmenbreite / Rahmentiefe
    # Rahmen liegt in der Wandmitte; Glasfronten buendig an der Aussenkante (Tobi 14.09.: Scheiben nicht tief in der Fassade)
    if o['seite'] in ('S', 'N'):
        ym = (fy0 + fy1) / 2
        if typ == 'glasfront': ym = (outer_y + FD / 2 + 1) if o['seite'] == 'S' else (outer_y - FD / 2 - 1)
        ry0, ry1 = ym - FD / 2, ym + FD / 2
        def fb(ax0, ax1, bz0, bz1): return box(ax0, ry0, bz0, ax1, ry1, bz1)
        def gl(): return box(a0 + FR, ym - 0.6, z0 + FR, a1 - FR, ym + 0.6, z1 - FR)
        def panel(th): return box(a0, ym - th / 2, z0, a1, ym + th / 2, z1)
        def mull(ax): return box(ax - 3, ry0, z0 + FR, ax + 3, ry1, z1 - FR)
    else:
        xm = (fx0 + fx1) / 2
        if typ == 'glasfront': xm = (outer_x + FD / 2 + 1) if o['seite'] == 'W' else (outer_x - FD / 2 - 1)
        rx0, rx1 = xm - FD / 2, xm + FD / 2
        def fb(ax0, ax1, bz0, bz1): return box(rx0, ax0, bz0, rx1, ax1, bz1)
        def gl(): return box(xm - 0.6, a0 + FR, z0 + FR, xm + 0.6, a1 - FR, z1 - FR)
        def panel(th): return box(xm - th / 2, a0, z0, xm + th / 2, a1, z1)
        def mull(ax): return box(rx0, ax - 3, z0 + FR, rx1, ax + 3, z1 - FR)
    if typ in ('fenster', 'balkontuer', 'terrassentuer', 'glasfront'):
        add('rahmen', f'Rahmen unten {nm}', box=fb(a0, a1, z0, z0 + FR), material='rahmen', oeffnung=i)
        add('rahmen', f'Rahmen oben {nm}', box=fb(a0, a1, z1 - FR, z1), material='rahmen', oeffnung=i)
        add('rahmen', f'Rahmen links {nm}', box=fb(a0, a0 + FR, z0, z1), material='rahmen', oeffnung=i)
        add('rahmen', f'Rahmen rechts {nm}', box=fb(a1 - FR, a1, z0, z1), material='rahmen', oeffnung=i)
        nteil = 1 if o['b_cm'] <= 150 else (2 if o['b_cm'] <= 260 else (3 if o['b_cm'] <= 400 else (4 if o['b_cm'] <= 560 else 6)))
        for k in range(1, nteil):
            add('rahmen', f'Pfosten {k} {nm}', box=mull(a0 + (a1 - a0) * k / nteil), material='rahmen', oeffnung=i)
        FT = H.get('fenster_teilung')   # 26.09.: Fenster wie im Bauplan - 2 Fluegel + Oberlicht (Kaempfer)
        if FT and typ in ('fenster', 'balkontuer', 'terrassentuer'):
            if nteil == 1 and o['b_cm'] >= FT.get('fluegel_ab_cm', 85): add('rahmen', f'Pfosten Fluegel {nm}', box=mull((a0 + a1) / 2), material='rahmen', oeffnung=i)
            if FT.get('oberlicht_cm') and z1 - z0 >= FT.get('oberlicht_ab_hoehe_cm', 110):
                zk_ = z1 - FR - FT['oberlicht_cm']; add('rahmen', f'Kaempfer {nm}', box=fb(a0, a1, zk_ - 3, zk_ + 3), material='rahmen', oeffnung=i)
        add('glas', f'Glas {nm}', box=gl(), material='glas', oeffnung=i)
        RL = float(o.get('rollladen', 0) or 0)   # 24.09.: Rollladen/Raffstore, Anteil geschlossen 0..1 (Panzer 2 cm vor der Scheibe)
        if RL > 0:
            zr0 = z1 - FR - (z1 - z0 - 2 * FR) * min(1.0, RL)
            if o['seite'] == 'S': rb = box(a0 + 2, ry0 - 4, zr0, a1 - 2, ry0 - 2, z1 - 2)
            elif o['seite'] == 'N': rb = box(a0 + 2, ry1 + 2, zr0, a1 - 2, ry1 + 4, z1 - 2)
            elif o['seite'] == 'W': rb = box(rx0 - 4, a0 + 2, zr0, rx0 - 2, a1 - 2, z1 - 2)
            else: rb = box(rx1 + 2, a0 + 2, zr0, rx1 + 4, a1 - 2, z1 - 2)
            add('detail', f'Rollladen {int(RL * 100)} % {nm}', box=rb, material='rollladen', oeffnung=i)
        if DETAILS and typ == 'fenster' and o['bruestung_cm'] > 0:   # 24.09.: Fensterbank aussen (Alu, 4 cm Ueberstand, 3 cm stark)
            if o['seite'] == 'S': sb = box(a0 - 3, outer_y - 4, z0 - 3, a1 + 3, ry0, z0)
            elif o['seite'] == 'N': sb = box(a0 - 3, ry1, z0 - 3, a1 + 3, outer_y + 4, z0)
            elif o['seite'] == 'W': sb = box(outer_x - 4, a0 - 3, z0 - 3, rx0, a1 + 3, z0)
            else: sb = box(rx1, a0 - 3, z0 - 3, outer_x + 4, a1 + 3, z0)
            add('detail', f'Fensterbank {nm}', box=sb, material='fensterbank', oeffnung=i)
        # Innenraum: dunkle Box 80 cm hinter der Wand (Fotorealismus: Fenster wirken tief, kein Blick durchs Haus)
        if o['seite'] in ('S', 'N'):
            yi0, yi1 = (wb[4] + 1, wb[4] + 80) if o['seite'] == 'S' else (wb[1] - 80, wb[1] - 1)
            add('innen', f'Innenraum {nm}', box=box(a0 + 2, yi0, z0 + 2, a1 - 2, yi1, z1 - 2), material='innen', oeffnung=i)
        else:
            xi0, xi1 = (wb[3] + 1, wb[3] + 80) if o['seite'] == 'W' else (wb[0] - 80, wb[0] - 1)
            add('innen', f'Innenraum {nm}', box=box(xi0, a0 + 2, z0 + 2, xi1, a1 - 2, z1 - 2), material='innen', oeffnung=i)
    elif typ == 'haustuer':
        add('tuer', f'Tuerblatt {nm}', box=panel(5), material='tuer', oeffnung=i)
        add('rahmen', f'Zarge links {nm}', box=fb(a0, a0 + 5, z0, z1), material='rahmen', oeffnung=i)
        add('rahmen', f'Zarge rechts {nm}', box=fb(a1 - 5, a1, z0, z1), material='rahmen', oeffnung=i)
        add('rahmen', f'Zarge oben {nm}', box=fb(a0, a1, z1 - 5, z1), material='rahmen', oeffnung=i)
    elif typ == 'garagentor':
        add('tor', f'Sektionaltor {nm}', box=panel(5), material='tor', oeffnung=i)
        for k in range(1, 4):
            zz = z0 + o['h_cm'] * k / 4
            if o['seite'] in ('S', 'N'): g = box(a0, ym - 3, zz - 1.5, a1, ym + 3, zz + 1.5)
            else: g = box(xm - 3, a0, zz - 1.5, xm + 3, a1, zz + 1.5)
            add('tor', f'Tor-Fuge {k} {nm}', box=g, material='fuge', oeffnung=i)

# ---------- 7b. Details (24.09., Tobi: 'wirkt wie Computerspiel / zu langweilig') ----------
# Traufblende + Dachrinne + Fallrohre + Ortgang, Vordach, PV-Anlage, Giebel in Holz, Garage/Carport - alles als normale Teile.
GAR_CUT = []; GAR_BOX = None; GAR_EINFAHRT = None
_fog = str(MAT.get('fassade_og', '')).lower()   # 24.09. Villa: eigenes Fassadenmaterial fuer OG und hoeher (z. B. EG Klinker, OG Holz)
if _fog:
    _k = ('holz_dunkel' if 'dunkel' in _fog else 'holz_fassade') if 'holz' in _fog else ('klinker' if 'klinker' in _fog else 'putz')
    for p in parts:
        if p['kat'] == 'wand' and p.get('geschoss', 0) >= 1 and 'Mittelwand' not in p['name']: p['material'] = _k
if DETAILS:
    from pitched_roof import extrude_section
    if roof['typ'] in ('sattel', 'pult'):
        _sw = roof['typ'] == 'pult' or roof.get('first_richtung', 'y') == 'x'
        _span, _len = (D, W) if _sw else (W, D); _sl = math.tan(math.radians(roof.get('neigung_grad', 30)))
        _h = lambda u: ze + _sl * (u if roof['typ'] == 'pult' else min(u, _span - u))
        _edges = [-ov, _span + ov] if roof['typ'] == 'pult' else [-ov, _span / 2, _span + ov]
        _traufen = [-ov] if roof['typ'] == 'pult' else [-ov, _span + ov]
        def _ub(u0, u1, v0, v1, z0, z1):   # Box in (u, v) -> Weltbox
            return box(v0, u0, z0, v1, u1, z1) if _sw else box(u0, v0, z0, u1, v1, z1)
        for tu in _traufen:
            zl = _h(tu); o_ = -1 if tu < 0 else 1; ua = tu if tu < 0 else tu   # Aussenkante der Dachplatte
            add('detail', f'Traufblende {"Sued" if tu < 0 else "Nord"}' if _sw else f'Traufblende {"West" if tu < 0 else "Ost"}',
                box=_ub(min(ua, ua + 3 * o_), max(ua, ua + 3 * o_), -ov, _len + ov, zl - 20, zl + 14), material='blende')
            add('detail', 'Dachrinne ' + ('Sued' if tu < 0 else 'Nord'), box=_ub(min(ua + 3 * o_, ua + 16 * o_), max(ua + 3 * o_, ua + 16 * o_), -ov, _len + ov, zl - 16, zl - 3), material='rinne')
            uw = 0 if tu < 0 else _span   # Aussenwand
            for vv in (22, _len - 22):
                add('detail', f'Fallrohr {"Sued" if tu < 0 else "Nord"} {int(vv)}', box=_ub(min(uw + 2 * o_, uw + 12 * o_), max(uw + 2 * o_, uw + 12 * o_), vv - 5, vv + 5, 0, zl - 22), material='rinne')
                add('detail', f'Fallrohr-Bogen {"Sued" if tu < 0 else "Nord"} {int(vv)}', box=_ub(min(uw + 2 * o_, ua + 10 * o_), max(uw + 2 * o_, ua + 10 * o_), vv - 5, vv + 5, zl - 30, zl - 20), material='rinne')
        for v0_, v1_, lab in ((-ov - 3, -ov, 'Anfang'), (_len + ov, _len + ov + 3, 'Ende')):   # Ortgangblende an den Giebelkanten
            for a, b in zip(_edges, _edges[1:]):
                add('detail', f'Ortgang {lab} {int(a)}', mesh=extrude_section([(a, _h(a) - 20), (b, _h(b) - 20), (b, _h(b) + 14), (a, _h(a) + 14)], v0_, v1_, _sw), material='blende')
        if H.get('pv'):   # PV auf der ersten Dachflaeche (Sued bei First x / Pult), 25 cm Rand, 5 cm ueber der Eindeckung
            u1, u2 = 30, (_span / 2 - 70) if roof['typ'] == 'sattel' else _span - 70; v1, v2 = 110, _len - 110
            if u2 - u1 > 150 and v2 - v1 > 200:
                add('pv', f'PV-Anlage ({round((u2 - u1) / math.cos(math.atan(_sl)) * (v2 - v1) / 1e4, 1)} m2 Modulflaeche)',
                    mesh=extrude_section([(u1, _h(u1) + 17), (u2, _h(u2) + 17), (u2, _h(u2) + 21), (u1, _h(u1) + 21)], v1, v2, _sw), material='pv',
                    flaeche_m2=round((u2 - u1) / math.cos(math.atan(_sl)) * (v2 - v1) / 1e4, 1))
        if 'holz' in str(MAT.get('giebel', '')).lower():   # Giebeldreieck mit Holzverschalung (Material der Giebelwand)
            for p in parts:
                if p['kat'] == 'wand' and 'Giebel' in p['name'] and 'mesh' in p: p['material'] = 'holz_fassade'
    # Kamin + Fallrohre am Flachdach (24.09., Bauhaus-Vorlage)
    if H.get('kamin'):
        KM = H['kamin']; kx, ky = KM['x_cm'], KM['y_cm']
        add('detail', 'Kamin (Putz anthrazit, Edelstahlaufsatz)', box=box(kx - 25, ky - 25, ze, kx + 25, ky + 25, ze + KM.get('hoehe_cm', 140)), material='kamin')
    for xf in H.get('fallrohre_s', []):
        hoch = any(not sg.get('leer') and sg['x0_cm'] <= xf <= sg['x1_cm'] for sg in segs_of(NF - 1)) if NF > 1 else True
        zt_ = (ze if hoch else z_floor(0) + GH + DK) + roof.get('attika_cm', 0) - 5; yf_ = yfront(0, xf)
        add('detail', f'Fallrohr Sued x={int(xf)}', box=box(xf - 5, yf_ - 12, 0, xf + 5, yf_ - 2, zt_), material='rinne')
    # Vordach ueber der Haustuer (Sued, EG)
    for o in H['oeffnungen']:
        if o['typ'] == 'haustuer' and o['seite'] == 'S' and o['geschoss'] == 0:
            yf = yfront(0, o['pos_cm']); zt = o['bruestung_cm'] + o['h_cm'] + 22; a0 = o['pos_cm'] - o['b_cm'] / 2 - 45; a1 = o['pos_cm'] + o['b_cm'] / 2 + 45
            glas = 'glas' in str(H.get('vordach', '')).lower()
            add('detail', 'Vordach Haustuer' + (' (Glas)' if glas else ''), box=box(a0, yf - 120, zt, a1, yf, zt + (3 if glas else 12)), material='glas' if glas else 'blende')
            if glas:
                for xx in (a0 + 15, a1 - 15): add('detail', f'Vordach Zugstange {int(xx)}', box=box(xx - 1.5, yf - 110, zt + 3, xx + 1.5, yf, zt + 60), material='stahl')
                add('detail', 'Vordach Glasrahmen', box=box(a0, yf - 122, zt - 2, a1, yf - 116, zt + 5), material='stahl')
            add('detail', 'Wandleuchte Eingang', box=box(a1 + 10, yf - 10, 185, a1 + 22, yf, 215), material='blende')
            break
    # Garage / Carport (Ost, 1 m hinter der Strassenfront), Einfahrt bis zur Strasse
    GA = H.get('garage_bau')
    if GA:
        gx0_ = W + GA.get('abstand_cm', 30); gx1_ = gx0_ + GA.get('breite_cm', 330); gy0_ = GA.get('zurueck_cm', 100); gy1_ = gy0_ + GA.get('tiefe_cm', 620)
        gh = GA.get('hoehe_cm', 285); typ_ = GA.get('typ', 'massivgarage'); GAR_BOX = (gx0_, gy0_, gx1_, gy1_); GAR_CUT.append((gx0_ - 20, gx1_ + 20))
        if typ_ == 'carport':
            for k, (px_, py_) in enumerate(((gx0_, gy0_), (gx1_ - 14, gy0_), (gx0_, gy1_ - 14), (gx1_ - 14, gy1_ - 14)), 1):
                add('garage', f'Carport Pfosten {k}', box=box(px_, py_, 0, px_ + 14, py_ + 14, 245), material='holz')
            add('garage', 'Carport Dach', box=box(gx0_ - 25, gy0_ - 25, 245, gx1_ + 25, gy1_ + 25, 262), material='blende')
            add('garage', 'Carport Blende', box=box(gx0_ - 27, gy0_ - 27, 240, gx1_ + 27, gy1_ + 27, 268), material='holz')
        else:
            tw = 24 if typ_ == 'massivgarage' else 12; tb = GA.get('tor_b_cm', 250); th = GA.get('tor_h_cm', 213); tm = (gx0_ + gx1_) / 2
            add('garage', 'Garage Wand West', box=box(gx0_, gy0_, 0, gx0_ + tw, gy1_, gh), material='putz')
            add('garage', 'Garage Wand Ost', box=box(gx1_ - tw, gy0_, 0, gx1_, gy1_, gh), material='putz')
            add('garage', 'Garage Wand Nord', box=box(gx0_, gy1_ - tw, 0, gx1_, gy1_, gh), material='putz')
            add('garage', 'Garage Front links', box=box(gx0_, gy0_, 0, tm - tb / 2, gy0_ + tw, gh), material='putz')
            add('garage', 'Garage Front rechts', box=box(tm + tb / 2, gy0_, 0, gx1_, gy0_ + tw, gh), material='putz')
            add('garage', 'Garage Sturz', box=box(tm - tb / 2, gy0_, th, tm + tb / 2, gy0_ + tw, gh), material='putz')
            add('garage', 'Garage Flachdach', box=box(gx0_ - 5, gy0_ - 5, gh, gx1_ + 5, gy1_ + 5, gh + 12), material='dach_flach')
            add('garage', 'Garage Attika', box=box(gx0_ - 6, gy0_ - 6, gh + 12, gx1_ + 6, gy1_ + 6, gh + 22), material='attika_blende')
            add('tor', f'Garagentor Sektional ({tb}x{th})', box=box(tm - tb / 2, gy0_ + tw / 2 - 2, 0, tm + tb / 2, gy0_ + tw / 2 + 2, th), material='tor')
            for k in range(1, 4):
                zz = th * k / 4; add('tor', f'Garagentor Fuge {k}', box=box(tm - tb / 2, gy0_ + tw / 2 - 3, zz - 1.5, tm + tb / 2, gy0_ + tw / 2 + 3, zz + 1.5), material='fuge')
        GAR_EINFAHRT = (gx0_ - 10, gx1_ + 10, gy0_)

# ---------- 8. Aussenanlage ----------
# Grundstuecks-Vorlagen S/M/L (Rasen, Hecke, Einfahrt, Terrasse, Gartenweg, Baeume) - Basis fuer jedes generierte Haus
GRUNDSTUECKE = {
    'S': {'links_cm': 350, 'rechts_cm': 350, 'hinten_cm': 700, 'vorne_cm': 1200, 'baeume': 2, 'hecke': True, 'name': 'S ~ 400 m2 (Reihenhaus-/Stadtgrundstueck)'},
    'M': {'links_cm': 500, 'rechts_cm': 500, 'hinten_cm': 1000, 'vorne_cm': 1400, 'baeume': 4, 'hecke': True, 'name': 'M ~ 650 m2 (Einfamilienhaus)'},
    'L': {'links_cm': 800, 'rechts_cm': 800, 'hinten_cm': 1600, 'vorne_cm': 1600, 'baeume': 6, 'hecke': True, 'name': 'L ~ 1000 m2 (Villa mit Garten)'},
}
G = H.get('grundstueck', 'M')
if isinstance(G, str): G = dict(GRUNDSTUECKE.get(G.upper(), GRUNDSTUECKE['M']), preset=G.upper())
else: G = dict(GRUNDSTUECKE['M'], **G)
gx0, gx1, gy0, gy1 = -G['links_cm'], W + G['rechts_cm'], -G['vorne_cm'], D + G['hinten_cm']
if GEL and (min(GEL.values()) < -100 or H.get('gelaende_netz')):   # 05.10. Hanglage: Rasen als Gelaende-Netz (08.10.: auch per H['gelaende_netz'], z. B. Hang zur Strasse) (sonst liegt der freie Keller unter einer flachen Wiese)
    _xs = [-3000, -1200, -600, -300, 0, W / 2, W, W + 300, W + 600, W + 1200, W + 3000]; _ys = [-3000, -1200, -600, -300, 0, D / 2, D, D + 300, D + 600, D + 1200, D + 3000]
    _V = [[x_, y_, round(gel_z(x_, y_), 1)] for y_ in _ys for x_ in _xs]; _n = len(_xs)
    add('gelaende', 'Rasen (Hang)', mesh={'verts': _V, 'faces': [[j * _n + i, j * _n + i + 1, (j + 1) * _n + i + 1, (j + 1) * _n + i] for j in range(len(_ys) - 1) for i in range(_n - 1)]}, material='rasen')
else: add('gelaende', 'Rasen', box=box(-3000, -3000, -3, W + 3000, D + 3000, 0), material='rasen')
gar = [o for o in H['oeffnungen'] if o['typ'] == 'garagentor' and o['seite'] == 'S']
if gar:
    g = gar[0]; a0 = g['pos_cm'] - g['b_cm'] / 2 - 20; a1 = g['pos_cm'] + g['b_cm'] / 2 + 20
    yf_gar = (vor['ruecksprung_cm'] if vor else yfront(0, g['pos_cm']))
    add('gelaende', 'Einfahrt Beton', box=box(a0, gy0, -2, a1, yf_gar, 0.5), material='beton_hell')
if GAR_EINFAHRT: add('gelaende', 'Einfahrt Garage', box=box(GAR_EINFAHRT[0], gy0, -2, GAR_EINFAHRT[1], GAR_EINFAHRT[2], 0.5), material='beton_hell')
tur = [o for o in H['oeffnungen'] if o['typ'] == 'haustuer' and o['seite'] == 'S']
if tur:
    t = tur[0]; a0 = t['pos_cm'] - 80; a1 = t['pos_cm'] + 80
    yf_tur = (vor['ruecksprung_cm'] if vor else yfront(0, t['pos_cm']))
    add('gelaende', 'Weg zur Haustuer', box=box(a0, gy0, -2, a1, yf_tur, 0.5), material='beton_hell')
    add('gelaende', 'Eingangspodest', box=box(vor['von_cm'] if vor else a0 - 50, 0, -2, W if vor else a1 + 50, yf_tur if vor else 0, 0.5), material='beton_hell')
add('gelaende', 'Gehweg', box=box(-3000, gy0 - 200, -2, W + 3000, gy0, 0.5), material='beton_hell')
add('gelaende', 'Strasse', box=box(-3000, gy0 - 1000, -2, W + 3000, gy0 - 200, 0.5), material='asphalt')
# Grundstueck (Linienplan), Terrasse hinten, Baeume als Low-Poly-Kugeln
for nm, b in (('Grundstuecksgrenze Sued', box(gx0, gy0, -0.5, gx1, gy0 + 1, 0.5)), ('Grundstuecksgrenze Nord', box(gx0, gy1 - 1, -0.5, gx1, gy1, 0.5)),
              ('Grundstuecksgrenze West', box(gx0, gy0, -0.5, gx0 + 1, gy1, 0.5)), ('Grundstuecksgrenze Ost', box(gx1 - 1, gy0, -0.5, gx1, gy1, 0.5))):
    add('grundstueck', nm, box=b, material='beton_hell')
TE = H.get('terrasse', {'mitte_cm': W * 0.5, 'breite_cm': W * 0.55, 'tiefe_cm': 350})
add('grundstueck', 'Terrasse Nord', box=box(max(0, TE['mitte_cm'] - TE['breite_cm'] / 2), D, -2, min(W, TE['mitte_cm'] + TE['breite_cm'] / 2), D + TE['tiefe_cm'], 6), material='beton_hell')
def tree(name, cx, cy, r=130, h=430):
    verts = []; faces = []; rings = 6; segs = 10; zc = h - r * 0.2
    for i in range(1, rings):
        ph = math.pi * i / rings
        for j in range(segs):
            th = 2 * math.pi * j / segs
            verts.append([cx + r * math.sin(ph) * math.cos(th), cy + r * math.sin(ph) * math.sin(th), zc + r * math.cos(ph)])
    top = len(verts); verts.append([cx, cy, zc + r]); bot = len(verts); verts.append([cx, cy, zc - r])
    for i in range(rings - 2):
        for j in range(segs):
            a = i * segs + j; b = i * segs + (j + 1) % segs; faces.append([a, b, b + segs, a + segs])
    for j in range(segs):
        faces.append([top, (j + 1) % segs, j]); faces.append([bot, (rings - 2) * segs + j, (rings - 2) * segs + (j + 1) % segs])
    add('baum', name + ' Krone', mesh={'verts': verts, 'faces': faces}, material='rasen')
    add('baum', name + ' Stamm', box=box(cx - 12, cy - 12, 0, cx + 12, cy + 12, zc - r * 0.6), material='holz')
# Baum-Plaetze ausserhalb der Kamera-Achsen (Front-Kamera SW -> Hausmitte, Rueck-Kamera NE -> Hausmitte)
_cam_nw = any(e.get('seite', 'N') == 'N' and e['pos_cm'] < W / 2 for e in H.get('erker', []))   # Rueckkamera von NW -> hintere Baeume nach NE
_back = [gx1 - 200, gy1 - 240] if _cam_nw else [gx0 + 200, gy1 - 220]
_tree_slots = [_back, [gx1 - 180, gy0 + 260], [gx0 + 180, D * 0.5] if not _cam_nw else [gx1 - 160, D * 0.55], [gx1 - 160, D * 0.25] if not _cam_nw else [gx0 + 180, D * 0.15], [gx0 + 250, gy0 + 300], [W * 0.5, gy1 - 200]]
_bl = H.get('baeume', _tree_slots[:int(G.get('baeume', 3))])
if GAR_BOX: _bl = [(tx, ty) for tx, ty in _bl if not (GAR_BOX[0] - 180 < tx < GAR_BOX[2] + 180 and GAR_BOX[1] - 180 < ty < GAR_BOX[3] + 180)]   # kein Baum in der Garage
for i, (tx, ty) in enumerate(_bl, 1):
    tree(f'Baum {i}', tx, ty)
# Hecke rund ums Grundstueck (Strassenseite offen an Einfahrt + Weg), Gartenweg zur Terrasse
if G.get('hecke', True):
    hh, ht = 100, 60   # 2026-09-22: 100 statt 120 cm (Kamera auf 165 cm schaut drueber)
    add('garten', 'Hecke West', box=box(gx0, gy0 + 200, 0, gx0 + ht, gy1, hh), material='hecke')
    add('garten', 'Hecke Ost', box=box(gx1 - ht, gy0 + 200, 0, gx1, gy1, hh), material='hecke')
    add('garten', 'Hecke Nord', box=box(gx0, gy1 - ht, 0, gx1, gy1, hh), material='hecke')
    gar_x = [(o['pos_cm'] - o['b_cm'] / 2 - 40, o['pos_cm'] + o['b_cm'] / 2 + 40) for o in H['oeffnungen'] if o['typ'] == 'garagentor' and o['seite'] == 'S']
    tur_x = [(o['pos_cm'] - 100, o['pos_cm'] + 100) for o in H['oeffnungen'] if o['typ'] == 'haustuer' and o['seite'] == 'S']
    cuts = sorted(gar_x + tur_x + GAR_CUT); x = gx0; segs = []
    for a, b in cuts:
        if a > x: segs.append((x, a))
        x = max(x, b)
    if x < gx1: segs.append((x, gx1))
    for k, (a, b) in enumerate(segs, 1):
        add('garten', f'Hecke Sued {k}', box=box(a, gy0 + 10, 0, b, gy0 + 10 + ht, 80), material='hecke')
    TEc = TE['mitte_cm']
    add('garten', 'Gartenweg', box=box(TEc - 50, D + TE['tiefe_cm'], -1, TEc + 50, gy1 - ht - 20, 1), material='beton_hell')
# Pergola ueber der Terrasse (Kreativ-Katalog): 4 Pfosten + 2 Laengsbalken + Sparren
PG = H.get('pergola')
if PG:
    pa, pb = PG['mitte_cm'] - PG['breite_cm'] / 2, PG['mitte_cm'] + PG['breite_cm'] / 2; pt = PG['tiefe_cm']; ph = PG['hoehe_cm']
    for k, (px_, py_) in enumerate(((pa, D + 30), (pb - 12, D + 30), (pa, D + pt - 12), (pb - 12, D + pt - 12)), 1):
        add('pergola', f'Pergola Pfosten {k}', box=box(px_, py_, 0, px_ + 12, py_ + 12, ph), material='holz')
    add('pergola', 'Pergola Balken Nord', box=box(pa - 20, D + pt - 14, ph, pb + 20, D + pt, ph + 16), material='holz')
    add('pergola', 'Pergola Balken Haus', box=box(pa - 20, D + 28, ph, pb + 20, D + 42, ph + 16), material='holz')
    n = max(4, int(PG['breite_cm'] / 60))
    for k in range(n + 1):
        x = pa + (pb - pa) * k / n
        add('pergola', f'Pergola Sparren {k + 1}', box=box(x - 4, D + 10, ph + 16, x + 4, D + pt + 20, ph + 26), material='holz')
    add('garten', 'Beet Nord', box=box(gx0 + ht + 20, gy1 - ht - 160, -1, gx1 - ht - 20, gy1 - ht - 20, 8), material='erde')

# ---------- 8b. Holzdeck + Pool (24.09. Villa): Deck 28 cm hoch als Rahmen um das Becken, Wasser spiegelt ----------
PO = H.get('pool')
if PO:
    dx0, dx1, dy0, dy1 = PO['deck']; px0, px1, py0, py1 = PO['becken']; dz = 28
    for nm, b in (('West', (dx0, dy0, px0, dy1)), ('Ost', (px1, dy0, dx1, dy1)), ('Sued', (px0, dy0, px1, py0)), ('Nord', (px0, py1, px1, dy1))):
        if b[2] - b[0] > 1 and b[3] - b[1] > 1: add('pool', f'Holzdeck {nm}', box=box(b[0], b[1], 0, b[2], b[3], dz), material='holz_deck')
    add('pool', 'Pool Beckenrand (Naturstein)', box=box(px0 - 25, py0 - 25, dz, px1 + 25, py0, dz + 3), material='beton_hell')
    add('pool', 'Pool Beckenrand Nord', box=box(px0 - 25, py1, dz, px1 + 25, py1 + 25, dz + 3), material='beton_hell')
    add('pool', 'Pool Beckenrand West', box=box(px0 - 25, py0, dz, px0, py1, dz + 3), material='beton_hell')
    add('pool', 'Pool Beckenrand Ost', box=box(px1, py0, dz, px1 + 25, py1, dz + 3), material='beton_hell')
    add('pool', 'Pool Beckenboden (Fliese)', box=box(px0, py0, 0, px1, py1, 2), material='pool_fliese')
    add('pool', f'Pool Wasser ({round((px1 - px0) * (py1 - py0) / 1e4, 1)} m2)', box=box(px0, py0, 2, px1, py1, dz - 4), material='wasser', flaeche_m2=round((px1 - px0) * (py1 - py0) / 1e4, 1))

# ---------- 8c. (26.09. Bauplan Beethovenstr.) abgeschraegte Ecken, Eckbalkone um die Ecke, angebaute Garagen ----------
ESG = H.get('ecken_schraeg_geschosse')   # z. B. [1]: nur das OG ist abgeschraegt (Tobi 26.09.: unter dem Balkon keine Schraege)
def _es_ok(b): return not ESG or any(z_floor(f) - 5 <= b[2] and b[5] <= z_floor(f + 1) + 5 for f in ESG)
ES = H.get('ecken_schraeg', {})   # z. B. {'NW': 125, 'NE': 125}: Ecke im Grundriss unter 45 Grad abgeschnitten (alle Geschosse, Kniestock, Keller)
if ES:
    baender = set()
    for p in [q for q in parts if q['kat'] in ('wand', 'sockel') and 'box' in q and not q['name'].startswith('Kniestock') and _es_ok(q['box'])]:   # 26.09. Tobi: ueber der Schraege ist zu
        x0, y0, z0, x1, y1, z1 = p['box']; nm = p['name']; ch = False
        for ek, c in ES.items():
            nord = ek[0] == 'N'; west = ek[1] == 'W'
            yin = (y0 < c) if not nord else (y1 > D - c)
            if (x1 - x0) >= (y1 - y0) and (y1 >= D - T - 1 if nord else y0 <= T + 1):   # Laengswand Nord/Sued
                if west and x0 < c: x0 = c; ch = True
                if not west and x1 > W - c: x1 = W - c; ch = True
            elif (y1 - y0) > (x1 - x0) and (x0 <= T + 1 if west else x1 >= W - T - 1) and yin:   # Seitenwand West/Ost
                if nord: y1 = D - c
                else: y0 = c
                ch = True
            if ch: baender.add((ek, c, z0, z1))
        if ch:
            p['box'] = box(x0, y0, z0, x1, y1, z1)
            if 'along' in p: p['along'] = [x0, x1] if p.get('seite') in ('N', 'S') else [y0, y1]
    TU = {B['ecke']: (z_floor(B.get('geschoss', 1)), B.get('tuer_b_cm', 88.5), B.get('tuer_h_cm', 210)) for B in H.get('eckbalkone', []) if B.get('tuer', True)}
    for (ek, c, z0, z1) in sorted(baender):
        sx = 1 if ek[1] == 'W' else -1; bx0 = 0 if ek[1] == 'W' else W; sy = -1 if ek[0] == 'N' else 1; by0 = D if ek[0] == 'N' else 0
        P = lambda u, v: (bx0 + sx * u, by0 + sy * v)
        O_ = lambda s_, k_=0: tuple(P(c * s_ * (1 - k_) + (T + (c - T) * s_) * k_, c * (1 - s_) * (1 - k_) + (c - (c - T) * s_) * k_))   # k_=0 aussen, 1 innen
        def _sw(s0, s1, za, zb_, nm_='', k0=0, k1=1, kat='wand', mat='putz'):
            add(kat, f'Schraegwand Ecke {ek}{nm_} ({round(za)}-{round(zb_)})' if kat == 'wand' else f'Eck-Tuer {ek}{nm_}', mesh=prism(_ccw([O_(s0, k0), O_(s1, k0), O_(s1, k1), O_(s0, k1)]), za, zb_), material=mat)
        tu = TU.get(ek)
        if tu and z0 <= tu[0] < z1 - 50:   # Tuer zum Eckbalkon mittig in der Schraege (Plan: 44 | 88,5 | 44)
            zf_, tb_, th_ = tu; L_ = c * math.sqrt(2); s0, s1 = 0.5 - tb_ / 2 / L_, 0.5 + tb_ / 2 / L_; zt_ = min(zf_ + th_, z1); fr = 7 / L_
            _sw(0, s0, z0, z1, ' links'); _sw(s1, 1, z0, z1, ' rechts')
            if zt_ < z1: _sw(s0, s1, zt_, z1, ' Sturz')
            if zf_ > z0: _sw(s0, s1, z0, zf_, ' unten')
            for nm_, (a0, a1, za, zb_) in ((' Rahmen links', (s0, s0 + fr, zf_, zt_)), (' Rahmen rechts', (s1 - fr, s1, zf_, zt_)), (' Rahmen oben', (s0, s1, zt_ - 7, zt_)), (' Rahmen unten', (s0, s1, zf_, zf_ + 5))):
                _sw(a0, a1, za, zb_, nm_, 0.15, 0.4, 'rahmen', 'rahmen')
            _sw(s0 + fr, s1 - fr, zf_ + 5, zt_ - 7, ' Glas', 0.25, 0.3, 'glas', 'glas')
        else: _sw(0, 1, z0, z1)
for bi, B in enumerate(H.get('eckbalkone', []), 1):   # Balkon laeuft um die abgeschraegte Ecke herum (26.09. v3 nach Plan 1.OG)
    ek = B['ecke']; c = ES.get(ek, 125); t_ = B.get('tiefe_cm', 100); f = B.get('geschoss', 1); zb = z_floor(f); hg = B.get('gelaender_hoehe_cm', 100)
    ln = B.get('laenge_cm', c); ls = B.get('laenge_seite_cm', ln); fa = min(B.get('fase_cm', 0), t_ + min(ln, ls)); ts_ = B.get('tiefe_seite_cm', t_)   # t_ = Tiefe vor der Laengswand, ts_ = vor der Seitenwand
    sx = 1 if ek[1] == 'W' else -1; bx0 = 0 if ek[1] == 'W' else W; sy = -1 if ek[0] == 'N' else 1; by0 = D if ek[0] == 'N' else 0
    P = lambda u, v: (bx0 + sx * u, by0 + sy * v)
    aus = [P(ln, 0), P(ln, -t_)] + ([P(-ts_ + fa, -t_), P(-ts_, -t_ + fa)] if fa > 0 else [P(-ts_, -t_)]) + [P(-ts_, ls), P(0, ls)]   # Aussenkante inkl. Stirnseiten
    add('balkon', f'Eckbalkon {ek} Platte', mesh=prism(_ccw([P(0, c), P(c, 0)] + aus), zb - 18, zb), material='beton_hell')
    for si, (a, b) in enumerate(zip(aus[:-1], aus[1:]), 1):
        add('gelaender', f'Eckbalkon {ek} Handlauf {si}', mesh=prism(_strecke(a, b), zb + hg - 4, zb + hg), material='stahl')
        for k, zz in enumerate((0.15, 0.3, 0.45, 0.6, 0.75), 1): add('gelaender', f'Eckbalkon {ek} Stab {si}.{k}', mesh=prism(_strecke(a, b, 1), zb + hg * zz - 1, zb + hg * zz + 1), material='stahl')
    for k, (px_, py_) in enumerate(aus, 1): add('gelaender', f'Eckbalkon {ek} Pfosten {k}', box=box(px_ - 2, py_ - 2, zb, px_ + 2, py_ + 2, zb + hg), material='stahl')
for gi, G in enumerate(H.get('anbau_garagen', []), 1):   # Flachdach-Garage seitlich angebaut, Tor zur Strasse (Sued)
    s_ = G.get('seite', 'W'); gb = G.get('breite_cm', 300); gt = G.get('tiefe_cm', 600); gh = G.get('hoehe_cm', 250); gw = 24; _ng0 = len(parts)
    x0, x1 = (-gb, 0) if s_ == 'W' else (W, W + gb); y0, y1 = G.get('y0_cm', 0), G.get('y0_cm', 0) + gt
    for nm_, bx in (('aussen', (x0, y0, 0, x0 + gw, y1, gh) if s_ == 'W' else (x1 - gw, y0, 0, x1, y1, gh)), ('hinten', (x0, y1 - gw, 0, x1, y1, gh)) if G.get('tor_seite', 'S') == 'S' else ('vorne', (x0, y0, 0, x1, y0 + gw, gh))):   # 05.10. tor_seite N
        add('garage', f'Anbau-Garage {s_} Wand {nm_}', box=box(*bx), material='putz')
    if G.get('dach', 'balken') == 'balken':   # Bauplan Schnitt B-B: Dachaufbau Kunststoffwellplatten auf Balken
        for k in range(int((y1 - y0) // 70) + 1):
            yb = min(y1 - 8, y0 + k * 70); add('garage', f'Anbau-Garage {s_} Balken {k + 1}', box=box(x0 - 15, yb, gh, x1 + 5, yb + 8, gh + 16), material='holz_dunkel')
        add('garage', f'Anbau-Garage {s_} Pfette vorne', box=box(x0 - 15, y0 - 10, gh - 16, x1 + 5, y0, gh), material='holz_dunkel')
        add('garage', f'Anbau-Garage {s_} Wellplatten', box=box(x0 - 20, y0 - 15, gh + 16, x1 + 10, y1 + 10, gh + 18), material='glas')
    else: add('garage', f'Anbau-Garage {s_} Flachdach', box=box(x0 - 10, y0 - 10, gh, x1 + 10, y1 + 10, gh + 18), material='attika_blende')
    _tn = G.get('tor_seite', 'S') == 'N'; _ty = (y1 - 12, y1 - 8) if _tn else (y0 + 8, y0 + 12); _sy = (y1 - gw, y1) if _tn else (y0, y0 + gw)   # 05.10. Tor buendig zur Hangseite
    add('tor', f'Anbau-Garage {s_} Sektionaltor', box=box(x0 + 20, _ty[0], 0, x1 - 20, _ty[1], gh - 30), material='tor')
    for k_ in range(1, int((gh - 30) // 14)): add('tor', f'Anbau-Garage {s_} Tor-Lamelle {k_}', box=box(x0 + 20, _ty[1] - 1 if _tn else _ty[0] - 1, k_ * 14 - 1, x1 - 20, _ty[1] + 1 if _tn else _ty[0] + 1, k_ * 14 + 1), material='fuge')
    add('garage', f'Anbau-Garage {s_} Torsturz', box=box(x0, _sy[0], gh - 30, x1, _sy[1], gh), material='putz')
    if G.get('pflanzkasten') and G.get('dach', 'balken') != 'balken':   # 05.10. Tobi Foto: Holz-Pflanzkasten/Sichtschutz rundum auf dem Garagendach
        for nm_, bx_ in (('aussen', (x0 - 10, y0 - 10, x0 + 30, y1 + 10)), ('vorne', (x0 - 10, y0 - 10, x1, y0 + 30)), ('hinten', (x0 - 10, y1 - 30, x1, y1 + 10))):
            add('garage', f'Anbau-Garage {s_} Pflanzkasten {nm_}', box=box(bx_[0], bx_[1], gh + 18, bx_[2], bx_[3], gh + 18 + 110), material='holz')
    if G.get('bruestung') and G.get('dach', 'balken') != 'balken':   # 06.10. Abnahme: gegliederte Absturzsicherung statt geschlossenem Kasten (1,0-1,1 m, Fugen, Pfosten)
        BR = G['bruestung']; hb = BR.get('hoehe_cm', 105); mb = BR.get('material', 'holz_dunkel'); zb_ = gh + 18; nb = BR.get('bretter', 5); fu = BR.get('fuge_cm', 3)
        bh_ = (hb - 10 - (nb - 1) * fu) / nb
        kanten = [('aussen', (x0 - 4, y0, x0 + 4, y1), 'y'), ('vorne', (x0, y0 - 4, x1, y0 + 4), 'x'), ('hinten', (x0, y1 - 4, x1, y1 + 4), 'x')]
        for nm_, (ax0, ay0, ax1, ay1), rich in kanten:
            if BR.get('ohne') and nm_ in BR['ohne']: continue
            L_ = (ay1 - ay0) if rich == 'y' else (ax1 - ax0); n_p = max(1, int(L_ // 120))
            for k_ in range(n_p + 1):   # Pfosten 8 x 8 alle ~1,2 m
                t_ = k_ * L_ / n_p
                px_, py_ = (ax0 + 4, ay0 + t_) if rich == 'y' else (ax0 + t_, ay0 + 4)
                add('gelaender', f'Anbau-Garage {s_} Bruestung {nm_} Pfosten {k_ + 1}', box=box(px_ - 4, py_ - 4, zb_, px_ + 4, py_ + 4, zb_ + hb), material=mb)
            for j_ in range(nb):        # waagerechte Bretter mit Fuge
                z0_ = zb_ + 10 + j_ * (bh_ + fu)
                add('gelaender', f'Anbau-Garage {s_} Bruestung {nm_} Brett {j_ + 1}', box=box(ax0, ay0, z0_, ax1, ay1, z0_ + bh_), material=mb)
            add('gelaender', f'Anbau-Garage {s_} Bruestung {nm_} Handlauf', box=box(ax0 - 2, ay0 - 2, zb_ + hb, ax1 + 2, ay1 + 2, zb_ + hb + 4), material=mb)
            if BR.get('blumenkaesten'):
                ix0, iy0, ix1, iy1 = (ax0 + 6, ay0 + 20, ax0 + 30, ay1 - 20) if rich == 'y' else (ax0 + 20, (ay0 + 6) if nm_ == 'vorne' else (ay1 - 30), ax1 - 20, (ay0 + 30) if nm_ == 'vorne' else (ay1 - 6))
                add('detail', f'Anbau-Garage {s_} Blumenkasten {nm_}', box=box(ix0, iy0, zb_ + hb - 22, ix1, iy1, zb_ + hb), material=BR.get('kasten_material', 'holz_dunkel'))
                add('garten', f'Anbau-Garage {s_} Blumenkasten {nm_} Bepflanzung', box=box(ix0 + 3, iy0 + 3, zb_ + hb, ix1 - 3, iy1 - 3, zb_ + hb + 18), material=BR.get('pflanzen_material', 'hecke'))
    dz_ = round(G.get('boden_cm', gel_z((x0 + x1) / 2, y0)))   # Garage steht auf dem Gelaende (Bauplan: West-Garage ~1 m tiefer)
    if dz_:
        for q in parts[_ng0:]:
            if 'box' in q: q['box'][2] += dz_; q['box'][5] += dz_
# ---------- 9. Kameras / Licht ----------
hz = (z_floor(NF - 1) + GH + DK) / 2
# 2026-09-22 (Tobi: 'Klippe'): Kameras stehen INNERHALB der Hecke auf Augenhoehe (165 cm) - bisher standen sie ausserhalb, die 1,2-m-Hecke
# fuellte den Vordergrund als gruene Wand. Position aus dem Grundstueck (S/M/L), Brennweite 26 mm, damit das Haus trotz Naehe ganz drauf ist.
_cf = [max(gx0 + 90, -420), max(gy0 + 130, -1450), 165]
_KF = H.get('kamera_front') or {}   # 24.09.: Vorlage darf die Hero-Kamera setzen (Villa in der Landschaft)
add('kamera', 'Kamera Front (3/4 von Suedwest, im Grundstueck, Augenhoehe)', pos=_KF.get('pos', _cf), ziel=_KF.get('ziel', [W * 0.50, D * 0.25, hz - 40]), brennweite_mm=_KF.get('brennweite_mm', 26))
# Rueckkamera: von Nordost, ausser ein Erker sitzt auf der Westhaelfte - dann von Nordwest, damit der Erker im Bild ist
_erker_west = any(e.get('seite', 'N') == 'N' and e['pos_cm'] < W / 2 for e in H.get('erker', []))
if _erker_west: add('kamera', 'Kamera Rueck (3/4 von Nordwest, Erker-Seite, im Grundstueck)', pos=[max(gx0 + 90, -750), min(gy1 - 110, D + 1250), 165], ziel=[W * 0.5, D * 0.7, hz + 60], brennweite_mm=21)
else: add('kamera', 'Kamera Rueck (3/4 von Nordost, im Grundstueck)', pos=[min(gx1 - 90, W + 750), min(gy1 - 110, D + 1250), 165], ziel=[W * 0.5, D * 0.7, hz + 60], brennweite_mm=21)
for KX in H.get('kameras_extra', []): add('kamera', 'Kamera Detail ' + KX['name'], pos=KX['pos'], ziel=KX['ziel'], brennweite_mm=KX.get('brennweite_mm', 35))   # 27.09. Detail-Renders (z.B. Dachbalkon)
add('kamera', 'Kamera Ansicht Sued (orthografisch, Elevation)', pos=[W / 2, -3000, hz], ziel=[W / 2, 0, hz], ortho_cm=max(1400, int(W * 1.3)))
add('kamera', 'Kamera Ansicht Nord (orthografisch, Elevation)', pos=[W / 2, D + 3000, hz], ziel=[W / 2, D, hz], ortho_cm=max(1400, int(W * 1.3)))
add('licht', 'Sonne (Azimut 215, Hoehe 42)', azimut=215, hoehe=42, staerke=4.0)

if H.get('sockel_material'):   # 26.09.: z. B. 'sockelputz' - Sockel/Keller verputzt statt Steinoptik
    for q in parts:
        if q['kat'] == 'sockel' and q.get('material') == 'sockel': q['material'] = H['sockel_material']
if GEL:   # Kameras auf Augenhoehe ueber dem Gelaende, Terrasse als Podest bis aufs Gelaende
    for q in parts:
        if q['kat'] == 'kamera' and 'ortho_cm' not in q and 'pos' in q: q['pos'] = [q['pos'][0], q['pos'][1], q['pos'][2] + round(gel_z(q['pos'][0], q['pos'][1]))]
        if q['name'].startswith('Terrasse') and 'box' in q:
            b_ = q['box']; q['box'] = b_[:2] + [round(min(b_[2], min(gel_z(xx, yy) for xx in (b_[0], b_[3]) for yy in (b_[1], b_[4]))), 1)] + b_[3:]
meta = dict(H['meta']); meta.update({'gelaende': H.get('gelaende')} if H.get('gelaende') else {}); meta.update({'breite_cm': W, 'tiefe_cm': D, 'geschosse': NF, 'traufe_cm': ze,
        'first_cm': next((p['first_cm'] for p in parts if 'first_cm' in p), ze + roof.get('attika_cm', 0)),
        'dach': roof['typ'], 'materialien': MAT, 'anzahl_teile': len(parts), 'bloecke': sum(1 for f in range(NF) for sg in segs_of(f) if not sg.get('leer')) if BL else 1})
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bauteile_zusatz_module.py'), encoding='utf-8').read())   # 05.10. Loggien, Kellertore, Seitenfluegel, fassade_seiten
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bauteile_treppe_keller_garten.py'), encoding='utf-8').read())   # 05.10. Pflicht: Kellertreppe, DG-Treppe, Keller innen, Garten am Hang
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bauteile_giebelfenster_sattel.py'), encoding='utf-8').read())   # 08.10. Giebelfenster im Satteldach-Giebel (Haus 3)
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bauteile_ruecksprung.py'), encoding='utf-8').read())   # 08.10. Treppenhaus-Ruecksprung (Beethoven 1)
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bauteile_dachterrasse.py'), encoding='utf-8').read())   # 08.10. Dachterrasse (Einschnitt Strassenseite)
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bauteile_vorplatz.py'), encoding='utf-8').read())   # 08.10. Wintergarten/Buero-Vorbau, Vorplatz mit Stuetzmauer/Treppe/Stellplaetzen, Krueppelwalm-Giebelfenster
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bauteile_kapsel.py'), encoding='utf-8').read())   # 08.10. Kapselhaus-Huelle
json.dump({'meta': meta, 'teile': parts}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
from collections import Counter
c = Counter(p['kat'] for p in parts)
print(f"STUECKLISTE {len(parts)} Teile ->", OUT)
if UEBERSPRUNGEN: print('  !! uebersprungene Oeffnungen (keine Wand):', ', '.join(UEBERSPRUNGEN))
for k, v in c.items(): print(f"  {k:12s} {v}")
