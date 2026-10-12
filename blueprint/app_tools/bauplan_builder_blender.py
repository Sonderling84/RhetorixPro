# -*- coding: utf-8 -*-
# BAUPLAN-BUILDER (Blender, headless oder GUI): arbeitet die nummerierte Stueckliste Teil fuer Teil ab.
# Kein raeumliches "Verstehen" - jedes Teil ist eine Box oder ein Mesh mit Welt-Koordinaten (cm).
# Objekte heissen "T07 Suedwand EG ..." -> Nummer im Outliner = Nummer auf dem Bauplan-Blatt.
# Aufruf:  blender -b --python bauplan_builder_blender.py -- <stueckliste.json> <outdir> <tag> [samples] [nur_bauen]
import bpy, sys, os, json, math, mathutils

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SL = json.load(open(argv[0], encoding='utf-8')); OUTDIR = os.path.abspath(argv[1]); TAG = argv[2]
SAMPLES = int(argv[3]) if len(argv) > 3 else 96
NUR_BAUEN = len(argv) > 4 and argv[4] == '1'
os.makedirs(OUTDIR, exist_ok=True)
S = 0.01  # cm -> m

# ---------- Szene leeren ----------
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
for me in list(bpy.data.meshes): bpy.data.meshes.remove(me)
scene = bpy.context.scene
cols = {}
def coll(name):
    if name not in cols:
        c = bpy.data.collections.new(name); scene.collection.children.link(c); cols[name] = c
    return cols[name]

# ---------- Materialien (PBR aus Poly Haven, wenn assets_pbr/manifest.json da ist; sonst prozedural) ----------
PBR_MAN = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets_pbr', 'manifest.json')
STIMMUNG = os.environ.get('BAUPLAN_STIMMUNG', 'tag')          # tag | abend (Sonnenuntergang: Abend-HDRI, tiefe warme Sonne, warm leuchtende Fenster)
SUFFIX = os.environ.get('BAUPLAN_SUFFIX', '')                 # z. B. _abend -> BAUPLAN_render_front_abend_<tag>.png
KAMERAS = [k for k in os.environ.get('BAUPLAN_KAMERAS', '').split(',') if k]   # leer = alle
try: PBR_ALL = json.load(open(PBR_MAN, encoding='utf-8')) if not os.environ.get('BAUPLAN_NO_PBR') else {}
except Exception: PBR_ALL = {}
try: PBR = json.load(open(PBR_MAN, encoding='utf-8')).get('materialien', {}) if not os.environ.get('BAUPLAN_NO_PBR') else {}
except Exception: PBR = {}
def img_node(nt, path, srgb):
    im = bpy.data.images.get(os.path.basename(path)) or bpy.data.images.load(path); im.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = im; n.projection = 'BOX'; n.projection_blend = 0.2; return n
def mat_innen():
    m = mat('Innenraum dunkel', (0.05, 0.045, 0.04), 0.95)
    if STIMMUNG == 'abend':
        b = m.node_tree.nodes.get('Principled BSDF')
        try: b.inputs['Emission Color'].default_value = (1.0, 0.60, 0.28, 1.0); b.inputs['Emission Strength'].default_value = 2.8
        except Exception: pass
    return m
def mat_pbr(key, name, rough_mul=1.0, tint=None, extra_rough=None, hell=0.0):
    spec = PBR.get(key)
    if not spec or 'diff' not in spec.get('maps', {}) or not os.path.exists(spec['maps']['diff']): return None
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); kx, ky = spec.get('kachel_m', [2, 2])
    mp.inputs['Scale'].default_value = (1.0 / max(0.3, kx), 1.0 / max(0.3, ky), 1.0 / max(0.3, kx)); nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    d = img_node(nt, spec['maps']['diff'], True); nt.links.new(mp.outputs['Vector'], d.inputs['Vector']); col_out = d.outputs['Color']
    if hell:   # Aufhellen (weisser Putz): Brightness/Contrast
        bc = nt.nodes.new('ShaderNodeBrightContrast'); bc.inputs['Bright'].default_value = hell; bc.inputs['Contrast'].default_value = 0.05; nt.links.new(col_out, bc.inputs['Color']); col_out = bc.outputs['Color']
    if tint:
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1.0
        nt.links.new(col_out, mix.inputs[6]); mix.inputs[7].default_value = (*tint, 1.0); nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    else: nt.links.new(col_out, b.inputs['Base Color'])
    if 'rough' in spec['maps'] and os.path.exists(spec['maps']['rough']):
        r = img_node(nt, spec['maps']['rough'], False); nt.links.new(mp.outputs['Vector'], r.inputs['Vector'])
        mm = nt.nodes.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; mm.inputs[1].default_value = rough_mul; nt.links.new(r.outputs['Color'], mm.inputs[0]); nt.links.new(mm.outputs[0], b.inputs['Roughness'])
    elif extra_rough is not None: b.inputs['Roughness'].default_value = extra_rough
    if 'nor_gl' in spec['maps'] and os.path.exists(spec['maps']['nor_gl']):
        n = img_node(nt, spec['maps']['nor_gl'], False); nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.8; nt.links.new(n.outputs['Color'], nm.inputs['Color'])
        if 'disp' in spec['maps'] and os.path.exists(spec['maps']['disp']):
            dp = img_node(nt, spec['maps']['disp'], False); nt.links.new(mp.outputs['Vector'], dp.inputs['Vector'])
            bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.35; bp.inputs['Distance'].default_value = 0.03
            nt.links.new(dp.outputs['Color'], bp.inputs['Height']); nt.links.new(nm.outputs['Normal'], bp.inputs['Normal']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
        else: nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m
def mat(name, rgb, rough=0.8, metal=0.0, trans=0.0, ior=1.45, bump=0.0, bump_scale=40.0):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*rgb, 1.0); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if 'Transmission Weight' in b.inputs: b.inputs['Transmission Weight'].default_value = trans
    b.inputs['IOR'].default_value = ior
    if bump > 0:
        tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); bp = nt.nodes.new('ShaderNodeBump')
        nz.inputs['Scale'].default_value = bump_scale; nz.inputs['Detail'].default_value = 6.0
        bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = 0.02
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(nz.outputs['Fac'], bp.inputs['Height'])
        nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    if trans > 0: m.blend_method = 'BLEND' if hasattr(m, 'blend_method') else m.blend_method
    return m
