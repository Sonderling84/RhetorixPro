# bauteile_treppe_keller_garten.py - 05.10.2026 (Tobi: "Treppe im Haus und Keller absolut Pflicht", "Garten in die Skizze").
# Laeuft per exec am Ende von bauplan_stueckliste.py (nach bauteile_zusatz_module.py), gleicher Namensraum.
# Regel treppe_pflicht: Kellertreppe KG->EG und (bei ausgebautem DG) Treppe OG->DG werden IMMER gebaut, mit Treppenloechern + Absturzsicherung.
# Regel keller_innen: Innenwaende/Raeume im KG aus haus.json 'keller_innen' (sonst Standard: ein Kellerflur an der Treppe).
# Regel garten_hang: Garten/Grundstueck/Wege folgen dem Gelaende (lange Teile werden in Abschnitte geteilt).
def _split_slab(p_, hole_, tag_):
    """Deckenplatte p_ (box) um ein Loch (x0,y0,x1,y1) herum in bis zu 4 Stuecke teilen (p_ wird Stueck 1)."""
    x0, y0, z0, x1, y1, z1 = p_['box']; hx0, hy0, hx1, hy1 = max(hole_[0], x0), max(hole_[1], y0), min(hole_[2], x1), min(hole_[3], y1)
    if hx1 <= hx0 or hy1 <= hy0: return
    st_ = [(x0, y0, hx0, y1), (hx1, y0, x1, y1), (hx0, y0, hx1, hy0), (hx0, hy1, hx1, y1)]
    st_ = [s for s in st_ if s[2] - s[0] > 1 and s[3] - s[1] > 1]
    p_['box'] = box(st_[0][0], st_[0][1], z0, st_[0][2], st_[0][3], z1); p_['name'] += f' Stueck 1 (um {tag_})'
    for i_, s in enumerate(st_[1:], 2): add(p_['kat'], p_['name'].replace(' Stueck 1', f' Stueck {i_}'), box=box(s[0], s[1], z0, s[2], s[3], z1), material=p_.get('material', 'beton_hell'))
def _absturz(tag_, hole_, z_, seiten_):
    hx0, hy0, hx1, hy1 = hole_
    for s_ in seiten_:
        bx_ = {'O': (hx1 - 4, hy0, hx1, hy1), 'W': (hx0, hy0, hx0 + 4, hy1), 'S': (hx0, hy0, hx1, hy0 + 4), 'N': (hx0, hy1 - 4, hx1, hy1)}[s_]
        add('gelaender', f'Absturzsicherung {tag_} {s_}', box=box(bx_[0], bx_[1], z_ + 2, bx_[2], bx_[3], z_ + 100), material='stahl')
_K2 = H.get('keller') if isinstance(H.get('keller'), dict) else ({'tiefe_cm': 270} if H.get('keller') else {})
_KT2 = _K2.get('tiefe_cm', 270)
# ---- Kellertreppe KG -> EG (Pflicht, sobald ein Keller existiert) ----
if _K2:
    KTp = H.get('kellertreppe') or {}
    n_ = max(12, round(_KT2 / 18)); r_ = _KT2 / n_; a_ = min(30, max(25, 63 - 2 * r_))
    if KTp.get('achse') == 'x':   # 06.10. Mozarthaus: Kellertreppe laeuft in x (z. B. unter der DG-Treppe, gleiche Laufrichtung -> Kopfhoehe bleibt)
        ri_ = KTp.get('richtung', -1); xu_ = KTp['x_unten_cm']; ky0_, ky1_ = KTp['y0_cm'], KTp['y1_cm']; xo_ = xu_ + ri_ * n_ * a_
        for k in range(n_):
            xa_ = xu_ + ri_ * k * a_; xb_ = xa_ + ri_ * a_
            add('treppe', f'Kellertreppe Stufe {k + 1}', box=box(min(xa_, xb_), ky0_, -_KT2 + k * r_, max(xa_, xb_), ky1_, -_KT2 + (k + 1) * r_), material='beton_hell')
        add('treppe', 'Kellertreppe Handlauf', box=box(min(xu_, xo_), ky0_ - 2, -_KT2 + 90, max(xu_, xo_), ky0_ + 2, 90), material='stahl')
        kmin_ = max(0, math.ceil((_KT2 - 20 - 210) / r_) - 1); xk_ = xu_ + ri_ * kmin_ * a_
        hole_k = (min(xk_, xo_) - 10, ky0_ - 5, max(xk_, xo_) + 10, ky1_ + 5)
        bp_ = next((q for q in parts if q['kat'] == 'fundament' and q['name'] == 'Bodenplatte' and 'box' in q), None)
        if bp_: _split_slab(bp_, hole_k, 'Kellertreppe')
        if KTp.get('absturz', ('N', 'S')): _absturz('Kellertreppe', hole_k, 0, tuple(KTp.get('absturz', ('N', 'S'))))
        print('KELLERTREPPE (x)', n_, 'Stufen, x', xu_, '->', round(xo_), 'y', ky0_, '-', ky1_)
    else:
        kx0 = KTp.get('x0_cm', T + 40 + 114); kyt = KTp.get('y_oben_cm', D - T - 120); kyb = kyt - n_ * a_
        for k in range(n_):
            add('treppe', f'Kellertreppe Stufe {k + 1}', box=box(kx0, kyb + k * a_, -_KT2 + k * r_, kx0 + 100, kyb + (k + 1) * a_, -_KT2 + (k + 1) * r_), material='beton_hell')
        add('treppe', 'Kellertreppe Handlauf', box=box(kx0 - 2, kyb, -_KT2 + 90, kx0 + 2, kyt, 90), material='stahl')
        kmin_ = max(0, math.ceil((_KT2 - 20 - 210) / r_) - 1); hole_k = (kx0 - 10, kyb + kmin_ * a_ - 5, kx0 + 110, kyt)
        bp_ = next((q for q in parts if q['kat'] == 'fundament' and q['name'] == 'Bodenplatte' and 'box' in q), None)
        if bp_: _split_slab(bp_, hole_k, 'Kellertreppe')
        _absturz('Kellertreppe', hole_k, 0, ('O', 'W', 'S'))
        print('KELLERTREPPE', n_, 'Stufen, x', kx0, 'y', round(kyb), '-', round(kyt))
