# OG ToneDa, built from the turnaround (front | side | back | three-quarter).
# usage: python3 -I build_og.py <turnaround.png> <out.glb> <debug_dir> [masks]
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from PIL import Image
from artmodel import *

src, out, dbg = sys.argv[1], sys.argv[2], sys.argv[3]
img = load_rgb(src)
AXF, AXB, GROUND, TOP = 207, 865, 884, 182
HEIGHT_UNITS = 3.75
S = HEIGHT_UNITS / (GROUND - TOP)
Y = lambda row: GROUND - row
fg = foreground(img, keep_white_boxes=[(166, 350, 248, 394)])      # his white collar
red, grey = is_red(img), is_grey(img)
Hh, Ss, Vv = hsv(img)
skin = (Hh > 15) & (Hh < 33) & (Ss > 0.5) & (Vv > 0.3)
gold_loose = (Hh >= 33) & (Hh <= 62) & (Ss > 0.5) & (Vv > 0.3)
rows_all = np.arange(img.shape[0])[:, None] * np.ones((1, img.shape[1]), int)
P = lambda pts: poly_mask(img.shape, pts)
FW = 400                                                           # width of the front view strip

# ---------------- front view parts ----------------
HEAD = P([(55, 170), (335, 170), (335, 340), (264, 354), (150, 354), (128, 352), (113, 372), (106, 430), (66, 430), (55, 300)]) & fg
EAR_POLY = P([(256, 266), (298, 272), (298, 286), (268, 310), (256, 314)])
EAR = EAR_POLY & HEAD
HEAD = largest(HEAD & ~EAR_POLY)
TORSO_POLY = P([(150, 354), (264, 354), (308, 372), (311, 402), (269, 403), (269, 527), (328, 527), (334, 613), (257, 613), (255, 578),
                (140, 578), (140, 545), (146, 540), (146, 403), (101, 403), (103, 372), (128, 352)])
TORSO = TORSO_POLY & fg
SHOULDER = P([(100, 368), (150, 352), (150, 404), (100, 404)]) & TORSO
LEGR_POLY = P([(108, 543), (207, 543), (207, 888), (68, 888), (68, 760), (95, 700), (108, 640)])
LEGR_KEEP = P([(112, 543), (207, 543), (207, 600), (196, 655), (120, 655)])
LEGR = close_holes(largest(LEGR_POLY & fg & ((rows_all >= 766) | grey | LEGR_KEEP)), 3)
LEGL_POLY = P([(207, 543), (300, 543), (330, 640), (348, 760), (348, 888), (207, 888)])
LEGL_KEEP = P([(207, 543), (300, 543), (322, 616), (255, 616), (250, 600), (207, 600)])
LEGL = close_holes(largest(LEGL_POLY & fg & ((rows_all >= 766) | grey | LEGL_KEEP)), 3)
LEGL_VALID = LEGL & ((rows_all >= 766) | grey | P([(207, 543), (252, 543), (252, 600), (207, 600)]))
ARM_POLY = P([(98, 401), (147, 401), (147, 428), (126, 448), (100, 500), (92, 542), (72, 548), (68, 614), (6, 614), (6, 540), (40, 478), (82, 418)])
ARMF = close_holes(largest(ARM_POLY & fg & ~red), 2)

# ---------------- side view (he faces image-right) ----------------
SIDE_CX = 563
side_fg = fg & P([(400, 170), (662, 170), (662, 890), (400, 890)])
SIDE_HEAD = side_fg & (rows_all < 352)
# The side of the head is textured from this view. The lens of his shades is painted out of it
# first: the shades are already on the front of the head, and a second lens round the side shows
# up as a ghost whenever he is seen at an angle. The arm of the shades, over his ear, stays.
side_img = paint_out(img, P([(593, 254), (626, 254), (626, 297), (593, 297)]), skin)
# The ear and its ring come off too: the ear is a piece of its own, and a painted one beside it reads as two.
side_img = paint_out(side_img, P([(512, 272), (540, 272), (562, 280), (562, 312), (560, 332), (536, 332), (534, 308), (520, 290)]))
SIDE_HEAD_IN = erode(SIDE_HEAD, 2)                                 # in from the outline, where the art fades into the white page
SIDE_LEGS = side_fg & (rows_all > 660) & P([(512, 660), (640, 660), (640, 890), (512, 890)]) & ~((red | gold_loose) & (rows_all < 790))

