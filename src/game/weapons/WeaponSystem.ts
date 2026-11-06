import { WeaponId, PassiveId, UpgradeOption, WeaponInstance, PassiveInstance } from '../types';
import { WEAPON_REGISTRY, PASSIVE_REGISTRY } from '../data/upgrades';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Drop } from '../entities/Drops';
import { SpatialGrid } from '../engine/SpatialGrid';
import { Camera } from '../engine/Camera';
import { SoundEngine } from '../engine/SoundEngine';
import { VFXManager } from '../entities/VFX';
import { WorldSystem } from '../systems/WorldProps';

export interface Projectile {
  id: number;
  type: 'wand' | 'knife';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierce: number;
  life: number;
  weaponId: WeaponId;
  isEvolved: boolean;
  hitEnemyIds: Set<number>;
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

export class WeaponSystem {
  public weapons: Map<WeaponId, WeaponInstance> = new Map();
  public passives: Map<PassiveId, PassiveInstance> = new Map();

  public projectiles: Projectile[] = [];
  public whipSlashes: WhipSlashEffect[] = [];
  public lightningStrikes: LightningStrikeEffect[] = [];

  // Orbiting Bible state
  public bibleAngle: number = 0;
  public bibleRadius: number = 70;

  // Garlic pulse state
  public garlicTimer: number = 0;
  public garlicRadius: number = 55;

