# bauteile_ruecksprung.py (08.10.2026, Tobi zu Beethovenstr. 1: "Tuer ist leicht vertieft" - Treppenhaus als zurueckgesetzter Streifen)
# Laeuft per exec am Ende von bauplan_stueckliste.py (gleicher Namensraum).
# H['ruecksprung'] = dict(von_cm, bis_cm, tiefe_cm=60, felder='holz_dunkel')   (Strassenseite Sued, ueber alle Vollgeschosse)
#   - Suedwand im Bereich ausgeschnitten, neue Rueckwand um tiefe_cm zurueckgesetzt + Seitenwaende (Laibungen)
#   - Tuer/Fenster in dem Bereich wandern mit auf die Rueckwand (Treppenhaus-Achse)
#   - Decken-Vorderkanten im Ruecksprung gekappt, Felder zwischen den Fenstern als Verkleidung (Foto: braune Schindeln)
_RS = H.get('ruecksprung')
if _RS:
    _ra, _rb, _rt = _RS['von_cm'], _RS['bis_cm'], _RS.get('tiefe_cm', 60); _rze = z_floor(NF - 1) + GH + DK
    _rw_ = [q for q in parts if q['kat'] == 'wand' and q['name'].startswith('Suedwand') and 'box' in q]
    add('wand', 'Ruecksprung Rueckwand', box=box(_ra, _rt, 0, _rb, _rt + T, _rze), material='putz'); _rr = parts[-1]
    for q in _rw_:
        b_ = q['box']
        if b_[3] <= _ra or b_[0] >= _rb: continue
        add('ausschnitt', f'Ruecksprung in {q["name"]}', ziel=q['id'], box=box(_ra, -20, b_[2] - 1, _rb, T + 1, b_[5] + 1), oeffnung=None)
    add('wand', 'Ruecksprung Laibung West', box=box(_ra, 0, 0, _ra + 20, _rt, _rze), material='putz')
    add('wand', 'Ruecksprung Laibung Ost', box=box(_rb - 20, 0, 0, _rb, _rt, _rze), material='putz')
    _moved, _oz = 0, []
    for q in parts:
        b_ = q.get('box')
        if not b_ or q['kat'] not in ('tuer', 'rahmen', 'glas', 'detail', 'ausschnitt') or q is _rr or q['name'].startswith('Ruecksprung'): continue
        if b_[0] >= _ra - 15 and b_[3] <= _rb + 15 and b_[1] < T + 30 and b_[4] <= T + 30 and -5 <= b_[2] and b_[5] <= _rze + 5:
            q['box'] = [b_[0], b_[1] + _rt, b_[2], b_[3], b_[4] + _rt, b_[5]]; _moved += 1
            if q['kat'] == 'ausschnitt':
                q['ziel'] = _rr['id']
                if b_[5] - b_[2] > 40: _oz.append((b_[2], b_[5]))
    for q in [q for q in parts if q['kat'] == 'decke' and 'box' in q and q['box'][1] <= 1 and q['box'][0] < _rb and q['box'][3] > _ra and 0 < q['box'][5] <= _rze + 1]:
        b_ = q['box']; add('ausschnitt', f'Ruecksprung Deckenkante {q["name"][:25]}', ziel=q['id'], box=box(_ra + 20, -20, b_[2] - 1, _rb - 20, _rt, b_[5] + 1), oeffnung=None)
    # Verkleidungsfelder zwischen den Oeffnungen (Rueckwand-Vorderseite)
    _oz.sort(); _z0 = 0; _nf = 0
    for (za_, zb_) in _oz + [(_rze, _rze)]:
        if za_ - _z0 > 30:
            add('wand', f'Ruecksprung Feld {_nf + 1}', box=box(_ra + 20, _rt - 3, _z0, _rb - 20, _rt, za_), material=_RS.get('felder', 'holz_dunkel')); _nf += 1
        _z0 = max(_z0, zb_)
    print('RUECKSPRUNG', round(_rb - _ra), 'cm breit,', _rt, 'cm tief,', _moved, 'Teile versetzt,', _nf, 'Felder')
