# bauteile_vorplatz.py (08.10.2026) - Bausteine fuer Haeuser mit Laden/Buero-Vorbau und Vorplatz (erstes Haus: Saarbruecker Str. 9, Nr. 15).
# Wird in bauplan_stueckliste.py per exec() eingebunden (nutzt H, W, D, T, add, box, prism, _strecke, parts, roof, ze).
# Alle Bausteine optional; lokale Achsen: x = Laenge (0 = Giebel West), y = Giebelbreite, z = 0 = OK FFB EG. Strasse liegt auf der West-Seite (x < 0).
#  H['giebelfenster_kw']: Fenster in den Krueppelwalm-Giebeln (Dachtyp 'krueppelwalm'): [dict(seite='W'|'E', pos_cm, b_cm, h_cm, unten_cm, rollladen=0..1)]
#  H['wintergarten']:     Glas-Vorbau (Buero) vor dem Giebel West: dict(breite_cm, tiefe_cm, fase_cm, hoehe_cm, dach_hoehe_wand_cm, pfosten_cm, band='blende')
#  H['vorplatz']:         Terrasse auf Hausniveau + Stuetzmauer + Treppe + Gelaender + Stellplaetze auf Strassenniveau:
#                         dict(tiefe_cm (Hausfront bis Mauer), y0_cm, y1_cm, strasse_z_cm, mauer_x_cm, parken_tiefe_cm, stellplaetze=[y_mitte...], treppe_y_cm, treppe_b_cm, lampen=n, kuebel=n)
import math as _m
_WEISS = 'kragplatte'
# ---------- Giebelfenster im Krueppelwalm-Giebel ----------
for _gi, _G in enumerate(H.get('giebelfenster_kw', []), 1):
    _w = _G.get('seite', 'W') == 'W'; _x0, _x1 = (0, T) if _w else (W - T, W)
    _y0, _y1 = _G['pos_cm'] - _G['b_cm'] / 2, _G['pos_cm'] + _G['b_cm'] / 2; _z0 = _G['unten_cm']; _z1 = _z0 + _G['h_cm']
    for _q in [q for q in parts if q['kat'] == 'wand' and q['name'] == ('Giebel West (bis Walmansatz)' if _w else 'Giebel Ost (bis Walmansatz)')]:
        add('ausschnitt', f'Giebelfenster KW {_gi} in {_q["name"]}', ziel=_q['id'], box=box(_x0 - 10, _y0, _z0, _x1 + 10, _y1, _z1), oeffnung=None)
    _xa, _xb = (_x0 + 6, _x0 + 12) if _w else (_x1 - 12, _x1 - 6)
    add('glas', f'Giebelfenster KW {_gi} Glas', box=box(_xa + 2, _y0 + 6, _z0 + 6, _xb - 2, _y1 - 6, _z1 - 6), material='glas')
    for _nm, (_ya, _yb, _za, _zb) in (('links', (_y0, _y0 + 6, _z0, _z1)), ('rechts', (_y1 - 6, _y1, _z0, _z1)), ('unten', (_y0, _y1, _z0, _z0 + 6)), ('oben', (_y0, _y1, _z1 - 6, _z1)), ('Mitte', (_G['pos_cm'] - 3, _G['pos_cm'] + 3, _z0, _z1))):
        add('rahmen', f'Giebelfenster KW {_gi} Rahmen {_nm}', box=box(_xa, _ya, _za, _xb, _yb, _zb), material=_WEISS)
    _rl = _G.get('rollladen', 0)
    if _rl:   # Rollladenpanzer (weiss), Anteil geschlossen
        _xr = (_x0 - 4, _x0) if _w else (_x1, _x1 + 4)
        add('rahmen', f'Giebelfenster KW {_gi} Rollladen', box=box(_xr[0], _y0, _z1 - (_z1 - _z0) * _rl, _xr[1], _y1, _z1), material=_WEISS)
    add('rahmen', f'Giebelfenster KW {_gi} Fensterbank', box=box((_x0 - 6) if _w else (_x1 - 2), _y0 - 4, _z0 - 4, (_x0 + 2) if _w else (_x1 + 6), _y1 + 4, _z0), material=_WEISS)