  private nextProjId: number = 1;

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
      });
    }
  }

  addPassive(id: PassiveId, player: Player): void {
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
    }
  }

  recalculatePlayerStats(player: Player): void {
    // Reset player modifiers to character base
    player.might = 1.0 + (player.character.statBonuses.might || 0);
    player.armor = player.character.statBonuses.armor || 0;
    player.cooldownReduction = player.character.statBonuses.cooldownReduction || 0;
    player.pickupRadius = 65 + (player.character.statBonuses.pickupRadius || 0);
    player.speed = player.baseSpeed;

    // Apply passives
    const spinach = this.passives.get('spinach');
    if (spinach) player.might += spinach.level * 0.1;

    const wings = this.passives.get('wings');
    if (wings) player.speed *= (1 + wings.level * 0.1);

    const heart = this.passives.get('heart');
    if (heart) {
      const bonusHp = heart.level * 20;
      player.maxHp = 100 + (player.character.statBonuses.maxHp || 0) + bonusHp;
      player.recoveryPerSec = heart.level * 0.5;
    }

    const tome = this.passives.get('tome');
    if (tome) player.cooldownReduction += tome.level * 0.08;

    const magnet = this.passives.get('magnet');
    if (magnet) player.pickupRadius += magnet.level * 25;
  }

  update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    spatialGrid: SpatialGrid<Enemy>,
    worldProps: WorldSystem,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void,
    onDropSpawn: (drop: Drop) => void
  ): void {
    // Update whip slash effects
    for (let i = this.whipSlashes.length - 1; i >= 0; i--) {
      const slash = this.whipSlashes[i];
      slash.life -= dt;
      if (slash.life <= 0) {
        this.whipSlashes.splice(i, 1);
      }
    }

    // Update lightning strike effects
    for (let i = this.lightningStrikes.length - 1; i >= 0; i--) {
      const ls = this.lightningStrikes[i];
      ls.life -= dt;
      if (ls.life <= 0) {
        this.lightningStrikes.splice(i, 1);
      }
    }

    // Update weapons cooldowns & trigger firing
    this.weapons.forEach((weapon) => {
      weapon.cooldownTimer -= dt;
      if (weapon.cooldownTimer <= 0) {
        this.fireWeapon(weapon, player, enemies, spatialGrid, worldProps, vfx, sound, onEnemyKilled, onDropSpawn);
      }
    });

    // Update active continuous weapons (Bible & Garlic)
    this.updateBible(dt, player, spatialGrid, vfx, sound, onEnemyKilled);
    this.updateGarlic(dt, player, spatialGrid, vfx, sound, onEnemyKilled);

    // Update flying projectiles (Wand bolts & Knives)
    this.updateProjectiles(dt, spatialGrid, worldProps, vfx, sound, onEnemyKilled, onDropSpawn);
  }

  private fireWeapon(
    w: WeaponInstance,
    player: Player,
    enemies: Enemy[],
    grid: SpatialGrid<Enemy>,
    worldProps: WorldSystem,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void,
    onDropSpawn: (drop: Drop) => void
  ): void {
    const cdFactor = Math.max(0.3, 1 - player.cooldownReduction);

    if (w.id === 'whip') {
      const baseCd = w.evolved ? 1.0 : 1.35;
      w.cooldownTimer = baseCd * cdFactor;
      this.triggerWhip(w, player, grid, worldProps, vfx, sound, onEnemyKilled, onDropSpawn);
    } else if (w.id === 'wand') {
      const baseCd = w.evolved ? 0.35 : 1.1;
      w.cooldownTimer = baseCd * cdFactor;
      this.triggerWand(w, player, grid, sound);
    } else if (w.id === 'knife') {
      const baseCd = w.evolved ? 0.3 : 0.95;
      w.cooldownTimer = baseCd * cdFactor;
      this.triggerKnife(w, player, sound);
    } else if (w.id === 'lightning') {
      const baseCd = w.evolved ? 1.8 : 2.8;
      w.cooldownTimer = baseCd * cdFactor;
      this.triggerLightning(w, player, enemies, grid, vfx, sound, onEnemyKilled);
    }
  }

  private triggerWhip(
    w: WeaponInstance,
    player: Player,
    grid: SpatialGrid<Enemy>,
    worldProps: WorldSystem,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void,
    onDropSpawn: (drop: Drop) => void
  ): void {
    sound.playWhip();
    const facing = player.facingX < 0 ? -1 : 1;
    const baseDamage = (w.evolved ? 48 : 22 + w.level * 6) * player.might;
    const slashWidth = w.evolved ? 160 : 110 + w.level * 10;
    const slashHeight = w.evolved ? 70 : 50;

    // Front slash
    this.whipSlashes.push({
      x: player.x + (slashWidth / 2) * facing,
      y: player.y,
      width: slashWidth,
      height: slashHeight,
      life: 0.16,
      maxLife: 0.16,
      isEvolved: w.evolved,
      direction: facing,
    });

    // Back slash if level >= 3 or evolved
    if (w.level >= 3 || w.evolved) {
      this.whipSlashes.push({
        x: player.x - (slashWidth / 2) * facing,
        y: player.y,
        width: slashWidth,
        height: slashHeight,
        life: 0.16,
        maxLife: 0.16,
        isEvolved: w.evolved,
        direction: -facing,
      });
    }

    // Damage enemies in slash box
    const targets = grid.queryRadius(player.x, player.y, slashWidth + 20);
    let hitCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const e = targets[i];
      const inFront = facing > 0 ? e.x >= player.x - 10 && e.x <= player.x + slashWidth : e.x <= player.x + 10 && e.x >= player.x - slashWidth;
      const inBack = (w.level >= 3 || w.evolved) && (facing > 0 ? e.x <= player.x + 10 && e.x >= player.x - slashWidth : e.x >= player.x - 10 && e.x <= player.x + slashWidth);

      if ((inFront || inBack) && Math.abs(e.y - player.y) <= slashHeight / 2 + e.radius) {
        const isCrit = w.evolved && Math.random() < 0.35;
        const finalDmg = isCrit ? baseDamage * 2.2 : baseDamage;
        w.totalDamageDealt += finalDmg;
        hitCount++;

        const knockX = e.x > player.x ? 1 : -1;
        const dead = e.takeDamage(finalDmg, knockX, 0, 180);
        vfx.addDamageNumber(e.x, e.y, finalDmg, isCrit);

        if (w.evolved && isCrit) {
          player.heal(1);
          vfx.addDamageNumber(player.x, player.y, 1, false, true);
        }

        if (dead) {
          onEnemyKilled(e);
        }
      }
    }

    // Damage nearby torches
    for (let i = 0; i < worldProps.torches.length; i++) {
      const t = worldProps.torches[i];
      if (Math.abs(t.x - player.x) <= slashWidth && Math.abs(t.y - player.y) <= slashHeight) {
        worldProps.damageTorch(t, onDropSpawn);
      }
    }

    if (hitCount > 0) sound.playHit();
  }

  private triggerWand(w: WeaponInstance, player: Player, grid: SpatialGrid<Enemy>, sound: SoundEngine): void {
    const nearby = grid.queryRadius(player.x, player.y, 450);
    if (nearby.length === 0) return;

    // Sort to find closest
    nearby.sort((a, b) => {
      const da = (a.x - player.x) ** 2 + (a.y - player.y) ** 2;
      const db = (b.x - player.x) ** 2 + (b.y - player.y) ** 2;
      return da - db;
    });

    const projectileCount = w.evolved ? 2 : 1 + (w.level >= 2 ? 1 : 0) + (w.level >= 4 ? 1 : 0);
    const speed = w.evolved ? 480 : 360;
    const baseDamage = (w.evolved ? 26 : 14 + w.level * 4) * player.might;

    for (let i = 0; i < projectileCount; i++) {
      const target = nearby[i % nearby.length];
      const dx = target.x - player.x + (Math.random() - 0.5) * 20;
      const dy = target.y - player.y + (Math.random() - 0.5) * 20;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        this.projectiles.push({
          id: this.nextProjId++,
          type: 'wand',
          x: player.x,
          y: player.y,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          radius: w.evolved ? 9 : 7,
          damage: baseDamage,
          pierce: w.evolved ? 2 : 1,
          life: 1.5,
          weaponId: 'wand',
          isEvolved: w.evolved,
          hitEnemyIds: new Set(),
        });
      }
    }

    sound.playShoot();
  }

  private triggerKnife(w: WeaponInstance, player: Player, sound: SoundEngine): void {
    const projectileCount = w.evolved ? 4 : 1 + (w.level >= 2 ? 1 : 0) + (w.level >= 4 ? 1 : 0);
    const speed = w.evolved ? 550 : 420;
    const baseDamage = (w.evolved ? 24 : 12 + w.level * 3) * player.might;
    const baseAngle = Math.atan2(player.facingY, player.facingX);

    for (let i = 0; i < projectileCount; i++) {
      const spread = (i - (projectileCount - 1) / 2) * 0.14;
      const angle = baseAngle + spread;

      this.projectiles.push({
        id: this.nextProjId++,
        type: 'knife',
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 6,
        damage: baseDamage,
        pierce: w.evolved ? 3 : w.level >= 3 ? 2 : 1,
        life: 1.2,
        weaponId: 'knife',
        isEvolved: w.evolved,
        hitEnemyIds: new Set(),
      });
    }

    sound.playKnife();
  }

  private triggerLightning(
    w: WeaponInstance,
    player: Player,
    enemies: Enemy[],
    grid: SpatialGrid<Enemy>,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void
  ): void {
    if (enemies.length === 0) return;

    sound.playThunder();
    const count = w.evolved ? 4 : 1 + (w.level >= 2 ? 1 : 0) + (w.level >= 4 ? 1 : 0);
    const baseDamage = (w.evolved ? 80 : 40 + w.level * 12) * player.might;
    const aoeRadius = w.evolved ? 65 : 45;

    for (let i = 0; i < count; i++) {
      const target = enemies[Math.floor(Math.random() * enemies.length)];
      if (!target) continue;

      this.lightningStrikes.push({
        x: target.x,
        y: target.y,
        radius: aoeRadius,
        life: 0.25,
        maxLife: 0.25,
        isEvolved: w.evolved,
      });

      // Area damage
      const victims = grid.queryRadius(target.x, target.y, aoeRadius);
      for (let v = 0; v < victims.length; v++) {
        const vic = victims[v];
        w.totalDamageDealt += baseDamage;
        const dead = vic.takeDamage(baseDamage, 0, 0, 50);
        vfx.addDamageNumber(vic.x, vic.y, baseDamage, w.evolved);
        vfx.addSparks(vic.x, vic.y, '#38bdf8', 4);
        if (dead) onEnemyKilled(vic);
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

    const rotSpeed = w.evolved ? 4.5 : 2.5 + w.level * 0.3;
    this.bibleAngle += rotSpeed * dt;
    this.bibleRadius = w.evolved ? 90 : 65 + w.level * 4;

    const orbCount = w.evolved ? 5 : 1 + (w.level >= 2 ? 1 : 0) + (w.level >= 4 ? 1 : 0);
    const baseDamage = (w.evolved ? 22 : 10 + w.level * 3) * player.might;

    for (let i = 0; i < orbCount; i++) {
      const angle = this.bibleAngle + (i * Math.PI * 2) / orbCount;
      const orbX = player.x + Math.cos(angle) * this.bibleRadius;
      const orbY = player.y + Math.sin(angle) * this.bibleRadius;

      const hitEnemies = grid.queryRadius(orbX, orbY, 18);
      for (let e = 0; e < hitEnemies.length; e++) {
        const enemy = hitEnemies[e];
        const pushAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
        const dead = enemy.takeDamage(baseDamage * dt * 3.5, Math.cos(pushAngle), Math.sin(pushAngle), 120);
        w.totalDamageDealt += baseDamage * dt * 3.5;

        if (Math.random() < 0.1) {
          vfx.addDamageNumber(enemy.x, enemy.y, Math.round(baseDamage), false);
          sound.playHit();
        }

        if (dead) onEnemyKilled(enemy);
      }
    }
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
    this.garlicRadius = w.evolved ? 95 : 55 + w.level * 6;
    const tickInterval = 0.4;

    if (this.garlicTimer >= tickInterval) {
      this.garlicTimer = 0;
      sound.playGarlicPulse();

      const baseDamage = (w.evolved ? 24 : 8 + w.level * 3) * player.might;
      const enemies = grid.queryRadius(player.x, player.y, this.garlicRadius);

      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const angle = Math.atan2(e.y - player.y, e.x - player.x);
        w.totalDamageDealt += baseDamage;
        const dead = e.takeDamage(baseDamage, Math.cos(angle), Math.sin(angle), 150);
        vfx.addDamageNumber(e.x, e.y, baseDamage, false);

        if (w.evolved && Math.random() < 0.2) {
          player.heal(1);
        }

        if (dead) onEnemyKilled(e);
      }
    }
  }

  private updateProjectiles(
    dt: number,
    grid: SpatialGrid<Enemy>,
    worldProps: WorldSystem,
    vfx: VFXManager,
    sound: SoundEngine,
    onEnemyKilled: (enemy: Enemy) => void,
    onDropSpawn: (drop: Drop) => void
  ): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check collision with enemies
      const hits = grid.queryRadius(p.x, p.y, p.radius + 12);
      let hitSomeone = false;

      for (let h = 0; h < hits.length; h++) {
        const enemy = hits[h];
        if (p.hitEnemyIds.has(enemy.id)) continue;

        p.hitEnemyIds.add(enemy.id);
        const w = this.weapons.get(p.weaponId);
        if (w) w.totalDamageDealt += p.damage;

        const knockX = p.vx > 0 ? 1 : -1;
        const knockY = p.vy > 0 ? 1 : -1;
        const dead = enemy.takeDamage(p.damage, knockX, knockY, 140);
        vfx.addDamageNumber(enemy.x, enemy.y, p.damage, p.isEvolved);
        vfx.addSparks(p.x, p.y, p.type === 'wand' ? '#38bdf8' : '#e2e8f0', 3);
        hitSomeone = true;

        if (dead) onEnemyKilled(enemy);

        p.pierce -= 1;
        if (p.pierce <= 0) {
          this.projectiles.splice(i, 1);
          break;
        }
      }

      // Check collision with torches
      for (let tIdx = 0; tIdx < worldProps.torches.length; tIdx++) {
        const torch = worldProps.torches[tIdx];
        const tdx = p.x - torch.x;
        const tdy = p.y - torch.y;
        if (tdx * tdx + tdy * tdy <= (p.radius + torch.radius) ** 2) {
          worldProps.damageTorch(torch, onDropSpawn);
          vfx.addSparks(torch.x, torch.y, '#f97316', 5);
          sound.playHit();
          p.pierce -= 1;
          if (p.pierce <= 0) {
            this.projectiles.splice(i, 1);
            break;
          }
        }
      }

      if (hitSomeone) sound.playHit();
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, player: Player): void {
    // Render Garlic Aura
    const garlic = this.weapons.get('garlic');
    if (garlic) {
      const screen = camera.worldToScreen(player.x, player.y);
      ctx.save();
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, this.garlicRadius, 0, Math.PI * 2);
      ctx.fillStyle = garlic.evolved ? 'rgba(127, 29, 29, 0.25)' : 'rgba(253, 224, 71, 0.18)';
      ctx.fill();
      ctx.strokeStyle = garlic.evolved ? '#ef4444' : '#facc15';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Render Whip Slashes
    for (let i = 0; i < this.whipSlashes.length; i++) {
      const s = this.whipSlashes[i];
      const screen = camera.worldToScreen(s.x, s.y);
      const alpha = s.life / s.maxLife;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.isEvolved ? '#dc2626' : '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, s.width / 2, s.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Render Orbiting Bibles
    const bible = this.weapons.get('bible');
    if (bible) {
      const orbCount = bible.evolved ? 5 : 1 + (bible.level >= 2 ? 1 : 0) + (bible.level >= 4 ? 1 : 0);
      for (let i = 0; i < orbCount; i++) {
        const angle = this.bibleAngle + (i * Math.PI * 2) / orbCount;
        const orbX = player.x + Math.cos(angle) * this.bibleRadius;
        const orbY = player.y + Math.sin(angle) * this.bibleRadius;
        const screen = camera.worldToScreen(orbX, orbY);

        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(angle + Math.PI / 2);

        // Book cover
        ctx.fillStyle = bible.evolved ? '#1e1b4b' : '#1d4ed8';
        ctx.fillRect(-8, -11, 16, 22);
        // Pages
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-6, -9, 12, 18);
        // Cross / Sigil
        ctx.fillStyle = bible.evolved ? '#dc2626' : '#fbbf24';
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-5, -3, 10, 4);

        ctx.restore();
      }
    }

    // Render Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      const screen = camera.worldToScreen(p.x, p.y);

      ctx.save();
      ctx.translate(screen.x, screen.y);
      const angle = Math.atan2(p.vy, p.vx);
      ctx.rotate(angle);

      if (p.type === 'wand') {
        ctx.fillStyle = p.isEvolved ? '#a855f7' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'knife') {
        ctx.fillStyle = p.isEvolved ? '#ef4444' : '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-6, -4);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-6, 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    // Render Lightning Strikes
    for (let i = 0; i < this.lightningStrikes.length; i++) {
      const ls = this.lightningStrikes[i];
      const screen = camera.worldToScreen(ls.x, ls.y);
      const alpha = ls.life / ls.maxLife;

      ctx.save();
      ctx.globalAlpha = alpha;
      // Bolt from sky
      ctx.strokeStyle = ls.isEvolved ? '#38bdf8' : '#fde047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x - 15, screen.y * 0.4);
      ctx.lineTo(screen.x + 10, screen.y * 0.7);
      ctx.lineTo(screen.x, screen.y);
      ctx.stroke();

      // Shockwave ring
      ctx.fillStyle = ls.isEvolved ? 'rgba(56, 189, 248, 0.4)' : 'rgba(253, 224, 71, 0.35)';
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, ls.radius * (1 - alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  generateUpgradeOptions(): UpgradeOption[] {
    const options: UpgradeOption[] = [];
    const allWeaponIds: WeaponId[] = ['whip', 'wand', 'knife', 'bible', 'garlic', 'lightning'];
    const allPassiveIds: PassiveId[] = ['spinach', 'wings', 'heart', 'tome', 'magnet', 'bracer'];

    // 1. Check for possible Evolutions first
    for (const [wId, w] of this.weapons.entries()) {
      if (w.level >= w.maxLevel && !w.evolved) {
        const meta = WEAPON_REGISTRY[wId];
        const hasPassive = this.passives.has(meta.synergyPassive);
        if (hasPassive) {
          options.push({
            type: 'evolution',
            id: meta.evolvedId,
            baseId: wId,
            name: meta.evolvedName,
            description: meta.evolvedDescription,
            level: 6,
            isNew: false,
            isEvolution: true,
            iconName: meta.iconName,
          });
        }
      }
    }

    // 2. Existing weapon upgrades
    for (const [wId, w] of this.weapons.entries()) {
      if (w.level < w.maxLevel) {
        const meta = WEAPON_REGISTRY[wId];
        const nextLv = w.level + 1;
        options.push({
          type: 'weapon',
          id: wId,
          name: meta.name,
          description: meta.levelDescriptions[nextLv - 1] || 'Aumenta atributos de ataque.',
          level: nextLv,
          isNew: false,
          iconName: meta.iconName,
        });
      }
    }

    // 3. New weapons (if under limit of 6)
    if (this.weapons.size < 6) {
      for (const wId of allWeaponIds) {
        if (!this.weapons.has(wId)) {
          const meta = WEAPON_REGISTRY[wId];
          options.push({
            type: 'weapon',
            id: wId,
            name: meta.name,
            description: meta.levelDescriptions[0],
            level: 1,
            isNew: true,
            iconName: meta.iconName,
          });
        }
      }
    }

    // 4. Existing passive upgrades
    for (const [pId, p] of this.passives.entries()) {
      if (p.level < p.maxLevel) {
        const meta = PASSIVE_REGISTRY[pId];
        const nextLv = p.level + 1;
        options.push({
          type: 'passive',
          id: pId,
          name: meta.name,
          description: meta.levelDescriptions[nextLv - 1] || 'Aprimora atributos passivos.',
          level: nextLv,
          isNew: false,
          iconName: meta.iconName,
        });
      }
    }

    // 5. New passives (if under limit of 6)
    if (this.passives.size < 6) {
      for (const pId of allPassiveIds) {
        if (!this.passives.has(pId)) {
          const meta = PASSIVE_REGISTRY[pId];
          options.push({
            type: 'passive',
            id: pId,
            name: meta.name,
            description: meta.levelDescriptions[0],
            level: 1,
            isNew: true,
            iconName: meta.iconName,
          });
        }
      }
    }

    // Shuffle and pick 3
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    return options.slice(0, 3);
  }
}
