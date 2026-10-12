# bauteile_dachterrasse.py (08.10.2026, Tobi zu Beethovenstr. 1: "Dachterrasse fixen und Baustein machen", v2: "der Balkon ist zu gross")
# Laeuft per exec am Ende von bauplan_stueckliste.py (gleicher Namensraum: H, W, D, T, NF, GH, DK, roof, parts, add, box, z_floor, math).
# H['dachterrasse_vorn'] = dict(von_cm, bis_cm, tiefe_cm=150, glasdach=False, glas_lage='rechts', glas_breite_cm=300, tuer_b_cm=120)
# Einschnitt in die STRASSEN-Dachflaeche (Sued) eines Satteldachs mit First in x:
#   - Terrassen-Streifen (flach, tiefe_cm) mit Stahlgelaender an der Traufkante, niedrige Rueckwand unter der Schraege
#   - Zugang: ohne Glasdach = ganzer Einschnitt so tief, dass eine Tuer (2,15 m) passt;
#             mit Glasdach = nur der Glasraum (glas_breite_cm, Lage links/mitte/rechts) geht tief ins Dach, dort die Tuer ins DG (Foto Beethoven 1)
_DT = H.get('dachterrasse_vorn')
if _DT and roof.get('typ') == 'sattel' and roof.get('first_richtung', 'y') == 'x':
    _ng = math.tan(math.radians(roof.get('neigung_grad', 40))); _ov = roof.get('ueberstand_cm', 0); _ze = z_floor(NF - 1) + GH + DK
    _a, _b = max(T + 30, _DT['von_cm']), min(W - T - 30, _DT['bis_cm'])
    _td = min(D / 2 - 60, 230 / _ng + 40)                                    # Tiefe, bei der eine Tuer unter die Schraege passt
    _t1 = min(_td, max(110, _DT.get('tiefe_cm') or 150)) if _DT.get('glasdach') else _td
    _z = lambda y: _ze + _ng * y
    if _DT.get('glasdach'):
        _gb = min(_b - _a, _DT.get('glas_breite_cm', 300)); _gl = _DT.get('glas_lage', 'rechts')
        _g0 = {'links': _a, 'mitte': (_a + _b - _gb) / 2}.get(_gl, _b - _gb); _g1 = _g0 + _gb; _t2 = _td
    else:
        _g0 = _g1 = None; _t2 = _t1
    def _bb(q):
        if 'box' in q: return q['box']
        v = q['mesh']['verts']; return [min(p[0] for p in v), min(p[1] for p in v), min(p[2] for p in v), max(p[0] for p in v), max(p[1] for p in v), max(p[2] for p in v)]
    _cuts = [box(_a, -_ov - 40, _ze + 1, _b, _t1, _z(_t1) + 40)] + ([box(_g0, -_ov - 40, _ze + 1, _g1, _t2, _z(_t2) + 40)] if _g0 is not None else [])
    _n = 0
    for q in [q for q in parts if q['kat'] in ('dach', 'dachstuhl') and (q['name'].startswith('Satteldach Flaeche 1') or (q['name'].startswith('Sparren') and q['name'].endswith('-1')))]:
        b_ = _bb(q)
        for ci_, c_ in enumerate(_cuts):
            if b_[3] <= c_[0] or b_[0] >= c_[3] or b_[1] >= c_[4]: continue
            add('ausschnitt', f'Dachterrasse Einschnitt {ci_ + 1} in {q["name"][:30]}', ziel=q['id'], box=c_, oeffnung=None); _n += 1
    add('balkon', 'Dachterrasse Belag', box=box(_a, 0, _ze, _b, _t1, _ze + 3), material='beton_hell')
    # Rueckwaende: Streifen (niedrig, unter der Schraege) + ggf. Glasraum (hoch, mit Tuer)
    _seg = [(_a, _g0), (_g1, _b)] if _g0 is not None else [(_a, _b)]
    if _g0 is not None:
        for _k, (_x0, _x1) in enumerate(_seg, 1):
            if _x1 - _x0 > 5: add('wand', f'Dachterrasse Rueckwand {_k}', box=box(_x0, _t1, _ze, _x1, _t1 + 20, _z(_t1)), material='putz')
        add('balkon', 'Dachterrasse Glasraum Boden', box=box(_g0, _t1, _ze, _g1, _t2, _ze + 3), material='beton_hell')
    _ta, _tb_ = (_g0, _g1) if _g0 is not None else (_a, _b)
    add('wand', 'Dachterrasse Rueckwand Tuer', box=box(_ta, _t2, _ze, _tb_, _t2 + 20, _z(_t2)), material='putz'); _rw = parts[-1]
    _tb = _DT.get('tuer_b_cm', 120); _c = (_ta + _tb_) / 2
    add('ausschnitt', 'Dachterrasse Tuer', ziel=_rw['id'], box=box(_c - _tb / 2, _t2 - 10, _ze, _c + _tb / 2, _t2 + 30, _ze + 215), oeffnung=None)
    add('glas', 'Dachterrasse Tuer Glas', box=box(_c - _tb / 2 + 6, _t2 + 9, _ze + 6, _c + _tb / 2 - 6, _t2 + 11, _ze + 209), material='glas')
    for _nm, _bx in (('links', (_c - _tb / 2, _t2 + 4, _ze, _c - _tb / 2 + 7, _t2 + 16, _ze + 215)), ('rechts', (_c + _tb / 2 - 7, _t2 + 4, _ze, _c + _tb / 2, _t2 + 16, _ze + 215)),
                     ('oben', (_c - _tb / 2, _t2 + 4, _ze + 208, _c + _tb / 2, _t2 + 16, _ze + 215))):
        add('rahmen', f'Dachterrasse Tuerrahmen {_nm}', box=box(*_bx), material='rahmen')
    # Wangen (Dreiecke unter der Schraege): aussen am Streifen, am Glasraum die Seitenwaende bis zur Tuerwand
    def _wange(nm_, x0_, ya_, yb_):
        _V = [[_x, _y, _zz] for _x in (x0_, x0_ + 20) for (_y, _zz) in ((ya_, _ze), (yb_, _ze), (yb_, _z(yb_) + 12), (ya_, _z(ya_) + 12))]
        add('wand', f'Dachterrasse Wange {nm_}', mesh={'verts': _V, 'faces': [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]}, material='dach')
    _wange('West', _a - 20, -_ov, _t1); _wange('Ost', _b, -_ov, _t1)
    if _g0 is not None:
        if _g0 > _a + 5: _wange('Glasraum West', _g0 - 20, _t1, _t2)
        if _g1 < _b - 5: _wange('Glasraum Ost', _g1, _t1, _t2)
        _gz0, _gz1 = _ze + 245, min(_z(_t2) - 5, _ze + 290)   # Glasdach: vorn 2,45 m, hinten bis knapp unter die Schraege
        add('glas', 'Dachterrasse Glasdach', mesh={'verts': [[_g0, 0, _gz0], [_g1, 0, _gz0], [_g1, _t2, _gz1], [_g0, _t2, _gz1], [_g0, 0, _gz0 + 3], [_g1, 0, _gz0 + 3], [_g1, _t2, _gz1 + 3], [_g0, _t2, _gz1 + 3]],
                                                   'faces': [[3, 2, 1, 0], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]}, material='glas')
        for _x in (_g0, _g1 - 8):
            add('rahmen', f'Dachterrasse Glasraum Pfosten {round(_x)}', box=box(_x, 0, _ze, _x + 8, 8, _gz0 + 3), material='rahmen')
        add('rahmen', 'Dachterrasse Glasraum Traufe', box=box(_g0, -6, _gz0 - 10, _g1, 8, _gz0 + 3), material='rahmen')
    # Gelaender an der Traufkante (Stahl, 1,00 m) ueber die ganze Terrassenbreite
    _hg = 100; _y0 = 2
    add('gelaender', 'Dachterrasse Handlauf', box=box(_a, _y0, _ze + _hg - 4, _b, _y0 + 5, _ze + _hg), material='stahl')
    for _k, _zz in enumerate((0.3, 0.55, 0.8), 1):
        add('gelaender', f'Dachterrasse Querstab {_k}', box=box(_a, _y0 + 1, _ze + _hg * _zz - 1, _b, _y0 + 3, _ze + _hg * _zz + 1), material='stahl')
    _np = max(1, int((_b - _a) / 110))
    for _k in range(_np + 1):
        _x = _a + (_b - _a) * _k / _np; add('gelaender', f'Dachterrasse Pfosten {_k + 1}', box=box(_x - 2, _y0, _ze, _x + 2, _y0 + 5, _ze + _hg), material='stahl')
    print('DACHTERRASSE vorn', round(_b - _a), 'x', round(_t1), 'cm' + (f', Glasraum {round(_g1 - _g0)} x {round(_t2)} cm ({_DT.get("glas_lage", "rechts")})' if _g0 is not None else '') + f', Einschnitte {_n}')
