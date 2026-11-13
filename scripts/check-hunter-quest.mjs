// Standalone regression check: node scripts/check-hunter-quest.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ts from 'typescript';
const loadPackage = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  new Function('exports', 'require', code)(exports, name => {
    if (!name.startsWith('.')) return loadPackage(name);
    const relative = path.resolve(path.dirname(file), name);
    return load(fs.existsSync(relative) && fs.statSync(relative).isFile() ? relative : relative + '.ts');
  });
  return exports;
}
const { emptyInventory, normalizeInventories, withEquipment } = load('src/game/data/inventory.ts');
const quest = load('src/game/data/hunterQuest.ts');
const { Player } = load('src/game/entities/Player.ts');
const { WeaponSystem } = load('src/game/weapons/WeaponSystem.ts');
const { WorldSystem } = load('src/game/systems/WorldProps.ts');
const { GameEngine } = load('src/game/engine/GameEngine.ts');
const { Drop } = load('src/game/entities/Drops.ts');
const { getInitialSave, loadSavedData, saveGameData } = load('src/game/data/persistence.ts');
const storage = new Map();
global.window = {};
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
global.Image = class { complete = false; naturalWidth = 0; };

let inventory = emptyInventory();
assert.equal(quest.collectHunterFish(inventory), inventory);
assert.equal(quest.deliverHunterFish(inventory), inventory);
inventory = quest.acceptHunterQuest(inventory);
for (let i = 0; i < 29; i++) inventory = quest.collectHunterFish(inventory);
assert.equal(quest.deliverHunterFish(inventory), inventory);
inventory = quest.collectHunterFish(inventory);
assert.equal(quest.getHunterQuest(inventory).fish, 30);
assert.equal(quest.collectHunterFish(inventory), inventory);
const delivered = quest.deliverHunterFish(inventory);
assert.equal(quest.getHunterQuest(delivered).fish, 0);
assert(quest.getHunterQuest(delivered).completed);
assert.equal(quest.deliverHunterFish(delivered), delivered);
assert.equal(delivered.items.length, 1);
assert.equal(delivered.items[0].slot, 'helmet');
const normalized = normalizeInventories({ old: { items: [], equipped: {} }, hunter: delivered,
  malformed: { items: [], equipped: {}, hunterQuest: { accepted: true, fish: Infinity } } });
assert.deepEqual(normalized.old.hunterQuest, { accepted: false, fish: 0, completed: false });
assert.equal(normalized.malformed.hunterQuest.fish, 0);
assert.equal(normalized.hunter.items[0].stats.projectileSpeed, 0.15);

const world = Object.create(WorldSystem.prototype);
Object.assign(world, { mapId: 'amazon_forest', riverMouths: null, lakes: [] });
assert(world.isMainRiverWater(0, 0));
assert(!world.isMainRiverWater(0, 4000));
assert(!world.isMainRiverWater(-4000, -3600)); // upper lake
assert(!world.isMainRiverWater(4100, 3500)); // lower lake
assert(!world.isMainRiverWater(9000, 0));
const camp = world.getHunterCampPosition();
assert(camp.y < -750 && !world.isMainRiverWater(camp.x, camp.y));
const normal = { isAquatic: true, isElite: false, isBoss: false };
for (const [enemy, river, expected] of [[normal, true, true], [normal, false, false],
  [{ ...normal, isAquatic: false }, true, false], [{ ...normal, isElite: true }, true, false],
  [{ ...normal, isBoss: true }, true, false]]) {
  assert.equal(quest.canDropHunterFish(quest.getHunterQuest(inventory), enemy, river), false); // capped
  assert.equal(quest.canDropHunterFish({ accepted: true, fish: 0, completed: false }, enemy, river), expected);
}

const base = { id: 'test_hunter', statBonuses: {} };
const equipped = { ...delivered, equipped: { helmet: quest.TRIBE_HEADDRESS.id } };
const player = new Player(withEquipment(base, equipped));
assert.equal(player.maxHp, 115);
assert.equal(player.projectileSpeedMultiplier, 1.15);
player.takeDamage(20);
assert.equal(player.hp, 96); // 20 * 0.95 = 19
const weapons = new WeaponSystem('wand');
weapons.recalculatePlayerStats(player);
assert.equal(player.maxHp, 115);
assert.equal(player.projectileSpeedMultiplier, 1.15);
const grid = { queryRadius: () => [] };
weapons.fireWeapon(weapons.weapons.get('wand'), player, [], grid, {}, {}, { playShoot() {} }, () => {});
assert(Math.abs(weapons.weapons.get('wand').cooldownTimer - 1.02 / 1.05) < 1e-8);

