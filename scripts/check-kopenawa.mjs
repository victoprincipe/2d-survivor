import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import sharp from 'sharp';

// Run with node scripts/check-kopenawa.mjs; no browser or new dependencies.
const load = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
load.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const images = [];
globalThis.Image = class {
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  constructor() { images.push(this); }
};
const { KopenawaBoss, KopenawaClone } = load(path.join(root, 'src/game/entities/KopenawaBoss.ts'));
const { KopenawaAnimation } = load(path.join(root, 'src/game/entities/KopenawaAnimation.ts'));
const { Enemy } = load(path.join(root, 'src/game/entities/Enemy.ts'));
const metadata = load(path.join(root, 'public/sprites/kopenawa/animations.json'));
const player = { x: 300, y: 0, radius: 14 };
const separation = { vx: 0, vy: 0 };
// Isolate the bespoke skill timeline from unrelated inherited enemy AI.
Enemy.prototype.update = function () { return this.hp > 0; };
const makeBoss = () => new KopenawaBoss(-1, 0, 0, 1);
const boss = makeBoss();
boss.update(0.3, player, separation);
assert.equal(boss.pendingArenaSlam, false);
boss.update(0.299, player, separation);
assert.equal(boss.pendingArenaSlam, false);
boss.update(0.001, player, separation);
assert.equal(boss.pendingArenaSlam, true, 'impact at 0.6 seconds');
assert.equal(Math.floor(boss.visualPose.progress * 6), 4, 'impact sprite matches arena event');
boss.pendingArenaSlam = false;
boss.update(0.36, player, separation);
assert.equal(boss.isInEntrance, false);
assert.equal(boss.pendingArenaSlam, false, 'impact is emitted only once');
const longFrame = makeBoss();
longFrame.update(1, player, separation);
assert.equal(longFrame.pendingArenaSlam, true, 'long frame cannot skip impact');
longFrame.pendingArenaSlam = false;
longFrame.update(0.01, player, separation);
assert.equal(longFrame.pendingArenaSlam, false);

boss.breathCooldown = 0;
boss.update(0.01, player, separation);
assert.equal(boss.visualPose.pose, 'cast');
assert.equal(boss.visualPose.progress, 0, 'cast restarts at first pose');
boss.update(0.35, player, separation);
assert.equal(boss.visualPose.progress, 0.5);
assert.equal(boss.pendingBreathHit, false);
boss.update(0.35, player, separation);
assert.equal(boss.visualPose.pose, 'channel');
assert.equal(boss.visualPose.progress, 0);
assert.equal(boss.pendingBreathHit, true);
boss.pendingBreathHit = false;
boss.update(0.45, player, separation);
assert.equal(boss.visualPose.pose, 'channel');
assert.equal(boss.visualPose.progress, 0, 'channel loops independently of damage');
assert.equal(boss.pendingBreathHit, false);
boss.update(0.451, player, separation);
assert.equal(boss.breathPhase, 'none');
assert.equal(boss.pendingBreathHit, false);
boss.breathCooldown = 0;
boss.update(0.01, player, separation);
assert.equal(boss.visualPose.progress, 0, 'second cast resets');
boss.hp = boss.maxHp / 2;
boss.update(0.01, player, separation);
assert.equal(boss.isInSmoke, true);
assert.equal(boss.breathPhase, 'none', 'smoke cancels casting');
assert.equal(boss.pendingClones, 2);
boss.pendingClones = 0;
boss.update(1, player, separation);
assert.equal(boss.isInSmoke, false);
assert.equal(boss.pendingClones, 0, 'clones summoned once');
boss.updateMovementAnimation(7);
assert.equal(boss.visualPose.pose, 'walk');
boss.updateMovementAnimation(0);
assert.equal(boss.visualPose.pose, 'idle', 'blocked movement stops footsteps');

const camera = { isInView: () => true, worldToScreen: (x, y) => ({ x, y }) };
const calls = [];
const ctx = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]), set: () => true });
const animator = new KopenawaAnimation();
assert.equal(animator.draw(ctx, 'cast', 0.5), false, 'unloaded atlas falls back');
for (const image of images) {
  image.complete = true;
  image.naturalWidth = 1280;
  image.naturalHeight = 1280;
}
assert.equal(animator.draw(ctx, 'cast', 0.5), true);
animator.updateMovement(7);
animator.draw(ctx, 'walk');
assert.equal(calls.at(-1)[2], metadata.animations.walk.frames[1].x);
animator.updateMovement(0);
animator.updateMovement(7);
animator.draw(ctx, 'walk');
assert.equal(calls.at(-1)[2], metadata.animations.walk.frames[1].x, 'walk phase resets after idle');
const frozen = JSON.stringify(boss);
boss.render(ctx, camera);
boss.render(ctx, camera);
assert.equal(JSON.stringify(boss), frozen, 'paused renders cannot advance simulation');
boss.facing = -1;
boss.render(ctx, camera);
assert(calls.some(([key, x]) => key === 'scale' && x === -1), 'left facing mirrors figure');
const clone = new KopenawaClone(-2, 0, 0);
clone.attackTimer = 0;
clone.update(0.01, player, separation);
clone.render(ctx, camera);
assert.equal(clone.damage, 0);
assert.equal(clone.attackFlash, 0.45);
assert(calls.some(([key, image]) => key === 'drawImage' && image.src?.endsWith('/cast.png')));
clone.update(0.451, player, separation);
clone.updateMovementAnimation(5);
assert.equal(clone.animator.movementPose, 'walk');
clone.hp = 0;
assert.equal(clone.update(1, player, separation), false);
const beforeDeath = calls.length;
clone.render(ctx, camera);
assert.equal(calls.length, beforeDeath, 'dead clone does not render');
boss.hp = 0;
boss.pendingArenaSlam = boss.pendingBreathHit = true;
assert.equal(boss.update(0.01, player, separation), false);
assert.equal(boss.pendingArenaSlam, false);
assert.equal(boss.pendingBreathHit, false);

for (const [name, animation] of Object.entries(metadata.animations)) {
  const filename = path.join(root, 'public', animation.image);
  const image = await sharp(filename).metadata();
  assert(image.hasAlpha, `${name} must be transparent`);
  assert.equal(animation.frames.length, name === 'walk' ? 8 : 6);
  for (const frame of animation.frames) {
    assert(frame.x + frame.width <= image.width && frame.y + frame.height <= image.height);
    assert(frame.anchorX < frame.width && frame.anchorY < frame.height);
  }
}
console.log('Kopenawa: impact, cast/channel timing, interruption, clones, footsteps, pause, facing, fallback and 26 atlas frames passed.');