# ---------------- back view parts ----------------
HEADB_VALID = fg & (rows_all < 352) & P([(740, 170), (992, 170), (992, 352), (740, 352)]) & ~skin
HAIR_POLY = P([(784, 346), (947, 346), (950, 434), (780, 434)])
HAIR_LONG = HAIR_POLY | P([(788, 318), (944, 318), (947, 350), (784, 350)])
HAIRB = HAIR_LONG & fg & ~skin
CAPE_POLY = P([(748, 358), (982, 358), (986, 420), (1032, 775), (1032, 792), (698, 792), (698, 775), (744, 420)])
cape_col = CAPE_POLY & fg & (red | gold_loose)
CAPE = close_holes(largest(close_holes(cape_col | (HAIR_POLY & CAPE_POLY), 5)), 3)
CAPE_VALID = cape_col & ~HAIR_POLY
ARMB_POLY = P([(946, 408), (988, 408), (1066, 520), (1064, 614), (1000, 614), (992, 546), (950, 474)])
ARMB = close_holes(largest(ARMB_POLY & fg & ~red), 2)
LEGRB = largest(P([(865, 769), (1002, 769), (1002, 888), (865, 888)]) & fg & ~((red | gold_loose) & (rows_all < 790)))
LEGLB = largest(P([(722, 769), (865, 769), (865, 888), (722, 888)]) & fg & ~((red | gold_loose) & (rows_all < 790)))

def overlay(parts, x0, x1, name):
    view = img[:, x0:x1].astype(np.float32)
    for mask, col in parts:
        m = mask[:, x0:x1]
        view[m] = view[m] * 0.45 + np.array(col, np.float32) * 0.55
        view[m & ~erode(m, 1)] = col
    Image.fromarray(view.astype(np.uint8)).resize(((x1 - x0) * 2, img.shape[0] * 2), Image.LANCZOS).crop((0, 300, (x1 - x0) * 2, 1800)).save(f'{dbg}/{name}.png')
overlay([(HEAD, (0, 200, 255)), (EAR, (255, 255, 255)), (TORSO, (0, 255, 0)), (SHOULDER, (255, 128, 0)), (LEGR, (255, 255, 0)), (LEGL, (255, 0, 255)), (ARMF, (0, 0, 255))], 0, FW, 'og_parts_front')
overlay([(HEADB_VALID, (0, 200, 255)), (CAPE, (0, 255, 0)), (HAIRB, (255, 255, 255)), (ARMB, (0, 0, 255)), (LEGRB, (255, 255, 0)), (LEGLB, (255, 0, 255))], 670, 1075, 'og_parts_back')
if len(sys.argv) > 4 and sys.argv[4] == 'masks':
    sys.exit(0)

# ---------------- build ----------------
b = Builder({'atlas_width': 1536}, debug=dbg)
M = 12

def crop(mask, *arrays, margin=M):
    x0, y0, x1, y1 = bbox(mask)
    x0, y0 = max(0, x0 - margin), max(0, y0 - margin)
    x1, y1 = min(mask.shape[1], x1 + margin), min(mask.shape[0], y1 + margin)
    return (x0, y0), [a[y0:y1, x0:x1] for a in (mask,) + arrays]

def back_in_front(mask_or_img, interp=cv2.INTER_LINEAR, fbox=None, bbx=None):
    size = (FW, img.shape[0])
    if fbox is None:
        fbox, bbx = (AXF - 200, 0, AXF + 200, 1000), (AXB - 200, 0, AXB + 200, 1000)
    return warp_back_to_front(mask_or_img, fbox, bbx, size, interp=interp)

front = img[:, :FW]
SIDE = lambda valid: {'img': img, 'valid': valid, 'cx': SIDE_CX, 'dir': -1}

hb_img, hb_valid = back_in_front(img), back_in_front(HEADB_VALID, cv2.INTER_NEAREST)
(o, (m, f_rgb, b_rgb, b_val)) = crop(HEAD[:, :FW], front, hb_img, hb_valid)
b.solid('head', m, f_rgb, m, b_rgb, b_val, o, axis=AXF, ground=GROUND, step=5, R=58, Tf=52, Tb=68, c=1.3, z0=-6,
        weights=lambda x, y: [{'head': 1.0}] * len(x), fallback='front',
        side={'img': side_img, 'valid': SIDE_HEAD_IN, 'cx': SIDE_CX, 'dir': -1, 'n0': 0.6, 'n1': 0.8}, side_faces=0.7)

