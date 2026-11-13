import { CharacterConfig } from '../types';
import { Camera } from '../engine/Camera';
import { InputManager } from '../engine/Input';

const HP_BAR_WIDTH = 46;
const HP_BAR_HEIGHT = 11;
const HP_BAR_FONT_SIZE = 9;
const HP_BAR_OUTLINE_WIDTH = 2.5;
const HP_BAR_TEXT_PADDING_X = 3;

export interface MovementConfig {
  maxStamina: number;
  dashStaminaCost: number;
  staminaRegenPerSec: number;
  staminaRegenDelay: number;
  dashSpeed: number;
  dashDuration: number;
  dashCooldown: number;
  jumpHeight: number;
  jumpDuration: number;
  jumpCooldown: number;
}

export const DEFAULT_MOVEMENT_CONFIG: MovementConfig = {
  maxStamina: 100,
  dashStaminaCost: 20,
  staminaRegenPerSec: 20,
  staminaRegenDelay: 1,
  dashSpeed: 900,
  dashDuration: 0.14,
  dashCooldown: 0.35,
  jumpHeight: 54,
  jumpDuration: 0.55,
  jumpCooldown: 0.35,
};

export type PlayerCollisionResolver = (
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
  radius: number,
  airborne?: boolean
) => { x: number; y: number };

export type PermanentPowerUps = {
  might?: number;
  armor?: number;
  maxHp?: number;
  recovery?: number;
  speed?: number;
  greed?: number;
};

export class Player {
  public id: string = 'player';
  public x: number = 0;
  public y: number = 0;
  public radius: number = 18;

  // Base Stats
  public maxHp: number = 100;
  public hp: number = 100;
  public baseSpeed: number = 160;
  public speed: number = 160;

  // Combat & Global Passive Modifiers
  public might: number = 1.0; // Damage multiplier
  public armor: number = 0; // Flat damage reduction
  public cooldownReduction: number = 0; // Capped at 0.55
  public projectileSpeedMultiplier: number = 1.0;
  public areaMultiplier: number = 1.0;
  public durationMultiplier: number = 1.0;
  public critChance: number = 0.05;
  public critMultiplier: number = 1.75;
  public bonusAmount: number = 0;
  public bonusPierce: number = 0;
  public knockbackMultiplier: number = 1.0;
  public debuffDamageBonus: number = 0;
  public luck: number = 0;

  public pickupRadius: number = 65;
  public xpMultiplier: number = 1.0;
  public goldMultiplier: number = 1.0;
  public recoveryPerSec: number = 0;
  // Permanent-for-the-run bonuses granted by Amazon Forest mission objectives.
  public objectiveSpeedBonus: number = 0;
  public objectiveMightBonus: number = 0;
  public objectiveRecoveryBonus: number = 0;
  public speedBoostTimer: number = 0;
  public slowTimer: number = 0;
  public slowFactor: number = 0;
  public stunTimer: number = 0;
  // Kopenawa's cave snuff: horizontal controls are inverted while it lasts.
  public transeTimer: number = 0;
  // Movement confusion: one of the four walk commands is scrambled.
  public confusionTimer: number = 0;
  public confusionDirection: 'up' | 'down' | 'left' | 'right' | null = null;
  /** 0–1 fraction of stun duration removed by Amazon passives. */
  public stunResistance: number = 0;
  // External impulse (Caipora's charge) that drags the hero through the world.
  public knockbackVX: number = 0;
  public knockbackVY: number = 0;
  public attackSpeedBoostTimer: number = 0;
  public shieldTimer: number = 0;
  // Thorn bush wound: damage every second until cured by the São-Caetano herb.
  public bleedTimer: number = 0;
  public bleedTickTimer: number = 0;
  public bleedDamage: number = 0;
  // Short grace period between thorn bush hits while standing on one.
  public thornCooldown: number = 0;

  // Movement abilities (dash & jump)
  public movementConfig: MovementConfig = { ...DEFAULT_MOVEMENT_CONFIG };
  public stamina: number = DEFAULT_MOVEMENT_CONFIG.maxStamina;
  public staminaRegenTimer: number = 0;
  public dashCooldownTimer: number = 0;
  public dashTimer: number = 0;
  public jumpTimer: number = 0;
  public jumpCooldownTimer: number = 0;
  private dashDirX: number = 1;
  private dashDirY: number = 0;
  public collisionResolver?: PlayerCollisionResolver;

  // DevTools / Cheats
  public godMode: boolean = false;
  public infiniteStamina: boolean = false;

