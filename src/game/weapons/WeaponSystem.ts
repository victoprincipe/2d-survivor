import { WeaponId, PassiveId, UpgradeOption, WeaponInstance, PassiveInstance } from '../types';
import { WEAPON_REGISTRY, PASSIVE_REGISTRY, LULA_SKILL } from '../data/upgrades';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { SpatialGrid } from '../engine/SpatialGrid';
import { Camera } from '../engine/Camera';
import { SoundEngine } from '../engine/SoundEngine';
import { VFXManager } from '../entities/VFX';

export type ProjectileVisualType =
  | 'wand'
  | 'knife'
  | 'bow'
  | 'cheese_bread'
  | 'coffee'
  | 'cake'
  | 'flying_tray'
  | 'syringe'
  | 'fire_flask_lob'
  | 'executioner_axe';

export interface Projectile {
  id: number;
  type: ProjectileVisualType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierce: number;
  life: number;
  maxLife: number;
  weaponId: WeaponId;
  isEvolved: boolean;
  hitEnemyIds: Set<number>;
  knockForce?: number;
  bonusCritChance?: number;
  bonusCritMult?: number;
  bouncesLeft?: number;
  homingTurnRate?: number;
  gravityY?: number;
  spinAngle?: number;
  spinSpeed?: number;
  explosionRadius?: number;
  bleedDps?: number;
  bleedMaxDps?: number;
  bleedDuration?: number;
  slowFactor?: number;
  slowDuration?: number;
  poisonDps?: number;
  poisonDuration?: number;
  poisonContagious?: boolean;
  spawnBioCloudOnHit?: boolean;
  pierceCountSoFar?: number;
  spiral?: {
    followPlayer: boolean;
    originX: number;
    originY: number;
    angle: number;
    radius: number;
    angularSpeed: number;
    radialSpeed: number;
  };
  boomerang?: {
    phase: 'outbound' | 'hover' | 'return';
    phaseTimer: number;
    hoverDuration: number;
    maxSpeed: number;
    returnDamageMult: number;
    lockedReturnDir: boolean;
    dirX: number;
    dirY: number;
    triggeredPlayerNova: boolean;
  };
  lob?: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    elapsed: number;
    duration: number;
    arcHeight: number;
    zoneRadius: number;
    zoneDuration: number;
    zoneTickDamage: number;
  };
}

export interface WhipSlashEffect {
  x: number;
  y: number;
  width: number;
  height: number;
  life: number;
  maxLife: number;
  isEvolved: boolean;
  direction: number; // 1 right, -1 left
}

export interface LightningStrikeEffect {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  isEvolved: boolean;
}

export interface ChainArcEffect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface RingPulseEffect {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface GroundZoneEffect {
  id: number;
  type: 'fire' | 'bio_cloud' | 'static_field';
  weaponId: WeaponId;
  x: number;
  y: number;
  radius: number;
  tickDamage: number;
  tickInterval: number;
  tickTimer: number;
  life: number;
  maxLife: number;
  isEvolved: boolean;
  followPlayerSpeed?: number;
}

interface PendingStrike {
  timer: number;
  execute: () => void;
}

const ALL_WEAPON_IDS: WeaponId[] = [
  'whip',
  'wand',
  'knife',
  'bow',
  'bible',
  'garlic',
  'lightning',
  'derson_combo',
  'flying_tray',
  'syringe',
  'fire_flask',
  'executioner_axe',
  'lula_power',
];

const ALL_PASSIVE_IDS: PassiveId[] = [
  'spinach',
  'wings',
  'heart',
  'tome',
  'magnet',
  'bracer',
  'lantern',
  'clover',
  'hourglass',
  'duplicator',
  'hunter_mark',
  'bio_shield',
];

export class WeaponSystem {
  public weapons: Map<WeaponId, WeaponInstance> = new Map();
  public passives: Map<PassiveId, PassiveInstance> = new Map();

  public projectiles: Projectile[] = [];
  public whipSlashes: WhipSlashEffect[] = [];
  public lightningStrikes: LightningStrikeEffect[] = [];
  public chainArcs: ChainArcEffect[] = [];
  public ringPulses: RingPulseEffect[] = [];
  public groundZones: GroundZoneEffect[] = [];

  private pendingStrikes: PendingStrike[] = [];

  // Orbiting Bible cycle state
  public bibleAngle: number = 0;
  public bibleRadius: number = 70;
  public bibleIsActive: boolean = true;
  private bibleCycleTimer: number = 3.2;
  private bibleCycleMax: number = 3.2;
  private bibleHitCooldowns: Map<number, number> = new Map();

  // Garlic pulse state
  public garlicTimer: number = 0;
  public garlicRadius: number = 58;

  private nextProjId: number = 1;
  private nextZoneId: number = 1;

  constructor(startingWeapon: WeaponId) {
    this.addWeapon(startingWeapon);
  }

  addWeapon(id: WeaponId): void {
    if (!this.weapons.has(id)) {
      this.weapons.set(id, {
        id,
        level: 1,
        maxLevel: WEAPON_REGISTRY[id].maxLevel,
        evolved: false,
        cooldownTimer: 0,
        totalDamageDealt: 0,
        comboStep: 0,
      });
    }
  }

  addPassive(id: PassiveId, player: Player): void {
    const prevMaxHp = player.maxHp;
    const existing = this.passives.get(id);
    if (!existing) {
      this.passives.set(id, {
        id,
        level: 1,
        maxLevel: PASSIVE_REGISTRY[id].maxLevel,
      });
    } else {
      existing.level = Math.min(existing.maxLevel, existing.level + 1);
    }
    this.recalculatePlayerStats(player);

    // Instant heal for any Max HP increase (fixes Heart passive!)
    const gainedMaxHp = player.maxHp - prevMaxHp;
    if (gainedMaxHp > 0) {
      player.heal(gainedMaxHp);
    }
  }

  upgradeWeapon(id: WeaponId): void {
    const w = this.weapons.get(id);
    if (w && w.level < w.maxLevel) {
      w.level += 1;
    }
  }

  evolveWeapon(id: WeaponId): void {
    const w = this.weapons.get(id);
    if (w) {
      w.evolved = true;
      w.evolvedId = WEAPON_REGISTRY[id].evolvedId;
      w.cooldownTimer = 0;
      if (id === 'bible') {
        this.bibleIsActive = true;
      }
    }
  }

  devSetWeaponLevel(id: WeaponId, level: number, evolved?: boolean): void {
    let w = this.weapons.get(id);
    if (!w) {
      this.addWeapon(id);
      w = this.weapons.get(id)!;
    }
    w.level = Math.max(1, Math.min(WEAPON_REGISTRY[id].maxLevel, level));
    if (evolved !== undefined) {
      w.evolved = evolved;
      w.evolvedId = evolved ? WEAPON_REGISTRY[id].evolvedId : undefined;
      if (id === 'bible' && evolved) {
        this.bibleIsActive = true;
      }
    }
  }

  devRemoveWeapon(id: WeaponId): void {
    this.weapons.delete(id);
    this.projectiles = this.projectiles.filter((p) => p.weaponId !== id);
    this.groundZones = this.groundZones.filter((z) => z.weaponId !== id);
  }

  devSetPassiveLevel(id: PassiveId, level: number, player: Player): void {
    const prevMaxHp = player.maxHp;
    if (level <= 0) {
      this.passives.delete(id);
    } else {
      const p = this.passives.get(id);
      if (!p) {
        this.passives.set(id, {
          id,
          level: Math.min(PASSIVE_REGISTRY[id].maxLevel, level),
          maxLevel: PASSIVE_REGISTRY[id].maxLevel,
        });
      } else {
        p.level = Math.min(p.maxLevel, level);
      }
    }
    this.recalculatePlayerStats(player);
    const gainedMaxHp = player.maxHp - prevMaxHp;
    if (gainedMaxHp > 0) {
      player.heal(gainedMaxHp);
    }
  }

  devRemovePassive(id: PassiveId, player: Player): void {
    this.passives.delete(id);
    this.recalculatePlayerStats(player);
  }

  recalculatePlayerStats(player: Player): void {
    const b = player.character.statBonuses;
    const perm = player.powerUps;

    // Reset player modifiers to character base + permanent shop bonuses
    player.might = 1.0 + (b.might || 0) + (perm.might || 0) * 0.05;
    player.armor = (b.armor || 0) + (perm.armor || 0) * 1;
    player.maxHp = 100 + (b.maxHp || 0) + (perm.maxHp || 0) * 10;
    player.recoveryPerSec = (b.recovery || 0) + (perm.recovery || 0) * 0.5;
    player.cooldownReduction = b.cooldownReduction || 0;
    player.projectileSpeedMultiplier = 1.0;
    player.areaMultiplier = 1.0 + (b.area || 0);
    player.durationMultiplier = 1.0;
    player.critChance = 0.05 + (b.critChance || 0);
    player.critMultiplier = 1.75;
    player.bonusAmount = 0;
    player.bonusPierce = 0;
    player.knockbackMultiplier = 1.0;
    player.debuffDamageBonus = 0;
    player.luck = 0;
    player.pickupRadius = 65 + (b.pickupRadius || 0);
    player.xpMultiplier = 1.0 + (b.xpMultiplier || 0);
    player.goldMultiplier = 1.0 + (perm.greed || 0) * 0.15;
    player.speed = player.baseSpeed;

    // Apply all 12 passives
    const spinach = this.passives.get('spinach');
    if (spinach) player.might += spinach.level * 0.1;

    const wings = this.passives.get('wings');
    if (wings) player.speed *= 1 + wings.level * 0.09;

    const heart = this.passives.get('heart');
    if (heart) {
      player.maxHp += heart.level * 20;
      player.recoveryPerSec += heart.level * 0.6;
    }

    const tome = this.passives.get('tome');
    if (tome) player.cooldownReduction += tome.level * 0.07;

    const magnet = this.passives.get('magnet');
    if (magnet) player.pickupRadius += magnet.level * 22;

    const bracer = this.passives.get('bracer');
    if (bracer) {
      player.projectileSpeedMultiplier += bracer.level * 0.14;
      player.bonusPierce += (bracer.level >= 3 ? 1 : 0) + (bracer.level >= 5 ? 1 : 0);
    }

    const lantern = this.passives.get('lantern');
    if (lantern) player.areaMultiplier += lantern.level * 0.1;

    const clover = this.passives.get('clover');
    if (clover) {
      player.critChance += clover.level * 0.06;
      player.luck += clover.level * 0.08;
    }

    const hourglass = this.passives.get('hourglass');
    if (hourglass) player.durationMultiplier += hourglass.level * 0.15;

    const duplicator = this.passives.get('duplicator');
    if (duplicator) {
      player.bonusAmount += (duplicator.level >= 1 ? 1 : 0) + (duplicator.level >= 3 ? 1 : 0);
      if (duplicator.level >= 2) player.might += 0.1;
    }

    const hunterMark = this.passives.get('hunter_mark');
    if (hunterMark) {
      player.critMultiplier += hunterMark.level * 0.2;
      player.knockbackMultiplier += hunterMark.level * 0.1;
    }

    const bioShield = this.passives.get('bio_shield');
    if (bioShield) {
      player.armor += bioShield.level * 1;
      player.debuffDamageBonus += bioShield.level * 0.1;
    }

    player.cooldownReduction = Math.min(0.55, player.cooldownReduction);
    player.critChance = Math.min(0.85, player.critChance);
    player.hp = Math.min(player.hp, player.maxHp);
  }

