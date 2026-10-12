# -*- coding: utf-8 -*-
# ANLAGE: mehrere Baukoerper (je eine haus.json -> bauplan_stueckliste.py) zu EINER Stueckliste zusammensetzen,
# jeder Baukoerper mit Drehung (0/90/180/270 Grad, gegen den Uhrzeigersinn) und Lage (x/y in cm, Lageplan aus Satellitenbild).
# Dazu Zusatzteile, die die App-Stueckliste nicht kennt: Balkonanlagen an jeder Seite (Platte, Glasbruestung, Handlauf,
# Stahlstuetzen, Pergola mit Glasdach) und Treppenhaus-Kerne. Alles nummeriert (Baukoerper k: K<k>T.., Zusatz: Z..).
# Aufruf: python anlage.py <anlage.json> <tools_dir> <out_stueckliste.json>
#   anlage.json = {"name":..., "kennung":..., "baukoerper":[{"haus": "haus_x.json", "drehung": 90, "x": 3000, "y": 1100}, ...],
#                  "balkonanlagen":[{"wand_x0":..,"wand_x1":..,"wand_y0":..,"wand_y1":..,"seite":"W","tiefe_cm":200,"geschosse":[0,1,2]}],
#                  "kerne":[{"x0":..,"y0":..,"x1":..,"y1":..,"ueber_attika_cm":70}]}
import sys, os, json, subprocess

CFG = json.load(open(sys.argv[1], encoding='utf-8')); TOOLS = sys.argv[2]; OUT = sys.argv[3]
HIER = os.path.dirname(os.path.abspath(sys.argv[1]))
OHNE = ('gelaende', 'grundstueck', 'garten', 'kamera', 'licht')
teile = []; z_top = 0; gh_dk = 315


def trafo(W, D, rot, X, Y):
    """lokale (x, y) -> Lageplan. rot gegen den Uhrzeigersinn; Ergebnis liegt im Rechteck ab (X, Y)."""
    if rot == 0: return lambda x, y: (X + x, Y + y)
    if rot == 90: return lambda x, y: (X + D - y, Y + x)
    if rot == 180: return lambda x, y: (X + W - x, Y + D - y)
    if rot == 270: return lambda x, y: (X + y, Y + W - x)
    raise ValueError(rot)


def tbox(f, b):
    p1, p2 = f(b[0], b[1]), f(b[3], b[4])
    return [min(p1[0], p2[0]), min(p1[1], p2[1]), b[2], max(p1[0], p2[0]), max(p1[1], p2[1]), b[5]]


for k, BK in enumerate(CFG['baukoerper'], 1):
    hp = os.path.join(HIER, BK['haus']); sp = hp.replace('haus_', 'stk_')
    r = subprocess.run([sys.executable, os.path.join(TOOLS, 'bauplan_stueckliste.py'), hp, sp], capture_output=True, text=True)
    print(f"Baukoerper {k}: {BK['haus']} ->", [l for l in r.stdout.splitlines() if 'STUECKLISTE' in l or '!!' in l] or r.stderr[-400:])
    S = json.load(open(sp, encoding='utf-8')); M = S['meta']
    f = trafo(M['breite_cm'], M['tiefe_cm'], BK.get('drehung', 0), BK['x'], BK['y'])
    gh_dk = M.get('geschosshoehe_cm', 290) + 25
    z_top = max(z_top, M.get('traufe_cm', 0))
    pre = f'K{k}'; ids = {p['id']: pre + p['id'] for p in S['teile']}
    for p in S['teile']:
        if p['kat'] in OHNE and (k > 1 or p['kat'] not in ('kamera', 'licht')): continue   # Kameras/Licht vom ersten Baukoerper; Gelaende/Garten je Haus passen nicht zur Anlage
        q = dict(p); q['id'] = ids[p['id']]; q['name'] = f"{BK.get('name', pre)} {p['name']}"
        for key in ('box', 'bbox'):
            if key in q: q[key] = tbox(f, q[key])
        if 'mesh' in q: q['mesh'] = {'verts': [list(f(v[0], v[1])) + [v[2]] for v in q['mesh']['verts']], 'faces': q['mesh']['faces']}
        for key in ('pos', 'ziel'):
            if isinstance(q.get(key), list) and len(q[key]) == 3: q[key] = list(f(q[key][0], q[key][1])) + [q[key][2]]
        if isinstance(q.get('ziel'), str) and q['ziel'] in ids: q['ziel'] = ids[q['ziel']]
        teile.append(q)

n = [0]


def z(kat, name, b, mat):
    n[0] += 1; teile.append({'id': f'Z{n[0]:03d}', 'kat': kat, 'name': name, 'box': [round(c, 1) for c in b], 'material': mat, 'quelle': 'Zusatzteil (Fotos + Satellitenbild)'})


