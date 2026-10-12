# bauteile_zusatz_module.py - Zusatz-Module der Stueckliste (05.10.2026, Foto-Weg "Hangecke"), allgemein fuer jedes Haus.
# Wird am Ende von bauplan_stueckliste.py per exec im selben Namensraum ausgefuehrt (H, W, D, T, GH, DK, NF, parts, walls, add, box, z_floor).
# haus.json-Schluessel: loggien, keller.tore, seitenfluegel, fassade_seiten. Ohne diese Schluessel passiert nichts.
FS_ = H.get('fassade_seiten') or {}
def _hauptwand(seite_, f_):
    return next((q for q in walls if q.get('seite') == seite_ and q.get('geschoss') == f_ and 'Erker' not in q['name']), None)
def _oeffnung(wand_, achse_, ebene_, a0_, a1_, z0_, z1_, name_, tuer_=False):
    """Ausschnitt + Glas + Rahmen in einer achsparallelen Wand. achse_ 'x': Wand liegt in Ebene y=ebene_ (Dicke T), sonst in x=ebene_."""
    lo_, hi_ = ebene_ - 10, ebene_ + T + 10
    bx_ = box(a0_, lo_, z0_, a1_, hi_, z1_) if achse_ == 'x' else box(lo_, a0_, z0_, hi_, a1_, z1_)
    add('ausschnitt', f'{name_} Ausschnitt', ziel=wand_['id'], box=bx_, oeffnung=None)
    g0_, g1_ = ebene_ + T / 2 - 2, ebene_ + T / 2 + 2
    gl_ = (a0_ + 6, z0_ + 6, a1_ - 6, z1_ - 6)
    add('glas', f'{name_} Glas', box=box(gl_[0], g0_, gl_[1], gl_[2], g1_, gl_[3]) if achse_ == 'x' else box(g0_, gl_[0], gl_[1], g1_, gl_[2], gl_[3]), material='glas')
    rb_ = [(a0_, z0_, a0_ + 7, z1_), (a1_ - 7, z0_, a1_, z1_), (a0_, z1_ - 7, a1_, z1_)] + ([] if tuer_ else [(a0_, z0_, a1_, z0_ + 7), ((a0_ + a1_) / 2 - 3, z0_, (a0_ + a1_) / 2 + 3, z1_)])
    for ri_, r_ in enumerate(rb_, 1):
        add('rahmen', f'{name_} Rahmen {ri_}', box=box(r_[0], g0_ - 4, r_[1], r_[2], g1_ + 4, r_[3]) if achse_ == 'x' else box(g0_ - 4, r_[0], r_[1], g1_ + 4, r_[2], r_[3]), material='rahmen')

