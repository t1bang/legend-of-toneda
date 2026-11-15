// Pixel-art texture atlas for ToneDa, drawn in code (no image files needed).
// 128x128, nearest-neighbour filtered for the chunky N64 look.
//   [0..64, 0..64]    YN face      [64..128, 0..64]   OG face
//   [0..64, 64..128]  T1 logo      [64..128, 64..128] solid white (for vertex-coloured surfaces)
import * as T from '../../vendor/three.module.min.js';

// UV rectangles as [u0, v0, u1, v1] with v0 at the bottom of the image.
export const UV = {
  faceYN: [0, 0.5, 0.5, 1],
  faceOG: [0.5, 0.5, 1, 1],
  logo: [0, 0, 0.5, 0.5],
};

function drawFaceYN(g, ox) {
  const r = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(ox + x, y, w, h); };
  for (const x of [12, 38]) {
    r('#f4efe4', x, 25, 14, 11);           // eye white
    r('#3a2313', x + 4, 26, 7, 10);        // iris
    r('#0c0806', x + 6, 28, 4, 6);         // pupil
    r('#ffffff', x + 5, 27, 2, 2);         // highlight
    r('#120b08', x - 1, 23, 16, 2);        // upper lid
  }
  r('#120b08', 10, 17, 15, 3); r('#120b08', 39, 17, 15, 3);   // brows
  r('#120b08', 22, 18, 4, 3); r('#120b08', 38, 18, 4, 3);
  r('#56301c', 29, 39, 6, 3);                                  // nose
  r('#3a1d10', 28, 42, 2, 1); r('#3a1d10', 34, 42, 2, 1);
  r('#2a120c', 24, 50, 16, 2);                                 // smile
  r('#2a120c', 22, 48, 2, 2); r('#2a120c', 40, 48, 2, 2);
  r('#99593f', 27, 53, 10, 2);
}

function drawFaceOG(g, ox) {
  const r = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(ox + x, y, w, h); };
  r('#120b08', 9, 15, 17, 3); r('#120b08', 38, 15, 17, 3);     // brows (shades are 3D geometry)
  r('#56301c', 29, 37, 6, 4);                                   // nose
  r('#3a1d10', 27, 41, 3, 1); r('#3a1d10', 34, 41, 3, 1);
  r('#0f0b0d', 20, 44, 24, 4);                                  // moustache
  r('#0f0b0d', 18, 46, 4, 14); r('#0f0b0d', 42, 46, 4, 14);     // goatee sides
  r('#0f0b0d', 20, 54, 24, 10);                                 // chin
  r('#4a1c16', 25, 49, 14, 3);                                  // mouth
}

function drawLogo(g, oy) {
  g.fillStyle = '#f5c95b';
  g.font = 'bold 46px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('T1', 32, oy + 34);
}

export function makeAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  drawFaceYN(g, 0);
  drawFaceOG(g, 64);
  drawLogo(g, 64);
  g.fillStyle = '#ffffff';
  g.fillRect(64, 64, 64, 64);
  const tex = new T.CanvasTexture(canvas);
  tex.magFilter = T.NearestFilter;
  tex.minFilter = T.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
