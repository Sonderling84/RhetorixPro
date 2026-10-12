# -*- coding: utf-8 -*-
# NACHT-RENDER ("Neon dunkel" nach Tobis Vorlage): dunkle massive Fassaden, leuchtend blaue Fenster,
# feine Cyan-Kanten (nur sichtbare Kanten), nachtblaue Welt. Aus dem fertigen BAUPLAN_<tag>.blend.
# Aufruf: blender -b <BAUPLAN.blend> --python nacht_render.py -- <outdir> <tag> [samples]   (Kameras per NACHT_KAMERAS)
import bpy, sys, os, math, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
OUTDIR = os.path.abspath(argv[0]); TAG = argv[1]; SAMPLES = int(argv[2]) if len(argv) > 2 else 48
sc = bpy.context.scene
for o in list(bpy.data.objects):
    if o.name.startswith('Echtbaum') or o.name.startswith('Rasen Halme'): bpy.data.objects.remove(o, do_unlink=True)
W = sc.get('bauplan_breite_cm', 1000) / 100.0; D = sc.get('bauplan_tiefe_cm', 800) / 100.0; F = sc.get('bauplan_first_cm', 900) / 100.0

def mat(name, col, rough=0.7, emis=None, strength=0.0, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emis:
        b.inputs['Emission Color'].default_value = (*emis, 1); b.inputs['Emission Strength'].default_value = strength
    return m
M_WAND = mat('Nacht Fassade', (0.03, 0.036, 0.05), 0.8)
# dunkles Klinkermuster (Weltkoordinaten: x+y entlang der Wand, z hoch) -> wie die Ziegelwand in der Vorlage
_nt = M_WAND.node_tree; _b = _nt.nodes['Principled BSDF']
_tc = _nt.nodes.new('ShaderNodeTexCoord'); _sp = _nt.nodes.new('ShaderNodeSeparateXYZ'); _ad = _nt.nodes.new('ShaderNodeMath'); _ad.operation = 'ADD'
_cb = _nt.nodes.new('ShaderNodeCombineXYZ'); _br = _nt.nodes.new('ShaderNodeTexBrick')
_br.inputs['Scale'].default_value = 1.0; _br.inputs['Brick Width'].default_value = 0.25; _br.inputs['Row Height'].default_value = 0.075
_br.inputs['Mortar Size'].default_value = 0.008; _br.inputs['Color1'].default_value = (0.026, 0.031, 0.045, 1)
_br.inputs['Color2'].default_value = (0.034, 0.04, 0.058, 1); _br.inputs['Mortar'].default_value = (0.07, 0.085, 0.12, 1)
_nt.links.new(_tc.outputs['Object'], _sp.inputs[0]); _nt.links.new(_sp.outputs['X'], _ad.inputs[0]); _nt.links.new(_sp.outputs['Y'], _ad.inputs[1])
_nt.links.new(_ad.outputs[0], _cb.inputs['X']); _nt.links.new(_sp.outputs['Z'], _cb.inputs['Y'])
_nt.links.new(_cb.outputs[0], _br.inputs['Vector']); _nt.links.new(_br.outputs['Color'], _b.inputs['Base Color'])
M_GLAS = mat('Nacht Glas', (0.05, 0.15, 0.5), 0.15, emis=(0.08, 0.32, 1.0), strength=0.9)
_g = M_GLAS.node_tree; _bs = _g.nodes['Principled BSDF']; _out = _g.nodes['Material Output']
_tr = _g.nodes.new('ShaderNodeBsdfTransparent'); _mx = _g.nodes.new('ShaderNodeMixShader'); _mx.inputs[0].default_value = 0.45
_g.links.new(_bs.outputs[0], _mx.inputs[1]); _g.links.new(_tr.outputs[0], _mx.inputs[2]); _g.links.new(_mx.outputs[0], _out.inputs['Surface'])
M_RAHM = mat('Nacht Rahmen', (0.03, 0.05, 0.09), 0.4, metal=0.6)
M_BODEN = mat('Nacht Pflaster', (0.13, 0.15, 0.19), 0.8)
M_INNEN = mat('Nacht Innen', (0.02, 0.05, 0.16), 0.9, emis=(0.03, 0.12, 0.55), strength=0.35)
M_DECKE = mat('Nacht Decke', (0.03, 0.06, 0.14), 0.6, emis=(0.1, 0.35, 1.0), strength=0.8)
for o in sc.objects:
    if o.type != 'MESH': continue
    n = o.name.lower()
    m = (M_GLAS if 'glas' in n else M_RAHM if any(k in n for k in ('rahmen', 'tuer', 'gelaender', 'handlauf', 'pfosten', 'stab')) else
         M_BODEN if any(k in n for k in ('gelaende', 'rasen', 'grundstueck', 'strasse', 'gehweg', 'weg', 'terrasse', 'einfahrt', 'garten', 'beet', 'hecke', 'zufahrt', 'bord', 'platz', 'pflaster', 'stellplatz')) else
         M_INNEN if 'innen' in n else M_DECKE if ('decke' in n and 'kellersohle' not in n) else M_WAND)
    o.data.materials.clear(); o.data.materials.append(m)
    if any(k in n for k in ('baum', 'hecke', 'beet')): o.hide_render = True
    if m is M_BODEN:   # Boden ohne Freestyle-Linien (nur das Haus bekommt Cyan-Kanten)
        if 'ohne_linien' not in bpy.data.collections:
            bpy.data.collections.new('ohne_linien'); sc.collection.children.link(bpy.data.collections['ohne_linien'])
        bpy.data.collections['ohne_linien'].objects.link(o)

for o in sc.objects:   # Keller liegt unter dem Gelaende -> nicht zeigen
    if 'keller' in o.name.lower(): o.hide_render = True
# heller Platz um das Haus (wie in der Vorlage), ohne Linien
bpy.ops.mesh.primitive_plane_add(size=1, location=(W / 2, D / 2, -0.02))
_pl = bpy.context.active_object; _pl.name = 'Platz Boden'; _pl.scale = (W + 14, D + 14, 1)
_pl.data.materials.append(M_BODEN)
if 'ohne_linien' not in bpy.data.collections:
    bpy.data.collections.new('ohne_linien'); sc.collection.children.link(bpy.data.collections['ohne_linien'])
bpy.data.collections['ohne_linien'].objects.link(_pl)
w = bpy.data.worlds.new('Nacht'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.004, 0.007, 0.018, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sc.world = w
for o in sc.objects:
    if o.type == 'LIGHT': o.hide_render = True
def licht(name, loc, energy, col, size=6):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.color = col; ld.size = size
    ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (mathutils.Vector((W / 2, D / 2, 2)) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
licht('Mond', (-W, -D * 1.5, F * 2.2), 2500, (0.55, 0.7, 1.0), 10)
licht('Kante', (W * 1.8, D * 1.8, F * 1.2), 1200, (0.3, 0.55, 1.0), 8)

sc.render.engine = 'CYCLES'; sc.cycles.samples = SAMPLES; sc.cycles.device = 'CPU'; sc.cycles.transparent_max_bounces = 16
try: sc.cycles.use_denoising = True
except Exception: pass
sc.render.use_freestyle = True; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 1.0
vl = sc.view_layers[0]; vl.use_freestyle = True; fs = vl.freestyle_settings; fs.crease_angle = math.radians(120)
for ls in list(fs.linesets): fs.linesets.remove(ls)
ls = fs.linesets.new('Cyan')
for a in ('select_silhouette', 'select_border', 'select_crease', 'select_by_visibility'): setattr(ls, a, True)
if 'ohne_linien' in bpy.data.collections:
    ls.select_by_collection = True; ls.collection = bpy.data.collections['ohne_linien']; ls.collection_negation = 'EXCLUSIVE'
ls.visibility = 'VISIBLE'; ls.linestyle.color = (0.12, 0.62, 1.0); ls.linestyle.thickness = 0.9
lh = fs.linesets.new('Roentgen')
for a in ('select_silhouette', 'select_border', 'select_crease', 'select_by_visibility'): setattr(lh, a, True)
if 'ohne_linien' in bpy.data.collections:
    lh.select_by_collection = True; lh.collection = bpy.data.collections['ohne_linien']; lh.collection_negation = 'EXCLUSIVE'
lh.visibility = 'HIDDEN'; lh.linestyle.color = (0.04, 0.26, 0.7); lh.linestyle.thickness = 0.6
sc.render.resolution_x = 1200; sc.render.resolution_y = 900; sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'Standard'

ctr = mathutils.Vector((W / 2, D / 2, F * 0.45)); R = max(W, D)
def cam(name, loc, ziel=ctr, ortho=None, lens=30):
    cd = bpy.data.cameras.new(name)
    if ortho: cd.type = 'ORTHO'; cd.ortho_scale = ortho
    else: cd.lens = lens; cd.sensor_width = 36
    cd.clip_end = 1000; ob = bpy.data.objects.new(name, cd); sc.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (mathutils.Vector(ziel) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); return ob
K = {
    'ecke': cam('Ecke', mathutils.Vector((-R * 0.55, -R * 0.75, 1.7)), ziel=(W * 0.35, D * 0.25, F * 0.55), lens=22),
    'iso_sw': cam('Iso SW', ctr + mathutils.Vector((-16, -16, 11)), ortho=R * 1.55),
    'vogel': cam('Vogel', ctr + mathutils.Vector((-R * 1.0, -R * 1.35, R * 1.3)), lens=32),
    'iso_no': cam('Iso NO', ctr + mathutils.Vector((16, 16, 11)), ortho=R * 1.55),
}
nur = [k for k in os.environ.get('NACHT_KAMERAS', '').split(',') if k] or list(K)
for k in nur:
    sc.camera = K[k]; sc.render.filepath = os.path.join(OUTDIR, f'NACHT_{k}_{TAG}.png')
    bpy.ops.render.render(write_still=True); print('NACHT', k, sc.render.filepath, flush=True)
print('FERTIG')