MATS = {
    'putz_dunkel': lambda: mat_pbr('putz', 'PBR Putz dunkel', 1.0, tint=(0.52, 0.50, 0.47), hell=0.22) or mat('Putz dunkelgrau', (0.36, 0.35, 0.33), 0.92, bump=0.25, bump_scale=60),   # 05.10. Loggia-Innenseiten
    'putz_gelb':  lambda: mat_pbr('putz', 'PBR Putz gelb', 1.0, tint=(1.0, 0.80, 0.42), hell=0.36) or mat('Putz gelb', (0.86, 0.70, 0.36), 0.92, bump=0.25, bump_scale=60),   # 05.10. fassade_seiten
    'putz':       lambda: mat_pbr('putz', 'PBR Putz weiss', 1.0, tint=(1.0, 1.0, 0.98), hell=0.38) or mat('Putz hellgrau', (0.74, 0.74, 0.72), 0.92, bump=0.25, bump_scale=60),
    'sockel':     lambda: mat_pbr('sockel', 'PBR Sockel', 1.0, tint=(0.38, 0.38, 0.40)) or mat('Sockel dunkelgrau', (0.30, 0.30, 0.31), 0.95, bump=0.2),
    'beton':      lambda: mat_pbr('beton', 'PBR Beton') or mat('Beton', (0.55, 0.55, 0.53), 0.9),
    'beton_hell': lambda: mat_pbr('beton_hell', 'PBR Pflaster', 1.0, tint=(0.9, 0.9, 0.88)) or mat('Beton hell', (0.72, 0.72, 0.69), 0.85, bump=0.1, bump_scale=8),
    'asphalt':    lambda: mat_pbr('asphalt', 'PBR Asphalt') or mat('Asphalt', (0.10, 0.10, 0.10), 0.95, bump=0.15, bump_scale=120),
    'dach':       lambda: mat_pbr('dach', 'PBR Dachziegel', 1.0, tint=(0.55, 0.55, 0.58)) or mat('Dachschindel anthrazit', (0.09, 0.09, 0.10), 0.75, bump=0.5, bump_scale=90),
    'dach_flach': lambda: mat_pbr('dach_flach', 'PBR Flachdach Kies', 1.0, tint=(0.6, 0.6, 0.6)) or mat('Flachdach Bitumen', (0.12, 0.12, 0.12), 0.9),
    'blende':     lambda: mat('Traufblende', (0.07, 0.07, 0.08), 0.5),
    'attika_blende': lambda: mat('Attika Blende schwarz', (0.04, 0.04, 0.05), 0.25, metal=0.8),
    'rahmen':     lambda: mat('Fensterrahmen schwarz', (0.02, 0.02, 0.02), 0.35),

    'stahl':      lambda: mat('Stahl schwarz', (0.04, 0.04, 0.04), 0.3, metal=0.85),
    'glas':       lambda: mat('Glas', (0.80, 0.88, 0.95), 0.03, trans=1.0, ior=1.5),
    'innen':      lambda: mat_innen(),
    'halm':       lambda: mat('Grashalm', (0.055, 0.15, 0.035), 0.9),
    'decke':      lambda: mat('Decke Beton hell', (0.80, 0.80, 0.78), 0.85),
    'tuer':       lambda: mat('Tuer Holz dunkel', (0.13, 0.08, 0.05), 0.5, bump=0.1, bump_scale=15),
    'tor':        lambda: mat('Sektionaltor', (0.15, 0.10, 0.07), 0.55),
    'fuge':       lambda: mat('Tor-Fuge', (0.02, 0.015, 0.01), 0.7),
    'rasen':      lambda: mat_pbr('rasen', 'PBR Rasen', 1.0, tint=(0.24, 0.40, 0.17)) or mat('Rasen', (0.13, 0.30, 0.07), 1.0, bump=0.35, bump_scale=300),
    'holz':       lambda: mat_pbr('holz', 'PBR Holz', 1.0, tint=(0.75, 0.6, 0.45)) or mat('Holz Sparren', (0.45, 0.30, 0.16), 0.7, bump=0.1, bump_scale=20),
    'hecke':      lambda: mat_pbr('hecke', 'PBR Hecke', 1.0, tint=(0.25, 0.5, 0.18)) or mat('Hecke', (0.08, 0.22, 0.06), 1.0, bump=0.6, bump_scale=120),
    'erde':       lambda: mat_pbr('erde', 'PBR Erde') or mat('Beet Erde', (0.20, 0.14, 0.09), 1.0, bump=0.3, bump_scale=200),
}

# ---------- Materialsatz der Preisklasse (meta.materialien aus haus.json -> echte Oberflaechen) ----------
_MT = {k: str(v).lower() for k, v in ((SL.get('meta') or {}).get('materialien') or {}).items()} if not os.environ.get('BAUPLAN_NO_MATSATZ') else {}
def _klinker_hell():   # 08.10.: heller, cremefarbener Verblendklinker aus yellow_brick (CC0): entsaettigt + aufgehellt
    m = mat_pbr('klinker_hell', 'PBR Klinker hell', 1.0)
    if not m: return None
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF'); lk = b.inputs['Base Color'].links
    if lk and not nt.nodes.get('KH_HueSat'):
        src = lk[0].from_socket; hs = nt.nodes.new('ShaderNodeHueSaturation'); hs.name = 'KH_HueSat'
        hs.inputs['Saturation'].default_value = 0.30; hs.inputs['Value'].default_value = 1.55
        nt.links.new(src, hs.inputs['Color']); mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        nt.links.new(hs.outputs['Color'], mx.inputs[6]); mx.inputs[7].default_value = (1.0, 0.95, 0.85, 1.0); nt.links.new(mx.outputs[2], b.inputs['Base Color'])
    return m
def _m_fassade():
    f = _MT.get('fassade', '')
    if 'klinker' in f and ('hell' in f or 'beige' in f or 'sand' in f): return _klinker_hell()   # 08.10. heller Verblender (Saarbruecker Str. 9)
    if 'klinker' in f: return mat_pbr('klinker_dunkel', 'PBR Klinker dunkel', 1.0) if ('dunkel' in f or 'anthrazit' in f) else mat_pbr('klinker_rot', 'PBR Klinker rot', 1.0, tint=(0.92, 0.85, 0.82))
    if 'holz' in f and 'putz' not in f: return mat_pbr('holz_fassade', 'PBR Holzfassade', 1.0)
    if 'putz' in f and 'gelb' in f: return mat_pbr('putz', 'PBR Putz sandgelb', 1.0, tint=(0.95, 0.70, 0.36), hell=0.3)   # 27.09. Beethoven: gelb verputzt
    if 'putz' in f and ('anthrazit' in f or 'grau' in f): return mat_pbr('putz', 'PBR Putz grau', 1.0, tint=(0.45, 0.45, 0.46), hell=0.1)
    return None
