import { Camera } from '../engine/Camera';
import { ChallengeBoss } from './ChallengeBoss';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { KOPENAWAS } from '../data/kopenawa';

interface FigureOptions {
  alpha?: number;
  facing?: number;
  attack?: boolean;
  jumpOffset?: number;
}

/**
 * Shared sage figure used by Kopenawa and his herbal-miracle clones. The
 * sprite is the old cave guardian artwork, now only a combat visual.
 */
function drawKopenawaFigure(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  x: number,
  y: number,
  sprite: HTMLImageElement,
  time: number,
  options: FigureOptions = {}
): void {
  if (!camera.isInView(x, y, 180)) return;
  const screen = camera.worldToScreen(x, y);
  const alpha = options.alpha ?? 1;
  const facing = options.facing ?? 1;
  const jump = options.jumpOffset ?? 0;
  const bob = Math.sin(time * 2) * 1.3;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 4, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(screen.x, screen.y + jump);
  ctx.scale(facing, 1);
  if (options.attack) ctx.rotate(Math.sin(time * 18) * 0.06);

  if (sprite.complete && sprite.naturalWidth > 0) {
    const height = 108 * (1 + Math.sin(time * 2) * 0.006);
    const width = height * sprite.naturalWidth / sprite.naturalHeight;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sprite, -width * 0.44, 4 - height * 0.97, width, height);
    ctx.restore();
    return;
  }

  ctx.translate(0, bob);
  ctx.strokeStyle = '#70492d';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(28, 4); ctx.lineTo(31, -76); ctx.lineTo(23, -84); ctx.stroke();
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(19, -80, 7, 10);
  ctx.fillStyle = '#3f493b';
  ctx.beginPath(); ctx.moveTo(-15, -48); ctx.lineTo(-29, -24); ctx.lineTo(-17, -19);
  ctx.lineTo(-22, 3); ctx.lineTo(-10, 0); ctx.lineTo(-3, 5); ctx.lineTo(5, 1);
  ctx.lineTo(18, 4); ctx.lineTo(15, -24); ctx.lineTo(29, -29); ctx.lineTo(18, -47); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#a38b5b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-15, -22); ctx.lineTo(14, -22); ctx.stroke();
  ctx.fillStyle = '#b8b4a3';
  ctx.beginPath(); ctx.ellipse(0, -59, 20, 24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#bb906d';
  ctx.beginPath(); ctx.ellipse(0, -59, 12, 17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#dad5c2';
  ctx.beginPath(); ctx.moveTo(-13, -56); ctx.lineTo(-14, -35); ctx.lineTo(-5, -16);
  ctx.lineTo(1, -24); ctx.lineTo(7, -18); ctx.lineTo(15, -40); ctx.lineTo(12, -56); ctx.lineTo(0, -48); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#292524'; ctx.fillRect(-8, -62, 4, 3); ctx.fillRect(4, -62, 4, 3);
  ctx.strokeStyle = '#e5decd'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-11, -66); ctx.lineTo(-3, -64); ctx.moveTo(3, -64); ctx.lineTo(11, -66); ctx.stroke();
  ctx.restore();
}

function kopenawaBreathHits(
  x: number,
  y: number,
  breathAngle: number,
  player: { x: number; y: number; radius: number }
): boolean {
  const dx = player.x - x;
  const dy = player.y - y;
  if (Math.hypot(dx, dy) > KOPENAWAS.breath.range + player.radius) return false;
  const angle = Math.atan2(dy, dx);
  const difference = Math.abs(Math.atan2(
    Math.sin(angle - breathAngle),
    Math.cos(angle - breathAngle)
  ));
  return difference <= KOPENAWAS.breath.halfAngle;
}

