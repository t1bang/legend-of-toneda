# YN ToneDa, built from the approved turnaround (front | side | back).
# usage: python3 -I build_yn.py <turnaround.png> <out.glb> <debug_dir>
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from PIL import Image
from artmodel import *

src, out, dbg = sys.argv[1], sys.argv[2], sys.argv[3]
img = load_rgb(src)
AXF, AXB, GROUND = 438, 1789, 998        # body centre line in the front and back views, and the floor row
HEIGHT_UNITS = 2.9
S = HEIGHT_UNITS / (GROUND - 15)         # model units per art pixel
Y = lambda row: GROUND - row             # art row -> height above the floor, in pixels
fg = foreground(img, keep_white_boxes=[(372, 162, 508, 232)])
red, gold, grey = is_red(img), is_gold(img), is_grey(img)
Hh, Ss, Vv = hsv(img)
skin = (Hh > 15) & (Hh < 37) & (Ss > 0.5) & (Vv > 0.3)
rows_all = np.arange(img.shape[0])[:, None] * np.ones((1, img.shape[1]), int)
P = lambda pts: poly_mask(img.shape, pts)

# ---------------- front view parts ----------------
HEAD = P([(200, 0), (660, 0), (660, 300), (552, 300), (520, 302), (512, 280), (470, 280), (470, 284), (400, 284), (400, 280),
          (360, 283), (356, 300), (322, 302), (300, 300), (268, 318), (268, 362), (200, 362)]) & fg
# his left ear sticks out past the outline; cut it off the head and build it as its own thin piece
EAR_POLY = P([(551, 184), (600, 178), (602, 190), (563, 233), (551, 237)])
EAR = EAR_POLY & HEAD
HEAD = largest(HEAD & ~EAR_POLY)
TORSO_POLY = P([(400, 284), (470, 284), (470, 280), (512, 280), (520, 302), (552, 304), (572, 314), (600, 360), (596, 369),
                (524, 370), (524, 520), (528, 526), (617, 530), (617, 654), (482, 654), (478, 628), (300, 628), (300, 600),
                (318, 560), (343, 552), (343, 522), (347, 440), (351, 370), (278, 369), (264, 350), (270, 336), (300, 318),
                (330, 306), (356, 300), (360, 283), (400, 280)])
TORSO = TORSO_POLY & fg
LEGR_POLY = P([(255, 556), (360, 556), (362, 598), (438, 598), (438, 1002), (240, 1002), (240, 770), (262, 700)])
LEGR_KEEP = P([(355, 598), (438, 598), (438, 640), (355, 640)])
LEGR = close_holes(largest(LEGR_POLY & fg & ((rows_all >= 838) | grey | LEGR_KEEP)), 3)
LEGL_POLY = P([(438, 598), (626, 598), (645, 700), (645, 1002), (438, 1002)])
LEGL_KEEP = P([(478, 598), (600, 598), (604, 656), (480, 656)])
LEGL = close_holes(largest(LEGL_POLY & fg & ((rows_all >= 838) | grey | LEGL_KEEP)), 3)
LEGL_VALID = LEGL & ((rows_all >= 838) | grey)          # the satchel hides part of this thigh; repaint it as trousers
ARM_POLY = P([(262, 366), (349, 366), (352, 400), (318, 470), (262, 545), (215, 610), (200, 645), (80, 645), (80, 560),
              (110, 480), (180, 405)])
ARMF = close_holes(largest(ARM_POLY & fg & ~red), 2)

SHOULDER = P([(262, 334), (300, 316), (352, 298), (352, 371), (277, 371), (262, 352)]) & TORSO

# ---------------- side view (he faces image-left): used where surfaces face sideways ----------------
SIDE_CX = 1075                                           # image column of his centre plane
side_fg = fg & P([(920, 0), (1345, 0), (1345, 1010), (920, 1010)])
SIDE_HEAD = side_fg & (rows_all < 300)
SIDE_LEGS = side_fg & (rows_all > 655) & P([(925, 655), (1172, 655), (1172, 1010), (925, 1010)]) & ~((red | (Hh >= 34) & (Ss > 0.6) & (Vv > 0.5)) & (rows_all < 800))