# ---- Loggien (Nordseite): Wand ausschneiden, Rueckwand + Wange, offene Ecke (West ODER Ost) mit Eckstuetze, Balkontuer ----
# 05.10. abends (Holzhaus 01): offene Ecke jetzt auch an der Ostecke (b >= W); gelaender='keins' fuer EG-Terrassen-Loggien
for li_, LG in enumerate(H.get('loggien', []), 1):
    if LG.get('seite', 'N') != 'N': print('  !! Loggia nur Nordseite umgesetzt'); continue
    f_ = LG.get('geschoss', 0); a_, b_, t_ = max(LG['von_cm'], 0), min(LG['bis_cm'], W), LG.get('tiefe_cm', 120); z0_ = z_floor(f_); z1_ = z0_ + GH
    m_ = FS_.get('N', 'putz'); ost_ = b_ >= W - 1 and a_ > 0; offen_ = (a_ <= 0 or ost_) and LG.get('ecke_offen', True); mi_ = LG.get('material_innen', 'putz_dunkel')
    pf_ = LG.get('eckpfosten_cm', 30)
    wn_ = _hauptwand('N', f_)
    if wn_ and 'box' in wn_:   # Nordwand im Loggia-Bereich kuerzen/teilen statt Boolean
        bx_ = list(wn_['box'])
        if bx_[0] < a_ - 1 and b_ < bx_[3] - 1:
            add('wand', f"{wn_['name']} (links der Loggia {li_})", geschoss=f_, seite='N', along=[bx_[0], a_], box=box(bx_[0], bx_[1], bx_[2], a_, bx_[4], bx_[5]), material=wn_.get('material', 'putz'))
            wn_['box'] = box(b_, bx_[1], bx_[2], bx_[3], bx_[4], bx_[5]); wn_['along'] = [b_, bx_[3]]
        elif bx_[0] < a_ - 1:
            wn_['box'] = box(bx_[0], bx_[1], bx_[2], a_, bx_[4], bx_[5]); wn_['along'] = [bx_[0], a_]
        else:
            wn_['box'] = box(max(b_, bx_[0]), bx_[1], bx_[2], bx_[3], bx_[4], bx_[5]); wn_['along'] = [max(b_, bx_[0]), bx_[3]]
    if offen_:
        ww_ = _hauptwand('E' if ost_ else 'W', f_)
        if ww_ and 'box' in ww_:   # Giebelwand endet vor der Loggia
            bw_ = list(ww_['box']); ww_['box'] = box(bw_[0], bw_[1], bw_[2], bw_[3], min(bw_[4], D - t_), bw_[5]); ww_['along'] = [bw_[1], min(bw_[4], D - t_)]
        if LG.get('eckstuetze', False):
            add('wand', f'Loggia {li_} Eckpfosten', geschoss=f_, seite='N-loggia', along=[0, 0], box=box(W - pf_ if ost_ else 0, D - pf_, z0_, W if ost_ else pf_, D, z1_ + DK), material=m_)
        xg_ = W - 5 if ost_ else 5
        if LG.get('gelaender') == 'holz': gelaender_holz(f'Loggia {li_} Gelaender Giebelseite', [(xg_, D - t_ + 5), (xg_, D - pf_ - 5)], z0_, 100)
        elif LG.get('gelaender') != 'keins':
            x0g_ = W - 6 if ost_ else 0
            add('gelaender', f'Loggia {li_} Gelaender Giebelseite Handlauf', box=box(x0g_, D - t_, z0_ + 94, x0g_ + 6, D - pf_, z0_ + 100), material='stahl')
            for k_ in range(int((t_ - pf_) // 12) + 1): add('gelaender', f'Loggia {li_} Gelaender Giebelseite Stab {k_}', box=box(x0g_ + 1, D - t_ + 2 + k_ * 12, z0_, x0g_ + 4, D - t_ + 5 + k_ * 12, z0_ + 94), material='stahl')
    if LG.get('front_gelaender'):   # 06.10. Paar 1 Front: Absturzsicherung an der Vorderkante der eingezogenen OG-Flaeche
        fa_, fb_ = LG['front_gelaender']; gelaender_holz(f'Loggia {li_} Gelaender Front', [(fa_, D - 5), (fb_, D - 5)], z0_, 100)
    xr0_ = a_ + (T if offen_ and not ost_ else 0); xr1_ = b_ - (T if offen_ and ost_ else 0)   # Rueckwand nie deckungsgleich mit der Giebelfassade
    rw_ = add('wand', f'Loggia {li_} Rueckwand', geschoss=f_, seite='N-loggia', along=[xr0_, xr1_], box=box(xr0_, D - t_ - T, z0_, xr1_, D - t_, z1_), material=mi_)
    if ost_ or not offen_: add('wand', f'Loggia {li_} Wange West', geschoss=f_, seite='N-loggia', along=[0, 0], box=box(a_ - T, D - t_ - T, z0_, a_, D - T, z1_), material=mi_)
    if not ost_: add('wand', f'Loggia {li_} Wange Ost', geschoss=f_, seite='N-loggia', along=[0, 0], box=box(b_, D - t_ - T, z0_, b_ + T, D - T, z1_), material=mi_)
    add('decke', f'Loggia {li_} Untersicht', box=box(a_, D - t_, z1_ - 2, b_, D - T, z1_), material=mi_)
    if LG.get('tuer', True):
        c_ = (xr0_ + xr1_) / 2 + (-40 if ost_ else 40)
        _oeffnung(rw_, 'x', D - t_ - T, c_ - 50, c_ + 50, z0_, z0_ + 215, f'Loggia {li_} Balkontuer', tuer_=True)
        fx_ = (xr1_ - 180) if ost_ else (xr0_ + 60)
        if (fx_ + 120 < c_ - 60) or (fx_ > c_ + 60): _oeffnung(rw_, 'x', D - t_ - T, fx_, fx_ + 120, z0_ + 90, z0_ + 215, f'Loggia {li_} Fenster')
# ---- Kellertore (Garage im Keller, Hanglage): Ausschnitt in der Kelleraussenwand, Rolltor mit Lamellen, Blende ----
_K = H.get('keller') if isinstance(H.get('keller'), dict) else {}
_KT = _K.get('tiefe_cm', 270)
for ti_, TR in enumerate(_K.get('tore', []), 1):
    s_ = TR.get('seite', 'N')
    if s_ not in ('N', 'S'): print('  !! Kellertor nur N/S umgesetzt'); continue
    kw_ = next((q for q in parts if q['kat'] == 'sockel' and q['name'] == 'Kelleraussenwand ' + ('Nord' if s_ == 'N' else 'Sued')), None)
    x0_, x1_ = TR['pos_cm'] - TR['b_cm'] / 2, TR['pos_cm'] + TR['b_cm'] / 2; z0_ = -_KT; z1_ = z0_ + TR.get('h_cm', 215)
    yy_ = (D - T - 10, D + 10) if s_ == 'N' else (-10, T + 10); ty_ = (D - 14, D - 10) if s_ == 'N' else (10, 14)
    if kw_: add('ausschnitt', f'Kellertor {ti_} Ausschnitt', ziel=kw_['id'], box=box(x0_, yy_[0], z0_, x1_, yy_[1], z1_), oeffnung=None)
    add('tor', f'Kellertor {ti_} Rolltor ({TR["b_cm"]}x{TR.get("h_cm", 215)})', box=box(x0_, ty_[0], z0_, x1_, ty_[1], z1_), material='tor')
    for k_ in range(1, int(TR.get('h_cm', 215) // 14)):
        yf_ = (ty_[1] - 1, ty_[1] + 1) if s_ == 'N' else (ty_[0] - 1, ty_[0] + 1)
        add('tor', f'Kellertor {ti_} Lamelle {k_}', box=box(x0_, yf_[0], z0_ + k_ * 14 - 1, x1_, yf_[1], z0_ + k_ * 14 + 1), material='fuge')
    for nm_, xa_ in (('links', x0_ - 8), ('rechts', x1_)):
        add('rahmen', f'Kellertor {ti_} Fuehrungsschiene {nm_}', box=box(xa_, ty_[0] - 4, z0_, xa_ + 8, ty_[1] + 4, z1_), material='blende')
    if TR.get('blende'):   # durchgehende Blende ueber den Toren (Tobi-Foto: ueber beiden Garagen in einer Flucht)
        bx0_, bx1_ = TR.get('blende_von_cm', x0_ - 20), TR.get('blende_bis_cm', x1_ + 20)
        yb_ = (D, D + 18) if s_ == 'N' else (-18, 0)
        add('detail', f'Kellertor {ti_} Blende', box=box(bx0_, yb_[0], z1_ + 5, bx1_, yb_[1], z1_ + 28), material='attika_blende')

# ---- Seitenfluegel (Ost/West): eigener Baukoerper mit Flachdach, optional Dachterrasse, Fenster/Tuer ----
for si_, SF in enumerate(H.get('seitenfluegel', []), 1):
    s_ = SF.get('seite', 'E'); sb_ = SF['breite_cm']; ya_, yb_ = SF['y0_cm'], SF['y1_cm']; zu_ = SF.get('unten_cm', 0); zo_ = SF.get('oben_cm', z_floor(1) + GH)
    x0_, x1_ = (W, W + sb_) if s_ == 'E' else (-sb_, 0)
    xo_ = x1_ - T if s_ == 'E' else x0_
    wd_ = {'aussen': add('wand', f'Seitenfluegel {si_} Aussenwand', geschoss=0, seite='SF', along=[ya_, yb_], box=box(xo_, ya_, zu_, xo_ + T, yb_, zo_), material=FS_.get(s_, 'putz')),
           'sued': add('wand', f'Seitenfluegel {si_} Suedwand', geschoss=0, seite='SF', along=[x0_, x1_], box=box(x0_, ya_, zu_, x1_, ya_ + T, zo_), material=FS_.get('S', 'putz')),
           'nord': add('wand', f'Seitenfluegel {si_} Nordwand', geschoss=0, seite='SF', along=[x0_, x1_], box=box(x0_, yb_ - T, zu_, x1_, yb_, zo_), material=FS_.get('N', 'putz'))}
    # 08.10.: nur Geschosse, die in den Fluegel passen (niedrige Pultdach-Fluegel ohne OG)
    for f_ in [f_ for f_ in range(NF) if z_floor(f_) < zo_ - 180]: add('decke', f'Seitenfluegel {si_} Boden G{f_}', box=box(x0_ + (0 if s_ == 'E' else T), ya_ + T, z_floor(f_) - DK, x1_ - (T if s_ == 'E' else 0), yb_ - T, z_floor(f_) - 1), material='beton_hell')   # 05.10. innerhalb der Waende (kein Flimmern)
    if SF.get('dach') == 'sattel_quer':   # 08.10. Tobi-Fotos: Fluegel-Satteldach mit First PARALLEL zur Strasse (Traufe vorn + hinten), Giebel aussen
        ng_ = math.tan(math.radians(SF.get('neigung_grad', 38))); ov_ = SF.get('ueberstand_cm', 40); dd_ = 18
        xi_ = W if s_ == 'E' else 0; xa_ = (x1_ + ov_) if s_ == 'E' else (x0_ - ov_)
        ym_ = (ya_ + yb_) / 2; zf_ = zo_ + (ym_ - ya_ + ov_) * ng_
        for nm_, (yt_, yr_) in (('vorn', (ya_ - ov_, ym_)), ('hinten', (yb_ + ov_, ym_))):
            V_ = [[xi_, yt_, zo_], [xa_, yt_, zo_], [xa_, yr_, zf_], [xi_, yr_, zf_]]; V_ += [[v[0], v[1], v[2] + dd_] for v in V_]
            add('dach', f'Seitenfluegel {si_} Satteldach {nm_}', mesh={'verts': V_, 'faces': [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]},
                material=SF.get('dach_material', 'dach'), first_cm=round(zf_ + dd_))
        xg_ = xo_; zg_ = zo_ + (ym_ - ya_) * ng_   # Giebeldreieck an der Aussenwand
        Vg_ = [[xg_, ya_, zo_], [xg_, yb_, zo_], [xg_, ym_, zg_]]; Vg_ += [[v[0] + T, v[1], v[2]] for v in Vg_]
        add('wand', f'Seitenfluegel {si_} Giebel aussen', mesh={'verts': Vg_, 'faces': [[0, 2, 1], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]}, material=FS_.get(s_, 'putz'))
    elif SF.get('dach') == 'pult':   # 08.10. Vergleichstest: Seitenfluegel mit Pultdach (Ziegel), hoch am Hauptbau, Traufe aussen
        ng_ = math.tan(math.radians(SF.get('neigung_grad', 30))); ov_ = SF.get('ueberstand_cm', 40); dd_ = 18
        xi_, xa_ = (W, x1_ + ov_) if s_ == 'E' else (0, x0_ - ov_)
        zh_ = zo_ + abs(xa_ - xi_) * ng_; ys0_, ys1_ = ya_ - ov_, yb_ + ov_
        V_ = [[xi_, ys0_, zh_], [xa_, ys0_, zo_], [xa_, ys1_, zo_], [xi_, ys1_, zh_]]; V_ += [[v[0], v[1], v[2] + dd_] for v in V_]
        add('dach', f'Seitenfluegel {si_} Pultdach', mesh={'verts': V_, 'faces': [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]},
            material=SF.get('dach_material', 'dach'), first_cm=round(zh_ + dd_))
        xw_ = x1_ if s_ == 'E' else x0_; zt_ = zo_ + abs(xw_ - xi_) * ng_
        for nm_, yy_ in (('Sued', ya_), ('Nord', yb_ - T)):   # Giebeldreiecke unter dem Pultdach
            Vg_ = [[xi_, yy_, zo_], [xw_, yy_, zo_], [xi_, yy_, zt_]]; Vg_ += [[v[0], v[1] + T, v[2]] for v in Vg_]
            add('wand', f'Seitenfluegel {si_} Giebeldreieck {nm_}', mesh={'verts': Vg_, 'faces': [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]]}, material=FS_.get('S', 'putz'))
    else:
        add('dach', f'Seitenfluegel {si_} Flachdach', box=box(x0_ - (0 if s_ == 'E' else 10), ya_ - 10, zo_, x1_ + (10 if s_ == 'E' else 0), yb_ + 10, zo_ + DK), material='dach_flach')
        add('detail', f'Seitenfluegel {si_} Attika', box=box(x0_, ya_ - 12, zo_ + DK, x1_ + 12, yb_ + 12, zo_ + DK + 8), material='attika_blende')
    if SF.get('dachterrasse'):
        zt_ = zo_ + DK + 8; ra_ = [((x0_, ya_), (x1_, ya_)), ((x1_, ya_), (x1_, yb_)), ((x0_, yb_), (x1_, yb_))] if s_ == 'E' else [((x0_, ya_), (x1_, ya_)), ((x0_, ya_), (x0_, yb_)), ((x0_, yb_), (x1_, yb_))]
        for ri_, (p_, q_) in enumerate(ra_, 1):
            add('gelaender', f'Seitenfluegel {si_} Dachterrasse Handlauf {ri_}', box=box(min(p_[0], q_[0]) - 2, min(p_[1], q_[1]) - 2, zt_ + 96, max(p_[0], q_[0]) + 2, max(p_[1], q_[1]) + 2, zt_ + 100), material='stahl')
            n_ = max(2, int(max(abs(q_[0] - p_[0]), abs(q_[1] - p_[1])) // 12))
            for k_ in range(n_ + 1):
                px_, py_ = p_[0] + (q_[0] - p_[0]) * k_ / n_, p_[1] + (q_[1] - p_[1]) * k_ / n_
                add('gelaender', f'Seitenfluegel {si_} Dachterrasse Stab {ri_}.{k_}', box=box(px_ - 1.5, py_ - 1.5, zt_, px_ + 1.5, py_ + 1.5, zt_ + 96), material='stahl')
    for fi_, FE in enumerate(SF.get('fenster', []), 1):
        w_ = wd_[FE.get('wand', 'aussen')]; z0_ = z_floor(FE.get('geschoss', 0)) + FE.get('br_cm', 95); z1_ = z0_ + FE.get('h_cm', 125)
        if FE.get('wand', 'aussen') == 'aussen': _oeffnung(w_, 'y', xo_, ya_ + FE['pos_cm'] - FE['b_cm'] / 2, ya_ + FE['pos_cm'] + FE['b_cm'] / 2, z0_, z1_, f'Seitenfluegel {si_} Fenster {fi_}', FE.get('typ') == 'tuer')
        else:
            ey_ = ya_ if FE['wand'] == 'sued' else yb_ - T
            _oeffnung(w_, 'x', ey_, x0_ + FE['pos_cm'] - FE['b_cm'] / 2, x0_ + FE['pos_cm'] + FE['b_cm'] / 2, z0_, z1_, f'Seitenfluegel {si_} Oeffnung {fi_}', FE.get('typ') == 'tuer')
            if FE.get('typ') == 'tuer': add('detail', f'Seitenfluegel {si_} Vordach Eingang', box=box(x0_ + FE['pos_cm'] - 90, ya_ - 110, z1_ + 20, x0_ + FE['pos_cm'] + 90, ya_, z1_ + 32), material='attika_blende')

# ---- Tueren im Giebel (DG -> Dachterrasse), 05.10. Pruefagent ----
for gi_, GT in enumerate(H.get('giebeltueren', []), 1):
    gname_ = 'Satteldach Giebel ' + ('Ende' if GT.get('seite', 'E') == 'E' else 'Anfang')
    gw_ = next((q for q in parts if q['kat'] == 'wand' and q['name'] == gname_), None)
    if not gw_: print('  !! Giebeltuer', gi_, 'ohne Giebel', gname_); continue
    zd_ = z_floor(NF - 1) + GH + DK
    _oeffnung(gw_, 'y', W - T if GT.get('seite', 'E') == 'E' else 0, GT['pos_cm'] - GT['b_cm'] / 2, GT['pos_cm'] + GT['b_cm'] / 2, zd_, zd_ + GT.get('h_cm', 210), f'Giebeltuer {gi_}', True)
# ---- Fassade je Seite (z. B. {'N': 'putz_gelb'}): Aussenwaende + Kellerwand dieser Seite bekommen das Material ----
if FS_:
    for q in parts:
        if q['kat'] not in ('wand', 'sockel') or 'box' not in q or q.get('material') not in ('putz', 'sockel'): continue
        b_ = q['box']
        for s_, m_ in FS_.items():
            if (s_ == 'N' and b_[4] >= D - 0.5 and b_[1] >= D - T - 1) or (s_ == 'S' and b_[1] <= 0.5 and b_[4] <= T + 1) or \
               (s_ == 'W' and b_[0] <= 0.5 and b_[3] <= T + 1) or (s_ == 'E' and b_[3] >= W - 0.5 and b_[0] >= W - T - 1):
                q['material'] = m_
    # 08.10. (Beethoven 1: dunkle Schindel-Giebelseite): auch die Giebeldreiecke (Mesh) der Seite bekommen das Material, Sockel bleibt
    for q in parts:
        if q['kat'] != 'wand' or 'mesh' not in q or 'Giebel' not in q['name'] or q.get('material') != 'putz': continue
        xs_ = [v[0] for v in q['mesh']['verts']]
        if FS_.get('W') and max(xs_) <= T + 1: q['material'] = FS_['W']
        if FS_.get('E') and min(xs_) >= W - T - 1: q['material'] = FS_['E']
    for q in parts:
        if q['kat'] == 'sockel' and str(q.get('material', '')).startswith('holz'): q['material'] = 'sockel'
print('ZUSATZMODULE: Loggien', len(H.get('loggien', [])), '| Kellertore', len(_K.get('tore', [])), '| Seitenfluegel', len(H.get('seitenfluegel', [])), '| Fassade je Seite', FS_)

# ---- Photovoltaik auf der Dachflaeche (06.10. Holzhaus 01, Fotos Beethovenstr. 5) ----
# H['solar'] = dict(seite='N'|'S', x0_cm, x1_cm, unten_cm (Hoehe Unterkante), reihen, modul_b_cm=100, modul_l_cm=170, traufe_cm)
_SO = H.get('solar') if isinstance(H.get('solar'), dict) else None
if _SO and isinstance(H.get('dach'), dict) and H['dach'].get('typ') == 'sattel':
    _ng = math.tan(math.radians(H['dach'].get('neigung_grad', 40))); _ov = H['dach'].get('ueberstand_cm', 50); _ze = _SO.get('traufe_cm', 580)
    _sn = _SO.get('seite', 'N'); _mb = _SO.get('modul_b_cm', 100); _ml = _SO.get('modul_l_cm', 170)
    _yy = (lambda z: D + _ov - (z - _ze) / _ng) if _sn == 'N' else (lambda z: -_ov + (z - _ze) / _ng)
    _dz = _ml * math.sin(math.atan(_ng)); _nx = int((_SO['x1_cm'] - _SO['x0_cm']) // (_mb + 2))
    for r_ in range(_SO.get('reihen', 3)):
        z0_ = _SO['unten_cm'] + r_ * (_dz + 2); z1_ = z0_ + _dz
        for c_ in range(_nx):
            xa_ = _SO['x0_cm'] + c_ * (_mb + 2); xb_ = xa_ + _mb; V = []
            sy_ = 1 if _sn == 'N' else -1
            for off_ in (3, 7):
                V += [(xa_, _yy(z0_) + sy_ * off_ * 0.7, z0_ + off_ * 0.7), (xb_, _yy(z0_) + sy_ * off_ * 0.7, z0_ + off_ * 0.7), (xb_, _yy(z1_) + sy_ * off_ * 0.7, z1_ + off_ * 0.7), (xa_, _yy(z1_) + sy_ * off_ * 0.7, z1_ + off_ * 0.7)]
            add('detail', f'PV-Modul R{r_ + 1} S{c_ + 1}', mesh={'verts': V, 'faces': [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]}, material='rahmen')