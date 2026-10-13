// Test de fumée : exécute le script du jeu dans Node avec un faux DOM et simule des parties.
// Usage (depuis la racine du projet) : node tools/smoke.js index.html
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
let src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace('titleScreen();\nrequestAnimationFrame(frame);', `titleScreen();
globalThis.__g = { newGame, setDir, S, comp, get P() { return P; }, get foes() { return foes; }, get trail() { return trail; },
  get wave() { return wave; }, get grab() { return grab; }, get grid() { return grid; }, onTrailHit, at, collect, announce, power, go, crash, get crashPos() { return crashPos; }, get items() { return items; }, DIFFS, usePower, ab, SHIPS, makeFoe, FOES, planStart, planTo, planLaunch, get plan() { return plan; }, get dash() { return dash; }, collect, pickType, seaStep, get rw() { return rw; }, camo, huntSees, usePower };
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
  window: globalThis, devicePixelRatio: 2, innerWidth: 375, innerHeight: 812,
  matchMedia: () => ({ matches: false, addEventListener: noop }),
  ResizeObserver: class { constructor(cb) { this.cb = cb; } observe() { this.cb([]); } },
  requestAnimationFrame: cb => { rafCb = cb; },
  localStorage: { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
  addEventListener: (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); }, removeEventListener: noop
});
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true, writable: true });
new Function(src)();
const g = globalThis.__g;
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
console.log('après retour au terrain : phase', g.S.phase, '| onde', !!g.wave, '| fil', g.trail.length, '| en', g.P.x, g.P.y);

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
  g.foes.push({ kind: 'amph', x: x + .5, y: 8.5, vx: 0, vy: 0, hist: [], ph: 0, dead: false });
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
console.log(`super vitesse : ${g.P.x - xs} cases en 10 frames (normal ~3) | power.hyp ${g.power.hyp.toFixed(1)}`);
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
for (let f = 0; f < 120; f++) { step(); minD = Math.min(minD, Math.hypot(g.foes[0].x - 25.5, g.foes[0].y - .5)); }
console.log(`bouclier : la boule ne s'approche pas à moins de ${minD.toFixed(1)} cases, phase ${g.S.phase}, bouclier ${g.P.shield}`);
g.setDir('down'); step(2);
console.log(`bouclier levé au premier mouvement : ${!g.P.shield}`);
g.newGame(1, 1); g.go(); g.foes.length = 0;
g.setDir('left'); step(80); g.setDir('down'); step(60); g.setDir('right'); step(5);
g.crash(); const cp = g.crashPos; step(160);
const onLand = g.grid[g.at(g.P.x, g.P.y)] === 1;
console.log(`reprise : crash en (${cp.x.toFixed(0)},${cp.y.toFixed(0)}) -> reprise en (${g.P.x},${g.P.y}), sur le terrain ${onLand}, bouclier ${g.P.shield}`);

// 5d) Ennemi coincé dans le terrain conquis : libéré, et pas de mort en boucle à la reprise
g.newGame(1, 1); g.go(); g.foes.length = 0;
g.foes.push({ kind: 'perf', x: 10.5, y: 1.5, vx: 8.8, vy: 0, hist: [], ph: 0, dead: false });
step(2);
const pf = g.foes[0], freed = g.grid[g.at(Math.floor(pf.x), Math.floor(pf.y))] === 0;
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
  // Robuste : 4 vies, 25 % de bonus en moins
  let n0 = 0, n1 = 0;
  for (let k = 0; k < 400; k++) { g.newGame(1, 2, 0); n0 += g.S.bonusLeft; g.newGame(1, 2, 1); n1 += g.S.bonusLeft; }
  console.log(`robuste : ${g.S.lives} vies, ${(n1 / 400).toFixed(2)} bonus par niveau contre ${(n0 / 400).toFixed(2)} (attendu -25 %)`);
  // Frénétique : +50 % de vitesse, 2 vies si un ennemi le touche pendant, 1 s'il croise son fil, recharge de 20 s
  const run = fr => { g.newGame(1, 1, 2); g.go(); g.foes.length = 0; g.setDir('down'); step(3); if (fr) g.usePower(); const y = g.P.y; step(30); return g.P.y - y; };
  const dn = run(false), df = run(true);
  console.log(`frénésie : ${dn} cases sans, ${df} avec (x${(df / dn).toFixed(2)})`);
  g.newGame(1, 1, 2); g.go(); g.foes.length = 0; g.setDir('down'); step(3); g.usePower(); step(2); g.crash(); step(60);
  const l2 = g.S.lives;
  g.newGame(1, 1, 2); g.go(); g.foes.length = 0; g.setDir('down'); step(3); g.usePower(); step(2); g.crash('self'); step(60);
  console.log(`frénésie : touché par un ennemi 3 -> ${l2} vies, croise son fil 3 -> ${g.S.lives} vies`);
  g.newGame(1, 1, 2); g.go(); g.foes.length = 0; g.usePower(); step(60 * 5 + 10);
  const cd = g.ab.cd; g.usePower(); const refused = g.ab.on === 0; step(60 * 20); g.usePower(); const stillOff = g.ab.on === 0;
  for (let i = 0; i < 100; i++) g.seaStep(); g.usePower();
  console.log(`frénésie : finie après 5 s (recharge ${cd} cases), refusée pendant la recharge ${refused}, toujours refusée 20 s plus tard sans tracer ${stillOff}, de nouveau dispo après 100 cases ${g.ab.on > 0}`);
  // Encaisseur : 2 vies, un coup l'arrête net, un 2e coup dans les 10 s le tue
  g.newGame(1, 1, 3); g.go(); g.foes.length = 0; g.setDir('down'); step(40);
  const pyB = g.P.y;
  g.foes.push({ kind: 'out', x: g.P.x + .5, y: g.P.y + 1.2, vx: 0, vy: -7.2, hist: [], ph: 0, dead: false });
  step(3); const stopped = g.S.phase === 'play' && !g.P.dir.x && !g.P.dir.y; const yS = g.P.y; step(30);
  console.log(`encaisseur : ${g.SHIPS[3].lives} vies, coup encaissé (phase ${g.S.phase}), arrêté net ${stopped && g.P.y === yS} (y ${pyB} -> ${g.P.y}), bouclier à recharger : ${g.P.guard} cases`);
  g.foes.length = 0; step(60);
  g.foes.push({ kind: 'out', x: g.P.x + .5, y: g.P.y + 1.2, vx: 0, vy: -7.2, hist: [], ph: 0, dead: false });
  step(5); console.log(`encaisseur : 2e coup avant d'avoir rechargé le bouclier -> ${g.S.phase}`);
  // onde de choc : fil effacé, conquête annulée, le retour ne referme aucune zone
  g.newGame(1, 1, 3); g.go(); g.foes.length = 0; g.setDir('down'); step(40);
  g.foes.push({ kind: 'out', x: 40, y: 40, vx: 7.2, vy: 4, hist: [], ph: 0, dead: false });
  g.onTrailHit({ kind: 'perf' }, g.trail[0]); step(20);
  const kept = g.trail.length, f0 = g.S.filled, ph = g.S.phase;
  g.setDir('left'); step(4); g.setDir('up'); step(120);
  console.log(`encaisseur et onde : phase ${ph}, fil restant ${kept}, au retour +${g.S.filled - f0} cases (que le bout de fil), sur son terrain ${!g.P.drawing}`);
}