// Real engine quest methods with an isolated in-memory save, no browser storage.
saveGameData(getInitialSave());
const engine = Object.create(GameEngine.prototype);
let rewardCount = 0;
Object.assign(engine, { player, isPaused: true, isGameOver: false, insideCave: false, bossEncounter: null,
  tribeHunter: { canInteract: () => true, onFoodDelivered() {} }, hunterQuest: { accepted: false, fish: 0, completed: false },
  drops: [], syncHUD() {}, sound: { playGemPickup() {}, playMissionClaim() {} },
  callbacks: { onEquipmentReward: () => rewardCount++ } });
Object.assign(engine, { worldProps: world, processedEnemyDeaths: new WeakSet(), kills: 0,
  trackAmazonObjectiveKill() {}, vfx: { addDeathBurst() {} } });
const riverEnemy = () => ({ ...normal, type: 'piranha', x: 0, y: 0, xpValue: 5 });
engine.onEnemyKilled(riverEnemy());
assert.equal(engine.drops.length, 0); // no drops before acceptance
engine.acceptHunterMission();
const defeated = riverEnemy();
engine.onEnemyKilled(defeated);
assert.equal(engine.drops.length, 1);
assert.equal(engine.drops[0].type, 'quest_fish');
assert.equal(engine.hunterQuest.fish, 0); // killing is not collecting
engine.onEnemyKilled(defeated);
assert.equal(engine.drops.length, 1); // repeated death callback cannot duplicate loot
engine.onEnemyKilled({ ...riverEnemy(), x: 4100, y: 3500 });
engine.onEnemyKilled({ ...riverEnemy(), isAquatic: false });
const { KopenawaClone } = load('src/game/entities/KopenawaBoss.ts');
engine.onEnemyKilled(Object.assign(Object.create(KopenawaClone.prototype), riverEnemy()));
assert.equal(engine.drops.length, 1);
const hp = player.hp, xp = player.xp;
for (let i = 0; i < 30; i++) engine.handleDropCollected(new Drop(i, 'quest_fish', 0, 0));
assert.equal(engine.hunterQuest.fish, 30);
assert.equal(player.hp, hp); assert.equal(player.xp, xp);
assert.equal(loadSavedData().inventories[base.id].hunterQuest.fish, 30);
assert(!loadSavedData().inventories.other_character);
engine.drops = [new Drop(99, 'quest_fish', 0, 0), new Drop(100, 'coin', 0, 0)];
assert(engine.deliverHunterMission());
assert.equal(engine.drops.length, 1);
assert(!engine.deliverHunterMission());
assert.equal(rewardCount, 1);
assert(loadSavedData().inventories[base.id].hunterQuest.completed);
assert.equal(loadSavedData().inventories[base.id].items.length, 1);
const { TribeHunter } = load('src/game/entities/TribeHunter.ts');
const hunter = new TribeHunter(0, 0);
assert.equal(hunter.animationFrame, 0);
hunter.onFoodDelivered();
hunter.update(0.3);
assert(hunter.animationFrame > 0 && !hunter.isStanding);
const elapsed = hunter.riseElapsed;
hunter.onFoodDelivered();
assert.equal(hunter.riseElapsed, elapsed);
hunter.update(1);
assert.equal(hunter.animationFrame, 7);
assert(hunter.isStanding);
assert(new TribeHunter(0, 0, true).isStanding);
hunter.riseSprite.complete = true; hunter.riseSprite.naturalWidth = 1024;
hunter.riseSprite.naturalHeight = 512;
let draw;
const context = new Proxy({}, { get: (_, key) => key === 'drawImage' ? (...args) => { draw = args; } : () => {}, set: () => true });
hunter.render(context, { worldToScreen: (x, y) => ({ x, y }), isInView: () => true }, true);
assert.equal(draw[1], 768); assert.equal(draw[2], 256);
assert(draw[8] >= 74 && draw[8] <= 76); // Slightly enlarged upright sprite
assert.equal(hunter.riseElapsed, 1.1); // rendering while paused cannot advance the animation
console.log('PASS: acceptance, 30 physical pickups, no healing/XP, eligibility, river/camp geometry, save reload, per-character isolation, unique delivery, helmet slot and all four bonuses.');
console.log('PASS: rise-once animation, persistent standing pose, pause-safe timing and enlarged rendering.');
