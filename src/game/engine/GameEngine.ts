import {
  CharacterConfig,
  GameEndSummary,
  HUDState,
  UpgradeOption,
  SavedGameData,
  WeaponId,
  PassiveId,
  RunRecord,
  RelicConfig,
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
import { WorldSystem } from '../systems/WorldProps';
import { WEAPON_REGISTRY, PASSIVE_REGISTRY } from '../data/upgrades';
import { saveGameData, loadSavedData } from '../data/persistence';
import { DifficultyConfig, getDifficulty } from '../data/difficulty';
import { rollRelic, getRelic } from '../data/items';
import { applyRunToSave } from '../data/progress';

export interface GameEngineCallbacks {
  onHUDUpdate: (hud: HUDState) => void;
  onLevelUp: (options: UpgradeOption[]) => void;
  onTreasureChest: (gold: number, upgrade?: UpgradeOption, relic?: RelicConfig) => void;
  onGameOver: (summary: GameEndSummary) => void;
  onVictory: (summary: GameEndSummary) => void;
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

  public enemies: Enemy[] = [];
  public drops: Drop[] = [];

  public kills: number = 0;
  public goldCollected: number = 0;
  public bossesKilled: number = 0;
  public elitesKilled: number = 0;
  public relicsFound: number = 0;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public hasWon: boolean = false;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animFrameId: number | null = null;
  private hudThrottleTimer: number = 0;
  private gemStreak: number = 0;
  private gemStreakTimer: number = 0;
  private abilityTimer: number = 0;
  private accountXpEarned: number = 0;
  private newAchievements: string[] = [];
  private difficulty: DifficultyConfig;

  private callbacks: GameEngineCallbacks;

  constructor(
    canvas: HTMLCanvasElement,
    character: CharacterConfig,
    savedData: SavedGameData,
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
    this.worldProps = new WorldSystem();
    this.difficulty = getDifficulty(savedData.difficulty);
    this.waveDirector = new WaveDirector(this.difficulty);

    this.player = new Player(character, savedData.powerUps);
    this.weaponSystem = new WeaponSystem(character.startingWeapon);
    this.abilityTimer = character.specialAbility ? character.specialAbility.cooldown * 0.5 : 0;

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
    this.lastTime = performance.now();
  }

  public togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    const rawDt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    const dt = Math.min(rawDt, 0.1); // Prevent physics explosions after backgrounding

    if (!this.isPaused && !this.isGameOver) {
      this.update(dt);
    }

    this.render();

    this.animFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  private update(dt: number): void {
    // Update streak timer
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

    // 4. Update Enemies with soft separation
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const sep = this.spatialGrid.applySeparation(e, e.radius * 2, 0.45);
      const alive = e.update(dt, this.player, sep);

      if (!alive) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Check collision with player
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.player.radius + e.radius) {
        const fatal = this.player.takeDamage(e.damage);
        this.sound.playPlayerHurt();
        this.camera.shake(0.2, 5);
        this.vfx.addDamageNumber(this.player.x, this.player.y, e.damage, false, false);

        if (fatal) {
          this.handlePlayerDeath();
          return;
        }
      }

      // Signature attacks (nova, summon, etc.)
      const special = e.consumeSpecial();
      if (special) {
        this.resolveEnemySpecial(e, special, dist);
        if (this.isGameOver) return;
      }
    }

    // 5. Update World Props (Torches)
    this.worldProps.update(dt, this.player);

    // 6. Update Weapons System
    this.weaponSystem.update(
      dt,
      this.player,
      this.enemies,
      this.spatialGrid,
      this.worldProps,
      this.vfx,
      this.sound,
      (enemy) => this.onEnemyKilled(enemy),
      (drop) => this.drops.push(drop)
    );

    // 6.5. Character signature ability
    this.updateSpecialAbility(dt);

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
      (enemy) => this.enemies.push(enemy),
      (drop) => this.drops.push(drop)
    );

    // 9. Update VFX
    this.vfx.update(dt);

    // 10. Throttled React HUD synchronization (~10 Hz)
    this.hudThrottleTimer += dt;
    if (this.hudThrottleTimer >= 0.1) {
      this.hudThrottleTimer = 0;
      this.syncHUD();
    }
  }

  private onEnemyKilled(enemy: Enemy): void {
    this.kills += 1;
    this.vfx.addDeathBurst(enemy.x, enemy.y, enemy.type === 'bat' ? '#a855f7' : '#ef4444', enemy.isElite ? 25 : 8);

    if (enemy.isFinalBoss) {
      this.bossesKilled += 1;
      // Crimson Vampire Boss defeated!
      this.drops.push(new Drop(Date.now(), 'chest', enemy.x, enemy.y));
      this.drops.push(new Drop(Date.now() + 1, 'gem_red', enemy.x + 20, enemy.y, 250));
      this.drops.push(new Drop(Date.now() + 2, 'gem_red', enemy.x - 20, enemy.y, 250));
      this.handleVictory();
      return;
    }

    if (enemy.isBoss) {
      this.bossesKilled += 1;
      this.drops.push(new Drop(Date.now(), 'chest', enemy.x, enemy.y));
      this.drops.push(new Drop(Date.now() + 1, 'gem_red', enemy.x + 18, enemy.y, 180));
      return;
    }

    if (enemy.isElite) {
      this.elitesKilled += 1;
      // Drops a guaranteed Treasure Chest!
      this.drops.push(new Drop(Date.now(), 'chest', enemy.x, enemy.y));
      return;
    }

    // Standard XP gem drop
    let dropType: Drop['type'] = 'gem_blue';
    if (enemy.xpValue >= 20) {
      dropType = 'gem_green';
    }
    this.drops.push(new Drop(Date.now() + Math.random(), dropType, enemy.x, enemy.y, enemy.xpValue));
  }

  private handleDropCollected(drop: Drop): void {
    if (drop.type === 'gem_blue' || drop.type === 'gem_green' || drop.type === 'gem_red') {
      this.gemStreak += 1;
      this.gemStreakTimer = 0.5;
      this.sound.playGemPickup(this.gemStreak);
      const leveledUp = this.player.addXp(drop.value);

      if (leveledUp) {
        this.sound.playLevelUp();
        this.pause();
        const options = this.weaponSystem.generateUpgradeOptions();
        this.callbacks.onLevelUp(options);
      }
    } else if (drop.type === 'coin') {
      this.goldCollected += this.scaleGold(drop.value);
      this.sound.playGemPickup(4);
      this.vfx.addDamageNumber(this.player.x, this.player.y, this.scaleGold(drop.value), true, true);
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
      this.vfx.triggerFlash('#ffffff', 0.9);
      // Eliminate all non-boss enemies on screen
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (!e.isBoss && e.hp > 0) {
          this.onEnemyKilled(e);
          this.enemies.splice(i, 1);
        }
      }
    } else if (drop.type === 'chest') {
      this.sound.playChestOpen();
      this.pause();
      const goldBonus = this.scaleGold(50 + Math.floor(Math.random() * 50));
      this.goldCollected += goldBonus;
      const upgradeOptions = this.weaponSystem.generateUpgradeOptions();
      const chosenUpgrade = upgradeOptions.length > 0 ? upgradeOptions[0] : undefined;
      const relic =
        this.weaponSystem.relics.length < 6 ? rollRelic(this.weaponSystem.relics) : undefined;

      if (relic) {
        this.weaponSystem.addRelic(relic.id, this.player);
        this.relicsFound += 1;
        this.vfx.triggerFlash(relic.color, 0.35);
      }

      this.callbacks.onTreasureChest(goldBonus, chosenUpgrade, relic);
    }
  }

  private scaleGold(value: number): number {
    return Math.max(1, Math.round(value * this.difficulty.goldMult * this.player.goldMultiplier));
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
    this.sound.playVictory();
    this.persistRunStats(true);
    this.pause();

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
      level: this.player.level,
      goldEarned: this.goldCollected,
      totalDamage: Math.round(totalDmg),
      characterName: this.player.character.name,
      difficultyName: this.difficulty.name,
      accountXpEarned: this.accountXpEarned,
      newAchievements: this.newAchievements,
      relicsFound: this.relicsFound,
      weaponStats,
    };
  }

  private persistRunStats(won: boolean): void {
    const data = loadSavedData();
    const evolutions = Array.from(this.weaponSystem.weapons.values()).filter((weapon) => weapon.evolved).length;
    const run: RunRecord = {
      won,
      survivalTime: Math.max(1, Math.floor(this.waveDirector.survivalTime)),
      kills: this.kills,
      level: this.player.level,
      goldEarned: this.goldCollected,
      bossesKilled: this.bossesKilled,
      elitesKilled: this.elitesKilled,
      evolutions,
      relicsFound: this.relicsFound,
      characterId: this.player.character.id,
      difficulty: this.difficulty.id,
    };

    const applied = applyRunToSave(data, run);
    const next = applied.data;
    next.gold += this.goldCollected;
    next.highScore.timeSurvived = Math.max(next.highScore.timeSurvived, run.survivalTime);
    next.highScore.kills = Math.max(next.highScore.kills, this.kills);
    next.highScore.highestLevel = Math.max(next.highScore.highestLevel, this.player.level);
    if (won) next.highScore.wins += 1;
    saveGameData(next);

    this.accountXpEarned = applied.accountXpEarned;
    this.newAchievements = applied.unlockedAchievements.map((achievement) => achievement.name);
  }

  private resolveEnemySpecial(
    enemy: Enemy,
    special: { kind: 'nova' | 'summon'; radius: number; damage: number; color: string },
    distToPlayer: number
  ): void {
    if (special.kind === 'summon') {
      this.sound.playBossWarning();
      this.vfx.triggerFlash(special.color, 0.18);
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI * 2) / 4;
        const x = enemy.x + Math.cos(angle) * 58;
        const y = enemy.y + Math.sin(angle) * 58;
        this.enemies.push(this.waveDirector.spawnEnemy('bat', x, y, 1.1));
      }
      return;
    }

    if (distToPlayer <= special.radius + this.player.radius) {
      const fatal = this.player.takeDamage(special.damage);
      this.sound.playPlayerHurt();
      this.camera.shake(0.3, 7);
      this.vfx.addDamageNumber(this.player.x, this.player.y, special.damage, false, false);
      this.vfx.triggerFlash(special.color, 0.16);

      if (fatal) {
        this.handlePlayerDeath();
      }
    }
  }

  private updateSpecialAbility(dt: number): void {
    const ability = this.player.character.specialAbility;
    if (!ability) return;

    this.abilityTimer -= dt;
    if (this.abilityTimer > 0) return;
    this.abilityTimer = Math.max(3, ability.cooldown);

    if (ability.kind === 'heal') {
      this.player.heal(ability.power);
      this.sound.playLevelUp();
      this.vfx.addDamageNumber(this.player.x, this.player.y, ability.power, false, true);
      this.vfx.triggerFlash('#22c55e', 0.18);
    } else if (ability.kind === 'haste') {
      this.player.applyHaste(ability.power, ability.duration ?? 4);
      this.sound.playGemPickup(5);
      this.vfx.triggerFlash('#38bdf8', 0.2);
    } else if (ability.kind === 'shield') {
      this.player.invulnerableTimer = Math.max(this.player.invulnerableTimer, ability.duration ?? 2);
      this.sound.playChestOpen();
      this.vfx.triggerFlash('#fef08a', 0.28);
    } else if (ability.kind === 'nova') {
      const radius = ability.radius ?? 160;
      const damage = ability.power * this.player.might;
      let hits = 0;

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        const dx = enemy.x - this.player.x;
        const dy = enemy.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius + enemy.radius) {
          const pushX = dist > 0 ? dx / dist : 0;
          const pushY = dist > 0 ? dy / dist : 0;
          const dead = enemy.takeDamage(damage, pushX, pushY, 160);
          this.vfx.addDamageNumber(enemy.x, enemy.y, damage, true);
          hits += 1;
          if (dead) this.onEnemyKilled(enemy);
        }
      }

      if (hits > 0) this.sound.playThunder();
      this.sound.playBossWarning();
      this.camera.shake(0.25, 6);
      this.vfx.triggerFlash('#c084fc', 0.22);
    }
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

    const relicsList = this.weaponSystem.relics.map((relicId) => {
      const relic = getRelic(relicId);
      return { id: relic.id, name: relic.name, rarity: relic.rarity };
    });

    const ability = this.player.character.specialAbility
      ? {
          name: this.player.character.specialAbility.name,
          description: this.player.character.specialAbility.description,
          cooldown: this.player.character.specialAbility.cooldown,
          remaining: Math.max(0, this.abilityTimer),
        }
      : undefined;

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
      level: this.player.level,
      xp: Math.round(this.player.xp),
      xpToNextLevel: this.player.xpToNextLevel,
      survivalTime: Math.floor(this.waveDirector.survivalTime),
      kills: this.kills,
      gold: this.goldCollected,
      weapons: weaponsList,
      passives: passivesList,
      relics: relicsList,
      difficultyName: this.difficulty.name,
      ability,
      activeBoss,
      eventAlert: this.waveDirector.eventAlert || undefined,
    });
  }

  private render(): void {
    const { ctx, camera } = this;

    // 1. Clear & Render Floor Tile Pattern
    this.worldProps.renderFloor(ctx, camera);

    // 2. Render Torches & Props
    this.worldProps.renderTorches(ctx, camera);

    // 3. Render Drops (Gems, Pickups, Chests)
    for (let i = 0; i < this.drops.length; i++) {
      this.drops[i].render(ctx, camera);
    }

    // 4. Render Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].render(ctx, camera);
    }

    // 5. Render Player
    this.player.render(ctx, camera);

    // 6. Render Weapons (Auras, Slashes, Bibles, Projectiles, Lightning)
    this.weaponSystem.render(ctx, camera, this.player);

    // 7. Render VFX (Damage numbers, death particles, screen flash)
    this.vfx.render(ctx, camera);

    // 8. Render Virtual Joystick if active
    if (this.input.joystick.active) {
      const { startX, startY, currentX, currentY, radius } = this.input.joystick;
      ctx.save();
      // Outer ring
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner stick
      ctx.beginPath();
      ctx.arc(currentX, currentY, radius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
      ctx.restore();
    }
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
