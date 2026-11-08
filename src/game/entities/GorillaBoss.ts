import { Enemy } from './Enemy';
import { GorillaNpc } from './GorillaNpc';
import { Player } from './Player';
import { Camera } from '../engine/Camera';
import combat from '../../../public/sprites/boss-gorilla/combat-animations.json';
import { GORILLA_CHARGE, GORILLA_LEAP, GORILLA_SKILL_SPEED, GORILLA_ROAR } from '../data/gorilla';

export class GorillaBoss extends Enemy {
  private readonly visual = new GorillaNpc();
  private readonly combatSprite: HTMLImageElement;
  private facing = 1;
  private travelled = 0;
  private previousX: number;
  private previousY: number;
  private recoveryTime = 0;
  private readonly recoveryDuration = combat.slam.recoverySeconds / GORILLA_SKILL_SPEED;
  private leapCooldown = GORILLA_LEAP.cooldown;
  private leapPhase: 'none' | 'warning' | 'airborne' = 'none';
  private leapTimer = 0;
  private leapStartX = 0;
  private leapStartY = 0;
  private leapTargetX = 0;
  private leapTargetY = 0;
  private leapHeight = 0;
  private remainingLeaps = 0;
  private leapLanded = false;
  public pendingLeapImpact = false;
  public pendingLeapSound = false;
  private roarPhase: 'none' | 'warning' | 'active' = 'none';
  private roarCooldown = GORILLA_ROAR.cooldown;
  private roarTimer = 0;
  public pendingRoarStart = false;
  public pendingRoarHeal = 0;
  public pendingRoarTicks = 0;

  public get isRoaring(): boolean {
    return this.roarPhase !== 'none';
  }

