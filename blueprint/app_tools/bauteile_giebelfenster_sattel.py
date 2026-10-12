# bauteile_giebelfenster_sattel.py (08.10.2026, Haus 3 B268: Giebel zur Strasse mit 2 Fenstern im Dachgeschoss)
# Laeuft per exec am Ende von bauplan_stueckliste.py. Satteldach mit First in y (Giebel Sued = 'Satteldach Giebel Anfang', Nord = '... Ende').
# H['giebelfenster_sattel'] = [dict(seite='S'|'N', pos_cm (x), b_cm, h_cm, unten_cm (absolute Hoehe), rollladen=0..1)]
_GS = H.get('giebelfenster_sattel') or []
if _GS and roof.get('typ') == 'sattel' and roof.get('first_richtung', 'y') == 'y':
    for _gi, _G in enumerate(_GS, 1):
        _s = _G.get('seite', 'S'); _nm = 'Satteldach Giebel Anfang' if _s == 'S' else 'Satteldach Giebel Ende'
        _gw = next((q for q in parts if q['kat'] == 'wand' and q['name'] == _nm), None)
        if not _gw: print('  !! Giebelfenster ohne Giebelwand', _nm); continue
        _x0, _x1 = _G['pos_cm'] - _G['b_cm'] / 2, _G['pos_cm'] + _G['b_cm'] / 2; _z0 = _G['unten_cm']; _z1 = _z0 + _G['h_cm']
        _ya, _yb = (0, T) if _s == 'S' else (D - T, D)
        add('ausschnitt', f'Giebelfenster Sattel {_gi}', ziel=_gw['id'], box=box(_x0, _ya - 10, _z0, _x1, _yb + 10, _z1), oeffnung=None)
        _gy = (_ya + 16, _ya + 18) if _s == 'S' else (_yb - 18, _yb - 16); _ry = (_ya + 12, _ya + 22) if _s == 'S' else (_yb - 22, _yb - 12)
        add('glas', f'Giebelfenster Sattel {_gi} Glas', box=box(_x0 + 7, _gy[0], _z0 + 7, _x1 - 7, _gy[1], _z1 - 7), material='glas')
        for _rn, (_a, _b, _c, _d) in (('links', (_x0, _z0, _x0 + 7, _z1)), ('rechts', (_x1 - 7, _z0, _x1, _z1)), ('unten', (_x0, _z0, _x1, _z0 + 7)),
                                      ('oben', (_x0, _z1 - 7, _x1, _z1)), ('mitte', (_G['pos_cm'] - 3, _z0, _G['pos_cm'] + 3, _z1))):
            add('rahmen', f'Giebelfenster Sattel {_gi} Rahmen {_rn}', box=box(_a, _ry[0], _b, _c, _ry[1], _d), material='rahmen')
        _fb = (_ya - 6, _ya + 2) if _s == 'S' else (_yb - 2, _yb + 6)
        add('detail', f'Giebelfenster Sattel {_gi} Fensterbank', box=box(_x0 - 4, _fb[0], _z0 - 4, _x1 + 4, _fb[1], _z0), material='fensterbank')
        if _G.get('rollladen'):
            _rl = (_ya - 4, _ya) if _s == 'S' else (_yb, _yb + 4)
            add('detail', f'Giebelfenster Sattel {_gi} Rollladen', box=box(_x0, _rl[0], _z1 - (_z1 - _z0) * _G['rollladen'], _x1, _rl[1], _z1), material='rollladen')
    print('GIEBELFENSTER SATTEL', len(_GS))