def _m_dach():
    d = _MT.get('dach', '')
    if 'edelengob' in d or 'glasiert' in d: return mat_pbr('dach', 'PBR Tonziegel edelengobiert', 0.6, tint=(0.20, 0.20, 0.22))   # glatte Oberflaeche -> spiegelt den Himmel
    if 'ton' in d and 'rot' in d: return mat_pbr('dach_ton_rot', 'PBR Tonziegel rot', 1.0)
    if 'braun' in d: return mat_pbr('dach', 'PBR Tonziegel braun', 1.0, tint=(0.62, 0.40, 0.27)) or mat_pbr('dach_ton_rot', 'PBR Tonziegel braun', 1.0, tint=(0.40, 0.30, 0.27))   # 07.10. Mozarthaus: braune Ziegel laut Foto (getestet Lauf 0221)
    if 'ton' in d and ('anthrazit' in d or 'schwarz' in d): return mat_pbr('dach', 'PBR Tonziegel anthrazit', 0.8, tint=(0.30, 0.30, 0.33))
    if 'zink' in d or 'metall' in d or 'blech' in d and 'flach' not in d: return mat('Stehfalz Zink', (0.42, 0.44, 0.46), 0.35, metal=0.9)
    if 'beton' in d: return mat_pbr('dach', 'PBR Betondachstein grau', 1.0, tint=(0.30, 0.30, 0.31))
    return None
def _m_rahmen():
    t = _MT.get('fenster', '')
    if 'weiss' in t: return mat('Fensterrahmen weiss', (0.86, 0.86, 0.84), 0.35)
    if 'holz-alu' in t or 'alu' in t: return mat('Fensterrahmen Alu anthrazit', (0.035, 0.037, 0.04), 0.3, metal=0.6)
    if 'anthrazit' in t: return mat('Fensterrahmen anthrazit', (0.05, 0.052, 0.056), 0.4)
    return None
def _m_tuer():
    t = _MT.get('tuer', '')
    if 'holz' in t: return mat_pbr('holz_fassade', 'PBR Tuer Eiche', 0.7, tint=(0.55, 0.42, 0.32)) or mat('Tuer Holz Eiche', (0.16, 0.09, 0.045), 0.45, bump=0.1, bump_scale=15)
    if 'alu' in t or 'anthrazit' in t: return mat('Tuer Alu anthrazit', (0.04, 0.042, 0.046), 0.3, metal=0.6)
    if 'kunststoff' in t: return mat('Tuer Kunststoff weiss', (0.82, 0.82, 0.80), 0.4)
    return None
_MT_QUELLE = {'putz': 'fassade', 'dach': 'dach', 'rahmen': 'fenster', 'tuer': 'tuer'}
def _mit_pruefung(k, fn, alt):   # 07.10. Material-Pruefung: Angabe vorhanden, aber nicht zugeordnet -> Warnung (haus_lauf macht GELB daraus)
    def f():
        m = fn()
        t_ = _MT.get(_MT_QUELLE[k], '')
        std_ = (k == 'putz' and 'putz' in t_ and any(w in t_ for w in ('weiss', 'hell', 'creme'))) or (k == 'dach' and not any(w in t_ for w in ('braun', 'rot', 'anthrazit', 'schwarz', 'grau', 'zink', 'blech', 'gruen')))
        if m is None and t_ and PBR and not std_: print(f"MATERIAL-WARNUNG {_MT_QUELLE[k]} '{_MT[_MT_QUELLE[k]]}' nicht zugeordnet -> Standardmaterial", flush=True)
        return m or alt()
    return f
for _k, _fn in (('putz', _m_fassade), ('dach', _m_dach), ('rahmen', _m_rahmen), ('tuer', _m_tuer)):
    if _MT: MATS[_k] = _mit_pruefung(_k, _fn, MATS[_k])
if _MT: print('MATERIALSATZ', _MT)
MATS.setdefault('rollladen', lambda: mat('Rollladen Alu anthrazit', (0.09, 0.095, 0.10), 0.45))   # 26.09.: fehlte -> Rolllaeden waren weiss
MATS.setdefault('sockelputz', lambda: mat('Sockelputz anthrazit', (0.20, 0.20, 0.21), 0.92, bump=0.08))   # 26.09. Beethoven: verputzter Sockel/Keller
def _m_glas():   # 3-fach-Verglasung: mehrere Scheibenflaechen spiegeln zusammen ~10-14 % -> Himmel/Baeume sichtbar statt schwarzer Loecher
    m = mat('Glas 3-fach', (0.80, 0.86, 0.90), 0.02, trans=1.0, ior=1.52); b = m.node_tree.nodes.get('Principled BSDF')
    for k, v in (('Specular IOR Level', 1.0), ('Coat Weight', 1.0), ('Coat Roughness', 0.0), ('Coat IOR', 1.5)):
        if k in b.inputs: b.inputs[k].default_value = v
    return m
if not os.environ.get('BAUPLAN_GLAS_ALT'): MATS['glas'] = _m_glas
MATS.setdefault('stein', lambda: mat('Granit grau', (0.46, 0.46, 0.45), 0.6, bump=0.15, bump_scale=40))   # 01.10. Beethoven: Granitrahmen, Stufen (vorher ohne Material -> Putzfarbe)
MATS.setdefault('sandstein', lambda: mat_pbr('sockel', 'PBR Sandstein rot', 1.0, tint=(0.80, 0.52, 0.42)) or mat('Sandstein rot', (0.46, 0.27, 0.21), 0.9, bump=0.25))   # 01.10. Kaffeemuehle: Saar-Sandsteinsockel
MATS.setdefault('klappladen', lambda: mat('Klappladen gruen', (0.035, 0.12, 0.07), 0.55))   # 01.10. Kaffeemuehle: Holz-Klappläden lackiert
MATS.setdefault('milchglas', lambda: mat('Milchglas satiniert', (0.52, 0.55, 0.57), 0.35))   # 27.09. Haustuer-Glasfelder (Foto: grau satiniert)
# ---------- Detail-Materialien (24.09.): Fensterbank, Rinne, PV, Holzverschalung, Garagentor ----------
_KL = str((SL.get('meta') or {}).get('preisklasse', ''))
def _m_pv():   # monokristallin schwarz: Zellraster (Brick-Textur) + Glas-Deckschicht -> spiegelt den Himmel
    m = bpy.data.materials.get('PV Modul')
    if m: return m
    m = mat('PV Modul', (0.015, 0.02, 0.035), 0.12, metal=0.1); nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); br = nt.nodes.new('ShaderNodeTexBrick'); nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    br.inputs['Scale'].default_value = 1.0; br.inputs['Mortar Size'].default_value = 0.012; br.offset = 0.0
    br.inputs['Brick Width'].default_value = 1.13; br.inputs['Row Height'].default_value = 1.72
    br.inputs['Color1'].default_value = (0.012, 0.016, 0.03, 1); br.inputs['Color2'].default_value = (0.02, 0.025, 0.045, 1); br.inputs['Mortar'].default_value = (0.35, 0.36, 0.38, 1)
    nt.links.new(br.outputs['Color'], b.inputs['Base Color'])
    for k, v in (('Coat Weight', 1.0), ('Coat Roughness', 0.03), ('Specular IOR Level', 0.8)):
        if k in b.inputs: b.inputs[k].default_value = v
    return m
