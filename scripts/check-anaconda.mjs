import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Standalone simulation checks; no browser, extra dependency or test framework.
const load = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
load.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
globalThis.Image = class { complete = false; naturalWidth = 0; };
globalThis.window = { innerWidth: 800, innerHeight: 600, addEventListener() {}, removeEventListener() {} };
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const { GameEngine } = load(path.join(root, 'src/game/engine/GameEngine.ts'));
const { Enemy } = load(path.join(root, 'src/game/entities/Enemy.ts'));
const { AnacondaBoss } = load(path.join(root, 'src/game/entities/AnacondaBoss.ts'));
const { GorillaBoss } = load(path.join(root, 'src/game/entities/GorillaBoss.ts'));
const { EquipmentDrop } = load(path.join(root, 'src/game/entities/EquipmentDrop.ts'));
const { AcidRain } = load(path.join(root, 'src/game/entities/AcidRain.ts'));
const { AnacondaVisual } = load(path.join(root, 'src/game/entities/AnacondaVisual.ts'));
const { Camera } = load(path.join(root, 'src/game/engine/Camera.ts'));
const { CHARACTERS } = load(path.join(root, 'src/game/data/characters.ts'));
const { loadSavedData } = load(path.join(root, 'src/game/data/persistence.ts'));
const { ANACONDA: C } = load(path.join(root, 'src/game/data/anaconda.ts'));
const { ANACONDA_GLOVES, FOREST_ARMOR } = load(path.join(root, 'src/game/data/inventory.ts'));
const sep = { vx: 0, vy: 0 };

function engine(map = 'amazon_forest') {
  let rewards = 0, dialogues = 0;
  const e = new GameEngine({ getContext: () => ({ scale() {} }), parentElement: { clientWidth: 800, clientHeight: 600 } },
    CHARACTERS[0], loadSavedData(), 'normal', map, {
      onHUDUpdate() {}, onLevelUp() {}, onTreasureChest() {}, onGameOver() {}, onVictory() {},
      onEquipmentReward() { rewards++; }, onAnacondaDialogue() { dialogues++; },
    });
  e.sound.setMuted(true);
  e.weaponSystem.update = () => {};
  e.player.godMode = true;
  return { e, rewards: () => rewards, dialogues: () => dialogues };
}
function target(x = C.x + 500, y = C.y) {
  return { x, y, radius: 14, isJumping: false, godMode: false, invulnerableTimer: 0 };
}
const first = engine();
const world = first.e.worldProps;
assert.equal(world.isInUpperLake(C.x, C.y, C.radius), true);
assert.equal(world.isInUpperLake(4100, 3500), false);
assert.equal(world.isInUpperLake(0, 0), false, 'The river does not count as the arena');

