# bauteile_gelaender.py - 05.10.2026 (Tobi: "Gelaender ist schlampig"): sauberes Holzgelaender wie auf dem Foto.
# Eckpfosten an jedem Knick, durchgehender Handlauf + Fussleiste je Abschnitt (stossen sauber an die Pfosten),
# flache Bretter (11 x 3 cm, Luecke 4 cm) mit geschwungener Baluster-Form. Per exec in bauplan_stueckliste.py geladen.
_PROFIL = [(0.0, 1.0), (0.10, 1.0), (0.20, 0.58), (0.30, 1.0), (0.58, 1.0), (0.68, 0.52), (0.78, 1.0), (1.0, 1.0)]
def _brett(name_, cx_, cy_, dx_, dy_, z0_, z1_, b_=11, d_=3, mat_='holz_dunkel'):
    nx_, ny_ = -dy_, dx_; hw_ = b_ / 2; hd_ = d_ / 2
    links_ = [(-hw_ * w, z0_ + (z1_ - z0_) * t) for t, w in _PROFIL]; rechts_ = [(hw_ * w, z0_ + (z1_ - z0_) * t) for t, w in reversed(_PROFIL)]
    poly_ = links_ + rechts_; n_ = len(poly_); V = []
    for s_ in (-hd_, hd_):
        V += [[round(cx_ + dx_ * u + nx_ * s_, 1), round(cy_ + dy_ * u + ny_ * s_, 1), round(z, 1)] for u, z in poly_]
    F = [list(range(n_))[::-1], list(range(n_, 2 * n_))] + [[i, (i + 1) % n_, (i + 1) % n_ + n_, i + n_] for i in range(n_)]
    add('gelaender', name_, mesh={'verts': V, 'faces': F}, material=mat_)
def gelaender_holz(tag_, pfad_, z0_, hoehe_=100, mat_='holz_dunkel', pfosten_=9, bw_=11, luecke_=4):
    """pfad_: Liste (x, y) entlang der Gelaende-Mittellinie (achsparallele Abschnitte)."""
    hp_ = pfosten_ / 2
    for i_, (px_, py_) in enumerate(pfad_):
        add('gelaender', f'{tag_} Pfosten {i_ + 1}', box=box(px_ - hp_, py_ - hp_, z0_, px_ + hp_, py_ + hp_, z0_ + hoehe_ + 3), material=mat_)
    for j_, ((xa, ya), (xb, yb)) in enumerate(zip(pfad_, pfad_[1:]), 1):
        L_ = math.hypot(xb - xa, yb - ya)
        if L_ < 1: continue
        dx_, dy_ = (xb - xa) / L_, (yb - ya) / L_
        a0x, a0y, a1x, a1y = xa + dx_ * hp_, ya + dy_ * hp_, xb - dx_ * hp_, yb - dy_ * hp_
        def _riegel(nm_, zz0, zz1, br_):
            if abs(dx_) > abs(dy_): add('gelaender', f'{tag_} {nm_} {j_}', box=box(min(a0x, a1x), a0y - br_ / 2, zz0, max(a0x, a1x), a0y + br_ / 2, zz1), material=mat_)
            else: add('gelaender', f'{tag_} {nm_} {j_}', box=box(a0x - br_ / 2, min(a0y, a1y), zz0, a0x + br_ / 2, max(a0y, a1y), zz1), material=mat_)
        _riegel('Handlauf', z0_ + hoehe_ - 6, z0_ + hoehe_, 9)
        _riegel('Fussleiste', z0_ + 6, z0_ + 12, 5)
        Li_ = L_ - pfosten_; n_ = max(1, int((Li_ + luecke_) // (bw_ + luecke_))); rest_ = (Li_ - n_ * bw_ - (n_ - 1) * luecke_) / 2
        for k_ in range(n_):
            u_ = hp_ + rest_ + bw_ / 2 + k_ * (bw_ + luecke_)
            _brett(f'{tag_} Brett {j_}.{k_ + 1}', xa + dx_ * u_, ya + dy_ * u_, dx_, dy_, z0_ + 12, z0_ + hoehe_ - 6, bw_, 3, mat_)
