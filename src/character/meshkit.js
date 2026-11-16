// MeshKit — a tiny low-poly modelling toolkit.
// Builds one skinned, vertex-coloured BufferGeometry out of lofted tubes,
// boxes, cones and patches. Every vertex carries bone weights, so the result
// is a real rigged mesh (one draw call), not a pile of separate parts.
import * as T from '../../vendor/three.module.min.js';

const colorCache = new Map();
function rgb(hex) {
  let c = colorCache.get(hex);
  if (!c) { c = new T.Color(hex); colorCache.set(hex, c); }
  return c;
}

// UV that points at the solid white block of the atlas, so plain
// vertex-coloured surfaces are not tinted by the texture.
export const WHITE_UV = [0.75, 0.25];

export class MeshKit {
  constructor(boneIndex = null) {
    this.boneIndex = boneIndex; // { boneName: index } or null for rigid props
    this.pos = []; this.col = []; this.uv = []; this.si = []; this.sw = []; this.idx = [];
    this.count = 0;
  }

  vert(p, color, w, uv = WHITE_UV) {
    const c = rgb(color);
    this.pos.push(p[0], p[1], p[2]);
    this.col.push(c.r, c.g, c.b);
    this.uv.push(uv[0], uv[1]);
    if (this.boneIndex) {
      const entries = typeof w === 'string' ? [[w, 1]] : Object.entries(w);
      let total = 0;
      for (const e of entries) total += e[1];
      const i = [0, 0, 0, 0], k = [0, 0, 0, 0];
      entries.slice(0, 4).forEach(([name, weight], n) => {
        if (!(name in this.boneIndex)) throw new Error('Unknown bone: ' + name);
        i[n] = this.boneIndex[name]; k[n] = weight / total;
      });
      this.si.push(...i); this.sw.push(...k);
    }
    return this.count++;
  }

  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }

  // Lofted tube. rings: [{ c:[x,y,z], r | ra,rb, n?:[x,y,z], w, col }]
  // n is the direction the tube travels through that ring (default straight up).
  loft(rings, { sides = 6, capA = false, capB = false, phase = 0 } = {}) {
    const starts = [];
    for (const r of rings) {
      const n = new T.Vector3(...(r.n || [0, 1, 0])).normalize();
      let u, v;
      if (Math.abs(n.x) > 0.9) { u = new T.Vector3(0, 0, 1); v = new T.Vector3(0, 1, 0); }
      else {
        v = new T.Vector3(1, 0, 0).cross(n).normalize();
        u = n.clone().cross(v).normalize();
      }
      const ra = r.ra ?? r.r, rb = r.rb ?? r.r;
      starts.push(this.count);
      for (let i = 0; i < sides; i++) {
        const a = phase + (i / sides) * Math.PI * 2;
        const ca = Math.cos(a) * ra, sa = Math.sin(a) * rb;
        this.vert([
          r.c[0] + u.x * ca + v.x * sa,
          r.c[1] + u.y * ca + v.y * sa,
          r.c[2] + u.z * ca + v.z * sa,
        ], r.col, r.w);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) {
      const a = starts[k], b = starts[k + 1];
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        this.quad(a + i, a + j, b + j, b + i);
      }
    }
    const cap = (ring, start, flip) => {
      const centre = this.vert(ring.c, ring.col, ring.w);
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        if (flip) this.tri(centre, start + j, start + i); else this.tri(centre, start + i, start + j);
      }
    };
    if (capA) cap(rings[0], starts[0], true);
    if (capB) cap(rings[rings.length - 1], starts[starts.length - 1], false);
  }

  // Flat-shaded box. rot is an XYZ euler; taper scales the top face.
  box(c, size, w, col, { rot = null, taper = 1, colTop = null } = {}) {
    const [sx, sy, sz] = size.map(s => s / 2);
    const e = rot ? new T.Euler(...rot) : null;
    const corner = (x, y, z) => {
      const k = y > 0 ? taper : 1;
      const p = new T.Vector3(x * sx * k, y * sy, z * sz * k);
      if (e) p.applyEuler(e);
      return [c[0] + p.x, c[1] + p.y, c[2] + p.z];
    };
    const faces = [
      [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
      [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]],
      [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]],
      [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]],
      [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]],
      [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]],
    ];
    for (const f of faces) {
      const ids = f.map(([x, y, z]) => this.vert(corner(x, y, z), (colTop && y > 0) ? colTop : col, w));
      this.quad(...ids);
    }
  }

  // Cone / spike from a base ring to a tip (can blend colour and weights).
  cone(base, tip, r, w, col, { sides = 4, colTip = null, wTip = null, n = null } = {}) {
    const dir = n || [tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]];
    this.loft([
      { c: base, r, n: dir, w, col },
      { c: tip, r: r * 0.08, n: dir, w: wTip || w, col: colTip || col },
    ], { sides, capA: true, capB: true });
  }

  // Grid patch. fn(u,v) -> [x,y,z]. Used for the cape and for texture decals.
  patch(nu, nv, fn, { uv = null, col = '#ffffff', w } = {}) {
    const start = this.count;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv;
        const t = uv ? [uv[0] + (uv[2] - uv[0]) * u, uv[1] + (uv[3] - uv[1]) * v] : WHITE_UV;
        this.vert(fn(u, v), typeof col === 'function' ? col(u, v) : col, typeof w === 'function' ? w(u, v) : w, t);
      }
    }
    const row = nu + 1;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = start + j * row + i;
      this.quad(a, a + 1, a + row + 1, a + row);
    }
  }

  build() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    if (this.boneIndex) {
      g.setAttribute('skinIndex', new T.Uint16BufferAttribute(this.si, 4));
      g.setAttribute('skinWeight', new T.Float32BufferAttribute(this.sw, 4));
    }
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

// Build a bone hierarchy from [name, parentName|null, [x,y,z] rest position in model space].
export function buildSkeleton(defs) {
  const bones = [], byName = {}, index = {}, world = {};
  defs.forEach(([name, parent, p], i) => {
    const b = new T.Bone();
    b.name = name;
    world[name] = p;
    if (parent) {
      const q = world[parent];
      b.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      byName[parent].add(b);
    } else b.position.set(...p);
    bones.push(b); byName[name] = b; index[name] = i;
  });
  return { bones, byName, index, root: bones[0], rest: world };
}
