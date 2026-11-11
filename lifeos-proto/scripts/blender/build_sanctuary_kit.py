"""
AETHERIA — First Sanctuary architecture kit (headless Blender, `pip install bpy==5.2.4`).

Builds modular ruin pieces procedurally and exports one GLB (no textures: the game applies its CC0
PBR stone; UVs are world-scaled cube projections so tiling matches the rest of the scene).

Pieces (metres, Y-up in the GLB, origin at the base centre):
  col_full      fluted column built from drums: base + 5 drums + capital (~6.4 m)
  col_broken_a  base + 3 drums, the top drum sheared off at an angle (~3.3 m)
  col_broken_b  base + 1.5 drums, jagged (~1.9 m)
  col_fallen    3 loose drums lying in a row (along +X), slightly scattered
  arch_gate     two piers with impost mouldings + a semicircular ring of 15 voussoirs and a
                protruding keystone; one voussoir slipped (ruin) — span 3.7 m, apex ~8 m
  lintel_block  an entablature block (architrave + frieze) 5.5 m long, for column pairs

Usage:  python build_sanctuary_kit.py <out.glb>
Gameplay colliders are NOT here: they stay in the scene code (layout contract).
"""
import math
import random
import sys

import bpy  # must come before bmesh
import bmesh  # noqa: E402

OUT = sys.argv[-1] if sys.argv[-1].endswith(".glb") else "sanctuary_kit.glb"
rnd = random.Random(11)
COL_R = 0.45  # matches the collider radius in the scene
UV_TILE = 1.5  # metres per texture repeat (same as worldBox/worldCylinder)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def new_obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def bevel(ob, width=0.025, segments=2):
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(35)
    m.harden_normals = True


def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def uv_world(ob):
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=UV_TILE, scale_to_bounds=False, correct_aspect=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    ob.select_set(False)


def fluted_ring(bm, y, r, flutes=20, depth=0.035, segs_per=4):
    """A ring of verts with concave flutes (Doric-like)."""
    n = flutes * segs_per
    verts = []
    for i in range(n):
        a = (i / n) * math.tau
        f = (i % segs_per) / segs_per
        rr = r - depth * math.sin(math.pi * f)
        verts.append(bm.verts.new((math.cos(a) * rr, y, math.sin(a) * rr)))
    return verts


def bridge(bm, a, b):
    n = len(a)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))


def cap(bm, ring, up):
    f = bm.faces.new(ring if up else list(reversed(ring)))
    return f


def drum(name, h, r0, r1, jag=0.0, tilt=0.0):
    """A fluted column drum from y=0 to y=h; entasis via r0->r1; optional jagged/tilted top."""
    bm = bmesh.new()
    rings = []
    steps = 3
    for s in range(steps + 1):
        t = s / steps
        rings.append(fluted_ring(bm, h * t, r0 + (r1 - r0) * t))
    for i in range(steps):
        bridge(bm, rings[i], rings[i + 1])
    cap(bm, rings[0], up=False)
    top = rings[-1]
    if jag or tilt:
        for v in top:
            a = math.atan2(v.co.z, v.co.x)
            v.co.y += math.sin(a) * tilt + (rnd.random() - 0.5) * jag
    cap(bm, top, up=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm)
    bevel(ob, 0.015, 1)
    return ob


