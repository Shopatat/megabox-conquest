// Test de fumée : exécute le script du jeu dans Node avec un faux DOM et simule des parties.
// Usage (depuis la racine du projet) : node tools/smoke.js index.html
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
let src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace('titleScreen();\nrequestAnimationFrame(frame);', `titleScreen();
globalThis.__g = { newGame, setDir, S, comp, get P() { return P; }, get foes() { return foes; }, get trail() { return trail; },
  get wave() { return wave; }, get grab() { return grab; }, get grid() { return grid; }, onTrailHit, at, collect, announce, power, go, crash, get crashPos() { return crashPos; }, get items() { return items; }, DIFFS, usePower, ab, SHIPS, makeFoe, FOES, planStart, planTo, planLaunch, get plan() { return plan; }, get dash() { return dash; }, collect, pickType, seaStep, get rw() { return rw; }, camo, huntSees, usePower, setupLevel, showClear, armor, gam, get slot() { return slot; }, SLOT, slotDraw, testReset, testShip, testRefill, checkGoal, G, pred };
requestAnimationFrame(frame);`);
if (!src.includes('__g')) throw new Error('hook non injecté');

const noop = () => {};
const anyProxy = () => new Proxy(function () {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : anyProxy(),
  set: () => true, apply: () => anyProxy(), construct: () => anyProxy()
});
const el = () => {
  const e = { style: { setProperty: noop }, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, dataset: {},
    hidden: false, innerHTML: '', textContent: '', clientWidth: 375, clientHeight: 600, width: 0, height: 0,
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null, focus: noop,
    querySelector: () => el(), querySelectorAll: () => [], appendChild: noop, getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 500 }),
    getContext: () => anyProxy(), setPointerCapture: noop };
  return e;
};
const els = {};
let rafCb = null, now = 0;
const winListeners = {};
Object.assign(globalThis, {
  document: { getElementById: id => els[id] || (els[id] = el()), createElement: () => el(), querySelector: () => el(), querySelectorAll: () => [],
    addEventListener: noop, documentElement: el(), body: el(), hidden: false, fonts: { ready: Promise.resolve() } },
  window: globalThis, devicePixelRatio: 2, innerWidth: 375, innerHeight: 812, Path2D: class { constructor() { return anyProxy(); } },
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  ResizeObserver: class { constructor(cb) { this.cb = cb; } observe() { this.cb([]); } },
  requestAnimationFrame: cb => { rafCb = cb; },
  localStorage: { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
  addEventListener: (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); }, removeEventListener: noop
});
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true, writable: true });
new Function(src)();
const g = globalThis.__g;
// la grille est G fois plus fine que le monde : position du vaisseau dans le monde, en cases d'origine
const G = g.G || 1, PX = () => (g.P.x + .5) / G, PY = () => (g.P.y + .5) / G;
const step = (n = 1) => { for (let i = 0; i < n; i++) { now += 16.7; const cb = rafCb; rafCb = null; cb && cb(now); } };
const DIRS = ['up', 'down', 'left', 'right'];

function play(d, L, frames, seed, ship = 0) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.newGame(d, L, ship); g.setDir('down'); step(2);
  let crashes = 0, lastPhase = '';
  for (let f = 0; f < frames; f++) {
    if (g.S.phase === 'ready') g.setDir('down');
    if (g.S.phase === 'over') g.newGame(d, L, ship);
    if (rnd() < 0.01 || (g.S.phase === 'crash' && rnd() < 0.05)) g.usePower();
    if (rnd() < 0.04) g.setDir(DIRS[(rnd() * 4) | 0]);
    if (rnd() < 0.005) g.setDir('stop');
    step();
    if (g.S.phase === 'crash' && lastPhase !== 'crash') crashes++;
    lastPhase = g.S.phase;
  }
  return crashes;
}

// 1) Composition des niveaux
for (let d = 0; d < 3; d++) {
  const rows = [];
  let amphMax = 0;
  for (let L = 1; L <= 25; L++) { const c = g.comp(L, d); amphMax = Math.max(amphMax, c.amph); rows.push(`${L}:${g.FOES.reduce((a, k) => a + c[k], 0)}`); }
  console.log(g.DIFFS[d].short.padEnd(4), rows.join(' '), '| trous noirs max', amphMax);
}

// 2) Onde de choc : le vaisseau continue d'avancer, et survit s'il regagne le terrain à temps
g.newGame(1, 1); g.setDir('down'); step(2);
g.foes.length = 0;
g.setDir('down'); step(70);
const before = g.trail.length;
g.onTrailHit({ kind: 'out' }, g.trail[0]);
const y0 = g.P.y; step(1);
console.log('onde: fil', before, '-> le vaisseau avance encore :', g.P.y > y0, '| onde active :', !!g.wave);
g.setDir('left'); step(1); g.setDir('up'); step(90);
console.log('après retour au terrain : phase', g.S.phase, '| onde', !!g.wave, '| fil', g.trail.length, '| en', PX().toFixed(1), PY().toFixed(1));

// onde rattrape le vaisseau s'il reste loin du terrain
g.newGame(1, 1); g.setDir('down'); step(2); g.foes.length = 0;
g.setDir('down'); step(30); g.onTrailHit({ kind: 'perf' }, g.trail[0]);
let crashed = false; for (let i = 0; i < 120 && !crashed; i++) { step(); crashed = g.S.phase === 'crash'; }
console.log('onde du perforateur rattrape un vaisseau qui fuit tout droit :', crashed);

