# -*- coding: utf-8 -*-
# BP3D-RUNDUM: Roentgen-Wireframe (Freestyle, sichtbare + verdeckte Kanten) aus dem fertigen Bauplan-Modell
# von allen Seiten. Gleicher Linien-Stil wie bauplan_neon_render.py (Cyan sichtbar / dunkelblau verdeckt),
# zusaetzliche Kameras: 4 Axonometrien (je Ecke), Vogelperspektive, Augenhoehe an der Strassenecke,
# Ansichten West und Ost, Draufsicht.
# Aufruf: blender -b <BAUPLAN.blend> --python bp3d_rundum.py -- <outdir> <tag> [samples]
import bpy, sys, os, math, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
OUTDIR = os.path.abspath(argv[0]); TAG = argv[1]; SAMPLES = int(argv[2]) if len(argv) > 2 else 8
os.makedirs(OUTDIR, exist_ok=True)
sc = bpy.context.scene

def _geraet():   # BAUPLAN_DEVICE=GPU (zu Hause, OptiX/CUDA) oder CPU (Standard, Cloud)
    if os.environ.get('BAUPLAN_DEVICE', 'CPU').upper() != 'GPU': return 'CPU'
    try:
        pr = bpy.context.preferences.addons['cycles'].preferences
        for t in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
            try: pr.compute_device_type = t; pr.get_devices(); break
            except Exception: pass
        for d in pr.devices: d.use = d.type != 'CPU'
        return 'GPU'
    except Exception as e: print('GPU nicht verfuegbar', e); return 'CPU'
for _o in list(bpy.data.objects):
    if _o.name.startswith('Echtbaum') or _o.name.startswith('Rasen Halme'):
        bpy.data.objects.remove(_o, do_unlink=True)
W = sc.get('bauplan_breite_cm', 1000) / 100.0; D = sc.get('bauplan_tiefe_cm', 800) / 100.0
F = sc.get('bauplan_first_cm', 900) / 100.0

# Welt dunkel, Flaechen schwarz -> nur Linien (wie Neon-Render der App)
w = bpy.data.worlds.new('Schwarz'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0, 0, 0, 1); sc.world = w
for o in sc.objects:
    if o.type == 'LIGHT': o.hide_render = True
for m in bpy.data.materials:
    if m.use_nodes and m.node_tree.nodes.get('Principled BSDF'):
        b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0, 0, 0, 1)
        b.inputs['Roughness'].default_value = 1.0; b.inputs['Metallic'].default_value = 0.0
        for k in ('Transmission Weight', 'Emission Strength'):
            if k in b.inputs: b.inputs[k].default_value = 0.0
for o in sc.objects:
    n = o.name.lower()
    if any(k in n for k in ('rasen', 'innenraum', 'echtbaum')): o.hide_render = True

sc.render.engine = 'CYCLES'; sc.cycles.samples = SAMPLES; sc.cycles.device = _geraet()
try: sc.cycles.use_denoising = False
except Exception: pass
sc.render.use_freestyle = True; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 1.0
vl = sc.view_layers[0]; vl.use_freestyle = True; fs = vl.freestyle_settings; fs.crease_angle = math.radians(120)
for ls in list(fs.linesets): fs.linesets.remove(ls)
def lineset(name, vis, thick):
    ls = fs.linesets.new(name)
    for a in ('select_silhouette', 'select_border', 'select_crease', 'select_contour', 'select_material_boundary', 'select_by_visibility'):
        setattr(ls, a, True)
    ls.visibility = vis; ls.linestyle.color = (1, 1, 1); ls.linestyle.thickness = thick
    return ls
# Graustufen: sichtbar weiss/dick, verdeckt grau/duenn -> Farbe kommt aus neon_glow (Cyan) bzw. Cyanotype-Einfaerbung
lineset('Sichtbar', 'VISIBLE', 2.0).linestyle.color = (1, 1, 1)
lineset('Verdeckt', 'HIDDEN', 0.9).linestyle.color = (0.42, 0.42, 0.42)
sc.render.resolution_x = 1600; sc.render.resolution_y = 1200; sc.render.resolution_percentage = 100
sc.render.film_transparent = False; sc.render.image_settings.file_format = 'PNG'
sc.view_settings.view_transform = 'Standard'; sc.view_settings.exposure = 0

