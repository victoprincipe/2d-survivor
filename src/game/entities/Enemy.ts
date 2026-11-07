import { EnemyType } from '../types';
import { Camera } from '../engine/Camera';
import { Player } from './Player';

export class Enemy {
  public id: number;
  public type: EnemyType;
  public x: number;
  public y: number;
  public radius: number = 14;

  public maxHp: number;
  public hp: number;
  public speed: number;
  public damage: number;
  public xpValue: number;

  public knockbackX: number = 0;
  public knockbackY: number = 0;
  public hitFlashTimer: number = 0;
  public animTimer: number = Math.random() * 10;
  public isBoss: boolean = false;
  public isElite: boolean = false;
  public isFinalBoss: boolean = false;
  public name: string = '';

  // Signature attacks for elites and bosses
  public specialKind: 'none' | 'nova' | 'summon' | 'charge' = 'none';
  public specialTimer: number = 0;
  public specialRadius: number = 0;
  public specialDamage: number = 0;
  public specialColor: string = '#ef4444';
  private specialCooldown: number = 0;
  private specialReady: boolean = false;
  private chargeTimer: number = 0;
  private chargeDirX: number = 0;
  private chargeDirY: number = 0;

  constructor(id: number, type: EnemyType, x: number, y: number, hpMultiplier: number = 1.0) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;

    switch (type) {
      case 'bat':
        this.name = 'Morcego Carniceiro';
        this.radius = 12;
        this.maxHp = Math.round(15 * hpMultiplier);
        this.speed = 135;
        this.damage = 8;
        this.xpValue = 5;
        break;
      case 'skeleton':
        this.name = 'Esqueleto Guerreiro';
        this.radius = 15;
        this.maxHp = Math.round(35 * hpMultiplier);
        this.speed = 70;
        this.damage = 12;
        this.xpValue = 10;
        break;
      case 'zombie':
        this.name = 'Zumbi Decomposto';
        this.radius = 17;
        this.maxHp = Math.round(80 * hpMultiplier);
        this.speed = 45;
        this.damage = 18;
        this.xpValue = 20;
        break;
      case 'ghost':
        this.name = 'Espectro Noturno';
        this.radius = 16;
        this.maxHp = Math.round(60 * hpMultiplier);
        this.speed = 65;
        this.damage = 14;
        this.xpValue = 15;
        break;
      case 'elite_minotaur':
        this.name = 'Minotauro Elite';
        this.radius = 28;
        this.maxHp = Math.round(550 * hpMultiplier);
        this.speed = 85;
        this.damage = 25;
        this.xpValue = 150;
        this.isElite = true;
        this.specialKind = 'charge';
        this.specialCooldown = 6;
        this.specialDamage = 16;
        this.specialColor = '#f97316';
        break;
      case 'elite_banshee':
        this.name = 'Banshee Elite';
        this.radius = 22;
        this.maxHp = Math.round(430 * hpMultiplier);
        this.speed = 62;
        this.damage = 18;
        this.xpValue = 140;
        this.isElite = true;
        this.specialKind = 'nova';
        this.specialCooldown = 4.5;
        this.specialRadius = 190;
        this.specialDamage = 15;
        this.specialColor = '#93c5fd';
        break;
      case 'miniboss_golem':
        this.name = 'Golem Ancestral (Mini-Chefe)';
        this.radius = 30;
        this.maxHp = Math.round(1150 * hpMultiplier);
        this.speed = 52;
        this.damage = 26;
        this.xpValue = 320;
        this.isElite = true;
        this.specialKind = 'nova';
        this.specialCooldown = 5;
        this.specialRadius = 155;
        this.specialDamage = 22;
        this.specialColor = '#f59e0b';
        break;
      case 'boss_necromancer':
        this.name = 'Necromante do Véu';
        this.radius = 34;
        this.maxHp = Math.round(1850 * hpMultiplier);
        this.speed = 78;
        this.damage = 30;
        this.xpValue = 420;
        this.isBoss = true;
        this.specialKind = 'summon';
        this.specialCooldown = 5;
        this.specialColor = '#a855f7';
        break;
      case 'boss_vampire':
        this.name = 'Lorde Carmesim (Chefe Final)';
        this.radius = 36;
        this.maxHp = Math.round(2400 * hpMultiplier);
        this.speed = 95;
        this.damage = 35;
        this.xpValue = 500;
        this.isBoss = true;
        this.isFinalBoss = true;
        this.specialKind = 'nova';
        this.specialCooldown = 5.5;
        this.specialRadius = 175;
        this.specialDamage = 28;
        this.specialColor = '#ef4444';
        break;
    }

    this.specialTimer = this.specialCooldown > 0 ? this.specialCooldown * 0.65 : 0;