// 3) Bonus territoire : plus de gel
g.newGame(1, 1); g.setDir('down'); step(2); g.foes.length = 0;
g.setDir('down'); step(10);
g.collect({ type: 'terr', x: 25.5, y: 40.5, done: false, age: 0 });
const yb = g.P.y; step(5);
console.log('territoire : le vaisseau continue :', g.P.y !== yb);

// 4) Trou noir : s'il croise le fil, il l'avale et ramène le vaisseau vers lui de plus en plus fort
function grabRun(startLeft, turn, frames) {
  g.newGame(1, 1); g.setDir('down'); step(2); g.foes.length = 0;
  if (startLeft) { g.setDir('left'); step(75); }
  g.setDir('down'); step(70);
  const x = g.P.x, len0 = g.trail.length;
  g.foes.push({ kind: 'amph', x: (x + .5) / G, y: 8.5, vx: 0, vy: 0, hist: [], ph: 0, dead: false });
  step(1);
  const grabbed = !!g.grab;
  g.setDir(turn);
  let minLen = len0;
  for (let f = 0; f < frames && g.S.phase === 'play'; f++) { step(); minLen = Math.min(minLen, g.trail.length || minLen); }
  return { grabbed, len0, minLen, phase: g.S.phase, drawing: g.P.drawing };
}
const far = grabRun(false, 'right', 300), close = grabRun(true, 'left', 120);
console.log(`trou noir loin du bord : avale le fil ${far.grabbed}, fil ${far.len0} -> ${far.minLen}, fin : ${far.phase}`);
console.log(`trou noir près du bord : avale le fil ${close.grabbed}, fin : ${close.phase} (sur son terrain : ${!close.drawing})`);

// 5) Super bonus
function fresh() { g.newGame(1, 3); g.setDir('down'); step(2); g.foes.length = 0; }
fresh(); g.announce({ type: 'sterr', x: 25.5, y: 33.5 });
const f0 = g.S.filled; g.collect({ type: "sterr", x: 25.5, y: 33.5, done: false, age: 0 }); const f1 = g.S.filled; step(120);
console.log(`super bombe : +${((f1 - f0) / g.S.interior * 100).toFixed(1)} % du terrain`);
fresh(); g.setDir('down'); step(10);
g.collect({ type: 'sspd', x: 25.5, y: 5.5, done: false, age: 0 });
step(40); g.setDir('right'); step(2); const xs = g.P.x; step(10);
console.log(`super vitesse : ${(g.P.x - xs) / G} cases en 10 frames (normal ~3) | power.hyp ${g.power.hyp.toFixed(1)}`);
step(700); console.log(`super vitesse terminée : ${g.power.hyp === 0}`);
fresh(); g.collect({ type: 'slife', x: 25.5, y: 33.5, done: false, age: 0 }); step(60);
const l1 = g.S.lives; g.S.lives = 8; g.collect({ type: 'slife', x: 25.5, y: 33.5, done: false, age: 0 }); step(60);
console.log(`super vie : 3 -> ${l1} vies, 8 -> ${g.S.lives} (max 9)`);

// 5b) Chrono : ennemis ralentis, arrêt possible dans la zone à conquérir, reprise à la fin
function ballMove(setup) {
  g.newGame(1, 1); g.setDir('down'); step(2); g.foes.length = 0;
  g.foes.push({ kind: 'out', x: 25, y: 35, vx: 7.2, vy: 4, hist: [], ph: 0, dead: false });
  setup(); const b = g.foes[0], x0 = b.x, y0 = b.y; step(20);
  return Math.hypot(b.x - x0, b.y - y0);
}
const dn = ballMove(() => {}), dc = ballMove(() => { g.power.chr = 10; }), ds = ballMove(() => { g.power.schr = 10; });
console.log(`chrono : boule ${dn.toFixed(1)} cases sans, ${dc.toFixed(1)} avec Chrono, ${ds.toFixed(1)} avec Super Chrono (sur 20 frames)`);
g.newGame(1, 1); g.setDir('down'); step(2); g.foes.length = 0; g.setDir('down'); step(30);
g.collect({ type: 'chr', x: 0, y: 0, done: false, age: 0 }); g.setDir('stop'); step(5);
const yStop = g.P.y; step(60);
console.log(`chrono : arrêt dans la zone à conquérir ${g.P.drawing && g.P.y === yStop} (y=${g.P.y})`);
step(600); console.log(`chrono terminé : le vaisseau est reparti ${g.power.chr === 0 && (g.P.y !== yStop || !g.P.drawing)}`);

// 5c) Zone de départ protégée tant qu'on n'a pas bougé, reprise près de l'endroit du crash
g.newGame(1, 1); g.go(); g.foes.length = 0;
g.foes.push({ kind: 'out', x: 25.5, y: 9, vx: 0.4, vy: -7.2, hist: [], ph: 0, dead: false });
let minD = 99;
for (let f = 0; f < 120; f++) { step(); minD = Math.min(minD, Math.hypot(g.foes[0].x - PX(), g.foes[0].y - PY())); }
console.log(`bouclier : la boule ne s'approche pas à moins de ${minD.toFixed(1)} cases, phase ${g.S.phase}, bouclier ${g.P.shield}`);
g.setDir('down'); step(2);
console.log(`bouclier levé au premier mouvement : ${!g.P.shield}`);
g.newGame(1, 1); g.go(); g.foes.length = 0;
g.setDir('left'); step(80); g.setDir('down'); step(60); g.setDir('right'); step(5);
g.crash(); const cp = g.crashPos; step(160);
const onLand = g.grid[g.at(g.P.x, g.P.y)] === 1;
console.log(`reprise : crash en (${cp.x.toFixed(0)},${cp.y.toFixed(0)}) -> reprise en (${PX().toFixed(0)},${PY().toFixed(0)}), sur le terrain ${onLand}, bouclier ${g.P.shield}`);