MATS['fensterbank'] = (lambda: mat('Fensterbank Alu weiss', (0.80, 0.80, 0.78), 0.3, metal=0.5)) if 'weiss' in _MT.get('fenster', '') else (lambda: mat('Fensterbank Alu anthrazit', (0.06, 0.063, 0.068), 0.3, metal=0.6))
MATS['rinne'] = (lambda: mat('Rinne Zink', (0.55, 0.57, 0.58), 0.35, metal=0.9)) if _KL == 'gehoben' else (lambda: mat('Rinne Alu anthrazit', (0.07, 0.072, 0.078), 0.35, metal=0.6))
MATS['pv'] = _m_pv
MATS['holz_fassade'] = lambda: mat_pbr('holz_fassade', 'PBR Holzfassade', 1.0, tint=(0.95, 0.85, 0.75)) or mat('Holzverschalung', (0.35, 0.22, 0.12), 0.6)
def _m_wasser():   # Pool: klares Wasser, IOR 1,33, feine Wellen -> spiegelt Haus und Himmel
    m = bpy.data.materials.get('Poolwasser')
    if m: return m
    m = mat('Poolwasser', (0.75, 0.92, 0.95), 0.01, trans=1.0, ior=1.333); nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); bp = nt.nodes.new('ShaderNodeBump')
    nz.inputs['Scale'].default_value = 6.0; nz.inputs['Detail'].default_value = 4.0; bp.inputs['Strength'].default_value = 0.06; bp.inputs['Distance'].default_value = 0.01
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(nz.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m
MATS['klinker'] = lambda: mat_pbr('klinker_rot', 'PBR Klinker rot', 1.0, tint=(0.92, 0.85, 0.82)) or mat('Klinker rot', (0.35, 0.12, 0.08), 0.8)
MATS['holz_dunkel'] = lambda: mat_pbr('holz_fassade', 'PBR Holz dunkel', 0.8, tint=(0.42, 0.28, 0.18)) or mat('Holz dunkel', (0.12, 0.07, 0.04), 0.6)
MATS['holz_deck'] = lambda: mat_pbr('holz_fassade', 'PBR Holzdeck', 0.9, tint=(0.75, 0.62, 0.5)) or mat('Holzdeck', (0.3, 0.2, 0.12), 0.6)
MATS['kragplatte'] = lambda: mat('Dachplatte weiss', (0.82, 0.82, 0.80), 0.55)
MATS['kapsel_alu'] = lambda: mat('Kapsel Alu silbergrau', (0.50, 0.52, 0.55), 0.28, metal=0.65)   # 08.10. Kapselhaus (bauteile_kapsel.py)
MATS['kapsel_innen'] = lambda: mat('Kapsel Laibung weiss', (0.86, 0.86, 0.84), 0.35)
MATS['kapsel_paneel'] = lambda: mat('Kapsel Paneel grau', (0.36, 0.37, 0.39), 0.5)
MATS['pool_fliese'] = lambda: mat('Poolfliese', (0.45, 0.75, 0.80), 0.3)
MATS['wasser'] = _m_wasser
MATS['tor'] = (lambda: mat('Garagentor weiss', (0.82, 0.82, 0.80), 0.4)) if 'weiss' in _MT.get('fenster', '') else (lambda: mat('Garagentor anthrazit', (0.05, 0.052, 0.056), 0.35, metal=0.5))
# 02.10.: Gewerbe-Bausteine (Modul gewerbe_tankstelle.py) - neutrale Farben, keine Marken
MATS['ts_blau'] = lambda: mat('TS Blau Lack', (0.005, 0.09, 0.62), 0.4, metal=0.3)
MATS['ts_weiss'] = lambda: mat('TS Weiss Lack', (0.80, 0.81, 0.82), 0.45, metal=0.2)
MATS['ts_rot'] = lambda: mat('TS Rot Lack', (0.45, 0.02, 0.02), 0.45)
MATS['ts_dunkel'] = lambda: mat('TS Dunkel', (0.012, 0.012, 0.014), 0.6)
MATS['ts_beton'] = lambda: mat('TS Beton Hof', (0.30, 0.30, 0.29), 0.9)
MATS['ts_decke'] = lambda: mat('TS Decke Paneel', (0.62, 0.63, 0.64), 0.6, metal=0.2)
MATS['ts_display'] = lambda: mat('TS Display', (0.02, 0.03, 0.035), 0.1)
MATS['ts_gummi'] = lambda: mat('TS Gummi Schlauch', (0.02, 0.02, 0.02), 0.8)
MATS['ts_blech_blau'] = lambda: mat('TS Blech Blau', (0.01, 0.16, 0.75), 0.45, metal=0.3)
MATS['ts_dachhaut'] = lambda: mat('TS Dachhaut Trapezblech', (0.62, 0.63, 0.64), 0.5, metal=0.5)
MATS['ts_blech_weiss'] = lambda: mat('TS Blech Weiss', (0.78, 0.79, 0.80), 0.45, metal=0.2)
MATS['ts_grau'] = lambda: mat('TS Grau Lack', (0.42, 0.43, 0.45), 0.45, metal=0.3)
MATS['ts_gelb'] = lambda: mat('TS Gelb Lack', (0.75, 0.55, 0.02), 0.5)
MATS['ts_gruen'] = lambda: mat('TS Gruen Lack', (0.03, 0.35, 0.08), 0.5)
MATS['ts_chrom'] = lambda: mat('TS Chrom Metall', (0.7, 0.7, 0.72), 0.25, metal=1.0)
MATS['ts_bordgrau'] = lambda: mat('TS Bordgrau', (0.22, 0.22, 0.22), 0.85)
# 02.10. Fotorealismus-Durchgang (tools/bauteile/tankstelle_front.py): Namen = Unreal-Slot-Stichworte (haus_in_viertel.py, Stil tankstelle)
for _k, _n, _c, _r, _m in (('ts_alu', 'TS Alu Profil', (0.30, 0.31, 0.32), 0.35, 0.8), ('ts_leuchte', 'TS Leuchte', (0.95, 0.95, 0.92), 0.3, 0.0),
                           ('ts_leuchtkasten', 'TS Leuchtkasten', (0.92, 0.93, 0.95), 0.3, 0.0), ('ts_lichtband', 'TS Lichtband', (0.85, 0.86, 0.85), 0.3, 0.0),
                           ('ts_oel', 'TS Oel Fleck', (0.02, 0.018, 0.015), 0.25, 0.0), ('ts_oel2', 'TS Oel Schatten', (0.07, 0.065, 0.06), 0.6, 0.0),
                           ('ts_asphalt', 'TS Asphalt Hof', (0.08, 0.08, 0.08), 0.9, 0.0), ('ts_pflaster_rot', 'TS Pflaster Rot', (0.35, 0.16, 0.12), 0.9, 0.0),
                           ('ts_pflaster_grau', 'TS Pflaster Grau', (0.35, 0.35, 0.34), 0.9, 0.0), ('ts_boden_innen', 'TS Innen Boden', (0.55, 0.55, 0.53), 0.3, 0.0),
                           ('ts_wand_innen', 'TS Innen Wand', (0.75, 0.75, 0.73), 0.8, 0.0), ('ts_kuehl', 'TS Innen Kuehlregal', (0.08, 0.08, 0.09), 0.3, 0.5),
                           ('ts_ware_rot', 'TS Ware R', (0.55, 0.05, 0.04), 0.5, 0.0), ('ts_ware_gelb', 'TS Ware Y', (0.8, 0.6, 0.05), 0.5, 0.0),
                           ('ts_ware_gruen', 'TS Ware G', (0.05, 0.4, 0.12), 0.5, 0.0), ('ts_ware_blau', 'TS Ware B', (0.05, 0.15, 0.6), 0.5, 0.0),
                           ('ts_ware_weiss', 'TS Ware W', (0.8, 0.8, 0.78), 0.5, 0.0), ('ts_boden_nass', 'TS Waschboden nass', (0.15, 0.15, 0.15), 0.15, 0.0),
                           ('ts_fliese', 'TS Fliese Halle', (0.6, 0.62, 0.64), 0.3, 0.0), ('ts_buerste', 'TS Buerste', (0.05, 0.2, 0.55), 0.9, 0.0),
                           ('ts_rot_dunkel', 'TS Rot Kasten', (0.30, 0.01, 0.01), 0.5, 0.0), ('ts_fuge', 'TS Fuge', (0.01, 0.01, 0.01), 0.6, 0.0),
                           ('ts_mast', 'TS Mast verzinkt', (0.45, 0.46, 0.46), 0.5, 0.9), ('ts_lack_weiss_glanz', 'TS Lack Weiss glanz RAL9010', (0.86, 0.85, 0.80), 0.28, 0.0), ('ts_alu_eloxiert', 'TS Alu eloxiert', (0.62, 0.63, 0.65), 0.3, 1.0), ('ts_schild_blau', 'TS Schild Blau', (0.01, 0.12, 0.55), 0.4, 0.0)):
    MATS[_k] = (lambda n_, c_, r_, m_: (lambda: mat(n_, c_, r_, metal=m_)))(_n, _c, _r, _m)

# ---------- Geometrie-Helfer ----------
def obj_from_mesh(name, verts, faces, kat):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); coll(kat).objects.link(ob); return ob
def box_obj(name, b, kat):
    x0, y0, z0, x1, y1, z1 = [v * S for v in b]
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return obj_from_mesh(name, v, f, kat)
def assign(ob, key, kat=None):
    if kat == 'decke' and key != 'stein': key = 'putz' if _MT else 'decke'   # 01.10.: Natursteinstufen behalten ihr Material   # Deckenstirnen liegen buendig in der Fassade -> Fassadenmaterial (kein heller Betonstreifen)
    if key in MATS: ob.data.materials.append(MATS[key]())