  public spawnRingPulse(x: number, y: number, radius: number, color: string, duration: number = 0.28): void {
    this.ringPulses.push({ x, y, radius, color, life: duration, maxLife: duration });
  }

  update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    spatialGrid: SpatialGrid<Enemy>,
    camera: Camera,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    // 1. Decay visual effects
    for (let i = this.whipSlashes.length - 1; i >= 0; i--) {
      this.whipSlashes[i].life -= dt;
      if (this.whipSlashes[i].life <= 0) this.whipSlashes.splice(i, 1);
    }
    for (let i = this.lightningStrikes.length - 1; i >= 0; i--) {
      this.lightningStrikes[i].life -= dt;
      if (this.lightningStrikes[i].life <= 0) this.lightningStrikes.splice(i, 1);
    }
    for (let i = this.chainArcs.length - 1; i >= 0; i--) {
      this.chainArcs[i].life -= dt;
      if (this.chainArcs[i].life <= 0) this.chainArcs.splice(i, 1);
    }
    for (let i = this.ringPulses.length - 1; i >= 0; i--) {
      this.ringPulses[i].life -= dt;
      if (this.ringPulses[i].life <= 0) this.ringPulses.splice(i, 1);
    }

    // 2. Process delayed multi-strikes (Whip Lv5 double crack, Thunder Loop echo)
    for (let i = this.pendingStrikes.length - 1; i >= 0; i--) {
      this.pendingStrikes[i].timer -= dt;
      if (this.pendingStrikes[i].timer <= 0) {
        const strike = this.pendingStrikes[i];
        this.pendingStrikes.splice(i, 1);
        strike.execute();
      }
    }

    // 3. Process enemy DoTs (Poison & Bleed)
    this.updateEnemyDoTs(dt, player, enemies, spatialGrid, vfx, onEnemyKilled);

    // 4. Update weapon cooldowns & trigger active firing
    this.weapons.forEach((weapon) => {
      if (weapon.id === 'bible' || weapon.id === 'garlic') return;
      weapon.cooldownTimer -= dt;
      if (weapon.cooldownTimer <= 0) {
        this.fireWeapon(weapon, player, enemies, spatialGrid, camera, vfx, sound, onEnemyKilled);
      }
    });

    // 5. Update continuous/cyclic weapons & ground zones
    this.updateBible(dt, player, spatialGrid, vfx, sound, onEnemyKilled);
    this.updateGarlic(dt, player, spatialGrid, vfx, sound, onEnemyKilled);
    this.updateGroundZones(dt, player, spatialGrid, vfx, onEnemyKilled);

    // 6. Update all flying, homing, bouncing, parabolic & boomerang projectiles
    this.updateProjectiles(dt, player, spatialGrid, vfx, sound, onEnemyKilled);
  }

  private dealHitToEnemy(
    w: WeaponInstance | undefined,
    enemy: Enemy,
    rawBaseDamage: number,
    player: Player,
    knockX: number,
    knockY: number,
    knockForce: number,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    onEnemyKilled: (enemy: Enemy) => void,
    bonusCritChance: number = 0,
    bonusCritMult: number = 0,
    showNumber: boolean = true
  ): { dead: boolean; isCrit: boolean; dealt: number } {
    if (enemy.hp <= 0) {
      return { dead: false, isCrit: false, dealt: 0 };
    }

    const totalCritChance = Math.min(0.9, player.critChance + bonusCritChance);
    const isCrit = Math.random() < totalCritChance;
    const critMult = isCrit ? player.critMultiplier + bonusCritMult : 1.0;
    const amplified = enemy.computeDamageTaken(rawBaseDamage * critMult, player.debuffDamageBonus);

    if (w) {
      w.totalDamageDealt += amplified;
    }

    const dead = enemy.takeDamage(
      amplified,
      knockX,
      knockY,
      knockForce * player.knockbackMultiplier
    );

    if (showNumber) {
      vfx.addDamageNumber(enemy.x, enemy.y, amplified, isCrit);
    }

    if (dead) {
      this.handleOnDeathTriggers(enemy, player, grid, vfx, onEnemyKilled);
      onEnemyKilled(enemy);
    }

    return { dead, isCrit, dealt: amplified };
  }

  private handleOnDeathTriggers(
    deadEnemy: Enemy,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    // 1. Syringe Lv5+ Epidemic Contagion spread!
    if (deadEnemy.poisonTimer > 0 && deadEnemy.isContagious && deadEnemy.poisonSourceWeapon) {
      const spreadRadius = 88 * player.areaMultiplier;
      this.spawnRingPulse(deadEnemy.x, deadEnemy.y, spreadRadius, '#22d3ee', 0.24);
      vfx.addSparks(deadEnemy.x, deadEnemy.y, '#22d3ee', 6);
      const neighbors = grid.queryRadius(deadEnemy.x, deadEnemy.y, spreadRadius);
      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        if (n.id === deadEnemy.id || n.hp <= 0) continue;
        n.applySlow(0.35, 2.2 * player.durationMultiplier);
        n.applyPoison(
          deadEnemy.poisonDps * 0.9,
          2.8 * player.durationMultiplier,
          deadEnemy.poisonSourceWeapon,
          false
        );
      }
    }