# ---------- Wintergarten / Buero-Vorbau (Glas, Polygon mit Fasen) ----------
_WG = H.get('wintergarten')
if _WG:
    _B, _TT, _F = _WG['breite_cm'], _WG['tiefe_cm'], _WG.get('fase_cm', 140); _HW = _WG.get('hoehe_cm', 265); _HD = _WG.get('dach_hoehe_wand_cm', 300)
    _yc = D / 2; _ya, _yb = _yc - _B / 2, _yc + _B / 2
    _P = [(0, _ya), (-(_TT - _F), _ya), (-_TT, _ya + _F), (-_TT, _yb - _F), (-(_TT - _F), _yb), (0, _yb)]   # Grundriss (Front = West)
    add('decke', 'Wintergarten Bodenplatte', mesh=prism(_P, -40, 0), material='beton_hell')
    _br = 50; _pf = _WG.get('pfosten_cm', 100)
    for _k in range(len(_P) - 1):
        _a, _b = _P[_k], _P[_k + 1]; _L = _m.hypot(_b[0] - _a[0], _b[1] - _a[1])
        add('wand', f'Wintergarten Bruestung {_k + 1}', mesh=prism(_strecke(_a, _b, 4), 0, _br), material=_WEISS)
        add('glas', f'Wintergarten Glas {_k + 1}', mesh=prism(_strecke(_a, _b, 1.2), _br, _HW - 18), material='glas')
        add('rahmen', f'Wintergarten Band {_k + 1}', mesh=prism(_strecke(_a, _b, 5), _HW - 38, _HW - 18), material=_WG.get('band', 'blende'))   # neutrales Band (keine Werbung/Marke)
        add('rahmen', f'Wintergarten Rahmen oben {_k + 1}', mesh=prism(_strecke(_a, _b, 6), _HW - 18, _HW), material=_WEISS)
        _n = max(1, int(round(_L / _pf)))
        for _i in range(_n + 1):
            _t = _i / _n; _px, _py = _a[0] + (_b[0] - _a[0]) * _t, _a[1] + (_b[1] - _a[1]) * _t
            add('rahmen', f'Wintergarten Pfosten {_k + 1}.{_i}', box=box(_px - 5, _py - 5, 0, _px + 5, _py + 5, _HW), material=_WEISS)
    # Glastuer mittig in der Front (Rahmen etwas breiter)
    _tm = _yc
    for _dy in (-55, 55): add('rahmen', f'Wintergarten Tuer Pfosten {_dy}', box=box(-_TT - 6, _tm + _dy - 4, 0, -_TT + 6, _tm + _dy + 4, 225), material=_WEISS)
    add('rahmen', 'Wintergarten Tuer Kaempfer', box=box(-_TT - 6, _tm - 55, 221, -_TT + 6, _tm + 55, 229), material=_WEISS)
    add('rahmen', 'Wintergarten Tuer Griff', box=box(-_TT - 10, _tm + 35, 95, -_TT - 6, _tm + 38, 125), material='stahl')
    # Glasdach: Polygon-Dach, aussen auf _HW, an der Hauswand auf _HD (leicht geneigt), weisse Sprossen strahlenfoermig
    _top = [(x, y) for x, y in _P]
    _V = [[x, y, (_HD if x > -1 else _HW + 2)] for x, y in _top]
    _hub = [0, _yc, _HD + 15]
    _fc = [[len(_V)] + [k, k + 1][::-1] for k in range(len(_V) - 1)]
    add('glas', 'Wintergarten Glasdach', mesh={'verts': _V + [_hub], 'faces': [[k + 1, k, len(_V)] for k in range(len(_V) - 1)]}, material='glas')
    for _k, (x, y) in enumerate(_top):
        if x > -1: continue
        _dx, _dy = _hub[0] - x, _hub[1] - y; _L = _m.hypot(_dx, _dy) or 1; _nx, _ny = -_dy / _L * 4, _dx / _L * 4
        add('rahmen', f'Wintergarten Dachsprosse {_k}', mesh={'verts': [[x + _nx, y + _ny, _HW + 3], [x - _nx, y - _ny, _HW + 3], [_hub[0] - _nx, _hub[1] - _ny, _HD + 18], [_hub[0] + _nx, _hub[1] + _ny, _HD + 18],
                                                                       [x + _nx, y + _ny, _HW + 9], [x - _nx, y - _ny, _HW + 9], [_hub[0] - _nx, _hub[1] - _ny, _HD + 24], [_hub[0] + _nx, _hub[1] + _ny, _HD + 24]],
                                                             'faces': [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]}, material=_WEISS)
    add('rahmen', 'Wintergarten Wandanschluss', box=box(-12, _ya, _HD, 0, _yb, _HD + 20), material=_WEISS)
    print('WINTERGARTEN', _B, 'x', _TT, 'cm, Hoehe', _HW, '/', _HD)