// 5d) Ennemi coincé dans le terrain conquis : libéré, et pas de mort en boucle à la reprise
g.newGame(1, 1); g.go(); g.foes.length = 0;
g.foes.push({ kind: 'perf', x: 10.5, y: 1.5, vx: 8.8, vy: 0, hist: [], ph: 0, dead: false });
step(2);
const pf = g.foes[0], freed = g.grid[g.at(Math.floor(pf.x * G), Math.floor(pf.y * G))] === 0;
console.log(`ennemi coincé dans le terrain : libéré vers la zone à conquérir ${freed} (${pf.x.toFixed(1)}, ${pf.y.toFixed(1)})`);
g.newGame(1, 1); g.go(); g.foes.length = 0;
g.setDir('left'); step(60); g.setDir('down'); step(40); g.setDir('right'); step(3);
g.crash(); step(5);
g.foes.push({ kind: 'out', x: 1.5, y: 12.5, vx: 0, vy: 7.2, hist: [], ph: 0, dead: false });
step(160); g.go();
let deaths = 0, lp = '';
for (let f = 0; f < 300; f++) { step(); if (g.S.phase === 'crash' && lp !== 'crash') deaths++; lp = g.S.phase; }
console.log(`reprise près d'un ennemi : ${deaths} mort(s) en 5 s sans bouger (attendu 0), bouclier ${g.P.shield}`);

// 5e) Bonus imprévisibles : sur tous les niveaux (pairs compris), nombre et moments variables
{
  let spawned = 0, levels = 0, first = [];
  for (let k = 0; k < 40; k++) {
    g.newGame(1, 2 + (k % 2)); g.go(); g.foes.length = 0; levels++;
    const left0 = g.S.bonusLeft;
    let t = 0, firstT = -1;
    for (let f = 0; f < 60 * 90; f++) { step(); t += 1 / 60; if (g.S.bonusLeft < left0 && firstT < 0) firstT = t; for (const it of g.items) it.age = 0; g.items.length = 0; }
    spawned += left0 - g.S.bonusLeft; if (firstT >= 0) first.push(firstT);
  }
  first.sort((a, b) => a - b);
  console.log(`bonus aléatoires : ${(spawned / levels).toFixed(2)} par niveau (niveaux pairs compris), 1er bonus entre ${first[0].toFixed(1)} s et ${first[first.length - 1].toFixed(1)} s`);
}


// 5f) Vaisseaux
{
  // Robuste : 4 vies, 25 % de bonus en moins ; Veinard : 50 % de bonus en plus et deux fois plus de super bonus
  // (référence : le Frénétique, sans particularité sur les bonus)
  let n0 = 0, n1 = 0, nv = 0;
  for (let k = 0; k < 600; k++) { g.newGame(1, 2, 2); n0 += g.S.bonusLeft; g.newGame(1, 2, 0); nv += g.S.bonusLeft; g.newGame(1, 2, 1); n1 += g.S.bonusLeft; }
  console.log(`blindé : ${g.S.lives} vie, ${(n1 / 600).toFixed(2)} bonus par niveau contre ${(n0 / 600).toFixed(2)} (attendu -25 %)`);
  const superShare = ship => { g.newGame(1, 5, ship); let n = 0; for (let k = 0; k < 4000; k++) if (['sup', 'sterr', 'sspd', 'schr', 'slife'].includes(g.pickType())) n++; return n / 40; };
  console.log(`veinard : ${(nv / 600).toFixed(2)} bonus par niveau (attendu +50 %), super bonus ${superShare(0).toFixed(0)} % contre ${superShare(2).toFixed(0)} %`);
  // Frénétique : +50 % de vitesse et invincible pendant la frénésie, recharge en traçant 300 cases
  const run = fr => { g.newGame(1, 1, 2); g.go(); g.foes.length = 0; g.setDir('down'); step(3); if (fr) g.usePower(); const y = g.P.y; step(30); return g.P.y - y; };
  const dn = run(false), df = run(true);
  console.log(`frénésie : ${dn / G} cases sans, ${df / G} avec (x${(df / dn).toFixed(2)})`);
  g.newGame(1, 1, 2); g.go(); g.foes.length = 0; g.setDir('down'); step(20); g.usePower();
  { const e = g.makeFoe('out', 1); e.x = PX(); e.y = PY() + 2; e.vx = 0; e.vy = -7; g.foes.push(e);
    const h = g.makeFoe('hunt', 1); h.x = 10.5; h.y = 40.5; g.foes.push(h); }
  step(60); const inv = g.S.phase, l2 = g.S.lives, trl = g.trail.length; g.setDir('left'); step(5); g.setDir('up'); step(5); g.setDir('right'); step(5);
  console.log(`frénésie : percuté par une boule ${inv} (play), vies 3 -> ${l2}, fil ${trl > 0 ? 'intact' : 'perdu'} ; croise son fil ${g.S.phase} vies ${g.S.lives}`);
  g.newGame(1, 1, 2); g.go(); g.foes.length = 0; g.usePower(); step(60 * 5 + 10);
  const cd = g.ab.cd; g.usePower(); const refused = g.ab.on === 0; step(60 * 20); g.usePower(); const stillOff = g.ab.on === 0;
  for (let i = 0; i < 299 * G; i++) g.seaStep(); g.usePower(); const early = g.ab.on > 0; for (let i = 0; i < G; i++) g.seaStep(); g.usePower();
  { g.newGame(1, 5, 2); const ts = new Set(); for (let k = 0; k < 4000; k++) ts.add(g.pickType()); console.log(`frénésie : bonus tirés ${[...ts].sort().join(' ')} (ni inv, ni sup, ni spd, ni sspd)`); }
  console.log(`frénésie : pas dispo après 299 cases ${!early} ; finie après 5 s (recharge ${cd} cases), refusée pendant la recharge ${refused}, toujours refusée 20 s plus tard sans tracer ${stillOff}, de nouveau dispo après 300 cases ${g.ab.on > 0}`);
  // Encaisseur : 2 vies, un coup l'arrête net, un 2e coup dans les 10 s le tue
  g.newGame(1, 1, 3); g.go(); g.foes.length = 0; g.setDir('down'); step(40);
  const pyB = g.P.y;
  g.foes.push({ kind: 'out', x: PX(), y: PY() + .7, vx: 0, vy: -7.2, hist: [], ph: 0, dead: false });
  step(3); const stopped = g.S.phase === 'play' && !g.P.dir.x && !g.P.dir.y; const yS = g.P.y; step(30);
  console.log(`encaisseur : ${g.SHIPS[3].lives} vies, coup encaissé (phase ${g.S.phase}), arrêté net ${stopped && g.P.y === yS} (y ${pyB} -> ${g.P.y}), bouclier à recharger : ${g.P.guard} cases`);
  g.foes.length = 0; step(60);
  g.foes.push({ kind: 'out', x: PX(), y: PY() + .7, vx: 0, vy: -7.2, hist: [], ph: 0, dead: false });
  step(5); console.log(`encaisseur : 2e coup avant d'avoir rechargé le bouclier -> ${g.S.phase}`);
  // onde de choc : fil effacé, conquête annulée, le retour ne referme aucune zone
  g.newGame(1, 1, 3); g.go(); g.foes.length = 0; g.setDir('down'); step(40);
  g.foes.push({ kind: 'out', x: 40, y: 40, vx: 7.2, vy: 4, hist: [], ph: 0, dead: false });
  g.onTrailHit({ kind: 'perf' }, g.trail[0]); step(20);
  const kept = g.trail.length, f0 = g.S.filled, ph = g.S.phase;
  g.setDir('left'); step(4); g.setDir('up'); step(120);
  console.log(`encaisseur et onde : phase ${ph}, fil restant ${kept}, au retour +${(g.S.filled - f0) / G / G} cases (que le bout de fil), sur son terrain ${!g.P.drawing}`);
}


