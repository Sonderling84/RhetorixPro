# -*- coding: utf-8 -*-
# B268 Nr. 9, Riegelsberg: Wohnanlage aus zwei Baukoerpern (Strassenhaus + Hofflugel).
# Erzeugt haus_b268_strasse.json und haus_b268_hof.json im Schema von bauplan_stueckliste.py.
# Masse aus 6 Street-View-Fotos geschaetzt (Fenster 1,40 m, Geschoss ca. 2,90 m); Hofseite/Rueckseiten teils INFERIERT.
import json

QF = 'Fotos B268 (6 Stk.), geschaetzt'; QI = 'INFERIERT'
GH, DK = 290, 25


def oe(lst, s, f, typ, pos, b, h, br, q=QF, rl=0.6):
    lst.append(dict(seite=s, geschoss=f, typ=typ, pos_cm=pos, b_cm=b, h_cm=h, bruestung_cm=br, quelle=q, rollladen=rl))


def basis(name, kennung, W, D, oeff, balkone):
    return {
        'meta': {'name': name, 'kennung': kennung, 'vorlage': 'fotohaus', 'adresse': 'B268 Nr. 9, Riegelsberg', 'fiktiv': False,
                 'baujahr': 2018, 'materialien': {'fassade': 'Putz grau', 'dach': 'Flachdach', 'fenster': 'Alu anthrazit', 'tuer': 'Alu anthrazit'}},
        'breite_cm': W, 'tiefe_cm': D, 'geschosse': 3, 'geschosshoehe_cm': GH, 'deckenstaerke_cm': DK,
        'aussenwand_cm': 36, 'sockel_cm': 60,
        'dach': {'typ': 'flach', 'attika_cm': 45, 'ueberstand_cm': 0},
        'oeffnungen': oeff, 'balkone': balkone,
        'materialien': {'fassade': 'Putz grau', 'dach': 'Flachdach', 'fenster': 'Alu anthrazit', 'tuer': 'Alu anthrazit'},
        'sockel_material': 'putz', 'fenster_teilung': {'fluegel_ab_cm': 120},
        'gelaende': {'ecken_cm': {'SW': 0, 'NW': 0, 'SE': 0, 'NE': 0}, 'quelle': 'eben (Strasse/Parkplatz)'},
        'grundstueck': 'M', 'treppe': True, 'treppe_x_cm': 860, 'details': True,
        'keller': {'tiefe_cm': 250, 'tueren': [], 'fenster': [], 'tore': []},
        'loggien': [], 'anbau_garagen': [], 'baeume': [], 'front_seite': 'S', 'giebeltueren': [], 'dg_ausbau': False,
    }


# ---------- A: Strassenhaus an der B268 (19,0 x 11,0 m) ----------
A = []
for f in range(3):
    oe(A, 'S', f, 'fenster', 280, 170, 140, 90)            # breites Fenster links
    oe(A, 'S', f, 'fenster', 600, 110, 140, 90)
    oe(A, 'S', f, 'fenster', 900, 55, 120, 100)            # schmales Fenster im hellen Treppenhaus-Streifen
    oe(A, 'S', f, 'fenster', 1180, 110, 140, 90)
    oe(A, 'S', f, 'fenster', 1430, 110, 140, 90)
    oe(A, 'S', f, 'fenster', 1680, 110, 140, 90, QI)
    oe(A, 'E', f, 'fenster', 260, 110, 140, 90)            # Seitenfassade (Foto 1)
    oe(A, 'E', f, 'fenster', 560, 110, 140, 90)
    oe(A, 'W', f, 'fenster', 450, 60, 90, 120)             # Giebel mit kleinen Fenstern im weissen Feld (Foto 6)
    oe(A, 'N', f, 'balkontuer', 1700, 160, 230, 0, rl=0)   # Balkonstapel an der Nordost-Ecke (Foto 2)
    oe(A, 'N', f, 'fenster', 400, 110, 140, 90, QI)
    oe(A, 'N', f, 'fenster', 1150, 110, 140, 90, QI)
oe(A, 'N', 0, 'haustuer', 860, 110, 220, 0, rl=0)          # Hauseingang hofseitig (INFERIERT)
balA = [dict(seite='N', geschoss=f, von_cm=1560, bis_cm=1860, tiefe_cm=190, gelaender='glas') for f in range(3)]
HA = basis('B268 Nr. 9 - Strassenhaus', 'b268_strasse', 1900, 1100, A, balA)

# ---------- B: Hofflugel mit vorgestellten Balkonen (24,0 x 11,0 m; Balkonseite wird beim Zusammenfuegen zum Hof gedreht) ----------
B = []
BAYS = [(420, 900), (950, 1430), (1480, 1960)]
for f in range(3):
    for a, b in BAYS:
        c = (a + b) / 2
        oe(B, 'N', f, 'balkontuer', c - 110, 110, 230, 0, rl=0)
        oe(B, 'N', f, 'fenster', c + 120, 120, 140, 90)
    for x in (500, 900, 1300, 1700, 2100):
        oe(B, 'S', f, 'fenster', x, 110, 140, 90, QI)
    oe(B, 'W', f, 'fenster', 550, 60, 90, 120, QI)
oe(B, 'N', 0, 'haustuer', 2200, 110, 220, 0, rl=0)
balB = [dict(seite='N', geschoss=f, von_cm=a, bis_cm=b, tiefe_cm=200, gelaender='glas') for f in range(3) for a, b in BAYS]
HB = basis('B268 Nr. 9 - Hofflugel', 'b268_hof', 2400, 1100, B, balB)
HB['treppe_x_cm'] = 120

json.dump(HA, open('haus_b268_strasse.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
json.dump(HB, open('haus_b268_hof.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('A', len(A), 'Oeffnungen,', len(balA), 'Balkone | B', len(B), 'Oeffnungen,', len(balB), 'Balkone')