def smooth_flat(ob):
    for p in ob.data.polygons: p.use_smooth = False

# ---------- Teile bauen ----------
objs = {}; cams = {}; log = []
if not any(q.get('kat') == 'licht' for q in SL['teile']):   # 02.10.: Stuecklisten ohne Licht (z. B. von ChatGPT) -> Standard-Sonne
    SL['teile'].append(dict(nr=len(SL['teile']) + 1, id='SONNE', kat='licht', name='Sonne Standard', azimut=200, hoehe=40, staerke=4.0)); print('LICHT Standard-Sonne ergaenzt')
for p in SL['teile']:
    name = f"{p['id']} {p['name']}"[:63]; kat = p['kat']
    if 'box' in p and kat != 'ausschnitt':
        ob = box_obj(name, p['box'], kat); assign(ob, p.get('material', ''), kat); objs[p['id']] = ob; log.append(f"{p['id']} box  {p['name']}")
    elif 'mesh' in p:
        v = [tuple(c * S for c in vv) for vv in p['mesh']['verts']]
        ob = obj_from_mesh(name, v, [tuple(f) for f in p['mesh']['faces']], kat); assign(ob, p.get('material', ''), kat); objs[p['id']] = ob
        log.append(f"{p['id']} mesh {p['name']}")
    elif 'bauteil' in p:   # 02.10.: Bauteil-Bibliothek (tools/bauteile/<name>.py, bauen(param) -> Netz in cm)
        import importlib
        _bt_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bauteile')
        if _bt_dir not in sys.path: sys.path.insert(0, _bt_dir)
        _bm, _bf = (p['bauteil'].split(':') + ['bauen'])[:2]
        net = getattr(importlib.import_module(_bm), _bf)(p.get('param'))
        _pp = p.get('param') or {}   # 05.10.: jedes Bauteil auf Zielmasse skalierbar + Materialtausch (z. B. aus Foto-/Spec-Erfassung)
        if _pp.get('ziel_masse') and net.v:
            _mn = [min(v[k] for v in net.v) for k in range(3)]; _mx = [max(v[k] for v in net.v) for k in range(3)]
            _sk = [(_pp['ziel_masse'][k] / (_mx[k] - _mn[k])) if _mx[k] > _mn[k] else 1 for k in range(3)]
            net.v = [(v[0] * _sk[0], v[1] * _sk[1], (v[2] - _mn[2]) * _sk[2] + _mn[2]) for v in net.v]
        if _pp.get('mat_map'): net.mats = [_pp['mat_map'].get(m_, m_) for m_ in net.mats]
        w = math.radians(p.get('drehung_grad', 0)); cw, sw = math.cos(w), math.sin(w); px, py, pz = p['pos']
        v = [((x * cw - y * sw + px) * S, (x * sw + y * cw + py) * S, (z + pz) * S) for x, y, z in net.v]
        ob = obj_from_mesh(name, v, net.f, kat)
        for key in net.mats: ob.data.materials.append(MATS[key]() if key in MATS else MATS['ts_grau']())
        for poly, mi in zip(ob.data.polygons, net.fm):
            poly.material_index = mi; poly.use_smooth = net.mats[mi] in ('ts_gummi', 'ts_chrom')
        objs[p['id']] = ob; log.append(f"{p['id']} bauteil {p['bauteil']} {p['name']} ({len(net.f)} Flaechen)")
    elif kat == 'ausschnitt':
        pass  # zweiter Durchlauf (Ziele muessen existieren)
    elif kat == 'kamera':
        cd = bpy.data.cameras.new(name); cam = bpy.data.objects.new(name, cd); coll('kamera').objects.link(cam)
        pos = mathutils.Vector([c * S for c in p['pos']]); ziel = mathutils.Vector([c * S for c in p['ziel']])
        cam.location = pos; cam.rotation_euler = (ziel - pos).to_track_quat('-Z', 'Y').to_euler()
        if 'ortho_cm' in p: cd.type = 'ORTHO'; cd.ortho_scale = p['ortho_cm'] * S
        else: cd.lens = p.get('brennweite_mm', 32); cd.sensor_width = 36
        cd.clip_end = 500; cams[p['id']] = (cam, p['name'])
    elif kat == 'licht':
        ld = bpy.data.lights.new(name, 'SUN'); ld.energy = p.get('staerke', 4.0) * 1.25; ld.angle = math.radians(0.6)   # kraeftig + scharf: klare Schattenkanten
        if STIMMUNG == 'abend': ld.energy = 3.0; ld.color = (1.0, 0.62, 0.38); ld.angle = math.radians(1.2); p = dict(p, azimut=265, hoehe=9)
        sun = bpy.data.objects.new(name, ld); coll('licht').objects.link(sun)
        az = math.radians(p['azimut']); el = math.radians(p['hoehe'])
        d = mathutils.Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))  # Richtung ZUR Sonne
        sun.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler(); sun.location = (5, -5, 20)
        SUN = p