# ---------------- back view parts ----------------
HEADB_VALID = fg & (rows_all < 292) & P([(1560, 0), (2010, 0), (2010, 292), (1560, 292)]) & ~skin
HAIR_POLY = P([(1672, 286), (1905, 286), (1900, 345), (1822, 345), (1800, 364), (1772, 364), (1750, 345), (1678, 345)])
HAIR_LONG = HAIR_POLY | P([(1676, 250), (1902, 250), (1905, 290), (1672, 290)])
HAIRB = HAIR_LONG & fg & ~gold & ~skin
CAPE_POLY = P([(1600, 296), (1980, 296), (1985, 400), (2062, 740), (2052, 800), (1538, 800), (1543, 740), (1640, 400)])
gold_loose = (Hh >= 32) & (Hh <= 60) & (Ss > 0.5) & (Vv > 0.3)
cape_col = CAPE_POLY & fg & (red | gold_loose)
CAPE = cape_col | (HAIR_POLY & CAPE_POLY)
# the shield hides the mantle's left tip in the back view: copy the right tip across
cape_img = img.copy()
ys, xs = np.where(P([(1560, 296), (1662, 296), (1662, 405), (1560, 405)]))
CAPE[ys, xs] = CAPE[ys, 2 * AXB - xs]
cape_col[ys, xs] = cape_col[ys, 2 * AXB - xs]
cape_img[ys, xs] = img[ys, 2 * AXB - xs]
CAPE = close_holes(largest(close_holes(CAPE, 7)), 4)       # bridge the dark seam lines between cloth and trim
CAPE_VALID = cape_col & ~HAIR_POLY
ARMB_POLY = P([(1938, 366), (1992, 366), (2060, 440), (2135, 545), (2130, 655), (2015, 655), (2005, 560), (1938, 450)])
ARMB = close_holes(largest(ARMB_POLY & fg & ~red), 2)
LEGRB = P([(1789, 770), (1990, 770), (1990, 1002), (1789, 1002)]) & fg & ~((red | gold) & (rows_all < 797))
LEGLB = P([(1585, 770), (1789, 770), (1789, 1002), (1585, 1002)]) & fg & ~((red | gold) & (rows_all < 797))
LEGRB, LEGLB = largest(LEGRB), largest(LEGLB)

# ---------------- debug overlay ----------------
def overlay(parts, x0, x1, name):
    view = img[:, x0:x1].astype(np.float32) * 0.45 + 255 * 0.55 * 0
    view = img[:, x0:x1].astype(np.float32)
    for mask, col in parts:
        m = mask[:, x0:x1]
        view[m] = view[m] * 0.45 + np.array(col, np.float32) * 0.55
        edge = m & ~erode(m, 1)
        view[edge] = col
    Image.fromarray(view.astype(np.uint8)).save(f'{dbg}/{name}.png')
overlay([(HEAD, (0, 200, 255)), (EAR, (255, 255, 255)), (SHOULDER, (255, 128, 0)), (TORSO, (0, 255, 0)), (LEGR, (255, 255, 0)), (LEGL, (255, 0, 255)), (ARMF, (0, 0, 255))], 80, 745, 'parts_front')
overlay([(HEADB_VALID, (0, 200, 255)), (CAPE, (0, 255, 0)), (HAIRB, (255, 255, 255)), (ARMB, (0, 0, 255)), (LEGRB, (255, 255, 0)), (LEGLB, (255, 0, 255))], 1470, 2150, 'parts_back')
if len(sys.argv) > 4 and sys.argv[4] == 'masks':
    sys.exit(0)

