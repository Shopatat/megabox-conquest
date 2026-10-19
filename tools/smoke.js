// Test de fumée : exécute le script du jeu dans Node avec un faux DOM et simule des parties.
// Usage (depuis la racine du projet) : node tools/smoke.js index.html
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
let src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace('titleScreen();\nrequestAnimationFrame(frame);', `titleScreen();
globalThis.__g = { newGame, setDir, S, comp, get P() { return P; }, get foes() { return foes; }, get trail() { return trail; },
  get wave() { return wave; }, get grab() { return grab; }, get grid() { return grid; }, onTrailHit, at, collect, announce, power, go, crash, get crashPos() { return crashPos; }, get items() { return items; }, DIFFS, usePower, ab, SHIPS, makeFoe, FOES, planStart, planTo, planLaunch, get plan() { return plan; }, get dash() { return dash; }, collect, pickType, seaStep, get rw() { return rw; }, camo, huntSees, usePower, setupLevel, showClear, armor, gam, get slot() { return slot; }, SLOT, slotDraw, testReset, testShip, testRefill, checkGoal, G, pred, lightFire, furyGain, get fires() { return fires; }, SKILLS, MASTERY, get mxp() { return mxp; }, mLevel, skBuild, skSave, loadSkills, get skills() { return skills; }, sk, showTree, showShips, setSkills: l => { skills = new Set(l); }, spawnItem, hitPlayer, dropShield, get invuln() { return invuln; }, superOn, armorHit, showClearX: showClear, get armor() { return armor; }, burnFoe, get slow() { return slow; }, get S_() { return S; }, onTrailHitX: onTrailHit, maxLives, startLives, foeSlow, planSlow, planMax, get wave_() { return wave; }, awardCells, trapFoes, get grab_() { return grab; }, rwSpan, rwWin, canRewind, rewind, supDur, chipsMax, slotPrize, slotStop, spinSlot, cheatLit, bloodMax, biteReach, predWin, predMax, get xpUp() { return xpUp; }, armorMax, GC, GR, ECOS, ecoSetup, lavaG, get pools() { return pools; }, get meteors() { return meteors; }, get amb() { return amb; }, get hz() { return hz; }, get oc() { return oc; }, get fg() { return fg; }, get ic() { return ic; }, iceG, campG, FROST_MAX, get vt() { return vt; } };
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
  // (référence : l'Encaisseur, sans particularité sur les bonus)
  let n0 = 0, n1 = 0, nv = 0;
  for (let k = 0; k < 600; k++) { g.newGame(1, 2, 3); n0 += g.S.bonusLeft; g.newGame(1, 2, 0); nv += g.S.bonusLeft; g.newGame(1, 2, 1); n1 += g.S.bonusLeft; }
  console.log(`blindé : ${g.S.lives} vie, ${(n1 / 600).toFixed(2)} bonus par niveau contre ${(n0 / 600).toFixed(2)} (attendu -25 %)`);
  const superShare = ship => { g.newGame(1, 5, ship); let n = 0; for (let k = 0; k < 4000; k++) if (['sup', 'sterr', 'sspd', 'schr', 'slife'].includes(g.pickType())) n++; return n / 40; };
  console.log(`veinard : ${(nv / 600).toFixed(2)} bonus par niveau (attendu +50 %), super bonus ${superShare(0).toFixed(0)} % contre ${superShare(3).toFixed(0)} %`);
  { let n = 0; for (let k = 0; k < 600; k++) { g.newGame(1, 2, 2); n += g.S.bonusLeft; } console.log(`frénétique : ${g.S.lives} vies, ${(n / 600).toFixed(2)} bonus par niveau (attendu -25 %)`); }
  // Frénétique : plus rapide de base (×1,2), furie à ×3 ; jauge remplie par la surface conquise ; fil en feu qui grille
  const FR = 2;
  const run = (ship, fr) => { g.newGame(1, 1, ship); g.go(); g.foes.length = 0; if (fr) g.ab.fury = 1; g.setDir('down'); step(3); if (fr) g.usePower(); const y = g.P.y; step(30); return g.P.y - y; };
  const d0 = run(0, false), dn = run(FR, false), df = run(FR, true);
  console.log(`furie : vitesse du Frénétique x${(dn / d0).toFixed(2)} (1,2), pendant la furie x${(df / d0).toFixed(2)} (3)`);
  g.newGame(1, 1, FR); g.go(); g.foes.length = 0;
  const fz0 = g.ab.fury; g.usePower(); const refused = g.ab.on === 0;
  g.furyGain(g.S.interior * .3, false); const half = g.ab.fury; g.furyGain(g.S.interior * .2, true); const full = g.ab.fury;
  g.setDir('left'); step(5); step(60 * 8); const fkept = g.ab.fury; g.ab.fury = .5; step(60 * 8); const drained = g.ab.fury; g.usePower(); const refused2 = g.ab.on === 0;
  g.ab.fury = 1; g.usePower();
  console.log(`furie : jauge au départ ${fz0}, refusée vide ${refused}, 30 % du terrain -> ${half.toFixed(2)}, + 20 % en MEGA -> ${full}, pleine 8 s sur son terrain -> ${fkept} (elle attend), à moitié 8 s -> ${drained.toFixed(2)} (refusée ${refused2}), pleine -> furie de ${g.ab.on} s, jauge ${g.ab.fury}`);
  // fil en feu : la boule qui le touche grille, pas d'onde de choc
  g.newGame(1, 1, FR); g.go(); g.foes.length = 0; g.ab.fury = 1; g.setDir('down'); step(20); g.usePower(); step(10);
  { const e = g.makeFoe('out', 1); e.x = PX() + 2; e.y = PY() - 4; e.vx = -7; e.vy = 0; g.foes.push(e); const sc = g.S.score; step(12);
    console.log(`furie : boule sur le fil en feu grillée ${e.dead}, onde de choc ${!!g.wave}, fil ${g.trail.length > 0 ? 'intact' : 'perdu'}, +${g.S.score - sc} points, flammes ${g.fires.length}`); }
  // le vaisseau, lui, n'est pas invincible
  g.newGame(1, 1, FR); g.go(); g.foes.length = 0; g.ab.fury = 1; g.setDir('down'); step(20); g.usePower();
  { const e = g.makeFoe('out', 1); e.x = PX(); e.y = PY() + 4; e.vx = 0; e.vy = 0; g.foes.push(e); step(12); console.log(`furie : boule percutée par le vaisseau -> ${g.S.phase} (crash), boule grillée ${e.dead}, furie ${g.ab.on}`); }
  // les flammes restent FIRE_T s, même hors du fil
  g.newGame(1, 1, FR); g.go(); g.foes.length = 0;
  { const cx = 20 * G, cy = 40 * G; g.lightFire(g.at(cx, cy));
    const put = () => { const e = g.makeFoe('out', 1); e.x = (cx + .5) / G + .3; e.y = (cy + .5) / G; e.vx = 0; e.vy = 0; g.foes.push(e); step(2); return e; };
    const a = put(); step(60 * 3.2); const b = put(), bAlive = !b.dead;
    const h = g.makeFoe('amph', 1); h.x = (cx + .5) / G; h.y = (cy + .5) / G; h.vx = h.vy = 0; g.lightFire(g.at(cx, cy)); g.foes.push(h); step(2);
    console.log(`furie : boule sur une flamme grillée ${a.dead}, 3,2 s plus tard rien ${bAlive}, trou noir sur une flamme intact ${!h.dead}`); }
  { g.newGame(1, 5, FR); const ts = new Set(); for (let k = 0; k < 4000; k++) ts.add(g.pickType()); console.log(`furie : bonus tirés ${[...ts].sort().join(' ')} (ni vitesse ni super bonus)`); }
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
// 5r) Arbres de maîtrise : XP par vaisseau, paliers, arbre remis en ordre (points, ordre des branches, une seule ultime), mode test libre
{
  const ids = k => g.SKILLS[k].flatMap(b => b[2].map(n => n[0]));
  const nodes = Object.values(g.SKILLS).reduce((a, br) => a + br.length * br[0][2].length, 0);
  g.mxp.cla = 0; g.newGame(1, 1, 0); g.go(); g.foes.length = 0;
  const x0 = g.mxp.cla; g.setDir('down'); step(40); g.setDir('right'); step(20); g.setDir('up'); step(60);
  const x1 = g.mxp.cla; g.showClear(); const x2 = g.mxp.cla;
  console.log(`maîtrise : ${nodes} compétences pour ${Object.keys(g.SKILLS).length} vaisseaux ; zone refermée +${(x1 - x0).toFixed(0)} XP (${(g.S.filled / G / G).toFixed(0)} cases), niveau gagné +${x2 - x1} (400 en Confirmé)`);
  const c = ids('cla');
  g.mxp.cla = g.MASTERY[1]; g.skSave('cla', [c[0], c[1], c[2], c[6]], false);
  const b1 = g.skBuild('cla', false).length;
  // maîtrise 15 : une branche jusqu'à l'ultime (5 + 3 points), la 2e branche s'arrête avant son ultime (une seule)
  g.mxp.cla = g.MASTERY[14]; g.skSave('cla', c.slice(0, 12), false);
  const b2 = g.skBuild('cla', false), ults = b2.filter(id => [c[5], c[11], c[17]].includes(id)).length;
  // maîtrise 9 : l'ultime n'est pas encore accessible
  g.mxp.cla = g.MASTERY[8]; g.skSave('cla', c.slice(0, 6), false); const b5 = g.skBuild('cla', false).length;
  g.skSave('cla', [c[1], c[2]], false); const b3 = g.skBuild('cla', false).length;
  g.skSave('cla', c, true); const b4 = g.skBuild('cla', true).length;
  g.mxp.cla = g.MASTERY[1]; g.skSave('cla', [c[0], c[6]], false); g.newGame(1, 1, 0); const on = g.sk(c[0]) && g.sk(c[6]) && !g.sk(c[1]);
  g.showTree(false); g.showShips(false);
  g.mxp.cla = 6000; g.newGame(1, 1, 0); g.go(); g.showClearX(); g.showTree(false, 'run'); g.S.reshow(); const reshow = g.S.phase;
  console.log(`maîtrise : 2 points -> ${b1} compétences ; maîtrise 15 -> ${b2.length} dont ${ults} ultime ; maîtrise 9, ultime refusée -> ${b5} ; sans la 1re de la branche -> ${b3} ; mode test (libre) -> ${b4} ; actives en partie ${on} ; arbre entre deux niveaux puis retour ${reshow} ; paliers ${g.MASTERY.join(' ')}`);
  g.skSave('cla', [], false); g.skSave('cla', [], true); g.mxp.cla = 0; g.newGame(1, 1, 0);
}
// 5s) Compétences, vaisseau par vaisseau (withSk : nouvelle partie avec ces compétences, niveau L)
// Prédateur : une proie immobile tout au fond, sinon la zone vide de proies tombe d'un coup et le niveau finit
const withSk = (ship, list, L = 1) => { g.newGame(1, L, ship); g.setSkills(list); g.setupLevel(L); g.go(); g.foes.length = 0;
  if (g.SHIPS[ship].key === 'pred') { const b = g.makeFoe('out', 1); b.x = 46; b.y = 62; b.vx = b.vy = 0; g.foes.push(b); } };
const fmtN = n => String(Math.round(n));
const SHIPI = k => g.SHIPS.findIndex(s => s.key === k);
// Veinard
{
  const V = SHIPI('cla');
  let ok = true, n0 = 0, n1 = 0;
  for (let k = 0; k < 300; k++) { withSk(V, ['chance']); if (g.S.bonusLeft < 1 || g.S.bonusWait > 5) ok = false; }
  for (let k = 0; k < 600; k++) { withSk(V, []); n0 += g.S.bonusLeft; withSk(V, ['etoile']); n1 += g.S.bonusLeft; }
  withSk(V, ['trouvaille'], 3); let far = 0; for (let k = 0; k < 40; k++) { g.items.length = 0; g.spawnItem(); const it = g.items[0], pp = { x: PX(), y: PY() }; if (it && Math.hypot(it.x - pp.x, it.y - pp.y) > 12.5) far++; }
  withSk(V, ['corne'], 3); let extra = 0; for (let k = 0; k < 400; k++) { g.items.length = 0; g.spawnItem(); g.items[0].type = 'chr'; g.collect(g.items[0]); if (g.items.some(it => !it.done)) extra++; }
  const sup = list => { withSk(V, list, 1); let n = 0; for (let k = 0; k < 4000; k++) if (['sup', 'sterr', 'sspd', 'schr', 'slife'].includes(g.pickType())) n++; return n / 40; };
  console.log(`veinard : coup de chance ${ok} ; bonne étoile ${(n1 / 600).toFixed(2)} bonus contre ${(n0 / 600).toFixed(2)} ; trouvaille, loin ${far}/40 ; corne d'abondance ${(extra / 4).toFixed(0)} % ; super bonus au niveau 1 : ${sup([]).toFixed(0)} % sans, ${sup(['precoce']).toFixed(0)} % précoce, ${sup(['precoce', 'veine']).toFixed(0)} % avec veine`);
  withSk(V, ['ecrin'], 3); g.items.length = 0; g.spawnItem(); const it = g.items[0]; it.type = 'sup'; g.P.drawing = true; step(60); const aged = it.age;
  withSk(V, ['groslot'], 3); g.superOn({ x: 20, y: 30 }); const dur = g.power.sup;
  const ouf = list => { withSk(V, list); let alive = 0; for (let k = 0; k < 1000; k++) { g.S.phase = 'play'; g.S.safe = 0; g.P.shield = false; g.hitPlayer(null); if (g.S.phase === 'play') alive++; } return alive / 10; };
  withSk(V, ['ange']); g.dropShield(); const inv = g.invuln;
  withSk(V, ['trefle']); g.P.shield = false; g.crash(); const p1 = g.S.phase, safe = g.S.safe > 0; g.S.safe = 0; g.crash(); g.S.safe = 0; g.crash(); const p2 = g.S.phase;
  console.log(`veinard : écrin, super bonus vieilli de ${aged.toFixed(2)} s en traçant ; gros lot, super casque ${dur} s ; ouf ${ouf(['ouf'])} %, baraka ${ouf(['ouf', 'baraka'])} % de coups ratés ; ange gardien ${inv} s ; trèfle : 1er crash -> ${p1} (répit ${safe}), 3e -> ${p2}`);
}
// Blindé
{
  const B = SHIPI('rob'), hit = (list, hp, src = 'out') => { withSk(B, list); g.armor.hp = hp; g.armorHit(src); return +g.armor.hp.toFixed(3); };
  withSk(B, ['forteresse']); g.armor.hp = 1; for (let i = 0; i < 3000 * G; i++) g.seaStep(); const fort = +g.armor.hp.toFixed(2);
  const rep = list => { withSk(B, list); g.armor.hp = .5; for (let i = 0; i < 500 * G; i++) g.seaStep(); return +(g.armor.hp - .5).toFixed(3); };
  const dist = list => { withSk(B, list); g.setDir('down'); step(3); const y = g.P.y; step(60); return (g.P.y - y) / G; };
  withSk(B, ['masse']); g.armorHit('out'); const jolt = g.armor.jolt;
  const foe = (list, drawing) => { withSk(B, list); const e = g.makeFoe('out', 1); e.x = PX() + .5; e.y = PY(); g.foes.push(e); g.P.drawing = drawing; g.armorHit(e); return e.dead ? 'détruit' : e.stun > 0 ? 'assommé ' + e.stun + ' s' : 'renvoyé'; };
  withSk(B, ['maint']); g.armor.hp = .5; g.showClearX(); const maint = +g.armor.hp.toFixed(2);
  withSk(B, ['pieces'], 3); g.armor.hp = .5; const types = new Set(); for (let k = 0; k < 2000; k++) types.add(g.pickType()); g.items.length = 0; g.spawnItem(); g.items[0].type = 'life'; g.collect(g.items[0]); const lifeHp = +g.armor.hp.toFixed(2);
  const zone = list => { withSk(B, list); g.armor.hp = .5; g.setDir('down'); step(40); g.setDir('right'); step(20); g.setDir('up'); step(60); return g.armor.hp; };
  withSk(B, ['coque']); g.armor.hp = .05; g.armorHit('amph'); const c1 = g.S.phase + ' ' + g.armor.hp; g.S.safe = 0; g.armor.hp = .05; g.armorHit('amph'); const c2 = g.S.phase;
  console.log(`blindé : boule 10 % -> plaques ${(1 - hit(['plaques'], 1)) * 100} %, réactives sous 30 % ${((.2 - hit(['reactives'], .2)) * 100).toFixed(1)} % ; forteresse, réparé jusqu'à ${fort} ; réparation de 500 cases +${rep([])} / soudeur +${rep(['soudeur'])}`);
  console.log(`blindé : 1 s -> ${dist([]).toFixed(1)} cases, moteur révisé ${dist(['moteur']).toFixed(1)} ; masse, ralenti ${jolt} ; ennemi percuté : ${foe([], false)}, bélier ${foe(['belier'], false)}, rouleau en traçant ${foe(['rouleau'], true)} ; maintenance 50 % -> ${maint} ; pièces détachées : vie tirée ${types.has('life')}, vie ramassée 50 % -> ${lifeHp} ; récupération +${((zone(['recup']) - zone([])) * 100).toFixed(1)} % ; seconde coque : ${c1}, puis ${c2}`);
}
// Frénétique
{
  const F = SHIPI('fre');
  const fire = list => { withSk(F, list); const cx = 20 * G, cy = 40 * G; g.lightFire(g.at(cx, cy)); const put = dx => { const e = g.makeFoe('out', 1); e.x = (cx + .5) / G + dx; e.y = (cy + .5) / G; e.vx = e.vy = 0; g.foes.push(e); return e; };
    const a = put(1.1); step(2); const b = put(.3); step(Math.round(60 * 3.4)); const c = put(.3); step(2); step(Math.round(60 * 2)); const d = put(.3); step(2); return [a.dead, b.dead, c.dead, d.dead].map(x => x ? 'X' : '.').join(''); };
  const pts = list => { withSk(F, list); const e = g.makeFoe('out', 1); g.foes.push(e); const s0 = g.S.score; g.burnFoe(e); return g.S.score - s0; };
  const fill = list => { withSk(F, list); g.furyGain(g.S.interior * .3, false); return +g.ab.fury.toFixed(2); };
  const dur = list => { withSk(F, list); g.ab.fury = 1; g.setDir('down'); step(5); g.usePower(); return g.ab.on; };
  withSk(F, ['rancune']); g.burnFoe((() => { const e = g.makeFoe('out', 1); g.foes.push(e); return e; })()); const ranc = g.ab.fury;
  withSk(F, ['sansfin']); g.ab.fury = 1; g.setDir('down'); step(5); g.usePower(); step(30); const on0 = g.ab.on; g.burnFoe((() => { const e = g.makeFoe('out', 1); g.foes.push(e); return e; })()); const sf = +(g.ab.on - on0).toFixed(2);
  withSk(F, ['meche']); g.setDir('down'); step(40); const meche = g.fires.length;
  withSk(F, ['sangfroid']); g.ab.fury = .5; g.setDir('left'); step(5); step(60 * 6); const sfr = g.ab.fury;
  withSk(F, ['retombee']); g.ab.fury = 1; g.setDir('down'); step(5); g.usePower(); g.ab.on = .1; step(12); const ret = g.S.safe > 0;
  withSk(F, ['reflexes']); g.ab.fury = 1; g.setDir('down'); step(5); g.usePower(); { const e = g.makeFoe('out', 1); e.x = PX() + 2; e.y = PY(); e.vx = e.vy = 0; g.foes.push(e); } step(1); const refl = g.slow > 0;
  withSk(F, ['phenix']); g.ab.fury = 1; g.setDir('down'); step(20); g.usePower(); { const e = g.makeFoe('out', 1); e.x = PX() + 3; e.y = PY(); g.foes.push(e); g.crash(); var ph = g.S.phase + ', voisin grillé ' + e.dead; } g.S.safe = 0; g.crash(); const ph2 = g.S.phase;
  console.log(`frénétique : flammes (à 1,1 / dessus / 3,4 s après / 5,4 s après) ${fire([])} ; braises ${fire(['braises'])} ; mur de feu ${fire(['murfeu'])} ; grillé +${pts([])}, barbecue +${pts(['bbq'])}`);
  console.log(`frénétique : 30 % du terrain -> jauge ${fill([])}, colérique ${fill(['colere'])} ; furie ${dur([])} s, hors de lui ${dur(['horslui'])} s ; rancune +${ranc} ; furie sans fin +${sf} s ; mèche, flammes hors furie ${meche} ; sang-froid, jauge après 6 s sur son terrain ${sfr} ; retombée, invincible après la furie ${ret} ; réflexes, ralenti ${refl} ; phénix : ${ph}, 2e crash -> ${ph2}`);
}
// Encaisseur
{
  const E = SHIPI('enc');
  const hitBy = (list, setup) => { withSk(E, list); g.P.shield = false; g.setDir('down'); step(20); if (setup) setup(); const e = g.makeFoe('out', 1); e.x = PX(); e.y = PY() + .6; e.vx = 0; e.vy = -5; g.foes.push(e); g.hitPlayer(e); return e; };
  let e = hitBy([]); const base = { guard: g.P.guard, moving: !!(g.P.dir.x || g.P.dir.y), grace: g.P.grace };
  e = hitBy(['rechrap']); const rr = g.P.guard;
  withSk(E, ['pret']); g.P.guard = 50; g.setupLevel(2); const pret = g.P.guard;
  e = hitBy(['sonne']); const sonne = e.stun;
  const s0 = (() => { const x = hitBy(['sonne', 'prime']); return g.S.score; })();
  e = hitBy(['elan']); const elan = !!(g.P.dir.x || g.P.dir.y);
  e = hitBy(['renvoi']); const renvoi = e.dead;
  e = hitBy(['souffle']); const souffle = g.P.grace;
  // deuxième charge : deux coups encaissés, le troisième tue
  withSk(E, ['double']); g.P.shield = false; g.setDir('down'); step(20);
  const ph = []; for (let k = 0; k < 3; k++) { g.P.grace = 0; g.S.phase = 'play'; const f = g.makeFoe('out', 1); f.x = PX(); f.y = PY() + .5; g.foes.push(f); g.hitPlayer(f); ph.push(g.S.phase); }
  // onde de bouclier : voisin repoussé
  e = hitBy(['ondeb'], () => { const n = g.makeFoe('out', 1); n.x = PX() + 2; n.y = PY(); n.vx = -3; n.vy = 0; g.foes.push(n); g.__n = n; }); const pushed = g.__n.vx > 0;
  // après-coup : pas d'onde de choc juste après
  hitBy(['apres']); { const f = g.makeFoe('out', 1); g.foes.push(f); g.onTrailHitX(f, g.trail[0]); } const noWave = !g.wave;
  withSk(E, ['inebr']); const lives = g.startLives();
  console.log(`encaisseur : coup encaissé -> recharge ${base.guard}, arrêté ${!base.moving}, répit ${base.grace} s ; recharge rapide ${rr} ; prêt à tout ${pret} ; sonné ${sonne} s ; prime +${s0} ; élan, continue ${elan} ; renvoi, détruit ${renvoi} ; souffle ${souffle} s ; double bouclier ${ph.join(' / ')} ; onde de bouclier, voisin repoussé ${pushed} ; après-coup, pas d'onde ${noWave} ; inébranlable ${lives} vies`);
}
// Fulgurant
{
  const FU = SHIPI('ful');
  const maxLen = list => { withSk(FU, list); return g.planMax() / G; };
  const speed = list => { withSk(FU, list); g.P.shield = false; g.planStart(); g.planTo(g.P.x, g.P.y + 40 * G); g.planLaunch(); step(6); const k = g.dash ? g.dash.k : -1; g.dash = null; return k / G / 0.1; };
  const slowW = list => { withSk(FU, list); g.P.shield = false; g.planStart(); const a = g.foeSlow(); step(200); const b = g.foeSlow(); g.plan = null; return a + ' puis ' + b; };
  withSk(FU, ['arc']); g.P.shield = false; { const e = g.makeFoe('out', 1); e.x = PX() + 1.8; e.y = PY() + 10; e.vx = e.vy = 0; g.foes.push(e); g.planStart(); g.planTo(g.P.x, g.P.y + 20 * G); g.planLaunch(); step(30); var arc = e.stun > 0; }
  withSk(FU, ['chaine']); g.P.shield = false; { const e = g.makeFoe('out', 1); e.x = 40; e.y = 50; e.vx = e.vy = 0; g.foes.push(e); g.planStart(); g.planTo(g.P.x, g.P.y + 6 * G); g.planLaunch(); step(30); var chain = e.dead; }
  withSk(FU, ['paraton']); g.P.shield = false; g.setDir('down'); step(30); g.onTrailHitX(g.makeFoe('out', 1), g.trail[0]); step(60); const pt1 = g.S.phase; g.S.safe = 0; g.setDir('down'); step(20); g.onTrailHitX(g.makeFoe('out', 1), g.trail[0]); step(90); const pt2 = g.S.phase;
  withSk(FU, ['premon']); g.P.shield = false; { const e = g.makeFoe('out', 1); g.foes.push(e); } g.planStart(); step(10);
  withSk(FU, ['court']); g.P.shield = false; g.crash(); const c1 = g.S.phase; g.setupLevel(2); g.go(); g.S.safe = 0; g.P.shield = false; g.crash(); const c2 = g.S.phase;
  withSk(FU, ['survolte']); const sv = g.startLives() + ' / ' + g.maxLives();
  console.log(`fulgurant : trajet max ${maxLen([])} cases, longue portée ${maxLen(['portee'])} ; éclair ${speed([]).toFixed(0)} cases/s, haute tension ${speed(['tension']).toFixed(0)} ; monde pendant le dessin : ${slowW([])}, suspendu ${slowW(['suspendu'])}, transe ${slowW(['transe'])}, figé ${slowW(['fige'])}`);
  console.log(`fulgurant : arc électrique, frôlé assommé ${arc} ; foudre en chaîne ${chain} ; paratonnerre, 1re onde -> ${pt1}, 2e -> ${pt2} ; court-circuit ${c1}, puis ${c2} ; survolté ${sv} vies`);
}
// Furtif
{
  const FT = SHIPI('fur');
  const camoLen = list => { withSk(FT, list); let mx = 0, any = 0; for (let k = 0; k < 60 * 40; k++) { step(1); if (g.camo.on > mx) mx = g.camo.on; if (g.camo.on > 0) any++; } return mx.toFixed(1) + ' s (' + (any / 60).toFixed(0) + ' s en 40 s)'; };
  const auto = camoLen([]), reg = camoLen(['reglage']), man = camoLen(['manuel']);
  withSk(FT, ['manuel']); g.usePower(); const m1 = g.camo.on; step(300); g.usePower(); const m2 = g.camo.on; for (let i = 0; i < 100 * G; i++) g.seaStep(); g.usePower(); const m3 = g.camo.on;
  const touch = list => { withSk(FT, list); g.P.shield = false; g.setDir('down'); step(20); g.camo.on = 3; const e = g.makeFoe('out', 1); e.x = PX(); e.y = PY() + .4; g.foes.push(e); g.hitPlayer(e); return g.S.phase + (e.dead ? ', ennemi détruit' : ''); };
  withSk(FT, ['discret']); g.P.shield = false; g.setDir('down'); step(20); const h = g.makeFoe('hunt', 1); h.x = PX(); h.y = PY() + 18; h.hd = -Math.PI / 2; g.foes.push(h); const seen = g.huntSees(h);
  const pull = list => { withSk(FT, list); g.P.shield = false; g.setDir('down'); step(20); const a = g.makeFoe('amph', 1); a.x = PX() + 4; a.y = PY(); a.vx = a.vy = 0; g.foes.push(a); const x0 = g.P.vox; step(10); return Math.abs(g.P.vox) > .01 || g.P.pull > 0; };
  const pts = list => { withSk(FT, list); const s0 = g.S.score; g.awardCells(100 * G * G, { x: 10, y: 10 }, false); return g.S.score - s0; };
  withSk(FT, ['infiltre']); g.S.touched = true; const s1 = g.S.score; g.awardCells(100 * G * G, { x: 10, y: 10 }, false); const touchedPts = g.S.score - s1;
  withSk(FT, ['dispar']); g.P.shield = false; g.crash(); const d1 = g.S.phase + ' camouflé ' + (g.camo.on > 0); g.S.safe = 0; g.crash(); const d2 = g.S.phase;
  console.log(`furtif : camouflage auto ${auto}, réglage ${reg}, manuel sans bouton ${man} ; bouton ${m1} s, puis refusé ${m2 === 0}, rechargé après 100 cases ${m3 > 0} ; touché camouflé : ${touch([])}, invisible ${touch(['invis'])}, ombre assassine ${touch(['invis', 'assassin'])}`);
  console.log(`furtif : discret, chasseur à 18 cases le voit ${seen} ; trou noir aspire ${pull([])}, sans masse ${pull(['sansmasse'])} ; 100 cases +${pts([])}, discrétion payante +${pts(['payante'])}, infiltré +${pts(['infiltre'])} (touché +${touchedPts}) ; disparition : ${d1}, puis ${d2}`);
}
// Rembobineur
{
  const R = SHIPI('rew');
  const span = list => { withSk(R, list); return g.rwSpan(); };
  const refill = list => { withSk(R, list); g.rw.charge = 0; let n = 0; while (g.rw.charge < 3 - 1e-6 && n < 1000 * G) { g.seaStep(); n++; } return Math.round(n / G); };
  // rembobinage d'une seconde : durée réelle (ralenti), jauge consommée
  const play = (list, setup) => { withSk(R, list); g.P.shield = false; g.setDir('down'); step(90); if (setup) setup(); const c0 = g.rw.charge; g.rewind(); let n = 0; while (g.rw.play && n < 60 * 30) { step(1); n++; if (n === 120) g.rewind(); } return { frames: n, used: +(c0 - g.rw.charge).toFixed(2) }; };
  const a = play([]), b = play(['ralenti']), loop = play(['boucle'], () => { g.rw.charge = 0; });
  // écho / paradoxe : une boule immobile au bord du chemin, que le fantôme frôle en rembobinant
  const ghost2 = list => { withSk(R, list); g.P.shield = false; const e = g.makeFoe('out', 1); e.x = PX() + 1.25; e.y = PY() + 3; e.vx = e.vy = 0; g.foes.push(e); g.setDir('down'); step(20); g.rewind(); for (let i = 0; i < 60 * 20 && g.rw.play; i++) step(1); const f = g.foes.find(x => x.kind === 'out'); return !f || f.dead ? 'effacé' : f.stun > 0 ? 'assommé' : 'rien'; };
  withSk(R, ['hesit']); const win = g.rwWin();
  withSk(R, ['lecon']); g.P.shield = false; g.setDir('down'); step(90); g.crash(); step(40); g.rw.charge = 1.5; const lc0 = g.rw.charge; g.rewind(); for (let i = 0; i < 60 * 20 && g.rw.play; i++) { step(1); if (i === 60) g.rewind(); } const lecon = +(g.rw.charge - lc0).toFixed(2);
  withSk(R, ['arret']); g.P.shield = false; g.setDir('down'); step(60); g.rewind(); step(2); g.rewind(); for (let i = 0; i < 600 && g.rw.play; i++) step(1); const y0 = g.P.y; step(60); const frozen = g.P.y === y0; step(90); const thawed = g.P.y !== y0;
  withSk(R, ['prescience']); g.P.shield = false; g.setDir('down'); step(60); g.rewind(); step(2); g.rewind(); for (let i = 0; i < 600 && g.rw.play; i++) step(1); const pres = g.S.presT > 0;
  withSk(R, ['prudence']); const pr = g.maxLives();
  console.log(`rembobineur : jauge ${span([])} s, grand ${span(['grand'])}, géant ${span(['grand', 'geant'])} ; recharge complète ${refill([])} cases, sable fin ${refill(['sablefin'])} ; rembobinage arrêté après 2 s : ${a.used} s remontées, ralenti fin ${b.used} s ; boucle, jauge vide, rembobine quand même ${loop.used === 0 && loop.frames > 1} ; hésitation ${win} s`);
  console.log(`rembobineur : leçon +${lecon} s de jauge ; arrêt sur image, figé ${frozen}, puis repart ${thawed} ; prescience ${pres} ; prudence ${pr} vies max ; écho ${ghost2(['echo'])}, paradoxe ${ghost2(['paradoxe'])}, sans ${ghost2([])}`);
}
// Piégeur (et Coup bas du Furtif) : zones de plus en plus grandes refermées sur une boule
{
  const TR = SHIPI('trap');
  // descend jusqu'à la ligne « depth », puis file à gauche jusqu'au bord : zone d'environ 23 × (depth - 2) cases
  const zone = (ship, list, depth, foesAt, far = true) => {
    withSk(ship, list); g.P.shield = false;
    const fs_ = foesAt.map(([x, y, k]) => { const e = g.makeFoe(k || 'out', 1); e.x = x; e.y = y; e.vx = 0; e.vy = 0; g.foes.push(e); return e; });
    if (far) { const b = g.makeFoe('out', 1); b.x = 40.5; b.y = 58.5; g.foes.push(b); }
    const f0 = g.S.filled, s0 = g.S.score, l0 = g.S.lives, i0 = g.items.length;
    g.setDir('down'); let n = 0; while (g.P.y < depth * G && n++ < 400) step();
    g.setDir('left'); n = 0; while (g.P.drawing && n++ < 400) step();
    step(60);
    return { dead: fs_.every(e => e.dead || !g.foes.includes(e)), pct: (g.S.filled - f0) / g.S.interior * 100, pts: g.S.score - s0, lives: g.S.lives - l0, items: g.items.length - i0 };
  };
  const tag = r => (r.dead ? 'piégé' : 'libre') + ' (' + r.pct.toFixed(0) + ' %)';
  const one = [[10.5, 8.5]];
  console.log(`piégeur : zone de 14 % ${tag(zone(TR, [], 19, one))}, large ${tag(zone(TR, ['large'], 19, one))} ; 17 % ${tag(zone(TR, ['large'], 22, one))}, très large ${tag(zone(TR, ['large', 'tlarge'], 22, one))} ; 22 % ${tag(zone(TR, ['large', 'tlarge'], 29, one))}, géant ${tag(zone(TR, ['large', 'tlarge', 'geant'], 29, one))} ; 31 % avec un seul ennemi, nasse ${tag(zone(TR, ['nasse'], 40, one))}`);
  const hole = zone(TR, ['gibier'], 11, [[11, 6.5, 'amph']]), holeNo = zone(TR, [], 11, [[11, 6.5, 'amph']]);
  const p0 = zone(TR, [], 16, one).pts, p1 = zone(TR, ['prime'], 16, one).pts;
  const dbl = zone(TR, ['double'], 16, [[8.5, 8.5], [14.5, 10.5]]);
  const dep0 = zone(TR, [], 16, one).pct, dep1 = zone(TR, ['depouille'], 16, one).pct;
  const tab = zone(TR, ['tableau'], 16, one, false);
  const fur = SHIPI('fur'), cb = zone(fur, ['coupbas'], 8, [[10.5, 5.5]]), cbNo = zone(fur, [], 8, [[10.5, 5.5]]);
  console.log(`piégeur : trou noir dans 6 % -> gros gibier ${tag(hole)}, sans ${tag(holeNo)} ; points ${p0} -> prime ${p1} ; coup double, bonus apparu ${dbl.items > 0} ; dépouille +${(dep1 - dep0).toFixed(1)} % ; tableau de chasse +${tab.lives} vie ; furtif, coup bas dans 5 % ${tag(cb)}, sans ${tag(cbNo)}`);
  withSk(TR, ['collet']); g.P.shield = false; g.setDir('down'); step(20); { const e = g.makeFoe('out', 1); g.foes.push(e); g.onTrailHitX(e, g.trail[0]); var collet = e.slowT; }
  const wv = list => { withSk(TR, list); g.P.shield = false; g.setDir('down'); step(20); g.onTrailHitX(g.makeFoe('out', 1), g.trail[0]); return g.wave_.speed / G; };
  withSk(TR, ['leurre']); g.P.shield = false; g.setDir('left'); step(4); g.setDir('stop'); { const e = g.makeFoe('out', 1); e.x = PX() + 3; e.y = PY() + 8; e.vx = 6; e.vy = 0; g.foes.push(e); step(30); var lure = e.vx < 5.5 && e.vy < 0; }
  console.log(`piégeur : collet, ralenti ${collet} s ; onde ${wv([])} cases/s, filet ${wv(['filet'])} ; leurre, la boule vire vers lui ${lure}`);
}
// Monarque
{
  const M = SHIPI('mon');
  const ttl = list => { withSk(M, list); g.items.length = 0; g.spawnItem(); return +(g.items[0].ttl).toFixed(1); };
  const t0 = ttl([]), t1 = ttl(['patience']), t2 = ttl(['patience', 'majeste']);
  withSk(M, ['tresor']); g.items.length = 0; g.spawnItem(); const ty = g.items[0].type; g.collect(g.items[0]); const stored = g.S.tresor === ty; g.usePower(); const used = !g.S.tresor;
  withSk(M, ['divin']); g.items.length = 0; g.spawnItem(); const pair = g.items.length; g.collect(g.items[0]); const gone = g.items[1] && g.items[1].done;
  withSk(M, ['heraut'], 2); g.items.length = 0; g.S.bonusLeft = 1; g.S.bonusWait = 2.5; step(2); const h = g.S_.herald; step(200); const at = h && g.items[0] && Math.hypot(g.items[0].x - h.x, g.items[0].y - h.y) < .01;
  const inn = list => { withSk(M, list, 3); g.setupLevel(3); return g.foes.filter(e => e.kind === 'inn').length; };
  withSk(M, ['tribut']); const s0 = g.S.score; g.awardCells(Math.ceil(g.S.interior * .25), { x: 10, y: 10 }, false); const trib = g.S.score - s0 - Math.round(Math.ceil(g.S.interior * .25) * 10 / G / G);
  withSk(M, ['couronne']); const ml = g.maxLives();
  const sd = list => { withSk(M, list); return g.supDur(); };
  withSk(M, ['magnif']); { const e = g.makeFoe('out', 1); e.x = 30; e.y = 40; e.vx = e.vy = 0; g.foes.push(e); g.items.length = 0; g.spawnItem(); g.collect(g.items[0]); var mag = e.dead; }
  const pr = list => { let n = 0, w = 0; for (let k = 0; k < 400; k++) { withSk(M, list); n += g.S.bonusLeft; w += g.S.bonusWait; } return (n / 400).toFixed(2) + ' bonus, 1er à ' + (w / 400).toFixed(1) + ' s'; };
  console.log(`monarque : durée de vie ${t0} s, patience ${t1}, majesté ${t2} ; trésor, gardé ${stored}, déclenché ${used} ; droit divin, ${pair} proposés, l'autre disparaît ${gone} ; héraut, annoncé et apparu au même endroit ${!!at} ; gardiens au niveau 3 : ${inn([])}, garde royale ${inn(['garde'])}`);
  console.log(`monarque : tribut sur 25 % +${fmtN(trib)} ; couronnement ${ml} vies max ; super bonus ${sd([])} s, apparat ${sd(['apparat'])}, splendeur ${sd(['apparat', 'splendeur'])} ; magnificence, ennemi détruit ${mag} ; ${pr([])} -> prodigalité ${pr(['prodig'])}`);
}
// Flambeur
{
  const FL = SHIPI('gam');
  const cm = list => { withSk(FL, list); return g.chipsMax(); };
  withSk(FL, ['depart']); g.gam.chips = 2; g.setupLevel(2); const dep = g.gam.chips;
  const stats = (list, bet, n = 4000) => { withSk(FL, list); let w = 0, bad = 0, gold = 0, jack = 0, again = 0; for (let k = 0; k < n; k++) { const i = g.slotDraw(bet); if (i < 0) continue; const s = g.SLOT[i]; if (s.bad) bad++; else { w++; if (s.gold) gold++; if (s.k === 'jack') jack++; if (s.k === 'again') again++; } } return { w: w / n * 100, bad: bad / n * 100, gold: gold / Math.max(1, w) * 100, jack: jack / Math.max(1, w) * 100, again: again / Math.max(1, w) * 100 }; };
  const b0 = stats([], 1), main = stats(['main'], 1), fer = stats(['fer'], 1), fl = stats(['flambe'], 4), sept = stats(['sept'], 3, 20000), rej = stats(['rejoue'], 3);
  // une mise jouée jusqu'au bout (gain imposé en mode test)
  const spin = (list, force, extra) => { withSk(FL, list); g.S.test = true; g.gam.force = force || ''; g.gam.chips = 3; g.spinSlot(); if (extra) extra(); let n = 0; while (g.slot && n++ < 600) step(1); g.S.test = false; g.gam.force = ''; return g.gam.chips; };
  const ins0 = spin([], 'snail'), ins1 = spin(['assurance'], 'snail');
  withSk(FL, ['lynx']); g.gam.chips = 3; g.spinSlot(); const prize = g.slot && g.slot.prize; let lynxOk = true; { let n = 0; while (g.slot && g.slot.st !== 'spin' && n++ < 200) step(1); if (g.slot && g.slot.idx >= 0 && !g.SLOT[g.slot.idx].bad && g.slot.idx !== prize) lynxOk = false; }
  // tricheur : on attend le dernier rouleau, puis le moment où la machine s'illumine
  let cheat = 0, tries = 0; for (let k = 0; k < 20; k++) { withSk(FL, ['tricheur']); g.gam.chips = 3; g.spinSlot(); let n = 0; while (g.slot && !(g.slot.st === 'spin' && g.slot.stopped === 2 && g.cheatLit(g.slot)) && n++ < 600) step(1); if (!g.slot || g.slot.st !== 'spin') continue; tries++; g.spinSlot(); if (g.slot.idx >= 0 && !g.SLOT[g.slot.idx].bad) cheat++; }
  console.log(`flambeur : jetons max ${cm([])}, grosse bourse ${cm(['bourse'])}, coffre ${cm(['bourse', 'coffre'])} ; mise de départ 2 -> ${dep} ; 1 jeton : gagne ${b0.w.toFixed(0)} %, main chaude ${main.w.toFixed(0)} % ; coups durs ${b0.bad.toFixed(1)} %, fer à cheval ${fer.bad.toFixed(1)} %`);
  console.log(`flambeur : flambe (4 jetons) gagne ${fl.w.toFixed(0)} %, gros lots ${fl.gold.toFixed(0)} % des gains (contre ${b0.gold.toFixed(0)} %) ; 777 ${sept.jack.toFixed(1)} % des gains avec sept chanceux ; rejoue ${rej.again.toFixed(1)} % (contre ${b0.again.toFixed(1)} %) ; dernier rouleau ${g.slotStop(2)} s -> huilé ${(() => { withSk(FL, ['huile']); return g.slotStop(2).toFixed(2); })()} s ; coup dur, jetons après : ${ins0} -> assurance ${ins1} ; œil de lynx, gain tiré dès la mise ${prize >= 0} et tenu ${lynxOk} ; tricheur ${cheat}/${tries} gagnés`);
}
// Prédateur
{
  const PD = SHIPI('pred');
  // une proie posée devant lui, un bond : renvoie la proie
  const bite = (list, kind = 'out', setup) => { withSk(PD, list); g.P.shield = false; g.setDir('down'); step(20); const e = g.makeFoe(kind, 1); e.x = PX(); e.y = PY() + 2.2; e.vx = e.vy = 0; g.foes.push(e); if (setup) setup(); g.usePower(); step(20); return e; };
  const v = (list, f) => { withSk(PD, list); return f(); };
  const win = v([], g.predWin) + ' -> ' + v(['acharne'], g.predWin), mx = v([], g.predMax) + ' -> ' + v(['acharne', 'boucherie'], g.predMax);
  const bm = v([], g.bloodMax) + ' -> ' + v(['grosseveine'], g.bloodMax), reach = v([], g.biteReach).toFixed(1) + ' -> ' + v(['machoires'], g.biteReach).toFixed(1);
  const cd = (list, combo) => { withSk(PD, list); g.P.shield = false; g.setDir('left'); step(3); g.pred.combo = combo; g.pred.ct = 5; g.pred.bite = .01; g.pred.again = false; step(2); return g.pred.cd.toFixed(2); };
  const drain = list => { withSk(PD, list); g.P.shield = false; g.setDir('left'); step(4); const b0 = g.pred.blood; step(600); return +(b0 - g.pred.blood).toFixed(1); };
  const gain = list => { const e = bite(list, 'out', () => { g.pred.blood = 5; }); return +(g.pred.blood - 5).toFixed(1); };
  withSk(PD, ['grosseveine', 'metab', 'festin', 'souffle']); g.P.shield = false; g.setDir('left'); step(4); g.pred.blood = .05; step(10); const ds = g.S.phase + ' sang ' + g.pred.blood.toFixed(1); g.pred.blood = .05; step(10); const ds2 = g.S.phase;
  const apex = bite(['apex'], 'amph'), apexNo = bite([], 'amph');
  const chain = (() => { let n; const e = bite(['acharne', 'boucherie', 'dechaine', 'chaine'], 'out', () => { g.pred.combo = 4; const f = g.makeFoe('out', 1); f.x = PX() + 2; f.y = PY() + 3.2; f.vx = f.vy = 0; g.foes.push(f); n = f; }); return n.dead; })();
  const fear = list => { withSk(PD, list); g.P.shield = false; const e = g.makeFoe('out', 1); e.x = PX() + 4; e.y = PY() + 3; e.vx = 0; e.vy = 6; g.foes.push(e); const x0 = e.x, y0 = e.y; step(10); return +Math.hypot(e.x - x0, e.y - y0).toFixed(2); };
  console.log(`prédateur : combo tenu ${win} s, maximum ×${mx} ; sang ${bm} s ; portée ${reach} ; recharge du bond ${cd([], 0)} s, ressort ${cd(['ressort'], 0)} s, à ×4 ${cd([], 4)} s -> déchaîné ${cd(['dechaine'], 4)} s`);
  console.log(`prédateur : 10 s de jeu, sang perdu ${drain([])} -> métabolisme ${drain(['grosseveine', 'metab'])} ; une proie +${gain([])} s -> festin +${gain(['grosseveine', 'metab', 'festin'])} s ; dernier souffle : ${ds}, puis ${ds2} ; trou noir mangé ${apex.dead} (sans apex ${apexNo.dead}, ${g.S.phase}) ; réaction en chaîne, voisin emporté ${chain} ; proie effrayée parcourt ${fear([])} -> terreur ${fear(['terreur'])}`);
}
// Endurance : chaque vaisseau avec toutes ses compétences à la fois, parties au hasard sur plusieurs niveaux
{
  const out = [];
  g.SHIPS.forEach((sh, i) => {
    const all = g.SKILLS[sh.key].flatMap(b => b[2].map(n => n[0]));
    let s = 1234 + i * 77; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    let crashes = 0, levels = 0, last = '';
    for (const L of [3, 12, 22]) {
      g.newGame(2, L, i); g.setSkills(all); g.setupLevel(L); g.go();
      for (let f = 0; f < 2500; f++) {
        if (g.S.phase === 'ready') g.go();
        if (g.S.phase === 'over') { g.newGame(2, L, i); g.setSkills(all); g.setupLevel(L); g.go(); }
        if (g.S.phase === 'clear') { levels++; g.setupLevel(Math.min(25, g.S.level + 1)); g.go(); }
        if (rnd() < .02) g.usePower();
        if (rnd() < .04) g.setDir(DIRS[(rnd() * 4) | 0]);
        step();
        if (g.S.phase === 'crash' && last !== 'crash') crashes++;
        last = g.S.phase;
      }
    }
    out.push(sh.name.toLowerCase() + ' ' + crashes + ' crash(s)');
  });
  console.log('endurance, toutes les compétences à la fois : ' + out.join(', '));
}
// Rangs 4 et 5 : Veinard, Blindé, Frénétique
{
  const V = SHIPI('cla'), B = SHIPI('rob'), F = SHIPI('fre');
  withSk(V, ['aimant'], 3); g.items.length = 0; g.spawnItem(); const it = g.items[0]; it.x = PX() + 4; it.y = PY() + 3; it.type = 'chr'; const d0 = Math.hypot(it.x - PX(), it.y - PY()); step(10); const d1 = Math.hypot(it.x - PX(), it.y - PY());
  let pl0 = 0, pl1 = 0; for (let k = 0; k < 300; k++) { withSk(V, []); pl0 += g.S.bonusLeft; withSk(V, ['pluie']); pl1 += g.S.bonusLeft; }
  withSk(V, ['eclat'], 3); g.items.length = 0; g.spawnItem(); g.items[0].type = 'schr'; let s0 = g.S.score; g.collect(g.items[0]); const ecl = g.S.score - s0;
  withSk(V, ['entree']); const first = g.pickType(), second = g.pickType();
  let ouf = 0; for (let k = 0; k < 300; k++) { withSk(V, ['porteb']); g.P.shield = false; g.crash('wave'); if (g.S.phase === 'play') ouf++; }
  withSk(V, ['frole']); g.P.shield = false; g.setDir('down'); step(10); { const e = g.makeFoe('out', 1); e.x = PX() + 1.25; e.y = PY() + 3; e.vx = e.vy = 0; g.foes.push(e); } s0 = g.S.score; step(15); const fro = g.S.score - s0;
  console.log(`veinard 4-5 : aimant, bonus à ${d0.toFixed(1)} -> ${d1.toFixed(1)} cases ; pluie ${(pl0 / 300).toFixed(2)} -> ${(pl1 / 300).toFixed(2)} bonus ; éclat +${ecl} ; entrée royale ${first} puis ${second} ; porte-bonheur ${(ouf / 3).toFixed(0)} % d'ondes éteintes ; frôlé +${fro}`);
  const hitB = (list, src, drawing, hp = 1) => { withSk(B, list); g.armor.hp = hp; g.P.drawing = drawing; let e = src; if (src === 'foe') { e = g.makeFoe('out', 1); e.x = PX() + .5; e.y = PY(); g.foes.push(e); } g.armorHit(e); return +(hp - g.armor.hp).toFixed(3); };
  withSk(B, ['nanites']); g.armor.hp = .5; g.P.shield = false; g.setDir('left'); step(4); step(60 * 8); const nan = +(g.armor.hp - .5).toFixed(3);
  const tb = list => { withSk(B, list); g.P.shield = false; g.setDir('left'); step(3); const x = g.P.x; step(30); return (x - g.P.x) / G; };
  withSk(B, ['maint', 'revision']); g.armor.hp = .5; g.showClearX(); const rev = +g.armor.hp.toFixed(2);
  console.log(`blindé 4-5 : onde ${hitB([], 'wave', true)} -> blindage lourd ${hitB(['lourd'], 'wave', true)} ; nanites +${nan} en 8 s ; turbo ${tb([]).toFixed(1)} -> ${tb(['turbo']).toFixed(1)} cases ; charge ${hitB(['charge'], 'foe', true)} ; rouleau ${hitB(['rouleau'], 'foe', true)} ; révision 50 % -> ${rev} ; pare-chocs, 1er choc ${hitB(['parechoc'], 'out', false)}, 2e ${(() => { g.armorHit('out'); return +(1 - g.armor.hp).toFixed(2); })()} ; forteresse max ${(() => { withSk(B, ['forteresse']); return g.armorMax(); })()}`);
  withSk(F, ['etincelles']); { const a = g.makeFoe('out', 1), b = g.makeFoe('out', 1); a.x = 20; a.y = 30; b.x = 21.5; b.y = 30; g.foes.push(a, b); g.burnFoe(a); var et = b.dead; }
  withSk(F, ['cendres']); { const f0 = g.S.filled; const a = g.makeFoe('out', 1); a.x = 20; a.y = 30; g.foes.push(a); g.burnFoe(a); var cen = (g.S.filled - f0) / g.S.interior * 100; }
  withSk(F, ['adrenaline']); g.ab.on = 5; g.furyGain(g.S.interior * .3, false); const adr = +g.ab.fury.toFixed(2);
  withSk(F, ['rugissement']); g.ab.fury = 1; { const e = g.makeFoe('out', 1); e.x = PX() + 3; e.y = PY() + 3; g.foes.push(e); g.usePower(); var rug = e.stun > 0; }
  withSk(F, ['freins']); g.ab.fury = 1; g.setDir('down'); step(20); g.usePower(); step(5); g.setDir('stop'); const fy = g.P.y; step(10); const frein = g.P.y === fy;
  withSk(F, ['secondsouffle']); g.ab.fury = 1; g.setDir('down'); step(5); g.usePower(); g.ab.on = .05; step(5); const ss = g.ab.fury;
  console.log(`frénétique 4-5 : étincelles, voisin grillé ${et} ; cendres +${cen.toFixed(1)} % ; adrénaline, 30 % pendant la furie -> ${adr} ; rugissement, voisin assommé ${rug} ; freins, arrêté en pleine furie ${frein} ; second souffle ${ss}`);
}
// Rangs 4 et 5 : Encaisseur, Fulgurant, Furtif
{
  const E = SHIPI('enc'), FU = SHIPI('ful'), FT = SHIPI('fur');
  const hitE = (list, setup) => { withSk(E, list); g.P.shield = false; g.setDir('down'); step(20); if (setup) setup(); const e = g.makeFoe('out', 1); e.x = PX(); e.y = PY() + .6; e.vx = 0; e.vy = -5; g.foes.push(e); g.hitPlayer(e); return e; };
  hitE(['rechecl']); const rc = g.P.guard;
  withSk(E, ['miroir']); g.P.shield = false; g.setDir('down'); step(20); g.onTrailHitX(g.makeFoe('out', 1), g.trail[0]); const mir = !g.wave_;
  hitE(['contre']); g.P.grace = 0; { const f = g.makeFoe('out', 1); f.x = PX(); f.y = PY() + .4; g.foes.push(f); g.hitPlayer(f); var contre = f.stun > 0 && g.S.phase === 'play'; }
  let rip; hitE(['riposte'], () => { rip = g.makeFoe('out', 1); rip.x = PX() + 4; rip.y = PY(); g.foes.push(rip); });
  hitE(['meditation']); g.setDir('stop'); g.P.dir = { x: 0, y: 0 }; g.P.drawing = false; const gm0 = g.P.guard; step(60); const med = +(gm0 - g.P.guard).toFixed(1);
  withSk(E, ['intact']); g.S.lives = 1; g.S.lives0 = 1; g.showClearX(); const intact = g.S.lives;
  let rv; hitE(['renvoi'], () => { rv = g.makeFoe('out', 1); rv.x = PX() + 3; rv.y = PY(); g.foes.push(rv); });
  console.log(`encaisseur 4-5 : recharge éclair ${rc} ; miroir, pas d'onde ${mir} ; contre-attaque, l'ennemi est assommé ${contre} ; riposte, voisin assommé ${rip.stun > 0} ; méditation -${med} cases en 1 s ; intact, 1 -> ${intact} vies ; renvoi, voisin détruit ${rv.dead} ; inébranlable ${(() => { withSk(E, ['inebr']); return g.startLives(); })()} vies`);
  withSk(FU, ['sillage']); g.P.shield = false; g.planStart(); g.planTo(g.P.x, g.P.y + 20 * G); g.planLaunch(); step(15); { const e = g.makeFoe('out', 1); e.x = PX(); e.y = PY() - 4; e.vx = e.vy = 0; g.foes.push(e); step(3); var sil = e.stun > 0; }
  const surc = list => { withSk(FU, list); g.P.shield = false; const s0 = g.S.score; g.planStart(); g.planTo(g.P.x, g.P.y + 40 * G); g.planTo(g.P.x - 20 * G, g.P.y + 40 * G); g.planTo(g.P.x - 20 * G, 0); g.planLaunch(); step(60); return g.S.score - s0; };
  withSk(FU, ['calme']); g.P.shield = false; g.planStart(); g.planTo(g.P.x, g.P.y + 6 * G); g.planLaunch(); step(10); const calm = g.foeSlow();
  withSk(FU, ['cyclone']); g.P.shield = false; { const e = g.makeFoe('out', 1); e.x = PX() + 2; e.y = PY() + 1; e.vx = -6; e.vy = 0; g.foes.push(e); g.planStart(); step(2); var cyc = e.vx > 0; }
  withSk(FU, ['fusible']); g.P.shield = false; { const e = g.makeFoe('out', 1); e.x = PX(); e.y = PY() + 8; e.vx = e.vy = 0; g.foes.push(e); g.planStart(); g.planTo(g.P.x, g.P.y + 20 * G); g.planLaunch(); step(30); var fus = g.S.phase; }
  withSk(FU, ['chaine']); g.P.shield = false; { const a = g.makeFoe('out', 1), b = g.makeFoe('out', 1); a.x = 40; a.y = 50; b.x = 10; b.y = 55; a.vx = a.vy = b.vx = b.vy = 0; g.foes.push(a, b); g.planStart(); g.planTo(g.P.x, g.P.y + 6 * G); g.planLaunch(); step(30); var ch2 = a.dead && b.dead; }
  console.log(`fulgurant 4-5 : sillage électrique, ennemi posé sur le trajet assommé ${sil} ; long éclair ${surc([])} -> surcharge ${surc(['surcharge'])} ; calme, monde à ${calm} ; œil du cyclone, repoussé ${cyc} ; fusible : ${fus} ; foudre en chaîne, deux ennemis ${ch2} ; survolté ${(() => { withSk(FU, ['survolte']); return g.startLives() + ' / ' + g.maxLives(); })()}`);
  withSk(FT, ['manuel', 'optique']); g.usePower(); const opt = g.camo.on;
  withSk(FT, ['manuel', 'camoflash']); g.usePower(); const cf = g.camo.cd;
  withSk(FT, ['brouillage']); g.P.shield = false; g.setDir('left'); step(5); { const e = g.makeFoe('inn', 1); e.x = PX(); e.y = PY(); g.foes.push(e); g.hitPlayer(e); var br = g.S.phase; }
  withSk(FT, ['indetect']); g.P.shield = false; g.setDir('down'); step(20); { const h = g.makeFoe('hunt', 1); h.x = PX(); h.y = PY() + 5; h.hd = -Math.PI / 2; g.foes.push(h); var ind = g.huntSees(h); }
  const mega = list => { withSk(FT, list); const s0 = g.S.score; g.awardCells(Math.ceil(g.S.interior * .2), { x: 10, y: 10 }, true); return g.S.score - s0; };
  withSk(FT, ['pickpocket'], 3); g.camo.on = 3; g.items.length = 0; g.spawnItem(); g.items[0].type = 'chr'; let s1 = g.S.score; g.collect(g.items[0]); const pick = g.S.score - s1;
  console.log(`furtif 4-5 : optique ${opt} s ; recharge rapide ${cf} cases ; brouillage, gardien sur son terrain -> ${br} ; indétectable, chasseur à 5 cases le voit ${ind} ; MEGA ${mega([])} -> précision ${mega(['precision'])} ; pickpocket +${pick}`);
}
// Rangs 4 et 5 : Rembobineur, Piégeur, Monarque
{
  const R = SHIPI('rew'), TR = SHIPI('trap'), M = SHIPI('mon');
  withSk(R, ['remontee']); g.rw.charge = 1; g.setDir('down'); step(40); g.setDir('right'); step(20); g.setDir('up'); step(60); const rem = +(g.rw.charge - 1).toFixed(2);
  const rwEnd = list => { withSk(R, list); g.P.shield = false; g.setDir('down'); step(60); g.rewind(); step(2); g.rewind(); for (let i = 0; i < 600 && g.rw.play; i++) step(1); };
  rwEnd(['dejavu']); const dv = g.S.safe > 0;
  rwEnd(['bulle']); const bul = g.foeSlow();
  withSk(R, ['secondechance']); g.P.shield = false; g.setDir('down'); step(90); g.crash(); step(40); g.rw.charge = 1.5; g.rewind(); for (let i = 0; i < 60 * 20 && g.rw.play; i++) { step(1); if (i === 60) g.rewind(); } const sc = g.rw.charge;
  withSk(R, ['flashback']); g.P.shield = false; g.setDir('down'); step(90); g.rw.charge = 0; g.crash(); step(40); const can = g.canRewind(); g.rewind(); let fn = 0; for (let i = 0; i < 60 * 30 && g.rw.play; i++) { step(1); fn++; } const fb = g.S.phase;
  console.log(`rembobineur 4-5 : remontée +${rem} s ; titanesque ${(() => { withSk(R, ['titan']); return g.rwSpan(); })()} s ; déjà-vu, intouchable ${dv} ; bulle temporelle, monde à ${bul} ; seconde chance, jauge 1,5 -> ${sc} ; flashback, rembobinable sans jauge ${can}, puis ${fb}`);
  const zone = (list, depth, foesAt, far = true) => {
    withSk(TR, list); g.P.shield = false;
    const fs_ = foesAt.map(([x, y, k]) => { const e = g.makeFoe(k || 'out', 1); e.x = x; e.y = y; e.vx = 0; e.vy = 0; g.foes.push(e); return e; });
    if (far) { const b = g.makeFoe('out', 1); b.x = 40.5; b.y = 58.5; g.foes.push(b); g.__far = b; }
    const s0 = g.S.score, l0 = g.S.lives;
    g.setDir('down'); let n = 0; while (g.P.y < depth * G && n++ < 400) step();
    g.setDir('left'); n = 0; while (g.P.drawing && n++ < 400) step();
    return { dead: fs_.every(e => e.dead || !g.foes.includes(e)), pts: g.S.score - s0, lives: g.S.lives - l0 };
  };
  const ac = zone(['acier'], 27, [[10.5, 8.5]]).dead, acNo = zone(['tlarge'], 27, [[10.5, 8.5]]).dead;
  zone(['fermeture'], 16, [[10.5, 8.5]]); const ferm = g.__far.slowT > 0;
  const col = zone(['collection'], 16, [[8.5, 8.5], [14.5, 10.5, 'perf']]).pts - zone([], 16, [[8.5, 8.5], [14.5, 10.5, 'perf']]).pts;
  g.newGame(1, 1, TR); g.S.usedGame.trapped = 5; g.setSkills(['trophee']); g.setupLevel(1); g.go(); g.foes.length = 0; const l0 = g.S.lives; { const e = g.makeFoe('out', 1); e.x = 10.5; e.y = 8.5; e.vx = e.vy = 0; g.foes.push(e); const b = g.makeFoe('out', 1); b.x = 40.5; b.y = 58.5; g.foes.push(b); g.P.shield = false; g.setDir('down'); let n = 0; while (g.P.y < 16 * G && n++ < 400) step(); g.setDir('left'); n = 0; while (g.P.drawing && n++ < 400) step(); } const tro = g.S.lives - l0;
  withSk(TR, ['glu']); g.P.shield = false; g.setDir('down'); step(20); { const e = g.makeFoe('out', 1); g.foes.push(e); g.onTrailHitX(e, g.trail[0]); var glu = e.stun > 0; }
  const cage = list => { withSk(TR, list); g.P.shield = false; g.setDir('down'); step(100); g.onTrailHitX(g.makeFoe('perf', 1), g.trail[0]); step(90); return g.S.phase; };
  console.log(`piégeur 4-5 : zone de 20 %, très large ${acNo ? 'piégé' : 'libre'}, mâchoires d'acier ${ac ? 'piégé' : 'libre'} ; fermeture éclair, l'autre ennemi ralenti ${ferm} ; collection +${col} ; trophée de vie, 6e ennemi +${tro} vie ; glu ${glu} ; onde lancée loin derrière : ${cage([])}, cage ${cage(['cage'])}`);
  withSk(M, ['tresor', 'coffret']); for (let k = 0; k < 2; k++) { g.items.length = 0; g.spawnItem(); g.collect(g.items[0]); } const two = !!(g.S_.tresor && g.S_.tresor2); g.usePower(); const left = !!g.S_.tresor;
  withSk(M, ['tresor', 'joyau']); g.items.length = 0; g.spawnItem(); g.collect(g.items[0]); g.usePower(); const joy = g.S.safe > 0;
  withSk(M, ['emissaire'], 3); let far = 0; for (let k = 0; k < 30; k++) { g.items.length = 0; g.spawnItem(); const it = g.items[0]; if (it && Math.hypot(it.x - PX(), it.y - PY()) > 15.5) far++; }
  const inn = list => { withSk(M, list, 3); g.setupLevel(3); return g.foes.filter(e => e.kind === 'inn').length; };
  let cor = 0; for (let k = 0; k < 400; k++) { withSk(M, ['cortege'], 3); g.S.lives = 1; g.items.length = 0; g.spawnItem(); g.collect(g.items[0]); if (g.S.lives > 1) cor++; }
  withSk(M, ['divin'], 3); g.items.length = 0; g.spawnItem(); const three = g.items.length; g.collect(g.items[0]); const gone = g.items.filter(x => x.done).length;
  console.log(`monarque 4-5 : coffret, deux trésors ${two}, il en reste un après usage ${left} ; joyau, invincible ${joy} ; émissaire, loin ${far}/30 ; gardiens niveau 3 : ${inn([])}, garde + courtisans ${inn(['garde', 'courtisans'])} ; cortège, vie ${(cor / 4).toFixed(0)} % ; droit divin, ${three} proposés, ${gone} retirés`);
}
// Rangs 4 et 5 : Flambeur, Prédateur
{
  const FL = SHIPI('gam'), PD = SHIPI('pred');
  withSk(FL, ['pot']); g.gam.chips = g.chipsMax(); g.items.length = 0; g.spawnItem(); let s0 = g.S.score; g.collect(g.items[0]); const pot = g.S.score - s0;
  withSk(FL, ['bourse', 'coffre', 'banque']); const bq = g.chipsMax();
  const winRate = (list, serie) => { withSk(FL, list); let w = 0; for (let k = 0; k < 4000; k++) { g.gam.serie = serie; const i = g.slotDraw(1); if (i >= 0 && !g.SLOT[i].bad) w++; } return (w / 40).toFixed(0); };
  const skulls = list => { withSk(FL, list); let n = 0; for (let k = 0; k < 6000; k++) { const i = g.slotDraw(1); if (i >= 0 && g.SLOT[i].k === 'skull') n++; } return n; };
  let ch0 = 0, ch1 = 0; for (let k = 0; k < 300; k++) { withSk(FL, []); ch0 += g.S.bonusLeft; withSk(FL, ['aimantjeton']); ch1 += g.S.bonusLeft; }
  const manche = list => { withSk(FL, list); g.S.test = true; g.gam.force = 'none'; g.gam.chips = 3; g.spinSlot(); let n = 0, spins = 0, was = ''; while (g.slot && n++ < 900) { step(1); const st = g.slot ? g.slot.st : ''; if (st === 'spin' && was !== 'spin') spins++; was = st; } g.S.test = false; g.gam.force = ''; return spins; };
  console.log(`flambeur 4-5 : pot commun +${pot} ; banque ${bq} jetons ; 1 jeton gagne ${winRate([], false)} %, après un gain (série) ${winRate(['serie'], true)} % ; têtes de mort ${skulls([])} -> talisman ${skulls(['talisman'])} ; jetons ${(ch0 / 300).toFixed(2)} -> aimantés ${(ch1 / 300).toFixed(2)} ; tirage perdu : ${manche([])} tour, carte dans la manche ${manche(['manche'])} tours`);
  const bite = (list, kind = 'out', setup) => { withSk(PD, list); g.P.shield = false; g.setDir('down'); step(20); const e = g.makeFoe(kind, 1); e.x = PX(); e.y = PY() + 2.2; e.vx = e.vy = 0; g.foes.push(e); if (setup) setup(); g.usePower(); step(20); return e; };
  const pts = list => { let s1; bite(list, 'out', () => { s1 = g.S.score; }); return g.S.score - s1; };
  let far; bite(['hurlement'], 'out', () => { g.pred.combo = 4; far = g.makeFoe('out', 1); far.x = PX() + 7; far.y = PY() + 4; far.vx = far.vy = 0; g.foes.push(far); });
  const drain = list => { withSk(PD, list); g.P.shield = false; g.setDir('left'); step(4); g.pred.blood = 6; step(120); return +(6 - g.pred.blood).toFixed(2); };
  bite(['ivresse'], 'out', () => { g.pred.blood = 5; const f = g.makeFoe('out', 1); f.x = PX(); f.y = PY() + 3.4; f.vx = f.vy = 0; g.foes.push(f); }); const ivr = +g.pred.blood.toFixed(1);
  const bl = list => { withSk(PD, list); g.P.shield = false; g.setDir('down'); step(10); g.usePower(); return +g.pred.bite.toFixed(3); };
  withSk(PD, ['paralysie']); g.P.shield = false; { const e = g.makeFoe('out', 1); e.x = PX() + 2; e.y = PY() + 2; e.vx = 5; e.vy = 0; g.foes.push(e); const x0 = e.x; step(10); var par = e.x === x0; }
  withSk(PD, ['souffle']); g.P.shield = false; g.setDir('left'); step(4); const ds = []; for (let k = 0; k < 3; k++) { g.pred.blood = .05; step(10); ds.push(g.S.phase === 'play' ? Math.round(g.pred.blood) : g.S.phase); }
  console.log(`prédateur 4-5 : une proie +${pts([])}, brutalité +${pts(['brutal'])} ; hurlement, ennemi à 8 cases assommé ${far.stun > 0} ; 2 s sous 25 % : -${drain([])} s, réserve -${drain(['reserve'])} s ; ivresse, doublé -> ${ivr} s ; bond ${bl([])} s, grand bond ${bl(['grandbond'])} s ; paralysie, figé ${par} ; dernier souffle ${ds.join(' / ')}`);
}
// 5k) Les pouvoirs ne se rechargent pas entre les niveaux (et restent dans la sauvegarde)
{
  g.newGame(1, 1, 2); g.go(); g.ab.fury = .4; g.showClear(); g.setupLevel(2);
  const cdKept = g.ab.fury;
  g.newGame(1, 1, 3); g.go(); g.P.guard = 30; g.showClear(); g.setupLevel(2);
  const guardKept = g.P.guard;
  g.newGame(1, 1, 6); g.go(); g.rw.charge = 1.2; g.showClear(); g.setupLevel(2);
  console.log(`entre deux niveaux : jauge de furie ${cdKept} (0.4), bouclier ${guardKept} (30), jauge rembobinage ${g.rw.charge} (1.2)`);
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
  console.log(`prédateur : sans fil ${noTrail} ; bond -> proie dévorée ${prey.dead}, combo ${g.pred.combo}, +${((g.S.filled - f0) / g.S.interior * 100).toFixed(1)} % de terrain, +${g.S.score - s0} points, recharge du bond après la proie ${g.pred.cd} (0), phase ${g.S.phase}`);
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
  // dernière proie tuée autrement (ici pulvérisée sous Super Casque) : la zone tombe quand même
  start(); g.foes.length = 0; const sm = g.makeFoe('out', 1); sm.x = PX(); sm.y = PY() + 1.2; sm.vx = 0; sm.vy = 0; g.foes.push(sm);
  g.power.sup = 10; step(10);
  console.log(`prédateur : dernière proie pulvérisée sous Super Casque (${sm.dead}) -> ${(g.S.filled / g.S.interior * 100).toFixed(0)} % conquis, phase ${g.S.phase}`);
  // jauge SANG ! : elle se vide, chaque proie la remplit (plus pour un doublé), à sec il meurt ; morsure plus large
  start(); const b0 = g.pred.blood; step(60); const drain = b0 - g.pred.blood;
  const p1 = g.makeFoe('out', 1); p1.x = PX(); p1.y = PY() + 6; p1.vx = 0; p1.vy = 0; g.foes.push(p1);
  const bb = g.pred.blood; g.usePower(); step(20); const gain = g.pred.blood - bb;
  start(); g.pred.blood = 10;
  const d1 = g.makeFoe('out', 1); d1.x = PX(); d1.y = PY() + 4; d1.vx = 0; d1.vy = 0;
  const d2 = g.makeFoe('out', 1); d2.x = PX(); d2.y = PY() + 8; d2.vx = 0; d2.vy = 0; g.foes.push(d1, d2);
  g.usePower(); step(25); const dbl = g.pred.blood;
  start(); const side = g.makeFoe('out', 1); side.x = PX() + 1.4; side.y = PY() + 6; side.vx = 0; side.vy = 0; g.foes.push(side); g.usePower(); step(20);
  console.log(`prédateur, SANG ! : ${drain.toFixed(2)} s perdues en 1 s ; une proie à ×1 rend ${gain.toFixed(1)} s ; doublé dans un bond (${d1.dead && d2.dead}) : 10 -> ${dbl.toFixed(1)} s ; proie à 1,4 case du trajet mordue ${side.dead}`);
  start(); g.pred.blood = .05; step(5); const ph = g.S.phase, lv = g.S.lives; step(200);
  // élan : après une proie, l'ennemi suivant percuté sur sa lancée est mangé (et non un crash) ; l'élan retombé, un contact tue
  start(); const q1 = g.makeFoe('out', 1); q1.x = PX(); q1.y = PY() + 4; q1.vx = 0; q1.vy = 0; g.foes.push(q1);
  g.usePower(); let nn = 0; while (g.pred.bite > 0 && nn++ < 60) step();
  const q2 = g.makeFoe('out', 1); q2.x = PX(); q2.y = PY() + 1.3; q2.vx = 0; q2.vy = 0; g.foes.push(q2); step(6);
  const carried = q1.dead && q2.dead && g.S.phase === 'play';
  nn = 0; while ((g.pred.bite > 0 || g.pred.tail > 0) && nn++ < 120) step(); step(2);
  const q3 = g.makeFoe('out', 1); q3.x = PX(); q3.y = PY() + 1.3; q3.vx = 0; q3.vy = 0; g.foes.push(q3); step(8);
  console.log(`prédateur, élan : proie suivante percutée juste après le bond mangée ${carried} ; élan retombé, contact -> ${g.S.phase}`);
  console.log(`prédateur, SANG ! à sec -> ${ph}, ${lv} vie(s) ; il repart avec ${g.pred.blood.toFixed(0)} s de sang`);
}

