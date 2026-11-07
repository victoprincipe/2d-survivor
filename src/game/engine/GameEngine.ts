import {
  CharacterConfig,
  DifficultyConfig,
  DifficultyId,
  GameEndSummary,
  HUDState,
  MapId,
  UpgradeOption,
  SavedGameData,
  WeaponId,
  PassiveId,
  DevDebugConfig,
  DevTelemetrySnapshot,
  EnemyType,
} from '../types';
import { Camera } from './Camera';
import { InputManager } from './Input';
import { SoundEngine } from './SoundEngine';
import { SpatialGrid } from './SpatialGrid';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Drop } from '../entities/Drops';
import { VFXManager } from '../entities/VFX';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { WaveDirector } from '../systems/WaveDirector';
import { CollectedFruit, WorldSystem } from '../systems/WorldProps';
import { WEAPON_REGISTRY, PASSIVE_REGISTRY } from '../data/upgrades';
import { saveGameData, loadSavedData } from '../data/persistence';
import { getDifficulty } from '../data/difficulties';
import { applyRunToMissions } from '../data/missions';

export interface GameEngineCallbacks {
  onHUDUpdate: (hud: HUDState) => void;
  onLevelUp: (options: UpgradeOption[]) => void;
  onTreasureChest: (gold: number, upgrade?: UpgradeOption) => void;
  onGameOver: (summary: GameEndSummary) => void;
  onVictory: (summary: GameEndSummary) => void;
}

interface BossProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  kind: 'fireball' | 'soundwave';
}

interface BossHazard {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  kind: 'ember' | 'wind';
  tickTimer: number;
  damage: number;
  windStrength: number;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public camera: Camera;
  public input: InputManager;
  public sound: SoundEngine;
  public spatialGrid: SpatialGrid<Enemy>;

  public player: Player;
  public weaponSystem: WeaponSystem;
  public waveDirector: WaveDirector;
  public worldProps: WorldSystem;
  public vfx: VFXManager;
  public difficulty: DifficultyConfig;

  public enemies: Enemy[] = [];
  public drops: Drop[] = [];
  private bossProjectiles: BossProjectile[] = [];
  private bossHazards: BossHazard[] = [];

  public kills: number = 0;
  public goldCollected: number = 0;
  public bossesDefeated: number = 0;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public hasWon: boolean = false;

  // DevTools / Telemetry / Debug
  public debugConfig: DevDebugConfig = {
    showHitboxes: false,
    showRanges: false,
    showSpatialGrid: false,
    timeScale: 1.0,
    freezeSpawns: false,
    cameraZoom: 1.0,
  };
  public currentFps: number = 60;
  public currentFrameTimeMs: number = 16.6;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animFrameId: number | null = null;
  private hudThrottleTimer: number = 0;
  private gemStreak: number = 0;
  private gemStreakTimer: number = 0;
  private itemSpawnTimer: number = 0;
  private processedEnemyDeaths = new WeakSet<Enemy>();
  private missionSnapshot = { kills: 0, survivalSeconds: 0, goldCollected: 0, bossesDefeated: 0 };

  private callbacks: GameEngineCallbacks;

  constructor(
    canvas: HTMLCanvasElement,
    character: CharacterConfig,
    savedData: SavedGameData,
    difficultyId: DifficultyId,
    mapId: MapId,
    callbacks: GameEngineCallbacks
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;

    this.callbacks = callbacks;
    this.camera = new Camera(canvas.width, canvas.height);
    this.input = new InputManager();
    this.sound = new SoundEngine();
    this.spatialGrid = new SpatialGrid<Enemy>(110);
    this.vfx = new VFXManager();
    this.worldProps = new WorldSystem(mapId);
    this.difficulty = getDifficulty(difficultyId);
    this.waveDirector = new WaveDirector(this.difficulty, mapId, this.worldProps);

    this.player = new Player(character, savedData.powerUps);
    this.player.setCollisionResolver((fromX, fromY, dx, dy, radius) =>
      this.worldProps.resolvePlayerMovement(fromX, fromY, dx, dy, radius)
    );
    this.weaponSystem = new WeaponSystem(character.startingWeapon);
    this.weaponSystem.recalculatePlayerStats(this.player);
    this.player.hp = this.player.maxHp;

    // Initial resize
    this.handleResize();

    // Hook input pause toggle
    this.input.onPauseToggle = () => {
      if (!this.isGameOver) {
        this.togglePause();
      }
    };
  }

  public handleResize(): void {
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const width = this.canvas.parentElement?.clientWidth || window.innerWidth || 800;
    const height = this.canvas.parentElement?.clientHeight || window.innerHeight || 600;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
    this.camera.resize(width, height);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.sound.startBgm();
    this.loop(this.lastTime);
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.input.clearJump();
    this.input.clearInteract();
    this.lastTime = performance.now();
  }