ctr = mathutils.Vector((W / 2, D / 2, F * 0.45))
def cam(name, loc, ziel=ctr, ortho=None, lens=30):
    cd = bpy.data.cameras.new(name)
    if ortho: cd.type = 'ORTHO'; cd.ortho_scale = ortho
    else: cd.lens = lens; cd.sensor_width = 36
    cd.clip_end = 1000
    ob = bpy.data.objects.new(name, cd); sc.collection.objects.link(ob)
    ob.location = loc; ob.rotation_euler = (mathutils.Vector(ziel) - mathutils.Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob

R = max(W, D)
iso = R * 1.75
K = [
    ('iso_sw', 'Axonometrie Suedwest (Strassenecke)', cam('Iso SW', ctr + mathutils.Vector((-16, -16, 11)), ortho=iso)),
    ('iso_so', 'Axonometrie Suedost', cam('Iso SO', ctr + mathutils.Vector((16, -16, 11)), ortho=iso)),
    ('iso_no', 'Axonometrie Nordost (Rueckseite)', cam('Iso NO', ctr + mathutils.Vector((16, 16, 11)), ortho=iso)),
    ('iso_nw', 'Axonometrie Nordwest', cam('Iso NW', ctr + mathutils.Vector((-16, 16, 11)), ortho=iso)),
    ('vogel', 'Vogelperspektive', cam('Vogel', ctr + mathutils.Vector((-R * 1.1, -R * 1.5, R * 1.6)), lens=32)),
    ('ecke', 'Augenhoehe Strassenecke (wie Foto)', cam('Ecke', mathutils.Vector((-R * 0.55, -R * 0.75, 1.7)), ziel=(W * 0.35, D * 0.25, F * 0.55), lens=22)),
    ('elev_sued', 'Ansicht Sued (Hauptfassade)', cam('Ansicht S', (W / 2, -60, F / 2), ziel=(W / 2, 0, F / 2), ortho=R * 1.2)),
    ('elev_west', 'Ansicht West (Seitenfassade)', cam('Ansicht W', (-60, D / 2, F / 2), ziel=(0, D / 2, F / 2), ortho=R * 1.2)),
    ('elev_ost', 'Ansicht Ost', cam('Ansicht O', (W + 60, D / 2, F / 2), ziel=(W, D / 2, F / 2), ortho=R * 1.2)),
    ('elev_nord', 'Ansicht Nord (Rueckseite)', cam('Ansicht N', (W / 2, D + 60, F / 2), ziel=(W / 2, D, F / 2), ortho=R * 1.2)),
    ('drauf', 'Draufsicht (Dach + Roentgen)', cam('Drauf', (W / 2, D / 2, 80), ziel=(W / 2, D / 2 + 0.001, 0), ortho=max(W, D * 4 / 3) * 1.12)   # 4:3-Bild: Hoehe darf nicht abgeschnitten werden),
]
nur = [k for k in os.environ.get('BP3D_KAMERAS', '').split(',') if k]
for key, titel, c in K:
    if nur and key not in nur: continue
    elev = key.startswith('elev') or key == 'drauf'
    for o in sc.objects:   # Ansichten: nur das Haus (Hecke/Beet/Weg zoegen Linien durch den Sockel)
        n = o.name.lower()
        if any(k in n for k in ('hecke', 'beet', 'gartenweg', 'grundstuecksgrenze', 'einfahrt', 'weg zur', 'baum', 'strasse', 'gehweg')):
            o.hide_render = elev
    sc.camera = c; sc.render.filepath = os.path.join(OUTDIR, f'BP3D_{key}_{TAG}.png')
    bpy.ops.render.render(write_still=True); print('BP3D', key, titel, sc.render.filepath, flush=True)
print('FERTIG')