  // Progression
  public level: number = 1;
  public levelUpHealFraction: number = 0;
  public xp: number = 0;
  public xpToNextLevel: number = Player.computeXpToNextLevel(1);

  // State & Animations
  public facingX: number = 1;
  public facingY: number = 0;
  public invulnerableTimer: number = 0;
  public walkAnimTimer: number = 0;
  private idleAnimTimer: number = 0;
  private exhaustTimer: number = 0;
  private exhaustPuffs: { x: number; y: number; vx: number; age: number; life: number }[] = [];
  public isMoving: boolean = false;
  // Set by the engine while the feet are on the Amazon river/lake surface.
  public isWadingInWater: boolean = false;
  // Set by the engine while the feet are on the Amazon muddy margins.
  public isInMud: boolean = false;
  // Sucuri quicksand: movement and dashes are locked until the hero jumps.
  public isMired: boolean = false;
  // Terrain speed penalty (water -30%, mud -20%), refreshed by the engine.
  public terrainSpeedMultiplier: number = 1;

  public character: CharacterConfig;
  public powerUps: PermanentPowerUps = {};
  public attackAnimTimer: number = 0;
  public attackAnimDuration: number = 0;
  private spriteImage: HTMLImageElement | null = null;
  private walkSpriteImage: HTMLImageElement | null = null;
  private attackSpriteImage: HTMLImageElement | null = null;
  private animationSpriteImage: HTMLImageElement | null = null;
  private movementSpriteImage: HTMLImageElement | null = null;
  private attackFacingX: number = 1;

  public static computeXpToNextLevel(level: number): number {
    const lv = Math.max(0, level - 1);
    return Math.floor(10 + 8 * lv + 2.15 * Math.pow(lv, 1.82));
  }

  public get isJumping(): boolean {
    return this.jumpTimer > 0;
  }

  public get jumpOffset(): number {
    const config = this.movementConfig;
    if (this.jumpTimer <= 0 || config.jumpDuration <= 0) return 0;
    const progress = 1 - this.jumpTimer / config.jumpDuration;
    return -Math.sin(Math.PI * Math.max(0, Math.min(1, progress))) * config.jumpHeight;
  }

  public setCollisionResolver(resolver: PlayerCollisionResolver): void {
    this.collisionResolver = resolver;
  }

  constructor(character: CharacterConfig, initialPowerUps: PermanentPowerUps = {}) {
    this.character = character;
    this.powerUps = initialPowerUps;

    if (character.movementSprite && typeof window !== 'undefined') {
      this.movementSpriteImage = new Image();
      this.movementSpriteImage.src = character.movementSprite;
    }

    if (character.animationSprite && typeof window !== 'undefined') {
      this.animationSpriteImage = new Image();
      this.animationSpriteImage.src = character.animationSprite;
    }

    if (character.sprite && typeof window !== 'undefined') {
      this.spriteImage = new Image();
      this.spriteImage.src = character.sprite;
    }

    if (character.walkSprite && typeof window !== 'undefined') {
      this.walkSpriteImage = new Image();
      this.walkSpriteImage.src = character.walkSprite;
    }

    if (character.attackSprite && typeof window !== 'undefined') {
      this.attackSpriteImage = new Image();
      this.attackSpriteImage.src = character.attackSprite;
    }

    // Apply character base modifiers
    const b = character.statBonuses;
    this.projectileSpeedMultiplier += b.projectileSpeed ?? 0;
    if (b.maxHp) this.maxHp += b.maxHp;
    if (b.might) this.might += b.might;
    if (b.armor) this.armor += b.armor;
    if (b.cooldownReduction) this.cooldownReduction += b.cooldownReduction;
    if (b.pickupRadius) this.pickupRadius += b.pickupRadius;
    if (b.xpMultiplier) this.xpMultiplier += b.xpMultiplier;
    if (b.recovery) this.recoveryPerSec += b.recovery;
    if (b.critChance) this.critChance += b.critChance;
    if (b.bonusAmount) this.bonusAmount += b.bonusAmount;
    if (b.area) this.areaMultiplier += b.area;
    if (b.speed) this.baseSpeed *= 1 + b.speed;

    // Apply permanent power-up bonuses
    if (initialPowerUps.might) this.might += initialPowerUps.might * 0.05;
    if (initialPowerUps.armor) this.armor += initialPowerUps.armor * 1;
    if (initialPowerUps.maxHp) this.maxHp += initialPowerUps.maxHp * 10;
    if (initialPowerUps.recovery) this.recoveryPerSec += initialPowerUps.recovery * 0.5;
    if (initialPowerUps.speed) this.baseSpeed *= 1 + initialPowerUps.speed * 0.05;
    if (initialPowerUps.greed) this.goldMultiplier += initialPowerUps.greed * 0.15;

    this.hp = this.maxHp;
    this.speed = this.baseSpeed;
    this.stamina = this.movementConfig.maxStamina;
  }