// 5g) Nouveaux ennemis
{
  const lone = (kind, setup) => { g.newGame(1, 1); g.go(); g.foes.length = 0; g.setDir('down'); step(40); const e = g.makeFoe(kind, 1); setup(e); g.foes.push(e); return e; };
  // Diviseur : se coupe en deux au contact du fil, deux fois au plus
  let e = lone('div', e => { e.x = g.P.x + 4.5; e.y = 20; e.vx = -6; e.vy = 0; });
  let n = 0; for (let f = 0; f < 90 && g.S.phase === 'play'; f++) { step(); n = Math.max(n, g.foes.filter(x => x.kind === 'div').length); }
  console.log(`diviseur : ${n} morceaux après avoir touché le fil (phase ${g.S.phase})`);
  // Chasseur : immobile... puis fonce sur le vaisseau quand il trace
  const face = (e, tx, ty) => { const d = Math.hypot(tx - e.x, ty - e.y); e.vx = (tx - e.x) / d * 3.2; e.vy = (ty - e.y) / d * 3.2; e.hd = Math.atan2(e.vy, e.vx); };
  e = lone('hunt', e => { e.x = g.P.x + 10.5; e.y = 26; face(e, g.P.x + .5, g.P.y + .5); });
  let seen = {}; for (let f = 0; f < 120 && g.S.phase === 'play'; f++) { step(); seen[e.st] = 1; }
  console.log(`chasseur face au vaisseau : états ${Object.keys(seen).join(' > ')}, fin ${g.S.phase}`);
  e = lone('hunt', e => { e.x = g.P.x + 10.5; e.y = 26; face(e, g.P.x + 20, 60); });
  seen = {}; for (let f = 0; f < 20; f++) { step(); seen[e.st] = 1; }
  console.log(`chasseur dos au vaisseau : vise ${!!seen.aim} (attendu false)`);
  e = lone('hunt', e => { e.x = g.P.x + .5; e.y = 40; face(e, g.P.x + .5, 0); });
  for (let y = 25; y < 28; y++) for (let x = 0; x < 50; x++) if (g.grid[g.at(x, y)] === 0) g.grid[g.at(x, y)] = 1;
  seen = {}; for (let f = 0; f < 10; f++) { step(); seen[e.st] = 1; }
  console.log(`chasseur avec du terrain entre eux : vise ${!!seen.aim} (attendu false)`);
  // Pulsar : son anneau coupe le fil
  e = lone('puls', e => { e.x = g.P.x + 6.5; e.y = 25; e.vx = 0; e.vy = 0; e.pt = .1; });
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
  g.planStart(); g.planTo(x0, 20); g.planTo(x0 - 12, 20); g.planTo(x0 - 12, 1);
  const n = g.plan.cells.length, closed = g.plan.closed;
  g.planLaunch();
  let frames = 0; while (g.dash && frames < 60) { step(); frames++; }
  console.log(`fulgurant : trajet de ${n} cases (refermé ${closed}) parcouru en ${frames} frames, +${((g.S.filled - f0) / g.S.interior * 100).toFixed(1)} % de terrain, sur son terrain ${!g.P.drawing}`);
  // en plein vol : le vaisseau s'arrête pour dessiner, puis file vers son terrain
  g.newGame(1, 1, 4); g.go(); g.foes.length = 0;
  const b2 = g.makeFoe('out', 1); b2.x = 40.5; b2.y = 50.5; g.foes.push(b2);
  g.setDir('down'); step(40);
  const yFly = g.P.y, fly0 = g.S.filled;
  g.planStart(); step(10); const frozen = g.P.y === yFly && g.P.drawing;
  g.planTo(g.P.x - 10, g.P.y); g.planTo(g.P.x - 10, 0); g.planLaunch();
  let fr = 0; while (g.dash && fr < 60) { step(); fr++; }
  console.log(`fulgurant en plein vol : arrêté pendant le tracé ${frozen}, éclair en ${fr} frames, +${((g.S.filled - fly0) / g.S.interior * 100).toFixed(1)} %, sur son terrain ${!g.P.drawing}`);
  // un ennemi sur le trajet : crash, et une seule vie = fin de partie
  g.newGame(1, 1, 4); g.go(); g.foes.length = 0;
  const e = g.makeFoe('out', 1); e.x = g.P.x + .5; e.y = 12.5; e.vx = 0; e.vy = 0; g.foes.push(e);
  g.planStart(); g.planTo(g.P.x, 30); g.planLaunch(); step(150);
  console.log(`fulgurant : trajet à travers un ennemi -> ${g.S.phase}`);
}


