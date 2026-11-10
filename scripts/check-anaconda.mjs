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
  const b = new AnacondaBoss(1, C.x, C.y, 1, world), p = target();
  b.biteCooldown = 0; b.leapCooldown = b.slamCooldown = b.acidCooldown = 999;
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
  const edge = new AnacondaBoss(2, C.x + 1200, C.y, 1, world);
  edge.beginBite(target(C.x + 4000));
  assert.ok(edge.neckLimit < C.bite.range);
  assert.equal(world.isInUpperLake(edge.x + edge.direction.x * edge.neckLimit,
    edge.y - 40 + edge.direction.y * edge.neckLimit, C.bite.radius), true);
}
console.log('PASS: fixed body, double bite, retargeting, recoil safety, swept collision, shoreline limit');

// Three constrained jumps without inter-jump cooldown, followed by one cooldown.
{
  const b = new AnacondaBoss(3, C.x, C.y, 1, world), p = target();
  b.leapCooldown = 0; b.biteCooldown = b.slamCooldown = b.acidCooldown = 999;
  let impacts = 0, launches = 0;
  for (let step = 0; step < 1000 && impacts < 3; step++) {
    b.update(0.01, p, sep);
    assert.equal(world.isInUpperLake(b.x, b.y, b.radius), true);
    if (b.pendingLeapSound) { launches++; b.pendingLeapSound = false; }
    if (b.pendingLeapImpact) {
      impacts++; b.pendingLeapImpact = false;
      p.x += 50;
      if (impacts < 3) assert.equal(b.leapCooldown, 0);
    }
  }
  assert.equal(impacts, 3); assert.equal(launches, 3); assert.equal(b.leapCooldown, 2.25);
}
console.log('PASS: triple aquatic leap, body stays in lake, cooldown after last landing');

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
  b.hp = b.maxHp / 2; b.acidCooldown = 0; b.leapCooldown = b.slamCooldown = b.biteCooldown = 999;
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
for (const action of ['bite_extend', 'leap_flight', 'slam_warning', 'acid']) {
  const { e } = engine(); e.player.x = C.x + 180; e.player.y = C.y; e.startAnacondaCombat();
  const b = e.enemies[0]; b.action = action; b.acid.begin(C.x, C.y);
  e.player.x = C.x + 3000; e.update(0.01);
  assert.equal(e.bossEncounter, null); assert.equal(b.acid.casting, false);
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
