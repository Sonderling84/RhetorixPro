# bauteile_kapsel.py (08.10.2026) - Kapselhaus / Modulhaus: abgerundete Alu-Huelle (Rundrahmen in der Ansicht, entlang der Tiefe extrudiert)
# um den Hauskoerper, weisse Laibung innen, Vorsprung (Lippe) vorn und hinten. Wird am Ende von bauplan_stueckliste.py per exec ausgefuehrt.
# H['kapsel'] = dict(radius_cm=75, dicke_cm=24, lippe_cm=14, boden_luft_cm=12, segmente=10)
_KP = H.get('kapsel')
if _KP:
    import math as _mk
    _HK = ('wand', 'dach', 'decke', 'sockel', 'rahmen', 'glas')
    _bx = [p['box'] for p in parts if p['kat'] in _HK and 'box' in p]
    _x0, _x1 = min(b[0] for b in _bx) - 1, max(b[3] for b in _bx) + 1
    _y0, _y1 = min(b[1] for b in _bx), max(b[4] for b in _bx)
    _z0, _z1 = min(b[2] for b in _bx) - 1, max(b[5] for b in _bx) + 1
    _d, _R, _lp, _ns = _KP.get('dicke_cm', 24), _KP.get('radius_cm', 75), _KP.get('lippe_cm', 14), _KP.get('segmente', 10)
    def _rr(x0, z0, x1, z1, r):   # abgerundetes Rechteck in x/z, gegen den Uhrzeigersinn, gleiche Punktzahl fuer innen/aussen
        r = max(0.5, min(r, (x1 - x0) / 2 - 1, (z1 - z0) / 2 - 1)); pts = []
        for cx, cz, a0 in ((x1 - r, z0 + r, -90), (x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180)):
            for k in range(_ns + 1):
                a = _mk.radians(a0 + 90 * k / _ns); pts.append((cx + r * _mk.cos(a), cz + r * _mk.sin(a)))
        return pts
    _ai = _rr(_x0, _z0, _x1, _z1, max(4, _R - _d)); _ao = _rr(_x0 - _d, _z0 - _d, _x1 + _d, _z1 + _d, _R)
    _ya, _yb = _y0 - _lp, _y1 + _lp; _n = len(_ai)
    V = [(x, _ya, z) for x, z in _ao] + [(x, _yb, z) for x, z in _ao] + [(x, _ya, z) for x, z in _ai] + [(x, _yb, z) for x, z in _ai]
    OA, OB, IA, IB = 0, _n, 2 * _n, 3 * _n; Fa, Fi = [], []
    for i in range(_n):
        j = (i + 1) % _n
        Fa.append([OA + i, OA + j, OB + j, OB + i])           # Aussenhaut
        Fa.append([OA + j, OA + i, IA + i, IA + j])           # Stirnring vorn
        Fa.append([OB + i, OB + j, IB + j, IB + i])           # Stirnring hinten
        Fi.append([IA + i, IB + i, IB + j, IA + j])           # Laibung innen
    add('detail', 'Kapsel Huelle Alu', mesh={'verts': [list(v) for v in V], 'faces': Fa}, material='kapsel_alu')
    add('detail', 'Kapsel Laibung innen', mesh={'verts': [list(v) for v in V], 'faces': Fi}, material='kapsel_innen')
    # Lichtfuge unten + Stellfuesse (Huelle schwebt ueber dem Boden)
    _zb = _z0 - _d
    for _xf in (_x0 + 60, (_x0 + _x1) / 2, _x1 - 60):
        for _yf in (_y0 + 40, _y1 - 40):
            add('detail', 'Kapsel Stellfuss', box=box(_xf - 12, _yf - 12, _zb - _KP.get('boden_luft_cm', 12), _xf + 12, _yf + 12, _zb), material='stahl')
    print('KAPSEL Huelle', round(_x1 - _x0 + 2 * _d), 'x', round(_yb - _ya), 'x', round(_z1 - _z0 + 2 * _d), 'cm, Radius', _R, ', Lippe', _lp)