  public togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Canvas pointer input. Tapping the floating fruit prompt harvests the tree;
   * every other tap keeps driving the virtual joystick.
   */
  public handlePointerDown(screenX: number, screenY: number): void {
    const fruit = this.worldProps.collectFruitTreeAtScreenPoint(
      screenX,
      screenY,
      this.camera,
      this.player
    );
    if (fruit) {
      this.handleFruitCollected(fruit);
      return;
    }
    this.input.handlePointerDown(screenX, screenY);
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    const frameTime = currentTime - this.lastTime;
    this.currentFrameTimeMs = Math.round(frameTime * 10) / 10;
    this.frameCount++;
    this.fpsTimer += frameTime;
    if (this.fpsTimer >= 400) {
      this.currentFps = Math.max(1, Math.round((this.frameCount * 1000) / this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    const rawDt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    const timeScale = Math.max(0.1, Math.min(10, this.debugConfig.timeScale || 1.0));
    const dt = Math.min(rawDt, 0.1) * timeScale;

    if (!this.isPaused && !this.isGameOver) {
      this.update(dt);
    }

    this.render();

    this.animFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  private update(dt: number): void {
    if (this.gemStreakTimer > 0) {
      this.gemStreakTimer -= dt;
      if (this.gemStreakTimer <= 0) this.gemStreak = 0;
    }

    // 1. Update Player
    const playerAlive = this.player.update(dt, this.input);
    if (!playerAlive) {
      this.handlePlayerDeath();
      return;
    }

    // 2. Update Camera
    this.camera.follow(this.player.x, this.player.y, dt);

    // 3. Clear and Rebuild Spatial Grid with current enemies
    this.spatialGrid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      this.spatialGrid.insert(this.enemies[i]);
    }

    // 4. Update Enemies + Boss Special Attacks
    const spawnedMinions: Enemy[] = [];
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const sep = this.spatialGrid.applySeparation(e, e.radius * 2, 0.45);
      const previousX = e.x;
      const previousY = e.y;
      const alive = e.update(dt, this.player, sep);

      if (!alive) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Aquatic enemies are locked to the water: reject any step that would
      // carry them onto the riverbank or dry forest floor.
      if (e.isAquatic) {
        const resolved = this.worldProps.resolveAquaticMovement(
          previousX,
          previousY,
          e.x,
          e.y,
          e.radius
        );
        e.x = resolved.x;
        e.y = resolved.y;
      }

      // Boss Nova Burst Resolution
      if (e.pendingNovaBurst) {
        e.pendingNovaBurst = false;
        this.weaponSystem.spawnRingPulse(e.x, e.y, e.novaRadius, '#ef4444', 0.32);
        this.sound.playThunder();
        this.camera.shake(0.25, 6);

        const ndx = this.player.x - e.x;
        const ndy = this.player.y - e.y;
        if (Math.sqrt(ndx * ndx + ndy * ndy) <= e.novaRadius + this.player.radius) {
          const novaDmg = Math.max(1, Math.round(e.damage * 0.85));
          const fatal = this.player.takeDamage(novaDmg);
          this.sound.playPlayerHurt();
          this.vfx.addDamageNumber(this.player.x, this.player.y, novaDmg, true, false);
          if (fatal) {
            this.handlePlayerDeath();
            return;
          }
        }
      }

      // Boss Dark Summon Resolution
      if (e.pendingSummonCount > 0) {
        const toSpawn = e.pendingSummonCount;
        e.pendingSummonCount = 0;
        if (this.enemies.length + spawnedMinions.length < 400) {
          this.vfx.addDeathBurst(e.x, e.y, '#a855f7', 16);
          const minutes = this.waveDirector.survivalTime / 60;
          const hpMult = (1.0 + minutes * 0.4) * this.difficulty.enemyHp;
          for (let s = 0; s < toSpawn; s++) {
            const ang = (s * Math.PI * 2) / toSpawn;
            const mx = e.x + Math.cos(ang) * 65;
            const my = e.y + Math.sin(ang) * 65;
            spawnedMinions.push(
              this.waveDirector.createEnemy(this.waveDirector.getMinionEnemyType(), mx, my, hpMult)
            );
          }
        }
      }

      // Amazon Forest boss attacks.
      if (e.pendingFireballBurst > 0) {
        const burst = e.pendingFireballBurst;
        e.pendingFireballBurst = 0;
        const baseAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        this.vfx.addSparks(e.x, e.y, '#f97316', 12);
        for (let k = 0; k < burst; k++) {
          const angle = baseAngle + (k - (burst - 1) / 2) * 0.18;
          this.bossProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * 290,
            vy: Math.sin(angle) * 290,
            radius: 9,
            damage: Math.max(1, Math.round(e.damage * 0.7)),
            life: 2.6,
            maxLife: 2.6,
            kind: 'fireball',
          });
        }
      }

      if (e.pendingEmberTrail) {
        e.pendingEmberTrail = false;
        for (let k = 0; k < 3; k++) {
          const angle = Math.random() * Math.PI * 2;
          const offset = 10 + Math.random() * 26;
          this.bossHazards.push({
            x: e.x + Math.cos(angle) * offset,
            y: e.y + Math.sin(angle) * offset,
            radius: 28,
            life: 4.5,
            maxLife: 4.5,
            kind: 'ember',
            tickTimer: 0,
            damage: Math.max(1, Math.round(e.damage * 0.3)),
            windStrength: 0,
          });
        }
        this.vfx.addSparks(e.x, e.y, '#fb923c', 10);
      }

      if (e.pendingTeleport) {
        e.pendingTeleport = false;
        const oldX = e.x;
        const oldY = e.y;
        const angle = Math.random() * Math.PI * 2;
        const distance = 160 + Math.random() * 120;
        const targetX = this.player.x + Math.cos(angle) * distance;
        const targetY = this.player.y + Math.sin(angle) * distance;
        const resolved = this.worldProps.resolvePlayerMovement(
          e.x,
          e.y,
          targetX - e.x,
          targetY - e.y,
          e.radius
        );
        e.x = resolved.x;
        e.y = resolved.y;
        this.bossHazards.push({
          x: oldX,
          y: oldY,
          radius: 230,
          life: 3.6,
          maxLife: 3.6,
          kind: 'wind',
          tickTimer: 0,
          damage: 0,
          windStrength: Math.random() < 0.5 ? 170 : -170,
        });
        this.vfx.addDeathBurst(oldX, oldY, '#94a3b8', 12);
        this.vfx.addSparks(e.x, e.y, '#f472b6', 14);
      }

      if (e.pendingWindBurst > 0) {
        const bursts = e.pendingWindBurst;
        e.pendingWindBurst = 0;
        for (let k = 0; k < bursts; k++) {
          this.bossHazards.push({
            x: e.x,
            y: e.y,
            radius: 230,
            life: 4,
            maxLife: 4,
            kind: 'wind',
            tickTimer: 0,
            damage: 0,
            windStrength: Math.random() < 0.5 ? 170 : -170,
          });
        }
      }

      if (e.pendingSoundWave) {
        e.pendingSoundWave = false;
        const baseAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        this.camera.shake(0.12, 3);
        for (let k = 0; k < 5; k++) {
          const angle = baseAngle + (k - 2) * 0.22;
          this.bossProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * 240,
            vy: Math.sin(angle) * 240,
            radius: 11,
            damage: Math.max(1, Math.round(e.damage * 0.65)),
            life: 3,
            maxLife: 3,
            kind: 'soundwave',
          });
        }
      }