// 5r) Ennemis universels (première fournée) : étincelle, serpent, mine, comète, aimant, écho, scarabée, chapardeur
{
  const W = i => [(i % g.GC + .5) / G, (((i / g.GC) | 0) + .5) / G];
  // une boule immobile tout en bas garde la zone à conquérir (sans ennemi, une conquête prendrait tout)
  const begin = (ship = 0) => { g.newGame(1, 1, ship); g.go(); g.foes.length = 0; const b = g.makeFoe('out', 1); b.x = 25; b.y = 60; b.vx = b.vy = 0; g.foes.push(b); };
  const add = (kind, x, y, vx = 0, vy = 0) => { const e = g.makeFoe(kind, 1); if (x !== undefined) { e.x = x; e.y = y; } e.vx = vx; e.vy = vy; g.foes.push(e); return e; };
  // Étincelle : elle se pose sur le fil sans onde, remonte jusqu'au vaisseau ; un aller-retour en U lui échappe
  begin(); g.setDir('down'); step(60);
  let sp = add('spark', ...W(g.trail[4])); g.onTrailHit(sp, g.trail[4]);
  const rides = sp.ride != null, noWave = !g.wave;
  let n = 0; while (g.S.phase === 'play' && n++ < 200) step();
  const caught = g.S.phase === 'crash';
  begin(); g.setDir('down'); step(45); g.setDir('right'); step(45);
  sp = add('spark', ...W(g.trail[2])); g.onTrailHit(sp, g.trail[2]); const f0 = g.S.filled;
  g.setDir('up'); n = 0; while (g.P.drawing && g.S.phase === 'play' && n++ < 200) step(); step(5);
  console.log(`étincelle : se pose sur le fil ${rides}, sans onde ${noWave}, rattrape un vaisseau qui file tout droit ${caught} ; aller-retour en U : ${g.S.phase}, zone conquise ${g.S.filled > f0}, retombée du fil ${sp.ride == null}`);
  // Serpent : son corps qui touche le fil déclenche l'onde de choc ; son corps tue au contact
  begin(); g.setDir('down'); step(60);
  const [tx, ty] = W(g.trail[20]);
  let sn = add('snake', tx + 9, ty, 5, 0); sn.body = Array.from({ length: 24 }, (_, j) => ({ x: tx + 9 - j * .21 * 2, y: ty }));
  step(1);
  const snWave = !!g.wave;
  begin(); g.setDir('down'); step(30); g.setDir('stop');
  sn = add('snake', PX() + 6, PY() + 6, 0, 5); sn.body = Array.from({ length: 24 }, (_, j) => ({ x: PX() + 6 - j * .3, y: PY() + (j > 18 ? .1 : 6) }));
  sn.body[19] = { x: PX(), y: PY() }; sn.body[20] = { x: PX(), y: PY() }; step(1);
  console.log(`serpent : corps sur le fil -> onde ${snWave} ; corps sur le vaisseau -> ${g.S.phase}`);
  // Mine : s'arme quand le fil passe à moins de 3 cases, explose (onde de choc), se reforme
  begin(); g.setDir('down'); step(40);
  const mi = add('mine', PX() + 2.4, PY() + 6); step(30);
  const armed = mi.st === 'arm' || mi.st === 'gone';
  g.setDir('left'); step(1); g.setDir('up'); step(60);
  const blew = mi.st === 'gone', ph1 = g.S.phase;
  n = 0; while (mi.st === 'gone' && n++ < 400) step();
  console.log(`mine : armée ${armed}, explosion ${blew} (phase ${ph1}), reformée après ${(n / 60).toFixed(1)} s`);
  begin(); g.setDir('down'); step(40); g.power.chr = 30; g.setDir('stop');
  add('mine', PX() + 1.5, PY() + 1.5); n = 0; while (g.S.phase === 'play' && n++ < 200) step(); const ph2 = g.S.phase;
  begin(); const m3 = add('mine', 25, 50); m3.st = 'gone'; m3.t = 5; n = 0; while (m3.st === 'gone' && n++ < 400) step();
  console.log(`mine : vaisseau arrêté dans le rayon -> ${ph2} ; une mine qui a explosé se reforme après ${(n / 60).toFixed(1)} s`);
  // Comète : alerte, puis traversée en ligne droite, même au-dessus du terrain conquis
  begin(); g.setDir('left'); step(12); g.setDir('stop'); step(70);
  const co = add('comet'); co.t = .05; n = 0; let warned = false;
  while (g.S.phase === 'play' && n++ < 400) { step(); if (co.st === 'warn') warned = true; }
  console.log(`comète : alerte ${warned}, vaisseau immobile sur son terrain -> ${g.S.phase} (${(n / 60).toFixed(1)} s)`);
  begin(); g.setDir('left'); step(12); g.setDir('stop'); step(70);
  const c2 = add('comet'); c2.t = .05; n = 0; while (c2.st !== 'fly' && n++ < 200) step(); g.setDir('down'); step(3); g.setDir('right');
  n = 0; while (c2.st === 'fly' && g.S.phase === 'play' && n++ < 300) step();
  console.log(`comète : esquivée en bougeant -> ${g.S.phase}, repartie en attente ${c2.st === 'wait'}`);
  // Aimant : rouge, il attire ; bleu, il repousse
  const magRun = pol => { begin(); g.setDir('down'); step(40); g.setDir('stop'); g.power.chr = 30; g.setDir('stop'); const x0 = PX(); const m = add('mag', x0 + 5, PY()); m.pol = pol; m.pt = 99; step(40); return +(PX() - x0).toFixed(2); };
  const pull = magRun(1), push = magRun(-1);
  console.log(`aimant : attire de ${pull} cases, repousse de ${push} cases en 2/3 s (vaisseau arrêté sous Chrono)`);
  // Écho : il refait le trajet du vaisseau 5 s plus tard ; immobile, on se fait rattraper
  begin(); g.setDir('left'); step(2);
  const ec = add('echo'); n = 0; let seen = 0;
  while (g.S.phase === 'play' && n++ < 900) { step(); if (ec.on && !seen) seen = n; }
  console.log(`écho : apparaît après ${(seen / 60).toFixed(1)} s, le vaisseau arrêté au mur est rattrapé -> ${g.S.phase} après ${(n / 60).toFixed(1)} s`);
  begin(); g.setDir('left'); step(2); add('echo'); step(170); g.setDir('down'); step(370);
  console.log(`écho : vaisseau qui longe le bord sans revenir sur ses pas pendant 9 s -> ${g.S.phase}`);
  // Scarabée : il reste sur le bord du terrain conquis et avance
  begin(); const sc2 = add('scar');
  let onCoast = true, dist = 0, px = sc2.x, py = sc2.y;
  const coastAt = (x, y) => { const gx = Math.floor(x * G), gy = Math.floor(y * G), at = (a, b) => a < 0 || b < 0 || a >= g.GC || b >= g.GR ? 1 : g.grid[b * g.GC + a]; return at(gx, gy) === 1 && (at(gx - 1, gy) !== 1 || at(gx + 1, gy) !== 1 || at(gx, gy - 1) !== 1 || at(gx, gy + 1) !== 1); };
  for (let k = 0; k < 300; k++) { step(); dist += Math.hypot(sc2.x - px, sc2.y - py); px = sc2.x; py = sc2.y; if (!coastAt(sc2.x, sc2.y)) onCoast = false; }
  g.setDir('down'); step(20); g.setDir('right'); step(20); g.setDir('up'); n = 0; while (g.P.drawing && n++ < 200) step();
  let onCoast2 = true; for (let k = 0; k < 300; k++) { step(); if (g.S.phase !== 'play') break; if (!coastAt(sc2.x, sc2.y)) onCoast2 = false; }
  console.log(`scarabée : ${dist.toFixed(1)} cases en 5 s, toujours sur le bord ${onCoast} ; après une conquête, toujours sur le bord ${onCoast2}`);
  begin(); g.setDir('down'); step(20); g.setDir('right'); step(20); g.setDir('up'); n = 0; while (g.P.drawing && n++ < 200) step(); step(70);
  const sc3 = add('scar', PX(), PY()); sc3.gx = sc3.ox = g.P.x; sc3.gy = sc3.oy = g.P.y; step(2);
  console.log(`scarabée : au contact du vaisseau -> ${g.S.phase}`);
  // Chapardeur : il vole le bonus avant le vaisseau, et le rend s'il est détruit
  begin(); g.items.push({ type: 'inv', x: 25.5, y: 40.5, vx: 0, vy: 0, age: 0, ttl: 60, done: false });
  const th = add('thief', 33, 40, -5, 0); n = 0; while (g.items.length && n++ < 300) step();
  const stolen = th.loot.length === 1 && g.power.inv === 0;
  th.dead = true; step(1);
  console.log(`chapardeur : bonus volé ${stolen} (en ${(n / 60).toFixed(1)} s), détruit -> butin rendu, Casque actif ${g.power.inv > 0}`);
  // tous ensemble, avec plusieurs vaisseaux, au hasard
  const NEW = ['spark', 'snake', 'mine', 'comet', 'mag', 'echo', 'scar', 'thief'];
  let s = 4242; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let sh = 0; sh < g.SHIPS.length; sh++) {
    const fill = () => { for (const k of NEW) g.foes.push(g.makeFoe(k, 1)); };
    g.newGame(1, 3, sh); g.go(); fill(); let cr = 0, last = '';
    for (let f = 0; f < 2500; f++) {
      if (g.S.phase === 'ready') g.setDir('down');
      if (g.S.phase === 'over') { g.newGame(1, 3, sh); g.go(); fill(); }
      if (rnd() < 0.01 || (g.S.phase === 'crash' && rnd() < 0.05)) g.usePower();
      if (rnd() < 0.04) g.setDir(DIRS[(rnd() * 4) | 0]);
      if (rnd() < 0.005) g.setDir('stop');
      if (rnd() < 0.004) g.items.push({ type: ['inv', 'chr', 'terr', 'life'][(rnd() * 4) | 0], x: 5 + rnd() * 40, y: 10 + rnd() * 50, vx: 0, vy: 0, age: 0, ttl: 20, done: false });
      step();
      if (g.S.phase === 'crash' && last !== 'crash') cr++;
      last = g.S.phase;
    }
    console.log(`ennemis universels avec ${g.SHIPS[sh].name} : 2500 frames ok, ${cr} crashs, ${g.foes.length} ennemis`);
  }
}
// 5t) Océania : île, oxygène, lenteur sous l'eau, poches d'air et stations
{
  const OC = g.ECOS.findIndex(e => e.key === 'ocea');
  const order = [0, OC, ...[1, 2, 3, 4, 5, 6, 7].filter(i => i !== OC)];
  const shipIdx = k => g.SHIPS.findIndex(s => s.key === k);
  const ocea = (L = 4, ship = 0) => {
    g.newGame(2, 1, ship); g.S.ecos = order.slice(); g.setupLevel(L); g.go();
    g.foes.length = 0; const b = g.makeFoe('out', 1); b.x = 25; b.y = 62; b.vx = b.vy = 0; g.foes.push(b);
  };
  const dive = () => { g.setDir('down'); let n = 0; while (!g.P.drawing && n++ < 200) step(); };
  ocea();
  console.log(`Océania : île de ${g.oc.n} cases (${(g.S.filled / g.S.interior * 100).toFixed(1)} % au départ), ${g.oc.pockets.length} poches d'air, ${g.oc.o2} s d'air`);
  // sous l'eau, 20 % moins vite (comparé à Terra Nova)
  g.newGame(2, 1, 0); g.go(); g.foes.length = 0; g.setDir('down'); step(20); let y0 = g.P.y; step(30); const dry = g.P.y - y0;
  ocea(); g.setDir('down'); step(40); y0 = g.P.y; step(30); const wet = g.P.y - y0;
  console.log(`vitesse en 0,5 s : Terra Nova ${dry} cases, sous l'eau ${wet} cases (${(wet / dry * 100).toFixed(0)} %)`);
  ocea(); dive(); let o = g.oc.o2; step(120); const seaDrop = o - g.oc.o2;
  ocea(); g.setDir('left'); step(150); o = g.oc.o2; step(120); const landDrop = o - g.oc.o2;
  g.oc.o2 = 5; g.P.x = g.P.px = g.GC >> 1; g.P.y = g.P.py = 0; g.P.dir = { x: 0, y: 0 }; step(60); const refill = g.oc.o2 - 5;
  console.log(`air en 2 s : -${seaDrop.toFixed(1)} s dans la zone à conquérir, -${landDrop.toFixed(1)} s sur le terrain conquis ; +${refill.toFixed(1)} s en 1 s sur l'île`);
  ocea(); dive(); g.power.inv = 30; g.oc.o2 = 10; step(120); const helm = g.oc.o2;
  ocea(); dive(); const lv = g.S.lives; g.oc.o2 = .3; let n = 0; while (g.S.phase === 'play' && n++ < 120) step();
  const drowned = g.S.phase; n = 0; while (g.S.phase === 'crash' && n++ < 400) step();
  console.log(`sous Casque : ${helm.toFixed(1)} s d'air après 2 s (sur 10) ; à sec -> ${drowned}, vies ${lv} -> ${g.S.lives}, reprise ${g.S.phase} avec ${g.oc.o2} s d'air`);
  ocea(4, shipIdx('rob')); dive(); g.armor.hp = 1; g.oc.o2 = .2; step(30);
  console.log(`Blindé à sec : ${g.S.phase}, blindage ${Math.round(g.armor.hp * 100)} %, air ${g.oc.o2.toFixed(1)} s`);
  // poche d'air sur le trajet du vaisseau, puis poche enfermée devenue station
  ocea(); const p0 = g.oc.pockets[0]; p0.x = 25.25; p0.y = 12;
  g.oc.o2 = 5; g.setDir('down'); step(90);
  console.log(`poche d'air traversée : prise ${p0.gone}, air ${g.oc.o2.toFixed(1)} s (5 avant)`);
  ocea(); const p1 = g.oc.pockets[0];
  for (let y = g.GR - 1; y >= 0; y--) for (let x = 0; x < g.GC; x++) if (Math.hypot((x + .5) / G - p1.x, (y + .5) / G - p1.y) < 3) g.grid[g.at(x, y)] = 1;
  step(2);
  g.setDir('left'); step(3); g.P.x = g.P.px = Math.floor(p1.x * G); g.P.y = g.P.py = Math.floor(p1.y * G); g.P.dir = { x: 0, y: 0 }; g.P.next = null; g.oc.o2 = 5; step(60);
  console.log(`poche enfermée : station ${p1.station}, air près d'elle ${g.oc.o2.toFixed(1)} s en 1 s (5 avant)`);
  let s = 99; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let sh = 0; sh < g.SHIPS.length; sh++) {
    const start = () => { g.newGame(2, 1, sh); g.S.ecos = order.slice(); g.setupLevel(6); g.go(); };
    start(); let cr = 0, last = '', low = 99;
    for (let f = 0; f < 2500; f++) {
      if (g.S.phase === 'ready') g.setDir('down');
      if (g.S.phase === 'over') start();
      if (rnd() < 0.01 || (g.S.phase === 'crash' && rnd() < 0.05)) g.usePower();
      if (rnd() < 0.04) g.setDir(DIRS[(rnd() * 4) | 0]);
      if (rnd() < 0.005) g.setDir('stop');
      step(); if (g.oc) low = Math.min(low, g.oc.o2);
      if (g.S.phase === 'crash' && last !== 'crash') cr++;
      last = g.S.phase;
    }
    console.log(`Océania épreuve avec ${g.SHIPS[sh].name} : 2500 frames ok, ${cr} crashs, air au plus bas ${low.toFixed(1)} s`);
  }
}
// 5u) Nébula : brouillard (rayon de vision par étape), éclairs qui dévoilent
{
  const NB = g.ECOS.findIndex(e => e.key === 'nebu');
  const order = [0, NB, ...[1, 2, 3, 4, 5, 6, 7].filter(i => i !== NB)];
  const radii = [4, 5, 6].map(L => { g.newGame(2, 1, 0); g.S.ecos = order.slice(); g.setupLevel(L); return g.fg ? g.fg.r : 'aucun'; });
  g.newGame(2, 1, 0); g.S.ecos = order.slice(); g.setupLevel(4); g.go(); g.setDir('down');
  let flashes = 0, prev = 0;
  for (let f = 0; f < 1200; f++) { step(); const n = g.fg.flashes.length; if (n > prev) flashes++; prev = n; }
  g.newGame(2, 1, 0); g.go(); const terra = g.fg;
  console.log(`Nébula : vision ${radii.join(' / ')} cases selon l'étape, ${flashes} éclairs en 20 s, pas de brouillard sur Terra Nova ${terra === null}`);
  let s = 123; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (const sh of [0, 4, 10]) {
    const start = () => { g.newGame(2, 1, sh); g.S.ecos = order.slice(); g.setupLevel(6); g.go(); };
    start(); let cr = 0, last = '';
    for (let f = 0; f < 2500; f++) {
      if (g.S.phase === 'ready') g.setDir('down');
      if (g.S.phase === 'over') start();
      if (rnd() < 0.01 || (g.S.phase === 'crash' && rnd() < 0.05)) g.usePower();
      if (rnd() < 0.04) g.setDir(DIRS[(rnd() * 4) | 0]);
      if (rnd() < 0.005) g.setDir('stop');
      step();
      if (g.S.phase === 'crash' && last !== 'crash') cr++;
      last = g.S.phase;
    }
    console.log(`Nébula épreuve avec ${g.SHIPS[sh].name} : 2500 frames ok, ${cr} crashs`);
  }
}
// 5v) Glacia : camp et feu, gel qui ralentit puis fige le vaisseau, plaques de glace
{
  const GL = g.ECOS.findIndex(e => e.key === 'glace');
  const order = [0, GL, ...[1, 2, 3, 4, 5, 6, 7].filter(i => i !== GL)];
  const shipIdx = k => g.SHIPS.findIndex(s => s.key === k);
  const glace = (L = 4, ship = 0) => {
    g.newGame(2, 1, ship); g.S.ecos = order.slice(); g.setupLevel(L); g.go();
    g.foes.length = 0; const b = g.makeFoe('out', 1); b.x = 5; b.y = 62; b.vx = b.vy = 0; g.foes.push(b);
    g.iceG.fill(0);
  };
  const dive = () => { g.setDir('down'); let n = 0; while (!g.P.drawing && n++ < 200) step(); };
  const plates = [4, 5, 6].map(L => { g.newGame(2, 1, 0); g.S.ecos = order.slice(); g.setupLevel(L); return g.ic.plates.length + ' (' + g.ic.plates.reduce((a, p) => a + p.cells.length, 0) + ' cases)'; });
  glace();
  console.log(`Glacia : camp de ${g.ic.n} cases (${(g.S.filled / g.S.interior * 100).toFixed(1)} % au départ), plaques de glace par étape ${plates.join(' / ')}`);
  glace(); dive(); let f0 = g.ic.frost; step(120); const seaUp = g.ic.frost - f0;
  glace(); g.setDir('left'); step(150); f0 = g.ic.frost; step(120); const landUp = g.ic.frost - f0;
  g.ic.frost = 40; g.P.x = g.P.px = g.GC >> 1; g.P.y = g.P.py = 0; g.P.dir = { x: 0, y: 0 }; step(60); const thaw = 40 - g.ic.frost;
  console.log(`gel en 2 s : +${seaUp.toFixed(1)} s dans la zone à conquérir, +${landUp.toFixed(1)} s sur le terrain ; -${thaw.toFixed(1)} s en 1 s près du feu`);
  const run = fr => { glace(); dive(); g.ic.frost = fr; const y0 = g.P.y; step(30); return g.P.y - y0; };
  const v0 = run(0), v30 = run(30), v50 = run(50);
  console.log(`vitesse en 0,5 s : ${v0} cases sans gel, ${v30} à 30 s (${(v30 / v0 * 100).toFixed(0)} %), ${v50} à 50 s (${(v50 / v0 * 100).toFixed(0)} %)`);
  glace(); dive(); g.power.inv = 30; g.ic.frost = 10; step(120); const helm = g.ic.frost;
  glace(); dive(); const lv = g.S.lives; g.ic.frost = 59.7; let n = 0; while (g.S.phase === 'play' && n++ < 120) step();
  const froze = g.S.phase; n = 0; while (g.S.phase === 'crash' && n++ < 400) step();
  console.log(`sous Casque : ${helm.toFixed(1)} s de gel après 2 s (10 avant) ; gelé -> ${froze}, vies ${lv} -> ${g.S.lives}, reprise ${g.S.phase} avec ${g.ic.frost} s de gel`);
  glace(4, shipIdx('rob')); dive(); g.armor.hp = 1; g.ic.frost = 59.9; step(30);
  console.log(`Blindé gelé : ${g.S.phase}, blindage ${Math.round(g.armor.hp * 100)} %, gel ${g.ic.frost.toFixed(1)} s`);
  glace(4, shipIdx('fre')); dive(); g.ab.on = 8; g.ic.frost = 20; step(60);
  console.log(`furie du Frénétique : gel ${g.ic.frost.toFixed(1)} s après 1 s (20 avant)`);
  // une plaque de glace sous le vaisseau : il file tout droit, plus vite, le virage attend la sortie
  const sheet = () => { const cx = g.GC >> 1; for (let y = 24; y < 70; y++) for (let x = cx - 8; x <= cx + 8; x++) g.iceG[g.at(x, y)] = 1; };
  glace(); sheet(); dive(); n = 0; while (!(g.iceG[g.at(g.P.x, g.P.y)]) && n++ < 200) step();
  let y0 = g.P.y; step(30); const vIce = g.P.y - y0;
  glace(); sheet(); dive(); n = 0; while (!(g.iceG[g.at(g.P.x, g.P.y)]) && n++ < 200) step();
  g.setDir('left'); step(10); const still = g.P.dir.y === 1 && g.P.dir.x === 0;
  g.power.chr = 5; g.setDir('stop'); step(2); const nostop = !!(g.P.dir.x || g.P.dir.y); g.power.chr = 0;
  n = 0; while (g.iceG[g.at(g.P.x, g.P.y)] && n++ < 300) step(); step(2);
  const turned = g.P.dir.x === -1;
  console.log(`sur la glace : ${vIce} cases en 0,5 s (${(vIce / v0 * 100).toFixed(0)} %), pas de virage ${still}, pas d'arrêt ${nostop}, virage à la sortie ${turned}`);
  glace(); g.iceG.fill(0); for (let y = 0; y < g.GR; y++) for (let x = 0; x < 50; x++) g.iceG[g.at(x, y)] = 1;
  const a = g.makeFoe('out', 1), b = g.makeFoe('out', 1); a.x = 12; b.x = 38; a.y = b.y = 40; a.vx = b.vx = 0; a.vy = b.vy = 5; g.foes.length = 0; g.foes.push(a, b);
  step(30); console.log(`ennemis : ${(a.y - 40).toFixed(2)} cases sur la glace, ${(b.y - 40).toFixed(2)} à côté en 0,5 s`);
  let s = 77; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let sh = 0; sh < g.SHIPS.length; sh++) {
    const start = () => { g.newGame(2, 1, sh); g.S.ecos = order.slice(); g.setupLevel(6); g.go(); };
    start(); let cr = 0, last = '', hi = 0;
    for (let f = 0; f < 2500; f++) {
      if (g.S.phase === 'ready') g.setDir('down');
      if (g.S.phase === 'over') start();
      if (rnd() < 0.01 || (g.S.phase === 'crash' && rnd() < 0.05)) g.usePower();
      if (rnd() < 0.04) g.setDir(DIRS[(rnd() * 4) | 0]);
      if (rnd() < 0.005) g.setDir('stop');
      step(); if (g.ic) hi = Math.max(hi, g.ic.frost);
      if (g.S.phase === 'crash' && last !== 'crash') cr++;
      last = g.S.phase;
    }
    console.log(`Glacia épreuve avec ${g.SHIPS[sh].name} : 2500 frames ok, ${cr} crashs, gel au plus haut ${hi.toFixed(1)} s`);
  }
}
// 5w) Voltaria : le fil attire la foudre, globes à plasma libres et capturés
{
  const VT = g.ECOS.findIndex(e => e.key === 'volt');
  const order = [0, VT, ...[1, 2, 3, 4, 5, 6, 7].filter(i => i !== VT)];
  const shipIdx = k => g.SHIPS.findIndex(s => s.key === k);
  const volt = (L = 4, ship = 0) => {
    g.newGame(2, 1, ship); g.S.ecos = order.slice(); g.setupLevel(L); g.go();
    g.foes.length = 0; const b = g.makeFoe('out', 1); b.x = 5; b.y = 62; b.vx = b.vy = 0; g.foes.push(b);
    g.vt.pyl.length = 0;
  };
  const pyl = [4, 5, 6].map(L => { g.newGame(2, 1, 0); g.S.ecos = order.slice(); g.setupLevel(L); return g.vt.pyl.length; });
  // un long fil vers le bas : la charge monte, la cible se pose, l'éclair coupe le fil
  volt(); g.setDir('down'); let n = 0, c15 = -1, aim = -1, hit = -1, len = 0, wave = false;
  while (n++ < 400 && g.S.phase === 'play') {
    if (n === 45) g.setDir('right'); if (n === 90) g.setDir('down'); if (n === 115) g.setDir('left'); if (n === 160) g.setDir('down');
    step();
    const L = g.trail.length / G;
    if (c15 < 0 && L >= 15) c15 = g.vt.charge;
    if (aim < 0 && g.vt.tk >= 0) aim = n;
    if (g.vt.bolts.length) { hit = n; len = L; wave = !!g.wave; break; }
  }
  console.log(`Voltaria : globes par étape ${pyl.join(' / ')} ; charge ${c15.toFixed(2)} à 15 cases de fil, cible après ${(aim / 60).toFixed(1)} s, éclair après ${(hit / 60).toFixed(1)} s (fil de ${len.toFixed(0)} cases), onde de choc ${wave}, vaisseau ${g.S.phase}`);
  n = 0; while (g.S.phase === 'play' && g.P.drawing && n++ < 300) step();
  console.log(`après l'éclair : ${g.S.phase}, en train de tracer ${g.P.drawing}, vies ${g.S.lives}`);
  // sous Casque, avec le Furtif : pas de charge
  volt(); g.power.inv = 30; g.setDir('down'); step(200); const helm = g.vt.charge;
  volt(4, shipIdx('fur')); g.setDir('down'); step(200); const fur = g.vt.charge;
  console.log(`charge après 3,3 s de fil : sous Casque ${helm.toFixed(2)}, Furtif ${fur.toFixed(2)}`);
  // globe à soi : il protège le fil autour de lui ; libre : il attire la foudre
  const chargeAt = (mine, free) => {
    volt(); if (mine) g.vt.pyl.push({ x: 25.25, y: 14, mine: true, cd: 99, ph: 0 }); if (free) g.vt.pyl.push({ x: 28, y: 14, mine: false, cd: 99, ph: 0 });
    g.setDir('down'); step(110); return g.vt.charge;
  };
  const c0 = chargeAt(false, false), cm = chargeAt(true, false), cf = chargeAt(false, true);
  console.log(`charge après 1,8 s : sans globe ${c0.toFixed(2)}, près d'un globe à soi ${cm.toFixed(2)}, près d'un libre ${cf.toFixed(2)}`);
  volt(); const p = { x: 25, y: 40, mine: false, cd: 1, ph: 0 }; g.vt.pyl.push(p);
  for (let y = 0; y < g.GR; y++) for (let x = 0; x < g.GC; x++) if (Math.hypot((x + .5) / G - 25, (y + .5) / G - 40) < 3) g.grid[g.at(x, y)] = 1;
  const e = g.makeFoe('out', 1); e.x = 25; e.y = 36.5; e.vx = e.vy = 0; g.foes.push(e);
  g.setDir('left'); step(240);
  console.log(`globe enfermé : à soi ${p.mine}, ennemi à 3,5 cases foudroyé ${!!e.dead || !g.foes.includes(e)}`);
  // Prédateur : la cible se pose sur lui, il s'en écarte (ou pas)
  for (const flee of [true, false]) {
    volt(4, shipIdx('pred')); g.setDir('down'); step(40); n = 0; while (g.vt.warn <= 0 && n++ < 600) { g.P.dir = { x: 0, y: 0 }; step(); }
    const lv = g.S.lives;
    if (!flee) { g.P.dir = { x: 0, y: 0 }; g.P.next = null; }
    else g.setDir('right');
    n = 0; while (!g.vt.bolts.length && n++ < 300) { if (!flee) { g.P.dir = { x: 0, y: 0 }; } step(); }
    step(2);
    console.log(`Prédateur ${flee ? 'qui s\'écarte' : 'immobile'} : éclair ${(n / 60).toFixed(1)} s après la cible, ${g.S.phase}, vies ${lv} -> ${g.S.lives}`);
  }
  let s = 55; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let sh = 0; sh < g.SHIPS.length; sh++) {
    const start = () => { g.newGame(2, 1, sh); g.S.ecos = order.slice(); g.setupLevel(6); g.go(); };
    start(); let cr = 0, last = '', bolts = 0, prev = 0;
    for (let f = 0; f < 2500; f++) {
      if (g.S.phase === 'ready') g.setDir('down');
      if (g.S.phase === 'over') start();
      if (rnd() < 0.01 || (g.S.phase === 'crash' && rnd() < 0.05)) g.usePower();
      if (rnd() < 0.03) g.setDir(DIRS[(rnd() * 4) | 0]);
      if (rnd() < 0.005) g.setDir('stop');
      step();
      if (g.vt) { const b = g.vt.bolts.length; if (b > prev) bolts++; prev = b; }
      if (g.S.phase === 'crash' && last !== 'crash') cr++;
      last = g.S.phase;
    }
    console.log(`Voltaria épreuve avec ${g.SHIPS[sh].name} : 2500 frames ok, ${cr} crashs, ${bolts} éclairs`);
  }
}
// 5s) Planètes : ambiance de chacune, gouffres de lave et météores de Pyros
{
  const PYR = g.ECOS.findIndex(e => e.key === 'pyros');
  const order = [0, PYR, ...[1, 2, 3, 4, 5, 6, 7].filter(i => i !== PYR)];
  const shipIdx = k => g.SHIPS.findIndex(s => s.key === k);
  // une partie dont la 2e planète est Pyros (niveaux 4 à 6), une boule immobile en bas, pas de météore imprévu
  const pyros = (L = 4, ship = 0) => {
    g.newGame(2, 1, ship); g.S.ecos = order.slice(); g.setupLevel(L); g.go();
    g.foes.length = 0; const b = g.makeFoe('out', 1); b.x = 25; b.y = 62; b.vx = b.vy = 0; g.foes.push(b);
    g.hz.next = 999;
  };
  const counts = [4, 5, 6].map(L => { pyros(L); return `${g.pools.length} gouffres (${g.pools.reduce((a, p) => a + p.cells.length, 0)} cases)`; });
  console.log(`Pyros : découverte ${counts[0]}, plus dur ${counts[1]}, épreuve ${counts[2]} ; niveau 6 = ${g.S.comp.eco.name}, étape ${g.S.comp.stage}`);
  // un couloir de terrain conquis du haut jusqu'au bord du premier gouffre
  const corridor = () => {
    const p = g.pools[0]; let top = p.cells[0];
    for (const i of p.cells) if (i < top) top = i;
    const x = top % g.GC, y0 = (top / g.GC) | 0;
    for (let y = 0; y < y0; y++) g.grid[g.at(x, y)] = 1;
    g.P.x = g.P.px = x; g.P.y = g.P.py = 0; p.y0 = y0;
    return p;
  };
  // jusqu'à ce que le vaisseau ait dépassé le haut du gouffre (ou se soit arrêté, ou crashé)
  const reach = p => { let n = 0; while (g.S.phase === 'play' && g.P.y <= p.y0 + 3 && (g.P.dir.y || g.P.next) && n++ < 900) step(); };
  pyros(); reach(corridor(g.setDir('down'))); let n = 0;
  const burned = g.S.phase;
  pyros(); let p0 = corridor(); g.power.inv = 30; g.setDir('down'); reach(p0);
  const helm = g.S.phase; n = 0; while (g.P.drawing && n++ < 400) step(); step(3);
  console.log(`gouffre : le vaisseau qui y entre -> ${burned} ; sous Casque -> ${helm}, refroidi en refermant le fil posé dessus ${!p0.live}`);
  pyros(4, shipIdx('rob')); g.armor.hp = 1; p0 = corridor(); g.setDir('down'); reach(p0); step(10);
  const rob = `${g.S.phase}, blindage ${Math.round(g.armor.hp * 100)} %`;
  pyros(4, shipIdx('enc')); p0 = corridor(); g.setDir('down'); reach(p0);
  const enc = `${g.S.phase}, arrêté hors de la lave ${!g.lavaG[g.at(g.P.x, g.P.y)]}`;
  console.log(`gouffre : Blindé -> ${rob} ; Encaisseur -> ${enc}`);
  pyros(); p0 = g.pools[0]; const s0 = g.S.score; g.grid[p0.cells[0]] = 1; step(2);
  console.log(`gouffre touché par du terrain conquis : refroidi ${!p0.live}, +${g.S.score - s0} points, cases de lave restantes ${p0.cells.filter(i => g.lavaG[i]).length}`);
  // météores
  const meteor = (x, y, s, t) => g.meteors.push({ x, y, s, R: 1.4 + s * 2.6, t, T: t, ox: 5, h: 40 });
  pyros(); g.setDir('left'); step(10); g.setDir('stop'); step(70);
  meteor(PX(), PY(), .3, .3); n = 0; while (g.S.phase === 'play' && n++ < 60) step();
  const still = g.S.phase;
  pyros(); g.setDir('left'); step(10); g.setDir('stop'); step(70);
  meteor(PX(), PY(), .3, .8); g.setDir('right'); step(60);
  console.log(`météore : vaisseau immobile sur son terrain -> ${still} ; esquivé en bougeant -> ${g.S.phase}`);
  pyros(); g.setDir('down'); step(30);
  const ti = g.trail[6]; meteor((ti % g.GC + .5) / G, (((ti / g.GC) | 0) + .5) / G, .2, .05); step(4);
  const cut = !!g.wave; n = 0; while (g.S.phase === 'play' && g.P.drawing && n++ < 300) step();
  console.log(`météore sur le fil : onde de choc ${cut} -> ${g.S.phase}`);
  pyros();
  let spot = null;
  for (let y = 20; y < 60 && !spot; y += 2) for (let x = 8; x < 42 && !spot; x += 2) if (g.pools.every(p => Math.hypot(p.cx - x, p.cy - y) > p.R + 4)) spot = [x, y];
  const np = g.pools.length; meteor(spot[0], spot[1], .9, .05); step(3);
  const pud = g.pools.length > np && g.pools[g.pools.length - 1].temp;
  step(8.6 * 60);
  console.log(`gros météore en pleine zone : flaque de lave ${pud}, refroidie 8 s plus tard ${g.pools.filter(p => p.temp).length === 0}`);
  // chaque planète : son ambiance tourne sans erreur (avec des touches au hasard)
  let s = 77; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const amb = [];
  for (let i = 0; i < g.ECOS.length; i++) {
    g.newGame(2, 1, 0); g.go(); g.ecoSetup(g.ECOS[i], 2);
    for (let f = 0; f < 400; f++) { if (g.S.phase === 'ready') g.setDir('down'); if (rnd() < .04) g.setDir(DIRS[(rnd() * 4) | 0]); step(); }
    amb.push(g.amb.key);
  }
  console.log(`ambiances : ${amb.join(', ')}`);
  // mode test : la planète choisie dans la barre donne son ambiance et ses dangers
  g.S.test = true; g.S.ship = 0; g.S.testEco = PYR; g.testReset();
  console.log(`mode test sur ${g.ECOS[PYR].name} : ambiance ${g.amb.key}, ${g.pools.length} gouffres, météores ${!!g.hz}`);
  g.S.testEco = 0; g.testReset(); g.S.test = false;
  // après un crash, on repart aussitôt (sans écran d'info), dans la zone protégée, là où on est mort
  pyros(); g.setDir('down'); step(20); const lv = g.S.lives, cx = PX(); g.crash(); n = 0; while (g.S.phase === 'crash' && n++ < 400) step();
  console.log(`reprise après un crash : phase ${g.S.phase} après ${(n / 60).toFixed(1)} s, zone protégée ${g.P.shield}, vies ${lv} -> ${g.S.lives}, repart à ${Math.abs(PX() - cx).toFixed(1)} case(s) du crash`);
  // Pyros épreuve avec chaque vaisseau, au hasard
  for (let sh = 0; sh < g.SHIPS.length; sh++) {
    const start = () => { g.newGame(2, 1, sh); g.S.ecos = order.slice(); g.setupLevel(6); g.go(); };
    start(); let cr = 0, last = '', met = 0;
    for (let f = 0; f < 2500; f++) {
      if (g.S.phase === 'ready') g.setDir('down');
      if (g.S.phase === 'over') start();
      if (rnd() < 0.01 || (g.S.phase === 'crash' && rnd() < 0.05)) g.usePower();
      if (rnd() < 0.04) g.setDir(DIRS[(rnd() * 4) | 0]);
      if (rnd() < 0.005) g.setDir('stop');
      const m0 = g.meteors.length; step(); if (g.meteors.length < m0) met++;
      if (g.S.phase === 'crash' && last !== 'crash') cr++;
      last = g.S.phase;
    }
    console.log(`Pyros épreuve avec ${g.SHIPS[sh].name} : 2500 frames ok, ${cr} crashs, ${met} météores tombés, ${g.pools.length} gouffres`);
  }
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