// Fixed body, two independent head sweeps, one hit each, no recoil damage.
{
  const b = new AnacondaBoss(1, C.x, C.y, 1, world), p = target(C.x + 250);
  assert.equal(C.bite.range, 357.5);
  b.biteCooldown = 0; b.diveCooldown = b.slamCooldown = b.acidCooldown = 999;
  let hits = 0, warnings = 0, previous = 'idle';
  for (let step = 0; step < 1000; step++) {
    b.knockbackX = 900; b.knockbackY = -500;
    b.update(0.01, p, sep);
    assert.equal(b.x, C.x); assert.equal(b.y, C.y);
    if (b.action === 'bite_warning' && previous !== b.action) warnings++;
    if (b.action === 'bite_retract') assert.equal(b.consumeBiteHit(p), false);
    else if (b.consumeBiteHit(p)) hits++;
    if (warnings === 1 && b.action === 'bite_retract') p.y = C.y + 130;
    previous = b.action;
    if (warnings === 2 && b.action === 'idle') break;
  }
  assert.equal(warnings, 2); assert.equal(hits, 2); assert.equal(b.biteCooldown, 1.8);
  assert.ok(b.direction.y > 0, 'The second bite retargets');
  b.action = 'bite_extend'; b.biteHit = false;
  b.biteSweep = { from: { x: 0, y: 0 }, to: { x: 500, y: 0 } };
  assert.equal(b.consumeBiteHit({ ...p, x: 250, y: 0, isJumping: true }), false);
  b.biteSweep = { from: { x: 0, y: 0 }, to: { x: 500, y: 0 } };
  assert.equal(b.consumeBiteHit({ ...p, x: 250, y: 0 }), true, 'Fast head sweep cannot tunnel');
  const edge = new AnacondaBoss(2, C.x + 1400, C.y, 1, world);
  edge.beginBite(target(C.x + 4000));
  assert.ok(edge.neckLimit < C.bite.range);
  assert.equal(world.isInUpperLake(edge.x + edge.direction.x * edge.neckLimit,
    edge.y - 40 + edge.direction.y * edge.neckLimit, C.bite.radius), true);
}
console.log('PASS: fixed body, double bite, retargeting, recoil safety, swept collision, shoreline limit');
{
  const visual = new AnacondaVisual(), camera = new Camera();
  visual.openHead.complete = true; visual.openHead.naturalWidth = 100;
  for (const angle of [0, Math.PI / 4, Math.PI * 3 / 4, Math.PI, -Math.PI * 3 / 4, -Math.PI / 4]) {
    let rotation = 0, flip = 1, draws = 0;
    const ctx = new Proxy({
      rotate(value) { rotation = value; }, scale(x, y) { flip *= y; },
      drawImage() {
        draws++;
        assert.ok(-Math.cos(rotation) * flip <= 1e-8, 'Head upper edge must not face downward');
        assert.ok(Math.abs(Math.cos(rotation) - Math.cos(angle)) < 1e-8, 'Nose must still point toward target');
      },
    }, { get: (object, key) => key in object ? object[key] : () => {} });
    visual.renderRig(ctx, camera, 0, 0, { x: Math.cos(angle) * 200, y: -40 + Math.sin(angle) * 200 }, true, false);
    assert.equal(draws, 1);
  }
}
console.log('PASS: head stays upright and aimed at the target in all six tested directions');
{
  const b = new AnacondaBoss(77, C.x, C.y, 1, world), p = target(C.x - 250, C.y - 40);
  b.diveCooldown = b.slamCooldown = b.acidCooldown = 999;
  b.beginBite(p);
  const before = b.head;
  b.update(0.01, p, sep);
  assert.ok(Math.hypot(b.head.x - before.x, b.head.y - before.y) < 1, 'Retargeting begins smoothly, without snapping the head');
  for (let i = 0; i < 60 && b.action === 'bite_warning'; i++) b.update(0.01, target(C.x + 250), sep);
  assert.ok(b.direction.x < -0.99, 'The warned target remains locked while the neck turns');
  const visual = new AnacondaVisual(), camera = new Camera();
  visual.neck.complete = true; visual.neck.naturalWidth = 500; visual.neck.naturalHeight = 100;
  visual.openHead.complete = true; visual.openHead.naturalWidth = 500; visual.openHead.naturalHeight = 330;
  for (const angle of [0, Math.PI / 2 - 0.05, Math.PI / 2 + 0.05, Math.PI, -Math.PI / 2]) {
    const flips = [];
    const ctx = new Proxy({
      globalAlpha: 1,
      scale(x, y) { flips.push(y); },
      drawImage(image, ...args) { assert.ok(args.every(Number.isFinite), 'All neck/head geometry must remain finite'); },
    }, { get: (object, key) => key in object ? object[key] : () => {} });
    visual.renderRig(ctx, camera, 0, 0, { x: Math.cos(angle) * 300, y: -40 + Math.sin(angle) * 300 }, true, false);
    assert.ok(flips.length > 16);
    assert.ok(flips.every(value => value === flips[0]), 'Neck slices and head share one facing, including near vertical');
  }
}
console.log('PASS: smooth locked aiming, continuous neck geometry and consistent texture facing');

