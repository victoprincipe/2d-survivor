import { CharacterConfig } from '../types';
import { Camera } from '../engine/Camera';
import { InputManager } from '../engine/Input';

const HP_BAR_WIDTH = 46;
const HP_BAR_HEIGHT = 11;
const HP_BAR_FONT_SIZE = 9;
const HP_BAR_OUTLINE_WIDTH = 2.5;
const HP_BAR_TEXT_PADDING_X = 3;

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
  public speedBoostTimer: number = 0;

  // Progression
  public level: number = 1;
  public xp: number = 0;
  public xpToNextLevel: number = Player.computeXpToNextLevel(1);

  // State & Animations
  public facingX: number = 1;
  public facingY: number = 0;
  public invulnerableTimer: number = 0;
  public walkAnimTimer: number = 0;
  public isMoving: boolean = false;

  public character: CharacterConfig;
  public powerUps: PermanentPowerUps = {};
  public attackAnimTimer: number = 0;
  public attackAnimDuration: number = 0;
  private spriteImage: HTMLImageElement | null = null;
  private walkSpriteImage: HTMLImageElement | null = null;
  private attackSpriteImage: HTMLImageElement | null = null;

  public static computeXpToNextLevel(level: number): number {
    const lv = Math.max(0, level - 1);
    return Math.floor(10 + 8 * lv + 2.15 * Math.pow(lv, 1.82));
  }

  constructor(character: CharacterConfig, initialPowerUps: PermanentPowerUps = {}) {
    this.character = character;
    this.powerUps = initialPowerUps;

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
    if (b.maxHp) this.maxHp += b.maxHp;
    if (b.might) this.might += b.might;
    if (b.armor) this.armor += b.armor;
    if (b.cooldownReduction) this.cooldownReduction += b.cooldownReduction;
    if (b.pickupRadius) this.pickupRadius += b.pickupRadius;
    if (b.xpMultiplier) this.xpMultiplier += b.xpMultiplier;
    if (b.recovery) this.recoveryPerSec += b.recovery;
    if (b.critChance) this.critChance += b.critChance;
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
  }

  update(dt: number, input: InputManager): boolean {
    // Invulnerability timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
    }

    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer = Math.max(0, this.attackAnimTimer - dt);
    }

    // Health recovery
    if (this.recoveryPerSec > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.recoveryPerSec * dt);
    }

    // Movement
    const dx = input.dx;
    const dy = input.dy;
    this.isMoving = Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05;

    const effectiveSpeed = this.speedBoostTimer > 0 ? this.speed * 1.15 : this.speed;

    if (this.isMoving) {
      this.x += dx * effectiveSpeed * dt;
      this.y += dy * effectiveSpeed * dt;
      this.facingX = input.facingX;
      this.facingY = input.facingY;
      this.walkAnimTimer += dt * 10;
    } else {
      this.walkAnimTimer = 0;
    }

    return this.hp > 0;
  }

  public triggerAttackAnimation(duration: number): void {
    this.attackAnimDuration = Math.max(0.01, duration);
    this.attackAnimTimer = this.attackAnimDuration;
  }

  takeDamage(amount: number): boolean {
    if (this.invulnerableTimer > 0) return false;

    const reducedAmount = Math.max(1, Math.round(amount - this.armor));
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

  checkLevelUp(): boolean {
    if (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level += 1;
      this.xpToNextLevel = Player.computeXpToNextLevel(this.level);
      return true;
    }
    return false;
  }

  addXp(amount: number): boolean {
    this.xp += amount * this.xpMultiplier;
    return this.checkLevelUp();
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const screen = camera.worldToScreen(this.x, this.y);

    // Flash white/transparent when invulnerable
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    ctx.save();
    ctx.translate(screen.x, screen.y);

    const walkSheet = this.walkSpriteImage;
    const attackSheet = this.attackSpriteImage;
    const hasWalkSheet = !!walkSheet && walkSheet.complete && walkSheet.naturalWidth > 0;
    const hasAttackSheet =
      !!attackSheet && attackSheet.complete && attackSheet.naturalWidth > 0;
    const isDead = this.hp <= 0;
    const isAttacking = !isDead && this.attackAnimTimer > 0 && hasAttackSheet;
    const isUsingSheet = hasWalkSheet;

    // Spritesheets already animate the gait, so avoid an extra bounce.
    const bob = isUsingSheet ? 0 : Math.sin(this.walkAnimTimer) * 3;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const flip = this.facingX < 0 ? -1 : 1;
    const spriteHeight = 52;

    if (isUsingSheet && walkSheet) {
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

    ctx.restore();
    ctx.globalAlpha = 1.0;

    // HP Bar above player
    ctx.save();

    const barWidth = HP_BAR_WIDTH;
    const barHeight = HP_BAR_HEIGHT;
    const barX = Math.round(screen.x - barWidth / 2);
    const hasPlayerSprite =
      isUsingSheet ||
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
