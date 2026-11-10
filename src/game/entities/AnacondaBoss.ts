import { ANACONDA as C } from '../data/anaconda';
import { Player } from './Player';
import { ChallengeBoss, sweptCircleHits } from './ChallengeBoss';
import { WorldSystem } from '../systems/WorldProps';
import { Camera } from '../engine/Camera';
import { AnacondaVisual } from './AnacondaVisual';
import { AcidRain } from './AcidRain';

export type AnacondaAction = 'idle' | 'bite_warning' | 'bite_extend' | 'bite_close' | 'bite_retract'
  | 'leap_warning' | 'leap_flight' | 'slam_warning' | 'recovery' | 'acid';

export class AnacondaBoss extends ChallengeBoss {
  readonly acid = new AcidRain();
  private readonly visual = new AnacondaVisual();
  public action: AnacondaAction = 'idle';
  private timer = 0;
  private biteCooldown = 2;
  private leapCooldown = C.leap.cooldown;
  private slamCooldown = C.slam.cooldown;
  private acidCooldown = C.acid.cooldown;
  private bitesLeft = 0;
  private leapsLeft = 0;
  private biteHit = false;
  private direction = { x: 1, y: 0 };
  private neckLength = 65;
  private neckLimit = C.bite.range;
  private previousHead = { x: 0, y: 0 };
  private biteSweep: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
  private leapStart = { x: 0, y: 0 };
  private leapTarget = { x: 0, y: 0 };
  private height = 0;
  private moved = false;
  public pendingLeapImpact = false;
  public pendingLeapSound = false;

  constructor(id: number, x: number, y: number, hpMultiplier: number, private readonly world: WorldSystem) {
    super(id, 'boss_anaconda', x, y, hpMultiplier);
    this.novaRadius = C.slam.radius;
  }
  get isLeaping(): boolean { return this.action === 'leap_flight'; }
  get head(): { x: number; y: number } {
    return { x: this.x + this.direction.x * this.neckLength, y: this.y - 40 + this.direction.y * this.neckLength };
  }
  get usesBiteRig(): boolean { return this.action.startsWith('bite_'); }
  get contactEnabled(): boolean { return this.action === 'idle'; }
  clearEffects(): void { this.acid.clear(); this.pendingLeapImpact = false; this.pendingLeapSound = false; this.pendingNovaBurst = false; this.biteSweep = null; }

  private beginBite(player: Player): void {
    const dx = player.x - this.x, dy = player.y - (this.y - 40), norm = Math.hypot(dx, dy) || 1;
    this.direction = { x: dx / norm, y: dy / norm };
    this.neckLength = 65;
    this.neckLimit = 65;
    for (let distance = 65; distance <= C.bite.range; distance += 5) {
      if (!this.world.isInUpperLake(this.x + this.direction.x * distance, this.y - 40 + this.direction.y * distance, C.bite.radius)) break;
      this.neckLimit = distance;
    }
    this.previousHead = this.head;
    this.biteHit = false; this.action = 'bite_warning'; this.timer = C.bite.warning;
  }
  private beginLeap(player: Player): void {
    this.leapStart = { x: this.x, y: this.y };
    this.leapTarget = this.world.resolveUpperLakeMovement(this.x, this.y, player.x, player.y, this.radius);
    this.action = 'leap_warning'; this.timer = C.leap.warning;
  }
  public consumeBiteHit(player: Player): boolean {
    const sweep = this.biteSweep; this.biteSweep = null;
    if (!sweep || this.biteHit || player.isJumping || player.godMode || player.invulnerableTimer > 0) return false;
    if (!sweptCircleHits(player, sweep.from, sweep.to, C.bite.radius)) return false;
    this.biteHit = true;
    return true;
  }

  override update(dt: number, player: Player, separation: { vx: number; vy: number }): boolean {
    this.visual.update(dt); this.biteSweep = null;
    if (this.hp <= 0) { this.clearEffects(); return false; }
    if (!this.updateAnchored(dt, player, separation)) { this.clearEffects(); return false; }
    this.acid.update(dt, player);
    if (this.acid.pendingHeal) {
      this.acid.pendingHeal = false;
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * C.acid.heal);
    }
    this.biteCooldown = Math.max(0, this.biteCooldown - dt);
    this.leapCooldown = Math.max(0, this.leapCooldown - dt);
    this.slamCooldown = Math.max(0, this.slamCooldown - dt);
    this.acidCooldown = Math.max(0, this.acidCooldown - dt);
    this.timer = Math.max(0, this.timer - dt);
    this.moved = false;

