// Génère les icônes PNG de Space Conquest, sans dépendance.
// Piste K « le S tracé » (choisie par Fabien) : le fil dessine un grand S dans l'espace et le vaisseau termine le trait.
// Usage (depuis la racine du projet) : node tools/icons.js icons
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });

// Tout est dessiné dans un carré de 512 unités, échantillonné par point (sur-échantillonnage pour l'anticrénelage).
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const ramp = (stops, t) => {
  t = clamp(t);
  for (let k = 1; k < stops.length; k++) if (t <= stops[k][0]) return mix(stops[k - 1][1], stops[k][1], (t - stops[k - 1][0]) / (stops[k][0] - stops[k - 1][0]));
  return stops[stops.length - 1][1];
};
// petit générateur pseudo-aléatoire à graine fixe (les icônes sont toujours identiques)
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* ---------- fond : nuit, nébuleuses, étoiles ---------- */
const BG = [[0, hex('#2a1d66')], [0.55, hex('#120f33')], [1, hex('#06071a')]];
const NEB = [
  { x: 410, y: 150, r: 230, c: hex('#7a3cff'), a: 0.28 },
  { x: 80, y: 300, r: 210, c: hex('#2f6bff'), a: 0.2 },
  { x: 300, y: 330, r: 150, c: hex('#ff4d8d'), a: 0.07 }
];
const STARS = [];
while (STARS.length < 46) {
  const x = 20 + rnd() * 472, y = 18 + rnd() * 390, r = 0.9 + Math.pow(rnd(), 3) * 2.6;
  STARS.push({ x, y, r, a: 0.45 + rnd() * 0.55, spark: r > 2.6 });
}

/* ---------- terrain conquis (bas de l'icône) ---------- */
const LY = 436;
const LAND = [hex('#4a6dff'), hex('#9a5cff')];

/* ---------- fil : un S aux virages arrondis ---------- */
const K = 0.92; // le fil et le vaisseau sont un peu resserrés vers le centre (zone sûre des icônes masquées)
const RAW = [[404, 112], [112, 112], [112, 266], [400, 266], [400, 404], [196, 404]], RC = 52;
const PTS = [RAW[0]];
for (let k = 1; k < RAW.length - 1; k++) {
  const [a, b, c] = [RAW[k - 1], RAW[k], RAW[k + 1]];
  const u = [Math.sign(a[0] - b[0]), Math.sign(a[1] - b[1])], v = [Math.sign(c[0] - b[0]), Math.sign(c[1] - b[1])];
  // quart de cercle tangent aux deux segments
  const ctr = [b[0] + (u[0] + v[0]) * RC, b[1] + (u[1] + v[1]) * RC];
  const a0 = Math.atan2(b[1] + u[1] * RC - ctr[1], b[0] + u[0] * RC - ctr[0]), a1 = Math.atan2(b[1] + v[1] * RC - ctr[1], b[0] + v[0] * RC - ctr[0]);
  let da = a1 - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
  for (let i = 0; i <= 16; i++) { const t = a0 + da * i / 16; PTS.push([ctr[0] + Math.cos(t) * RC, ctr[1] + Math.sin(t) * RC]); }
}
PTS.push(RAW[RAW.length - 1]);
const SEG = []; let LEN = 0;
for (let k = 1; k < PTS.length; k++) {
  const [x0, y0] = PTS[k - 1], [x1, y1] = PTS[k], l = Math.hypot(x1 - x0, y1 - y0);
  SEG.push({ x0, y0, dx: x1 - x0, dy: y1 - y0, l, s: LEN }); LEN += l;
}
const TW = 15; // demi-épaisseur du fil
const TRAIL = [[0, hex('#ffd36b')], [0.5, hex('#ff8a4d')], [1, hex('#ff4d8d')]];
// distance au fil et abscisse curviligne du point le plus proche
function nearTrail(x, y) {
  let best = 1e9, s = 0;
  for (const g of SEG) {
    const t = ((x - g.x0) * g.dx + (y - g.y0) * g.dy) / (g.l * g.l);
    const tc = clamp(t), d = Math.hypot(x - g.x0 - g.dx * tc, y - g.y0 - g.dy * tc);
    if (d < best) { best = d; s = g.s + g.l * tc; }
  }
  return [best, s];
}

/* ---------- vaisseau, nez vers la gauche, au bout du fil ---------- */
const HULL = [[86, 404], [122, 389], [172, 382], [206, 391], [206, 417], [172, 426], [122, 419]];
const FIN1 = [[146, 388], [194, 346], [214, 349], [208, 364], [188, 390]];
const FIN2 = FIN1.map(([x, y]) => [x, 808 - y]);
function inPoly(x, y, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c;
  }
  return c;
}
// distance signée au polygone (négative dedans)
function sdPoly(x, y, p) {
  let d = 1e9;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const ex = p[i][0] - p[j][0], ey = p[i][1] - p[j][1], t = clamp(((x - p[j][0]) * ex + (y - p[j][1]) * ey) / (ex * ex + ey * ey));
    d = Math.min(d, Math.hypot(x - p[j][0] - ex * t, y - p[j][1] - ey * t));
  }
  return inPoly(x, y, p) ? -d : d;
}