// Dive replaces all snake leaps: stationary underwater animation and five pulses.
{
  const b = new AnacondaBoss(3, C.x, C.y, 1, world), p = target();
  b.diveCooldown = 0; b.biteCooldown = b.slamCooldown = b.acidCooldown = 999;
  let pulses = 0, dives = 0, started = false;
  for (let step = 0; step < 1000; step++) {
    b.update(0.01, p, sep);
    if (b.action === 'dive') started = true;
    assert.equal(world.isInUpperLake(b.x, b.y, b.radius), true);
    assert.equal(b.x, C.x); assert.equal(b.y, C.y);
    if (b.dive.pendingSound) { dives++; b.dive.pendingSound = false; }
    if (b.dive.phase === 'warning') assert.equal(b.dive.pendingTicks, 0);
    if (b.dive.phase === 'active') assert.equal(b.dive.submersion, 1);
    pulses += b.dive.pendingTicks; b.dive.pendingTicks = 0;
    if (started && b.action === 'idle') break;
  }
  assert.equal(pulses, 5); assert.equal(dives, 1); assert.equal(b.diveCooldown, 2.25);
  assert.equal(C.dive.radius, 700); assert.equal('pendingLeapImpact' in b, false);
  assert.equal(b.dive.submersion, 0);
}
console.log('PASS: stationary dive, 700 radius, five one-second pulses, resurfacing and cooldown');

// Exposure and lingering poison share one clock, including repeated reentry.
{
  const rain = new AcidRain(), p = target(C.x, C.y);
  rain.begin(C.x, C.y);
  for (let i = 0; i < 20; i++) rain.update(0.05, p);
  assert.equal(rain.pendingTicks, 0); assert.equal(rain.pendingHeal, true);
  rain.pendingHeal = false;
  for (let i = 0; i < 100; i++) rain.update(0.05, p);
  assert.equal(rain.pendingTicks, 5); assert.equal(rain.pendingHeal, false);
  p.x = C.x + 1000;
  for (let i = 0; i < 40; i++) rain.update(0.05, p);
  assert.equal(rain.pendingTicks, 7); assert.equal(rain.poisoned, false);
  rain.clear(); assert.equal(rain.pendingTicks, 0);
  const reentry = new AcidRain(); reentry.begin(C.x, C.y);
  for (let i = 0; i < 20; i++) reentry.update(0.05, p);
  p.x = C.x;
  for (let i = 0; i < 20; i++) reentry.update(0.05, p);
  p.x += 1000;
  for (let i = 0; i < 10; i++) reentry.update(0.05, p);
  p.x = C.x;
  for (let i = 0; i < 20; i++) reentry.update(0.05, p);
  assert.equal(reentry.pendingTicks, 2, 'Reentry does not stack damage clocks');
  const b = new AnacondaBoss(4, C.x, C.y, 1, world);
  b.hp = b.maxHp / 2; b.acidCooldown = 0; b.diveCooldown = b.slamCooldown = b.biteCooldown = 999;
  for (let i = 0; i < 130; i++) b.update(0.05, target(C.x + 1000), sep);
  assert.equal(b.hp, b.maxHp * 0.7); assert.ok(b.acidCooldown > 14 && b.acidCooldown <= 15);
  const healed = b.hp; b.update(0.1, target(), sep); assert.equal(b.hp, healed);
  b.hp = 0; b.update(0.1, target(), sep); assert.equal(b.acid.poisoned, false);
}
console.log('PASS: 5 rain ticks + 2 lingering ticks, no stacked DPS, single 20% heal, cleanup');