# ---------- Vorplatz: Terrasse, Stuetzmauer, Treppe, Gelaender, Stellplaetze ----------
_VP = H.get('vorplatz')
if _VP:
    _zt = _VP.get('terrasse_z_cm', -15); _zs = _VP['strasse_z_cm']; _xm = -_VP['tiefe_cm']; _y0, _y1 = _VP['y0_cm'], _VP['y1_cm']
    _dm = 30; _xp = _xm - _VP.get('parken_tiefe_cm', 560)
    # Terrasse: Unterbau bis ins Gelaende + Platten/Kies
    add('grundstueck', 'Terrasse Unterbau', box=box(_xm, _y0, _zs - 40, 0, _y1, _zt - 6), material='sockel')
    add('grundstueck', 'Terrasse Kies', box=box(_xm + _dm, _y0, _zt - 6, -1, _y1, _zt), material=_VP.get('belag', 'dach_flach'))
    add('grundstueck', 'Terrasse Plattenweg zur Tuer', box=box(_xm + _dm, D / 2 - 90, _zt - 5, -(H.get('wintergarten') or {}).get('tiefe_cm', 0), D / 2 + 90, _zt + 1), material='beton_hell')
    # Stuetzmauer (Sichtbeton, Elemente 1,5 m) bis 10 cm ueber Terrasse
    _n = int((_y1 - _y0) / 150) + 1
    for _i in range(_n):
        _a, _b = _y0 + _i * 150, min(_y1, _y0 + (_i + 1) * 150)
        if _b - _a < 5: continue
        if _VP.get('treppe_y_cm') is not None and _a < _VP['treppe_y_cm'] + _VP.get('treppe_b_cm', 180) / 2 and _b > _VP['treppe_y_cm'] - _VP.get('treppe_b_cm', 180) / 2: continue
        add('grundstueck', f'Stuetzmauer Element {_i + 1}', box=box(_xm, _a + 1, _zs - 30, _xm + _dm, _b - 1, _zt + 10), material='beton_hell')
    # Gelaender (Edelstahl) auf der Mauerkrone
    _gl = [(_y0, (_VP['treppe_y_cm'] - _VP.get('treppe_b_cm', 180) / 2) if _VP.get('treppe_y_cm') is not None else _y1)]
    if _VP.get('treppe_y_cm') is not None: _gl.append((_VP['treppe_y_cm'] + _VP.get('treppe_b_cm', 180) / 2, _y1))
    for _j, (_a, _b) in enumerate(_gl, 1):
        if _b - _a < 20: continue
        for _zz in (_zt + 105, _zt + 60): add('gelaender', f'Gelaender Mauer {_j} Holm {_zz - _zt}', box=box(_xm + 12, _a, _zz - 3, _xm + 17, _b, _zz), material='stahl')
        for _k in range(int((_b - _a) / 130) + 1): add('gelaender', f'Gelaender Mauer {_j} Pfosten {_k + 1}', box=box(_xm + 12, _a + _k * 130, _zt, _xm + 17, _a + _k * 130 + 5, _zt + 105), material='stahl')
    # Treppe von der Strasse hoch (Stufen 17/30, Wangen aus Beton, Handlauf beidseitig)
    if _VP.get('treppe_y_cm') is not None:
        _ty, _tb = _VP['treppe_y_cm'], _VP.get('treppe_b_cm', 180); _h = _zt - _zs; _ns = max(3, int(round(_h / 17))); _r = _h / _ns; _a30 = 30
        for _s in range(_ns):
            _xs0 = _xm - (_ns - _s) * _a30 + _dm
            add('grundstueck', f'Aussentreppe Weg Stufe {_s + 1}', box=box(_xs0, _ty - _tb / 2, _zs - 20, _xs0 + _a30 + 2, _ty + _tb / 2, _zs + (_s + 1) * _r), material='beton_hell')
        for _sd in (-1, 1):
            _yy = _ty + _sd * (_tb / 2 + 2)
            _x0h, _x1h = _xm - _ns * _a30 + _dm, _xm + _dm + 20
            _V = [[_x0h, _yy - 2.5, _zs + 95], [_x1h, _yy - 2.5, _zt + 95], [_x1h, _yy + 2.5, _zt + 95], [_x0h, _yy + 2.5, _zs + 95]]
            _V += [[v[0], v[1], v[2] + 5] for v in _V]
            add('gelaender', f'Aussentreppe Handlauf {"links" if _sd < 0 else "rechts"}', mesh={'verts': _V, 'faces': [[0, 1, 2, 3][::-1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]}, material='stahl')
            for _k in range(4):
                _t = _k / 3; _xx = _x0h + (_x1h - _x0h) * _t; _zz = _zs + (_zt - _zs) * _t
                add('gelaender', f'Aussentreppe Handlauf {_sd} Pfosten {_k + 1}', box=box(_xx - 2.5, _yy - 2.5, _zz, _xx + 2.5, _yy + 2.5, _zz + 95), material='stahl')
    # Stellplaetze auf Strassenniveau (Pflaster + weisse Markierung)
    add('grundstueck', 'Einfahrt Stellplatzflaeche Pflaster', box=box(_xp, _y0, _zs - 8, _xm, _y1, _zs), material='beton_hell')
    for _i, _yc2 in enumerate(_VP.get('stellplaetze', []), 1):
        for _dy in (-125, 125): add('garten', f'Stellplatz {_i} Markierung {_dy}', box=box(_xp + 40, _yc2 + _dy - 6, _zs, _xm - 20, _yc2 + _dy + 6, _zs + 1), material=_WEISS)
    # Kuebel mit Strauch (Terrasse) + Aussenleuchten
    for _i in range(_VP.get('kuebel', 0)):
        _yk = _y0 + 100 + _i * (_y1 - _y0 - 200) / max(1, _VP.get('kuebel', 1) - 1)
        if abs(_yk - D / 2) < 120: continue
        add('garten', f'Pflanzkuebel {_i + 1}', box=box(_xm + 70, _yk - 30, _zt, _xm + 130, _yk + 30, _zt + 60), material='stahl')
        add('garten', f'Pflanzkuebel {_i + 1} Strauch', mesh=prism([(_xm + 60 + 40 * _m.cos(a / 4 * _m.pi), _yk + 40 * _m.sin(a / 4 * _m.pi)) for a in range(8)], _zt + 60, _zt + 120), material='hecke')
    for _i in range(_VP.get('lampen', 0)):
        _yl = _y0 + 150 + _i * (_y1 - _y0 - 300) / max(1, _VP.get('lampen', 1) - 1)
        add('garten', f'Aussenleuchte {_i + 1} Mast', box=box(_xm + 45, _yl - 4, _zt, _xm + 53, _yl + 4, _zt + 140), material='stahl')
        add('garten', f'Aussenleuchte {_i + 1} Schirm', mesh=prism([(_xm + 49 + 22 * _m.cos(a / 4 * _m.pi), _yl + 22 * _m.sin(a / 4 * _m.pi)) for a in range(8)], _zt + 140, _zt + 175), material=_WEISS)
    print('VORPLATZ Terrasse', _zt, 'cm, Strasse', _zs, 'cm, Mauer bei x', _xm, ', Stellplaetze', len(_VP.get('stellplaetze', [])))
    # 08.10. Abnahme Blender Saarbr9: Standard-Garten geht von Strasse im Sueden aus -> beim Vorplatz (Strasse vor dem Vorplatz) anpassen
    _px0, _px1 = _xp - 5, _xm + 5
    for _p in parts:
        if _p['name'] == 'Rasen (Hang)' and 'mesh' in _p:   # Rasen unter Stellplaetzen/Terrasse absenken, sonst deckt er das Pflaster zu
            _V = _p['mesh']['verts']; _gx = sorted(set(v[0] for v in _V)); _gy = sorted(set(v[1] for v in _V))
            if len(_V) == len(_gx) * len(_gy):   # regelmaessiges Raster (x laeuft schnell) -> Bruchkanten an Stellplatz/Mauer einfuegen
                _Z = {(v[0], v[1]): v[2] for v in _V}
                def _zi(x, y):
                    import bisect
                    i = min(max(bisect.bisect_right(_gx, x) - 1, 0), len(_gx) - 2); j = min(max(bisect.bisect_right(_gy, y) - 1, 0), len(_gy) - 2)
                    tx = (x - _gx[i]) / (_gx[i + 1] - _gx[i]); ty = (y - _gy[j]) / (_gy[j + 1] - _gy[j])
                    return (_Z[(_gx[i], _gy[j])] * (1 - tx) + _Z[(_gx[i + 1], _gy[j])] * tx) * (1 - ty) + (_Z[(_gx[i], _gy[j + 1])] * (1 - tx) + _Z[(_gx[i + 1], _gy[j + 1])] * tx) * ty
                _nx = sorted(set(_gx) | {_xp - 150, _xp - 10, _xm - 15, _xm + 15, -5})
                _ny = sorted(set(_gy) | {_y0 - 150, _y0 - 20, _y0, _y1, _y1 + 20, _y1 + 150})
                _NV = []
                for _yy in _ny:
                    for _xx in _nx:
                        _z = _zi(_xx, _yy)
                        if _y0 - 20 <= _yy <= _y1 + 20:
                            if _xp - 10 <= _xx <= _xm - 15: _z = min(_z, _zs - 12)
                            elif _xm + 15 <= _xx <= -5: _z = min(_z, _zt - 10)
                        _NV.append([_xx, _yy, round(_z, 1)])
                _n_ = len(_nx)
                _p['mesh'] = {'verts': _NV, 'faces': [[j * _n_ + i, j * _n_ + i + 1, (j + 1) * _n_ + i + 1, (j + 1) * _n_ + i] for j in range(len(_ny) - 1) for i in range(_n_ - 1)]}
        elif _p['name'] == 'Weg zur Haustuer' and 'box' in _p:   # Weg von der Aussentreppe (Terrasse) zur Haustuer statt zur Suedstrasse
            _b = _p['box']; _yt = min(_VP.get('treppe_y_cm', -330), -200); _p['box'] = box(-1, _yt + 30, -2, _b[3], _yt + 170, 0.5)
            add('gelaende', 'Weg zur Haustuer Stich', box=box(_b[0], _yt + 170, -2, _b[3], 0, 0.5), material='beton_hell')
    parts[:] = [_p for _p in parts if not (_p['kat'] in ('gelaende', 'garten') and _p['name'] in ('Strasse', 'Gehweg', 'Hecke West'))]
    print('VORPLATZ Garten angepasst: Rasen unter Pflaster/Terrasse abgesenkt, Weg Treppe->Haustuer, Suedstrasse/Gehweg/Hecke West entfernt')
