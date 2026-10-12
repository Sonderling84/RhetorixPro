# -*- coding: utf-8 -*-
# NEON-LINIEN aus dem echten Bauplan-Modell (Roentgen-Wireframe): Freestyle mit SICHTBAREN (hell, dick) und
# VERDECKTEN (dunkler, duenn) Kanten -> man sieht durch das Haus (Decken, Rueckwand, Fenster hinten), wie in
# Tobis Referenz-Blueprints. Kameras: Front-Eck, Rueck-Eck, Iso (Axonometrie), Ansicht Sued, Ansicht Nord.
# Schreibt zusaetzlich NEONMETA_<tag>.json: 2D-Pixelkoordinaten der Schluesselpunkte je Kamera
# (Gebaeude-Ecken je Etage, First, Oeffnungs-Mitten) fuer die Beschriftung (neon_overlay.py).
# Aufruf: blender -b <BAUPLAN.blend> --python bauplan_neon_render.py -- <outdir> <tag>
import bpy, sys, os, math, json, mathutils
from bpy_extras.object_utils import world_to_camera_view as w2c
argv = sys.argv[sys.argv.index('--') + 1:]; OUTDIR = os.path.abspath(argv[0]); TAG = argv[1]
sc = bpy.context.scene
# Fotorealismus-Objekte raus (Freestyle/Tiefe brauchen nur die Bauteile; 600k Grashalme + glTF-Baeume liessen Blender abstuerzen)
for _o in list(bpy.data.objects):
    if _o.name.startswith('Echtbaum') or _o.name == 'Rasen Halme' or _o.name.startswith('Rasen Halme'):
        bpy.data.objects.remove(_o, do_unlink=True)
for _o in bpy.data.objects:
    for _m in list(_o.modifiers):
        if _m.type == 'PARTICLE_SYSTEM': _o.modifiers.remove(_m)
W = sc.get('bauplan_breite_cm', 939) / 100.0; D = sc.get('bauplan_tiefe_cm', 657) / 100.0
F = sc.get('bauplan_first_cm', 740) / 100.0; TR = sc.get('bauplan_traufe_cm', 600) / 100.0
NF = int(sc.get('bauplan_geschosse', 2)); SLP = os.path.abspath(sc.get('bauplan_stueckliste', ''))
SL = json.load(open(SLP, encoding='utf-8')) if os.path.exists(SLP) else {'teile': []}
# Welt tiefblau, Lichter aus, Flaechen schwarz -> elektrisches Neon-Wireframe direkt in Blender
w = bpy.data.worlds.new('Schwarz'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.04, 0.12, 1); sc.world = w
for o in sc.objects:
    if o.type == 'LIGHT': o.hide_render = True
for m in bpy.data.materials:
    if m.use_nodes and m.node_tree.nodes.get('Principled BSDF'):
        b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0, 0, 0, 1)
        b.inputs['Roughness'].default_value = 1.0; b.inputs['Metallic'].default_value = 0.0
        if 'Transmission Weight' in b.inputs: b.inputs['Transmission Weight'].default_value = 0.0
# Rasen (60 m Platte) raus, Einfahrt/Weg/Gehweg/Strasse bleiben als Grundstuecks-Linien
for o in sc.objects:
    if any(k in o.name.lower() for k in ('rasen', 'strasse', 'gehweg', 'innenraum', 'echtbaum')): o.hide_render = True
# Freestyle: 2 Linesets (sichtbar elektrisches Cyan-Blau / verdeckt dunkleres Struktur-Blau)
try: sc.render.engine = 'BLENDER_EEVEE_NEXT'
except Exception: sc.render.engine = 'CYCLES'
sc.render.use_freestyle = True; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 1.0
vl = sc.view_layers[0]; vl.use_freestyle = True; fs = vl.freestyle_settings; fs.crease_angle = math.radians(120)
for ls in list(fs.linesets): fs.linesets.remove(ls)
def lineset(name, vis, col, thick):
    ls = fs.linesets.new(name); ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True
    ls.select_contour = True; ls.select_material_boundary = True; ls.select_by_visibility = True; ls.visibility = vis
    ls.linestyle.color = col; ls.linestyle.thickness = thick; return ls
lineset('Sichtbar', 'VISIBLE', (0.0, 0.88, 1.0), 2.2)    # Elektrisches Cyan-Blau
lineset('Verdeckt', 'HIDDEN', (0.0, 0.35, 0.65), 1.0)   # Transparente Innenstruktur
sc.render.resolution_x = 1024; sc.render.resolution_y = 768; sc.render.film_transparent = False
sc.render.image_settings.file_format = 'PNG'

