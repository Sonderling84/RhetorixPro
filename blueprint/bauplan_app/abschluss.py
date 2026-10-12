# -*- coding: utf-8 -*-
# ABSCHLUSS: Zeit je Schritt (aus Datei-Zeitstempeln) + Token-/Kostenverbrauch (OpenRouter, optional Claude)
# -> ABSCHLUSS_<tag>.md im Paket-Ordner. Aufruf: python abschluss.py <paket_dir> <tag> [start_unixzeit]
import sys, os, json, glob, time
D, TAG = sys.argv[1:3]; START = float(sys.argv[3]) if len(sys.argv) > 3 else None
mt = lambda pat: [os.path.getmtime(f) for f in glob.glob(os.path.join(D, pat))]
SCHRITTE = [('0 OpenRouter-Erkennung', ['haus_*.json']), ('1 Stückliste', ['stueckliste_*.json']),
            ('2 Blender-Modell', ['BAUPLAN_*.blend', '*.glb']), ('3 Linien-Ansichten', ['render/BP3D_*.png']),
            ('4 Blätter 1–3', ['1_*.png', '2_*.png', '3_*.png']), ('5 Nacht-Look', ['render/NACHT_*.png']),
            ('6 Nacht-Blatt', ['4_NACHT_*.png'])]
t_prev = START; zeilen = []
for name, pats in SCHRITTE:
    ts = sum((mt(p) for p in pats), [])
    if not ts: continue
    ende = max(ts)
    if t_prev is None: t_prev = min(ts)
    zeilen.append((name, max(0, ende - t_prev))); t_prev = max(t_prev, ende)   # aeltere Dateien (z. B. kopierte Stueckliste) zaehlen nicht rueckwaerts
gesamt = sum(z[1] for z in zeilen)
V = {}
for f in ('verbrauch_openrouter.json', 'verbrauch_claude.json'):
    p = os.path.join(D, f)
    if os.path.exists(p): V[f] = json.load(open(p, encoding='utf-8'))
fm = lambda s: f'{int(s // 60)} min {int(s % 60):02d} s'
md = [f'# Abschluss {TAG}', '', f'Erzeugt: {time.strftime("%d.%m.%Y %H:%M")}', '', '## Zeit je Schritt', '', '| Schritt | Dauer |', '|---|---|']
md += [f'| {n} | {fm(s)} |' for n, s in zeilen] + [f'| **Gesamt** | **{fm(gesamt)}** |', '', '## Token-Verbrauch', '']
if not V: md.append('Kein KI-Verbrauch protokolliert (Erkennung ohne OpenRouter).')
for f, v in V.items():
    md += [f'**{f.replace("verbrauch_", "").replace(".json", "")}**', '', '| Wert | |', '|---|---|'] + [f'| {k} | {v[k]} |' for k in v] + ['']
open(os.path.join(D, f'ABSCHLUSS_{TAG}.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
print('\n'.join(md))