/* ---------- la scène, point par point ---------- */
function scene(X, Y) {
  // ciel
  let c = ramp(BG, Math.hypot(X - 256, Y - 180) / 420);
  for (const n of NEB) { const d = Math.hypot(X - n.x, Y - n.y) / n.r; if (d < 1) c = mix(c, n.c, n.a * Math.pow(1 - d, 2)); }
  for (const s of STARS) {
    const d = Math.hypot(X - s.x, Y - s.y);
    if (d > s.r * 7) continue;
    let a = s.a * (d < s.r ? 1 : Math.exp(-Math.pow((d - s.r) / (s.r * 1.6), 2)) * .5);
    if (s.spark) { const dx = Math.abs(X - s.x), dy = Math.abs(Y - s.y); a = Math.max(a, s.a * .7 * Math.max(Math.exp(-dy * 1.4) * (1 - dx / (s.r * 7)), Math.exp(-dx * 1.4) * (1 - dy / (s.r * 7)))); }
    c = mix(c, hex('#e8ecff'), clamp(a));
  }

  // terrain : dégradé, reflet en diagonale, liseré lumineux et halo côté espace
  if (Y >= LY) {
    c = mix(LAND[0], LAND[1], clamp((X / 512 + (Y - LY) / 76) / 2));
    c = mix(c, [255, 255, 255], .12 * Math.exp(-(Y - LY) / 16));
    const band = (X + (Y - LY) * 2.2 - 330) / 46;
    c = mix(c, [255, 255, 255], .16 * Math.exp(-band * band));
    if (Y - LY < 3) c = mix(c, hex('#eef1ff'), .9);
  } else c = mix(c, hex('#8fa8ff'), .38 * Math.exp(-Math.pow((LY - Y) / 12, 2)));

  // dans le repère resserré
  const x = 256 + (X - 256) / K, y = 256 + (Y - 256) / K;

  // fil : halo, corps en dégradé (or → orange → rose), centre en points ronds, queue qui s'estompe
  const [d, s] = nearTrail(x, y), u = s / LEN, tail = smooth(0, 190, s);
  const tc = ramp(TRAIL, u);
  if (d > TW) c = mix(c, tc, .5 * tail * Math.exp(-Math.pow((d - TW) / 15, 2)));
  else {
    let b = mix(tc, [255, 255, 255], .28 * Math.pow(1 - d / TW, 2));
    const ds = ((s % 26) + 26) % 26 - 13;
    if (Math.hypot(ds, d) < 3.9 && s > 40 && s < LEN - 14) b = mix(b, hex('#2a0f2a'), .85);
    c = mix(c, b, tail * clamp(TW - d + .5));
  }

  // vaisseau : halo, flamme, ailerons, coque, cockpit
  const sh = Math.min(sdPoly(x, y, HULL), sdPoly(x, y, FIN1), sdPoly(x, y, FIN2));
  if (sh > 0) c = mix(c, hex('#b8d0ff'), .42 * Math.exp(-Math.pow(sh / 16, 2)));
  const fu = x - 204, fv = Math.abs(y - 404);
  if (fu > 0 && fu < 56) {
    const w = 11 * Math.pow(1 - fu / 56, .75), e = fv / Math.max(w, .01);
    if (e < 1.6) {
      const fc = ramp([[0, hex('#ffffff')], [.35, hex('#9ff0ff')], [1, hex('#43c8ff')]], fu / 56 + e * .3);
      c = mix(c, fc, clamp((1.6 - e) / .6) * (1 - fu / 56) * .95);
    }
  }
  for (const fin of [FIN1, FIN2]) {
    const f = sdPoly(x, y, fin);
    if (f < .5) c = mix(c, mix(hex('#e4e8ff'), hex('#7d86e8'), clamp((Math.abs(y - 404) - 14) / 44)), clamp(.5 - f));
  }
  const h = sdPoly(x, y, HULL);
  if (h < .5) {
    let hc = mix(hex('#ffffff'), hex('#aeb8f6'), clamp((y - 384) / 42));
    if (h > -2.4) hc = mix(hc, hex('#7f8ae0'), .55);
    c = mix(c, hc, clamp(.5 - h));
  }
  const ce = Math.hypot((x - 136) / 22, (y - 404) / 8.5);
  if (ce < 1.15) {
    let cc = mix(hex('#bff6ff'), hex('#19a8d8'), clamp(ce));
    if (Math.hypot((x - 128) / 8, (y - 401) / 3) < 1) cc = mix(cc, [255, 255, 255], .85);
    c = mix(c, cc, clamp((1.15 - ce) * 6));
  }

  // vignette
  return mix(c, [4, 4, 16], .32 * smooth(.62, 1.05, Math.hypot(X - 256, Y - 256) / 362));
}

function png(size, file) {
  const SS = size <= 64 ? 6 : 3, raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const col = scene((px + (sx + 0.5) / SS) / size * 512, (py + (sy + 0.5) / SS) / size * 512);
        r += col[0]; g += col[1]; b += col[2];
      }
      const o = py * (size * 4 + 1) + 1 + px * 4, n = SS * SS;
      raw[o] = clamp(Math.round(r / n), 0, 255); raw[o + 1] = clamp(Math.round(g / n), 0, 255); raw[o + 2] = clamp(Math.round(b / n), 0, 255); raw[o + 3] = 255;
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