  private updateRoar(dt: number, player: Player, separation: { vx: number; vy: number }): boolean {
    const x = this.x;
    const y = this.y;
    const cooldown = this.skillCooldown;
    this.skillCooldown = Number.MAX_SAFE_INTEGER;
    const alive = super.update(dt, player, separation);
    this.skillCooldown = cooldown;
    this.x = x;
    this.y = y;
    this.previousX = x;
    this.previousY = y;
    if (!alive) {
      this.pendingRoarTicks = 0;
      this.pendingRoarStart = false;
      this.roarPhase = 'none';
      return false;
    }
    const previousTimer = this.roarTimer;
    this.roarTimer = Math.max(0, this.roarTimer - dt);
    if (this.roarPhase === 'warning') {
      if (this.roarTimer === 0) {
        this.roarPhase = 'active';
        this.roarTimer = GORILLA_ROAR.duration;
        const previousHp = this.hp;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * GORILLA_ROAR.healFraction);
        this.pendingRoarHeal = this.hp - previousHp;
        this.pendingRoarStart = true;
      }
    } else {
      const tick = (timer: number) => Math.floor(GORILLA_ROAR.duration - timer + 1e-8);
      this.pendingRoarTicks += tick(this.roarTimer) - tick(previousTimer);
      if (this.roarTimer === 0) {
        this.roarPhase = 'none';
        this.roarCooldown = GORILLA_ROAR.cooldown;
      }
    }
    return true;
  }

  public get isLeaping(): boolean {
    return this.leapPhase === 'airborne';
  }

  public chargeHits(player: { x: number; y: number; radius: number }, fromX: number, fromY: number): boolean {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0
      ? Math.max(0, Math.min(1, ((player.x - fromX) * dx + (player.y - fromY) * dy) / lengthSquared)) : 0;
    return Math.hypot(player.x - fromX - t * dx, player.y - fromY - t * dy)
      < this.radius * GORILLA_CHARGE.widthMultiplier + player.radius;
  }

  private updateLeap(dt: number, player: Player, separation: { vx: number; vy: number }): boolean {
    const x = this.x;
    const y = this.y;
    const cooldown = this.skillCooldown;
    this.skillCooldown = Number.MAX_SAFE_INTEGER;
    const alive = super.update(dt, player, separation);
    this.skillCooldown = cooldown;
    this.x = x;
    this.y = y;
    if (!alive) {
      this.pendingLeapImpact = false;
      this.pendingLeapSound = false;
      return false;
    }
    this.leapTimer = Math.max(0, this.leapTimer - dt);
    if (this.leapPhase === 'warning') {
      if (this.leapTimer === 0) {
        this.leapPhase = 'airborne';
        this.pendingLeapSound = true;
        this.leapTimer = GORILLA_LEAP.flight;
      }
    } else {
      const progress = 1 - this.leapTimer / GORILLA_LEAP.flight;
      this.x = this.leapStartX + (this.leapTargetX - this.leapStartX) * progress;
      this.y = this.leapStartY + (this.leapTargetY - this.leapStartY) * progress;
      this.leapHeight = Math.sin(progress * Math.PI) * GORILLA_LEAP.height;
      if (this.leapTimer === 0) {
        this.leapPhase = 'none';
        this.leapHeight = 0;
        this.pendingLeapImpact = true;
        this.leapLanded = true;
        this.remainingLeaps--;
        this.leapCooldown = this.remainingLeaps > 0 ? 0 : GORILLA_LEAP.cooldown;
        this.recoveryTime = this.remainingLeaps > 0 ? 0 : this.recoveryDuration;
      }
    }
    this.previousX = this.x;
    this.previousY = this.y;
    this.animation = 'slam';
    return true;
  }
  private animation: 'idle' | 'walk' | 'run' | 'slam' | 'brace' = 'idle';

  constructor(id: number, x: number, y: number, hpMultiplier: number) {
    super(id, 'boss_gorilla', x, y, hpMultiplier);
    this.previousX = x;
    this.previousY = y;
    this.combatSprite = new Image();
    this.combatSprite.src = combat.image;
  }

  override update(dt: number, player: Player, separation: { vx: number; vy: number }): boolean {
    this.visual.update(dt);
    this.leapCooldown = Math.max(0, this.leapCooldown - dt);
    if (this.hp <= 0) {
      this.pendingLeapImpact = false;
      this.pendingLeapSound = false;
      this.pendingRoarTicks = 0;
      this.pendingRoarStart = false;
      this.roarPhase = 'none';
      return false;
    }
    if (this.isRoaring) return this.updateRoar(dt, player, separation);
    this.roarCooldown = Math.max(0, this.roarCooldown - dt);
    if (this.leapPhase !== 'none') return this.updateLeap(dt, player, separation);
    if (this.roarCooldown === 0 && this.remainingLeaps === 0 && this.skillState === 'idle' && this.recoveryTime === 0) {
      this.roarPhase = 'warning';
      this.roarTimer = GORILLA_ROAR.warning;
      return this.updateRoar(0, player, separation);
    }
    if (this.leapCooldown === 0 && this.skillState === 'idle' && this.recoveryTime === 0 &&
      (this.remainingLeaps > 0 || Math.hypot(player.x - this.x, player.y - this.y) <= GORILLA_LEAP.range)) {
      this.leapPhase = 'warning';
      this.leapLanded = false;
      if (this.remainingLeaps === 0) this.remainingLeaps = GORILLA_LEAP.jumpsPerCombo;
      this.leapTimer = GORILLA_LEAP.warning;
      this.leapStartX = this.x;
      this.leapStartY = this.y;
      // Lock the marker now: sidestepping the warning must evade the landing.
      this.leapTargetX = player.x;
      this.leapTargetY = player.y;
      if (Math.abs(player.x - this.x) > 1) this.facing = player.x < this.x ? -1 : 1;
      this.animation = 'slam';
      return this.updateLeap(0, player, separation);
    }
    // Sample the previous step AFTER the engine resolved terrain collisions.
    const distance = Math.hypot(this.x - this.previousX, this.y - this.previousY);
    const x = this.x;
    const y = this.y;
    this.previousX = x;
    this.previousY = y;
    const previousState = this.skillState;
    const recovering = this.recoveryTime > 0;
    this.recoveryTime = Math.max(0, this.recoveryTime - dt);
    const alive = super.update(dt, player, separation);
    if (!alive) return false;

    // Keep the attack origin still from warning through impact and recovery.
    if (this.skillState === 'telegraph_nova' || this.skillState === 'telegraph_dash' ||
      previousState === 'telegraph_nova' || recovering) {
      this.x = x;
      this.y = y;
    }
    if (previousState === 'telegraph_nova' && this.pendingNovaBurst) {
      this.recoveryTime = this.recoveryDuration;
    }
    if (this.skillState === 'dashing') {
      if (Math.abs(this.dashDirX) > 0.05) this.facing = this.dashDirX < 0 ? -1 : 1;
    } else if (this.recoveryTime === 0 && this.skillState !== 'telegraph_nova' && Math.abs(player.x - x) > 12) {
      this.facing = player.x < x ? -1 : 1;
    }

    const nextAnimation = this.skillState === 'telegraph_nova' || this.recoveryTime > 0 ? 'slam'
      : this.skillState === 'telegraph_dash' ? 'brace'
      : this.skillState === 'dashing' ? 'run'
      : distance > 0.05 ? 'walk' : 'idle';
    if (nextAnimation !== this.animation) this.travelled = 0;
    else this.travelled += distance;
    this.animation = nextAnimation;
    return true;
  }

  override render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.isRoaring) {
      const origin = camera.worldToScreen(this.x, this.y);
      ctx.save();
      ctx.fillStyle = this.roarPhase === 'warning' ? 'rgba(251,191,36,0.08)' : 'rgba(239,68,68,0.12)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, GORILLA_ROAR.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (this.roarPhase === 'active') {
        const pulse = (GORILLA_ROAR.duration - this.roarTimer) % 1;
        ctx.strokeStyle = `rgba(251,191,36,${1 - pulse})`;
        ctx.beginPath();
        ctx.arc(origin.x, origin.y, pulse * GORILLA_ROAR.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('GRITO!', origin.x, origin.y - 220);
      ctx.restore();
      this.visual.render(ctx, camera, this.x, this.y + 25, true, this.hitFlashTimer > 0);
      return;
    }
    if (this.leapPhase !== 'none') {
      const target = camera.worldToScreen(this.leapTargetX, this.leapTargetY);
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, GORILLA_LEAP.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef3c7';
      ctx.fillText('SALTO!', target.x, target.y - GORILLA_LEAP.radius - 10);
      ctx.restore();
    }
    if (!camera.isInView(this.x, this.y, 260)) return;
    const screen = camera.worldToScreen(this.x, this.y);
    ctx.save();
    if (this.skillState === 'telegraph_nova' || this.skillState === 'telegraph_dash') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (this.skillState === 'telegraph_nova') {
        ctx.arc(screen.x, screen.y, this.novaRadius, 0, Math.PI * 2);
      } else {
        ctx.moveTo(screen.x, screen.y);
        const reach = GORILLA_CHARGE.speed * GORILLA_CHARGE.duration;
        ctx.lineTo(screen.x + this.dashDirX * reach, screen.y + this.dashDirY * reach);
        ctx.lineWidth = this.radius * 2 * GORILLA_CHARGE.widthMultiplier;
        ctx.lineCap = 'round';
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    if (this.animation === 'idle' || !this.combatSprite.complete || this.combatSprite.naturalWidth === 0) {
      ctx.save();
      ctx.translate(screen.x, 0);
      ctx.scale(this.facing, 1);
      ctx.translate(-screen.x, 0);
      this.visual.render(ctx, camera, this.x, this.y + 25, false, this.hitFlashTimer > 0);
      ctx.restore();
      return;
    }
    const row = this.animation === 'slam' ? combat.slam
      : this.animation === 'walk' ? combat.walk : combat.run;
    let frame = 0;
    if (this.animation === 'slam') {
      frame = this.leapPhase === 'airborne' ? 2
        : this.leapPhase === 'warning' ? Math.min(2, Math.floor((1 - this.leapTimer / GORILLA_LEAP.warning) * 3))
        : this.leapLanded && this.remainingLeaps > 0 ? 4
        : this.recoveryTime > 0
        ? (this.recoveryTime > this.recoveryDuration / 2 ? 4 : 5)
        : Math.min(3, Math.floor((1 - this.skillStateTimer / this.skillDuration) * 4));
    } else if (this.animation !== 'brace') {
      const stride = this.animation === 'walk' ? combat.walk.stride : combat.run.stride;
      frame = Math.floor(this.travelled / stride * combat.frameCount) % combat.frameCount;
    }
    ctx.save();
    ctx.translate(screen.x, screen.y + 25);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 72, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(0, -this.leapHeight);
    ctx.scale(this.facing, 1);
    ctx.imageSmoothingEnabled = true;
    if (this.hitFlashTimer > 0) ctx.globalAlpha = 0.6;
    ctx.drawImage(this.combatSprite, frame * combat.frameWidth, row.sourceY,
      combat.frameWidth, row.height, -combat.frameWidth * combat.scale / 2,
      -row.baseline * combat.scale, combat.frameWidth * combat.scale, row.height * combat.scale);
    ctx.restore();
  }
}
