import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const load = createRequire(import.meta.url);
load.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
globalThis.Image = class { complete = false; naturalWidth = 0; };
const { WorldSystem } = load('../src/game/systems/WorldProps.ts');
const { SpatialGrid } = load('../src/game/engine/SpatialGrid.ts');
const { VFXManager } = load('../src/game/entities/VFX.ts');
let seed = 123456789;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const world = new WorldSystem('amazon_forest');
const trees = world.trees, decor = world.decorTrees;
const bruteDecor = (x, y, radius) => decor.some(t => Math.hypot(x - t.x, y - t.y) < radius + world.getDecorTreeCollisionRadius(t));
const bruteTrees = (x, y, radius) => (world.forestCave?.collides(x, y, radius) ?? false) ||
  trees.some(t => Math.hypot(x - t.x, y - t.y) < radius + t.size * .32) || bruteDecor(x, y, radius);
const points = Array.from({ length: 8000 }, () => ({ x: (random() - .5) * 14500, y: (random() - .5) * 14500, radius: random() * 120 }));
for (const radius of [512, 513, 2000, 20000, Infinity]) points.push({ x: 0, y: 0, radius });
for (const t of [...trees, ...decor]) for (const side of [-1, 1]) points.push({ x: t.x + side * 18, y: t.y, radius: 18 });
for (const p of points) {
  assert.equal(world.collidesWithTree(p.x, p.y, p.radius), bruteTrees(p.x, p.y, p.radius));
  assert.equal(world.collidesWithDecorTree(p.x, p.y, p.radius), bruteDecor(p.x, p.y, p.radius));
}
// Compare complete movement resolution with the same narrow phase using full scans.
for (let i = 0; i < 500; i++) {
  const t = decor[i % decor.length];
  const x = t.x + (random() - .5) * 100, y = t.y + (random() - .5) * 100;
  const dx = (random() - .5) * 150, dy = (random() - .5) * 150;
  for (const [method, args] of [['resolvePlayerMovement', [x, y, dx, dy, 18]], ['resolveLandMovement', [x, y, x + dx, y + dy, 35]]]) {
    const actual = world[method](...args), ti = world.treeIndex, di = world.decorTreeIndex;
    world.treeIndex = world.decorTreeIndex = null;
    try { assert.deepEqual(actual, world[method](...args)); }
    finally { world.treeIndex = ti; world.decorTreeIndex = di; }
  }
}
console.log(`PASS: ${points.length} broad-phase queries and 1000 movement resolutions match full scenery scans`);

const mouths = world.getRiverMouthGeometries();
const mouthWater = (x, y, inset) => mouths.some(m => {
  if (y < Math.min(m.startY, m.endY) || y > Math.max(m.startY, m.endY)) return false;
  const span = m.endY - m.startY;
  const p = world.getRiverMouthProfile((y - m.startY) / (Math.abs(span) < 1 ? 1 : span), m);
  return Math.abs(x - p.centerX) <= p.halfWidth - inset;
});
const mouthMud = (x, y) => !world.isNavigableWater(x, y, 0) && mouths.some(m => {
  if (y < Math.min(m.startY, m.endY) || y > Math.max(m.startY, m.endY)) return false;
  const span = m.endY - m.startY;
  const p = world.getRiverMouthProfile((y - m.startY) / (Math.abs(span) < 1 ? 1 : span), m);
  const offset = Math.abs(x - p.centerX);
  return offset > p.halfWidth && offset <= p.halfWidth + world.getMudBandThickness(p.centerX);
});
for (const m of mouths) for (let i = 0; i < 5000; i++) {
  const x = m.anchorX + (random() - .5) * 3000;
  const y = m.startY + (m.endY - m.startY) * random();
  for (const inset of [-250, 0, 50, 250]) assert.equal(world.isRiverMouthWater(x, y, inset), mouthWater(x, y, inset));
  assert.equal(world.isRiverMouthMud(x, y), mouthMud(x, y));
}
console.log('PASS: water and mud broad phases preserve mouth geometry, including positive/negative insets');

const grid = new SpatialGrid(100);
const entities = Array.from({ length: 1000 }, (_, id) => ({ id, x: (random() - .5) * 800, y: (random() - .5) * 800, radius: 8 + random() * 80 }));
for (const e of entities) grid.insert(e);
for (const e of entities) {
  const radius = e.radius * 2; let vx = 0, vy = 0;
  for (const other of grid.queryRadius(e.x, e.y, radius)) {
    if (other.id === e.id) continue;
    const dx = e.x - other.x, dy = e.y - other.y, squared = dx * dx + dy * dy;
    if (squared > 0 && squared < radius * radius) {
      const d = Math.sqrt(squared), push = (radius - d) / radius;
      vx += dx / d * push; vy += dy / d * push;
    }
  }
  assert.deepEqual(grid.applySeparation(e, radius, .45), { vx: vx * .45, vy: vy * .45 });
}
console.log('PASS: separation matches the prior query-based summation exactly');

const vfx = new VFXManager();
for (let i = 0; i < 100; i++) vfx.addDamageNumber(0, 0, 7);
assert.equal(vfx.damageNumbers.length, 1); assert.equal(vfx.damageNumbers[0].text, '700');
vfx.addDamageNumber(0, 0, 5, true); vfx.addDamageNumber(0, 0, 3, false, true);
vfx.addDamageNumber(0, 0, 4, true, true);
assert.deepEqual(vfx.damageNumbers.map(n => n.text), ['700', '5', '+3', '+4']);
for (let i = 0; i < 10000; i++) {
  vfx.addDamageNumber(i * 40, i * 40, 10);
  vfx.addDeathBurst(0, 0); vfx.addSparks(0, 0);
}
assert.ok(vfx.damageNumbers.length <= 160); assert.ok(vfx.particles.length <= 512);
vfx.update(1);
assert.equal(vfx.count, 0);
vfx.addDamageNumber(0, 0, 2); assert.equal(vfx.damageNumbers[0].text, '2');
vfx.clear(); assert.equal(vfx.count, 0); assert.equal(vfx.numberBuckets.size, 0);
console.log('PASS: cosmetic bounds, aggregation totals, separate critical/heal groups, expiry and reset');