// 5g) Nouveaux ennemis
{
  const lone = (kind, setup) => { g.newGame(1, 1); g.go(); g.foes.length = 0; g.setDir('down'); step(40); const e = g.makeFoe(kind, 1); setup(e); g.foes.push(e); return e; };
  // Diviseur : se coupe en deux au contact du fil, deux fois au plus
  let e = lone('div', e => { e.x = PX() + 4; e.y = 8; e.vx = -6; e.vy = 0; });
  let n = 0; for (let f = 0; f < 90 && g.S.phase === 'play'; f++) { step(); n = Math.max(n, g.foes.filter(x => x.kind === 'div').length); }
  console.log(`diviseur : ${n} morceaux après avoir touché le fil (phase ${g.S.phase})`);
  // Chasseur : immobile... puis fonce sur le vaisseau quand il trace
  const face = (e, tx, ty) => { const d = Math.hypot(tx - e.x, ty - e.y); e.vx = (tx - e.x) / d * 3.2; e.vy = (ty - e.y) / d * 3.2; e.hd = Math.atan2(e.vy, e.vx); };
  e = lone('hunt', e => { e.x = PX() + 10; e.y = 26; face(e, PX(), PY()); });
  let seen = {}; for (let f = 0; f < 120 && g.S.phase === 'play'; f++) { step(); seen[e.st] = 1; }
  console.log(`chasseur face au vaisseau : états ${Object.keys(seen).join(' > ')}, fin ${g.S.phase}`);
  e = lone('hunt', e => { e.x = PX() + 10; e.y = 26; face(e, PX() + 20, 60); });
  seen = {}; for (let f = 0; f < 20; f++) { step(); seen[e.st] = 1; }
  console.log(`chasseur dos au vaisseau : vise ${!!seen.aim} (attendu false)`);
  e = lone('hunt', e => { e.x = PX(); e.y = 40; face(e, PX(), 0); });
  for (let y = 25 * G; y < 28 * G; y++) for (let x = 0; x < 50 * G; x++) if (g.grid[g.at(x, y)] === 0) g.grid[g.at(x, y)] = 1;
  seen = {}; for (let f = 0; f < 10; f++) { step(); seen[e.st] = 1; }
  console.log(`chasseur avec du terrain entre eux : vise ${!!seen.aim} (attendu false)`);
  // Pulsar : son anneau coupe le fil
  e = lone('puls', e => { e.x = PX() + 6; e.y = 25; e.vx = 0; e.vy = 0; e.pt = .1; });
  let waved = false; for (let f = 0; f < 90; f++) { step(); waved = waved || !!g.wave || g.S.phase !== 'play'; }
  console.log(`pulsar : l'anneau a coupé le fil ${waved}`);
  // Spectre : invisible une partie du temps
  e = lone('ghost', e => { e.gt = 0; });
  console.log(`spectre : cycle ${e.gt === 0 ? 'ok' : '?'} (visible, puis invisible ~2 s toutes les 6,4 s)`);
}