# Blender Compositor Glow (Neon Bloom direkt in Blender)
tree = getattr(sc, 'node_tree', None) or getattr(sc, 'compositor_node_tree', None)
if tree:
    for n in list(tree.nodes): tree.nodes.remove(n)
    rl = tree.nodes.new('CompositorNodeRLayers')
    comp = tree.nodes.new('CompositorNodeComposite')
    blur = tree.nodes.new('CompositorNodeBlur')
    blur.size_x = 10; blur.size_y = 10; blur.filter_type = 'GAUSS'
    mix = tree.nodes.new('CompositorNodeMixRGB')
    mix.blend_type = 'ADD'; mix.inputs[0].default_value = 0.8
    tree.links.new(rl.outputs['Image'], blur.inputs['Image'])
    tree.links.new(rl.outputs['Image'], mix.inputs[1])
    tree.links.new(blur.outputs['Image'], mix.inputs[2])
    tree.links.new(mix.outputs['Image'], comp.inputs['Image'])
try: sc.eevee.taa_render_samples = 16
except Exception: pass
sc.view_settings.view_transform = 'Standard'; sc.view_settings.exposure = 0
# Kameras
cams = {o.name: o for o in sc.objects if o.type == 'CAMERA'}
front = next(o for n, o in cams.items() if 'Front' in n); rueck = next(o for n, o in cams.items() if 'Rueck' in n)
cd = bpy.data.cameras.new('Iso'); cd.type = 'ORTHO'; cd.ortho_scale = max(W, D) * 2.3
iso = bpy.data.objects.new('T999 Kamera Iso (Axonometrie Suedost)', cd); sc.collection.objects.link(iso)
ctr = mathutils.Vector((W / 2, D / 2, F * 0.42)); iso.location = ctr + mathutils.Vector((16, -16, 9.5))
iso.rotation_euler = (ctr - iso.location).to_track_quat('-Z', 'Y').to_euler()
# Schluesselpunkte (Welt, m)
GH = None
for p in SL['teile']:
    if p['kat'] == 'decke': GH = p['box'][5] / 100.0; break
levels = [('EG', 0.0)] + [(f'{i}.OG', i * (GH or 3.0)) for i in range(1, NF)] + [('TRAUFE', TR), ('FIRST', F)]
pts = {}
for nm, z in levels:
    for cn, (x, y) in {'SW': (0, 0), 'SE': (W, 0), 'NE': (W, D), 'NW': (0, D)}.items(): pts[f'{nm}_{cn}'] = (x, y, z)
pts['FIRST_MID_W'] = (W / 2 - (W - D) / 2 if W > D else W / 2, D / 2, F); pts['FIRST_MID_E'] = (W / 2 + (W - D) / 2 if W > D else W / 2, D / 2, F)
for p in SL['teile']:
    if p['kat'] == 'ausschnitt':
        b = p['box']; pts[p['id']] = ((b[0] + b[3]) / 200.0, (b[1] + b[4]) / 200.0, (b[2] + b[5]) / 200.0)
    if p['kat'] == 'gelaende' and 'box' in p and 'Rasen' not in p['name']:
        b = p['box']; pts['G_' + p['id']] = ((b[0] + b[3]) / 200.0, (b[1] + b[4]) / 200.0, 0.0)
meta = {'W': W, 'D': D, 'F': F, 'TR': TR, 'NF': NF, 'GH': GH, 'levels': levels, 'res': [1024, 768], 'kameras': {}}
def project(cam):
    out = {}
    for k, (x, y, z) in pts.items():
        v = w2c(sc, cam, mathutils.Vector((x, y, z))); out[k] = [round(v.x * 1024, 1), round((1 - v.y) * 768, 1)]
    return out
for key, cam in (('front', front), ('rueck', rueck), ('iso', iso),
                 ('elev_sued', next(o for n, o in cams.items() if 'Ansicht Sued' in n)),
                 ('elev_nord', next(o for n, o in cams.items() if 'Ansicht Nord' in n))):
    elev = key.startswith('elev')
    for o in sc.objects:   # Elevationen: nur das Haus (Hecke/Beet/Einfahrt/Grenze ziehen sonst Linien durch den Sockel)
        n = o.name.lower()
        if any(k in n for k in ('hecke', 'beet', 'gartenweg', 'grundstuecksgrenze', 'einfahrt', 'weg zur', 'podest', 'terrasse nord', 'baum')): o.hide_render = elev or 'baum' in n and False
    sc.camera = cam; sc.render.filepath = os.path.join(OUTDIR, f'NEONLINES_{key}_{TAG}.png')
    bpy.ops.render.render(write_still=True); meta['kameras'][key] = project(cam); print('LINES', key, sc.render.filepath)
json.dump(meta, open(os.path.join(OUTDIR, f'NEONMETA_{TAG}.json'), 'w', encoding='utf-8'), indent=1)
print('META', os.path.join(OUTDIR, f'NEONMETA_{TAG}.json')); print('FERTIG')