# ---- Treppe OG -> DG (Pflicht bei ausgebautem Dachgeschoss) ----
_dg = roof['typ'] not in ('flach',) and H.get('dg_ausbau', bool(roof.get('dachfenster') or H.get('giebelfenster') or True))
if _dg and NF > 1 and TL:
    zf_ = z_floor(NF - 1) + GH + DK; n_ = max(12, round((GH + DK) / 18)); r_ = (GH + DK) / n_; a_ = min(30, max(25, 63 - 2 * r_))
    tx_ = TL[0] + 10; ty_ = D - T - 120
    for k in range(n_):
        add('treppe', f'DG-Treppe Stufe {k + 1}', box=box(tx_, ty_ - (k + 1) * a_, z_floor(NF - 1) + k * r_, tx_ + 100, ty_ - k * a_, z_floor(NF - 1) + (k + 1) * r_), material='beton_hell')
    add('treppe', 'DG-Treppe Handlauf', box=box(tx_ + 98, ty_ - n_ * a_, z_floor(NF - 1) + 90, tx_ + 102, ty_, zf_ + 90), material='stahl')
    dk_ = [q for q in parts if q['kat'] == 'decke' and 'box' in q and abs(q['box'][5] - zf_) < 1 and (q['box'][3] - q['box'][0]) * (q['box'][4] - q['box'][1]) > 4e5]
    if dk_: _split_slab(max(dk_, key=lambda q: (q['box'][3] - q['box'][0]) * (q['box'][4] - q['box'][1])), TL, 'DG-Treppe')
    _absturz('DG-Treppe', TL, zf_, ('O', 'N'))
    print('DG-TREPPE', n_, 'Stufen')
# ---- Kellertueren in den Aussenwaenden (z. B. Garage im Anbau <-> Keller) ----
for ti_, KTU in enumerate(_K2.get('tueren', []) if _K2 else [], 1):
    s_ = KTU.get('seite', 'W'); nm_ = {'W': 'West', 'E': 'Ost', 'N': 'Nord', 'S': 'Sued'}[s_]
    kw_ = next((q for q in parts if q['kat'] == 'sockel' and q['name'] == 'Kelleraussenwand ' + nm_), None)
    if not kw_: print('  !! Kellertuer', ti_, 'ohne Wand'); continue
    a0_, a1_ = KTU['pos_cm'] - KTU['b_cm'] / 2, KTU['pos_cm'] + KTU['b_cm'] / 2
    _oeffnung(kw_, 'y' if s_ in 'WE' else 'x', (0 if s_ == 'W' else W - T) if s_ in 'WE' else (0 if s_ == 'S' else D - T), a0_, a1_, -_KT2, -_KT2 + KTU.get('h_cm', 205), f'Kellertuer {ti_} ({nm_})', True)
for gi_, G in enumerate(H.get('anbau_garagen', []), 1):   # Bodenplatte der Anbau-Garage (begehbar, Pruefagent)
    gb_ = G.get('breite_cm', 300); gx0_, gx1_ = (-gb_, 0) if G.get('seite', 'W') == 'W' else (W, W + gb_); gy0_ = G.get('y0_cm', 0); gz_ = G.get('boden_cm', 0)
    add('garage', f'Anbau-Garage {gi_} Bodenplatte', box=box(gx0_, gy0_, gz_ - 15, gx1_, gy0_ + G.get('tiefe_cm', 600), gz_), material='beton_hell')
# ---- Keller innen ----
if _K2:
    KI_ = H.get('keller_innen') or {}
    for wi_, w_ in enumerate(KI_.get('waende', []), 1):
        add('innen', f'Kellerwand {wi_}', box=box(w_[0], w_[1], -_KT2, w_[2], w_[3], -20), material='innen')
    for r_ in KI_.get('raeume', []): print('  KG-Raum', r_['name'])
    if KI_.get('raeume'): meta_kg = KI_['raeume']