// 5h) Fulgurant : une seule vie, pas de bonus de vie ni de vitesse, tracé éclair
{
  g.newGame(1, 1, 4); g.go(); g.foes.length = 0;
  const types = new Set(); for (let k = 0; k < 3000; k++) { g.S.level = 5; types.add(g.pickType()); }
  g.collect({ type: 'slife', x: 25.5, y: 33.5, done: false, age: 0 });
  console.log(`fulgurant : ${g.S.lives} vie après une Super Vie, bonus tirés : ${[...types].sort().join(' ')}`);
  g.newGame(1, 1, 4); g.go(); g.foes.length = 0;
  const ball = g.makeFoe('out', 1); ball.x = 40.5; ball.y = 45.5; g.foes.push(ball);
  const f0 = g.S.filled, x0 = g.P.x;
  g.planStart(); g.planTo(x0, 20 * G); g.planTo(x0 - 12 * G, 20 * G); g.planTo(x0 - 12 * G, G);
  const n = g.plan.cells.length, closed = g.plan.closed;
  g.planLaunch();
  let frames = 0; while (g.dash && frames < 60) { step(); frames++; }
  console.log(`fulgurant : trajet de ${n / G} cases (refermé ${closed}) parcouru en ${frames} frames, +${((g.S.filled - f0) / g.S.interior * 100).toFixed(1)} % de terrain, sur son terrain ${!g.P.drawing}`);
  // en plein vol : le vaisseau s'arrête pour dessiner, puis file vers son terrain
  g.newGame(1, 1, 4); g.go(); g.foes.length = 0;
  const b2 = g.makeFoe('out', 1); b2.x = 40.5; b2.y = 50.5; g.foes.push(b2);
  g.setDir('down'); step(40);
  const yFly = g.P.y, fly0 = g.S.filled;
  g.planStart(); step(10); const frozen = g.P.y === yFly && g.P.drawing;
  g.planTo(g.P.x - 10 * G, g.P.y); g.planTo(g.P.x - 10 * G, 0); g.planLaunch();
  let fr = 0; while (g.dash && fr < 60) { step(); fr++; }
  console.log(`fulgurant en plein vol : arrêté pendant le tracé ${frozen}, éclair en ${fr} frames, +${((g.S.filled - fly0) / g.S.interior * 100).toFixed(1)} %, sur son terrain ${!g.P.drawing}`);
  // un ennemi sur le trajet : crash, et une seule vie = fin de partie
  g.newGame(1, 1, 4); g.go(); g.foes.length = 0;
  const e = g.makeFoe('out', 1); e.x = PX(); e.y = 12.5; e.vx = 0; e.vy = 0; g.foes.push(e);
  g.planStart(); g.planTo(g.P.x, 30 * G); g.planLaunch(); step(150);
  console.log(`fulgurant : trajet à travers un ennemi -> ${g.S.phase}`);
}