// 5i) Furtif : fil invisible pour les ennemis, camouflage optique
{
  g.newGame(1, 1, 5); g.go(); g.foes.length = 0; g.setDir('down'); step(40);
  g.onTrailHit({ kind: 'out' }, g.trail[0]);
  const b = g.makeFoe('out', 1); b.x = g.P.x + 4.5; b.y = 8.5; b.vx = -7.2; b.vy = 0; g.foes.push(b); step(30);
  console.log(`furtif : onde de choc ${!!g.wave} (attendu false), la boule traverse le fil, phase ${g.S.phase}`);
  const h = g.makeFoe('hunt', 1); h.x = g.P.x + .5; h.y = g.P.y + 8; h.vx = 0; h.vy = -3.2; h.hd = -Math.PI / 2;
  g.camo.on = 2; const blind = !g.huntSees(h); g.camo.on = 0; const sees = g.huntSees(h);
  console.log(`furtif : camouflé, le chasseur ne le voit pas ${blind} ; visible, il le voit ${sees}`);
}
// 5j) Rembobineur : remonte le temps de 3 s, même juste après un crash ; se recharge en traçant
{
  g.newGame(1, 1, 6); g.go(); g.foes.length = 0;
  const ball = g.makeFoe('out', 1); ball.x = 40.5; ball.y = 50.5; g.foes.push(ball);
  g.setDir('down'); step(90);
  const y1 = g.P.y; g.crash(); step(40);
  const lost = g.S.lives;
  g.usePower(); const ph = g.S.phase; step(60);
  console.log(`rembobineur : crash (vies ${lost}), rembobinage ${ph}, après : phase ${g.S.phase}, vies ${g.S.lives}, y ${y1} -> ${g.P.y}, recharge ${g.rw.charge}`);
  g.usePower(); const again = g.S.phase;
  for (let i = 0; i < 120; i++) g.seaStep();
  console.log(`rembobineur : refusé sans recharge (${again}), rechargé après 120 cases ${g.rw.charge === 1}`);
}

// 6) Parties aléatoires
let tot = 0;
for (const [d, L, sh] of [[0, 1, 0], [1, 1, 1], [1, 13, 2], [2, 13, 3], [2, 21, 2], [2, 25, 3], [0, 25, 1]]) {
  const c = play(d, L, 6000, 12345 + d * 7 + L, sh);
  tot += c; console.log(`partie d=${d} L=${L} vaisseau ${g.SHIPS[sh].name} : 6000 frames ok, ${c} crashs, ${g.foes.length} ennemis`);
}
// 6b) Les 25 niveaux, un par un
{
  let maxFoes = 0;
  for (let L = 1; L <= 25; L++) { play(1, L, 1500, 777 + L, L % 7); maxFoes = Math.max(maxFoes, g.foes.length); }
  console.log(`25 niveaux joués sans erreur, jusqu'à ${maxFoes} ennemis à l'écran (diviseurs compris)`);
}
console.log('OK');