function drawKopenawaBreathCone(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  x: number,
  y: number,
  breathAngle: number,
  phase: 'none' | 'warning' | 'active',
  timer: number,
  attackSpeed: number
): void {
  if (phase === 'none') return;
  const origin = camera.worldToScreen(x, y - 48);
  const active = phase === 'active';
  const duration = KOPENAWAS.breath.duration / attackSpeed;
  const progress = active ? 1 - timer / duration : 0;
  const reach = active
    ? KOPENAWAS.breath.range * (0.35 + 0.65 * progress)
    : KOPENAWAS.breath.range * 0.35;
  const start = breathAngle - KOPENAWAS.breath.halfAngle;
  const end = breathAngle + KOPENAWAS.breath.halfAngle;
  ctx.save();
  ctx.fillStyle = active ? 'rgba(168, 85, 247, 0.18)' : 'rgba(148, 163, 184, 0.10)';
  ctx.strokeStyle = active ? 'rgba(196, 181, 253, 0.75)' : 'rgba(203, 213, 225, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.arc(origin.x, origin.y, reach, start, end);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (active) {
    for (let i = 0; i < 10; i++) {
      const angle = start + ((i + 0.5) / 10) * (end - start);
      const distance = reach * (0.25 + (i % 5) * 0.14);
      const px = origin.x + Math.cos(angle) * distance;
      const py = origin.y + Math.sin(angle) * distance;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(167, 139, 250, 0.42)' : 'rgba(214, 211, 209, 0.36)';
      ctx.beginPath();
      ctx.arc(px, py, 5 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export class KopenawaBoss extends ChallengeBoss {
  private readonly sprite: HTMLImageElement;
  private time = 0;
  private facing = 1;
  private animation: 'idle' | 'walk' | 'slam' | 'attack' | 'smoke' = 'idle';
  private entrancePhase: 'slam' | 'none' = 'slam';
  private entranceTimer = KOPENAWAS.entrance.slamWindup + KOPENAWAS.entrance.slamRecovery;
  private entranceSlammed = false;
  public pendingArenaSlam = false;

  private readonly attackSpeed = KOPENAWAS.attackSpeedMultiplier;
  private breathPhase: 'none' | 'warning' | 'active' = 'none';
  private breathTimer = 0;
  private breathCooldown = 2.2 / KOPENAWAS.attackSpeedMultiplier;
  public breathAngle = 0;
  public pendingBreathHit = false;

  // Kopenawa's offensive magic: a homing projectile that damages the hero and
  // scrambles one movement command on impact.
  private spiritBoltCooldown: number =
    KOPENAWAS.spiritBolt.initialCooldown / KOPENAWAS.attackSpeedMultiplier;
  public pendingSpiritBolt = false;

  private smokeTriggered = false;
  private smokeTimer = 0;
  public pendingClones = 0;

  public get isInEntrance(): boolean {
    return this.entrancePhase !== 'none';
  }

  public get isInSmoke(): boolean {
    return this.smokeTimer > 0;
  }

  constructor(id: number, x: number, y: number, hpMultiplier: number) {
    super(id, 'boss_kopenawa', x, y, hpMultiplier);
    this.name = 'Kopenawa — Guardião da Floresta Ilusória';
    this.maxHp = Math.round(KOPENAWAS.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.speed = KOPENAWAS.speed;
    this.damage = KOPENAWAS.damage;
    this.radius = KOPENAWAS.radius;
    this.xpValue = KOPENAWAS.xpValue;
    this.isBoss = true;
    this.knockbackResistance = 0.05;
    // The inherited elite skill loop is disarmed; Kopenawa has a bespoke AI.
    this.skillCooldown = Number.MAX_SAFE_INTEGER;
    this.sprite = new Image();
    this.sprite.src = '/sprites/quiz-keeper/idle.png';
  }

  override computeDamageTaken(rawAmount: number, playerDebuffBonus: number = 0): number {
    if (this.isInSmoke) return 0;
    return super.computeDamageTaken(rawAmount, playerDebuffBonus);
  }

  override takeDamage(amount: number, knockX: number = 0, knockY: number = 0, knockForce: number = 200): boolean {
    if (this.isInSmoke) return false;
    return super.takeDamage(amount, knockX, knockY, knockForce);
  }

  public breathHits(player: { x: number; y: number; radius: number }): boolean {
    return kopenawaBreathHits(this.x, this.y, this.breathAngle, player);
  }

  private updateEntrance(dt: number, player: Player): boolean {
    this.animation = 'slam';
    this.entranceTimer = Math.max(0, this.entranceTimer - dt);
    if (Math.abs(player.x - this.x) > 1) this.facing = player.x < this.x ? -1 : 1;
    // The root wall rises on the very first combat frame while the staff hits
    // the ground, sealing the arena immediately.
    if (!this.entranceSlammed) {
      this.entranceSlammed = true;
      this.pendingArenaSlam = true;
    }
    if (this.entranceTimer === 0) {
      this.entrancePhase = 'none';
      this.animation = 'idle';
      this.breathCooldown = 1.2 / this.attackSpeed;
    }
    return true;
  }

  override update(dt: number, player: Player, separation: { vx: number; vy: number }): boolean {
    this.time += dt;
    if (this.hp <= 0) {
      this.pendingArenaSlam = false;
      this.pendingBreathHit = false;
      this.pendingSpiritBolt = false;
      this.pendingClones = 0;
      return false;
    }

    if (this.smokeTimer > 0) {
      this.animation = 'smoke';
      this.smokeTimer = Math.max(0, this.smokeTimer - dt);
      return true;
    }

    // At half health Kopenawa becomes smoke and calls two illusory duplicates.
    if (!this.smokeTriggered && this.hp <= this.maxHp * KOPENAWAS.smoke.threshold) {
      this.smokeTriggered = true;
      this.smokeTimer = KOPENAWAS.smoke.invulnerable;
      this.pendingClones = KOPENAWAS.smoke.cloneCount;
      this.breathPhase = 'none';
      this.animation = 'smoke';
      return true;
    }

    if (this.entrancePhase !== 'none') return this.updateEntrance(dt, player);

    this.breathCooldown = Math.max(0, this.breathCooldown - dt);
    this.spiritBoltCooldown = Math.max(0, this.spiritBoltCooldown - dt);

    if (this.breathPhase === 'warning') {
      this.animation = 'attack';
      this.breathTimer = Math.max(0, this.breathTimer - dt);
      if (Math.abs(player.x - this.x) > 1) this.facing = player.x < this.x ? -1 : 1;
      if (this.breathTimer === 0) {
        this.breathPhase = 'active';
        this.breathTimer = KOPENAWAS.breath.duration / this.attackSpeed;
        this.pendingBreathHit = true;
      }
      return true;
    }

    if (this.breathPhase === 'active') {
      this.animation = 'attack';
      this.breathTimer = Math.max(0, this.breathTimer - dt);
      if (this.breathTimer === 0) {
        this.breathPhase = 'none';
        this.breathCooldown = KOPENAWAS.breath.cooldown / this.attackSpeed;
      }
      return true;
    }

    // Offensive magic may fire between breaths, never during the warning or
    // active cone; this leaves the existing breath rhythm untouched.
    if (this.spiritBoltCooldown === 0) {
      this.spiritBoltCooldown = KOPENAWAS.spiritBolt.cooldown / this.attackSpeed;
      this.pendingSpiritBolt = true;
      this.animation = 'attack';
      if (Math.abs(player.x - this.x) > 1) this.facing = player.x < this.x ? -1 : 1;
      return true;
    }

    if (this.breathCooldown === 0) {
      this.breathPhase = 'warning';
      this.breathTimer = KOPENAWAS.breath.warning / this.attackSpeed;
      this.breathAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.animation = 'attack';
      return true;
    }

    const previousX = this.x;
    const previousY = this.y;
    const alive = super.update(dt, player, separation);
    if (!alive) return false;
    const distance = Math.hypot(this.x - previousX, this.y - previousY);
    this.animation = distance > 0.05 ? 'walk' : 'idle';
    if (Math.abs(player.x - this.x) > 12) this.facing = player.x < this.x ? -1 : 1;
    return true;
  }

  private renderBreath(ctx: CanvasRenderingContext2D, camera: Camera): void {
    drawKopenawaBreathCone(
      ctx,
      camera,
      this.x,
      this.y,
      this.breathAngle,
      this.breathPhase,
      this.breathTimer,
      this.attackSpeed
    );
  }

  private renderSmoke(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const origin = camera.worldToScreen(this.x, this.y - 54);
    const progress = 1 - this.smokeTimer / KOPENAWAS.smoke.invulnerable;
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + this.time * 0.7;
      const distance = 22 + (i % 4) * 17 + progress * 12;
      const px = origin.x + Math.cos(angle) * distance;
      const py = origin.y + Math.sin(angle) * distance * 0.72;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(139, 92, 246, 0.26)' : 'rgba(214, 211, 209, 0.24)';
      ctx.beginPath();
      ctx.arc(px, py, 15 + (i % 4) * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  override render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    this.renderBreath(ctx, camera);
    if (this.isInSmoke) {
      this.renderSmoke(ctx, camera);
      return;
    }
    drawKopenawaFigure(ctx, camera, this.x, this.y, this.sprite, this.time, {
      facing: this.facing,
      attack: this.animation === 'attack' || this.animation === 'slam',
    });
  }
}

/**
 * A smoke illusion that inherits 70% of Kopenawa's combat stats and attacks.
 * It shares his breath cone and spirit bolt, but never summons further clones.
 */
export class KopenawaClone extends Enemy {
  private readonly sprite: HTMLImageElement;
  private readonly attackSpeed: number;
  private time = Math.random() * 5;
  private facing = 1;
  private attackTimer = 1.5 + Math.random() * 2;
  private attackFlash = 0;

  private breathPhase: 'none' | 'warning' | 'active' = 'none';
  private breathTimer = 0;
  private breathCooldown: number;
  public breathAngle = 0;
  public pendingBreathHit = false;

  private spiritBoltCooldown: number;
  public pendingSpiritBolt = false;

  constructor(id: number, x: number, y: number, source: KopenawaBoss) {
    super(id, 'boss_kopenawa', x, y, 1);
    const inheritance = KOPENAWAS.cloneStatMultiplier;
    this.name = 'Ilusão de Kopenawa';
    this.maxHp = Math.max(1, Math.round(source.maxHp * inheritance));
    this.hp = this.maxHp;
    this.speed = source.speed * inheritance;
    this.damage = Math.max(1, Math.round(source.damage * inheritance));
    this.radius = Math.max(1, Math.round(source.radius * inheritance));
    this.xpValue = 0;
    this.isBoss = false;
    this.isElite = false;
    this.knockbackResistance = source.knockbackResistance * inheritance;
    this.skillCooldown = Number.MAX_SAFE_INTEGER;
    // Clones inherit 70% of the boss's 3x attack cadence (2.1x base speed).
    this.attackSpeed = KOPENAWAS.attackSpeedMultiplier * inheritance;
    this.breathCooldown = 2.2 / this.attackSpeed;
    this.spiritBoltCooldown = KOPENAWAS.spiritBolt.initialCooldown / this.attackSpeed;
    this.sprite = new Image();
    this.sprite.src = '/sprites/quiz-keeper/idle.png';
  }

  public breathHits(player: { x: number; y: number; radius: number }): boolean {
    return kopenawaBreathHits(this.x, this.y, this.breathAngle, player);
  }

  override update(dt: number, player: Player, separation: { vx: number; vy: number }): boolean {
    this.time += dt;
    if (this.hp <= 0) {
      this.pendingBreathHit = false;
      this.pendingSpiritBolt = false;
      return false;
    }

    this.attackFlash = Math.max(0, this.attackFlash - dt);
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = 2.1 + Math.random() * 2.4;
      this.attackFlash = 0.45;
    }

    this.breathCooldown = Math.max(0, this.breathCooldown - dt);
    this.spiritBoltCooldown = Math.max(0, this.spiritBoltCooldown - dt);

    if (this.breathPhase === 'warning') {
      this.breathTimer = Math.max(0, this.breathTimer - dt);
      if (Math.abs(player.x - this.x) > 1) this.facing = player.x < this.x ? -1 : 1;
      if (this.breathTimer === 0) {
        this.breathPhase = 'active';
        this.breathTimer = KOPENAWAS.breath.duration / this.attackSpeed;
        this.pendingBreathHit = true;
      }
      return true;
    }

    if (this.breathPhase === 'active') {
      this.breathTimer = Math.max(0, this.breathTimer - dt);
      if (this.breathTimer === 0) {
        this.breathPhase = 'none';
        this.breathCooldown = KOPENAWAS.breath.cooldown / this.attackSpeed;
      }
      return true;
    }

    if (this.spiritBoltCooldown === 0) {
      this.spiritBoltCooldown = KOPENAWAS.spiritBolt.cooldown / this.attackSpeed;
      this.pendingSpiritBolt = true;
      this.attackFlash = 0.45;
      if (Math.abs(player.x - this.x) > 1) this.facing = player.x < this.x ? -1 : 1;
      return true;
    }

    if (this.breathCooldown === 0) {
      this.breathPhase = 'warning';
      this.breathTimer = KOPENAWAS.breath.warning / this.attackSpeed;
      this.breathAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.attackFlash = 0.45;
      return true;
    }

    const alive = super.update(dt, player, separation);
    if (Math.abs(player.x - this.x) > 12) this.facing = player.x < this.x ? -1 : 1;
    return alive;
  }

  override render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    drawKopenawaBreathCone(
      ctx,
      camera,
      this.x,
      this.y,
      this.breathAngle,
      this.breathPhase,
      this.breathTimer,
      this.attackSpeed
    );
    const hop = Math.max(0, Math.sin(this.time * 3.4)) * 7;
    drawKopenawaFigure(ctx, camera, this.x, this.y, this.sprite, this.time, {
      alpha: 0.72,
      facing: this.facing,
      attack: this.attackFlash > 0 || this.breathPhase !== 'none',
      jumpOffset: -hop,
    });
  }
}
