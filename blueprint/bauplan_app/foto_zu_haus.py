# -*- coding: utf-8 -*-
# FOTO -> HAUS.JSON ueber OpenRouter (Bildmodell). Schritt 0 des Bauplan-Pakets.
# Das Modell liest das Foto und fuellt die Hausbeschreibung im Schema von bauplan_stueckliste.py.
# Danach prueft und normalisiert dieser Code alles (Grenzen, Pflichtfelder, Oeffnungen innerhalb der Wand),
# damit die Stueckliste nie an einer KI-Antwort scheitert.
# Aufruf:  python foto_zu_haus.py <foto.jpg|png> <tag> <out_haus.json> ["Hinweise vom Kunden"]
# Umgebung: OPENROUTER_API_KEY (Pflicht), OPENROUTER_MODEL (Standard google/gemini-2.5-flash)
import sys, os, json, base64, mimetypes, urllib.request

FOTO, TAG, OUT = sys.argv[1:4]
HINWEIS = sys.argv[4] if len(sys.argv) > 4 else ''
KEY = os.environ.get('OPENROUTER_API_KEY')
MODELL = os.environ.get('OPENROUTER_MODEL', 'google/gemini-2.5-flash')
if not KEY: sys.exit('OPENROUTER_API_KEY fehlt (Umgebungsvariable setzen)')

SCHEMA = """Gib NUR ein JSON-Objekt zurueck (kein Text drumherum) mit genau diesen Feldern:
{
 "name": "kurzer Hausname",
 "breite_cm": int,            // Breite der Fassade, die dem Betrachter am meisten zugewandt ist (= Front, Sued)
 "tiefe_cm": int,             // Gebaeudetiefe (seitliche Fassade)
 "geschosse": int,            // Vollgeschosse ueber Gelaende (1..6)
 "geschosshoehe_cm": int,     // 260..450
 "dach": {"typ": "flach"|"sattel"|"walm"|"pult", "neigung_grad": int, "attika_cm": int, "first_richtung": "x"|"y", "ueberstand_cm": int},
 "fassade": "z.B. Klinker rot / Putz weiss / Holz",
 "oeffnungen": [ {"seite": "S"|"W"|"E"|"N", "geschoss": int, "typ": "fenster"|"haustuer"|"glasfront"|"terrassentuer"|"garagentor",
                  "pos_cm": int, "b_cm": int, "h_cm": int, "bruestung_cm": int, "sichtbar": true|false} ],
 "balkone": [ {"seite": "S"|"W"|"E"|"N", "geschoss": int, "pos_cm": int, "b_cm": int, "tiefe_cm": int} ],
 "begruendung": "1-3 Saetze, woran du die Masse festmachst"
}
Regeln: Koordinaten in cm. Seite S = Front (vom Foto aus gesehen die Hauptfassade), W = linke Seitenfassade,
E = rechte, N = Rueckseite. pos_cm = Mitte der Oeffnung, gemessen ab der linken Ecke der jeweiligen Fassade
(S und N: ab Westecke; W und E: ab Suedecke). Masstab: Tuer = 200-220 cm hoch, Geschoss ca. 280-300 cm (Altbau 350-420).
Oeffnungen, die du im Foto siehst: sichtbar=true. Fuer Seiten, die man nicht sieht, ergaenze plausible Oeffnungen mit sichtbar=false.
Jede Fassade braucht Fenster in jedem Geschoss. Keine Oeffnung darf ueber die Wand hinausragen."""


def frage(foto):
    mt = mimetypes.guess_type(foto)[0] or 'image/jpeg'
    b64 = base64.b64encode(open(foto, 'rb').read()).decode()
    body = {'model': MODELL, 'temperature': 0.1, 'response_format': {'type': 'json_object'},
            'messages': [{'role': 'system', 'content': 'Du bist Architekt und vermisst Gebaeude aus Fotos fuer einen Bauplan. ' + SCHEMA},
                         {'role': 'user', 'content': [
                             {'type': 'text', 'text': 'Vermiss dieses Gebaeude.' + (' Hinweise vom Kunden: ' + HINWEIS if HINWEIS else '')},
                             {'type': 'image_url', 'image_url': {'url': f'data:{mt};base64,{b64}'}}]}]}
    rq = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(body).encode(),
                                headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json',
                                         'X-Title': 'Bauplan-App foto_zu_haus'})
    r = json.load(urllib.request.urlopen(rq, timeout=180))
    txt = r['choices'][0]['message']['content'].strip()
    if txt.startswith('```'): txt = txt.split('\n', 1)[1].rsplit('```', 1)[0]
    return json.loads(txt), r.get('model', MODELL)


def clamp(v, lo, hi, d):
    try: return max(lo, min(hi, int(round(float(v)))))
    except Exception: return d


