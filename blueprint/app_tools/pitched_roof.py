"""CPU-only roof meshes, in cm. Gable ridge runs north/south (front gable).

Roof orientation and slope are inferred unless supplied by the house description.
The Blender builder consumes these ordinary closed mesh parts without special cases.
"""
import math


def extrude_section(section, v0, v1, swap=False):
    """Extrude a counterclockwise (u,z) polygon along v, with outward faces."""
    n = len(section)
    verts = [[u, v, z] for v in (v0, v1) for u, z in section]
    faces = [list(range(n)), list(range(n, 2 * n))[::-1]]
    faces += [[i, i + n, (i + 1) % n + n, (i + 1) % n] for i in range(n)]
    if swap:
        verts = [[y, x, z] for x, y, z in verts]
        faces = [face[::-1] for face in faces]
    return {'verts': verts, 'faces': faces}


def pitched_parts(width, depth, eaves, overhang, angle, kind, wall=34, spacing=80, ridge='y'):
    if kind not in ('sattel', 'pult'):
        raise ValueError('Unsupported pitched roof: ' + kind)
    if not (0 < angle < 75) or min(width, depth, wall, spacing) <= 0 or overhang < 0:
        raise ValueError('Invalid roof dimensions or pitch')
    # Pult slopes up towards north; gable orientation can be supplied explicitly.
    swap = kind == 'pult' or ridge == 'x'
    span, length = (depth, width) if swap else (width, depth)
    slope = math.tan(math.radians(angle))
    height = lambda u: eaves + slope * (u if kind == 'pult' else min(u, span - u))
    edges = [-overhang, span + overhang] if kind == 'pult' else [-overhang, span / 2, span + overhang]
    peak = height(span if kind == 'pult' else span / 2)
    parts = []

    def add(category, name, section, v0, v1, material, **extra):
        parts.append(dict(kat=category, name=name, mesh=extrude_section(section, v0, v1, swap), material=material, **extra))

    # Separate roof slabs leave the attic empty and the masonry gables visible.
    for i, (a, b) in enumerate(zip(edges, edges[1:]), 1):
        add('dach', f'{kind.title()}dach Flaeche {i}',
            [(a, height(a)), (b, height(b)), (b, height(b) + 12), (a, height(a) + 12)],
            -overhang, length + overhang, 'dach', first_cm=round(peak + 12))
    section = [(0, eaves), (span, eaves), (span, height(span))] if kind == 'pult' else [(0, eaves), (span, eaves), (span / 2, peak)]
    for label, v0, v1 in [('Anfang', 0, wall), ('Ende', length - wall, length)]:
        add('wand', f'{kind.title()}dach Giebel {label}', section, v0, v1, 'putz')
    if kind == 'pult':
        add('wand', 'Pultdach hohe Wand', [(span - wall, eaves), (span, eaves), (span, peak), (span - wall, height(span - wall))], 0, length, 'putz')
    count = max(1, math.ceil(length / spacing))
    for k in range(count + 1):
        v = k * length / count
        for i, (a, b) in enumerate(zip(edges, edges[1:]), 1):
            add('dachstuhl', f'Sparren {k + 1}-{i}',
                [(a, height(a) - 16), (b, height(b) - 16), (b, height(b)), (a, height(a))],
                v - 5, v + 5, 'holz')
    return parts
