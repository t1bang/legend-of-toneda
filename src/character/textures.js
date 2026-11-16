// Pixel-art texture atlas for ToneDa, drawn in code (no image files needed).
// 256x256. Faces are drawn on a 64-unit grid and scaled up 2x.
//   top-left: YN face      top-right: OG face
//   bottom-left: T1 logo   bottom-right: solid white (for vertex-coloured surfaces)
import * as T from '../../vendor/three.module.min.js';

// UV rectangles as [u0, v0, u1, v1] with v0 at the bottom of the image.
export const UV = {
  faceYN: [0, 0.5, 0.5, 1],
  faceOG: [0.5, 0.5, 1, 1],
  logo: [0, 0, 0.5, 0.5],
};

function poly(g, color, pts) {
  g.fillStyle = color;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}

// Young ToneDa: big eyes under heavy, angry brows and a small frown.
function drawFaceYN(g) {
  const r = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  for (const [x, s] of [[12, 1], [37, -1]]) {
    r('#f6f1e6', x, 23, 15, 13);                       // eye white
    r('#5a3216', x + 4 + (s > 0 ? 1 : 0), 24, 9, 12);  // iris
    r('#0c0806', x + 6 + (s > 0 ? 1 : 0), 26, 5, 8);   // pupil
    r('#ffffff', x + 5 + (s > 0 ? 1 : 0), 25, 3, 3);   // highlight
    r('#120b08', x - 1, 21, 17, 3);                    // heavy upper lid
    r('#120b08', x - 1, 36, 17, 1);
  }
  poly(g, '#120b08', [[7, 13], [29, 19], [29, 25], [7, 18]]);    // brows slant down to the centre
  poly(g, '#120b08', [[57, 13], [35, 19], [35, 25], [57, 18]]);
  r('#7d441f', 29, 38, 6, 4);                                    // nose
  r('#4a260f', 28, 42, 2, 1); r('#4a260f', 34, 42, 2, 1);
  r('#2a120c', 25, 50, 14, 2);                                   // frown
  r('#2a120c', 23, 52, 2, 2); r('#2a120c', 39, 52, 2, 2);
}

// OG ToneDa: brows above the shades (which are geometry), moustache and goatee.
function drawFaceOG(g) {
  const r = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  poly(g, '#120b08', [[8, 12], [28, 16], [28, 20], [8, 16]]);
  poly(g, '#120b08', [[56, 12], [36, 16], [36, 20], [56, 16]]);
  r('#7d441f', 29, 37, 6, 4);
  r('#4a260f', 27, 41, 3, 1); r('#4a260f', 34, 41, 3, 1);
  r('#0f0b0d', 21, 44, 22, 3);                                   // moustache
  r('#0f0b0d', 19, 45, 4, 12); r('#0f0b0d', 41, 45, 4, 12);      // goatee sides
  r('#0f0b0d', 22, 54, 20, 10);                                  // chin
  r('#5a2018', 26, 49, 12, 3);                                   // mouth
}

function drawLogo(g) {
  g.fillStyle = '#f5c95b';
  g.font = 'bold 92px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('T1', 64, 196);
}

export function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.save(); g.scale(2, 2); drawFaceYN(g); g.restore();
  g.save(); g.translate(128, 0); g.scale(2, 2); drawFaceOG(g); g.restore();
  drawLogo(g);
  g.fillStyle = '#ffffff';
  g.fillRect(128, 128, 128, 128);
  const tex = new T.CanvasTexture(canvas);
  tex.magFilter = T.NearestFilter;
  tex.minFilter = T.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