// Integration: exclusive encounter, cancellation, victory and physical reward persistence.
{
  const { e, dialogues } = first;
  assert.equal(e.startAnacondaCombat(), false, 'Cannot challenge remotely');
  e.player.x = C.x + 180; e.player.y = C.y;
  e.input.handleKeyDown({ code: 'KeyE' }); e.update(0.01); e.input.handleKeyUp({ code: 'KeyE' });
  assert.equal(dialogues(), 1); assert.equal(e.isPaused, true);
  const normal = new Enemy(10, 'zombie', 0, 0), previousBoss = new Enemy(11, 'boss_vampire', 1000, 1000);
  e.enemies = [normal, previousBoss]; e.waveDirector.bossActive = previousBoss;
  assert.equal(e.startAnacondaCombat(), true); assert.equal(e.startGorillaCombat(), false);
  assert.equal(e.startAnacondaCombat(), false); assert.equal(e.enemies.length, 1);
  const b = e.enemies[0]; assert.equal(b.maxHp, 16000); assert.equal(b.damage, 60);
  const time = e.waveDirector.survivalTime;
  for (let i = 0; i < 500; i++) { e.update(0.05); assert.equal(e.enemies.length, 1); }
  assert.equal(e.waveDirector.survivalTime, time);
  e.player.x = 0; e.player.y = 0; e.update(0.01);
  assert.equal(e.bossEncounter, null); assert.ok(e.enemies.includes(normal)); assert.ok(e.enemies.includes(previousBoss));
  assert.equal(e.waveDirector.bossActive, previousBoss); assert.equal(b.hp, 0); assert.equal(b.acid.poisoned, false);
  const kills = e.kills; e.onEnemyKilled(b); assert.equal(e.kills, kills, 'Cancelled references cannot award a kill');
  assert.equal(e.drops.some(d => d instanceof EquipmentDrop), false);
  e.player.x = C.x + 180; e.player.y = C.y; assert.equal(e.startAnacondaCombat(), true);
  const winner = e.enemies[0]; assert.equal(winner.hp, winner.maxHp);
  assert.notEqual(winner.id, b.id, 'New attempts cannot reuse projectile hit-history IDs');
  winner.hp = 0; e.onEnemyKilled(winner); e.update(0.01);
  assert.equal(e.anacondaDefeated, true); assert.equal(e.bossEncounter, null); assert.equal(e.startAnacondaCombat(), false);
  const drop = e.drops.find(d => d instanceof EquipmentDrop); assert.ok(drop);
  assert.equal(loadSavedData().inventories[e.player.character.id]?.items.some(item => item.id === ANACONDA_GLOVES.id) ?? false, false);
  drop.isBeingMagnetPulled = true;
  const x = drop.x; drop.update(0.01, { ...e.player, x: 0, y: 0 }); assert.equal(drop.x, x);
  e.player.x = drop.x; e.player.y = drop.y; e.update(0.01);
  assert.equal(first.rewards(), 1); assert.equal(e.isPaused, true);
  const inventory = loadSavedData().inventories[e.player.character.id];
  assert.equal(inventory.items.filter(item => item.id === ANACONDA_GLOVES.id).length, 1);
  e.handleDropCollected(drop); assert.equal(first.rewards(), 1);
  // Another run may fight again, but it cannot drop a duplicate glove.
  const next = engine().e; next.player.x = C.x + 180; next.player.y = C.y; next.startAnacondaCombat();
  const boss = next.enemies[0]; boss.hp = 0; next.onEnemyKilled(boss); next.update(0.01);
  assert.equal(next.drops.some(d => d instanceof EquipmentDrop), false);
  const night = engine('night_plain').e; assert.equal(night.anacondaNpc, null); assert.equal(night.startAnacondaCombat(), false);
}
console.log('PASS: E dialogue, exclusive/frozen waves, cancellation, reset, restored mobs, physical glove and duplicate protection');