def normalisieren(K, modell):
    W = clamp(K.get('breite_cm'), 500, 4000, 1000); D = clamp(K.get('tiefe_cm'), 500, 3000, 900)
    NF = clamp(K.get('geschosse'), 1, 6, 2); GH = clamp(K.get('geschosshoehe_cm'), 250, 450, 280)
    T = 36
    dk = K.get('dach') or {}; typ = dk.get('typ') if dk.get('typ') in ('flach', 'sattel', 'walm', 'pult') else 'sattel'
    dach = {'typ': typ, 'ueberstand_cm': clamp(dk.get('ueberstand_cm'), 0, 120, 40 if typ != 'flach' else 0)}
    if typ == 'flach': dach['attika_cm'] = clamp(dk.get('attika_cm'), 0, 200, 40)
    else:
        dach['neigung_grad'] = clamp(dk.get('neigung_grad'), 10, 60, 35); dach['first_richtung'] = dk.get('first_richtung') if dk.get('first_richtung') in ('x', 'y') else 'x'
    laenge = {'S': W, 'N': W, 'W': D, 'E': D}
    oe = []
    for o in K.get('oeffnungen') or []:
        s = o.get('seite'); g = clamp(o.get('geschoss'), 0, NF - 1, 0)
        if s not in laenge: continue
        typ_o = o.get('typ') if o.get('typ') in ('fenster', 'haustuer', 'glasfront', 'terrassentuer', 'garagentor') else 'fenster'
        b = clamp(o.get('b_cm'), 50, laenge[s] - 2 * T - 40, 120); h = clamp(o.get('h_cm'), 50, GH - 20, 140)
        br = 0 if typ_o in ('haustuer', 'garagentor', 'terrassentuer') else clamp(o.get('bruestung_cm'), 0, GH - h - 10, 90)
        pos = clamp(o.get('pos_cm'), T + 20 + b // 2, laenge[s] - T - 20 - b // 2, laenge[s] // 2)
        if any(q['seite'] == s and q['geschoss'] == g and abs(q['pos_cm'] - pos) < (q['b_cm'] + b) / 2 + 15 for q in oe): continue   # Ueberlappung
        oe.append(dict(seite=s, geschoss=g, typ=typ_o, pos_cm=pos, b_cm=b, h_cm=h, bruestung_cm=br, rollladen=0.0,
                       quelle=f'OpenRouter {modell}: ' + ('im Foto erkannt' if o.get('sichtbar', True) else 'INFERIERT')))
    if not any(o['typ'] == 'haustuer' for o in oe):
        oe.append(dict(seite='S', geschoss=0, typ='haustuer', pos_cm=W // 2, b_cm=110, h_cm=220, bruestung_cm=0, rollladen=0.0,
                       quelle='Pflicht: Haustuer ergaenzt (INFERIERT)'))
    fas = str(K.get('fassade') or 'Putz weiss')
    H = {
        'meta': {'name': K.get('name') or TAG, 'kennung': TAG, 'vorlage': 'openrouter_foto', 'fiktiv': True,
                 'ki_modell': modell, 'ki_begruendung': K.get('begruendung', ''),
                 'materialien': {'fassade': fas, 'dach': 'Ziegel' if typ != 'flach' else 'Bitumen', 'fenster': 'Alu anthrazit', 'tuer': 'Holz'}},
        'breite_cm': W, 'tiefe_cm': D, 'geschosse': NF, 'geschosshoehe_cm': GH, 'deckenstaerke_cm': 20,
        'aussenwand_cm': T, 'sockel_cm': 50, 'dach': dach, 'oeffnungen': oe,
        'materialien': {'fassade': fas, 'dach': 'Ziegel' if typ != 'flach' else 'Bitumen', 'fenster': 'Alu anthrazit', 'tuer': 'Holz'},
        'sockel_material': 'putz', 'fenster_teilung': {'fluegel_ab_cm': 110},
        'gelaende': {'ecken_cm': {'SW': 0, 'NW': 0, 'SE': 0, 'NE': 0}, 'quelle': 'eben (angenommen)'},
        'grundstueck': 'M', 'treppe': NF > 1, 'treppe_x_cm': W - T - 160, 'details': True,
        'keller': {'tiefe_cm': 250, 'tueren': [], 'fenster': [], 'tore': []},
        'loggien': [], 'balkone': [], 'anbau_garagen': [], 'baeume': [], 'front_seite': 'S', 'giebeltueren': [], 'dg_ausbau': False,
    }
    return H


if __name__ == '__main__':
    K, modell = frage(FOTO)
    H = normalisieren(K, modell)
    json.dump(H, open(OUT, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    json.dump(K, open(OUT.replace('.json', '_openrouter_roh.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f"HAUS {TAG}: {H['breite_cm']}x{H['tiefe_cm']} cm, {H['geschosse']} Geschosse, Dach {H['dach']['typ']}, "
          f"{len(H['oeffnungen'])} Oeffnungen  (Modell {modell})")
    print('Begruendung:', K.get('begruendung', ''))