# ---------------- build ----------------
b = Builder({'atlas_width': 2048}, debug=dbg)
M = 16                                                   # margin around each crop

def crop(mask, *arrays, margin=M):
    x0, y0, x1, y1 = bbox(mask)
    x0, y0 = max(0, x0 - margin), max(0, y0 - margin)
    x1, y1 = min(mask.shape[1], x1 + margin), min(mask.shape[0], y1 + margin)
    return (x0, y0), [a[y0:y1, x0:x1] for a in (mask,) + arrays]

def back_in_front(mask_or_img, interp=cv2.INTER_LINEAR, fbox=None, bbx=None):
    """Mirror the back view into the front view's frame (centre lines aligned), or box to box."""
    size = (800, img.shape[0])
    if fbox is None:
        fbox, bbx = (AXF - 400, 0, AXF + 400, 1000), (AXB - 400, 0, AXB + 400, 1000)
    return warp_back_to_front(mask_or_img, fbox, bbx, size, interp=interp)

front = img[:, :800]

# head: front art on the face side; cap and dreads from the back view behind
hb_img, hb_valid = back_in_front(img), back_in_front(HEADB_VALID, cv2.INTER_NEAREST)
(o, (m, f_rgb, b_rgb, b_val)) = crop(HEAD[:, :800], front, hb_img, hb_valid)
b.solid('head', m, f_rgb, m, b_rgb, b_val, o, axis=AXF, ground=GROUND, step=7, R=100, Tf=128, Tb=140, c=1.3, z0=-22,
        weights=lambda x, y: [{'head': 1.0}] * len(x), fallback='front', side={'img': img, 'valid': SIDE_HEAD, 'cx': SIDE_CX})

# ears: thin wings from the front view, the same on both sides
(o, (m, f_rgb)) = crop(EAR[:, :800], front)
b.solid('earL', m, f_rgb, m, None, None, o, axis=AXF, ground=GROUND, step=5, R=14, Tf=10, Tb=10, c=0.9, z0=-48,
        weights=lambda x, y: [{'head': 1.0}] * len(x), fallback='front', mirror_as='earR')

# torso: nothing of his back shows under the cape, so paint it from the front's row colours
(o, (m, f_rgb, mv)) = crop(TORSO[:, :800], front, (grey | (rows_all < 552))[:, :800])
b.solid('torso', m, f_rgb, m, None, None, o, axis=AXF, ground=GROUND, step=7, R=70, Tf=84, Tb=74, c=1.2, z0=0,
        weights=lambda x, y: chain(y, [('chest',), ('spine', Y(432), 26), ('hips', Y(520), 26)]), fallback='rowmedian', median_valid=mv)

# shoulder pads: the mantle's tips given some thickness, so they sit over the tops of the arms
(o, (m, f_rgb)) = crop(SHOULDER[:, :800], front)
b.solid('shoulderR', m, f_rgb, m, None, None, o, axis=AXF, ground=GROUND, step=6, R=40, Tf=66, Tb=66, c=2.4, z0=0,
        weights=lambda x, y: [{'chest': 1.0}] * len(x), fallback='front', mirror_as='shoulderL')

# legs: back art only shows trouser cuffs and boots; grow those colours up the back of the leg
def leg(name, mask, valid, back_mask, side):
    fb = bbox(mask & (rows_all >= 866))
    bb = bbox(back_mask & (rows_all >= 866))
    fbox, bbx = (fb[0], 0, fb[2], 1000), (bb[0], 0, bb[2], 1000)
    bi = back_in_front(img, fbox=fbox, bbx=bbx)
    bv = back_in_front(back_mask, cv2.INTER_NEAREST, fbox=fbox, bbx=bbx)
    (o, (m, f_rgb, f_val, b_rgb, b_val)) = crop(mask[:, :800], front, valid[:, :800], bi, bv)
    toe = lambda rows: 96 + np.clip((rows - 835) / 60.0, 0, 1) * 40
    heel = lambda rows: 86 + np.clip((rows - 835) / 60.0, 0, 1) * 12
    nm = 'leg' + side
    b.solid(nm, m, f_rgb, f_val, b_rgb, b_val, o, axis=AXF, ground=GROUND, step=7, R=72, Tf=toe, Tb=heel, c=2.0, cb=1.3, z0=4,
            weights=lambda x, y: chain(y, [('hips',), ('leg' + side, Y(605), 14), ('shin' + side, Y(742), 22), ('foot' + side, Y(888), 14)]),
            fallback='frontblur', side={'img': img, 'valid': SIDE_LEGS, 'cx': SIDE_CX})