    if (this.action === 'acid') {
      if (!this.acid.casting) { this.action = 'idle'; this.acidCooldown = C.acid.cooldown; }
      return true;
    }
    if (this.action === 'bite_warning') {
      if (this.timer === 0) this.action = 'bite_extend';
    } else if (this.action === 'bite_extend') {
      this.previousHead = this.head;
      this.neckLength = Math.min(this.neckLimit, this.neckLength + C.bite.speed * dt);
      this.biteSweep = { from: this.previousHead, to: this.head };
      if (this.neckLength === this.neckLimit) { this.action = 'bite_close'; this.timer = 0.08; }
    } else if (this.action === 'bite_close') {
      this.biteSweep = { from: this.head, to: this.head };
      if (this.timer === 0) this.action = 'bite_retract';
    } else if (this.action === 'bite_retract') {
      this.neckLength = Math.max(65, this.neckLength - C.bite.speed * dt);
      if (this.neckLength === 65) {
        this.bitesLeft--;
        if (this.bitesLeft > 0) this.beginBite(player);
        else { this.action = 'idle'; this.biteCooldown = C.bite.cooldown; }
      }
    } else if (this.action === 'leap_warning') {
      if (this.timer === 0) { this.action = 'leap_flight'; this.timer = C.leap.flight; this.pendingLeapSound = true; }
    } else if (this.action === 'leap_flight') {
      const progress = 1 - this.timer / C.leap.flight;
      this.x = this.leapStart.x + (this.leapTarget.x - this.leapStart.x) * progress;
      this.y = this.leapStart.y + (this.leapTarget.y - this.leapStart.y) * progress;
      this.height = Math.sin(progress * Math.PI) * C.leap.height;
      if (this.timer === 0) {
        this.height = 0; this.pendingLeapImpact = true; this.leapsLeft--;
        if (this.leapsLeft > 0) this.beginLeap(player);
        else { this.leapCooldown = C.leap.cooldown; this.action = 'recovery'; this.timer = C.slam.recovery; }
      }
    } else if (this.action === 'slam_warning') {
      if (this.timer === 0) { this.pendingNovaBurst = true; this.slamCooldown = C.slam.cooldown; this.action = 'recovery'; this.timer = C.slam.recovery; }
    } else if (this.action === 'recovery') {
      if (this.timer === 0) this.action = 'idle';
    } else if (this.acidCooldown === 0) {
      this.action = 'acid'; this.acid.begin(this.x, this.y);
    } else if (this.leapCooldown === 0 && Math.hypot(player.x - this.x, player.y - this.y) <= C.leap.range) {
      this.leapsLeft = C.leap.count; this.beginLeap(player);
    } else if (this.slamCooldown === 0) {
      this.action = 'slam_warning'; this.timer = C.slam.warning;
    } else if (this.biteCooldown === 0 && Math.hypot(player.x - this.x, player.y - this.y) <= C.bite.range + player.radius) {
      this.bitesLeft = 2; this.beginBite(player);
    } else {
      const dx = player.x - this.x, dy = player.y - this.y, distance = Math.hypot(dx, dy);
      if (distance > this.radius + player.radius + 20) {
        const speed = this.speed * (this.slowTimer > 0 ? Math.max(0.35, 1 - this.slowFactor) : 1);
        const target = this.world.resolveUpperLakeMovement(this.x, this.y, this.x + dx / distance * speed * dt, this.y + dy / distance * speed * dt, this.radius);
        this.moved = Math.hypot(target.x - this.x, target.y - this.y) > 0.01;
        this.x = target.x; this.y = target.y;
      }
    }
    return true;
  }

  override render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const p = camera.worldToScreen(this.x, this.y);
    ctx.save(); ctx.strokeStyle = '#fde68a'; ctx.fillStyle = 'rgba(239,68,68,0.18)'; ctx.lineWidth = 3;
    if (this.action === 'bite_warning') {
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 40);
      ctx.lineTo(p.x + this.direction.x * this.neckLimit, p.y - 40 + this.direction.y * this.neckLimit);
      ctx.strokeStyle = 'rgba(251,191,36,0.3)'; ctx.lineWidth = C.bite.radius * 2; ctx.lineCap = 'round'; ctx.stroke();
    }
    if (this.action === 'leap_warning' || this.isLeaping) {
      const target = camera.worldToScreen(this.leapTarget.x, this.leapTarget.y);
      ctx.beginPath(); ctx.arc(target.x, target.y, C.leap.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (this.action === 'slam_warning') { ctx.beginPath(); ctx.arc(p.x, p.y, this.novaRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    // Water shadow stays on the surface while the snake rises above it.
    ctx.fillStyle = 'rgba(4,47,46,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 20, 110, 35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (this.usesBiteRig) this.visual.renderRig(ctx, camera, this.x, this.y, this.head, this.action === 'bite_extend', this.hitFlashTimer > 0);
    else this.visual.render(ctx, camera, this.x, this.y,
      this.action === 'slam_warning' || this.action === 'acid' ? 'bite' : this.moved ? 'slither' : 'idle', this.height, this.hitFlashTimer > 0);
  }
}