(o, (m, f_rgb)) = crop(EAR[:, :FW], front)
b.solid('earL', m, f_rgb, m, None, None, o, axis=AXF, ground=GROUND, step=3, R=8, Tf=6, Tb=6, c=0.9, z0=-8,
        weights=lambda x, y: [{'head': 1.0}] * len(x), fallback='front', mirror_as='earR', sweep=(49, 1.0))

(o, (m, f_rgb, mv)) = crop(TORSO[:, :FW], front, (grey | (rows_all < 541))[:, :FW])
b.solid('torso', m, f_rgb, m, None, None, o, axis=AXF, ground=GROUND, step=5, R=40, Tf=44, Tb=38, c=1.2, z0=0,
        weights=lambda x, y: chain(y, [('chest',), ('spine', Y(455), 15), ('hips', Y(530), 15)]), fallback='rowmedian', median_valid=mv)

(o, (m, f_rgb)) = crop(SHOULDER[:, :FW], front)
b.solid('shoulderR', m, f_rgb, m, None, None, o, axis=AXF, ground=GROUND, step=4, R=22, Tf=36, Tb=36, c=2.4, z0=0,
        weights=lambda x, y: [{'chest': 1.0}] * len(x), fallback='front', mirror_as='shoulderL')

def leg(name, mask, valid, back_mask, side):
    fb = bbox(mask & (rows_all >= 800)); bb = bbox(back_mask & (rows_all >= 800))
    fbox, bbx = (fb[0], 0, fb[2], 1000), (bb[0], 0, bb[2], 1000)
    bi = back_in_front(img, fbox=fbox, bbx=bbx)
    bv = back_in_front(back_mask, cv2.INTER_NEAREST, fbox=fbox, bbx=bbx)
    (o, (m, f_rgb, f_val, b_rgb, b_val)) = crop(mask[:, :FW], front, valid[:, :FW], bi, bv)
    toe = lambda rows: 46 + np.clip((rows - 762) / 34.0, 0, 1) * 16
    heel = lambda rows: 44 - np.clip((rows - 762) / 34.0, 0, 1) * 4
    b.solid(name, m, f_rgb, f_val, b_rgb, b_val, o, axis=AXF, ground=GROUND, step=5, R=40, Tf=toe, Tb=heel, c=2.0, cb=1.3, z0=0,
            weights=lambda x, y: chain(y, [('hips',), ('leg' + side, Y(592), 9), ('shin' + side, Y(690), 13), ('foot' + side, Y(803), 9)]),
            fallback='frontblur', side=SIDE(SIDE_LEGS))
leg('legR', LEGR, LEGR, LEGRB, 'R')
leg('legL', LEGL, LEGL_VALID, LEGLB, 'L')

def principal_angle(mask):
    ys, xs = np.where(mask)
    vx, vy, _, _ = cv2.fitLine(np.stack([xs, ys], 1).astype(np.float32), cv2.DIST_L2, 0, 0.01, 0.01).ravel()
    if vy < 0: vx, vy = -vx, -vy
    return float(np.degrees(np.arctan2(vx, vy)))
PF, PB = (124, 406), (966, 410)
af, ab = principal_angle(ARMF), principal_angle(ARMB)
armf_m, armf_img = rotate_about(ARMF, PF, -af, cv2.INTER_NEAREST), rotate_about(img, PF, -af)
armb_m, armb_img = rotate_about(ARMB, PB, -ab, cv2.INTER_NEAREST), rotate_about(img, PB, -ab)
armf_m[:393] = False; armb_m[:395] = False
fb, bb = bbox(armf_m), bbox(armb_m)
bi = back_in_front(armb_img, fbox=fb, bbx=bb)
bv = back_in_front(armb_m, cv2.INTER_NEAREST, fbox=fb, bbx=bb)
top = (rows_all[:, :FW] < 420)
dark_f = top & (cv2.cvtColor(armf_img[:, :FW], cv2.COLOR_RGB2HSV)[..., 2] < 120)
dark_b = top & (cv2.cvtColor(bi, cv2.COLOR_RGB2HSV)[..., 2] < 120)
(o, (m, f_rgb, f_val, b_rgb, b_val)) = crop(armf_m[:, :FW], armf_img[:, :FW], armf_m[:, :FW] & ~dark_f, bi, bv & ~dark_b)
arm_cx = (fb[0] + fb[2]) / 2.0
ARM_X = 84
ELBOW, WRIST, TIP = 492, 572, fb[3]
print('arm angles front/back', round(af, 1), round(ab, 1), 'bbox', fb, 'elbow/wrist/tip rows', ELBOW, WRIST, TIP)
b.solid('armR', m, f_rgb, f_val, b_rgb, b_val, o, axis=AXF, ground=GROUND, step=4, R=25, Tf=35, Tb=35, c=1.0, z0=0,
        x_shift=(AXF - ARM_X) - arm_cx,
        weights=lambda x, y: chain(y, [('armR',), ('foreR', Y(ELBOW), 12), ('handR', Y(WRIST), 7)]),
        fallback='front', mirror_as='armL')