leg('legR', LEGR, LEGR, LEGRB, 'R')
leg('legL', LEGL, LEGL_VALID, LEGLB, 'L')

# arms: his right arm is clear in both views; straighten it, then mirror it for the left arm
def principal_angle(mask, pivot):
    ys, xs = np.where(mask)
    vx, vy, _, _ = cv2.fitLine(np.stack([xs, ys], 1).astype(np.float32), cv2.DIST_L2, 0, 0.01, 0.01).ravel()
    if vy < 0: vx, vy = -vx, -vy
    return float(np.degrees(np.arctan2(vx, vy)))          # 0 = straight down, + = toward image right
PF, PB = (300, 372), (1947, 374)
af, ab = principal_angle(ARMF, PF), principal_angle(ARMB, PB)
print('arm angles front/back', round(af, 1), round(ab, 1))
armf_m, armf_img = rotate_about(ARMF, PF, -af, cv2.INTER_NEAREST), rotate_about(img, PF, -af)
armb_m, armb_img = rotate_about(ARMB, PB, -ab, cv2.INTER_NEAREST), rotate_about(img, PB, -ab)
armf_m[:350] = False; armb_m[:352] = False          # the stub above the shoulder hides under the shoulder pad
fb, bb = bbox(armf_m), bbox(armb_m)
bi = back_in_front(armb_img, fbox=fb, bbx=bb)
bv = back_in_front(armb_m, cv2.INTER_NEAREST, fbox=fb, bbx=bb)
# the art shades the top of the arm dark under the mantle; repaint that from the skin just below it
top = (rows_all[:, :800] < 392)
dark_f = top & (cv2.cvtColor(armf_img[:, :800], cv2.COLOR_RGB2HSV)[..., 2] < 120)
dark_b = top & (cv2.cvtColor(bi, cv2.COLOR_RGB2HSV)[..., 2] < 120)
(o, (m, f_rgb, f_val, b_rgb, b_val)) = crop(armf_m[:, :800], armf_img[:, :800], armf_m[:, :800] & ~dark_f, bi, bv & ~dark_b)
arm_cx = (fb[0] + fb[2]) / 2.0
print('arm bbox', fb, 'centre x', arm_cx, 'length', fb[3] - fb[1])
ARM_X = 138                                               # shoulder distance from the centre line
b.solid('armR', m, f_rgb, f_val, b_rgb, b_val, o, axis=AXF, ground=GROUND, step=6, R=44, Tf=62, Tb=62, c=1.0, z0=0,
        x_shift=(AXF - ARM_X) - arm_cx,
        weights=lambda x, y: chain(y, [('armR',), ('foreR', Y(478), 20), ('handR', Y(566), 12)]),
        fallback='front', mirror_as='armL')

# the cap's tail and the dread tips that hang down his back (from the back view only)
(o, (m, rgb)) = crop(HAIRB, img)
mf, rgbf = m[:, ::-1], rgb[:, ::-1]
ax = -(AXB - o[0] - m.shape[1] + 1)                       # after flipping, X = column - ax
b.solid('hairback', mf, rgbf, mf, rgbf, mf, (0, o[1]), axis=ax, ground=GROUND, step=6, R=22, Tf=14, Tb=14, c=0.8,
        z0=lambda rows: -124 + np.clip((rows - 250) / 114.0, 0, 1) * 22,
        weights=lambda x, y: chain(y, [('head',), ('dread1', Y(300), 14), ('dread2', Y(336), 12)]), fallback='front')