# ---------- Ausschnitte (Boolean) ----------
n_cut = 0
for p in SL['teile']:
    if p['kat'] != 'ausschnitt': continue
    ziel = objs.get(p['ziel'])
    if not ziel: log.append(f"!! {p['id']} Ziel {p['ziel']} fehlt"); continue
    cut = box_obj(f"{p['id']} {p['name']}"[:63], p['box'], 'ausschnitt')
    cut.display_type = 'WIRE'; cut.hide_render = True; cut.hide_viewport = True
    md = ziel.modifiers.new(name=p['id'], type='BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = cut
    try: md.solver = 'EXACT'
    except Exception: pass
    n_cut += 1; log.append(f"{p['id']} cut  -> {p['ziel']}")

# ---------- Echte Baeume (Poly Haven glTF, CC0) an den Plaetzen der Low-Poly-Kugeln; Kugeln bleiben fuer Neon/Blueprint ----------
TREE_SRC = []
def import_tree(path):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path); new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    if not meshes: return None
    for o in new: o.hide_render = True; o.hide_viewport = True
    return meshes
modelle = PBR_ALL.get('modelle', {}) if not os.environ.get('BAUPLAN_NO_PBR') else {}
for key in ('baum', 'baum2'):
    mm = modelle.get(key)
    if mm and os.path.exists(mm['datei']):
        try:
            ms = import_tree(mm['datei'])
            if ms: TREE_SRC.append(ms)
        except Exception as e: print('BAUM-IMPORT', key, e)
n_tree = 0
if TREE_SRC:
    kronen = {p['name'].split(' Krone')[0]: p for p in SL['teile'] if p['kat'] == 'baum' and p['name'].endswith('Krone')}
    for p in SL['teile']:
        if p['kat'] != 'baum' or not p['name'].endswith('Stamm'): continue
        b = p['box']; cx, cy = (b[0] + b[3]) / 2 * S, (b[1] + b[4]) / 2 * S
        kr = kronen.get(p['name'].split(' Stamm')[0]); h_ziel = (max(v[2] for v in kr['mesh']['verts']) * S) if kr else 5.0
        src = TREE_SRC[n_tree % len(TREE_SRC)]
        zs = [ (o.matrix_world @ mathutils.Vector(c)).z for o in src for c in o.bound_box ]; h_src = max(zs) - min(zs) or 1.0
        sc = h_ziel / h_src; rot = (n_tree * 1.7) % (2 * math.pi)
        for o in src:
            c = o.copy(); c.data = o.data; c.name = f'Echtbaum {n_tree + 1} {o.name}'[:63]; coll('echtbaum').objects.link(c)
            c.hide_render = False; c.hide_viewport = False; c.location = (cx, cy, 0); c.scale = (sc, sc, sc); c.rotation_euler = (0, 0, rot)
        n_tree += 1
    print('ECHTBAEUME', n_tree)
# ---------- Realistischer Rasen: Halme als Haar-Partikel auf dem Grundstueck (Loecher fuer Haus, Wege, Terrasse) ----------
try:
    gr = [p for p in SL['teile'] if p['kat'] == 'grundstueck' and 'Grundstuecksgrenze' in p['name']]
    if gr and not os.environ.get('BAUPLAN_NO_GRAS'):
        gx0 = min(p['box'][0] for p in gr) * S; gx1 = max(p['box'][3] for p in gr) * S; gy0 = min(p['box'][1] for p in gr) * S; gy1 = max(p['box'][4] for p in gr) * S
        flaeche_m2 = abs((gx1 - gx0) * (gy1 - gy0))
        default_gras_n = min(120000, max(15000, int(flaeche_m2 * 200)))
        me = bpy.data.meshes.new('Rasen Halme'); me.from_pydata([(gx0, gy0, 0.004), (gx1, gy0, 0.004), (gx1, gy1, 0.004), (gx0, gy1, 0.004)], [], [(0, 1, 2, 3)]); me.update()
        gob = bpy.data.objects.new('Rasen Halme', me); coll('gelaende').objects.link(gob); assign(gob, 'halm')
        holes = [objs[p['id']] for p in SL['teile'] if p['id'] in objs and (p['kat'] == 'fundament' or (p['kat'] in ('gelaende', 'grundstueck') and any(k in p['name'] for k in ('Einfahrt', 'Weg', 'Podest', 'Terrasse', 'Gehweg', 'Strasse'))) or p['kat'] == 'garten' and 'Beet' in p['name'])]
        for k, ho in enumerate(holes):
            md = gob.modifiers.new(f'Loch{k}', 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = ho
            try: md.solver = 'EXACT'
            except Exception: pass
        pm = gob.modifiers.new('Gras', 'PARTICLE_SYSTEM'); st = pm.particle_system.settings
        st.type = 'HAIR'; st.count = int(os.environ.get('BAUPLAN_GRAS_N', str(default_gras_n))); st.hair_length = 0.06; st.use_advanced_hair = True; st.use_modifier_stack = True
        st.child_type = 'INTERPOLATED'; st.rendered_child_count = 5; st.child_length = 0.8; st.child_length_threshold = 0.35; st.clump_factor = 0.25; st.roughness_endpoint = 0.06; st.roughness_2 = 0.15
        st.render_type = 'PATH'; st.use_hair_bspline = True; st.hair_step = 3; st.display_percentage = 5
        for attr, val in (('root_radius', 1.0), ('tip_radius', 0.05), ('radius_scale', 0.01), ('shape', 0.0)):
            try: setattr(st, attr, val)
            except Exception: pass
        try: scene.cycles.hair_shape = 'THICK'
        except Exception: pass
        print('GRAS', st.count, f'Halme (dynamisch fuer {flaeche_m2:.1f} m² Grundstueck) x', st.rendered_child_count)
except Exception as e: print('GRAS-FEHLER', e)
# ---------- Natur-Umgebung (24.09.): Wald, Wiese, Gelaende statt Strasse/Hecke - per haus.meta.umgebung='natur' oder BAUPLAN_UMGEBUNG=natur ----------
NATUR = (os.environ.get('BAUPLAN_UMGEBUNG') or (SL.get('meta') or {}).get('umgebung', '')) == 'natur'
if NATUR:
    try: exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'umgebung_natur_blender.py'), encoding='utf-8').read(), globals())
    except Exception as e:
        import traceback; traceback.print_exc(); print('NATUR-FEHLER', e)
