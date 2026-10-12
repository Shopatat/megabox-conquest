// Test de fumée : exécute le script du jeu dans Node avec un faux DOM et simule des parties.
// Usage (depuis la racine du projet) : node tools/smoke.js index.html
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
let src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
src = src.replace('titleScreen();\nrequestAnimationFrame(frame);', `titleScreen();
globalThis.__g = { newGame, setDir, S, comp, get P() { return P; }, get foes() { return foes; }, get trail() { return trail; },
  get wave() { return wave; }, get grab() { return grab; }, get grid() { return grid; }, onTrailHit, at, collect, announce, power, get items() { return items; }, DIFFS };
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

function play(d, L, frames, seed) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.newGame(d, L); g.setDir('down'); step(2);
  let crashes = 0, lastPhase = '';
  for (let f = 0; f < frames; f++) {
    if (g.S.phase === 'ready') g.setDir('down');
    if (g.S.phase === 'over') g.newGame(d, L);
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
  for (let L = 1; L <= 25; L += 2) { const c = g.comp(L, d); rows.push(`${String(L).padStart(2)}:${c.out}/${c.perf}/${c.inn}/${c.amph}/${c.eat}=${c.out + c.perf + c.inn + c.amph + c.eat}`); }
  console.log(g.DIFFS[d].short.padEnd(4), rows.join('  '));
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

// 6) Parties aléatoires
let tot = 0;
for (const [d, L] of [[0, 1], [1, 1], [1, 13], [2, 13], [2, 21], [2, 25], [0, 25]]) {
  const c = play(d, L, 6000, 12345 + d * 7 + L);
  tot += c; console.log(`partie d=${d} L=${L} : 6000 frames ok, ${c} crashs, ${g.foes.length} ennemis`);
}
console.log('OK');