# the cape: one curved sheet from the back view, hung from a chain of bones so it can flow
(o, (m, rgb, val)) = crop(CAPE, cape_img, CAPE_VALID)
half = np.zeros(img.shape[0])
for r in range(img.shape[0]):
    xs = np.where(CAPE[r])[0]
    if len(xs): half[r] = max(abs(xs.min() - AXB), abs(xs.max() - AXB))
half = np.maximum(ndi.gaussian_filter1d(half, 6), 1)
def cape_z(X, rows):
    r = np.clip(rows, 0, img.shape[0] - 1).astype(int)
    u = np.clip(np.abs(X) / half[r], 0, 1.1)
    zc = 92 + np.clip((rows - 330) / 445.0, 0, 1) * 118
    return -(zc - 58 * u * u) + np.clip(330 - rows, 0, 60) * 0.6
b.sheet('cape', m, rgb, val, o, axis=AXB, ground=GROUND, step=9, zfun=cape_z, mirrored_view=True,
        weights=lambda x, y: chain(y, [('chest',), ('cape1', Y(400), 40), ('cape2', Y(540), 45), ('cape3', Y(670), 45)]))

# ---------------- skeleton (art pixels, converted to units below) ----------------
bones = [('root', None, (0, 0, 0)), ('hips', 'root', (0, Y(592), 0)), ('spine', 'hips', (0, Y(520), 0)),
         ('chest', 'spine', (0, Y(432), 0)), ('neck', 'chest', (0, Y(308), 0)), ('head', 'neck', (0, Y(292), 0)),
         ('cap1', 'head', (0, Y(60), -120)), ('cap2', 'cap1', (0, Y(150), -190)),
         ('dread1', 'head', (0, Y(292), -130)), ('dread2', 'dread1', (0, Y(330), -135)),
         ('cape1', 'chest', (0, Y(385), -100)), ('cape2', 'cape1', (0, Y(520), -130)), ('cape3', 'cape2', (0, Y(650), -165))]
for n, sg in (('L', 1), ('R', -1)):
    bones += [('arm' + n, 'chest', (sg * ARM_X, Y(372), 0)), ('fore' + n, 'arm' + n, (sg * ARM_X, Y(478), 0)),
              ('hand' + n, 'fore' + n, (sg * ARM_X, Y(566), 0)),
              ('leg' + n, 'hips', (sg * 82, Y(605), 0)), ('shin' + n, 'leg' + n, (sg * 82, Y(742), 0)),
              ('foot' + n, 'shin' + n, (sg * 82, Y(888), 0))]
bones = [(n, p, tuple(float(v) * S for v in xyz)) for n, p, xyz in bones]

atlas = b.atlas.image()
pos = np.concatenate(b.pos) * S
uv = np.concatenate(b.uvpx) / np.array([atlas.shape[1], atlas.shape[0]], np.float64)
tris = np.concatenate(b.tris)
spec = {'og': False, 'height': HEIGHT_UNITS, 'stride': 1.0, 'hips': Y(592) * S, 'armX': ARM_X * S, 'armRadius': 40 * S,
        'elbow': Y(478) * S, 'wrist': Y(566) * S, 'hand': Y(690) * S, 'hipsHalfWidth': 150 * S}
jpg = write_glb(out, pos, uv, tris, b.wts, bones, atlas, {'name': 'yn-toneda', 'spec': spec})
Image.fromarray(atlas).save(f'{dbg}/atlas.png')
for name, nv, nt in b.report: print('  %-16s verts %5d tris %5d' % (name, nv, nt))
print('total verts', len(pos), 'tris', len(tris), 'atlas', atlas.shape[1], 'x', atlas.shape[0], 'jpeg bytes', jpg)