// 5i) Furtif : fil invisible pour les ennemis, camouflage optique
{
  g.newGame(1, 1, 5); g.go(); g.foes.length = 0; g.setDir('down'); step(40);
  g.onTrailHit({ kind: 'out' }, g.trail[0]);
  const b = g.makeFoe('out', 1); b.x = PX() + 4; b.y = 8.5; b.vx = -7.2; b.vy = 0; g.foes.push(b); step(30);
  console.log(`furtif : onde de choc ${!!g.wave} (attendu false), la boule traverse le fil, phase ${g.S.phase}`);
  const h = g.makeFoe('hunt', 1); h.x = PX(); h.y = PY() + 7.5; h.vx = 0; h.vy = -3.2; h.hd = -Math.PI / 2;
  g.camo.on = 2; const blind = !g.huntSees(h); g.camo.on = 0; const sees = g.huntSees(h);
  console.log(`furtif : camouflé, le chasseur ne le voit pas ${blind} ; visible, il le voit ${sees}`);
}
// 5j) Rembobineur : rembobinage continu (on rappuie pour s'arrêter), fenêtre de 3 s au crash, 2 vies max
{
  const start = () => { g.newGame(1, 1, 6); g.go(); g.foes.length = 0; const ball = g.makeFoe('out', 1); ball.x = 40.5; ball.y = 50.5; g.foes.push(ball); g.setDir('down'); step(150); };
  start();
  const y1 = g.P.y; g.crash(); step(150);
  const held = g.S.phase, lost = g.S.lives;
  g.usePower(); const ph = g.S.phase; let n = 0; while (g.S.phase === 'rewind' && n < 1200) { step(); n++; }
  console.log(`rembobineur : 2,5 s après le crash, toujours en suspens (${held}, vies ${lost}) ; rembobinage ${ph} pendant ${n} frames, puis ${g.S.phase}, vies ${g.S.lives}, y ${((y1 + .5) / G).toFixed(1)} -> ${PY().toFixed(1)}, jauge ${g.rw.charge.toFixed(1)} s`);
  start();
  { const ball = g.foes[0]; g.usePower(); let still = 0, maxJump = 0, px = ball.x, py = ball.y;
    for (let f = 0; f < 60; f++) { step(); const b = g.foes[0], d = Math.hypot(b.x - px, b.y - py); if (d < 1e-6) still++; maxJump = Math.max(maxJump, d); px = b.x; py = b.y; }
    console.log(`rembobineur au ralenti : boule ${still} image(s) figée(s) sur 60, plus grand pas ${maxJump.toFixed(3)} case (vitesse réelle 0,12 case par image)`);
    g.usePower(); step(3); }
  start();
  g.usePower(); step(12); g.usePower(); step(3);
  console.log(`rembobineur : arrêté tôt -> phase ${g.S.phase}, jauge économisée ${g.rw.charge.toFixed(1)} s sur 3`);
  start(); g.rw.charge = 0; g.crash(); step(140);
  console.log(`rembobineur sans jauge : crash normal, reprise après 2,1 s (${g.S.phase})`);
  g.newGame(1, 1, 6); g.collect({ type: 'life', x: 25.5, y: 33.5, done: false, age: 0 });
  console.log(`rembobineur : ${g.S.lives} vies après un bonus vie (max 2)`);
}
// 5m) Blindé : 20 % plus lent, blindage entamé selon le coup, réparation très lente, 0 % = crash
{
  const run = ship => { g.newGame(1, 1, ship); g.go(); g.foes.length = 0; g.setDir('down'); step(3); const y = g.P.y; step(60); return g.P.y - y; };
  const vn = run(2), vb = run(1);
  console.log(`blindé : ${vb / G} cases en 1 s contre ${vn / G} (x${(vb / vn).toFixed(2)})`);
  const ball = () => { const b = g.makeFoe('out', 1); b.x = PX(); b.y = PY() + .7; b.vx = 0; b.vy = -7.2; g.foes.push(b); return b; };
  g.newGame(1, 1, 1); g.go(); g.foes.length = 0; g.setDir('down'); step(40);
  ball(); step(10);
  const afterBall = g.armor.hp, moving = !!(g.P.dir.x || g.P.dir.y);
  g.foes.length = 0; step(50);
  const preWave = g.armor.hp;
  g.onTrailHit({ kind: 'out' }, g.trail[0]); let n = 0; while (n++ < 120 && g.armor.hp > preWave - .01) step();
  console.log(`blindé : après une boule ${(afterBall * 100).toFixed(0)} % (il continue ${moving}), après une onde de choc ${(g.armor.hp * 100).toFixed(0)} %, phase ${g.S.phase}`);
  const before = g.armor.hp; for (let k = 0; k < 500 * G; k++) g.seaStep();
  console.log(`blindé : 500 cases tracées réparent ${((g.armor.hp - before) * 100).toFixed(0)} % (5000 pour 100 %)`);
  g.armor.hp = .08; g.foes.length = 0; ball(); step(10);
  console.log(`blindé : à 8 %, un dernier choc -> ${g.S.phase}`);
  g.newGame(1, 1, 1); g.go(); g.armor.hp = .6; g.showClear(); g.setupLevel(2);
  console.log(`blindé : blindage conservé entre deux niveaux ${g.armor.hp} (0.6)`);
}
// 5n) Monarque : rien que des super bonus dès le niveau 1, autant que la normale, éphémères, 2 vies (4 max)
{
  g.newGame(1, 1, 8);
  const types = new Set(); for (let k = 0; k < 3000; k++) types.add(g.pickType());
  let n = 0; for (let k = 0; k < 600; k++) { g.newGame(1, 2, 8); n += g.S.bonusLeft; }
  g.newGame(1, 1, 8); g.collect({ type: 'slife', x: 25.5, y: 33.5, done: false, age: 0 }); const l1 = g.S.lives;
  g.collect({ type: 'slife', x: 25.5, y: 33.5, done: false, age: 0 });
  console.log(`monarque : bonus tirés au niveau 1 : ${[...types].sort().join(' ')} ; ${(n / 600).toFixed(2)} bonus par niveau ; vies 2 -> ${l1} -> ${g.S.lives} (max 4)`);
}
// 5o) Flambeur : des jetons à la place des objets, la machine à sous (en fond, sans ralentir le jeu)
{
  const gi = g.SHIPS.findIndex(s => s.key === 'gam');
  g.newGame(1, 3, gi); g.go();
  const types = new Set(); for (let k = 0; k < 500; k++) types.add(g.pickType());
  const coin = () => g.collect({ type: 'coin', x: 25.5, y: 33.5, done: false, age: 0 });
  const c0 = g.gam.chips; coin(); const c1 = g.gam.chips; for (let k = 0; k < 8; k++) coin();
  const cMax = g.gam.chips;
  // mise : 1er appui un jeton, chaque appui suivant (dans la seconde) un de plus, les rouleaux partent à 3
  g.foes.length = 0; g.usePower(); const b1 = g.slot.st + ' ' + g.slot.bet + ' (jetons ' + g.gam.chips + ')';
  g.usePower(); g.usePower(); const b3 = g.slot.st + ' ' + g.slot.bet + ' (jetons ' + g.gam.chips + ')';
  g.usePower(); const twice = g.gam.chips;
  const spinning = b1 + ', ' + b3, cAfter = twice;
  // le jeu continue à vitesse normale pendant que la machine tourne
  g.setDir('right'); step(10); const x0 = g.P.x; step(60); const slowMove = g.P.x - x0;
  step(150); const st = g.slot && g.slot.st; for (let k = 0; k < 900 && g.slot; k++) step();
  const odds = [1, 2, 3].map(b => { let w = 0, bad = 0; for (let k = 0; k < 20000; k++) { const i = g.slotDraw(b); if (i >= 0) { if (g.SLOT[i].bad) bad++; else w++; } } return `mise ${b} : gagne ${Math.round(w / 200)} %, coup dur ${Math.round(bad / 200)} %`; }).join(', ');
  g.newGame(1, 3, gi); g.go(); g.usePower(); step(50); const waiting = g.slot.st; step(30); const auto = g.slot.st;
  for (let k = 0; k < 2000 && g.slot; k++) step();
  const bonusN = (() => { let n = 0; for (let k = 0; k < 400; k++) { g.newGame(1, 2, gi); n += g.S.bonusLeft; } return n / 400; })();
  console.log(`flambeur : bonus tirés ${[...types].join(' ')} ; jetons ${c0} -> ${c1} -> ${cMax} (max 5) ; lancer : ${spinning}, jetons ${cAfter}, 4e appui ignoré ${twice === 2}, ${slowMove / G} case(s) en 1 s pendant la machine, puis ${st}, machine finie ${g.slot === null} ; mise de 1 : ${waiting} après 0,8 s, ${auto} après 1,3 s ; ${odds} ; ${bonusN.toFixed(1)} jetons par niveau`);
  // chaque gain, imposé depuis le mode test : la machine le donne et l'effet arrive
  const res = [];
  for (const w of g.SLOT) {
    g.S.test = true; g.S.ship = gi; g.testReset(); g.foes.length = 0;
    if (w.k === 'holdup') { const e = g.makeFoe('out', 1); e.x = 30.5; e.y = 40.5; g.foes.push(e); }
    g.gam.force = w.k; g.gam.chips = 5;
    const f0 = g.S.filled, l0 = g.S.lives; g.usePower(); g.usePower(); g.usePower(); if (w.k === 'skull') g.S.test = false;
    let landed = -1;
    for (let k = 0; k < 2000 && g.slot; k++) { step(); if (g.slot && g.slot.st === 'win' && landed < 0) landed = g.slot.idx; }
    const fx = [];
    for (const p of ['inv', 'spd', 'chr', 'sup', 'hyp', 'frag']) if (g.power[p] > 0) fx.push(p + ' ' + Math.round(g.power[p]));
    if (g.gam.snail) fx.push('escargot ' + g.gam.snail);
    if (g.S.filled > f0) fx.push('+' + Math.round((g.S.filled - f0) / g.S.interior * 100) + ' %');
    if (g.S.lives !== l0) fx.push('vies ' + l0 + ' -> ' + g.S.lives);
    if (w.k === 'holdup') fx.push('ennemis ' + g.foes.length);
    if (w.k === 'again' || w.k === 'jack') fx.push('jetons ' + g.gam.chips);
    res.push(`${w.k}${g.SLOT[landed] && g.SLOT[landed].k === w.k ? '' : ' (MAUVAIS GAIN ' + (g.SLOT[landed] || {}).k + ')'} [${fx.join(', ')}]`);
  }
  g.gam.force = ''; g.S.test = false;
  console.log('flambeur, cases : ' + res.join(' ; '));
  // escargot (vitesse -30 %), fil fragile (un ennemi qui touche le fil tue), tête de mort (jamais la dernière vie)
  const run = sn => { g.newGame(1, 1, gi); g.go(); g.foes.length = 0; g.gam.snail = sn; g.setDir('down'); step(3); const y = g.P.y; step(30); return g.P.y - y; };
  const dn = run(0), ds = run(3);
  g.newGame(1, 1, gi); g.go(); g.foes.length = 0; g.setDir('down'); step(25); g.power.frag = 15;
  { const e = g.makeFoe('out', 1); e.x = 40.5; e.y = 40.5; g.foes.push(e); g.onTrailHit(e, g.trail[2]); }
  const fragPhase = g.S.phase;
  g.S.test = true; g.S.ship = gi; g.testReset(); g.foes.length = 0; g.gam.force = 'skull'; g.S.lives = 1; g.usePower(); g.usePower(); g.usePower(); g.S.test = false; step(400); const lastLife = g.S.lives; g.gam.force = '';
  console.log(`flambeur : escargot ${ds / G} cases contre ${dn / G} (x${(ds / dn).toFixed(2)}) ; fil fragile touché -> ${fragPhase} ; tête de mort à 1 vie -> ${lastLife}`);
}
// 5p) Mode test : réinitialisation instantanée, changement de vaisseau, terrain effacé à 75 %
{
  g.S.test = true; g.S.ship = 0; g.testReset();
  const kinds = g.foes.map(e => e.kind).sort().join(' '), ph = g.S.phase;
  g.testShip(1); const sh1 = g.SHIPS[g.S.ship].name, ph2 = g.S.phase;
  { const e = g.makeFoe('hunt', 1); g.foes.push(e); }
  g.S.filled = Math.ceil(g.S.interior * .76); g.checkGoal(); const wipe = g.S.testWipe; step(90);
  const after = g.foes.map(e => e.kind).sort().join(' ');
  g.setDir('down'); step(20); g.crash(); step(150);
  console.log(`mode test : réinitialisé en ${ph} avec ${kinds} ; vaisseau suivant ${sh1} en ${ph2} ; 76 % -> effacé (${wipe > 0}) ${g.S.filled} cases, ennemis gardés ${after} ; après un crash ${g.S.phase}`);
  g.S.test = false;
}
// 5l) Piégeur : une petite zone refermée sur un ennemi l'élimine pour de bon
{
  const run = (ship) => {
    g.newGame(1, 1, ship); g.go(); g.foes.length = 0;
    const a = g.makeFoe('out', 1); a.x = 10.5; a.y = 8.5; a.vx = 0; a.vy = 0;
    const b = g.makeFoe('out', 1); b.x = 40.5; b.y = 50.5; g.foes.push(a, b);
    const f0 = g.S.filled;
    g.setDir('down'); let n = 0; while (g.P.y < 16 * G && n++ < 200) step();
    g.setDir('left'); n = 0; while (g.P.drawing && n++ < 200) step();
    return { dead: a.dead || !g.foes.includes(a), pct: (g.S.filled - f0) / g.S.interior * 100 };
  };
  const t = run(7), c = run(0);
  console.log(`piégeur : ennemi piégé ${t.dead}, +${t.pct.toFixed(1)} % (Classique dans la même situation : piégé ${c.dead}, +${c.pct.toFixed(1)} %)`);
  run(7); const n0 = g.foes.length; step(60 * 16);
  console.log(`piégeur : ${n0} ennemi(s) juste après, ${g.foes.length} 16 s plus tard (il ne revient pas)`);
}
// 5k) Les pouvoirs ne se rechargent pas entre les niveaux (et restent dans la sauvegarde)
{
  g.newGame(1, 1, 2); g.go(); g.ab.cd = 40; g.showClear(); g.setupLevel(2);
  const cdKept = g.ab.cd;
  g.newGame(1, 1, 3); g.go(); g.P.guard = 30; g.showClear(); g.setupLevel(2);
  const guardKept = g.P.guard;
  g.newGame(1, 1, 6); g.go(); g.rw.charge = 1.2; g.showClear(); g.setupLevel(2);
  console.log(`entre deux niveaux : recharge frénésie ${cdKept} (40), bouclier ${guardKept} (30), jauge rembobinage ${g.rw.charge} (1.2)`);
}