    // Reduce all monster movement speed by 10%
    this.speed *= 0.9;

    this.hp = this.maxHp;
  }

  update(dt: number, player: Player, separation: { vx: number; vy: number }): boolean {
    this.animTimer += dt * 8;

    // Hit flash decay
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    // Signature attack timers
    if (this.specialCooldown > 0) {
      this.specialTimer -= dt;
      if (this.specialTimer <= 0) {
        this.specialTimer = this.specialCooldown;
        if (this.specialKind === 'charge') {
          const cdx = player.x - this.x;
          const cdy = player.y - this.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);
          if (cdist > 0) {
            this.chargeDirX = cdx / cdist;
            this.chargeDirY = cdy / cdist;
            this.chargeTimer = 0.7;
          }
        } else {
          this.specialReady = true;
        }
      }
    }

    if (this.chargeTimer > 0) {
      this.chargeTimer -= dt;
      this.x += this.chargeDirX * this.speed * 2.4 * dt;
      this.y += this.chargeDirY * this.speed * 2.4 * dt;
    }

    // Knockback decay
    this.x += this.knockbackX * dt;
    this.y += this.knockbackY * dt;
    this.knockbackX *= Math.pow(0.05, dt);
    this.knockbackY *= Math.pow(0.05, dt);

    // Follow player direction
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      let vx = (dx / dist) * this.speed;
      let vy = (dy / dist) * this.speed;

      // Add separation force from flocking
      vx += separation.vx * this.speed * 0.8;
      vy += separation.vy * this.speed * 0.8;

      // Special ghost waving movement
      if (this.type === 'ghost') {
        const perpX = -dy / dist;
        const perpY = dx / dist;
        const wave = Math.sin(this.animTimer * 1.5) * 40;
        vx += perpX * wave;
        vy += perpY * wave;
      }

      this.x += vx * dt;
      this.y += vy * dt;
    }

    return this.hp > 0;
  }

  takeDamage(amount: number, knockX: number = 0, knockY: number = 0, knockForce: number = 200): boolean {
    if (this.hp <= 0) return false;

    this.hp -= amount;
    this.hitFlashTimer = 0.12;

    // Apply knockback (elites and bosses have heavy resistance)
    const resistance = this.isBoss ? 0.08 : this.isElite ? 0.35 : 1.0;
    this.knockbackX += knockX * knockForce * resistance;
    this.knockbackY += knockY * knockForce * resistance;

    if (this.hp <= 0) {
      this.hp = 0;
      return true;
    }

    return false;
  }

  consumeSpecial(): { kind: 'nova' | 'summon'; radius: number; damage: number; color: string } | null {
    if (!this.specialReady) return null;
    const kind = this.specialKind;
    if (kind !== 'nova' && kind !== 'summon') return null;
    this.specialReady = false;
    return {
      kind,
      radius: this.specialRadius,
      damage: this.specialDamage,
      color: this.specialColor,
    };
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!camera.isInView(this.x, this.y, 60)) return;

    const screen = camera.worldToScreen(this.x, this.y);
    const flip = this.x > camera.x ? -1 : 1;

    ctx.save();
    ctx.translate(screen.x, screen.y);

    // Hit flash white
    const isFlashing = this.hitFlashTimer > 0;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.9, this.radius, this.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.scale(flip, 1);

    if (isFlashing) {
      ctx.fillStyle = '#ffffff';
    }

    if (this.type === 'bat') {
      const wingFlap = Math.sin(this.animTimer) * 10;
      if (!isFlashing) ctx.fillStyle = '#6b21a8';
      // Body
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      // Wings
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-15, -6 + wingFlap);
      ctx.lineTo(-6, 2);
      ctx.moveTo(0, 0);
      ctx.lineTo(15, -6 + wingFlap);
      ctx.lineTo(6, 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-2, -2, 2, 2);
      ctx.fillRect(2, -2, 2, 2);
    } else if (this.type === 'skeleton') {
      if (!isFlashing) ctx.fillStyle = '#e2e8f0';
      // Skull
      ctx.beginPath();
      ctx.arc(0, -6, 9, 0, Math.PI * 2);
      ctx.fill();
      // Ribs / Spine
      ctx.fillRect(-6, 3, 12, 10);
      // Eye sockets
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-4, -8, 3, 3);
      ctx.fillRect(2, -8, 3, 3);
    } else if (this.type === 'zombie') {
      if (!isFlashing) ctx.fillStyle = '#4d7c0f';
      // Body
      ctx.beginPath();
      ctx.roundRect(-9, -10, 18, 22, 4);
      ctx.fill();
      // Tattered clothes
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(-9, 4, 18, 8);
      // Yellow eyes
      ctx.fillStyle = '#fde047';
      ctx.fillRect(1, -7, 3, 3);
    } else if (this.type === 'ghost') {
      ctx.globalAlpha = 0.75;
      if (!isFlashing) ctx.fillStyle = '#93c5fd';
      ctx.beginPath();
      ctx.arc(0, -6, 11, Math.PI, 0);
      ctx.lineTo(11, 8);
      ctx.lineTo(5, 4);
      ctx.lineTo(0, 8);
      ctx.lineTo(-5, 4);
      ctx.lineTo(-11, 8);
      ctx.closePath();
      ctx.fill();
      // Hollow eyes
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.arc(-3, -5, 2.5, 0, Math.PI * 2);
      ctx.arc(3, -5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    } else if (this.type === 'elite_banshee') {
      if (!isFlashing) {
        const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, 34);
        aura.addColorStop(0, 'rgba(147, 197, 253, 0.35)');
        aura.addColorStop(1, 'rgba(147, 197, 253, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#bfdbfe';
      }
      ctx.beginPath();
      ctx.arc(0, -8, 13, Math.PI, 0);
      ctx.lineTo(13, 10);
      ctx.lineTo(6, 5);
      ctx.lineTo(0, 10);
      ctx.lineTo(-6, 5);
      ctx.lineTo(-13, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.arc(-4, -7, 3, 0, Math.PI * 2);
      ctx.arc(4, -7, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'miniboss_golem') {
      if (!isFlashing) ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.roundRect(-25, -22, 50, 46, 8);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#78716c';
      ctx.fillRect(-20, -16, 40, 12);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'boss_necromancer') {
      if (!isFlashing) {
        const aura = ctx.createRadialGradient(0, 0, 8, 0, 0, 42);
        aura.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
        aura.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e1065';
      }
      ctx.beginPath();
      ctx.roundRect(-22, -18, 44, 44, 9);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#4c1d95';
      ctx.beginPath();
      ctx.arc(0, -2, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9d5ff';
      ctx.beginPath();
      ctx.arc(-5, -3, 3, 0, Math.PI * 2);
      ctx.arc(5, -3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, 14);
      ctx.lineTo(0, 8);
      ctx.lineTo(14, 14);
      ctx.stroke();
    } else if (this.type === 'elite_minotaur') {
      if (!isFlashing) ctx.fillStyle = '#991b1b';
      // Massive body
      ctx.beginPath();
      ctx.roundRect(-22, -18, 44, 40, 8);
      ctx.fill();
      // Horns
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-16, -18);
      ctx.quadraticCurveTo(-28, -32, -18, -36);
      ctx.lineTo(-12, -22);
      ctx.moveTo(16, -18);
      ctx.quadraticCurveTo(28, -32, 18, -36);
      ctx.lineTo(12, -22);
      ctx.fill();
      // Glowing red eyes
      ctx.fillStyle = '#f87171';
      ctx.fillRect(-6, -12, 4, 4);
      ctx.fillRect(4, -12, 4, 4);
    } else if (this.type === 'boss_vampire') {
      // Crimson Vampire Lord
      if (!isFlashing) {
        // Red glowing aura
        const aura = ctx.createRadialGradient(0, 0, 10, 0, 0, 45);
        aura.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        aura.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#450a0a';
      }
      // Vampire Cape & Body
      ctx.beginPath();
      ctx.roundRect(-24, -20, 48, 46, 10);
      ctx.fill();
      // Gold trim
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-24, 0, 48, 4);
      // Vampire face
      ctx.fillStyle = '#fce7f3';
      ctx.beginPath();
      ctx.arc(0, -22, 14, 0, Math.PI * 2);
      ctx.fill();
      // Crimson Eyes & Fangs
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-5, -24, 4, 3);
      ctx.fillRect(3, -24, 4, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, -16, 2, 3);
      ctx.fillRect(2, -16, 2, 3);
    }

    if (this.specialKind === 'nova' && this.specialRadius > 0 && this.specialTimer > 0 && this.specialTimer < 0.9) {
      const pulse = 0.35 + (0.9 - this.specialTimer) * 0.5;
      ctx.globalAlpha = Math.min(0.8, pulse);
      ctx.strokeStyle = this.specialColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.specialRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Health bar for Elites and Bosses
    if (this.isElite || this.isBoss) {
      const barW = this.isBoss ? 62 : 44;
      const barH = 5;
      const barX = screen.x - barW / 2;
      const barY = screen.y - this.radius - 12;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = this.isBoss ? '#ef4444' : this.isElite ? '#eab308' : '#ef4444';
      ctx.fillRect(barX, barY, barW * Math.max(0, this.hp / this.maxHp), barH);
    }
  }
}
