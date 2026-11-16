# Builds a rigged, textured character model directly from approved turnaround art.
#
# The art is cut into body parts. Each part becomes a rounded solid whose outline is
# the part's outline in the front view; the front of the solid is textured with the
# front view and the back with the back view. The cape is a separate curved sheet
# taken from the back view. Every vertex is weighted to the game's skeleton, and
# the result is written as a standard .glb.
#
# usage: python3 -I artmodel.py <config.py> <out.glb> [--debug dir]
import json, math, struct, sys, io
import numpy as np
import cv2
from scipy import ndimage as ndi
from PIL import Image


# ----------------------------------------------------------------- image helpers
def load_rgb(path):
    return np.asarray(Image.open(path).convert('RGB')).copy()


def foreground(img, keep_white_boxes=()):
    """True where the character is. Background = near-white reachable from the border,
    plus enclosed near-white pockets (between hair and neck), except inside the given
    boxes (eye whites)."""
    white = img.min(axis=2) > 236
    lab, n = ndi.label(white)
    border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])
    bg = np.isin(lab, [b for b in border if b])
    pockets = white & ~bg
    keep = np.zeros_like(white)
    for (x0, y0, x1, y1) in keep_white_boxes:
        keep[y0:y1, x0:x1] = True
    bg |= pockets & ~keep
    return ~bg


def poly_mask(shape, pts):
    m = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m.astype(bool)


def hsv(img):
    h = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)
    return h[..., 0] * 2.0, h[..., 1] / 255.0, h[..., 2] / 255.0   # hue 0-360, sat, val


def is_red(img):
    H, S, V = hsv(img)
    return ((H < 14) | (H > 338)) & (S > 0.5) & (V > 0.12)


def is_gold(img):
    H, S, V = hsv(img)
    return (H >= 34) & (H <= 60) & (S > 0.55) & (V > 0.55)


def is_grey(img, smax=0.36):
    H, S, V = hsv(img)
    return (S < smax) | (V < 0.16)


def bleed(rgb, valid, blur=0):
    """Fill every invalid pixel with the nearest valid colour."""
    if not valid.any():
        return rgb.copy()
    idx = ndi.distance_transform_edt(~valid, return_distances=False, return_indices=True)
    out = rgb[idx[0], idx[1]]
    if blur:
        soft = cv2.GaussianBlur(out, (0, 0), blur)
        out = np.where(valid[..., None], out, soft)
    return out


def erode(mask, r):
    if r <= 0:
        return mask
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    return cv2.erode(mask.astype(np.uint8), k).astype(bool)


def dilate(mask, r):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    return cv2.dilate(mask.astype(np.uint8), k).astype(bool)


def close_holes(mask, r=0):
    m = mask
    if r:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
        m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, k).astype(bool)
    return ndi.binary_fill_holes(m)