// 5q) Prédateur : pas de fil, le bond dévore, combo qui accélère, terrain conquis autour des proies, contact hors bond = crash,
// fuite des proies, trou noir immangeable, massacre de toutes les proies = toute la zone conquise
{
  const PR = g.SHIPS.findIndex(sh => sh.key === 'pred');
  const start = () => { g.newGame(1, 1, PR); g.go(); g.foes.length = 0; const k = g.makeFoe('out', 1); k.x = 45.5; k.y = 60.5; k.vx = 0; k.vy = 0; g.foes.push(k); g.setDir('down'); step(80); return k; };
  start();
  const noTrail = g.trail.length === 0 && !g.P.drawing;
  const prey = g.makeFoe('out', 1); prey.x = PX(); prey.y = PY() + 5; prey.vx = 0; prey.vy = 0; g.foes.push(prey);
  const f0 = g.S.filled, s0 = g.S.score;
  g.usePower(); step(20);
  console.log(`prédateur : sans fil ${noTrail} ; bond -> proie dévorée ${prey.dead}, combo ${g.pred.combo}, +${((g.S.filled - f0) / g.S.interior * 100).toFixed(1)} % de terrain, +${g.S.score - s0} points, phase ${g.S.phase}`);
  const speed = c => { start(); g.pred.combo = c; g.pred.ct = 99; g.setDir('right'); step(2); const x = g.P.x; step(30); return (g.P.x - x) / G * 2; };
  const v0 = speed(0), v3 = speed(3), v5 = speed(5);
  start(); g.pred.combo = 5; g.pred.ct = 99; g.setDir('right'); step(2); const xb = g.P.x; g.usePower(); step(6); const vb = (g.P.x - xb) / G * 10;
  console.log(`prédateur : ${v0.toFixed(0)} cases/s, combo ×3 ${v3.toFixed(0)}, ×5 ${v5.toFixed(0)}, bond à ×5 ${vb.toFixed(0)}`);
  start(); const b = g.makeFoe('out', 1); b.x = PX(); b.y = PY() + .7; b.vx = 0; b.vy = -7.2; g.foes.push(b); step(10);
  console.log(`prédateur : touché hors du bond -> ${g.S.phase}`);
  start(); const f = g.makeFoe('out', 1); f.x = PX(); f.y = PY() + 7; f.vx = 0; f.vy = -7.2; g.foes.push(f); step(40);
  console.log(`prédateur : une boule qui fonçait sur lui l’évite (phase ${g.S.phase}, distance ${Math.hypot(f.x - PX(), f.y - PY()).toFixed(1)})`);
  start(); const h = g.makeFoe('amph', 1); h.x = PX(); h.y = PY() + 3.5; h.vx = 0; h.vy = 0; g.foes.push(h); g.usePower(); step(40);
  console.log(`prédateur : bond sur le trou noir -> ${g.S.phase}, trou noir vivant ${!h.dead}`);
  start(); g.foes.length = 0; const last = g.makeFoe('out', 1); last.x = PX(); last.y = PY() + 4; last.vx = 0; last.vy = 0; g.foes.push(last);
  g.usePower(); step(30);
  console.log(`prédateur : dernière proie dévorée -> ${(g.S.filled / g.S.interior * 100).toFixed(0)} % conquis, phase ${g.S.phase}`);
}

// 6) Parties aléatoires
let tot = 0;
for (const [d, L, sh] of [[0, 1, 0], [1, 1, 1], [1, 13, 2], [2, 13, 3], [2, 21, 7], [2, 25, 3], [0, 25, 1], [1, 15, 7], [1, 9, 9], [2, 18, 9], [1, 11, 10], [2, 22, 10]]) {
  const c = play(d, L, 6000, 12345 + d * 7 + L, sh);
  tot += c; console.log(`partie d=${d} L=${L} vaisseau ${g.SHIPS[sh].name} : 6000 frames ok, ${c} crashs, ${g.foes.length} ennemis`);
}
// 6b) Les 25 niveaux, un par un
{
  let maxFoes = 0;
  for (let L = 1; L <= 25; L++) { play(1, L, 1500, 777 + L, L % 11); maxFoes = Math.max(maxFoes, g.foes.length); }
  console.log(`25 niveaux joués sans erreur, jusqu'à ${maxFoes} ennemis à l'écran (diviseurs compris)`);
}
console.log('OK');