  public applySlow(factor: number, duration: number): void {
    this.slowFactor = Math.max(this.slowFactor, Math.max(0, Math.min(0.8, factor)));
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  /** Opens a bleeding wound that ticks a small amount of damage every second. */
  public applyBleed(damagePerSecond: number, duration: number): void {
    this.bleedDamage = Math.max(this.bleedDamage, damagePerSecond);
    if (this.bleedTimer <= 0) this.bleedTickTimer = 1;
    this.bleedTimer = Math.max(this.bleedTimer, duration);
  }

  /** Removes the movement slow (thorn bush or other debuffs). */
  public clearSlow(): void {
    this.slowTimer = 0;
    this.slowFactor = 0;
  }

  /** Closes the thorn wound, stopping the damage over time. */
  public clearBleeding(): void {
    this.bleedTimer = 0;
    this.bleedTickTimer = 0;
    this.bleedDamage = 0;
  }

  public applyStun(duration: number): void {
    const resistedDuration = duration * (1 - Math.min(1, Math.max(0, this.stunResistance)));
    if (resistedDuration <= 0) return;
    this.stunTimer = Math.max(this.stunTimer, resistedDuration);
    this.dashTimer = 0;
    this.jumpTimer = 0;
  }

  public applyTranse(duration: number): void {
    if (duration <= 0) return;
    this.transeTimer = Math.max(this.transeTimer, duration);
  }

  /**
   * Scrambles exactly one walk command. Each of the four directions has an
   * equal 25% chance, drawn with Math.random() on every impact.
   */
  public applyConfusion(duration: number): void {
    if (duration <= 0) return;
    const roll = Math.floor(Math.random() * 4);
    this.confusionDirection = roll === 0
      ? 'up'
      : roll === 1
        ? 'down'
        : roll === 2
          ? 'left'
          : 'right';
    this.confusionTimer = Math.max(this.confusionTimer, duration);
  }

  /** Pushes the hero with an external impulse (Caipora's charge). */
  public applyKnockback(velocityX: number, velocityY: number): void {
    this.knockbackVX = velocityX;
    this.knockbackVY = velocityY;
  }

  update(dt: number, input: InputManager): boolean {
    // Simulation time keeps animation frozen whenever the engine is paused.
    this.idleAnimTimer = (this.idleAnimTimer + dt) % 4;
    // Invulnerability timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
    }

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowTimer = 0;
        this.slowFactor = 0;
      }
    }

    if (this.thornCooldown > 0) {
      this.thornCooldown = Math.max(0, this.thornCooldown - dt);
    }

    // Thorn wound: one small damage tick per second, independent of i-frames.
    if (this.bleedTimer > 0) {
      this.bleedTimer = Math.max(0, this.bleedTimer - dt);
      this.bleedTickTimer -= dt;
      if (this.bleedTickTimer <= 0) {
        this.bleedTickTimer += 1;
        if (!this.godMode && this.bleedDamage > 0) {
          this.hp = Math.max(0, this.hp - this.bleedDamage);
        }
      }
      if (this.bleedTimer <= 0) {
        this.bleedTimer = 0;
        this.bleedTickTimer = 0;
        this.bleedDamage = 0;
      }
      if (this.hp <= 0) return false;
    }

    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
    }

    if (this.transeTimer > 0) {
      this.transeTimer = Math.max(0, this.transeTimer - dt);
    }

    if (this.confusionTimer > 0) {
      this.confusionTimer = Math.max(0, this.confusionTimer - dt);
      if (this.confusionTimer === 0) this.confusionDirection = null;
    }

    if (this.attackSpeedBoostTimer > 0) {
      this.attackSpeedBoostTimer = Math.max(0, this.attackSpeedBoostTimer - dt);
    }

    if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    }

    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);
    }

    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - dt);
    }

    if (this.jumpCooldownTimer > 0) {
      this.jumpCooldownTimer = Math.max(0, this.jumpCooldownTimer - dt);
    }

    if (this.jumpTimer > 0) {
      this.jumpTimer = Math.max(0, this.jumpTimer - dt);
    }

    const config = this.movementConfig;

    if (this.infiniteStamina) {
      this.stamina = config.maxStamina;
      this.dashCooldownTimer = 0;
      this.jumpCooldownTimer = 0;
    } else if (this.staminaRegenTimer > 0) {
      // Stamina regeneration starts only after the configured delay.
      this.staminaRegenTimer = Math.max(0, this.staminaRegenTimer - dt);
    } else if (this.stamina < config.maxStamina) {
      this.stamina = Math.min(
        config.maxStamina,
        this.stamina + config.staminaRegenPerSec * dt
      );
    }

    // Health recovery
    if (this.recoveryPerSec > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.recoveryPerSec * dt);
    }

    const stunned = this.stunTimer > 0;

    // Jump (a single queued press per keydown; no double jumps).
    const jumpPressed = input.consumeJump();
    if (!stunned && jumpPressed && this.jumpTimer <= 0 && this.jumpCooldownTimer <= 0) {
      this.jumpTimer = config.jumpDuration;
      this.jumpCooldownTimer = config.jumpDuration + config.jumpCooldown;
    }

    // Movement input
    // Quicksand pins the hero in place until a jump lifts them out; dashes and
    // external impulses are also suspended while the feet are stuck.
    const mired = this.isMired && !this.isJumping;
    if (mired) this.dashTimer = 0;

    let dx = input.dx;
    let dy = input.dy;
    // Confusion only scrambles the chosen command: pressing "up" moves down,
    // while the remaining three directions keep their normal mapping.
    if (this.confusionTimer > 0) {
      if (this.confusionDirection === 'up' && dy < 0) dy = -dy;
      else if (this.confusionDirection === 'down' && dy > 0) dy = -dy;
      else if (this.confusionDirection === 'left' && dx < 0) dx = -dx;
      else if (this.confusionDirection === 'right' && dx > 0) dx = -dx;
    }
    if (this.transeTimer > 0) dx = -dx;
    const moving = !stunned && !mired && (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05);

    // Dash impulse (held SHIFT). Direction follows movement, or facing when idle.
    if (
      !stunned &&
      !mired &&
      input.dashHeld &&
      this.dashCooldownTimer <= 0 &&
      this.dashTimer <= 0 &&
      this.stamina >= config.dashStaminaCost
    ) {
      const moveMag = Math.sqrt(dx * dx + dy * dy);
      if (moveMag > 0.1) {
        this.dashDirX = dx / moveMag;
        this.dashDirY = dy / moveMag;
      } else {
        const facingMag =
          Math.sqrt(this.facingX * this.facingX + this.facingY * this.facingY) || 1;
        this.dashDirX = this.facingX / facingMag;
        this.dashDirY = this.facingY / facingMag;
      }

      this.stamina = Math.max(0, this.stamina - config.dashStaminaCost);
      this.staminaRegenTimer = config.staminaRegenDelay;
      this.dashCooldownTimer = config.dashCooldown;
      this.dashTimer = config.dashDuration;
    }

    const dashing = this.dashTimer > 0;
    const speedBoost = this.speedBoostTimer > 0 ? 1.15 : 1;
    const slowMult = this.slowTimer > 0 ? Math.max(0.35, 1 - this.slowFactor) : 1;
    const effectiveSpeed =
      this.speed * speedBoost * slowMult * this.terrainSpeedMultiplier;

    let moveX = moving ? dx * effectiveSpeed * dt : 0;
    let moveY = moving ? dy * effectiveSpeed * dt : 0;

    if (dashing) {
      const dashDt = Math.min(dt, this.dashTimer);
      moveX += this.dashDirX * config.dashSpeed * dashDt;
      moveY += this.dashDirY * config.dashSpeed * dashDt;
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.facingX = this.dashDirX;
      this.facingY = this.dashDirY;
    } else if (moving) {
      this.facingX = this.confusionTimer > 0
        ? dx
        : this.transeTimer > 0
          ? -input.facingX
          : input.facingX;
      this.facingY = this.confusionTimer > 0 ? dy : input.facingY;
    }

    if (!mired && (this.knockbackVX !== 0 || this.knockbackVY !== 0)) {
      moveX += this.knockbackVX * dt;
      moveY += this.knockbackVY * dt;
      const decay = Math.pow(0.02, dt);
      this.knockbackVX *= decay;
      this.knockbackVY *= decay;
      if (Math.abs(this.knockbackVX) < 1) this.knockbackVX = 0;
      if (Math.abs(this.knockbackVY) < 1) this.knockbackVY = 0;
    }

    if (moveX !== 0 || moveY !== 0) {
      if (this.collisionResolver) {
        const resolved = this.collisionResolver(
          this.x,
          this.y,
          moveX,
          moveY,
          this.radius,
          this.isJumping
        );
        this.x = resolved.x;
        this.y = resolved.y;
      } else {
        this.x += moveX;
        this.y += moveY;
      }
    }

    this.isMoving = moving || dashing;
    if (this.isMoving) {
      this.walkAnimTimer += dt * 10 * (this.character.id === 'lula'
        ? Math.max(0.4, effectiveSpeed / 160) : 1);
    } else {
      this.walkAnimTimer = 0;
    }

    this.updateExhaust(dt);
    return this.hp > 0;
  }

  private updateExhaust(dt: number): void {
    if (this.character.id !== 'derson') return;
    for (let i = this.exhaustPuffs.length - 1; i >= 0; i--) {
      const puff = this.exhaustPuffs[i];
      puff.age += dt;
      puff.x += puff.vx * dt;
      puff.y -= 12 * dt;
      if (puff.age >= puff.life) this.exhaustPuffs.splice(i, 1);
    }
    if (this.hp <= 0) return;
    const interval = this.dashTimer > 0 ? 0.035 : this.isMoving ? 0.11 : 0.28;
    this.exhaustTimer += dt;
    const flip = this.facingX < 0 ? -1 : 1;
    while (this.exhaustTimer >= interval && this.exhaustPuffs.length < 24) {
      this.exhaustTimer -= interval;
      this.exhaustPuffs.push({
        x: this.x - flip * 17,
        y: this.y + 8 + this.jumpOffset,
        vx: -flip * (15 + Math.random() * 8),
        age: 0,
        life: 0.65 + Math.random() * 0.25,
      });
    }
    // Avoid a burst after a slow frame or when the particle cap is reached.
    this.exhaustTimer = Math.min(this.exhaustTimer, interval);
  }

  private renderExhaust(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.exhaustPuffs.length === 0) return;
    ctx.save();
    const opacity = ctx.globalAlpha;
    for (const puff of this.exhaustPuffs) {
      const progress = puff.age / puff.life;
      const screen = camera.worldToScreen(puff.x, puff.y);
      const radius = 2 + progress * 5;
      ctx.globalAlpha = opacity * (1 - progress) * 0.3;
      ctx.fillStyle = '#cbd0d5';
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, radius, radius * 0.72, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public triggerAttackAnimation(duration: number, facingX: number = this.facingX): void {
    this.attackFacingX = facingX;
    // Rapid bow fire must not pin the atlas animation to its first frames.
    // Keep aiming at the latest target while the current gesture completes.
    if (this.character.animationSprite && this.attackAnimTimer > 0) return;
    this.attackAnimDuration = Math.max(0.01, duration);
    this.attackAnimTimer = this.attackAnimDuration;
  }

  takeDamage(amount: number): boolean {
    if (this.godMode) return false;
    if (this.invulnerableTimer > 0) return false;

    // Pupunha shield: halve incoming damage while the buff lasts.
    const shieldedAmount = this.shieldTimer > 0 ? amount * 0.5 : amount;
    const reducedAmount = Math.max(1, Math.max(1, Math.round(shieldedAmount - this.armor)) * (1 - Math.min(0.9, Math.max(0, this.character.statBonuses.damageReduction ?? 0))));
    this.hp -= reducedAmount;
    this.invulnerableTimer = 0.5; // Half-second i-frames

    if (this.hp <= 0) {
      this.hp = 0;
      return true; // Fatal
    }
    return false;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Bonuses start with the first level gained (level 2), without compounding. */
  public get lulaLevelDamageBonus(): number {
    return this.character.id === 'lula' ? Math.max(0, this.level - 1) * 0.008 : 0;
  }

  public get lulaLevelAttackSpeedBonus(): number {
    return this.character.id === 'lula' ? Math.max(0, this.level - 1) * 0.008 : 0;
  }

  public get lulaLevelMovementBonus(): number {
    return this.character.id === 'lula' ? Math.max(0, this.level - 1) * 0.004 : 0;
  }

  checkLevelUp(): boolean {
    if (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level += 1;
      this.xpToNextLevel = Player.computeXpToNextLevel(this.level);
      this.heal(this.maxHp * this.levelUpHealFraction);
      return true;
    }
    return false;
  }

  addXp(amount: number): boolean {
    this.xp += amount * this.xpMultiplier;
    return this.checkLevelUp();
  }

  private renderLulaPose(
    ctx: CanvasRenderingContext2D,
    walkSheet: HTMLImageElement,
    attackSheet: HTMLImageElement | null,
    isDead: boolean
  ): void {
    let bodySheet = walkSheet;
    let row = 0;
    let frame = !isDead && this.isMoving ? Math.floor(this.walkAnimTimer) % 8 : 0;
    const motion = this.movementSpriteImage;
    const jumping = !isDead && this.isJumping;
    const dashing = !isDead && this.dashTimer > 0;
    if (motion && motion.complete && motion.naturalWidth > 0 && (jumping || dashing)) {
      bodySheet = motion;
      row = jumping ? 0 : 1;
      const progress = jumping
        ? 1 - this.jumpTimer / this.movementConfig.jumpDuration
        : 1 - this.dashTimer / this.movementConfig.dashDuration;
      frame = Math.min(7, Math.max(0, Math.floor(progress * 8)));
    }

    const attacking = !isDead && !!attackSheet && this.attackAnimTimer > 0;
    const attackFrame = Math.min(7, Math.max(0, Math.floor(
      (1 - this.attackAnimTimer / Math.max(0.01, this.attackAnimDuration)) * 8
    )));
    const width = 52 * 128 / 160;
    const split = 116;
    ctx.save();
    // Apply direction once to both layers; feet and gesture always agree.
    ctx.scale(this.facingX < 0 ? -1 : 1, 1);
    ctx.translate(0, 14);
    if (dashing) ctx.rotate(-0.18);
    if (!isDead && !this.isMoving && !jumping && !attacking) {
      ctx.scale(1, 1 + Math.sin(this.idleAnimTimer * Math.PI) * 0.012);
    }
    ctx.translate(0, -14);
    const drawSlice = (sheet: HTMLImageElement, column: number, sheetRow: number,
      top: number, height: number) => {
      ctx.drawImage(sheet, column * 128, sheetRow * 160 + top, 128, height,
        -width / 2, 14 - 52 + top * 52 / 160, width, height * 52 / 160);
    };
    // During the skill, only the upper body changes. Locomotion keeps its legs.
    drawSlice(bodySheet, frame, row, split, 160 - split);
    drawSlice(attacking && attackSheet ? attackSheet : bodySheet,
      attacking ? attackFrame : frame, attacking ? 0 : row, 0, split);
    ctx.restore();
  }

  private renderAnimationAtlas(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement): void {
    const columns = this.character.animationColumns ?? 4;
    const rows = this.character.animationRows ?? 4;
    const frameWidth = sheet.naturalWidth / columns;
    const frameHeight = sheet.naturalHeight / rows;
    const dead = this.hp <= 0;
    const attacking = !dead && this.attackAnimTimer > 0;
    let row = 3;
    let frame = dead ? 0 : Math.floor(this.idleAnimTimer * 2) % columns;
    if (!dead && this.isJumping) {
      row = 1;
      const progress = 1 - this.jumpTimer / this.movementConfig.jumpDuration;
      frame = columns === 4
        ? progress < 0.15 ? 0 : progress < 0.35 ? 1 : progress < 0.8 ? 2 : 3
        : Math.min(columns - 1, Math.max(0, Math.floor(progress * columns)));
    } else if (!dead && rows > 4 && this.dashTimer > 0) {
      row = 4;
      frame = Math.min(columns - 1, Math.max(0, Math.floor(
        (1 - this.dashTimer / this.movementConfig.dashDuration) * columns
      )));
    } else if (!dead && this.isMoving) {
      row = 0;
      frame = Math.floor(this.walkAnimTimer) % columns;
    }
    const attackFrame = Math.min(columns - 1, Math.max(0, Math.floor(
      (1 - this.attackAnimTimer / Math.max(0.01, this.attackAnimDuration)) * columns
    )));
    const height = 60;
    const width = height * frameWidth / frameHeight;
    ctx.save();
    const facing = this.character.animationSplitY ? this.facingX
      : attacking ? this.attackFacingX : this.facingX;
    if (facing < 0) ctx.scale(-1, 1);
    if (this.character.animationSplitY) {
      ctx.translate(0, 14);
      if (!dead && !this.isJumping && this.dashTimer > 0) ctx.rotate(-0.14);
      if (!dead && !attacking && !this.isMoving && !this.isJumping) {
        ctx.scale(1, 1 + Math.sin(this.idleAnimTimer * Math.PI) * 0.012);
      }
      ctx.translate(0, -14);
    }
    ctx.imageSmoothingEnabled = false;
    const drawSlice = (column: number, sourceRow: number, top: number, sliceHeight: number) => {
      ctx.drawImage(sheet, column * frameWidth, sourceRow * frameHeight + top,
        frameWidth, sliceHeight, -width / 2, 14 - height * 0.96 + top * height / frameHeight,
        width, sliceHeight * height / frameHeight);
    };
    const split = this.character.animationSplitY;
    if (split && attacking) {
      // Hip-aligned art keeps locomotion independent from the L gesture.
      drawSlice(frame, row, split, frameHeight - split);
      drawSlice(attackFrame, 2, 0, split);
    } else {
      drawSlice(attacking ? attackFrame : frame, attacking ? 2 : row, 0, frameHeight);
    }
    ctx.restore();
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    this.renderExhaust(ctx, camera);
    const screen = camera.worldToScreen(this.x, this.y);

    // Flash white/transparent when invulnerable
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    ctx.save();
    ctx.translate(screen.x, screen.y);

    const spriteHeight = 52;

    // Waist-deep water: clip the lower ~45% of the sprite so the hero appears
    // to wade through the river instead of floating over it.
    if (this.isWadingInWater) {
      const waterLine = 14 - spriteHeight * 0.45;
      ctx.beginPath();
      ctx.rect(-999, -999, 1998, 999 + waterLine);
      ctx.clip();
    }

    const walkSheet = this.walkSpriteImage;
    const attackSheet = this.attackSpriteImage;
    const hasWalkSheet = !!walkSheet && walkSheet.complete && walkSheet.naturalWidth > 0;
    const hasAttackSheet =
      !!attackSheet && attackSheet.complete && attackSheet.naturalWidth > 0;
    const isDead = this.hp <= 0;
    const isAttacking = !isDead && this.attackAnimTimer > 0 && hasAttackSheet;
    const isUsingSheet = hasWalkSheet;
    const animationSheet = this.animationSpriteImage;
    const hasAnimationSheet = !!animationSheet && animationSheet.complete
      && animationSheet.naturalWidth > 0;

    // Spritesheets already animate the gait, so avoid an extra bounce.
    const bob = isUsingSheet || hasAnimationSheet ? 0 : Math.sin(this.walkAnimTimer) * 3;

    // Shadow (shrinks slightly while airborne, but stays on the ground)
    const jumpOffset = this.jumpOffset;
    const shadowScale = 1 - Math.min(0.45, Math.abs(jumpOffset) / 120);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 16 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Raise only the character body during the jump; the shadow stays grounded.
    if (jumpOffset !== 0) {
      ctx.translate(0, jumpOffset);
    }

    const flip = this.facingX < 0 ? -1 : 1;

    if (hasAnimationSheet && animationSheet) {
      this.renderAnimationAtlas(ctx, animationSheet);
    } else if (this.character.id === 'lula' && hasWalkSheet && walkSheet) {
      this.renderLulaPose(ctx, walkSheet, hasAttackSheet ? attackSheet : null, isDead);
    } else if (isUsingSheet && walkSheet) {
      // Sheet-based animation: 8 walk frames per row, attack frames on a single row.
      const walkFrames = Math.max(1, this.character.walkFrames ?? 8);
      const attackFrames = Math.max(1, this.character.attackFrames ?? 8);

      if (isAttacking && attackSheet) {
        const frameWidth = attackSheet.naturalWidth / attackFrames;
        const frameHeight = attackSheet.naturalHeight;
        const progress =
          this.attackAnimDuration > 0
            ? 1 - this.attackAnimTimer / this.attackAnimDuration
            : 1;
        const frame = Math.min(
          attackFrames - 1,
          Math.max(0, Math.floor(progress * attackFrames))
        );
        const spriteWidth = spriteHeight * (frameWidth / frameHeight);

        ctx.save();
        if (flip < 0) ctx.scale(-1, 1);
        ctx.drawImage(
          attackSheet,
          frame * frameWidth,
          0,
          frameWidth,
          frameHeight,
          -spriteWidth / 2,
          14 - spriteHeight,
          spriteWidth,
          spriteHeight
        );
        ctx.restore();
      } else {
        const frameWidth = walkSheet.naturalWidth / walkFrames;
        const frameHeight = walkSheet.naturalHeight / 2;
        const row = this.facingX < 0 ? 1 : 0;
        const frame = isDead
          ? 0
          : this.isMoving
            ? Math.floor(this.walkAnimTimer) % walkFrames
            : 0;
        const spriteWidth = spriteHeight * (frameWidth / frameHeight);

        ctx.drawImage(
          walkSheet,
          frame * frameWidth,
          row * frameHeight,
          frameWidth,
          frameHeight,
          -spriteWidth / 2,
          14 - spriteHeight,
          spriteWidth,
          spriteHeight
        );
      }
    } else {
      // Facing direction flip
      ctx.scale(flip, 1);

      const sprite = this.spriteImage;
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        // Character sprite
        const spriteWidth = spriteHeight * (sprite.naturalWidth / sprite.naturalHeight);
        ctx.drawImage(sprite, -spriteWidth / 2, 14 - spriteHeight + bob, spriteWidth, spriteHeight);
      } else {
        // Cape / Back detail
        ctx.fillStyle = '#1a1a24';
        ctx.beginPath();
        ctx.moveTo(-10, bob);
        ctx.lineTo(-14, 14 + bob);
        ctx.lineTo(-2, 10 + bob);
        ctx.fill();

        // Body / Robe
        ctx.fillStyle = this.character.color;
        ctx.beginPath();
        ctx.roundRect(-10, -6 + bob, 20, 20, 6);
        ctx.fill();

        // Belt / Trim
        ctx.fillStyle = '#f4a261';
        ctx.fillRect(-10, 4 + bob, 20, 3);

        // Head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(0, -12 + bob, 9, 0, Math.PI * 2);
        ctx.fill();

        // Hair / Hood
        ctx.fillStyle = this.character.portraitColor;
        ctx.beginPath();
        ctx.arc(0, -14 + bob, 10, Math.PI * 0.8, Math.PI * 2.2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#111827';
        ctx.fillRect(2, -14 + bob, 3, 3);
      }
    }

    // Mud caked on the boots/base of the sprite while walking through clay.
    if (this.isInMud && this.isMoving && !isDead) {
      ctx.fillStyle = 'rgba(61, 38, 22, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-6, 12, 6, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(6, 12, 6, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1.0;

    // Pupunha shield ring.
    if (this.shieldTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y - 6, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Pixel blood drops falling from the hero while the thorn wound bleeds.
    if (this.bleedTimer > 0) {
      ctx.save();
      for (let drop = 0; drop < 4; drop++) {
        const cycle = (this.idleAnimTimer * 1.1 + drop * 0.25) % 1;
        const dropX =
          screen.x + Math.sin(this.idleAnimTimer * 2.4 + drop * 1.7) * 13;
        const dropY = screen.y - 16 + cycle * 30;
        ctx.globalAlpha = 1 - cycle * 0.85;
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(Math.round(dropX), Math.round(dropY), 2, 3);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(Math.round(dropX), Math.round(dropY), 1, 1);
      }
      ctx.restore();
    }

    // HP Bar above player
    ctx.save();

    const barWidth = HP_BAR_WIDTH;
    const barHeight = HP_BAR_HEIGHT;
    const barX = Math.round(screen.x - barWidth / 2);
    const hasPlayerSprite =
      hasAnimationSheet || isUsingSheet ||
      (!!this.spriteImage &&
        this.spriteImage.complete &&
        this.spriteImage.naturalWidth > 0);
    const barY = Math.round(screen.y - (hasPlayerSprite ? 52 : 36));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpPercent = Math.max(0, Math.min(1, this.hp / this.maxHp));
    ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // HP text centered inside the bar
    const hpCurrent = Math.max(0, Math.round(this.hp));
    const hpMax = Math.max(1, Math.round(this.maxHp));
    const hpText = `${hpCurrent}/${hpMax}`;

    let fontSize = HP_BAR_FONT_SIZE;
    ctx.font = `bold ${fontSize}px monospace`;
    const maxTextWidth = barWidth - HP_BAR_TEXT_PADDING_X * 2;
    const measuredWidth = ctx.measureText(hpText).width;
    if (measuredWidth > maxTextWidth) {
      fontSize = Math.max(6, Math.floor((fontSize * maxTextWidth) / measuredWidth));
      ctx.font = `bold ${fontSize}px monospace`;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textX = barX + barWidth / 2;
    const textY = barY + barHeight / 2 + 0.5;

    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = HP_BAR_OUTLINE_WIDTH;
    ctx.strokeText(hpText, textX, textY);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(hpText, textX, textY);

    ctx.restore();
  }
}