      // Check body collision with player (jumping grants brief immunity)
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!this.player.isJumping && dist < this.player.radius + e.radius) {
        const fatal = this.player.takeDamage(e.damage);
        this.sound.playPlayerHurt();
        this.camera.shake(0.2, 5);
        this.vfx.addDamageNumber(this.player.x, this.player.y, e.damage, false, false);

        if (fatal) {
          this.handlePlayerDeath();
          return;
        }
      }
    }

    for (let m = 0; m < spawnedMinions.length; m++) {
      this.enemies.push(spawnedMinions[m]);
      this.spatialGrid.insert(spawnedMinions[m]);
    }

    // 5. Update World Props (Torches and fruit trees)
    this.worldProps.update(dt, this.player, (drop) => this.drops.push(drop));

    // 5.1. Fruit trees are harvested only when the player presses E nearby.
    if (this.input.consumeInteract()) {
      const fruit = this.worldProps.collectNearbyFruitTree(this.player);
      if (fruit) this.handleFruitCollected(fruit);
    }

    // 6. Update Weapons System
    this.weaponSystem.update(
      dt,
      this.player,
      this.enemies,
      this.spatialGrid,
      this.camera,
      this.vfx,
      this.sound,
      (enemy) => this.onEnemyKilled(enemy)
    );

    // 6.5. Periodic Supply Drop on Map (every 75s)
    this.itemSpawnTimer += dt;
    if (this.itemSpawnTimer >= 75) {
      this.itemSpawnTimer -= 75;
      this.spawnRandomItem();
    }

    // 7. Update Drops & Pickups
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const collected = drop.update(dt, this.player);

      if (collected) {
        this.handleDropCollected(drop);
        this.drops.splice(i, 1);
      }
    }

    // 8. Update Wave Director (Spawns)
    this.waveDirector.update(
      dt,
      this.player,
      this.camera,
      this.enemies,
      this.sound,
      (enemy) => this.enemies.push(enemy)
    );

    // 8.5. Update Amazon boss projectiles and ground hazards
    if (this.updateBossEffects(dt)) {
      this.handlePlayerDeath();
      return;
    }

    // 9. Update VFX
    this.vfx.update(dt);

    // 10. Throttled React HUD synchronization (~10 Hz)
    this.hudThrottleTimer += dt;
    if (this.hudThrottleTimer >= 0.1) {
      this.hudThrottleTimer = 0;
      this.syncHUD();
    }
  }

  private updateBossEffects(dt: number): boolean {
    for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
      const p = this.bossProjectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      const dx = this.player.x - p.x;
      const dy = this.player.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) <= p.radius + this.player.radius) {
        const fatal = this.player.takeDamage(p.damage);
        this.sound.playPlayerHurt();
        this.vfx.addDamageNumber(this.player.x, this.player.y, p.damage, false, false);
        p.life = 0;
        if (fatal) return true;
      }

      if (p.life <= 0) {
        this.bossProjectiles.splice(i, 1);
      }
    }

    for (let i = this.bossHazards.length - 1; i >= 0; i--) {
      const h = this.bossHazards[i];
      h.life -= dt;

      const dx = this.player.x - h.x;
      const dy = this.player.y - h.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (h.kind === 'wind') {
        if (dist < h.radius) {
          const falloff = 1 - dist / h.radius;
          const dirX = dist > 0 ? dx / dist : 1;
          const dirY = dist > 0 ? dy / dist : 0;
          const moveX = dirX * h.windStrength * falloff * dt;
          const moveY = dirY * h.windStrength * falloff * dt;
          if (this.player.collisionResolver) {
            const resolved = this.player.collisionResolver(
              this.player.x,
              this.player.y,
              moveX,
              moveY,
              this.player.radius
            );
            this.player.x = resolved.x;
            this.player.y = resolved.y;
          } else {
            this.player.x += moveX;
            this.player.y += moveY;
          }
        }
      } else {
        h.tickTimer -= dt;
        if (dist < h.radius + this.player.radius && h.tickTimer <= 0) {
          h.tickTimer = 0.55;
          const fatal = this.player.takeDamage(h.damage);
          this.sound.playPlayerHurt();
          this.vfx.addDamageNumber(this.player.x, this.player.y, h.damage, false, false);
          if (fatal) return true;
        }
      }

      if (h.life <= 0) {
        this.bossHazards.splice(i, 1);
      }
    }

    return false;
  }

  private onEnemyKilled(enemy: Enemy): void {
    if (this.processedEnemyDeaths.has(enemy)) return;
    this.processedEnemyDeaths.add(enemy);

    this.kills += 1;
    this.vfx.addDeathBurst(
      enemy.x,
      enemy.y,
      enemy.type === 'bat' ? '#a855f7' : '#ef4444',
      enemy.isElite ? 25 : 8
    );

    if (enemy.isBoss) {
      this.bossesDefeated += 1;
      const bossXp = Math.round(250 * this.difficulty.xpMultiplier);
      this.drops.push(new Drop(Date.now() + Math.random(), 'chest', enemy.x, enemy.y));
      this.drops.push(new Drop(Date.now() + 1 + Math.random(), 'gem_red', enemy.x + 22, enemy.y, bossXp));
      this.drops.push(new Drop(Date.now() + 2 + Math.random(), 'gem_red', enemy.x - 22, enemy.y, bossXp));

      if (!this.waveDirector.isEndless && !this.waveDirector.isAmazonForest) {
        this.handleVictory();
      } else {
        this.persistRunStats(false);
      }
      return;
    }

    if (enemy.isElite) {
      const isAmazonElite =
        enemy.type === 'elite_jaguar' ||
        enemy.type === 'elite_tapir' ||
        enemy.type === 'elite_goliath_spider' ||
        enemy.type === 'elite_black_caiman';
      this.drops.push(new Drop(Date.now() + Math.random(), 'chest', enemy.x, enemy.y));
      this.drops.push(new Drop(Date.now() + 1 + Math.random(), 'gem_green', enemy.x + 14, enemy.y, enemy.xpValue));
      if (isAmazonElite) {
        // Rare forest elites are walking treasure piñatas: bonus XP and gold.
        this.drops.push(new Drop(Date.now() + 2 + Math.random(), 'gem_red', enemy.x - 16, enemy.y, enemy.xpValue));
        this.drops.push(new Drop(Date.now() + 3 + Math.random(), 'coin', enemy.x + 30, enemy.y, 90));
        this.drops.push(new Drop(Date.now() + 4 + Math.random(), 'coin', enemy.x - 30, enemy.y, 90));
      }
      return;
    }

    let dropType: Drop['type'] = 'gem_blue';
    if (enemy.xpValue >= 20) {
      dropType = 'gem_green';
    }
    this.drops.push(new Drop(Date.now() + Math.random(), dropType, enemy.x, enemy.y, enemy.xpValue));
  }

  private spawnRandomItem(): void {
    const luckBias = Math.min(0.12, this.player.luck * 0.25);
    const roll = Math.random();
    let type: Drop['type'] = 'coin';
    if (roll < 0.4 + luckBias * 0.5) {
      type = 'chicken';
    } else if (roll < 0.75) {
      type = 'coin';
    } else if (roll < 0.93) {
      type = 'magnet';
    } else {
      type = 'rosary';
    }

    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 280;
    this.drops.push(
      new Drop(
        Date.now() + Math.random(),
        type,
        this.player.x + Math.cos(angle) * dist,
        this.player.y + Math.sin(angle) * dist
      )
    );
  }

  private handleDropCollected(drop: Drop): void {
    if (drop.type === 'gem_blue' || drop.type === 'gem_green' || drop.type === 'gem_red') {
      this.gemStreak += 1;
      this.gemStreakTimer = 0.5;
      this.sound.playGemPickup(this.gemStreak);
      const leveledUp = this.player.addXp(drop.value);

      if (leveledUp) {
        const options = this.weaponSystem.generateUpgradeOptions();
        if (options.length > 0) {
          this.sound.playLevelUp();
          this.pause();
          this.callbacks.onLevelUp(options);
        }
      }
    } else if (drop.type === 'coin') {
      const gained = Math.round(
        drop.value * this.difficulty.goldMultiplier * this.player.goldMultiplier
      );
      this.goldCollected += gained;
      this.sound.playGemPickup(4);
      this.vfx.addDamageNumber(this.player.x, this.player.y, gained, true, true);
    } else if (drop.type === 'chicken') {
      this.player.heal(drop.value);
      this.sound.playGemPickup(8);
      this.vfx.addDamageNumber(this.player.x, this.player.y, drop.value, false, true);
    } else if (drop.type === 'magnet') {
      this.sound.playLevelUp();
      this.vfx.triggerFlash('#38bdf8', 0.4);
      for (let i = 0; i < this.drops.length; i++) {
        if (this.drops[i].type.startsWith('gem_') || this.drops[i].type === 'coin') {
          this.drops[i].isBeingMagnetPulled = true;
        }
      }
    } else if (drop.type === 'rosary') {
      this.sound.playThunder();
      this.vfx.triggerFlash('#ffffff', 0.85);
      // Purges regular monsters, deals heavy % damage to Elites & chip damage to Bosses
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.isBoss) {
          const bossDmg = Math.max(1, Math.round(e.maxHp * 0.06));
          const dead = e.takeDamage(bossDmg, 0, 0, 0);
          this.vfx.addDamageNumber(e.x, e.y, bossDmg, true);
          if (dead) {
            this.onEnemyKilled(e);
            this.enemies.splice(i, 1);
          }
        } else if (e.isElite) {
          const eliteDmg = Math.max(1, Math.round(e.maxHp * 0.35));
          const dead = e.takeDamage(eliteDmg, 0, 0, 80);
          this.vfx.addDamageNumber(e.x, e.y, eliteDmg, true);
          if (dead) {
            this.onEnemyKilled(e);
            this.enemies.splice(i, 1);
          }
        } else {
          this.onEnemyKilled(e);
          this.enemies.splice(i, 1);
        }
      }
    } else if (drop.type === 'chest') {
      this.sound.playChestOpen();
      this.pause();
      const chosenUpgrade = this.weaponSystem.resolveChestUpgrade();
      const baseGold = chosenUpgrade
        ? 55 + Math.floor(Math.random() * 45)
        : 135 + Math.floor(Math.random() * 45);
      const goldBonus = Math.round(
        baseGold * this.difficulty.goldMultiplier * this.player.goldMultiplier
      );
      this.goldCollected += goldBonus;
      if (!chosenUpgrade) {
        this.player.heal(35);
      }
      this.callbacks.onTreasureChest(goldBonus, chosenUpgrade);
    }
  }

  private handleFruitCollected(fruit: CollectedFruit): void {
    if (fruit.kind === 'acai') {
      // Açaí: magnet every XP gem on the map toward the hero.
      this.sound.playLevelUp();
      this.vfx.triggerFlash('#38bdf8', 0.35);
      this.vfx.addSparks(fruit.x, fruit.y, '#c084fc', 12);
      for (let i = 0; i < this.drops.length; i++) {
        const drop = this.drops[i];
        if (
          drop.type === 'gem_blue' ||
          drop.type === 'gem_green' ||
          drop.type === 'gem_red'
        ) {
          drop.isBeingMagnetPulled = true;
        }
      }
    } else if (fruit.kind === 'cupuacu') {
      // Cupuaçu: restore 35% of the player's maximum HP.
      const healed = Math.max(1, Math.round(this.player.maxHp * 0.35));
      this.player.heal(healed);
      this.sound.playGemPickup(8);
      this.vfx.addSparks(fruit.x, fruit.y, '#84cc16', 12);
      this.vfx.addDamageNumber(this.player.x, this.player.y, healed, false, true);
    } else if (fruit.kind === 'castanha') {
      // Castanha-do-Pará: drop an extra gold package.
      this.sound.playGemPickup(4);
      this.vfx.addSparks(fruit.x, fruit.y, '#fbbf24', 12);
      const coins = 3;
      for (let i = 0; i < coins; i++) {
        const angle = (i / coins) * Math.PI * 2;
        this.drops.push(
          new Drop(
            Date.now() + i + Math.random(),
            'coin',
            fruit.x + Math.cos(angle) * 18,
            fruit.y + Math.sin(angle) * 18,
            50
          )
        );
      }
    } else if (fruit.kind === 'buriti') {
      // Buriti: faster movement and attack speed for 10 seconds.
      this.sound.playLevelUp();
      this.vfx.triggerFlash('#fbbf24', 0.25);
      this.vfx.addSparks(fruit.x, fruit.y, '#fb923c', 14);
      this.player.speedBoostTimer = Math.max(this.player.speedBoostTimer, 10);
      this.player.attackSpeedBoostTimer = 10;
    } else if (fruit.kind === 'pupunha') {
      // Pupunha: protective shield that halves incoming damage for 10 seconds.
      this.sound.playGemPickup(8);
      this.vfx.triggerFlash('#38bdf8', 0.2);
      this.vfx.addSparks(fruit.x, fruit.y, '#38bdf8', 14);
      this.player.shieldTimer = Math.max(this.player.shieldTimer, 10);
    } else {
      // Araçá: a shockwave that damages every nearby enemy.
      const radius = 240;
      const damage = Math.max(1, Math.round(70 * this.player.might));
      this.sound.playThunder();
      this.camera.shake(0.18, 5);
      this.vfx.triggerFlash('#f97316', 0.2);
      this.vfx.addSparks(fruit.x, fruit.y, '#f97316', 20);
      this.weaponSystem.spawnRingPulse(fruit.x, fruit.y, radius, '#f97316', 0.4);

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        const dx = enemy.x - fruit.x;
        const dy = enemy.y - fruit.y;
        if (dx * dx + dy * dy > radius * radius) continue;

        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const dead = enemy.takeDamage(damage, dx / dist, dy / dist, 240);
        this.vfx.addDamageNumber(enemy.x, enemy.y, damage, false);
        if (dead) {
          this.onEnemyKilled(enemy);
          this.enemies.splice(i, 1);
        }
      }
    }
  }

  public applyUpgrade(option: UpgradeOption): void {
    if (option.type === 'evolution') {
      if (option.baseId) {
        this.weaponSystem.evolveWeapon(option.baseId);
      }
    } else if (option.type === 'weapon') {
      const wId = option.id as WeaponId;
      if (this.weaponSystem.weapons.has(wId)) {
        this.weaponSystem.upgradeWeapon(wId);
      } else {
        this.weaponSystem.addWeapon(wId);
      }
    } else if (option.type === 'passive') {
      const pId = option.id as PassiveId;
      this.weaponSystem.addPassive(pId, this.player);
    }

    // Handle multi-level overflow XP (e.g. Boss gem)
    if (this.player.checkLevelUp()) {
      const nextOptions = this.weaponSystem.generateUpgradeOptions();
      if (nextOptions.length > 0) {
        this.sound.playLevelUp();
        this.pause();
        this.callbacks.onLevelUp(nextOptions);
        return;
      }
    }

    this.resume();
  }

  private handlePlayerDeath(): void {
    this.isGameOver = true;
    this.sound.playGameOver();
    this.sound.stopBgm();
    this.persistRunStats(false);

    const summary = this.buildSummary(false);
    this.callbacks.onGameOver(summary);
  }

  private handleVictory(): void {
    this.hasWon = true;
    this.pause();
    this.sound.playVictory();
    this.persistRunStats(true);

    const summary = this.buildSummary(true);
    this.callbacks.onVictory(summary);
  }

  public continueEndless(): void {
    this.waveDirector.isEndless = true;
    this.resume();
  }

  private buildSummary(won: boolean): GameEndSummary {
    let totalDmg = 0;
    this.weaponSystem.weapons.forEach((w) => {
      totalDmg += w.totalDamageDealt;
    });

    const timeSurvived = Math.max(1, Math.floor(this.waveDirector.survivalTime));

    const weaponStats = Array.from(this.weaponSystem.weapons.values()).map((w) => {
      const meta = WEAPON_REGISTRY[w.id];
      const dmg = Math.round(w.totalDamageDealt);
      return {
        id: w.id,
        name: w.evolved ? meta.evolvedName : meta.name,
        evolved: w.evolved,
        damage: dmg,
        dps: Math.round((dmg / timeSurvived) * 10) / 10,
        percentage: totalDmg > 0 ? Math.round((dmg / totalDmg) * 100) : 0,
      };
    });

    weaponStats.sort((a, b) => b.damage - a.damage);

    return {
      won,
      survivalTime: timeSurvived,
      kills: this.kills,
      bossesDefeated: this.bossesDefeated,
      level: this.player.level,
      goldEarned: this.goldCollected,
      totalDamage: Math.round(totalDmg),
      characterName: this.player.character.name,
      difficulty: this.difficulty.id,
      difficultyName: this.difficulty.name,
      weaponStats,
    };
  }

  private persistRunStats(won: boolean): void {
    const data = loadSavedData();
    data.gold += this.goldCollected;
    data.highScore.timeSurvived = Math.max(
      data.highScore.timeSurvived,
      Math.floor(this.waveDirector.survivalTime)
    );
    data.highScore.kills = Math.max(data.highScore.kills, this.kills);
    data.highScore.highestLevel = Math.max(data.highScore.highestLevel, this.player.level);
    if (won) data.highScore.wins += 1;

    const current = {
      kills: this.kills,
      survivalSeconds: Math.floor(this.waveDirector.survivalTime),
      goldCollected: this.goldCollected,
      bossesDefeated: this.bossesDefeated,
    };
    const missionData = applyRunToMissions(data, {
      kills: Math.max(0, current.kills - this.missionSnapshot.kills),
      survivalSeconds: Math.max(0, current.survivalSeconds - this.missionSnapshot.survivalSeconds),
      goldCollected: Math.max(0, current.goldCollected - this.missionSnapshot.goldCollected),
      bossesDefeated: Math.max(
        0,
        current.bossesDefeated - this.missionSnapshot.bossesDefeated
      ),
      wins: won ? 1 : 0,
    });
    this.missionSnapshot = current;
    saveGameData(missionData);
  }

  private syncHUD(): void {
    const weaponsList = Array.from(this.weaponSystem.weapons.values()).map((w) => ({
      id: w.id,
      level: w.level,
      evolved: w.evolved,
      name: w.evolved ? WEAPON_REGISTRY[w.id].evolvedName : WEAPON_REGISTRY[w.id].name,
      totalDamage: Math.round(w.totalDamageDealt),
    }));

    const passivesList = Array.from(this.weaponSystem.passives.values()).map((p) => ({
      id: p.id,
      level: p.level,
      name: PASSIVE_REGISTRY[p.id].name,
    }));

    const activeBoss = this.waveDirector.bossActive
      ? {
          name: this.waveDirector.bossActive.name,
          hp: this.waveDirector.bossActive.hp,
          maxHp: this.waveDirector.bossActive.maxHp,
        }
      : undefined;

    this.callbacks.onHUDUpdate({
      playerHp: Math.round(this.player.hp),
      playerMaxHp: Math.round(this.player.maxHp),
      stamina: Math.round(this.player.stamina),
      maxStamina: Math.round(this.player.movementConfig.maxStamina),
      level: this.player.level,
      xp: Math.round(this.player.xp),
      xpToNextLevel: this.player.xpToNextLevel,
      survivalTime: Math.floor(this.waveDirector.survivalTime),
      kills: this.kills,
      gold: this.goldCollected,
      weapons: weaponsList,
      passives: passivesList,
      activeBoss,
      eventAlert: this.waveDirector.eventAlert || undefined,
    });
  }

  private render(): void {
    const { ctx, camera } = this;

    // 1. Clear & Render Floor Tile Pattern
    this.worldProps.renderFloor(ctx, camera);
    this.worldProps.renderTrees(ctx, camera);
    this.worldProps.renderFruitTrees(ctx, camera, this.player);

    // 2. Render Torches & Props
    this.worldProps.renderTorches(ctx, camera);

    // 3. Render Drops (Gems, Pickups, Chests)
    for (let i = 0; i < this.drops.length; i++) {
      this.drops[i].render(ctx, camera);
    }

    // 4. Render Ground Hazards & Auras beneath Enemies/Player
    this.weaponSystem.renderGround(ctx, camera, this.player);
    this.renderBossHazards();

    // 5. Render Enemies & Player
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].render(ctx, camera);
    }

    this.player.render(ctx, camera);
    this.renderBossProjectiles();

    // 6. Render Aerial Projectiles, Slashes, Orbitals & Lightning
    this.weaponSystem.render(ctx, camera, this.player);

    // 7. Render VFX (Damage numbers, death particles, screen flash)
    this.vfx.render(ctx, camera);

    // 7.5. Render Debug Overlay (Hitboxes, Ranges, Spatial Grid)
    this.renderDebugOverlay();

    // 8. Render Virtual Joystick if active
    if (this.input.joystick.active) {
      const { startX, startY, currentX, currentY, radius } = this.input.joystick;
      ctx.save();
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(currentX, currentY, radius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
      ctx.restore();
    }

    // 9. Render Minimap Radar (fixed bottom-left)
    this.renderMinimap();
  }

  private renderMinimap(): void {
    const { ctx, camera } = this;
    const viewport = Math.min(camera.viewportWidth, camera.viewportHeight);
    const size = viewport < 640 ? 112 : 152;
    const margin = 12;
    const x = margin;
    // Leave room for the bottom HUD hint without leaving the corner.
    const y = camera.viewportHeight - size - margin - 18;
    const half = size / 2;

    const viewSpan = this.worldProps.getMinimapViewSpan();
    const viewRadius = viewSpan / 2;
    const scale = size / viewSpan;

    const tracePanel = () => {
      const radius = 10;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + size - radius, y);
      ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
      ctx.lineTo(x + size, y + size - radius);
      ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
      ctx.lineTo(x + radius, y + size);
      ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    ctx.save();
    tracePanel();
    ctx.fillStyle = 'rgba(8, 15, 20, 0.68)';
    ctx.fill();

    ctx.save();
    ctx.clip();
    this.worldProps.renderMinimapScenery(
      ctx,
      this.player.x,
      this.player.y,
      viewRadius,
      x,
      y,
      size
    );

    const centerX = x + half;
    const centerY = y + half;

    // Nearby enemies as small red blips.
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      if (dx * dx + dy * dy > viewRadius * viewRadius) continue;

      const blipRadius = enemy.isBoss ? 2.4 : enemy.isElite ? 2 : 1.4;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(centerX + dx * scale, centerY + dy * scale, blipRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Hero is always at the center of the radar.
    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 11);
    glow.addColorStop(0, 'rgba(52, 211, 153, 0.9)');
    glow.addColorStop(0.5, 'rgba(34, 211, 238, 0.35)');
    glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ecfeff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    tracePanel();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private renderBossHazards(): void {
    const { ctx, camera } = this;
    for (let i = 0; i < this.bossHazards.length; i++) {
      const h = this.bossHazards[i];
      if (!camera.isInView(h.x, h.y, h.radius + 30)) continue;
      const screen = camera.worldToScreen(h.x, h.y);
      const alpha = Math.min(1, h.life / 0.8);

      ctx.save();
      if (h.kind === 'ember') {
        const glow = ctx.createRadialGradient(screen.x, screen.y, 2, screen.x, screen.y, h.radius);
        glow.addColorStop(0, `rgba(254, 240, 138, ${0.8 * alpha})`);
        glow.addColorStop(0.45, `rgba(249, 115, 22, ${0.55 * alpha})`);
        glow.addColorStop(1, 'rgba(185, 28, 28, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, h.radius, 0, Math.PI * 2);
        ctx.fill();

        const pulse = 1 + Math.sin(h.life * 9) * 0.12;
        ctx.fillStyle = `rgba(251, 146, 60, ${0.55 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, h.radius * 0.4 * pulse, h.radius * 0.22 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const spin = h.life * 2.4 * (h.windStrength >= 0 ? 1 : -1);
        ctx.strokeStyle = `rgba(186, 230, 253, ${0.6 * alpha})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let ring = 0; ring < 3; ring++) {
          const radius = h.radius * (0.32 + ring * 0.22);
          const start = spin + ring * 1.4;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, radius, start, start + Math.PI * 1.1);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      ctx.restore();
    }
  }

  private renderBossProjectiles(): void {
    const { ctx, camera } = this;
    for (let i = 0; i < this.bossProjectiles.length; i++) {
      const p = this.bossProjectiles[i];
      if (!camera.isInView(p.x, p.y, p.radius + 20)) continue;
      const screen = camera.worldToScreen(p.x, p.y);
      const alpha = Math.min(1, p.life / 0.5);

      ctx.save();
      if (p.kind === 'fireball') {
        const glow = ctx.createRadialGradient(screen.x, screen.y, 1, screen.x, screen.y, p.radius * 2.2);
        glow.addColorStop(0, `rgba(254, 249, 195, ${alpha})`);
        glow.addColorStop(0.35, `rgba(249, 115, 22, ${0.95 * alpha})`);
        glow.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, p.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, p.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(screen.x, screen.y);
        ctx.rotate(angle);
        ctx.strokeStyle = `rgba(244, 114, 182, ${0.85 * alpha})`;
        ctx.lineWidth = 3;
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          ctx.arc(0, 0, p.radius + ring * 4, -0.85, 0.85);
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(251, 207, 232, ${0.7 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 14, -0.6, 0.6);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderDebugOverlay(): void {
    const { ctx, camera, debugConfig, player } = this;
    if (!debugConfig.showHitboxes && !debugConfig.showRanges && !debugConfig.showSpatialGrid) {
      return;
    }

    ctx.save();

    // 1. Spatial Grid
    if (debugConfig.showSpatialGrid) {
      const cellSize = 110;
      const left = camera.x - camera.viewportWidth / 2;
      const top = camera.y - camera.viewportHeight / 2;
      const right = camera.x + camera.viewportWidth / 2;
      const bottom = camera.y + camera.viewportHeight / 2;

      const startCol = Math.floor(left / cellSize);
      const endCol = Math.floor(right / cellSize);
      const startRow = Math.floor(top / cellSize);
      const endRow = Math.floor(bottom / cellSize);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      for (let c = startCol; c <= endCol; c++) {
        const sx = c * cellSize - camera.x + camera.viewportWidth / 2 + camera.shakeOffsetX;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, camera.viewportHeight);
        ctx.stroke();
      }
      for (let r = startRow; r <= endRow; r++) {
        const sy = r * cellSize - camera.y + camera.viewportHeight / 2 + camera.shakeOffsetY;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(camera.viewportWidth, sy);
        ctx.stroke();
      }
    }

    // 2. Ranges (Pickup radius, Bible orbital, Garlic aura)
    if (debugConfig.showRanges) {
      const pScreen = camera.worldToScreen(player.x, player.y);

      // Pickup radius
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(pScreen.x, pScreen.y, player.pickupRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Garlic aura
      if (this.weaponSystem.weapons.has('garlic')) {
        const gRadius = this.weaponSystem.garlicRadius * player.areaMultiplier;
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pScreen.x, pScreen.y, gRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bible orbit
      if (this.weaponSystem.weapons.has('bible')) {
        const bRadius = this.weaponSystem.bibleRadius * player.areaMultiplier;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pScreen.x, pScreen.y, bRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 3. Hitboxes (Player, Enemies, Projectiles, Ground Zones)
    if (debugConfig.showHitboxes) {
      // Player
      const pScreen = camera.worldToScreen(player.x, player.y);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pScreen.x, pScreen.y, player.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Enemies
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!camera.isInView(e.x, e.y, e.radius)) continue;
        const eScreen = camera.worldToScreen(e.x, e.y);
        ctx.strokeStyle = e.isBoss ? '#f43f5e' : e.isElite ? '#f59e0b' : '#ef4444';
        ctx.lineWidth = e.isBoss ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(eScreen.x, eScreen.y, e.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Boss nova radius telegraph
        if (e.isBoss && e.skillState === 'telegraph_nova') {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(eScreen.x, eScreen.y, e.novaRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Projectiles
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < this.weaponSystem.projectiles.length; i++) {
        const p = this.weaponSystem.projectiles[i];
        if (!camera.isInView(p.x, p.y, p.radius)) continue;
        const pScreen = camera.worldToScreen(p.x, p.y);
        ctx.beginPath();
        ctx.arc(pScreen.x, pScreen.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ground Zones
      for (let i = 0; i < this.weaponSystem.groundZones.length; i++) {
        const z = this.weaponSystem.groundZones[i];
        if (!camera.isInView(z.x, z.y, z.radius)) continue;
        const zScreen = camera.worldToScreen(z.x, z.y);
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(zScreen.x, zScreen.y, z.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // --- DevTools Public API ---

  public devSpawnEnemy(type: EnemyType, count: number = 1): void {
    const minutes = this.waveDirector.survivalTime / 60;
    const hpMult = (1.0 + minutes * 0.52) * this.difficulty.enemyHp;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 150;
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;
      const enemy = this.waveDirector.createEnemy(type, x, y, hpMult);
      this.enemies.push(enemy);
      this.spatialGrid.insert(enemy);
    }
  }

  public devSpawnDummy(): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 130;
    const x = this.player.x + Math.cos(angle) * dist;
    const y = this.player.y + Math.sin(angle) * dist;
    const dummy = new Enemy(Date.now() + Math.random() * 1000, 'zombie', x, y, 100);
    dummy.name = '🎯 Boneco de Treino (Dummy)';
    dummy.maxHp = 1000000;
    dummy.hp = 1000000;
    dummy.speed = 0;
    dummy.damage = 0;
    dummy.knockbackResistance = 0;
    this.enemies.push(dummy);
    this.spatialGrid.insert(dummy);
  }

  public devSpawnDrop(type: Drop['type'], count: number = 1): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;
      const val = type === 'gem_red' ? 250 : type === 'gem_green' ? 25 : type === 'coin' ? 20 : 5;
      this.drops.push(new Drop(Date.now() + Math.random(), type, x, y, val));
    }
  }

  public devKillAllEnemies(withDrops: boolean = true): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (withDrops) {
        this.onEnemyKilled(e);
      }
    }
    this.enemies = [];
    this.spatialGrid.clear();
  }

  public devSkipTime(seconds: number): void {
    this.waveDirector.survivalTime = Math.max(0, this.waveDirector.survivalTime + seconds);
    this.syncHUD();
  }

  public devForceLevelUp(): void {
    const needed = Math.max(1, this.player.xpToNextLevel - this.player.xp);
    this.player.addXp(needed);
    const options = this.weaponSystem.generateUpgradeOptions();
    if (options.length > 0) {
      this.sound.playLevelUp();
      this.pause();
      this.callbacks.onLevelUp(options);
    }
  }

  public devDirectAddLevel(amount: number = 1): void {
    for (let i = 0; i < amount; i++) {
      this.player.level += 1;
      this.player.xpToNextLevel = Player.computeXpToNextLevel(this.player.level);
    }
    this.syncHUD();
  }

  public devMagnetAll(): void {
    this.sound.playLevelUp();
    this.vfx.triggerFlash('#38bdf8', 0.4);
    for (let i = 0; i < this.drops.length; i++) {
      this.drops[i].isBeingMagnetPulled = true;
    }
  }

  public devHealPlayer(): void {
    this.player.hp = this.player.maxHp;
    this.vfx.addDamageNumber(this.player.x, this.player.y, this.player.maxHp, false, true);
    this.sound.playGemPickup(8);
    this.syncHUD();
  }

  public devAddGold(amount: number = 500): void {
    this.goldCollected += amount;
    this.vfx.addDamageNumber(this.player.x, this.player.y, amount, true, true);
    this.sound.playGemPickup(4);
    this.syncHUD();
  }

  public devForceVictory(): void {
    this.handleVictory();
  }

  public devForceGameOver(): void {
    this.handlePlayerDeath();
  }

  public devSetFreezeSpawns(freeze: boolean): void {
    this.debugConfig.freezeSpawns = freeze;
    this.waveDirector.freezeSpawns = freeze;
  }

  public devToggleGodMode(): boolean {
    this.player.godMode = !this.player.godMode;
    return this.player.godMode;
  }

  public devToggleInfiniteStamina(): boolean {
    this.player.infiniteStamina = !this.player.infiniteStamina;
    return this.player.infiniteStamina;
  }

  public devToggleHitboxes(): boolean {
    this.debugConfig.showHitboxes = !this.debugConfig.showHitboxes;
    return this.debugConfig.showHitboxes;
  }

  public devToggleRanges(): boolean {
    this.debugConfig.showRanges = !this.debugConfig.showRanges;
    return this.debugConfig.showRanges;
  }

  public devToggleSpatialGrid(): boolean {
    this.debugConfig.showSpatialGrid = !this.debugConfig.showSpatialGrid;
    return this.debugConfig.showSpatialGrid;
  }

  public devSetTimeScale(scale: number): void {
    this.debugConfig.timeScale = scale;
  }

  public devModifyStat(
    stat: 'might' | 'speed' | 'cooldownReduction' | 'pickupRadius',
    delta: number
  ): void {
    if (stat === 'might') {
      this.player.might = Math.max(0.5, Math.min(10, this.player.might + delta));
    } else if (stat === 'speed') {
      this.player.speed = Math.max(60, Math.min(600, this.player.speed + delta));
    } else if (stat === 'cooldownReduction') {
      this.player.cooldownReduction = Math.max(0, Math.min(0.7, this.player.cooldownReduction + delta));
    } else if (stat === 'pickupRadius') {
      this.player.pickupRadius = Math.max(20, Math.min(500, this.player.pickupRadius + delta));
    }
  }

  public devMaximizeAllEquipped(): void {
    this.weaponSystem.weapons.forEach((w) => {
      this.weaponSystem.devSetWeaponLevel(w.id, w.maxLevel);
    });
    this.weaponSystem.passives.forEach((p) => {
      this.weaponSystem.devSetPassiveLevel(p.id, p.maxLevel, this.player);
    });
  }

  public devEvolveAllEquipped(): void {
    this.weaponSystem.weapons.forEach((w) => {
      this.weaponSystem.devSetWeaponLevel(w.id, w.maxLevel, true);
    });
  }

  public devClearExtraWeapons(): void {
    const initial = this.player.character.startingWeapon;
    this.weaponSystem.weapons.forEach((_, id) => {
      if (id !== initial) {
        this.weaponSystem.devRemoveWeapon(id);
      }
    });
    this.weaponSystem.passives.forEach((_, id) => {
      this.weaponSystem.devRemovePassive(id, this.player);
    });
  }

  public getDevTelemetry(): DevTelemetrySnapshot {
    const timeSurvived = Math.max(1, Math.floor(this.waveDirector.survivalTime));
    const weapons = Array.from(this.weaponSystem.weapons.values()).map((w) => {
      const meta = WEAPON_REGISTRY[w.id];
      return {
        id: w.id,
        level: w.level,
        evolved: w.evolved,
        name: w.evolved ? meta.evolvedName : meta.name,
        totalDamage: Math.round(w.totalDamageDealt),
        dps: Math.round((w.totalDamageDealt / timeSurvived) * 10) / 10,
      };
    });

    return {
      fps: this.currentFps,
      frameTimeMs: this.currentFrameTimeMs,
      enemyCount: this.enemies.length,
      projectileCount: this.weaponSystem.projectiles.length,
      groundZoneCount: this.weaponSystem.groundZones.length,
      dropCount: this.drops.length,
      vfxCount: this.vfx.count,
      godMode: this.player.godMode,
      infiniteStamina: this.player.infiniteStamina,
      timeScale: this.debugConfig.timeScale,
      freezeSpawns: this.debugConfig.freezeSpawns,
      survivalTime: Math.floor(this.waveDirector.survivalTime),
      playerLevel: this.player.level,
      playerHp: Math.round(this.player.hp),
      playerMaxHp: Math.round(this.player.maxHp),
      stamina: Math.round(this.player.stamina),
      maxStamina: Math.round(this.player.movementConfig.maxStamina),
      might: Math.round(this.player.might * 100) / 100,
      speed: Math.round(this.player.speed),
      cooldownReduction: Math.round(this.player.cooldownReduction * 100),
      areaMultiplier: Math.round(this.player.areaMultiplier * 100) / 100,
      pickupRadius: Math.round(this.player.pickupRadius),
      critChance: Math.round(this.player.critChance * 100),
      luck: Math.round(this.player.luck * 100),
      weapons,
    };
  }

  public destroy(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.input.destroy();
    this.sound.destroy();
  }
}