# ---------- ROHBAU (26.09., Tobi: 'Fenster weglassen, mehr Rohbau'): Oeffnungen leer, Mauerwerk sichtbar - per BAUPLAN_ROHBAU=1 ----------
if os.environ.get('BAUPLAN_ROHBAU'):
    def _m_mauer(name, farbe, mortel, zeile_m, stein_m):   # Kalksandstein/Ziegel-Mauerwerk prozedural, Koordinaten (x+y, z) -> passt auf alle achsparallelen Waende
        m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
        tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'ADD'
        cb = nt.nodes.new('ShaderNodeCombineXYZ'); br = nt.nodes.new('ShaderNodeTexBrick')
        nt.links.new(tc.outputs['Object'], sp.inputs[0]); nt.links.new(sp.outputs['X'], ad.inputs[0]); nt.links.new(sp.outputs['Y'], ad.inputs[1])
        nt.links.new(ad.outputs[0], cb.inputs['X']); nt.links.new(sp.outputs['Z'], cb.inputs['Y']); nt.links.new(cb.outputs[0], br.inputs['Vector'])
        br.inputs['Scale'].default_value = 1.0; br.inputs['Brick Width'].default_value = stein_m; br.inputs['Row Height'].default_value = zeile_m
        br.inputs['Mortar Size'].default_value = 0.012; br.inputs['Color1'].default_value = farbe; br.inputs['Color2'].default_value = tuple(c * 0.9 for c in farbe[:3]) + (1,)
        br.inputs['Mortar'].default_value = mortel; nt.links.new(br.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.92
        bm = nt.nodes.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = 0.35; nt.links.new(br.outputs['Fac'], bm.inputs['Height']); nt.links.new(bm.outputs['Normal'], b.inputs['Normal'])
        return m
    _ks = _m_mauer('Rohbau Ziegel rot', (0.50, 0.19, 0.11, 1), (0.66, 0.64, 0.60, 1), 0.249, 0.373) if os.environ.get('BAUPLAN_ROHBAU_STEIN', 'ziegel') == 'ziegel' else _m_mauer('Rohbau Kalksandstein', (0.78, 0.77, 0.73, 1), (0.62, 0.61, 0.58, 1), 0.25, 0.50)   # 26.09. Tobi: rote Steine (Planziegel 37,3 x 24,9)
    _bt = mat('Rohbau Beton', (0.46, 0.46, 0.45), 0.85)
    _weg = ('rahmen', 'glas', 'tuer', 'innen'); _weg_det = ('Rollladen', 'Fensterbank', 'Wandleuchte', 'Vordach', 'Dachrinne', 'Fallrohr', 'Traufblende')
    n_w = n_m = 0
    for p in SL['teile']:
        ob = objs.get(p['id'])
        if ob is None: continue
        if p['kat'] in _weg or (p['kat'] == 'detail' and p['name'].startswith(_weg_det)):
            ob.hide_render = True; ob.hide_viewport = True; n_w += 1; continue
        if ob.type == 'MESH' and p['kat'] in ('wand', 'sockel', 'decke', 'dach', 'fundament', 'gelaender'):
            ob.data.materials.clear(); ob.data.materials.append(_ks if p['kat'] == 'wand' else _bt); n_m += 1
    print('ROHBAU ausgeblendet', n_w, 'umgefaerbt', n_m)
# ---------- Kanten-Bevel (1,5 cm) fuer alles Gemauerte: Kanten fangen Licht, nichts wirkt wie Papier ----------
for p in SL['teile']:
    ob = objs.get(p['id'])
    if ob is None or p['kat'] not in ('wand', 'dach', 'sockel', 'decke', 'stuetze', 'fundament', 'balkon') or 'mesh' in p and p['kat'] == 'dach' and 'Walm' in p['name']: continue
    try: bv = ob.modifiers.new('Bevel', 'BEVEL'); bv.width = 0.015; bv.segments = 2; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(40)
    except Exception: pass
# ---------- Welt / Himmel ----------
world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World'); scene.world = world; world.use_nodes = True
wn = world.node_tree; wn.nodes.clear()
HDRI = None
try:
    _m = PBR_ALL.get('hdri_abend' if STIMMUNG == 'abend' else 'hdri') or PBR_ALL.get('hdri')
    if _m and os.path.exists(_m['datei']): HDRI = _m['datei']
except Exception: pass
bg = wn.nodes.new('ShaderNodeBackground'); out = wn.nodes.new('ShaderNodeOutputWorld')
if HDRI:   # echter Himmel (Poly Haven, CC0), gedreht, damit die helle Seite bei der Sonne liegt; Sonnenlampe bleibt fuer scharfe Schatten
    env = wn.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(HDRI)
    tc = wn.nodes.new('ShaderNodeTexCoord'); mp = wn.nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, 0, math.radians(-SUN['azimut'] + 90))
    wn.links.new(tc.outputs['Generated'], mp.inputs['Vector']); wn.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    if STIMMUNG == 'abend':   # Sonnenuntergang: Himmel warm einfaerben (HDRI-Rand ist sonst blass)
        mx = wn.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0; mx.inputs[7].default_value = (1.0, 0.66, 0.42, 1.0)
        wn.links.new(env.outputs['Color'], mx.inputs[6]); wn.links.new(mx.outputs[2], bg.inputs['Color'])
    else: wn.links.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.9 if STIMMUNG != 'abend' else 1.3; print('HDRI', os.path.basename(HDRI))
sky = wn.nodes.new('ShaderNodeTexSky')
try:
    sky.sky_type = 'MULTIPLE_SCATTERING'; sky.sun_disc = False
    sky.sun_elevation = math.radians(SUN['hoehe']); sky.sun_rotation = math.radians(-SUN['azimut'] + 180)
    sky.altitude = 200; sky.air_density = 1.0
