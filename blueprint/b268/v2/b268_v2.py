# -*- coding: utf-8 -*-
# B268 Nr. 9 v2 - Lageplan aus dem Satellitenbild (Maßstab: Stellplatzbreite 2,5 m = 50 px -> 1 px = 5 cm).
# Lageplan-Koordinaten in cm: x = px * 5 (nach rechts), y = (1010 - py) * 5 (nach oben im Bild). Strasse B268 = unten (Sued).
import json
QF, QI = 'Fotos + Satellitenbild, geschaetzt', 'INFERIERT'
GH, DK = 290, 25

def haus(name, kennung, W, D, oe, treppe=True):
    return {'meta': {'name': name, 'kennung': kennung, 'vorlage': 'fotohaus', 'adresse': 'B268 Nr. 9, Riegelsberg', 'fiktiv': False,
                     'materialien': {'fassade': 'Putz grau', 'dach': 'Flachdach', 'fenster': 'Alu anthrazit', 'tuer': 'Alu anthrazit'}},
            'breite_cm': W, 'tiefe_cm': D, 'geschosse': 3, 'geschosshoehe_cm': GH, 'deckenstaerke_cm': DK, 'aussenwand_cm': 36, 'sockel_cm': 60,
            'dach': {'typ': 'flach', 'attika_cm': 45, 'ueberstand_cm': 0}, 'oeffnungen': oe, 'balkone': [],
            'materialien': {'fassade': 'Putz grau', 'dach': 'Flachdach', 'fenster': 'Alu anthrazit', 'tuer': 'Alu anthrazit'},
            'sockel_material': 'putz', 'fenster_teilung': {'fluegel_ab_cm': 120},
            'gelaende': {'ecken_cm': {'SW': 0, 'NW': 0, 'SE': 0, 'NE': 0}, 'quelle': 'eben'}, 'grundstueck': 'M',
            'treppe': treppe, 'treppe_x_cm': max(100, W // 2), 'details': True, 'keller': {'tiefe_cm': 250, 'tueren': [], 'fenster': [], 'tore': []},
            'loggien': [], 'anbau_garagen': [], 'baeume': [], 'front_seite': 'S', 'giebeltueren': [], 'dg_ausbau': False}

def o(L, s, f, typ, pos, b, h, br, q=QF, rl=0.6):
    L.append(dict(seite=s, geschoss=f, typ=typ, pos_cm=round(pos), b_cm=b, h_cm=h, bruestung_cm=br, quelle=q, rollladen=rl))

# K1 Strassenhaus (Lageplan x 1700..5000, y 0..1100)
A = []
for f in range(3):
    for i, x in enumerate(range(260, 3200, 290)):
        if i == 4: o(A, 'S', f, 'fenster', x, 55, 120, 100)              # heller Treppenhaus-Streifen
        else: o(A, 'S', f, 'fenster', x, 110 if i % 3 else 160, 140, 90)
    for x in (320, 760, 1100): o(A, 'N', f, 'fenster', x, 110, 140, 90, QI)   # Rest der Nordseite liegt am Hauptblock
    for y in (330, 760): o(A, 'W', f, 'fenster', y, 60, 90, 120)            # Giebel zum Parkplatz (weisses Feld, Nr. 9)
    for y in (330, 760): o(A, 'E', f, 'fenster', y, 110, 140, 90, QI)
o(A, 'W', 0, 'haustuer', 550, 110, 220, 0, rl=0)
# K2 Hauptblock (Lageplan x 3000..5475, y 1100..3625), gedreht 90 Grad: lokal N = West (Parkplatz), lokal S = Ost
Bk = []
BAYS_Y = [(1200, 1650), (1750, 2200), (2300, 2750), (2850, 3300)]
for f in range(3):
    for a, b in BAYS_Y:
        c = (a + b) / 2 - 1100
        o(Bk, 'N', f, 'balkontuer', c - 75, 110, 230, 0, rl=0); o(Bk, 'N', f, 'fenster', c + 120, 100, 140, 90)
    for x in (300, 750, 1150, 2150): o(Bk, 'S', f, 'fenster', x, 110, 140, 90, QI)
    o(Bk, 'S', f, 'balkontuer', 1700, 150, 230, 0, rl=0)                  # Balkonstapel Ostseite
o(Bk, 'N', 0, 'haustuer', 2350, 110, 220, 0, rl=0)
# K3 Nordfluegel (Lageplan x 3200..5800, y 3625..4300)
C = []
for f in range(3):
    for x in range(300, 2500, 330): o(C, 'N', f, 'fenster', x, 110, 140, 90, QI)
    o(C, 'W', f, 'balkontuer', 340, 150, 230, 0, rl=0)                    # Balkonstapel Nordwest (Fotos 1+2)
    o(C, 'E', f, 'fenster', 340, 110, 140, 90, QI)
# K4 Versatz Ost (Lageplan x 5475..5800, y 3050..3625)
Dd = []
for f in range(3): o(Dd, 'E', f, 'fenster', 290, 110, 140, 90, QI)

for nm, H in (('strasse', haus('Strassenhaus', 'b268_strasse', 3300, 1100, A)), ('haupt', haus('Hauptblock', 'b268_haupt', 2525, 2475, Bk)),
              ('nord', haus('Nordfluegel', 'b268_nord', 2600, 675, C)), ('versatz', haus('Versatz Ost', 'b268_versatz', 325, 575, Dd, treppe=False))):
    json.dump(H, open(f'haus_{nm}.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

CFG = {'name': 'B268 Nr. 9, Riegelsberg - Wohnanlage', 'kennung': 'b268', 'geschosse': 3,
       'lageplan_quelle': 'Satellitenbild Tobi 12.10.2026, 1 px = 5 cm',
       'baukoerper': [{'haus': 'haus_strasse.json', 'name': 'Strassenhaus', 'drehung': 0, 'x': 1700, 'y': 0},
                      {'haus': 'haus_haupt.json', 'name': 'Hauptblock', 'drehung': 90, 'x': 3000, 'y': 1100},
                      {'haus': 'haus_nord.json', 'name': 'Nordfluegel', 'drehung': 0, 'x': 3200, 'y': 3625},
                      {'haus': 'haus_versatz.json', 'name': 'Versatz Ost', 'drehung': 0, 'x': 5475, 'y': 3050}],
       'balkonanlagen': [{'seite': 'W', 'wand_x': 3000, 'wand_y0': a, 'wand_y1': b, 'tiefe_cm': 300} for a, b in BAYS_Y]
                        + [{'seite': 'E', 'wand_x': 5475, 'wand_y0': 2550, 'wand_y1': 3050, 'tiefe_cm': 200},
                           {'seite': 'W', 'wand_x': 3200, 'wand_y0': 3725, 'wand_y1': 4225, 'tiefe_cm': 250}],
       'kerne': [{'x0': 2700, 'y0': 3450, 'x1': 3000, 'y1': 3720, 'ueber_attika_cm': 70}]}
json.dump(CFG, open('anlage_b268.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('ok')
