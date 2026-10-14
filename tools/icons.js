// Génère les icônes PNG de Space Conquest (mini scène de jeu), sans dépendance.
// Usage (depuis la racine du projet) : node tools/icons.js icons
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = {
  land: hex('#4b5bd4'), landB: hex('#4454c8'), edge: hex('#aab4ff'), sea: hex('#100d18'), dot: hex('#2a2338'),
  trail: hex('#ff7a4d'), core: hex('#100d18'), ball: hex('#ffd23f'), ballHi: hex('#fff7cf'), ballLo: hex('#d9901a'),
  ship: hex('#ffffff'), crawler: hex('#ff4d8d')
};

// Scène en coordonnées 0..1 ; renvoie la couleur au point (x, y). Ordre = du fond vers le dessus.
const inR = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
const seaA = [0.16, 0.16, 0.84, 0.56], seaB = [0.48, 0.56, 0.84, 0.84], E = 0.018;
const tri = (px, py, a, b, c) => {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const P = [px, py], d1 = s(P, a, b), d2 = s(P, b, c), d3 = s(P, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const TY = 0.40, TX = 0.64, TW = 0.026; // fil : descend en x=TX puis part à gauche en y=TY
function scene(x, y) {
  // terrain conquis, cases en damier discret (grille de 25)
  let c = ((Math.floor(x * 25) + Math.floor(y * 25)) & 1) ? C.land : C.landB;
  const inSea = inR(x, y, ...seaA) || inR(x, y, ...seaB);
  const nearSea = inR(x, y, seaA[0] - E, seaA[1] - E, seaA[2] + E, seaA[3] + E) || inR(x, y, seaB[0] - E, seaB[1] - E, seaB[2] + E, seaB[3] + E);
  if (nearSea) c = C.edge;
  if (inSea) {
    c = C.sea;
    const gx = x * 25 % 1, gy = y * 25 % 1;
    if (Math.abs(gx - 0.5) < 0.09 && Math.abs(gy - 0.5) < 0.09) c = C.dot;
  }
  // fil orange avec pointillés sombres au centre
  const vert = Math.abs(x - TX) < TW && y >= 0.13 && y <= TY + TW;
  const hor = Math.abs(y - TY) < TW && x >= 0.36 && x <= TX + TW;
  if (vert || hor) {
    c = C.trail;
    const along = vert && !hor ? y : x;
    const inCore = vert && !hor ? Math.abs(x - TX) < TW * 0.32 : Math.abs(y - TY) < TW * 0.32;
    if (inCore && (Math.floor(along * 40) & 1)) c = C.core;
  }
  // vaisseau blanc, nez vers la gauche, deux oreillettes à l'arrière
  const nose = [0.22, TY], bt = [0.37, TY - 0.075], bb = [0.37, TY + 0.075];
  if (tri(x, y, nose, bt, bb)) c = C.ship;
  if (inR(x, y, 0.35, TY - 0.095, 0.41, TY - 0.045) || inR(x, y, 0.35, TY + 0.045, 0.41, TY + 0.095)) c = C.ship;
  if (tri(x, y, [0.335, TY], [0.37, TY - 0.018], [0.37, TY + 0.018])) c = C.sea;
  // boule jaune avec reflet et ombre
  const bx = 0.67, by = 0.69, br = 0.085, d = Math.hypot(x - bx, y - by);
  if (d < br) {
    c = C.ball;
    if (Math.hypot(x - (bx - 0.025), y - (by - 0.025)) > br * 0.95) c = C.ballLo;
    if (Math.hypot(x - (bx - 0.03), y - (by - 0.03)) < br * 0.3) c = C.ballHi;
  }
  // gardien rose (étoile) sur le terrain
  const sx = 0.31, sy = 0.71, a = Math.atan2(y - sy, x - sx), r = Math.hypot(x - sx, y - sy);
  const star = 0.035 + 0.03 * Math.pow(Math.abs(Math.cos(a * 2)), 3);
  if (r < star) c = C.crawler;
  return c;
}

function png(size, file) {
  const SS = 4, raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const col = scene((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
        r += col[0]; g += col[1]; b += col[2];
      }
      const o = py * (size * 4 + 1) + 1 + px * 4, n = SS * SS;
      raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n); raw[o + 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(path.join(out, file), Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]));
}

png(180, 'apple-touch-icon.png');
png(192, 'icon-192.png');
png(512, 'icon-512.png');
png(32, 'favicon-32.png');
console.log('ok');