def balkonanlage(i, A):
    """Vorgestellte Stahl-Balkonanlage vor einer Wand. seite = Richtung, in die der Balkon zeigt."""
    s = A['seite']; t = A.get('tiefe_cm', 200); hg = 105; fl = A.get('geschosse', [0, 1, 2])
    if s in ('N', 'S'):
        a, b = A['wand_x0'], A['wand_x1']; w = A['wand_y']; v = w + t if s == 'N' else w - t
        R = lambda u0, u1, q0, q1, z0, z1: [min(u0, u1), min(q0, q1), z0, max(u0, u1), max(q0, q1), z1]
    else:
        a, b = A['wand_y0'], A['wand_y1']; w = A['wand_x']; v = w + t if s == 'E' else w - t
        R = lambda u0, u1, q0, q1, z0, z1: [min(q0, q1), min(u0, u1), z0, max(q0, q1), max(u0, u1), z1]
    dv = 1 if v > w else -1; tag = f'Balkonanlage {i} ({s})'
    z_perg = max(fl) * gh_dk + gh_dk - 30      # Pergola knapp unter der Decke ueber dem obersten Balkon
    for g in fl:
        zb = g * gh_dk + (0 if g else 15)
        z('balkon', f'{tag} G{g} Platte', R(a, b, w, v, zb - 18, zb), 'beton_hell')
        z('gelaender', f'{tag} G{g} Glasbruestung vorne', R(a, b, v - 2 * dv, v, zb, zb + hg), 'glas')
        z('gelaender', f'{tag} G{g} Glasbruestung Seite 1', R(a, a + 2, w, v, zb, zb + hg), 'glas')
        z('gelaender', f'{tag} G{g} Glasbruestung Seite 2', R(b - 2, b, w, v, zb, zb + hg), 'glas')
        z('gelaender', f'{tag} G{g} Handlauf', R(a, b, v - 5 * dv, v + dv, zb + hg - 4, zb + hg), 'stahl')
        z('gelaender', f'{tag} G{g} Rahmen unten', R(a, b, v - 4 * dv, v, zb - 26, zb - 18), 'stahl')
    for u in (a, b - 14):
        z('gelaender', f'{tag} Stahlstuetze vorne u{round(u)}', R(u, u + 14, v - 14 * dv, v, -20, z_perg + 18), 'stahl')
    z('gelaender', f'{tag} Pergola Rahmen vorne', R(a, b, v - 14 * dv, v, z_perg, z_perg + 18), 'stahl')
    for u in (a, b - 14):
        z('gelaender', f'{tag} Pergola Rahmen Seite u{round(u)}', R(u, u + 14, w, v, z_perg, z_perg + 18), 'stahl')
    nl = max(2, round((b - a) / 120))
    for kk in range(1, nl):
        um = a + (b - a) * kk / nl
        z('gelaender', f'{tag} Pergola Lamelle {kk}', R(um - 5, um + 5, w, v, z_perg + 4, z_perg + 16), 'stahl')
    z('glas', f'{tag} Pergola Glasdach', R(a + 14, b - 14, w, v - 14 * dv, z_perg + 18, z_perg + 20), 'glas')


for i, A in enumerate(CFG.get('balkonanlagen', []), 1): balkonanlage(i, A)
for i, K in enumerate(CFG.get('kerne', []), 1):
    zt = z_top + 45 + K.get('ueber_attika_cm', 70)
    z('wand', f'Treppenhaus-Kern {i}', [K['x0'], K['y0'], -20, K['x1'], K['y1'], zt], 'putz')
    z('dach', f'Treppenhaus-Kern {i} Abdeckung', [K['x0'] - 4, K['y0'] - 4, zt, K['x1'] + 4, K['y1'] + 4, zt + 8], 'attika_blende')

xs, ys = [], []
for p in teile:
    if p['kat'] in OHNE: continue
    b = p.get('box') or p.get('bbox')
    if b: xs += [b[0], b[3]]; ys += [b[1], b[4]]
    if 'mesh' in p: xs += [v[0] for v in p['mesh']['verts']]; ys += [v[1] for v in p['mesh']['verts']]
dx, dy = -min(xs), -min(ys)
for p in teile:
    for key in ('box', 'bbox'):
        if key in p: p[key] = [p[key][0] + dx, p[key][1] + dy, p[key][2], p[key][3] + dx, p[key][4] + dy, p[key][5]]
    if 'mesh' in p: p['mesh']['verts'] = [[v[0] + dx, v[1] + dy, v[2]] for v in p['mesh']['verts']]
    for key in ('pos', 'ziel'):
        if isinstance(p.get(key), list) and len(p[key]) == 3: p[key] = [p[key][0] + dx, p[key][1] + dy, p[key][2]]
meta = {'name': CFG['name'], 'kennung': CFG['kennung'], 'breite_cm': round(max(xs) - min(xs)), 'tiefe_cm': round(max(ys) - min(ys)),
        'geschosse': CFG.get('geschosse', 3), 'traufe_cm': z_top, 'first_cm': z_top + 45, 'dach': 'flach', 'anzahl_teile': len(teile),
        'baukoerper': len(CFG['baukoerper']), 'lageplan_quelle': CFG.get('lageplan_quelle', '')}
json.dump({'meta': meta, 'teile': teile}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"ANLAGE {len(teile)} Teile ({len(CFG['baukoerper'])} Baukoerper, {n[0]} Zusatzteile) -> {meta['breite_cm']} x {meta['tiefe_cm']} cm")