    // 2. Soul Eater (Evolved Garlic) Corpse Explosion!
    if (deadEnemy.soulEaterMarkTimer > 0) {
      deadEnemy.soulEaterMarkTimer = 0; // Prevent recursion loops
      const garlicWeapon = this.weapons.get('garlic');
      const blastRadius = 72 * player.areaMultiplier;
      const blastDamage = 20 * player.might + deadEnemy.maxHp * 0.14;
      this.spawnRingPulse(deadEnemy.x, deadEnemy.y, blastRadius, '#ef4444', 0.25);
      vfx.addSparks(deadEnemy.x, deadEnemy.y, '#dc2626', 6);

      const neighbors = grid.queryRadius(deadEnemy.x, deadEnemy.y, blastRadius);
      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        if (n.id === deadEnemy.id || n.hp <= 0) continue;
        const angle = Math.atan2(n.y - deadEnemy.y, n.x - deadEnemy.x);
        const amplified = n.computeDamageTaken(blastDamage, player.debuffDamageBonus);
        if (garlicWeapon) garlicWeapon.totalDamageDealt += amplified;
        const killed = n.takeDamage(amplified, Math.cos(angle), Math.sin(angle), 90);
        vfx.addDamageNumber(n.x, n.y, amplified, false);
        if (killed) onEnemyKilled(n);
      }
    }
  }

  private updateEnemyDoTs(
    dt: number,
    player: Player,
    enemies: Enemy[],
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.hp <= 0 || (e.poisonTimer <= 0 && e.bleedTimer <= 0)) continue;

      e.dotTickTimer -= dt;
      if (e.dotTickTimer <= 0) {
        e.dotTickTimer = 0.5;
        let totalTick = 0;

        if (e.poisonTimer > 0 && e.poisonDps > 0) {
          const pDmg = e.computeDamageTaken(e.poisonDps * 0.5, player.debuffDamageBonus);
          totalTick += pDmg;
          if (e.poisonSourceWeapon) {
            const w = this.weapons.get(e.poisonSourceWeapon);
            if (w) w.totalDamageDealt += pDmg;
          }
        }

        if (e.bleedTimer > 0 && e.bleedDps > 0) {
          const bDmg = e.computeDamageTaken(e.bleedDps * 0.5, player.debuffDamageBonus);
          totalTick += bDmg;
          if (e.bleedSourceWeapon) {
            const w = this.weapons.get(e.bleedSourceWeapon);
            if (w) w.totalDamageDealt += bDmg;
          }
        }

        if (totalTick > 0) {
          e.hp -= totalTick;
          if (Math.random() < 0.55) {
            vfx.addDamageNumber(e.x, e.y - 6, totalTick, false);
          }
          if (e.hp <= 0) {
            this.handleOnDeathTriggers(e, player, grid, vfx, onEnemyKilled);
            onEnemyKilled(e);
          }
        }
      }
    }
  }

  private fireWeapon(
    w: WeaponInstance,
    player: Player,
    enemies: Enemy[],
    grid: SpatialGrid<Enemy>,
    camera: Camera,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    // Buriti buff: shorter cooldowns (faster attacks) for its duration.
    const attackSpeedFactor = player.attackSpeedBoostTimer > 0 ? 0.65 : 1;
    const cdFactor = Math.max(0.45, 1 - player.cooldownReduction) * attackSpeedFactor;

    switch (w.id) {
      case 'whip': {
        const baseCd = w.evolved ? 0.92 : w.level >= 4 ? 1.02 : 1.28;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerWhip(w, player, grid, vfx, sound, onEnemyKilled);
        break;
      }
      case 'wand': {
        const baseCd = w.evolved ? 0.28 : w.level >= 5 ? 0.82 : 1.02;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerWand(w, player, grid, sound);
        break;
      }
      case 'knife': {
        const baseCd = w.evolved ? 0.18 : w.level >= 5 ? 0.6 : 0.78;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerKnife(w, player, sound);
        break;
      }
      case 'bow': {
        const baseCd = w.evolved ? 0.72 : w.level >= 5 ? 1.12 : 1.42;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerBow(w, player, grid, sound);
        break;
      }
      case 'lightning': {
        const baseCd = w.evolved ? 1.55 : w.level >= 5 ? 1.9 : 2.35;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerLightning(w, player, enemies, grid, camera, vfx, sound, onEnemyKilled);
        break;
      }
      case 'derson_combo': {
        const baseCd = w.evolved ? 0.62 : w.level >= 5 ? 0.66 : 0.82;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerDersonCombo(w, player, grid, sound);
        break;
      }
      case 'flying_tray': {
        const baseCd = w.evolved ? 0.88 : w.level >= 5 ? 1.0 : 1.28;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerFlyingTray(w, player, grid, sound);
        break;
      }
      case 'syringe': {
        const baseCd = w.evolved ? 0.7 : Math.max(0.74, 0.94 - w.level * 0.04);
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerSyringe(w, player, grid, sound);
        break;
      }
      case 'fire_flask': {
        const baseCd = w.evolved ? 1.35 : w.level >= 5 ? 1.65 : 2.05;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerFireFlask(w, player, enemies, camera, sound);
        break;
      }
      case 'executioner_axe': {
        const baseCd = w.evolved ? 1.05 : w.level >= 5 ? 1.18 : 1.48;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerExecutionerAxe(w, player, grid, sound);
        break;
      }
      case 'lula_power': {
        const baseCd = w.evolved
          ? 4.0
          : w.level >= 5
            ? 4.2
            : LULA_SKILL.cooldown / 1000;
        w.cooldownTimer = baseCd * cdFactor;
        this.triggerPoderDoL(w, player, grid, vfx, sound, onEnemyKilled);
        break;
      }
    }
  }

  private performWhipStrike(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void,
    damageScale: number = 1.0,
    widthScale: number = 1.0
  ): void {
    sound.playWhip();
    const facing = player.facingX < 0 ? -1 : 1;
    const dmgTable = [0, 22, 29, 34, 40, 44];
    const baseDamage = (w.evolved ? 46 : dmgTable[w.level] || 22) * player.might * damageScale;
    const slashWidth =
      (w.evolved ? 172 : 115 + w.level * 12) * player.areaMultiplier * widthScale;
    const slashHeight = (w.evolved ? 76 : 52 + w.level * 3) * player.areaMultiplier;

    // Front slash
    this.whipSlashes.push({
      x: player.x + (slashWidth / 2) * facing,
      y: player.y,
      width: slashWidth,
      height: slashHeight,
      life: 0.18,
      maxLife: 0.18,
      isEvolved: w.evolved,
      direction: facing,
    });

    const hitBack = w.level >= 3 || w.evolved;
    if (hitBack) {
      this.whipSlashes.push({
        x: player.x - (slashWidth / 2) * facing,
        y: player.y,
        width: slashWidth,
        height: slashHeight,
        life: 0.18,
        maxLife: 0.18,
        isEvolved: w.evolved,
        direction: -facing,
      });
    }

    const targets = grid.queryRadius(player.x, player.y, slashWidth + 24);
    let hitCount = 0;
    let healedThisSwing = 0;

    for (let i = 0; i < targets.length; i++) {
      const e = targets[i];
      if (e.hp <= 0) continue;

      const inFront =
        facing > 0
          ? e.x >= player.x - 12 && e.x <= player.x + slashWidth
          : e.x <= player.x + 12 && e.x >= player.x - slashWidth;
      const inBack =
        hitBack &&
        (facing > 0
          ? e.x <= player.x + 12 && e.x >= player.x - slashWidth
          : e.x >= player.x - 12 && e.x <= player.x + slashWidth);

      if ((inFront || inBack) && Math.abs(e.y - player.y) <= slashHeight / 2 + e.radius) {
        const knockX = e.x >= player.x ? 1 : -1;
        const result = this.dealHitToEnemy(
          w,
          e,
          baseDamage,
          player,
          knockX,
          0,
          175,
          grid,
          vfx,
          onEnemyKilled,
          w.evolved ? 0.3 : 0.05,
          w.evolved ? 0.35 : 0
        );
        hitCount++;

        if (w.level >= 4 || w.evolved) {
          e.applyBleed(
            (w.evolved ? 14 : 8) * player.might,
            32 * player.might,
            3.0 * player.durationMultiplier,
            'whip'
          );
        }

        if (w.evolved && result.isCrit && healedThisSwing < 6) {
          player.heal(2);
          healedThisSwing += 2;
          vfx.addDamageNumber(player.x, player.y - 8, 2, false, true);
        }
      }
    }

    if (hitCount > 0) sound.playHit();
  }

  private triggerWhip(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    this.performWhipStrike(w, player, grid, vfx, sound, onEnemyKilled, 1.0, 1.0);

    // Lv5 & Evolved: Genuine delayed 2nd whip crack!
    if (w.level >= 5 || w.evolved) {
      this.pendingStrikes.push({
        timer: 0.14,
        execute: () => {
          this.performWhipStrike(
            w,
            player,
            grid,
            vfx,
            sound,
            onEnemyKilled,
            w.evolved ? 1.0 : 0.85,
            1.1
          );
        },
      });
    }

    // Duplicator adds an extra echo lash
    if (player.bonusAmount > 0) {
      this.pendingStrikes.push({
        timer: 0.28,
        execute: () => {
          this.performWhipStrike(w, player, grid, vfx, sound, onEnemyKilled, 0.75, 1.05);
        },
      });
    }
  }

  private triggerWand(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    sound: SoundEngine
  ): void {
    const nearby = grid.queryRadius(player.x, player.y, 480);
    if (nearby.length === 0) return;

    nearby.sort((a, b) => {
      const da = (a.x - player.x) ** 2 + (a.y - player.y) ** 2;
      const db = (b.x - player.x) ** 2 + (b.y - player.y) ** 2;
      return da - db;
    });

    const baseCount = w.evolved ? 3 : 1 + (w.level >= 2 ? 1 : 0) + (w.level >= 4 ? 1 : 0);
    const projectileCount = baseCount + player.bonusAmount;
    const speed = (w.evolved ? 470 : 370) * player.projectileSpeedMultiplier;
    const dmgTable = [0, 16, 18, 22, 26, 31];
    const baseDamage = (w.evolved ? 24 : dmgTable[w.level] || 16) * player.might;
    const bounces =
      (w.evolved ? 2 : w.level >= 5 ? 2 : w.level >= 3 ? 1 : 0) +
      Math.floor(player.bonusPierce / 2);
    const life = 1.6 * player.durationMultiplier;

    for (let i = 0; i < projectileCount; i++) {
      const target = nearby[i % nearby.length];
      const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
      const jitter = (i - (projectileCount - 1) / 2) * 0.14;
      const angle = baseAngle + jitter;

      this.projectiles.push({
        id: this.nextProjId++,
        type: 'wand',
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: (w.evolved ? 9 : 7) * player.areaMultiplier,
        damage: baseDamage,
        pierce: 1 + bounces,
        bouncesLeft: bounces,
        homingTurnRate: w.evolved ? 7.5 : 5.5,
        explosionRadius: w.evolved ? 42 * player.areaMultiplier : 0,
        life,
        maxLife: life,
        weaponId: 'wand',
        isEvolved: w.evolved,
        hitEnemyIds: new Set(),
      });
    }

    sound.playShoot();
  }

  private triggerKnife(w: WeaponInstance, player: Player, sound: SoundEngine): void {
    const countTable = [0, 1, 2, 2, 3, 4];
    const projectileCount = (w.evolved ? 3 : countTable[w.level] || 1) + player.bonusAmount;
    const speed = (w.evolved ? 600 : 460) * player.projectileSpeedMultiplier;
    const dmgTable = [0, 14, 16, 19, 23, 27];
    const baseDamage = (w.evolved ? 21 : dmgTable[w.level] || 14) * player.might;
    const baseAngle = Math.atan2(player.facingY, player.facingX);
    const perpX = -Math.sin(baseAngle);
    const perpY = Math.cos(baseAngle);
    const life = 1.2 * player.durationMultiplier;
    const applyBleed = w.level >= 3 || w.evolved;

    for (let i = 0; i < projectileCount; i++) {
      const offsetIdx = i - (projectileCount - 1) / 2;
      const spreadAngle = baseAngle + offsetIdx * (w.evolved ? 0.06 : 0.09);
      const laneOffset = offsetIdx * 7;

      this.projectiles.push({
        id: this.nextProjId++,
        type: 'knife',
        x: player.x + perpX * laneOffset,
        y: player.y + perpY * laneOffset,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed,
        radius: 6 * player.areaMultiplier,
        damage: baseDamage,
        pierce: (w.evolved ? 3 : w.level >= 3 ? 2 : 1) + player.bonusPierce,
        bonusCritChance: w.evolved ? 0.22 : 0.15,
        bleedDps: applyBleed ? (w.evolved ? 9 : 6) * player.might : 0,
        bleedMaxDps: (w.evolved ? 85 : 36) * player.might,
        bleedDuration: 2.5 * player.durationMultiplier,
        life,
        maxLife: life,
        weaponId: 'knife',
        isEvolved: w.evolved,
        hitEnemyIds: new Set(),
      });
    }

    sound.playKnife();
  }

  private triggerBow(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    sound: SoundEngine
  ): void {
    const nearby = grid.queryRadius(player.x, player.y, 580);
    // Priority Sniper: sort by highest Max HP first, then closest!
    nearby.sort((a, b) => {
      if (b.maxHp !== a.maxHp) return b.maxHp - a.maxHp;
      const da = (a.x - player.x) ** 2 + (a.y - player.y) ** 2;
      const db = (b.x - player.x) ** 2 + (b.y - player.y) ** 2;
      return da - db;
    });

    const projectileCount = (w.evolved ? 3 : 1 + (w.level >= 4 ? 1 : 0)) + player.bonusAmount;
    const speed = (w.evolved ? 780 : 620) * player.projectileSpeedMultiplier;
    const dmgTable = [0, 30, 41, 48, 54, 64];
    const baseDamage = (w.evolved ? 58 : dmgTable[w.level] || 30) * player.might;
    const pierce =
      (w.evolved ? 99 : w.level >= 5 ? 14 : w.level >= 3 ? 7 : 4) + player.bonusPierce;
    const fallbackAngle = Math.atan2(player.facingY, player.facingX);
    const life = 1.45 * player.durationMultiplier;

    for (let i = 0; i < projectileCount; i++) {
      const target = nearby[i];
      const angle = target
        ? Math.atan2(target.y - player.y, target.x - player.x)
        : (nearby[0]
            ? Math.atan2(nearby[0].y - player.y, nearby[0].x - player.x)
            : fallbackAngle) +
          (i - (projectileCount - 1) / 2) * 0.14;

      this.projectiles.push({
        id: this.nextProjId++,
        type: 'bow',
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: (w.evolved ? 11 : 9) * player.areaMultiplier,
        damage: baseDamage,
        pierce,
        knockForce: 235,
        bonusCritChance: 0.1,
        bonusCritMult: w.level >= 3 || w.evolved ? 0.35 : 0.1,
        explosionRadius: w.evolved ? 64 * player.areaMultiplier : 0,
        pierceCountSoFar: 0,
        life,
        maxLife: life,
        weaponId: 'bow',
        isEvolved: w.evolved,
        hitEnemyIds: new Set(),
      });
    }

    sound.playShoot();
  }

  private triggerSyringe(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    sound: SoundEngine
  ): void {
    const nearby = grid.queryRadius(player.x, player.y, 500);
    // Smart Medical Triage: target healthy/uninfected enemies first!
    nearby.sort((a, b) => {
      const aHealthy = a.poisonTimer <= 0 ? 0 : 1;
      const bHealthy = b.poisonTimer <= 0 ? 0 : 1;
      if (aHealthy !== bHealthy) return aHealthy - bHealthy;
      const da = (a.x - player.x) ** 2 + (a.y - player.y) ** 2;
      const db = (b.x - player.x) ** 2 + (b.y - player.y) ** 2;
      return da - db;
    });

    const baseCount = w.evolved ? 4 : 1 + (w.level >= 2 ? 1 : 0) + (w.level >= 4 ? 1 : 0);
    const projectileCount = baseCount + player.bonusAmount;
    const speed = (w.evolved ? 600 : 470) * player.projectileSpeedMultiplier;
    const dmgTable = [0, 13, 15, 19, 22, 26];
    const baseDamage = (w.evolved ? 23 : dmgTable[w.level] || 13) * player.might;
    const pierce =
      (w.evolved ? 5 : 1 + (w.level >= 3 ? 1 : 0) + (w.level >= 5 ? 1 : 0)) + player.bonusPierce;
    const fallbackAngle = nearby[0]
      ? Math.atan2(nearby[0].y - player.y, nearby[0].x - player.x)
      : Math.atan2(player.facingY, player.facingX);
    const life = 1.4 * player.durationMultiplier;

    for (let i = 0; i < projectileCount; i++) {
      const target = nearby[i];
      const angle = target
        ? Math.atan2(target.y - player.y, target.x - player.x)
        : fallbackAngle + (i - (projectileCount - 1) / 2) * 0.16;

      this.projectiles.push({
        id: this.nextProjId++,
        type: 'syringe',
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: (w.evolved ? 8.5 : 5.5) * player.areaMultiplier,
        damage: baseDamage,
        pierce,
        slowFactor: w.evolved ? 0.45 : 0.35,
        slowDuration: 2.6 * player.durationMultiplier,
        poisonDps: (w.evolved ? 22 : w.level >= 3 ? 14 : 9) * player.might,
        poisonDuration: 3.2 * player.durationMultiplier,
        poisonContagious: w.level >= 5 || w.evolved,
        spawnBioCloudOnHit: w.evolved,
        life,
        maxLife: life,
        weaponId: 'syringe',
        isEvolved: w.evolved,
        hitEnemyIds: new Set(),
      });
    }

    sound.playShoot();
  }

  private triggerDersonCombo(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    sound: SoundEngine
  ): void {
    const nearby = grid.queryRadius(player.x, player.y, 490);
    let closest: Enemy | undefined;
    let closestDist = Infinity;

    for (let i = 0; i < nearby.length; i++) {
      const dx = nearby[i].x - player.x;
      const dy = nearby[i].y - player.y;
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closest = nearby[i];
      }
    }

    const facingAngle = Math.atan2(player.facingY, player.facingX);
    const aimAngle = closest
      ? Math.atan2(closest.y - player.y, closest.x - player.x)
      : facingAngle;

    const step = w.comboStep ?? 0;
    w.comboStep = (step + 1) % 3;

    const fireCheeseBread = w.evolved || step === 0;
    const fireCoffee = w.evolved || step === 1;
    const fireCake = w.evolved || step === 2;

    if (w.evolved) {
      player.speedBoostTimer = 0.55; // Delivery rush!
    }

    if (fireCheeseBread) {
      const count = (w.evolved ? 4 : w.level >= 4 ? 4 : 3) + player.bonusAmount;
      const speed = (w.evolved ? 680 : 580) * player.projectileSpeedMultiplier;
      const dmgTable = [0, 14, 18, 21, 24, 28];
      const baseDamage = (w.evolved ? 29 : dmgTable[w.level] || 14) * player.might;
      const bounces = w.evolved ? 2 : w.level >= 2 ? 2 : 1;
      const life = 1.35 * player.durationMultiplier;

      for (let i = 0; i < count; i++) {
        const angle = aimAngle + (i - (count - 1) / 2) * 0.14;
        this.projectiles.push({
          id: this.nextProjId++,
          type: 'cheese_bread',
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 7 * player.areaMultiplier,
          damage: baseDamage,
          pierce: 1 + bounces,
          bouncesLeft: bounces,
          life,
          maxLife: life,
          weaponId: 'derson_combo',
          isEvolved: w.evolved,
          hitEnemyIds: new Set(),
        });
      }
      sound.playShoot();
    }

    if (fireCoffee) {
      const cupCount = 1 + Math.min(1, player.bonusAmount);
      const dmgTable = [0, 18, 23, 27, 32, 37];
      const baseDamage = (w.evolved ? 36 : dmgTable[w.level] || 18) * player.might;
      const pierce =
        (w.evolved ? 9 : w.level >= 3 ? 6 : 4) + player.bonusPierce;
      const radialSpeed = (w.evolved ? 115 : 95) * player.projectileSpeedMultiplier;
      const life = (w.evolved ? 2.1 : w.level >= 3 ? 1.9 : 1.55) * player.durationMultiplier;

      for (let c = 0; c < cupCount; c++) {
        const startAngle = aimAngle + c * Math.PI;
        this.projectiles.push({
          id: this.nextProjId++,
          type: 'coffee',
          x: player.x,
          y: player.y,
          vx: 0,
          vy: 0,
          radius: 10 * player.areaMultiplier,
          damage: baseDamage,
          pierce,
          life,
          maxLife: life,
          weaponId: 'derson_combo',
          isEvolved: w.evolved,
          hitEnemyIds: new Set(),
          spiral: {
            followPlayer: true,
            originX: player.x,
            originY: player.y,
            angle: startAngle,
            radius: 18,
            angularSpeed: 7.2 + w.level * 0.35,
            radialSpeed,
          },
        });
      }
      if (!fireCheeseBread) sound.playShoot();
    }

    if (fireCake) {
      const count = 3 + player.bonusAmount;
      const spread = w.evolved ? 0.22 : 0.18;
      const speed = (w.evolved ? 520 : 450) * player.projectileSpeedMultiplier;
      const dmgTable = [0, 15, 19, 22, 26, 31];
      const baseDamage = (w.evolved ? 32 : dmgTable[w.level] || 15) * player.might;
      const splashRadius =
        (w.evolved ? 46 : w.level >= 4 ? 40 : 28) * player.areaMultiplier;
      const life = 1.3 * player.durationMultiplier;

      for (let i = 0; i < count; i++) {
        const angle = aimAngle + (i - (count - 1) / 2) * spread;
        this.projectiles.push({
          id: this.nextProjId++,
          type: 'cake',
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 8.5 * player.areaMultiplier,
          damage: baseDamage,
          pierce: 1 + player.bonusPierce,
          explosionRadius: splashRadius,
          life,
          maxLife: life,
          weaponId: 'derson_combo',
          isEvolved: w.evolved,
          hitEnemyIds: new Set(),
        });
      }
      sound.playKnife();
    }
  }

  private triggerFlyingTray(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    sound: SoundEngine
  ): void {
    const nearby = grid.queryRadius(player.x, player.y, 460);
    let closest: Enemy | undefined;
    let closestDist = Infinity;
    for (let i = 0; i < nearby.length; i++) {
      const d = (nearby[i].x - player.x) ** 2 + (nearby[i].y - player.y) ** 2;
      if (d < closestDist) {
        closestDist = d;
        closest = nearby[i];
      }
    }

    const baseAngle = closest
      ? Math.atan2(closest.y - player.y, closest.x - player.x)
      : Math.atan2(player.facingY, player.facingX);

    const countTable = [0, 1, 2, 2, 2, 3];
    const count = (w.evolved ? 3 : countTable[w.level] || 1) + player.bonusAmount;
    const maxSpeed = (w.evolved ? 600 : 520) * player.projectileSpeedMultiplier;
    const dmgTable = [0, 18, 21, 25, 29, 34];
    const baseDamage = (w.evolved ? 34 : dmgTable[w.level] || 18) * player.might;
    const radius = (w.evolved ? 18 : w.level >= 3 ? 15 : 12) * player.areaMultiplier;
    const hoverDur = (w.evolved ? 0.45 : w.level >= 3 ? 0.4 : 0.26) * player.durationMultiplier;
    const totalLife = 2.6 * player.durationMultiplier;

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i * Math.PI * 2) / count;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);

      this.projectiles.push({
        id: this.nextProjId++,
        type: 'flying_tray',
        x: player.x,
        y: player.y,
        vx: dx * maxSpeed,
        vy: dy * maxSpeed,
        radius,
        damage: baseDamage,
        pierce: 999,
        spinAngle: 0,
        spinSpeed: 15,
        life: totalLife,
        maxLife: totalLife,
        weaponId: 'flying_tray',
        isEvolved: w.evolved,
        hitEnemyIds: new Set(),
        boomerang: {
          phase: 'outbound',
          phaseTimer: 0.46,
          hoverDuration: hoverDur,
          maxSpeed,
          returnDamageMult: w.level >= 4 || w.evolved ? 1.35 : 1.0,
          lockedReturnDir: false,
          dirX: dx,
          dirY: dy,
          triggeredPlayerNova: false,
        },
      });
    }

    sound.playKnife();
  }

  private triggerFireFlask(
    w: WeaponInstance,
    player: Player,
    enemies: Enemy[],
    camera: Camera,
    sound: SoundEngine
  ): void {
    const visible = enemies.filter((e) => e.hp > 0 && camera.isInView(e.x, e.y, -20));
    const count =
      (w.evolved ? 3 : 1 + (w.level >= 3 ? 1 : 0) + (w.level >= 5 ? 1 : 0)) + player.bonusAmount;
    const poolRadius =
      (w.evolved ? 72 : w.level >= 2 ? 58 : 46) * player.areaMultiplier;
    const poolDuration =
      (w.evolved ? 4.4 : w.level >= 4 ? 4.0 : 3.0) * player.durationMultiplier;
    const dmgTable = [0, 9, 11, 13, 16, 19];
    const tickDamage = (w.evolved ? 19 : dmgTable[w.level] || 9) * player.might;

    for (let i = 0; i < count; i++) {
      let targetX: number;
      let targetY: number;

      if (visible.length > 0 && Math.random() < 0.8) {
        const chosen = visible[Math.floor(Math.random() * visible.length)];
        targetX = chosen.x + (Math.random() - 0.5) * 30;
        targetY = chosen.y + (Math.random() - 0.5) * 30;
        const dx = targetX - player.x;
        const dy = targetY - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 280) {
          targetX = player.x + (dx / dist) * 260;
          targetY = player.y + (dy / dist) * 260;
        }
      } else {
        const angle = (i * Math.PI * 2) / count + Math.random() * 0.8;
        const dist = 125 + Math.random() * 115;
        targetX = player.x + Math.cos(angle) * dist;
        targetY = player.y + Math.sin(angle) * dist;
      }

      const lobDuration = 0.42;
      this.projectiles.push({
        id: this.nextProjId++,
        type: 'fire_flask_lob',
        x: player.x,
        y: player.y,
        vx: (targetX - player.x) / lobDuration,
        vy: (targetY - player.y) / lobDuration,
        radius: 8,
        damage: 0,
        pierce: 1,
        spinAngle: 0,
        spinSpeed: 11,
        life: lobDuration + 0.05,
        maxLife: lobDuration + 0.05,
        weaponId: 'fire_flask',
        isEvolved: w.evolved,
        hitEnemyIds: new Set(),
        lob: {
          startX: player.x,
          startY: player.y,
          targetX,
          targetY,
          elapsed: 0,
          duration: lobDuration,
          arcHeight: 75,
          zoneRadius: poolRadius,
          zoneDuration: poolDuration,
          zoneTickDamage: tickDamage,
        },
      });
    }

    sound.playShoot();
  }

  private triggerExecutionerAxe(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    sound: SoundEngine
  ): void {
    if (w.evolved) {
      // Espiral da Morte: 7 radial spectral scythes piercing across the entire screen!
      const count = 7 + player.bonusAmount;
      const speed = 390 * player.projectileSpeedMultiplier;
      const baseDamage = 58 * player.might;
      const life = 2.0 * player.durationMultiplier;

      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count + this.bibleAngle * 0.25;
        this.projectiles.push({
          id: this.nextProjId++,
          type: 'executioner_axe',
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 19 * player.areaMultiplier,
          damage: baseDamage,
          pierce: 99,
          bonusCritChance: 0.3,
          bonusCritMult: 0.35,
          spinAngle: angle,
          spinSpeed: 14,
          life,
          maxLife: life,
          weaponId: 'executioner_axe',
          isEvolved: true,
          hitEnemyIds: new Set(),
        });
      }
      sound.playWhip();
      return;
    }

    // Parabolic high-crit gravity cleavers!
    const countTable = [0, 1, 2, 2, 3, 3];
    const count = (countTable[w.level] || 1) + player.bonusAmount;
    const dmgTable = [0, 32, 36, 42, 50, 60];
    const baseDamage = (dmgTable[w.level] || 32) * player.might;
    const pierce = (w.level >= 5 ? 8 : w.level >= 3 ? 5 : 3) + player.bonusPierce;
    const radius = (w.level >= 3 ? 16 : 13) * player.areaMultiplier;

    const nearby = grid.queryRadius(player.x, player.y, 350);
    const preferRight =
      nearby.length > 0 ? nearby[0].x >= player.x : player.facingX >= 0;
    const baseDir = preferRight ? 1 : -1;
    const speedMult = Math.min(1.45, player.projectileSpeedMultiplier);
    const life = 1.75 * player.durationMultiplier;

    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? baseDir : -baseDir;
      const spreadTier = Math.floor(i / 2);
      const vx = side * (85 + spreadTier * 55 + Math.random() * 25) * speedMult;
      const vy = -(435 + spreadTier * 30) * speedMult;

      this.projectiles.push({
        id: this.nextProjId++,
        type: 'executioner_axe',
        x: player.x,
        y: player.y - 10,
        vx,
        vy,
        gravityY: 820 * speedMult,
        radius,
        damage: baseDamage,
        pierce,
        bonusCritChance: 0.2,
        bonusCritMult: 0.25,
        spinAngle: 0,
        spinSpeed: side * 12,
        life,
        maxLife: life,
        weaponId: 'executioner_axe',
        isEvolved: false,
        hitEnemyIds: new Set(),
      });
    }

    sound.playWhip();
  }

  private triggerPoderDoL(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    const dmgTable = [0, LULA_SKILL.damage, 45, 55, 68, 82];
    const radiusTable = [0, LULA_SKILL.radius, 165, 180, 200, 225];
    const baseDamage =
      (w.evolved ? 110 : dmgTable[w.level] || LULA_SKILL.damage) * player.might;
    const radius =
      (w.evolved ? 280 : radiusTable[w.level] || LULA_SKILL.radius) *
      player.areaMultiplier;

    player.triggerAttackAnimation(LULA_SKILL.animationDuration / 1000);
    this.spawnRingPulse(player.x, player.y, radius, LULA_SKILL.color, 0.42);
    this.spawnRingPulse(player.x, player.y, radius * 0.65, '#ff5252', 0.3);
    vfx.addSparks(player.x, player.y, LULA_SKILL.color, 12);
    sound.playThunder();

    const victims = grid.queryRadius(player.x, player.y, radius);
    for (let i = 0; i < victims.length; i++) {
      const enemy = victims[i];
      if (enemy.hp <= 0) continue;

      const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      this.dealHitToEnemy(
        w,
        enemy,
        baseDamage,
        player,
        Math.cos(angle),
        Math.sin(angle),
        LULA_SKILL.knockback,
        grid,
        vfx,
        onEnemyKilled
      );
    }
  }

  private performLightningBolt(
    w: WeaponInstance,
    strikeX: number,
    strikeY: number,
    baseDamage: number,
    aoeRadius: number,
    chainHops: number,
    spawnStaticZone: boolean,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    sound.playThunder();
    this.lightningStrikes.push({
      x: strikeX,
      y: strikeY,
      radius: aoeRadius,
      life: 0.25,
      maxLife: 0.25,
      isEvolved: w.evolved,
    });

    const hitSet = new Set<number>();
    const victims = grid.queryRadius(strikeX, strikeY, aoeRadius);
    let primaryEnemy: Enemy | undefined;

    for (let v = 0; v < victims.length; v++) {
      const vic = victims[v];
      if (vic.hp <= 0) continue;
      if (!primaryEnemy) primaryEnemy = vic;
      hitSet.add(vic.id);
      this.dealHitToEnemy(
        w,
        vic,
        baseDamage,
        player,
        0,
        0,
        55,
        grid,
        vfx,
        onEnemyKilled,
        w.evolved ? 0.15 : 0.05
      );
      vfx.addSparks(vic.x, vic.y, '#38bdf8', 4);
    }

    // Chain Lightning hops!
    let currX = primaryEnemy ? primaryEnemy.x : strikeX;
    let currY = primaryEnemy ? primaryEnemy.y : strikeY;
    for (let hop = 0; hop < chainHops; hop++) {
      const candidates = grid.queryRadius(currX, currY, 175 * player.areaMultiplier);
      let best: Enemy | undefined;
      let bestDist = Infinity;
      for (let c = 0; c < candidates.length; c++) {
        const cand = candidates[c];
        if (cand.hp <= 0 || hitSet.has(cand.id)) continue;
        const d = (cand.x - currX) ** 2 + (cand.y - currY) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = cand;
        }
      }
      if (!best) break;

      hitSet.add(best.id);
      this.chainArcs.push({
        x1: currX,
        y1: currY,
        x2: best.x,
        y2: best.y,
        color: w.evolved ? '#38bdf8' : '#fde047',
        life: 0.22,
        maxLife: 0.22,
      });

      this.dealHitToEnemy(
        w,
        best,
        baseDamage * 0.58,
        player,
        0,
        0,
        35,
        grid,
        vfx,
        onEnemyKilled
      );
      vfx.addSparks(best.x, best.y, '#7dd3fc', 3);
      currX = best.x;
      currY = best.y;
    }

    if (spawnStaticZone) {
      this.groundZones.push({
        id: this.nextZoneId++,
        type: 'static_field',
        weaponId: 'lightning',
        x: strikeX,
        y: strikeY,
        radius: 40 * player.areaMultiplier,
        tickDamage: 14 * player.might,
        tickInterval: 0.35,
        tickTimer: 0.2,
        life: 1.5 * player.durationMultiplier,
        maxLife: 1.5 * player.durationMultiplier,
        isEvolved: w.evolved,
      });
    }
  }

  private triggerLightning(
    w: WeaponInstance,
    player: Player,
    enemies: Enemy[],
    grid: SpatialGrid<Enemy>,
    camera: Camera,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    const alive = enemies.filter((e) => e.hp > 0);
    if (alive.length === 0) return;

    const inView = alive.filter((e) => camera.isInView(e.x, e.y, -10));
    const pool = inView.length > 0 ? inView : alive;

    const countTable = [0, 1, 2, 2, 3, 3];
    const count = (w.evolved ? 4 : countTable[w.level] || 1) + player.bonusAmount;
    const dmgTable = [0, 38, 44, 52, 60, 70];
    const baseDamage = (w.evolved ? 66 : dmgTable[w.level] || 38) * player.might;
    const aoeRadius =
      (w.evolved ? 64 : w.level >= 3 ? 56 : 44) * player.areaMultiplier;
    const chainHops = w.evolved ? 4 : w.level >= 5 ? 2 : w.level >= 3 ? 1 : 0;
    const spawnStatic = w.level >= 5 || w.evolved;

    for (let i = 0; i < count; i++) {
      const target = pool[Math.floor(Math.random() * pool.length)];
      if (!target) continue;
      const sx = target.x;
      const sy = target.y;

      this.performLightningBolt(
        w,
        sx,
        sy,
        baseDamage,
        aoeRadius,
        chainHops,
        spawnStatic,
        player,
        grid,
        vfx,
        sound,
        onEnemyKilled
      );

      // Thunder Loop Evolved: delayed 2nd aftershock bolt at each target location!
      if (w.evolved) {
        this.pendingStrikes.push({
          timer: 0.3,
          execute: () => {
            this.performLightningBolt(
              w,
              sx,
              sy,
              baseDamage * 0.72,
              aoeRadius * 0.9,
              2,
              false,
              player,
              grid,
              vfx,
              sound,
              onEnemyKilled
            );
          },
        });
      }
    }
  }

  private updateBible(
    dt: number,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    const w = this.weapons.get('bible');
    if (!w) return;

    // Decay per-enemy hit ICDs
    this.bibleHitCooldowns.forEach((remaining, enemyId) => {
      const next = remaining - dt;
      if (next <= 0) {
        this.bibleHitCooldowns.delete(enemyId);
      } else {
        this.bibleHitCooldowns.set(enemyId, next);
      }
    });

    if (w.evolved) {
      this.bibleIsActive = true;
    } else {
      this.bibleCycleTimer -= dt;
      if (this.bibleCycleTimer <= 0) {
        this.bibleIsActive = !this.bibleIsActive;
        if (this.bibleIsActive) {
          const activeDur = (w.level >= 4 ? 4.0 : 3.2) * player.durationMultiplier;
          this.bibleCycleTimer = activeDur;
          this.bibleCycleMax = activeDur;
          this.bibleHitCooldowns.clear();
        } else {
          const cdFactor = Math.max(0.45, 1 - player.cooldownReduction);
          const gap = Math.max(0.35, (w.level >= 5 ? 0.8 : 1.55) * cdFactor);
          this.bibleCycleTimer = gap;
          this.bibleCycleMax = gap;
        }
      }
    }

    if (!this.bibleIsActive) return;

    const rotSpeed = w.evolved ? 5.0 : w.level >= 3 ? 3.8 : 3.0;
    this.bibleAngle += rotSpeed * dt;
    this.bibleRadius =
      (w.evolved ? 92 : w.level >= 3 ? 80 : 68) * player.areaMultiplier;

    const countTable = [0, 1, 2, 2, 3, 4];
    const orbCount = (w.evolved ? 6 : countTable[w.level] || 1) + player.bonusAmount;
    const dmgTable = [0, 18, 23, 28, 34, 40];
    const baseDamage = (w.evolved ? 38 : dmgTable[w.level] || 18) * player.might;
    const hitRadius = (w.evolved ? 26 : 22) * player.areaMultiplier;
    const hitIcd = w.evolved ? 0.2 : 0.3;

    let hitAny = false;
    for (let i = 0; i < orbCount; i++) {
      const angle = this.bibleAngle + (i * Math.PI * 2) / orbCount;
      const orbX = player.x + Math.cos(angle) * this.bibleRadius;
      const orbY = player.y + Math.sin(angle) * this.bibleRadius;

      const hitEnemies = grid.queryRadius(orbX, orbY, hitRadius);
      for (let e = 0; e < hitEnemies.length; e++) {
        const enemy = hitEnemies[e];
        if (enemy.hp <= 0 || this.bibleHitCooldowns.has(enemy.id)) continue;

        this.bibleHitCooldowns.set(enemy.id, hitIcd);
        const pushAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        this.dealHitToEnemy(
          w,
          enemy,
          baseDamage,
          player,
          Math.cos(pushAngle),
          Math.sin(pushAngle),
          92,
          grid,
          vfx,
          onEnemyKilled
        );
        hitAny = true;
      }
    }

    if (hitAny) sound.playHit();
  }

  private updateGarlic(
    dt: number,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    const w = this.weapons.get('garlic');
    if (!w) return;

    this.garlicTimer += dt;
    const radiusTable = [0, 60, 72, 74, 88, 94];
    this.garlicRadius =
      (w.evolved ? 112 : radiusTable[w.level] || 60) * player.areaMultiplier;

    const cdFactor = Math.max(0.6, 1 - player.cooldownReduction * 0.65);
    const tickInterval = (w.evolved ? 0.32 : w.level >= 4 ? 0.38 : 0.45) * cdFactor;

    if (this.garlicTimer >= tickInterval) {
      this.garlicTimer = 0;
      sound.playGarlicPulse();

      const dmgTable = [0, 11, 14, 18, 22, 26];
      const baseDamage = (w.evolved ? 32 : dmgTable[w.level] || 11) * player.might;
      const knockForce = w.evolved ? 105 : w.level >= 3 ? 150 : 125;
      const enemies = grid.queryRadius(player.x, player.y, this.garlicRadius);
      let healedCount = 0;

      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.hp <= 0) continue;

        if (w.level >= 5 || w.evolved) {
          e.applyVulnerability(0.2, 2.5 * player.durationMultiplier);
        }
        if (w.evolved) {
          e.applySlow(0.25, 1.2);
          e.soulEaterMarkTimer = 1.2;
        }

        const angle = Math.atan2(e.y - player.y, e.x - player.x);
        this.dealHitToEnemy(
          w,
          e,
          baseDamage,
          player,
          Math.cos(angle),
          Math.sin(angle),
          knockForce,
          grid,
          vfx,
          onEnemyKilled
        );

        if (w.evolved && healedCount < 3 && Math.random() < 0.2) {
          player.heal(1);
          healedCount += 1;
        }
      }
    }
  }

  private updateGroundZones(
    dt: number,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    for (let i = this.groundZones.length - 1; i >= 0; i--) {
      const z = this.groundZones[i];
      z.life -= dt;
      if (z.life <= 0) {
        this.groundZones.splice(i, 1);
        continue;
      }

      // Purifying Blaze creeps toward player!
      if (z.followPlayerSpeed && z.followPlayerSpeed > 0) {
        const dx = player.x - z.x;
        const dy = player.y - z.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 18) {
          z.x += (dx / dist) * z.followPlayerSpeed * dt;
          z.y += (dy / dist) * z.followPlayerSpeed * dt;
        }
      }

      z.tickTimer -= dt;
      if (z.tickTimer <= 0) {
        z.tickTimer = z.tickInterval;
        const w = this.weapons.get(z.weaponId);
        const victims = grid.queryRadius(z.x, z.y, z.radius);

        for (let v = 0; v < victims.length; v++) {
          const vic = victims[v];
          if (vic.hp <= 0) continue;
          if (z.type === 'bio_cloud') {
            vic.applySlow(0.4, 1.0);
          }
          this.dealHitToEnemy(
            w,
            vic,
            z.tickDamage,
            player,
            0,
            0,
            18,
            grid,
            vfx,
            onEnemyKilled,
            0,
            0,
            Math.random() < 0.5
          );
        }
      }
    }
  }

  private triggerSplashExplosion(
    w: WeaponInstance | undefined,
    x: number,
    y: number,
    radius: number,
    damage: number,
    color: string,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    this.spawnRingPulse(x, y, radius, color, 0.24);
    vfx.addSparks(x, y, color, 5);
    const victims = grid.queryRadius(x, y, radius);
    for (let i = 0; i < victims.length; i++) {
      const vic = victims[i];
      if (vic.hp <= 0) continue;
      const ang = Math.atan2(vic.y - y, vic.x - x);
      this.dealHitToEnemy(
        w,
        vic,
        damage,
        player,
        Math.cos(ang),
        Math.sin(ang),
        70,
        grid,
        vfx,
        onEnemyKilled
      );
    }
  }

  private updateProjectiles(
    dt: number,
    player: Player,
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      if (p.spinSpeed) {
        p.spinAngle = (p.spinAngle || 0) + p.spinSpeed * dt;
      }

      // 1. Lobbed Flask Movement (immune mid-air, spawns ground fire zone on landing!)
      if (p.lob) {
        p.lob.elapsed += dt;
        const t = Math.min(1, p.lob.elapsed / p.lob.duration);
        p.x = p.lob.startX + (p.lob.targetX - p.lob.startX) * t;
        const groundY = p.lob.startY + (p.lob.targetY - p.lob.startY) * t;
        p.y = groundY - Math.sin(t * Math.PI) * p.lob.arcHeight;

        if (t >= 1) {
          this.groundZones.push({
            id: this.nextZoneId++,
            type: 'fire',
            weaponId: p.weaponId,
            x: p.lob.targetX,
            y: p.lob.targetY,
            radius: p.lob.zoneRadius,
            tickDamage: p.lob.zoneTickDamage,
            tickInterval: 0.3,
            tickTimer: 0.04,
            life: p.lob.zoneDuration,
            maxLife: p.lob.zoneDuration,
            isEvolved: p.isEvolved,
            followPlayerSpeed: p.isEvolved ? 42 : 0,
          });
          vfx.addSparks(
            p.lob.targetX,
            p.lob.targetY,
            p.isEvolved ? '#38bdf8' : '#f97316',
            8
          );
          sound.playHit();
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      // 2. Spiral Movement (Derson's Coffee — anchored to player!)
      if (p.spiral) {
        const s = p.spiral;
        if (s.followPlayer) {
          s.originX = player.x;
          s.originY = player.y;
        }
        s.angle += s.angularSpeed * dt;
        s.radius += s.radialSpeed * dt;
        p.x = s.originX + Math.cos(s.angle) * s.radius;
        p.y = s.originY + Math.sin(s.angle) * s.radius;
        p.vx = -Math.sin(s.angle) * s.radius * s.angularSpeed;
        p.vy = Math.cos(s.angle) * s.radius * s.angularSpeed;
      } else if (p.boomerang) {
        // 3. Boomerang Movement (Dukarai's Flying Tray!)
        const bm = p.boomerang;
        bm.phaseTimer -= dt;

        if (bm.phase === 'outbound') {
          const decel = Math.max(0.08, bm.phaseTimer / 0.46);
          p.vx = bm.dirX * bm.maxSpeed * decel;
          p.vy = bm.dirY * bm.maxSpeed * decel;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          if (bm.phaseTimer <= 0) {
            bm.phase = 'hover';
            bm.phaseTimer = bm.hoverDuration;
            p.hitEnemyIds.clear();
          }
        } else if (bm.phase === 'hover') {
          p.vx = 0;
          p.vy = 0;
          if (bm.phaseTimer <= 0) {
            bm.phase = 'return';
            p.damage *= bm.returnDamageMult;
            p.hitEnemyIds.clear();
          }
        } else {
          // Accelerate back toward player, then shoot through across the screen!
          if (!bm.lockedReturnDir) {
            const dx = player.x - p.x;
            const dy = player.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= 30) {
              bm.lockedReturnDir = true;
              if (dist > 0.01) {
                bm.dirX = dx / dist;
                bm.dirY = dy / dist;
              }
              if (p.isEvolved && !bm.triggeredPlayerNova) {
                bm.triggeredPlayerNova = true;
                const w = this.weapons.get('flying_tray');
                this.triggerSplashExplosion(
                  w,
                  player.x,
                  player.y,
                  86 * player.areaMultiplier,
                  p.damage * 0.8,
                  '#fbbf24',
                  player,
                  grid,
                  vfx,
                  onEnemyKilled
                );
              }
            } else {
              bm.dirX = dx / dist;
              bm.dirY = dy / dist;
            }
          }
          const retSpeed = bm.maxSpeed * 1.25;
          p.vx = bm.dirX * retSpeed;
          p.vy = bm.dirY * retSpeed;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      } else {
        // 4. Homing steering (Wand) + Gravity (Axe) + Linear velocity
        if (p.homingTurnRate && p.homingTurnRate > 0) {
          const candidates = grid.queryRadius(p.x, p.y, 340);
          let best: Enemy | undefined;
          let bestDist = Infinity;
          for (let c = 0; c < candidates.length; c++) {
            const cand = candidates[c];
            if (cand.hp <= 0 || p.hitEnemyIds.has(cand.id)) continue;
            const d = (cand.x - p.x) ** 2 + (cand.y - p.y) ** 2;
            if (d < bestDist) {
              bestDist = d;
              best = cand;
            }
          }
          if (best) {
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            const curAngle = Math.atan2(p.vy, p.vx);
            const targetAngle = Math.atan2(best.y - p.y, best.x - p.x);
            let diff = targetAngle - curAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const maxStep = p.homingTurnRate * dt;
            const nextAngle = curAngle + Math.max(-maxStep, Math.min(maxStep, diff));
            p.vx = Math.cos(nextAngle) * speed;
            p.vy = Math.sin(nextAngle) * speed;
          }
        }

        if (p.gravityY) {
          p.vy += p.gravityY * dt;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check collision with enemies
      const hits = grid.queryRadius(p.x, p.y, p.radius + 14);
      let hitSomeone = false;

      for (let h = 0; h < hits.length; h++) {
        const enemy = hits[h];
        if (enemy.hp <= 0 || p.hitEnemyIds.has(enemy.id)) continue;
        const dx = enemy.x - p.x;
        const dy = enemy.y - p.y;
        const hitDistSq = (p.radius + enemy.radius) ** 2;
        if (dx * dx + dy * dy > hitDistSq) continue;

        p.hitEnemyIds.add(enemy.id);
        const w = this.weapons.get(p.weaponId);

        const speedLen = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const knockX = speedLen > 1 ? p.vx / speedLen : dx >= 0 ? 1 : -1;
        const knockY = speedLen > 1 ? p.vy / speedLen : dy >= 0 ? 1 : -1;

        this.dealHitToEnemy(
          w,
          enemy,
          p.damage,
          player,
          knockX,
          knockY,
          p.knockForce ?? 135,
          grid,
          vfx,
          onEnemyKilled,
          p.bonusCritChance ?? 0,
          p.bonusCritMult ?? 0
        );

        // Apply projectile status payloads
        if (p.slowFactor && p.slowDuration) {
          enemy.applySlow(p.slowFactor, p.slowDuration);
        }
        if (p.poisonDps && p.poisonDuration) {
          enemy.applyPoison(
            p.poisonDps,
            p.poisonDuration,
            p.weaponId,
            Boolean(p.poisonContagious)
          );
        }
        if (p.bleedDps && p.bleedDuration) {
          enemy.applyBleed(
            p.bleedDps,
            p.bleedMaxDps ?? p.bleedDps * 4,
            p.bleedDuration,
            p.weaponId
          );
        }

        // Supreme Serum bio-cloud on first hit
        if (p.spawnBioCloudOnHit) {
          p.spawnBioCloudOnHit = false;
          this.groundZones.push({
            id: this.nextZoneId++,
            type: 'bio_cloud',
            weaponId: 'syringe',
            x: enemy.x,
            y: enemy.y,
            radius: 50 * player.areaMultiplier,
            tickDamage: 12 * player.might,
            tickInterval: 0.35,
            tickTimer: 0.15,
            life: 2.2 * player.durationMultiplier,
            maxLife: 2.2 * player.durationMultiplier,
            isEvolved: true,
          });
        }

        // Splash / Shockwave triggers
        p.pierceCountSoFar = (p.pierceCountSoFar || 0) + 1;
        if (p.explosionRadius && p.explosionRadius > 0) {
          if (p.type === 'bow') {
            if (enemy.isElite || enemy.isBoss || p.pierceCountSoFar % 3 === 1) {
              this.triggerSplashExplosion(
                w,
                enemy.x,
                enemy.y,
                p.explosionRadius,
                p.damage * 0.55,
                '#84cc16',
                player,
                grid,
                vfx,
                onEnemyKilled
              );
            }
          } else if (p.type === 'cake') {
            this.triggerSplashExplosion(
              w,
              enemy.x,
              enemy.y,
              p.explosionRadius,
              p.damage * 0.55,
              '#f9a8d4',
              player,
              grid,
              vfx,
              onEnemyKilled
            );
          }
        }

        // Ricochet bounce retargeting (Wand & Cheese Bread)
        if (p.bouncesLeft && p.bouncesLeft > 0) {
          p.bouncesLeft -= 1;
          const neighbors = grid.queryRadius(enemy.x, enemy.y, 240);
          let nextTarget: Enemy | undefined;
          let nextDist = Infinity;
          for (let n = 0; n < neighbors.length; n++) {
            const cand = neighbors[n];
            if (cand.hp <= 0 || p.hitEnemyIds.has(cand.id)) continue;
            const d = (cand.x - enemy.x) ** 2 + (cand.y - enemy.y) ** 2;
            if (d < nextDist) {
              nextDist = d;
              nextTarget = cand;
            }
          }
          if (nextTarget) {
            const curSpd = Math.max(260, Math.sqrt(p.vx * p.vx + p.vy * p.vy));
            const bounceAngle = Math.atan2(nextTarget.y - p.y, nextTarget.x - p.x);
            p.vx = Math.cos(bounceAngle) * curSpd;
            p.vy = Math.sin(bounceAngle) * curSpd;
            p.life = Math.max(p.life, 0.55);
          }
        }

        const sparkColor =
          p.type === 'wand'
            ? '#38bdf8'
            : p.type === 'bow'
              ? '#a3e635'
              : p.type === 'cheese_bread'
                ? '#facc15'
                : p.type === 'coffee'
                  ? '#b45309'
                  : p.type === 'cake'
                    ? '#f9a8d4'
                    : p.type === 'syringe'
                      ? '#22d3ee'
                      : p.type === 'flying_tray'
                        ? '#fbbf24'
                        : p.type === 'executioner_axe'
                          ? '#f43f5e'
                          : '#e2e8f0';
        vfx.addSparks(p.x, p.y, sparkColor, 3);
        hitSomeone = true;

        p.pierce -= 1;
        if (p.pierce <= 0) {
          if (p.type === 'wand' && p.explosionRadius && p.explosionRadius > 0) {
            this.triggerSplashExplosion(
              w,
              enemy.x,
              enemy.y,
              p.explosionRadius,
              p.damage * 0.5,
              '#c084fc',
              player,
              grid,
              vfx,
              onEnemyKilled
            );
          }
          this.projectiles.splice(i, 1);
          break;
        }
      }

      if (hitSomeone) sound.playHit();
    }
  }

  renderGround(ctx: CanvasRenderingContext2D, camera: Camera, player: Player): void {
    // 1. Render Persistent Ground Zones (Fire Pools, Bio Clouds, Static Fields)
    for (let i = 0; i < this.groundZones.length; i++) {
      const z = this.groundZones[i];
      if (!camera.isInView(z.x, z.y, z.radius + 20)) continue;
      const screen = camera.worldToScreen(z.x, z.y);
      const fade = Math.min(1, z.life / 0.4);

      ctx.save();
      ctx.globalAlpha = fade;

      if (z.type === 'fire') {
        const grad = ctx.createRadialGradient(
          screen.x,
          screen.y,
          z.radius * 0.15,
          screen.x,
          screen.y,
          z.radius
        );
        if (z.isEvolved) {
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
          grad.addColorStop(0.55, 'rgba(56, 189, 248, 0.38)');
          grad.addColorStop(1, 'rgba(30, 64, 175, 0)');
        } else {
          grad.addColorStop(0, 'rgba(253, 224, 71, 0.5)');
          grad.addColorStop(0.6, 'rgba(249, 115, 22, 0.35)');
          grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = z.isEvolved ? 'rgba(125, 211, 252, 0.7)' : 'rgba(251, 146, 60, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, z.radius * 0.88, 0, Math.PI * 2);
        ctx.stroke();
      } else if (z.type === 'bio_cloud') {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.24)';
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    // 2. Render Garlic Aura
    const garlic = this.weapons.get('garlic');
    if (garlic) {
      const screen = camera.worldToScreen(player.x, player.y);
      ctx.save();
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, this.garlicRadius, 0, Math.PI * 2);
      ctx.fillStyle = garlic.evolved
        ? 'rgba(127, 29, 29, 0.26)'
        : garlic.level >= 5
          ? 'rgba(250, 204, 21, 0.2)'
          : 'rgba(253, 224, 71, 0.14)';
      ctx.fill();
      ctx.strokeStyle = garlic.evolved ? '#ef4444' : '#facc15';
      ctx.lineWidth = garlic.evolved ? 2.5 : 1.8;
      ctx.stroke();
      ctx.restore();
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, player: Player): void {
    // 3. Render Whip Slashes
    for (let i = 0; i < this.whipSlashes.length; i++) {
      const s = this.whipSlashes[i];
      const screen = camera.worldToScreen(s.x, s.y);
      const alpha = s.life / s.maxLife;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.isEvolved ? 'rgba(220, 38, 38, 0.72)' : 'rgba(245, 158, 11, 0.65)';
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, s.width / 2, s.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = s.isEvolved ? '#fecaca' : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render Orbiting Bibles (respecting active cycle!)
    const bible = this.weapons.get('bible');
    if (bible && (this.bibleIsActive || bible.evolved)) {
      const countTable = [0, 1, 2, 2, 3, 4];
      const orbCount = (bible.evolved ? 6 : countTable[bible.level] || 1) + player.bonusAmount;
      const cycleAlpha = bible.evolved
        ? 1
        : Math.min(1, this.bibleCycleTimer / 0.25, (this.bibleCycleMax - this.bibleCycleTimer + 0.05) / 0.25);

      for (let i = 0; i < orbCount; i++) {
        const angle = this.bibleAngle + (i * Math.PI * 2) / orbCount;
        const orbX = player.x + Math.cos(angle) * this.bibleRadius;
        const orbY = player.y + Math.sin(angle) * this.bibleRadius;
        const screen = camera.worldToScreen(orbX, orbY);

        ctx.save();
        ctx.globalAlpha = Math.max(0.15, cycleAlpha);
        ctx.translate(screen.x, screen.y);
        ctx.rotate(angle + Math.PI / 2);

        ctx.fillStyle = bible.evolved ? '#312e81' : '#1d4ed8';
        ctx.fillRect(-8, -11, 16, 22);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-6, -9, 12, 18);
        ctx.fillStyle = bible.evolved ? '#ef4444' : '#fbbf24';
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-5, -3, 10, 4);

        ctx.restore();
      }
    }

    // 5. Render Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!camera.isInView(p.x, p.y, 40)) continue;
      const screen = camera.worldToScreen(p.x, p.y);

      ctx.save();
      ctx.translate(screen.x, screen.y);
      const rot =
        p.spinAngle !== undefined ? p.spinAngle : Math.atan2(p.vy, p.vx);
      ctx.rotate(rot);

      if (p.type === 'wand') {
        ctx.fillStyle = p.isEvolved ? '#c084fc' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'knife') {
        ctx.fillStyle = p.isEvolved ? '#ef4444' : '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(13, 0);
        ctx.lineTo(-6, -4.5);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-6, 4.5);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'bow') {
        ctx.strokeStyle = p.isEvolved ? '#fbbf24' : '#bef264';
        ctx.lineWidth = p.isEvolved ? 4 : 3.2;
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(12, 0);
        ctx.stroke();
        ctx.fillStyle = p.isEvolved ? '#f59e0b' : '#84cc16';
        ctx.beginPath();
        ctx.moveTo(19, 0);
        ctx.lineTo(8, -5.5);
        ctx.lineTo(8, 5.5);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'syringe') {
        ctx.fillStyle = p.isEvolved ? '#a5f3fc' : '#e0f2fe';
        ctx.fillRect(-10, -4, 16, 8);
        ctx.fillStyle = p.isEvolved ? '#10b981' : '#06b6d4';
        ctx.fillRect(-8, -3, 10, 6);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-14, -5, 4, 10);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(16, 0);
        ctx.stroke();
      } else if (p.type === 'cheese_bread') {
        ctx.fillStyle = p.isEvolved ? '#fde68a' : '#f6c453';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c98a2b';
        ctx.beginPath();
        ctx.arc(-2, -1, 1.5, 0, Math.PI * 2);
        ctx.arc(2, 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'coffee') {
        ctx.fillStyle = p.isEvolved ? '#7c2d12' : '#5b3a29';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f5e6d3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.62, 0.2, Math.PI * 1.4);
        ctx.stroke();
      } else if (p.type === 'cake') {
        ctx.fillStyle = p.isEvolved ? '#fbcfe8' : '#f9a8d4';
        ctx.beginPath();
        ctx.moveTo(0, -p.radius);
        ctx.lineTo(p.radius, p.radius * 0.7);
        ctx.lineTo(-p.radius, p.radius * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -p.radius * 0.65, 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'flying_tray') {
        // Spinning Diner Tray
        ctx.fillStyle = p.isEvolved ? '#f59e0b' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.isEvolved ? '#fef08a' : '#f8fafc';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.fillStyle = p.isEvolved ? '#fef3c7' : '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.58, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.isEvolved ? '#b45309' : '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-p.radius * 0.4, 0);
        ctx.lineTo(p.radius * 0.4, 0);
        ctx.stroke();
      } else if (p.type === 'fire_flask_lob') {
        ctx.fillStyle = p.isEvolved ? '#38bdf8' : '#f97316';
        ctx.beginPath();
        ctx.arc(0, 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-2.5, -7, 5, 5);
      } else if (p.type === 'executioner_axe') {
        if (p.isEvolved) {
          // Giant Spectral Crimson Scythe
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, -0.3, Math.PI * 0.85);
          ctx.quadraticCurveTo(0, 4, 0, -p.radius);
          ctx.fill();
          ctx.strokeStyle = '#fda4af';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Heavy Twin-Bladed Battle Axe
          ctx.fillStyle = '#78350f';
          ctx.fillRect(-2.5, -p.radius, 5, p.radius * 2);
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.moveTo(0, -p.radius * 0.5);
          ctx.quadraticCurveTo(p.radius * 1.1, -p.radius * 0.9, p.radius * 0.95, 0);
          ctx.quadraticCurveTo(p.radius * 1.1, p.radius * 0.9, 0, p.radius * 0.4);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, -p.radius * 0.5);
          ctx.quadraticCurveTo(-p.radius * 1.1, -p.radius * 0.9, -p.radius * 0.95, 0);
          ctx.quadraticCurveTo(-p.radius * 1.1, p.radius * 0.9, 0, p.radius * 0.4);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // 6. Render Chain Lightning Arcs
    for (let i = 0; i < this.chainArcs.length; i++) {
      const arc = this.chainArcs[i];
      const s1 = camera.worldToScreen(arc.x1, arc.y1);
      const s2 = camera.worldToScreen(arc.x2, arc.y2);
      const midX = (s1.x + s2.x) / 2 + (Math.random() - 0.5) * 14;
      const midY = (s1.y + s2.y) / 2 + (Math.random() - 0.5) * 14;

      ctx.save();
      ctx.globalAlpha = arc.life / arc.maxLife;
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(midX, midY);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Render Ring Pulses (Explosions, Boss Nova, Contagion, Sonic Tray)
    for (let i = 0; i < this.ringPulses.length; i++) {
      const rp = this.ringPulses[i];
      const screen = camera.worldToScreen(rp.x, rp.y);
      const progress = 1 - rp.life / rp.maxLife;

      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = rp.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, rp.radius * (0.35 + progress * 0.65), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 8. Render Sky Lightning Strikes
    for (let i = 0; i < this.lightningStrikes.length; i++) {
      const ls = this.lightningStrikes[i];
      const screen = camera.worldToScreen(ls.x, ls.y);
      const alpha = ls.life / ls.maxLife;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ls.isEvolved ? '#38bdf8' : '#fde047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x - 15, screen.y * 0.4);
      ctx.lineTo(screen.x + 10, screen.y * 0.7);
      ctx.lineTo(screen.x, screen.y);
      ctx.stroke();

      ctx.fillStyle = ls.isEvolved ? 'rgba(56, 189, 248, 0.4)' : 'rgba(253, 224, 71, 0.35)';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, ls.radius * (1 - alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  public resolveChestUpgrade(): UpgradeOption | undefined {
    // 1. Priority 1: Guaranteed Evolution if any owned weapon is Lv5+ with its Synergy Passive!
    const readyEvolutions: UpgradeOption[] = [];
    for (const [wId, w] of this.weapons.entries()) {
      if (w.level >= w.maxLevel && !w.evolved) {
        const meta = WEAPON_REGISTRY[wId];
        if (this.passives.has(meta.synergyPassive)) {
          readyEvolutions.push({
            type: 'evolution',
            id: meta.evolvedId,
            baseId: wId,
            name: meta.evolvedName,
            description: meta.evolvedDescription,
            level: w.maxLevel + 1,
            isNew: false,
            isEvolution: true,
            iconName: meta.iconName,
          });
        }
      }
    }

    if (readyEvolutions.length > 0) {
      return readyEvolutions[Math.floor(Math.random() * readyEvolutions.length)];
    }

    // 2. Priority 2: Upgrade an ALREADY-OWNED weapon or passive (never forces unwanted Lv1 items!)
    const ownedWeaponUpgrades: UpgradeOption[] = [];
    for (const [wId, w] of this.weapons.entries()) {
      if (w.level < w.maxLevel) {
        const meta = WEAPON_REGISTRY[wId];
        const nextLv = w.level + 1;
        ownedWeaponUpgrades.push({
          type: 'weapon',
          id: wId,
          name: meta.name,
          description: meta.levelDescriptions[nextLv - 1] || 'Aprimora atributos da arma.',
          level: nextLv,
          isNew: false,
          iconName: meta.iconName,
        });
      }
    }

    const ownedPassiveUpgrades: UpgradeOption[] = [];
    for (const [pId, p] of this.passives.entries()) {
      if (p.level < p.maxLevel) {
        const meta = PASSIVE_REGISTRY[pId];
        const nextLv = p.level + 1;
        ownedPassiveUpgrades.push({
          type: 'passive',
          id: pId,
          name: meta.name,
          description: meta.levelDescriptions[nextLv - 1] || 'Aprimora bônus passivo.',
          level: nextLv,
          isNew: false,
          iconName: meta.iconName,
        });
      }
    }

    if (ownedWeaponUpgrades.length > 0 && (ownedPassiveUpgrades.length === 0 || Math.random() < 0.65)) {
      return ownedWeaponUpgrades[Math.floor(Math.random() * ownedWeaponUpgrades.length)];
    }
    if (ownedPassiveUpgrades.length > 0) {
      return ownedPassiveUpgrades[Math.floor(Math.random() * ownedPassiveUpgrades.length)];
    }

    return undefined;
  }

  generateUpgradeOptions(): UpgradeOption[] {
    interface WeightedCandidate {
      option: UpgradeOption;
      weight: number;
      isOwned: boolean;
    }

    const candidates: WeightedCandidate[] = [];

    // 1. Owned weapon upgrades
    for (const [wId, w] of this.weapons.entries()) {
      if (w.level < w.maxLevel) {
        const meta = WEAPON_REGISTRY[wId];
        const passiveMeta = PASSIVE_REGISTRY[meta.synergyPassive];
        const hasPartner = this.passives.has(meta.synergyPassive);
        const nextLv = w.level + 1;
        candidates.push({
          weight: 2.4,
          isOwned: true,
          option: {
            type: 'weapon',
            id: wId,
            name: meta.name,
            description: meta.levelDescriptions[nextLv - 1] || 'Aumenta atributos de ataque.',
            level: nextLv,
            isNew: false,
            synergyWith: passiveMeta.name,
            hasSynergyOwned: hasPartner,
            iconName: meta.iconName,
          },
        });
      }
    }

    // 2. New weapons (if under limit of 6)
    if (this.weapons.size < 6) {
      for (const wId of ALL_WEAPON_IDS) {
        if (!this.weapons.has(wId)) {
          const meta = WEAPON_REGISTRY[wId];
          const passiveMeta = PASSIVE_REGISTRY[meta.synergyPassive];
          const hasPartner = this.passives.has(meta.synergyPassive);
          candidates.push({
            weight: hasPartner ? 1.85 : 1.0,
            isOwned: false,
            option: {
              type: 'weapon',
              id: wId,
              name: meta.name,
              description: meta.levelDescriptions[0],
              level: 1,
              isNew: true,
              synergyWith: passiveMeta.name,
              hasSynergyOwned: hasPartner,
              iconName: meta.iconName,
            },
          });
        }
      }
    }

    // 3. Owned passive upgrades
    for (const [pId, p] of this.passives.entries()) {
      if (p.level < p.maxLevel) {
        const meta = PASSIVE_REGISTRY[pId];
        const weaponMeta = WEAPON_REGISTRY[meta.synergyWeapon];
        const hasPartner = this.weapons.has(meta.synergyWeapon);
        const nextLv = p.level + 1;
        candidates.push({
          weight: 2.0,
          isOwned: true,
          option: {
            type: 'passive',
            id: pId,
            name: meta.name,
            description: meta.levelDescriptions[nextLv - 1] || 'Aprimora atributos passivos.',
            level: nextLv,
            isNew: false,
            synergyWith: weaponMeta.name,
            hasSynergyOwned: hasPartner,
            iconName: meta.iconName,
          },
        });
      }
    }

    // 4. New passives (if under limit of 6)
    if (this.passives.size < 6) {
      for (const pId of ALL_PASSIVE_IDS) {
        if (!this.passives.has(pId)) {
          const meta = PASSIVE_REGISTRY[pId];
          const weaponMeta = WEAPON_REGISTRY[meta.synergyWeapon];
          const hasPartner = this.weapons.has(meta.synergyWeapon);
          candidates.push({
            weight: hasPartner ? 1.85 : 1.0,
            isOwned: false,
            option: {
              type: 'passive',
              id: pId,
              name: meta.name,
              description: meta.levelDescriptions[0],
              level: 1,
              isNew: true,
              synergyWith: weaponMeta.name,
              hasSynergyOwned: hasPartner,
              iconName: meta.iconName,
            },
          });
        }
      }
    }

    if (candidates.length === 0) return [];

    const pickWeighted = (pool: WeightedCandidate[]): WeightedCandidate => {
      const total = pool.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * total;
      for (let i = 0; i < pool.length; i++) {
        roll -= pool[i].weight;
        if (roll <= 0) return pool[i];
      }
      return pool[pool.length - 1];
    };

    const chosen: UpgradeOption[] = [];
    const remaining = [...candidates];

    // Guarantee at least 1 owned upgrade if any owned item is below max level
    const ownedPool = remaining.filter((c) => c.isOwned);
    if (ownedPool.length > 0) {
      const first = pickWeighted(ownedPool);
      chosen.push(first.option);
      const idx = remaining.indexOf(first);
      if (idx >= 0) remaining.splice(idx, 1);
    }

    while (chosen.length < 3 && remaining.length > 0) {
      const next = pickWeighted(remaining);
      chosen.push(next.option);
      const idx = remaining.indexOf(next);
      if (idx >= 0) remaining.splice(idx, 1);
    }

    // Light shuffle of the 3 chosen cards
    for (let i = chosen.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
    }

    return chosen;
  }
}