// Cancellation removes all active attacks; the gorilla still owns its original reward.
for (const action of ['bite_extend', 'dive', 'slam_warning', 'acid']) {
  const { e } = engine(); e.player.x = C.x + 180; e.player.y = C.y; e.startAnacondaCombat();
  const b = e.enemies[0]; b.action = action; b.acid.begin(C.x, C.y);
  if (action === 'dive') b.dive.begin(C.x, C.y);
  e.player.x = C.x + 3000; e.update(0.01);
  assert.equal(e.bossEncounter, null); assert.equal(b.acid.casting, false);
  assert.equal(b.dive.casting, false);
  assert.equal(e.drops.some(d => d instanceof EquipmentDrop), false);
}
{
  const { e } = engine(); e.player.x = e.gorillaNpc.x; e.player.y = e.gorillaNpc.y;
  assert.equal(e.startGorillaCombat(), true); const b = e.enemies[0]; assert.ok(b instanceof GorillaBoss);
  b.hp = 0; e.onEnemyKilled(b); e.drops = []; e.update(0.01);
  assert.equal(e.gorillaDefeated, true); assert.equal(e.anacondaDefeated, false);
  assert.ok(loadSavedData().inventories[e.player.character.id].items.some(item => item.id === FOREST_ARMOR.id));
}
console.log('PASS: cancellation during every attack, gorilla reward regression');
for (const [distance, expected, blocked = false] of [[600, 5], [800, 0], [600, 5, true]]) {
  const { e } = engine(); e.player.x = C.x + 180; e.player.y = C.y; e.startAnacondaCombat();
  const b = e.enemies[0]; b.diveCooldown = 0; b.biteCooldown = b.slamCooldown = b.acidCooldown = 999;
  e.update(0.01); assert.equal(b.action, 'dive');
  e.player.x = C.x + distance;
  let ticks = 0, stuns = 0;
  e.applyPlayerDamage = amount => { assert.equal(amount, 20); ticks++; if (!blocked) e.player.hp--; return false; };
  e.player.applyStun = duration => { assert.equal(duration, 0.3); stuns++; };
  for (let i = 0; i < 140; i++) e.update(0.05);
  assert.equal(ticks, expected, 'Only players in the dive area receive periodic damage');
  assert.equal(stuns, blocked ? 0 : expected, 'Each damaging pulse stuns for 0.3 seconds; blocked damage does not stun');
}
console.log('PASS: dive applies 20 damage and 0.3-second stun per tick inside radius 700, no stun outside or on blocked damage');
for (const [distance, expected] of [[450, 1], [550, 0]]) {
  const { e } = engine(); e.player.x = C.x + 180; e.player.y = C.y; e.startAnacondaCombat();
  const b = e.enemies[0]; b.diveCooldown = 0; b.biteCooldown = b.slamCooldown = b.acidCooldown = 999;
  e.update(0.01); e.player.x = C.x + distance;
  let impacts = 0;
  e.applyPlayerDamage = amount => {
    if (amount === 50) { impacts++; assert.equal(b.dive.phase, 'none', 'Impact occurs when fully resurfaced'); }
    else assert.equal(amount, 20);
    return false;
  };
  for (let i = 0; i < 140; i++) e.update(0.05);
  assert.equal(impacts, expected);
  assert.equal(b.dive.pendingEmergeImpact, false);
  b.dive.pendingEmergeImpact = true; b.clearEffects(); assert.equal(b.dive.pendingEmergeImpact, false);
}
console.log('PASS: resurfacing deals 50 once inside radius 500, none outside, cancellation clears pending impact');
{
  const b = new AnacondaBoss(88, C.x, C.y, 1, world);
  b.dive.phase = 'active';
  let drawingCalls = 0;
  const ctx = new Proxy({}, { get: () => () => { drawingCalls++; } });
  b.render(ctx, new Camera());
  assert.equal(drawingCalls, 0, 'Submerged snake draws neither body nor shadow');
}
console.log('PASS: snake is completely invisible during active dive');
{
  const { e } = engine(); e.player.x = C.x + 180; e.player.y = C.y; e.startAnacondaCombat();
  const b = e.enemies[0]; b.acid.begin(C.x, C.y); b.action = 'acid';
  b.acid.update(1, target(C.x, C.y)); b.acid.update(1, target(C.x, C.y));
  assert.equal(b.acid.poisoned, true);
  e.pause(); e.render = () => {}; e.isRunning = true;
  globalThis.requestAnimationFrame = () => 1;
  const timer = b.acid.remaining;
  e.loop(1000); assert.equal(b.acid.remaining, timer, 'Paused RAF must not advance rain');
  e.isRunning = false; e.resume(); e.player.hp = 0; e.update(0.01);
  assert.equal(e.isGameOver, true); assert.equal(b.acid.poisoned, false); assert.equal(e.bossEncounter, null);
}
console.log('PASS: pause freezes rain and poison; player death cleans encounter effects');
{
  const b = new GorillaBoss(99, 0, 0, 1), p = target(300, 0);
  let launches = 0, heals = 0, pulses = 0;
  const states = new Set();
  b.hp = b.maxHp / 2;
  for (let i = 0; i < 4000; i++) {
    b.update(0.01, p, sep); states.add(b.skillState);
    if (b.pendingLeapSound) { launches++; b.pendingLeapSound = false; }
    if (b.pendingRoarStart) { heals++; b.pendingRoarStart = false; }
    pulses += b.pendingRoarTicks; b.pendingRoarTicks = 0;
    b.pendingLeapImpact = false; b.pendingNovaBurst = false;
  }
  assert.ok(launches >= 3); assert.ok(heals >= 1); assert.ok(pulses >= 5);
  assert.ok(states.has('dashing')); assert.ok(states.has('telegraph_nova'));
}
console.log('PASS: shared anchored simulation preserves gorilla charge, slam, leaps and roar');
console.log('All anaconda checks passed.');