def largest(mask):
    lab, n = ndi.label(mask)
    if n <= 1:
        return mask
    sizes = ndi.sum(mask, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


def rotate_about(img, pivot, deg, interp=cv2.INTER_LINEAR):
    M = cv2.getRotationMatrix2D((float(pivot[0]), float(pivot[1])), deg, 1.0)
    src = img.astype(np.uint8) if img.dtype == bool else img
    out = cv2.warpAffine(src, M, (img.shape[1], img.shape[0]), flags=interp, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return out.astype(bool) if img.dtype == bool else out


def bbox(mask):
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def warp_back_to_front(back_img, front_box, back_box, size, mirror=True, interp=cv2.INTER_LINEAR):
    """Resample a back-view image into the front view's pixel frame so that back_box lands on
    front_box. The back view is mirrored: its right is the front view's left."""
    fx0, fy0, fx1, fy1 = front_box
    bx0, by0, bx1, by1 = back_box
    sx = (bx1 - bx0) / float(fx1 - fx0)
    sy = (by1 - by0) / float(fy1 - fy0)
    if mirror:
        M = np.array([[-sx, 0, bx1 + sx * fx0], [0, sy, by0 - sy * fy0]], np.float32)
    else:
        M = np.array([[sx, 0, bx0 - sx * fx0], [0, sy, by0 - sy * fy0]], np.float32)
    src = back_img.astype(np.uint8) if back_img.dtype == bool else back_img
    out = cv2.warpAffine(src, M, size, flags=interp | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    return out.astype(bool) if back_img.dtype == bool else out


# ----------------------------------------------------------------- meshing
def triangulate(mask, step):
    """Marching squares over a grid. Returns (points[N,2] in pixel coords, tris[M,3], is_edge[N]).
    Edge vertices sit on the outline, so the silhouette is smooth, not stair-stepped."""
    h, w = mask.shape
    d_in = ndi.distance_transform_edt(mask)
    d_out = ndi.distance_transform_edt(~mask)
    sd = np.where(mask, d_in - 0.5, -(d_out - 0.5))
    nx, ny = int(math.ceil(w / step)) + 2, int(math.ceil(h / step)) + 2
    gx = (np.arange(nx) - 0.5) * step
    gy = (np.arange(ny) - 0.5) * step
    def sample(x, y):
        xi, yi = int(round(x)), int(round(y))
        if xi < 0 or yi < 0 or xi >= w or yi >= h:
            return -step
        return sd[yi, xi]
    phi = np.array([[sample(gx[i], gy[j]) for i in range(nx)] for j in range(ny)])
    pts, edge, index = [], [], {}
    def vert(key, x, y, on_edge):
        if key not in index:
            index[key] = len(pts); pts.append((x, y)); edge.append(on_edge)
        return index[key]
    tris = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            corners = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            vals = [phi[c[1], c[0]] for c in corners]
            if max(vals) <= 0:
                continue
            poly = []
            for k in range(4):
                a, b = corners[k], corners[(k + 1) % 4]
                va, vb = vals[k], vals[(k + 1) % 4]
                if va > 0:
                    poly.append(vert(('n', a), gx[a[0]], gy[a[1]], False))
                if (va > 0) != (vb > 0):
                    t = va / (va - vb)
                    key = ('e', min(a, b), max(a, b))
                    poly.append(vert(key, gx[a[0]] + (gx[b[0]] - gx[a[0]]) * t, gy[a[1]] + (gy[b[1]] - gy[a[1]]) * t, True))
            for k in range(1, len(poly) - 1):
                if len({poly[0], poly[k], poly[k + 1]}) == 3:
                    tris.append((poly[0], poly[k], poly[k + 1]))
    return np.array(pts, np.float64), np.array(tris, np.int64), np.array(edge, bool), d_in


def bilinear(field, pts):
    h, w = field.shape
    x = np.clip(pts[:, 0], 0, w - 1.001); y = np.clip(pts[:, 1], 0, h - 1.001)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = x - x0; fy = y - y0
    return (field[y0, x0] * (1 - fx) * (1 - fy) + field[y0, x0 + 1] * fx * (1 - fy)
            + field[y0 + 1, x0] * (1 - fx) * fy + field[y0 + 1, x0 + 1] * fx * fy)


def depth_field(mask, R, T_rows, c):
    """Half-thickness for every pixel of a part. Wide areas get rounded edges of radius R and a
    flat top of height T (per row); thin features (ears, fingers) get a round cross-section
    scaled by c. Returns (thickness image, local half-width image)."""
    d_in = ndi.distance_transform_edt(mask).astype(np.float32)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * int(R) + 1, 2 * int(R) + 1))
    width = cv2.dilate(d_in, k)
    width = cv2.GaussianBlur(width, (0, 0), max(2.0, R / 8.0))
    wv = np.maximum(width, 1.0)
    rho = np.minimum(R, wv)
    u = np.clip((d_in - 0.5) / rho, 0, 1)
    profile = np.sqrt(np.clip(1 - (1 - u) ** 2, 0, 1))
    return (np.minimum(T_rows[:, None], c * wv) * profile).astype(np.float32), width


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def bake_side(tile, mask, h_img, width, z_img, R, side):
    """Where a part's surface faces sideways, the front/back art is stretched thin. Replace
    it there with colours from the side view, looked up by depth and height."""
    gx = cv2.Sobel(h_img, cv2.CV_32F, 1, 0, ksize=3) / 8.0
    gy = cv2.Sobel(h_img, cv2.CV_32F, 0, 1, ksize=3) / 8.0
    nx = np.abs(gx) / np.sqrt(1 + gx * gx + gy * gy)
    ws = smoothstep(side.get('n0', 0.5), side.get('n1', 0.85), nx) * smoothstep(0.45 * R, 0.85 * R, width) * mask
    rows = side['row0'] + np.arange(tile.shape[0], dtype=np.float32)[:, None] * np.ones((1, tile.shape[1]), np.float32)
    xs = (side['cx'] - side.get('dir', 1) * z_img).astype(np.float32)   # dir=1: he faces image-left in the side view
    rgb = cv2.remap(side['img'], xs, rows, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    ok = cv2.remap(side['valid'].astype(np.uint8) * 255, xs, rows, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0) > 220
    ws = cv2.GaussianBlur((ws * ok).astype(np.float32), (0, 0), 2.0)[..., None]
    return (tile.astype(np.float32) * (1 - ws) + rgb.astype(np.float32) * ws).astype(np.uint8)


class Atlas:
    def __init__(self, width):
        self.width = width; self.tiles = []; self.x = 0; self.y = 0; self.row_h = 0
    def add(self, rgb):
        h, w = rgb.shape[:2]
        if self.x + w > self.width:
            self.x = 0; self.y += self.row_h; self.row_h = 0
        pos = (self.x, self.y)
        self.tiles.append((pos, rgb))
        self.x += w; self.row_h = max(self.row_h, h)
        return pos
    def image(self):
        height = self.y + self.row_h
        height = int(math.ceil(height / 4.0) * 4)
        out = np.zeros((height, self.width, 3), np.uint8)
        for (x, y), rgb in self.tiles:
            out[y:y + rgb.shape[0], x:x + rgb.shape[1]] = rgb
        return out


class Builder:
    """Collects geometry in model space (x: his left, y: up, z: forward), in pixels of the art."""
    def __init__(self, cfg, debug=None):
        self.cfg = cfg; self.debug = debug
        self.atlas = Atlas(cfg.get('atlas_width', 2048))
        self.pos, self.uvpx, self.tris, self.wts = [], [], [], []
        self.count = 0
        self.report = []

    def add_mesh(self, name, xyz, uvpx, tris, weights):
        base = self.count
        self.pos.append(xyz); self.uvpx.append(uvpx); self.wts.extend(weights)
        self.tris.append(tris + base)
        self.count += len(xyz)
        self.report.append((name, len(xyz), len(tris)))

    def solid(self, name, mask, front_rgb, front_valid, back_rgb, back_valid, origin, *, axis, ground,
              step, R, Tf, Tb, c=1.0, cb=None, z0=0.0, weights, fallback='front', mirror_as=None, pad=14,
              x_shift=0.0, median_valid=None, side=None):
        """mask/images are crops whose top-left is `origin` in front-view pixels.
        Tf/Tb/z0 may be numbers or functions of the pixel row (front-view y)."""
        h, w = mask.shape
        crop_rows = origin[1] + np.arange(h, dtype=np.float64)
        per_row = lambda v: (np.asarray(v(crop_rows), np.float32) if callable(v) else np.full(h, float(v), np.float32))
        hf_img, width = depth_field(mask, R, per_row(Tf), c)
        hb_img, _ = depth_field(mask, R, per_row(Tb), cb if cb is not None else c)
        z0_rows = per_row(z0)

        fv = erode(front_valid & mask, 2)
        front_tile = bleed(front_rgb, fv, blur=1.2)
        if back_rgb is None:
            bv = np.zeros_like(mask)
        else:
            bv = erode(back_valid & mask, 2)
        if fallback == 'front':
            base = front_tile
        elif fallback == 'rowmedian':
            base = front_tile.copy()
            mv = fv if median_valid is None else (fv & median_valid)
            last = None
            for y in range(h):
                row = front_rgb[y][mv[y]]
                if len(row) >= 6:
                    last = np.median(row, axis=0)
                if last is not None:
                    base[y, :] = last
            base = cv2.GaussianBlur(base, (0, 0), 3)
        elif fallback == 'frontblur':           # same tones as the front, with the detail smoothed away
            base = cv2.GaussianBlur(bleed(front_tile, mask), (0, 0), 9)
        else:                                   # 'inpaint': grow the valid back colours
            base = bleed(back_rgb, bv, blur=2.0) if bv.any() else front_tile
        back_tile = np.where(bv[..., None], back_rgb, base) if back_rgb is not None else base
        if back_rgb is not None and bv.any():   # soften the join between back art and fallback
            soft = cv2.GaussianBlur(back_tile, (0, 0), 1.5)
            rim = dilate(bv, 3) & ~erode(bv, 3)
            back_tile = np.where(rim[..., None], soft, back_tile)
            back_tile = np.where((~mask)[..., None], bleed(back_tile, mask), back_tile)
        if side is not None:
            sd = dict(side, row0=origin[1])
            front_tile = bake_side(front_tile, mask, hf_img, width, z0_rows[:, None] + hf_img, R, sd)
            back_tile = bake_side(back_tile, mask, hb_img, width, z0_rows[:, None] - hb_img, R, sd)
            front_tile = np.where(mask[..., None], front_tile, bleed(front_tile, mask))
            back_tile = np.where(mask[..., None], back_tile, bleed(back_tile, mask))
        fpos = self.atlas.add(cv2.copyMakeBorder(front_tile, pad, pad, pad, pad, cv2.BORDER_REPLICATE))
        bpos = self.atlas.add(cv2.copyMakeBorder(back_tile, pad, pad, pad, pad, cv2.BORDER_REPLICATE))
        if self.debug:
            Image.fromarray(np.hstack([front_tile, back_tile])).save(f'{self.debug}/tile_{name}.png')

        pts, tris, is_edge, _ = triangulate(mask, step)
        rows = pts[:, 1] + origin[1]
        hf = np.where(is_edge, 0.0, bilinear(hf_img, pts))
        hb = np.where(is_edge, 0.0, bilinear(hb_img, pts))
        zc = np.interp(pts[:, 1], np.arange(h), z0_rows)
        X = pts[:, 0] + origin[0] - axis + x_shift
        Y = ground - rows
        # make front triangles face +z
        a, b, cc = pts[tris[:, 0]], pts[tris[:, 1]], pts[tris[:, 2]]
        cross = (b[:, 0] - a[:, 0]) * -(cc[:, 1] - a[:, 1]) - -(b[:, 1] - a[:, 1]) * (cc[:, 0] - a[:, 0])
        ftris = np.where(cross[:, None] > 0, tris, tris[:, ::-1])
        for sign in ([1] if mirror_as is None else [1, -1]):
            nm = name if sign == 1 else mirror_as
            wfun = weights if sign == 1 else (lambda x, y, f=weights: [swap_lr(d) for d in f(-x, y)])
            Xs = X * sign
            wl = wfun(Xs, Y)
            front = np.stack([Xs, Y, zc + hf], 1); back = np.stack([Xs, Y, zc - hb], 1)
            fuv = pts + np.array(fpos) + pad; buv = pts + np.array(bpos) + pad
            ft = ftris if sign == 1 else ftris[:, ::-1]
            self.add_mesh(nm + '_front', front, fuv, ft, wl)
            self.add_mesh(nm + '_back', back, buv, ft[:, ::-1], wl)

    def sheet(self, name, mask, rgb, valid, origin, *, axis, ground, step, zfun, weights, mirrored_view, pad=14):
        """A single curved surface (the cape). zfun(x_model_px, row) -> z."""
        tile = bleed(rgb, erode(valid & mask, 2), blur=1.5)
        pos = self.atlas.add(cv2.copyMakeBorder(tile, pad, pad, pad, pad, cv2.BORDER_REPLICATE))
        if self.debug:
            Image.fromarray(tile).save(f'{self.debug}/tile_{name}.png')
        pts, tris, is_edge, d_in = triangulate(mask, step)
        rows = pts[:, 1] + origin[1]
        px = pts[:, 0] + origin[0]
        X = (axis - px) if mirrored_view else (px - axis)
        Y = ground - rows
        Z = zfun(X, rows)
        self.add_mesh(name, np.stack([X, Y, Z], 1), pts + np.array(pos) + pad, tris, weights(X, Y))


def swap_lr(d):
    out = {}
    for k, v in d.items():
        k2 = k[:-1] + 'R' if k.endswith('L') else (k[:-1] + 'L' if k.endswith('R') else k)
        out[k2] = v
    return out


def ramp(y, y0, y1):
    """0 below y0, 1 above y1 (model units, y up)."""
    return np.clip((y - y0) / (y1 - y0), 0, 1)


def chain(y, stops):
    """Blend down a list of (bone, height) from top to bottom: returns per-vertex dicts.
    stops = [(bone_top, None), (bone_next, y_joint, blend_half_width), ...]"""
    out = [dict() for _ in range(len(y))]
    names = [s[0] for s in stops]
    w = np.zeros((len(stops), len(y)))
    w[0] = 1.0
    for i in range(1, len(stops)):
        _, yj, half = stops[i]
        t = 1 - ramp(y, yj - half, yj + half)      # 1 below the joint
        w[i] = w[i - 1] * t
        w[i - 1] = w[i - 1] * (1 - t)
    for i, nm in enumerate(names):
        for v in np.nonzero(w[i] > 1e-4)[0]:
            out[v][nm] = out[v].get(nm, 0) + float(w[i][v])
    return out


# ----------------------------------------------------------------- glb writer
def write_glb(path, pos, uv, tris, weights, bones, atlas_rgb, extras, jpeg_quality=88):
    names = [b[0] for b in bones]
    world = {b[0]: np.array(b[2], np.float64) for b in bones}
    idx = {n: i for i, n in enumerate(names)}
    joints = np.zeros((len(pos), 4), np.uint8); wts = np.zeros((len(pos), 4), np.float32)
    for v, d in enumerate(weights):
        items = sorted(d.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(w for _, w in items) or 1.0
        for k, (b, w) in enumerate(items):
            joints[v, k] = idx[b]; wts[v, k] = w / tot
    ibm = np.zeros((len(bones), 16), np.float32)
    for i, n in enumerate(names):
        m = np.eye(4, dtype=np.float32); m[:3, 3] = -world[n]
        ibm[i] = m.T.reshape(16)                 # column-major
    buf = io.BytesIO(); views = []; accessors = []
    def view(data, target=None):
        while buf.tell() % 4: buf.write(b'\x00')
        v = {'buffer': 0, 'byteOffset': buf.tell(), 'byteLength': len(data)}
        if target: v['target'] = target
        buf.write(data); views.append(v); return len(views) - 1
    def acc(arr, ctype, atype, target=None, minmax=False, normalized=False):
        a = {'bufferView': view(arr.tobytes(), target), 'componentType': ctype, 'count': int(arr.shape[0]), 'type': atype}
        if minmax: a['min'] = [float(x) for x in arr.min(axis=0)]; a['max'] = [float(x) for x in arr.max(axis=0)]
        if normalized: a['normalized'] = True
        accessors.append(a); return len(accessors) - 1
    # Compact storage: the model is unlit, so it carries no normals; texture coordinates and
    # weights are stored as normalised integers.
    P = acc(pos.astype(np.float32), 5126, 'VEC3', 34962, True)
    U = acc(np.round(np.clip(uv, 0, 1) * 65535).astype(np.uint16), 5123, 'VEC2', 34962, normalized=True)
    J = acc(joints, 5121, 'VEC4', 34962)
    W = acc(np.round(wts * 255).astype(np.uint8), 5121, 'VEC4', 34962, normalized=True)
    if len(pos) < 65536:
        I = acc(tris.astype(np.uint16).reshape(-1), 5123, 'SCALAR', 34963)
    else:
        I = acc(tris.astype(np.uint32).reshape(-1), 5125, 'SCALAR', 34963)
    B = acc(ibm, 5126, 'MAT4')
    jpg = io.BytesIO(); Image.fromarray(atlas_rgb).save(jpg, 'JPEG', quality=jpeg_quality, subsampling=0)
    img_view = view(jpg.getvalue())
    nodes = []
    for n, parent, p in bones:
        local = np.array(p, np.float64) - (world[parent] if parent else 0)
        nodes.append({'name': n, 'translation': [float(x) for x in local]})
    for i, (n, parent, p) in enumerate(bones):
        if parent:
            nodes[idx[parent]].setdefault('children', []).append(i)
    mesh_node = len(nodes)
    nodes.append({'name': extras.get('name', 'character') + '_mesh', 'mesh': 0, 'skin': 0})
    gltf = {
        'asset': {'version': '2.0', 'generator': 'legend-of-toneda artmodel.py'},
        'extensionsUsed': ['KHR_materials_unlit'],
        'scene': 0,
        'scenes': [{'name': extras.get('name', 'character'), 'nodes': [0, mesh_node], 'extras': extras}],
        'nodes': nodes,
        'meshes': [{'name': 'body', 'primitives': [{'attributes': {'POSITION': P, 'TEXCOORD_0': U, 'JOINTS_0': J, 'WEIGHTS_0': W},
                                                    'indices': I, 'material': 0}]}],
        'skins': [{'joints': list(range(len(bones))), 'skeleton': 0, 'inverseBindMatrices': B}],
        'materials': [{'name': 'art', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1},
                       'extensions': {'KHR_materials_unlit': {}}}],
        'textures': [{'sampler': 0, 'source': 0}],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': img_view, 'mimeType': 'image/jpeg'}],
        'accessors': accessors, 'bufferViews': views,
        'buffers': [{'byteLength': 0}],
    }
    while buf.tell() % 4: buf.write(b'\x00')
    bin_data = buf.getvalue()
    gltf['buffers'][0]['byteLength'] = len(bin_data)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(bin_data)))
        f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
        f.write(struct.pack('<I4s', len(bin_data), b'BIN\x00')); f.write(bin_data)
    return len(jpg.getvalue())