(o, (m, rgb)) = crop(HAIRB, img)
mf, rgbf = m[:, ::-1], rgb[:, ::-1]
ax = -(AXB - o[0] - m.shape[1] + 1)
b.solid('hairback', mf, rgbf, mf, rgbf, mf, (0, o[1]), axis=ax, ground=GROUND, step=4, R=13, Tf=8, Tb=8, c=0.8,
        z0=lambda rows: -70 + np.clip((rows - 318) / 116.0, 0, 1) * 12,
        weights=lambda x, y: chain(y, [('head',), ('dread1', Y(356), 9), ('dread2', Y(396), 9)]), fallback='front')

(o, (m, rgb, val)) = crop(CAPE, img, CAPE_VALID)
half = np.zeros(img.shape[0])
for r in range(img.shape[0]):
    xs = np.where(CAPE[r])[0]
    if len(xs): half[r] = max(abs(xs.min() - AXB), abs(xs.max() - AXB))
half = np.maximum(ndi.gaussian_filter1d(half, 4), 1)
def cape_z(X, rows):
    r = np.clip(rows, 0, img.shape[0] - 1).astype(int)
    u = np.clip(np.abs(X) / half[r], 0, 1.1)
    zc = 52 + np.clip((rows - 392) / 390.0, 0, 1) * 46
    return -(zc - 32 * u * u) + np.clip(392 - rows, 0, 36) * 0.6
b.sheet('cape', m, rgb, val, o, axis=AXB, ground=GROUND, step=6, zfun=cape_z, mirrored_view=True,
        weights=lambda x, y: chain(y, [('chest',), ('cape1', Y(440), 24), ('cape2', Y(560), 28), ('cape3', Y(680), 28)]))

bones = [('root', None, (0, 0, 0)), ('hips', 'root', (0, Y(580), 0)), ('spine', 'hips', (0, Y(530), 0)),
         ('chest', 'spine', (0, Y(455), 0)), ('neck', 'chest', (0, Y(364), 0)), ('head', 'neck', (0, Y(352), 0)),
         ('cap1', 'head', (0, Y(210), -60)), ('cap2', 'cap1', (0, Y(260), -95)),
         ('dread1', 'head', (0, Y(352), -70)), ('dread2', 'dread1', (0, Y(392), -66)),
         ('cape1', 'chest', (0, Y(425), -55)), ('cape2', 'cape1', (0, Y(545), -75)), ('cape3', 'cape2', (0, Y(665), -92))]
for n, sg in (('L', 1), ('R', -1)):
    bones += [('arm' + n, 'chest', (sg * ARM_X, Y(406), 0)), ('fore' + n, 'arm' + n, (sg * ARM_X, Y(ELBOW), 0)),
              ('hand' + n, 'fore' + n, (sg * ARM_X, Y(WRIST), 0)),
              ('leg' + n, 'hips', (sg * 56, Y(592), 0)), ('shin' + n, 'leg' + n, (sg * 56, Y(690), 0)),
              ('foot' + n, 'shin' + n, (sg * 56, Y(803), 0))]
bones = [(n, p, tuple(float(v) * S for v in xyz)) for n, p, xyz in bones]

atlas = b.atlas.image()
pos = np.concatenate(b.pos) * S
uv = np.concatenate(b.uvpx) / np.array([atlas.shape[1], atlas.shape[0]], np.float64)
tris = np.concatenate(b.tris)
spec = {'og': True, 'height': HEIGHT_UNITS, 'stride': 1.4, 'hips': Y(580) * S, 'armX': ARM_X * S, 'armRadius': 23 * S,
        'elbow': Y(ELBOW) * S, 'wrist': Y(WRIST) * S, 'hand': Y(TIP - 6) * S, 'hipsHalfWidth': 70 * S, 'shieldScale': 1.25}
jpg = write_glb(out, pos, uv, tris, b.wts, bones, atlas, {'name': 'og-toneda', 'spec': spec})
Image.fromarray(atlas).save(f'{dbg}/og_atlas.png')
print('total verts', len(pos), 'tris', len(tris), 'atlas', atlas.shape[1], 'x', atlas.shape[0], 'jpeg bytes', jpg)
