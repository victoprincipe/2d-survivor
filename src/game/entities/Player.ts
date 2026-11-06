import { CharacterConfig } from '../types';
import { Camera } from '../engine/Camera';
import { InputManager } from '../engine/Input';

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

  // Modifiers
  public might: number = 1.0; // Damage multiplier
  public armor: number = 0; // Flat damage reduction
  public cooldownReduction: number = 0; // 0 to 0.5
  public pickupRadius: number = 65;
  public xpMultiplier: number = 1.0;
  public recoveryPerSec: number = 0;

  // Progression
  public level: number = 1;
  public xp: number = 0;
  public xpToNextLevel: number = 12;

  // State & Animations
  public facingX: number = 1;
  public facingY: number = 0;
  public invulnerableTimer: number = 0;
  public walkAnimTimer: number = 0;
  public isMoving: boolean = false;

  public character: CharacterConfig;

  constructor(character: CharacterConfig, initialPowerUps: { might?: number; armor?: number; maxHp?: number; recovery?: number; speed?: number; greed?: number } = {}) {
    this.character = character;

    // Apply character base modifiers
    const b = character.statBonuses;
    if (b.maxHp) this.maxHp += b.maxHp;
    if (b.might) this.might += b.might;
    if (b.armor) this.armor += b.armor;
    if (b.cooldownReduction) this.cooldownReduction += b.cooldownReduction;
    if (b.pickupRadius) this.pickupRadius += b.pickupRadius;
    if (b.xpMultiplier) this.xpMultiplier += b.xpMultiplier;
    if (b.speed) this.baseSpeed *= (1 + b.speed);

    // Apply permanent power-up bonuses
    if (initialPowerUps.might) this.might += initialPowerUps.might * 0.05;
    if (initialPowerUps.armor) this.armor += initialPowerUps.armor * 1;
    if (initialPowerUps.maxHp) this.maxHp += initialPowerUps.maxHp * 10;
    if (initialPowerUps.recovery) this.recoveryPerSec += initialPowerUps.recovery * 0.5;
    if (initialPowerUps.speed) this.baseSpeed *= (1 + initialPowerUps.speed * 0.05);

    this.hp = this.maxHp;
    this.speed = this.baseSpeed;
  }

  update(dt: number, input: InputManager): boolean {
    // Invulnerability timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
    }

    // Health recovery
    if (this.recoveryPerSec > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.recoveryPerSec * dt);
    }

    // Movement
    const dx = input.dx;
    const dy = input.dy;
    this.isMoving = Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05;

    if (this.isMoving) {
      this.x += dx * this.speed * dt;
      this.y += dy * this.speed * dt;
      this.facingX = input.facingX;
      this.facingY = input.facingY;
      this.walkAnimTimer += dt * 10;
    } else {
      this.walkAnimTimer = 0;
    }

    return this.hp > 0;
  }

  takeDamage(amount: number): boolean {
    if (this.invulnerableTimer > 0) return false;

    const reducedAmount = Math.max(1, amount - this.armor);
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

  addXp(amount: number): boolean {
    this.xp += amount * this.xpMultiplier;
    if (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level += 1;
      this.xpToNextLevel = Math.floor(12 * Math.pow(1.28, this.level - 1));
      return true; // Level up!
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const screen = camera.worldToScreen(this.x, this.y);

    // Flash white/transparent when invulnerable
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Walking bounce
    const bob = Math.sin(this.walkAnimTimer) * 3;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Facing direction flip
    const flip = this.facingX < 0 ? -1 : 1;
    ctx.scale(flip, 1);

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

    ctx.restore();
    ctx.globalAlpha = 1.0;

    // HP Bar above player
    const barWidth = 36;
    const barHeight = 5;
    const barX = screen.x - barWidth / 2;
    const barY = screen.y - 30;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpPercent = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}
