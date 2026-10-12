# -*- coding: utf-8 -*-
# Fuegt zwei Stuecklisten (Baukoerper A + B) zu EINER Stueckliste zusammen und ergaenzt Zusatzteile,
# die bauplan_stueckliste.py nicht kennt: Stahl-Balkonanlage (Stuetzen + Pergola mit Glasdach) und
# Treppenhaus-Kerne. Alles bleibt nummeriert (A: T.., B: BT.., Zusatz: Z..) und in cm wie die App-Stueckliste.
# Aufruf: python zusammenfuegen.py <stk_A.json> <stk_B.json> <out.json>
import sys, json

SA, SB, OUT = sys.argv[1:4]
A = json.load(open(SA, encoding='utf-8')); B = json.load(open(SB, encoding='utf-8'))
WB, DB = B['meta']['breite_cm'], B['meta']['tiefe_cm']
OX, OY = 0, A['meta']['tiefe_cm'] + 1500          # Hofflugel 15 m hinter dem Strassenhaus (Parkplatz dazwischen) - INFERIERT
OHNE = ('gelaende', 'grundstueck', 'garten', 'kamera', 'licht')


def dreh_box(b):   # 180 Grad um die Mitte von B, dann verschieben
    return [WB - b[3] + OX, DB - b[4] + OY, b[2], WB - b[0] + OX, DB - b[1] + OY, b[5]]


def dreh_v(v): return [WB - v[0] + OX, DB - v[1] + OY, v[2]]


teile = list(A['teile'])
idmap = {p['id']: 'B' + p['id'] for p in B['teile']}
for p in B['teile']:
    if p['kat'] in OHNE: continue
    q = dict(p); q['id'] = idmap[p['id']]; q['name'] = 'Hofflugel ' + p['name']
    for k in ('box', 'bbox'):
        if k in q: q[k] = dreh_box(q[k])
    if 'mesh' in q: q['mesh'] = {'verts': [dreh_v(v) for v in q['mesh']['verts']], 'faces': [list(reversed(f)) for f in q['mesh']['faces']]}
    if q.get('ziel') in idmap: q['ziel'] = idmap[q['ziel']]
    teile.append(q)

# ---------- Zusatzteile ----------
GH, DK = A['meta'].get('geschosshoehe_cm', 290), 25
Z_OK = 3 * (GH + DK)                 # Oberkante oberste Decke
Z_PERG = Z_OK + GH - 10              # Pergola ueber dem obersten Balkon
n = [0]


def z(kat, name, box, mat):
    n[0] += 1; teile.append({'id': f'Z{n[0]:02d}', 'kat': kat, 'name': name, 'box': [round(c, 1) for c in box], 'material': mat, 'quelle': 'Zusatzteil Fotos B268'})


def balkonanlage(tag, x0, x1, y0, y1):
    """Vorgestellte Stahl-Balkonanlage: 4 Stuetzen, Pergola-Rahmen, 3 Lamellen, Glasdach. y0 = Wand, y1 = vorne."""
    for xs in (x0, x1 - 14):
        for ys in (y0 if y1 > y0 else y0 - 14, y1 - 14 if y1 > y0 else y1):
            z('gelaender', f'{tag} Stahlstuetze x{round(xs)}', [xs, ys, -20, xs + 14, ys + 14, Z_PERG + 12], 'stahl')
    ya, yb = min(y0, y1), max(y0, y1)
    z('gelaender', f'{tag} Pergola Rahmen vorne', [x0, (yb - 14 if y1 > y0 else ya), Z_PERG, x1, (yb if y1 > y0 else ya + 14), Z_PERG + 18], 'stahl')
    for xs in (x0, x1 - 14):
        z('gelaender', f'{tag} Pergola Rahmen Seite x{round(xs)}', [xs, ya, Z_PERG, xs + 14, yb, Z_PERG + 18], 'stahl')
    for k in (1, 2, 3):
        xm = x0 + (x1 - x0) * k / 4
        z('gelaender', f'{tag} Pergola Lamelle {k}', [xm - 5, ya, Z_PERG + 4, xm + 5, yb, Z_PERG + 16], 'stahl')
    z('glas', f'{tag} Pergola Glasdach', [x0 + 14, ya, Z_PERG + 18, x1 - 14, yb, Z_PERG + 20], 'glas')


DA = A['meta']['tiefe_cm']
for bal in [p for p in A['teile'] if p['kat'] == 'balkon']:
    pass
balkonanlage('Strassenhaus Balkonanlage NO', 1560, 1860, DA, DA + 190)
for a, b in ((420, 900), (950, 1430), (1480, 1960)):   # B-Balkone (lokal Nordseite y = DB..DB+200) -> gedreht zum Parkplatz
    x0, x1 = WB - b + OX, WB - a + OX
    balkonanlage(f'Hofflugel Balkonanlage x{round(x0)}', x0, x1, OY, OY - 200)
for nm, (lx0, lx1) in (('West', (-350, 0)), ('Ost', (WB, WB + 350))):   # Treppenhaus-Kerne an den Enden des Hofflugels, hoeher als die Attika
    bb = dreh_box([lx0, 300, -20, lx1, 800, Z_OK + 45 + 70])
    z('wand', f'Hofflugel Treppenhaus-Kern {nm}', bb, 'putz')
    z('dach', f'Hofflugel Treppenhaus-Kern {nm} Abdeckung', [bb[0] - 4, bb[1] - 4, bb[5], bb[3] + 4, bb[4] + 4, bb[5] + 8], 'attika_blende')

# ---------- alles in den positiven Bereich schieben (Kameras/Ansichten rechnen ab 0/0) ----------
xs, ys = [], []
for p in teile:
    if p['kat'] in OHNE: continue
    for b in [p.get('box') or p.get('bbox')] if (p.get('box') or p.get('bbox')) else []:
        xs += [b[0], b[3]]; ys += [b[1], b[4]]
    if 'mesh' in p:
        xs += [v[0] for v in p['mesh']['verts']]; ys += [v[1] for v in p['mesh']['verts']]
dx, dy = -min(xs), -min(ys)
for p in teile:
    for k in ('box', 'bbox'):
        if k in p: p[k] = [p[k][0] + dx, p[k][1] + dy, p[k][2], p[k][3] + dx, p[k][4] + dy, p[k][5]]
    if 'mesh' in p: p['mesh']['verts'] = [[v[0] + dx, v[1] + dy, v[2]] for v in p['mesh']['verts']]
    for k in ('pos', 'ziel'):
        if isinstance(p.get(k), list) and len(p[k]) == 3: p[k] = [p[k][0] + dx, p[k][1] + dy, p[k][2]]
meta = dict(A['meta']); meta.update(name='B268 Nr. 9, Riegelsberg - Wohnanlage (Strassenhaus + Hofflugel)', kennung='b268',
                                    breite_cm=round(max(xs) - min(xs)), tiefe_cm=round(max(ys) - min(ys)), anzahl_teile=len(teile),
                                    baukoerper=2, versatz_hofflugel_cm=[OX + dx, OY + dy])
json.dump({'meta': meta, 'teile': teile}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"ZUSAMMEN {len(teile)} Teile (A {len(A['teile'])}, B {len([p for p in B['teile'] if p['kat'] not in OHNE])}, Zusatz {n[0]}) "
      f"-> {meta['breite_cm']} x {meta['tiefe_cm']} cm")