def box(name, sx, sy, sz, loc=(0, 0, 0), rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
    ob = new_obj(name, bm)
    ob.location = loc
    ob.rotation_euler = rot
    bevel(ob, min(0.04, min(sx, sy, sz) * 0.08), 2)
    return ob


def ring_moulding(name, y, r_in, r_out, h):
    bm = bmesh.new()
    n = 48
    a = [bm.verts.new((math.cos(i / n * math.tau) * r_out, y, math.sin(i / n * math.tau) * r_out)) for i in range(n)]
    b = [bm.verts.new((math.cos(i / n * math.tau) * r_out, y + h, math.sin(i / n * math.tau) * r_out)) for i in range(n)]
    bridge(bm, a, b)
    cap(bm, a, up=False)
    cap(bm, b, up=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm)
    bevel(ob, 0.03, 2)
    return ob


def join(name, parts):
    for p in parts:
        apply_all(p)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    # bake everything: pieces are modelled around the origin, so the piece origin is its base centre
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    uv_world(ob)
    return ob


def column(name, n_drums, broken=None):
    parts = []
    # base: square plinth + torus-like ring
    parts.append(box(name + "_plinth", 1.25, 0.28, 1.25, loc=(0, 0.14, 0)))
    parts.append(ring_moulding(name + "_torus", 0.28, 0, COL_R + 0.12, 0.16))
    y = 0.44
    dh = 0.98
    for i in range(n_drums):
        last = i == n_drums - 1
        r0 = COL_R * (1 - 0.06 * (y / 6.0))
        r1 = COL_R * (1 - 0.06 * ((y + dh) / 6.0))
        jag = 0.0
        tilt = 0.0
        h = dh
        if last and broken == "sheared":
            tilt, jag, h = 0.28, 0.06, dh * 0.8
        if last and broken == "jagged":
            jag, h = 0.22, dh * 0.6
        d = drum(f"{name}_d{i}", h, r0, r1, jag, tilt)
        # drums sit slightly off-axis: centuries of settling
        d.location = ((rnd.random() - 0.5) * 0.03, y, (rnd.random() - 0.5) * 0.03)
        d.rotation_euler = (0, rnd.random() * 0.3, 0)
        parts.append(d)
        y += h + 0.006
    if broken is None:
        # Doric capital: echinus (flared ring) + abacus (square slab)
        parts.append(ring_moulding(name + "_neck", y, 0, COL_R * 0.98, 0.1))
        bm = bmesh.new()
        n = 48
        lo = [bm.verts.new((math.cos(i / n * math.tau) * COL_R * 0.95, y + 0.1, math.sin(i / n * math.tau) * COL_R * 0.95)) for i in range(n)]
        hi = [bm.verts.new((math.cos(i / n * math.tau) * (COL_R + 0.22), y + 0.36, math.sin(i / n * math.tau) * (COL_R + 0.22))) for i in range(n)]
        bridge(bm, lo, hi)
        cap(bm, lo, up=False)
        cap(bm, hi, up=True)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        parts.append(new_obj(name + "_echinus", bm))
        parts.append(box(name + "_abacus", 1.45, 0.22, 1.45, loc=(0, y + 0.47, 0)))
    return join(name, parts)


def fallen():
    parts = []
    x = 0.0
    for i in range(3):
        d = drum(f"fallen_d{i}", 0.98, COL_R, COL_R * 0.99, jag=0.05 if i == 2 else 0.0)
        # lie along +X
        d.rotation_euler = (0, rnd.random() * 0.6, math.pi / 2)
        d.location = (x + 0.98, COL_R, (rnd.random() - 0.5) * 0.25)
        parts.append(d)
        x += 1.05 + rnd.random() * 0.25
    return join("col_fallen", parts)


def arch_gate():
    parts = []
    span = 3.7  # clear span between piers (collider piers at x = ±2.4, 1.1 wide)
    pier_w, pier_d, pier_h = 1.3, 1.3, 4.3
    R_in = span / 2
    R_out = R_in + 0.9
    cx = span / 2 + pier_w / 2
    for sx in (-1, 1):
        parts.append(box(f"pier{sx}_base", pier_w + 0.3, 0.45, pier_d + 0.3, loc=(sx * cx, 0.225, 0)))
        # pier built from courses of blocks
        y = 0.45
        course = 0
        while y < pier_h - 0.05:
            h = 0.55 + rnd.random() * 0.12
            h = min(h, pier_h - y)
            off = (rnd.random() - 0.5) * 0.04
            parts.append(box(f"pier{sx}_c{course}", pier_w - 0.02, h - 0.01, pier_d - 0.02, loc=(sx * cx + off, y + h / 2, off)))
            y += h
            course += 1
        # impost moulding
        parts.append(box(f"pier{sx}_impost", pier_w + 0.24, 0.22, pier_d + 0.24, loc=(sx * cx, pier_h + 0.11, 0)))
    spring = pier_h + 0.22
    n = 15
    for i in range(n):
        a0 = math.pi * i / n
        a1 = math.pi * (i + 1) / n
        am = (a0 + a1) / 2
        key = i == n // 2
        ro = R_out + (0.25 if key else 0.0)
        # voussoir as a wedge: 8 corners
        bm = bmesh.new()
        dz = (pier_d - 0.1) / 2 + (0.08 if key else 0.0)
        g = 0.012  # mortar gap
        corners = []
        for (a, r) in ((a0 + g, R_in), (a1 - g, R_in), (a1 - g, ro), (a0 + g, ro)):
            corners.append((math.cos(a) * r, math.sin(a) * r))
        vs = [bm.verts.new((x, y + spring, -dz)) for x, y in corners] + [bm.verts.new((x, y + spring, dz)) for x, y in corners]
        bm.faces.new((vs[0], vs[1], vs[2], vs[3]))
        bm.faces.new((vs[7], vs[6], vs[5], vs[4]))
        for k in range(4):
            bm.faces.new((vs[k], vs[k + 4], vs[(k + 1) % 4 + 4], vs[(k + 1) % 4]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        v = new_obj(f"vous{i}", bm)
        bevel(v, 0.03, 2)
        if i == 3:
            # one stone has slipped: the ruin
            v.location = (math.cos(am) * 0.05, -0.16, 0.12)
            v.rotation_euler = (0.04, 0, -0.05)
        parts.append(v)
    # spandrel fill above the haunches, then a cornice
    top = spring + R_out
    for sx in (-1, 1):
        parts.append(box(f"spandrel{sx}", 1.25, R_out * 0.75, pier_d - 0.15, loc=(sx * (R_out - 0.35), spring + R_out * 0.42, 0)))
    parts.append(box("cornice", span + 2 * pier_w + 0.5, 0.42, pier_d + 0.2, loc=(0.4, top + 0.21, 0), rot=(0, 0, -0.035)))
    return join("arch_gate", parts)


def lintel():
    parts = [
        box("architrave", 5.5, 0.7, 1.0, loc=(0, 0.35, 0)),
        box("frieze", 5.4, 0.55, 0.92, loc=(0, 0.98, 0)),
        box("cornice_l", 5.6, 0.18, 1.12, loc=(0, 1.34, 0)),
    ]
    return join("lintel_block", parts)



# ---------------------------------------------------------------- the observatory (visual only)
OBS_R_IN, OBS_R_OUT = 7.25, 8.05  # wallR 7.65 ± wallT/2 (layout contract)
SEG_DEG = 10.0


def curved_block(name, a0, a1, r0, r1, y0, y1, sub=3):
    """A masonry block on the ring: bearings a0..a1 (rad, 0 = -Z, clockwise), radii r0..r1."""
    bm = bmesh.new()
    def P(a, r, y):
        return bm.verts.new((math.sin(a) * r, y, -math.cos(a) * r))
    rows = []
    for i in range(sub + 1):
        a = a0 + (a1 - a0) * i / sub
        rows.append((P(a, r0, y0), P(a, r1, y0), P(a, r1, y1), P(a, r0, y1)))
    for i in range(sub):
        A, B = rows[i], rows[i + 1]
        for k in range(4):
            bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]))
    bm.faces.new(rows[0])
    bm.faces.new(tuple(reversed(rows[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_obj(name, bm)
    bevel(ob, 0.018, 1)
    return ob


def wall_segment(name, target_h, jag):
    """One 10-degree segment of the observatory wall in ashlar courses. Bearing 0 at the centre."""
    parts = []
    half = math.radians(SEG_DEG / 2 + 0.15)  # tiny overlap: no gaps between neighbours
    g = 0.006  # mortar joint
    # plinth course, stepping out
    parts.append(curved_block(f"{name}_plinth", -half, half, OBS_R_IN, OBS_R_OUT + 0.16, 0, 0.5, sub=4))
    y = 0.5
    top = 0.5  # top of the highest block actually placed
    course = 0
    while y < target_h + 0.4:
        h = 0.48 + rnd.random() * 0.14
        n = 2 if course % 2 == 0 else 3
        cuts = sorted([-half] + [(-half + 2 * half * (k + rnd.uniform(0.35, 0.65)) / n) for k in range(n - 1)] + [half])
        for b in range(len(cuts) - 1):
            mid = (cuts[b] + cuts[b + 1]) / 2
            # the ruined top: each block survives up to a jagged line
            limit = target_h + (math.sin(mid * 9 + course) * 0.5 + rnd.uniform(-0.5, 0.5)) * jag
            if y + h > limit:
                continue
            bulge = rnd.uniform(-0.012, 0.03)
            parts.append(curved_block(f"{name}_c{course}_{b}", cuts[b] + g / OBS_R_OUT, cuts[b + 1] - g / OBS_R_OUT, OBS_R_IN, OBS_R_OUT + bulge, y + g, y + h - g, sub=2))
            top = max(top, y + h)
        y += h
        course += 1
        # string course on the outside, around the gallery's height
        if 3.9 <= y <= 4.6 and target_h > 4.5 and not any(p_.name.startswith(f"{name}_string") for p_ in parts):
            parts.append(curved_block(f"{name}_string", -half, half, OBS_R_OUT - 0.1, OBS_R_OUT + 0.1, y, y + 0.18, sub=4))
            y += 0.18
            top = max(top, y)
    if jag == 0:
        parts.append(curved_block(f"{name}_cornice", -half, half, OBS_R_IN - 0.05, OBS_R_OUT + 0.18, top, top + 0.26, sub=4))
    return join(name, parts)


def buttress():
    """Stepped buttress against the outer wall; its outward direction is -Z, wall face at z ~ +0.4."""
    parts = [
        box("bt_low", 0.95, 3.2, 1.3, loc=(0, 1.6, 0)),
        box("bt_high", 0.78, 2.1, 0.8, loc=(0, 3.2 + 1.05, 0.25)),
    ]
    # sloped weathering caps (wedges falling outward)
    for nm, w, d, y, z in (("bt_cap_low", 0.98, 1.3, 3.2, 0.0), ("bt_cap_high", 0.8, 0.8, 5.3, 0.25)):
        bm = bmesh.new()
        hw, hd = w / 2, d / 2
        v = [bm.verts.new(c) for c in (
            (-hw, y, z - hd), (hw, y, z - hd), (hw, y, z + hd), (-hw, y, z + hd),
            (-hw, y + 0.05, z - hd), (hw, y + 0.05, z - hd), (hw, y + 0.45, z + hd), (-hw, y + 0.45, z + hd))]
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            bm.faces.new([v[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = new_obj(nm, bm)
        bevel(o, 0.02, 1)
        parts.append(o)
    return join("obs_buttress", parts)


def corbel():
    """Stepped stone bracket under the gallery, growing out of the inner wall face (toward +Z here)."""
    parts = [
        box("cb_1", 0.42, 0.28, 0.45, loc=(0, -0.14, 0.22)),
        box("cb_2", 0.42, 0.28, 0.85, loc=(0, -0.42 + 0.0, 0.42)),
        box("cb_3", 0.42, 0.3, 1.25, loc=(0, -0.72, 0.62)),
    ]
    # flip so the biggest step is on top (closest to the slab)
    for p_ in parts:
        p_.location.y = -p_.location.y - 0.86
    return join("obs_corbel", parts)



def dome_petal():
    """
    One of the 10 dome petals as a masonry shell: courses of curved blocks on a sphere (radius
    7.7 = wallR + 0.05, 0.28 thick) with raised ribs on both edges. Centred on bearing 0 (-Z), and
    translated so its rim point (0, 0, -R) is the origin: the game hinges it there to open it.
    """
    R, T = 7.7, 0.28
    half = math.radians(36 * 0.94 / 2)
    parts = []
    g = 0.008

    def shell_block(name, a0, a1, t0, t1, r0, r1, sub=3):
        bm = bmesh.new()
        def P(a, th, r):
            return bm.verts.new((math.sin(a) * math.sin(th) * r, math.cos(th) * r, -math.cos(a) * math.sin(th) * r))
        grid = []
        for i in range(sub + 1):
            a = a0 + (a1 - a0) * i / sub
            grid.append([(P(a, t0, r0), P(a, t0, r1), P(a, t1, r1), P(a, t1, r0))])
        for i in range(sub):
            A, B = grid[i][0], grid[i + 1][0]
            for k in range(4):
                bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]))
        bm.faces.new(grid[0][0])
        bm.faces.new(tuple(reversed(grid[-1][0])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = new_obj(name, bm)
        bevel(o, 0.015, 1)
        return o

    courses = 10
    for c in range(courses):
        t1 = math.pi / 2 * (1 - c / courses)          # lower edge (toward the rim)
        t0 = math.pi / 2 * (1 - (c + 1) / courses)    # upper edge (toward the crown)
        width = 2 * half * R * math.sin((t0 + t1) / 2)
        n = max(1, round(width / 1.3))
        off = rnd.uniform(0.3, 0.7) if c % 2 else 0.5
        cuts = [-half] + [(-half + 2 * half * (k + off) / n) for k in range(n - 1)] + [half] if n > 1 else [-half, half]
        cuts = sorted(cuts)
        for b in range(len(cuts) - 1):
            # the crown is broken: upper courses lose stones
            if c >= courses - 3 and rnd.random() < 0.35 + 0.15 * (c - (courses - 3)):
                continue
            parts.append(shell_block(f"pt_c{c}_{b}", cuts[b] + g / R, cuts[b + 1] - g / R, t0 + g / R, t1 - g / R, R - T, R + rnd.uniform(-0.01, 0.02), sub=2))
    # ribs along both edges, from the rim up to just below the crown
    for side in (-1, 1):
        a = side * half
        parts.append(shell_block(f"rib{side}", a - 0.012, a + 0.012, math.pi / 2 * 0.12, math.pi / 2, R - T - 0.05, R + 0.14, sub=1))
    ob = join("dome_petal", parts)
    # hinge: rim point (0, 0, -R) -> origin
    for v in ob.data.vertices:
        v.co.z += R
    return ob


def main():
    reset()
    objs = [
        column("col_full", 5),
        column("col_broken_a", 3, broken="sheared"),
        column("col_broken_b", 2, broken="jagged"),
        fallen(),
        arch_gate(),
        lintel(),
        wall_segment("wall_full", 7.5, 0.0),
        wall_segment("wall_low", 6.3, 1.4),
        wall_segment("wall_breach", 2.7, 1.2),
        buttress(),
        corbel(),
        dome_petal(),
    ]
    for o in objs:
        o.location = (0, 0, 0)
    # glTF is Y-up; we modelled with Y up already, so export without axis conversion
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=False, export_apply=True, export_materials="NONE", export_normals=True, export_texcoords=True)
    for o in objs:
        me = o.data
        me.calc_loop_triangles()
        print(f"{o.name}: {len(me.loop_triangles)} tris, height {o.dimensions.y:.2f} m")


main()