# ---- Garten folgt dem Hang ----
_gz = (lambda x, y: gel_z(x, min(y, D))) if H.get('garten_hof') else gel_z   # 05.10. Hof auf der Talseite ist eben (Kellerhoehe)
if H.get('garten_hof'):
    for q in parts:
        if q['name'] == 'Rasen (Hang)' and 'mesh' in q: q['mesh']['verts'] = [[v[0], v[1], round(_gz(v[0], v[1]), 1)] for v in q['mesh']['verts']]
if GEL and min(GEL.values()) < -100:
    n0_ = len(parts); _mv = 0
    for q in list(parts[:n0_]):
        if q['kat'] not in ('garten', 'grundstueck', 'baum', 'gelaende') or 'box' not in q or q['name'].startswith('Rasen'): continue
        x0, y0, z0, x1, y1, z1 = q['box']; L_ = max(x1 - x0, y1 - y0)
        dz_ = abs(_gz(x0, y0) - _gz(x1, y1))
        if dz_ > 8 and L_ > 120:   # lange Teile am Hang: in Abschnitte von ~2 m, jeder auf seiner Gelaendehoehe
            nn_ = int(L_ // 100) + 1; lx_ = (x1 - x0) >= (y1 - y0)
            for s_ in range(nn_):
                a0, a1 = (x0 + (x1 - x0) * s_ / nn_, x0 + (x1 - x0) * (s_ + 1) / nn_) if lx_ else (y0 + (y1 - y0) * s_ / nn_, y0 + (y1 - y0) * (s_ + 1) / nn_)
                cx_, cy_ = ((a0 + a1) / 2, (y0 + y1) / 2) if lx_ else ((x0 + x1) / 2, (a0 + a1) / 2); g_ = _gz(cx_, cy_)
                bb_ = box(a0, y0, z0 + g_, a1, y1, z1 + g_) if lx_ else box(x0, a0, z0 + g_, x1, a1, z1 + g_)
                if s_ == 0: q['box'] = bb_
                else: add(q['kat'], f"{q['name']} Abschnitt {s_ + 1}", box=bb_, material=q.get('material'))
        else:
            g_ = _gz((x0 + x1) / 2, (y0 + y1) / 2); q['box'] = box(x0, y0, z0 + g_, x1, y1, z1 + g_)
        _mv += 1
    for q in parts[:n0_]:
        if q['kat'] == 'baum' and 'mesh' in q:
            vs_ = q['mesh']['verts']; cx_ = sum(v[0] for v in vs_) / len(vs_); cy_ = sum(v[1] for v in vs_) / len(vs_); g_ = _gz(cx_, cy_)
            q['mesh']['verts'] = [[v[0], v[1], round(v[2] + g_, 1)] for v in vs_]; _mv += 1
    print('GARTEN AM HANG:', _mv, 'Teile aufs Gelaende gesetzt')

# ---- Garten-Hof auf der Talseite (05.10. Tobi-Fensterfoto): Pflaster vor Toren, Trittplatten, Beet + Zierzaun, Mauer ----
GH_ = H.get('garten_hof')
if GH_ and GH_.get('seite', 'N') == 'N':
    zh_ = _gz(W / 2, D) if GEL else 0; yt_ = D + GH_.get('tiefe_cm', 800)
    def _hb(x0, y0, z0, x1, y1, z1): return box(x0, y0, z0 + zh_, x1, y1, z1 + zh_)
    for pi_, (px_, pb_) in enumerate(GH_.get('pflaster', []), 1): add('garten', f'Pflaster vor Tor {pi_}', box=_hb(px_, D, 0, px_ + pb_, D + 650, 3), material='beton_hell')
    tx_ = GH_.get('trittplatten_zu_cm')
    if tx_ is not None:
        for k_ in range(7): add('garten', f'Trittplatte {k_ + 1}', box=_hb(tx_ - 28 + (k_ % 2) * 18, D + 110 + k_ * 75, 0, tx_ + 22 + (k_ % 2) * 18, D + 155 + k_ * 75, 4), material='beton_hell')
    if GH_.get('beet'):
        b0_, b1_ = GH_['beet']; add('garten', 'Beet', box=_hb(b0_, D + 60, 0, b1_, D + 260, 10), material='erde')
        for k_ in range(int((b1_ - b0_) // 100) + 1): add('garten', f'Zierzaun Pfosten {k_ + 1}', box=_hb(b0_ + k_ * 100, D + 262, 0, b0_ + k_ * 100 + 6, D + 268, 90), material='holz_dunkel')
        for zz_ in (20, 78): add('garten', f'Zierzaun Riegel {zz_}', box=_hb(b0_, D + 262, zz_, b1_, D + 268, zz_ + 6), material='holz_dunkel')
    if GH_.get('mauer'): add('garten', 'Mauer zur Gasse', box=_hb(-340, yt_ - 30, 0, W, yt_, 60), material='sockel')
    print('GARTEN-HOF Talseite auf', round(zh_), 'cm')