except Exception as e: print('SKY', e)
if not HDRI: bg.inputs['Strength'].default_value = float(os.environ.get('BAUPLAN_HIMMEL_STAERKE', '0.6')); wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
wn.links.new(bg.outputs['Background'], out.inputs['Surface'])

# ---------- Render-Setup ----------
scene.render.engine = 'CYCLES'; scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True
scene.render.resolution_x = 1024; scene.render.resolution_y = 768; scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'; scene.render.film_transparent = False
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'; prefs.refresh_devices()
    for d in prefs.devices: d.use = (d.type != 'CPU')
    scene.cycles.device = 'GPU'
except Exception as e: print('GPU', e); scene.cycles.device = 'CPU'
try: scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception: pass
scene.view_settings.exposure = (-0.2 if not HDRI else 0.0) + (-0.7 if STIMMUNG == 'abend' else 0.0)   # Abend: dunkler, damit Himmel und Fenster leuchten statt ausbrennen

# ---------- Meta in die Szene schreiben (fuer Folge-Skripte: Neon-Render, Blatt) ----------
M = SL['meta']
for k in ('breite_cm', 'tiefe_cm', 'geschosse', 'traufe_cm', 'first_cm', 'dach', 'name', 'kennung', 'anzahl_teile'):
    if k in M: scene['bauplan_' + k] = M[k]
scene['bauplan_stueckliste'] = os.path.abspath(argv[0])

# ---------- 05.10.: Alterung (Aging 0-10) + LOD-400-Kanten, siehe tools/material_alterung.py ----------
# Aging: BAUPLAN_AGING > meta.aging > meta.baujahr (Alter/10) > 2 (neuwertig). BAUPLAN_OHNE_ALTERUNG=1 schaltet ab.
if os.environ.get('BAUPLAN_OHNE_ALTERUNG') != '1':
    try:
        _td = os.path.dirname(os.path.abspath(__file__))
        if _td not in sys.path: sys.path.insert(0, _td)
        import material_alterung as _MA
        _ag = os.environ.get('BAUPLAN_AGING') or M.get('aging')
        if _ag is None and M.get('baujahr'): _ag = _MA.aging_aus_baujahr(int(M['baujahr']), M.get('saniert'))
        _ag = float(_ag if _ag is not None else 2)
        _MA.szene_altern(_ag, strasse=M.get('strasse'))
        scene['bauplan_aging'] = _ag
    except Exception as _e: print('ALTERUNG-FEHLER', _e)

# ---------- Speichern + Rendern ----------
blend = os.path.join(OUTDIR, f'BAUPLAN{SUFFIX}_{TAG}.blend')
if os.environ.get('BAUPLAN_NO_SAVE'): print('SPEICHERN uebersprungen (BAUPLAN_NO_SAVE)')
else:
  try: bpy.ops.wm.save_as_mainfile(filepath=blend)
  except RuntimeError as e:   # 24.09.: mit Natur-Assets (glTF-Bilder) scheiterte das Umrechnen relativer Pfade -> ohne Remap speichern
    print('SPEICHERN-RETRY', e)
    try: bpy.ops.wm.save_as_mainfile(filepath=blend, relative_remap=False)
    except RuntimeError as e2:
        print('SPEICHERN-RETRY2', e2); import tempfile, shutil
        tmp = os.path.join(tempfile.gettempdir(), os.path.basename(blend)); bpy.ops.wm.save_as_mainfile(filepath=tmp, relative_remap=False, copy=True); shutil.copy(tmp, blend)
open(os.path.join(OUTDIR, f'BAUPLAN_{TAG}_buildlog.txt'), 'w', encoding='utf-8').write('\n'.join(log))
GLB = os.environ.get('BAUPLAN_GLB')
if GLB:   # 3D-Modell fuer die App (Three.js): nur Bauteile, kein Gras/Echtbaum, keine Kameras/Lichter/Ausschnitte
    try:
        for o in bpy.data.objects:
            n = o.name; incol = [c.name for c in o.users_collection]
            skip = n.startswith('Echtbaum') or n.startswith('Natur') or n == 'Rasen Halme' or o.type in ('CAMERA', 'LIGHT') or 'ausschnitt' in incol or 'echtbaum' in incol or 'natur' in incol or (o.parent and o.parent.name.startswith('Natur'))   # 24.09.: Wald/Wiese nicht ins App-GLB (sonst 390 MB)
            o.hide_viewport = bool(skip)
        os.makedirs(os.path.dirname(os.path.abspath(GLB)), exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=os.path.abspath(GLB), export_format='GLB', use_visible=True, export_apply=True, export_image_format='NONE', export_yup=False, export_animations=False, export_cameras=False, export_lights=False)
        print('GLB', GLB, round(os.path.getsize(GLB) / 1e6, 1), 'MB')
    except Exception as e: print('GLB-FEHLER', e)
print(f"GEBAUT {len(objs)} Objekte, {n_cut} Ausschnitte, {len(cams)} Kameras -> {blend}")
if not NUR_BAUEN:
    # Baeume in den Foto-Renders ausblenden (Low-Poly-Kugeln irritieren den ControlNet-Pass; die KI setzt eigene Baeume).
    # In der gespeicherten .blend bleiben sie sichtbar (Neon-Linien, Blueprint).
    for o in bpy.data.objects:
        if o.name.split(' ', 1)[-1].startswith('Baum'): o.hide_render = True
    names = {'T': 'front'}
    for cid, (cam, nm) in cams.items():
        key = ('detail_' + nm.split('Detail ', 1)[1].split()[0].lower()) if 'Detail ' in nm else 'front' if 'Front' in nm else 'rueck' if 'Rueck' in nm else 'elev_sued' if 'Sued' in nm else 'elev_nord' if 'Nord' in nm else cid
        if KAMERAS and key not in KAMERAS: continue
        for _o in bpy.data.objects:
            if _o.name.startswith('Echtbaum') or _o.name == 'Rasen Halme': _o.hide_render = key.startswith('elev')
            if _o.name.startswith('Natur'): _o.hide_render = key.startswith('elev')   # Wald/Wiese nicht in den Ansichten
        for _o in bpy.data.objects:   # Elevationen: Hecke/Beet/Grenze ausblenden (sonst gruenes Band vor dem Sockel)
            _n = _o.name.lower()
            if any(k in _n for k in ('hecke', 'beet', 'gartenweg', 'grundstuecksgrenze')): _o.hide_render = True if NATUR else key.startswith('elev')
        scene.camera = cam; scene.render.filepath = os.path.join(OUTDIR, f'BAUPLAN_render_{key}{SUFFIX}_{TAG}.png')
        bpy.ops.render.render(write_still=True); print('RENDER', key, scene.render.filepath)
print('FERTIG')
