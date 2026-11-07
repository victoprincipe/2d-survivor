import { EnemyType, WeaponId } from '../types';
import { Camera } from '../engine/Camera';
import { Player } from './Player';

export type BossOrEliteState =
  | 'idle'
  | 'telegraph_dash'
  | 'dashing'
  | 'telegraph_nova'
  | 'telegraph_summon';

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
  public knockbackResistance: number = 1.0;

  public knockbackX: number = 0;
  public knockbackY: number = 0;
  public hitFlashTimer: number = 0;
  public animTimer: number = Math.random() * 10;
  public isBoss: boolean = false;
  public isElite: boolean = false;
  public name: string = '';
  private spriteImage: HTMLImageElement | null = null;

  // Combat Status & Debuffs
  public slowTimer: number = 0;
  public slowFactor: number = 0;
  public vulnerableTimer: number = 0;
  public vulnerableBonus: number = 0;
  public poisonTimer: number = 0;
  public poisonDps: number = 0;
  public poisonSourceWeapon: WeaponId | null = null;
  public isContagious: boolean = false;
  public bleedTimer: number = 0;
  public bleedDps: number = 0;
  public bleedSourceWeapon: WeaponId | null = null;
  public dotTickTimer: number = 0.5;
  public soulEaterMarkTimer: number = 0;

  // Elite / Boss Special Skill State
  public skillCooldown: number = 4.5;
  public skillState: BossOrEliteState = 'idle';
  public skillStateTimer: number = 0;
  public skillDuration: number = 0.75;
  public bossSkillIndex: number = 0;
  public dashDirX: number = 0;
  public dashDirY: number = 0;
  public novaRadius: number = 140;
  public pendingNovaBurst: boolean = false;
  public pendingSummonCount: number = 0;

  constructor(id: number, type: EnemyType, x: number, y: number, hpMultiplier: number = 1.0) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;

    switch (type) {
      case 'bat':
        this.name = 'Morcego Carniceiro';
        this.radius = 12;
        this.maxHp = Math.round(16 * hpMultiplier);
        this.speed = 138 * 0.9;
        this.damage = 8;
        this.xpValue = 5;
        this.knockbackResistance = 1.15;
        break;
      case 'skeleton':
        this.name = 'Esqueleto Guerreiro';
        this.radius = 15;
        this.maxHp = Math.round(36 * hpMultiplier);
        this.speed = 82 * 0.9;
        this.damage = 12;
        this.xpValue = 11;
        this.knockbackResistance = 0.9;
        break;
      case 'zombie':
        this.name = 'Zumbi Decomposto';
        this.radius = 17;
        this.maxHp = Math.round(78 * hpMultiplier);
        this.speed = 54 * 0.9;
        this.damage = 18;
        this.xpValue = 20;
        this.knockbackResistance = 0.58;
        break;
      case 'ghost':
        this.name = 'Espectro Noturno';
        this.radius = 16;
        this.maxHp = Math.round(58 * hpMultiplier);
        this.speed = 84 * 0.9;
        this.damage = 15;
        this.xpValue = 16;
        this.knockbackResistance = 0.35;
        break;
      case 'elite_minotaur':
        this.name = 'Minotauro Elite';
        this.radius = 28;
        this.maxHp = Math.round(540 * hpMultiplier);
        this.speed = 92 * 0.9;
        this.damage = 24;
        this.xpValue = 140;
        this.isElite = true;
        this.knockbackResistance = 0.25;
        this.skillCooldown = 4.0 + Math.random() * 2.0;
        break;
      case 'boss_vampire':
        this.name = 'Senhor da Corrupçao (Chefe Final)';
        this.radius = 36;
        this.maxHp = Math.round(3100 * hpMultiplier);
        this.speed = 98;
        this.damage = 34;
        this.xpValue = 500;
        this.isBoss = true;
        this.knockbackResistance = 0.06;
        this.skillCooldown = 4.2;
        if (typeof window !== 'undefined') {
          this.spriteImage = new Image();
          this.spriteImage.src = '/boss-lula.gif';
        }
        break;
      case 'amazon_ant_bullet':
        this.name = 'Formiga-bala';
        this.radius = 8;
        this.maxHp = Math.round(12 * hpMultiplier);
        this.speed = 150;
        this.damage = 6;
        this.xpValue = 5;
        this.knockbackResistance = 1.2;
        break;
      case 'amazon_ant_leafcutter':
        this.name = 'Formiga-cortadeira';
        this.radius = 9;
        this.maxHp = Math.round(18 * hpMultiplier);
        this.speed = 120;
        this.damage = 7;
        this.xpValue = 5;
        this.knockbackResistance = 1.15;
        break;
      case 'amazon_butterfly':
        this.name = 'Borboleta-azul';
        this.radius = 10;
        this.maxHp = Math.round(10 * hpMultiplier);
        this.speed = 165;
        this.damage = 5;
        this.xpValue = 6;
        this.knockbackResistance = 1.25;
        break;
      case 'amazon_cicada':
        this.name = 'Cigarra';
        this.radius = 8;
        this.maxHp = Math.round(14 * hpMultiplier);
        this.speed = 140;
        this.damage = 6;
        this.xpValue = 6;
        this.knockbackResistance = 1.2;
        break;
      case 'amazon_piranha':
        this.name = 'Piranha';
        this.radius = 10;
        this.maxHp = Math.round(16 * hpMultiplier);
        this.speed = 155;
        this.damage = 8;
        this.xpValue = 6;
        this.knockbackResistance = 1.15;
        break;
      case 'amazon_dart_frog':
        this.name = 'Rã-dardo-venenosa';
        this.radius = 12;
        this.maxHp = Math.round(45 * hpMultiplier);
        this.speed = 110;
        this.damage = 10;
        this.xpValue = 12;
        this.knockbackResistance = 0.95;
        break;
      case 'amazon_mantis':
        this.name = 'Louva-a-deus';
        this.radius = 13;
        this.maxHp = Math.round(55 * hpMultiplier);
        this.speed = 125;
        this.damage = 12;
        this.xpValue = 13;
        this.knockbackResistance = 0.9;
        break;
      case 'amazon_stick_insect':
        this.name = 'Bicho-pau';
        this.radius = 13;
        this.maxHp = Math.round(60 * hpMultiplier);
        this.speed = 80;
        this.damage = 11;
        this.xpValue = 12;
        this.knockbackResistance = 0.85;
        break;
      case 'amazon_toucan':
        this.name = 'Tucano';
        this.radius = 12;
        this.maxHp = Math.round(42 * hpMultiplier);
        this.speed = 135;
        this.damage = 10;
        this.xpValue = 14;
        this.knockbackResistance = 1.0;
        break;
      case 'amazon_boto':
        this.name = 'Boto-cor-de-rosa';
        this.radius = 18;
        this.maxHp = Math.round(75 * hpMultiplier);
        this.speed = 120;
        this.damage = 14;
        this.xpValue = 18;
        this.knockbackResistance = 0.8;
        break;
      case 'amazon_capybara':
        this.name = 'Capivara';
        this.radius = 20;
        this.maxHp = Math.round(180 * hpMultiplier);
        this.speed = 72;
        this.damage = 16;
        this.xpValue = 30;
        this.knockbackResistance = 0.5;
        break;
      case 'amazon_sloth':
        this.name = 'Bicho-preguiça';
        this.radius = 18;
        this.maxHp = Math.round(230 * hpMultiplier);
        this.speed = 45;
        this.damage = 18;
        this.xpValue = 34;
        this.knockbackResistance = 0.45;
        break;
      case 'amazon_rhino_beetle':
        this.name = 'Besouro-rinoceronte';
        this.radius = 17;
        this.maxHp = Math.round(200 * hpMultiplier);
        this.speed = 85;
        this.damage = 20;
        this.xpValue = 32;
        this.knockbackResistance = 0.35;
        break;
      case 'amazon_stag_beetle':
        this.name = 'Besouro-serra-pau';
        this.radius = 17;
        this.maxHp = Math.round(190 * hpMultiplier);
        this.speed = 78;
        this.damage = 19;
        this.xpValue = 32;
        this.knockbackResistance = 0.4;
        break;
      case 'amazon_centipede':
        this.name = 'Lacraia-gigante';
        this.radius = 20;
        this.maxHp = Math.round(160 * hpMultiplier);
        this.speed = 105;
        this.damage = 17;
        this.xpValue = 30;
        this.knockbackResistance = 0.6;
        break;
      case 'amazon_otter':
        this.name = 'Ariranha';
        this.radius = 16;
        this.maxHp = Math.round(170 * hpMultiplier);
        this.speed = 125;
        this.damage = 20;
        this.xpValue = 34;
        this.knockbackResistance = 0.55;
        break;
      case 'amazon_jaguar':
        this.name = 'Onça-pintada';
        this.radius = 26;
        this.maxHp = Math.round(560 * hpMultiplier);
        this.speed = 118;
        this.damage = 26;
        this.xpValue = 140;
        this.isElite = true;
        this.knockbackResistance = 0.25;
        this.skillCooldown = 4.0 + Math.random() * 2.0;
        break;
      case 'amazon_tapir':
        this.name = 'Anta';
        this.radius = 28;
        this.maxHp = Math.round(700 * hpMultiplier);
        this.speed = 85;
        this.damage = 24;
        this.xpValue = 140;
        this.isElite = true;
        this.knockbackResistance = 0.15;
        this.skillCooldown = 4.0 + Math.random() * 2.0;
        break;
      case 'amazon_goliath_spider':
        this.name = 'Aranha-golias';
        this.radius = 24;
        this.maxHp = Math.round(500 * hpMultiplier);
        this.speed = 95;
        this.damage = 28;
        this.xpValue = 150;
        this.isElite = true;
        this.knockbackResistance = 0.3;
        this.skillCooldown = 4.0 + Math.random() * 2.0;
        break;
      case 'amazon_caiman':
        this.name = 'Jacaré-açu';
        this.radius = 30;
        this.maxHp = Math.round(650 * hpMultiplier);
        this.speed = 90;
        this.damage = 30;
        this.xpValue = 150;
        this.isElite = true;
        this.knockbackResistance = 0.2;
        this.skillCooldown = 4.0 + Math.random() * 2.0;
        break;
    }

    this.hp = this.maxHp;
  }

  public isDebuffed(): boolean {
    return (
      this.slowTimer > 0 ||
      this.vulnerableTimer > 0 ||
      this.poisonTimer > 0 ||
      this.bleedTimer > 0
    );
  }

  public applySlow(factor: number, duration: number): void {
    const effective = this.isBoss ? Math.min(0.2, factor * 0.5) : this.isElite ? factor * 0.75 : factor;
    if (effective >= this.slowFactor || this.slowTimer <= 0) {
      this.slowFactor = effective;
    }
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  public applyVulnerability(bonus: number, duration: number): void {
    this.vulnerableBonus = Math.max(this.vulnerableBonus, bonus);
    this.vulnerableTimer = Math.max(this.vulnerableTimer, duration);
  }

  public applyPoison(dps: number, duration: number, source: WeaponId, contagious: boolean): void {
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonTimer = Math.max(this.poisonTimer, duration);
    this.poisonSourceWeapon = source;
    if (contagious) {
      this.isContagious = true;
    }
  }

  public applyBleed(dpsAdd: number, maxDps: number, duration: number, source: WeaponId): void {
    this.bleedDps = Math.min(maxDps, (this.bleedTimer > 0 ? this.bleedDps : 0) + dpsAdd);
    this.bleedTimer = Math.max(this.bleedTimer, duration);
    this.bleedSourceWeapon = source;
  }

  public computeDamageTaken(rawAmount: number, playerDebuffBonus: number = 0): number {
    let mult = 1.0;
    if (this.vulnerableTimer > 0) {
      mult *= 1 + this.vulnerableBonus;
    }
    if (playerDebuffBonus > 0 && this.isDebuffed()) {
      mult *= 1 + playerDebuffBonus;
    }
    return rawAmount * mult;
  }

  update(dt: number, player: Player, separation: { vx: number; vy: number }): boolean {
    this.animTimer += dt * 8;

    // Decay timers
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 0;
    }
    if (this.vulnerableTimer > 0) {
      this.vulnerableTimer -= dt;
      if (this.vulnerableTimer <= 0) this.vulnerableBonus = 0;
    }
    if (this.poisonTimer > 0) {
      this.poisonTimer -= dt;
      if (this.poisonTimer <= 0) {
        this.poisonDps = 0;
        this.isContagious = false;
      }
    }
    if (this.bleedTimer > 0) {
      this.bleedTimer -= dt;
      if (this.bleedTimer <= 0) this.bleedDps = 0;
    }
    if (this.soulEaterMarkTimer > 0) {
      this.soulEaterMarkTimer -= dt;
    }

    // Knockback decay
    this.x += this.knockbackX * dt;
    this.y += this.knockbackY * dt;
    this.knockbackX *= Math.pow(0.05, dt);
    this.knockbackY *= Math.pow(0.05, dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speedMult = this.slowTimer > 0 ? Math.max(0.35, 1 - this.slowFactor) : 1.0;

    // Elite & Boss special skill state machine
    if (this.isElite || this.isBoss) {
      this.updateSpecialSkills(dt, dx, dy, dist, speedMult);
    }

    if (this.skillState === 'dashing') {
      const dashSpeed = (this.isBoss ? 275 : 210) * speedMult;
      this.x += this.dashDirX * dashSpeed * dt;
      this.y += this.dashDirY * dashSpeed * dt;
      return this.hp > 0;
    }

    if (
      this.skillState === 'telegraph_dash' ||
      this.skillState === 'telegraph_nova' ||
      this.skillState === 'telegraph_summon'
    ) {
      // Slow ominous step while telegraphing
      if (dist > 0) {
        this.x += (dx / dist) * this.speed * 0.25 * speedMult * dt;
        this.y += (dy / dist) * this.speed * 0.25 * speedMult * dt;
      }
      return this.hp > 0;
    }

    // Standard movement towards player
    if (dist > 0) {
      const currentSpeed = this.speed * speedMult;
      let vx = (dx / dist) * currentSpeed;
      let vy = (dy / dist) * currentSpeed;

      // Add separation force from flocking
      vx += separation.vx * currentSpeed * 0.8;
      vy += separation.vy * currentSpeed * 0.8;

      // Special ghost waving movement
      if (this.type === 'ghost') {
        const perpX = -dy / dist;
        const perpY = dx / dist;
        const wave = Math.sin(this.animTimer * 1.5) * 44 * speedMult;
        vx += perpX * wave;
        vy += perpY * wave;
      }

      this.x += vx * dt;
      this.y += vy * dt;
    }

    return this.hp > 0;
  }

  private updateSpecialSkills(dt: number, dx: number, dy: number, dist: number, speedMult: number): void {
    if (this.skillState === 'idle') {
      this.skillCooldown -= dt * speedMult;
      if (this.skillCooldown <= 0 && dist < 520) {
        if (this.isElite) {
          // Elite Bull Charge
          const norm = dist > 0 ? dist : 1;
          this.dashDirX = dx / norm;
          this.dashDirY = dy / norm;
          this.skillState = 'telegraph_dash';
          this.skillDuration = 0.65;
          this.skillStateTimer = 0.65;
        } else if (this.isBoss) {
          const skill = this.bossSkillIndex % 3;
          this.bossSkillIndex += 1;

          if (skill === 0) {
            const norm = dist > 0 ? dist : 1;
            this.dashDirX = dx / norm;
            this.dashDirY = dy / norm;
            this.skillState = 'telegraph_dash';
            this.skillDuration = 0.75;
            this.skillStateTimer = 0.75;
          } else if (skill === 1) {
            this.skillState = 'telegraph_nova';
            this.skillDuration = 0.85;
            this.skillStateTimer = 0.85;
          } else {
            this.skillState = 'telegraph_summon';
            this.skillDuration = 0.6;
            this.skillStateTimer = 0.6;
          }
        }
      }
      return;
    }

    this.skillStateTimer -= dt;
    if (this.skillStateTimer > 0) return;

    if (this.skillState === 'telegraph_dash') {
      this.skillState = 'dashing';
      this.skillDuration = this.isBoss ? 0.65 : 0.68;
      this.skillStateTimer = this.skillDuration;
    } else if (this.skillState === 'dashing') {
      this.skillState = 'idle';
      this.skillCooldown = this.isBoss ? 4.8 : 6.2;
    } else if (this.skillState === 'telegraph_nova') {
      this.pendingNovaBurst = true;
      this.skillState = 'idle';
      this.skillCooldown = 5.0;
    } else if (this.skillState === 'telegraph_summon') {
      this.pendingSummonCount = 6;
      this.skillState = 'idle';
      this.skillCooldown = 5.4;
    }
  }

  takeDamage(amount: number, knockX: number = 0, knockY: number = 0, knockForce: number = 200): boolean {
    this.hp -= amount;
    this.hitFlashTimer = 0.12;

    this.knockbackX += knockX * knockForce * this.knockbackResistance;
    this.knockbackY += knockY * knockForce * this.knockbackResistance;

    return this.hp <= 0;
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (!camera.isInView(this.x, this.y, 160)) return;

    const screen = camera.worldToScreen(this.x, this.y);
    const flip = this.x > camera.x ? -1 : 1;

    // Render Boss / Elite Telegraphs beneath character
    if (this.skillState === 'telegraph_dash') {
      const progress = 1 - Math.max(0, this.skillStateTimer / Math.max(0.1, this.skillDuration));
      const lineLen = this.isBoss ? 185 : 145;
      ctx.save();
      ctx.strokeStyle = this.isBoss ? `rgba(239, 68, 68, ${0.4 + progress * 0.5})` : `rgba(249, 115, 22, ${0.4 + progress * 0.5})`;
      ctx.lineWidth = this.radius * 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      ctx.lineTo(screen.x + this.dashDirX * lineLen, screen.y + this.dashDirY * lineLen);
      ctx.stroke();
      ctx.restore();
    } else if (this.skillState === 'telegraph_nova') {
      const progress = 1 - Math.max(0, this.skillStateTimer / Math.max(0.1, this.skillDuration));
      ctx.save();
      ctx.fillStyle = `rgba(220, 38, 38, ${0.12 + progress * 0.22})`;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, this.novaRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(254, 202, 202, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, this.novaRadius * progress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.skillState === 'telegraph_summon') {
      ctx.save();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, this.radius + 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(screen.x, screen.y);

    const isFlashing = this.hitFlashTimer > 0;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.9, this.radius, this.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle Status Ring Indicators
    if (this.vulnerableTimer > 0 || this.poisonTimer > 0 || this.slowTimer > 0) {
      ctx.strokeStyle =
        this.poisonTimer > 0
          ? 'rgba(34, 211, 238, 0.75)'
          : this.vulnerableTimer > 0
            ? 'rgba(250, 204, 21, 0.7)'
            : 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, this.radius * 0.85, this.radius + 3, this.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.scale(flip, 1);

    if (isFlashing) {
      ctx.fillStyle = '#ffffff';
    }

    if (this.type === 'bat') {
      const wingFlap = Math.sin(this.animTimer) * 10;
      if (!isFlashing) ctx.fillStyle = '#6b21a8';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-15, -6 + wingFlap);
      ctx.lineTo(-6, 2);
      ctx.moveTo(0, 0);
      ctx.lineTo(15, -6 + wingFlap);
      ctx.lineTo(6, 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-2, -2, 2, 2);
      ctx.fillRect(2, -2, 2, 2);
    } else if (this.type === 'skeleton') {
      if (!isFlashing) ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, -6, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-6, 3, 12, 10);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-4, -8, 3, 3);
      ctx.fillRect(2, -8, 3, 3);
    } else if (this.type === 'zombie') {
      if (!isFlashing) ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.roundRect(-9, -10, 18, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(-9, 4, 18, 8);
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
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.arc(-3, -5, 2.5, 0, Math.PI * 2);
      ctx.arc(3, -5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    } else if (this.type === 'elite_minotaur') {
      if (!isFlashing) ctx.fillStyle = this.skillState === 'dashing' ? '#dc2626' : '#991b1b';
      ctx.beginPath();
      ctx.roundRect(-22, -18, 44, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-16, -18);
      ctx.quadraticCurveTo(-28, -32, -18, -36);
      ctx.lineTo(-12, -22);
      ctx.moveTo(16, -18);
      ctx.quadraticCurveTo(28, -32, 18, -36);
      ctx.lineTo(12, -22);
      ctx.fill();
      ctx.fillStyle = '#f87171';
      ctx.fillRect(-6, -12, 4, 4);
      ctx.fillRect(4, -12, 4, 4);
    } else if (this.type === 'boss_vampire') {
      if (!isFlashing) {
        const aura = ctx.createRadialGradient(0, 0, 10, 0, 0, 48);
        aura.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
        aura.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.fill();
      }

      // Walking gait: bob up/down, sway side to side and lean on each step.
      // Pivot at the feet so the sprite appears to step rather than float.
      const walkPhase = this.animTimer * 0.8;
      const walkBob = Math.abs(Math.sin(walkPhase)) * 4;
      const walkSway = Math.sin(walkPhase) * 2;
      const walkTilt = Math.sin(walkPhase) * 0.035;
      const groundY = this.radius * 0.9;

      ctx.save();
      ctx.translate(walkSway, groundY - walkBob);
      ctx.rotate(walkTilt);
      ctx.translate(0, -groundY);

      const sprite = this.spriteImage;
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        const spriteHeight = 96;
        const spriteWidth = spriteHeight * (sprite.naturalWidth / sprite.naturalHeight);
        if (isFlashing) ctx.filter = 'brightness(0) invert(1)';
        ctx.drawImage(
          sprite,
          -spriteWidth / 2,
          groundY - spriteHeight,
          spriteWidth,
          spriteHeight
        );
        ctx.filter = 'none';
      } else {
        if (!isFlashing) ctx.fillStyle = '#450a0a';
        ctx.beginPath();
        ctx.roundRect(-24, -20, 48, 46, 10);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-24, 0, 48, 4);
        ctx.fillStyle = '#fce7f3';
        ctx.beginPath();
        ctx.arc(0, -22, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-5, -24, 4, 3);
        ctx.fillRect(3, -24, 4, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -16, 2, 3);
        ctx.fillRect(2, -16, 2, 3);
      }

      ctx.restore();
    } else if (this.type.startsWith('amazon_')) {
      this.renderAmazonFauna(ctx, isFlashing);
    }

    ctx.restore();

    // Health bar for Elites
    if (this.isElite) {
      const barW = 44;
      const barH = 5;
      const barX = screen.x - barW / 2;
      const barY = screen.y - this.radius - 12;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(barX, barY, barW * Math.max(0, this.hp / this.maxHp), barH);
    }
  }

  private renderAmazonFauna(ctx: CanvasRenderingContext2D, isFlashing: boolean): void {
    const paint = (color: string) => {
      ctx.fillStyle = isFlashing ? '#ffffff' : color;
    };
    const ink = (color: string) => {
      ctx.strokeStyle = isFlashing ? '#ffffff' : color;
    };

    switch (this.type) {
      case 'amazon_ant_bullet': {
        ink('#450a0a');
        ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 3, 2);
          ctx.lineTo(-9, 9);
          ctx.moveTo(i * 3, 2);
          ctx.lineTo(9, 9);
          ctx.stroke();
        }
        paint('#7f1d1d');
        ctx.beginPath();
        ctx.ellipse(-8, 1, 6, 4.5, -0.25, 0, Math.PI * 2);
        ctx.ellipse(0, 0, 4.5, 4, 0, 0, Math.PI * 2);
        ctx.ellipse(8, -1, 4, 3.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        paint('#111827');
        ctx.beginPath();
        ctx.arc(8, -1, 3, 0, Math.PI * 2);
        ctx.fill();
        ink('#111827');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(10, -3);
        ctx.lineTo(15, -8);
        ctx.moveTo(7, -4);
        ctx.lineTo(11, -10);
        ctx.stroke();
        break;
      }
      case 'amazon_ant_leafcutter': {
        paint('#2f8f3d');
        ctx.beginPath();
        ctx.ellipse(-5, -11, 9, 5, -0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-12, -7);
        ctx.lineTo(2, -15);
        ctx.stroke();
        paint('#b45309');
        ctx.beginPath();
        ctx.ellipse(-8, 3, 5.5, 4, -0.2, 0, Math.PI * 2);
        ctx.ellipse(0, 0, 4, 3.5, 0, 0, Math.PI * 2);
        ctx.ellipse(8, -2, 3.5, 3, 0.2, 0, Math.PI * 2);
        ctx.fill();
        paint('#78350f');
        ctx.beginPath();
        ctx.arc(9, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        ink('#78350f');
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-4, 4);
        ctx.lineTo(-9, 10);
        ctx.moveTo(2, 4);
        ctx.lineTo(2, 10);
        ctx.moveTo(7, 2);
        ctx.lineTo(12, 9);
        ctx.stroke();
        break;
      }
      case 'amazon_butterfly': {
        const flap = 0.75 + Math.sin(this.animTimer * 2.2) * 0.18;
        paint('#2563eb');
        ctx.beginPath();
        ctx.ellipse(-9, -4, 9 * flap, 7, -0.5, 0, Math.PI * 2);
        ctx.ellipse(9, -4, 9 * flap, 7, 0.5, 0, Math.PI * 2);
        ctx.fill();
        paint('#38bdf8');
        ctx.beginPath();
        ctx.ellipse(-7, 3, 6 * flap, 4.5, 0.4, 0, Math.PI * 2);
        ctx.ellipse(7, 3, 6 * flap, 4.5, -0.4, 0, Math.PI * 2);
        ctx.fill();
        paint('#0f172a');
        ctx.fillRect(-1.5, -9, 3, 17);
        ctx.beginPath();
        ctx.arc(0, -9, 3, 0, Math.PI * 2);
        ctx.fill();
        ink('#0f172a');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-1, -11);
        ctx.lineTo(-6, -16);
        ctx.moveTo(1, -11);
        ctx.lineTo(6, -16);
        ctx.stroke();
        break;
      }
      case 'amazon_cicada': {
        paint('#65a30d');
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.55;
        paint('#a3e635');
        ctx.beginPath();
        ctx.ellipse(-7, -2, 5, 10, 0.35, 0, Math.PI * 2);
        ctx.ellipse(7, -2, 5, 10, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        paint('#3f6212');
        ctx.beginPath();
        ctx.arc(0, -9, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-3, -11, 2, 2);
        ctx.fillRect(1, -11, 2, 2);
        ink('#3f6212');
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-4, 4);
        ctx.lineTo(-12, 7);
        ctx.moveTo(4, 4);
        ctx.lineTo(12, 7);
        ctx.stroke();
        break;
      }
      case 'amazon_piranha': {
        paint('#64748b');
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#dc2626');
        ctx.beginPath();
        ctx.ellipse(1, 4, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#475569');
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(-19, -7);
        ctx.lineTo(-19, 7);
        ctx.closePath();
        ctx.fill();
        paint('#0f172a');
        ctx.beginPath();
        ctx.arc(7, -2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(10, 1);
        ctx.lineTo(15, 2);
        ctx.lineTo(11, 3);
        ctx.moveTo(10, 4);
        ctx.lineTo(14, 6);
        ctx.lineTo(9, 6);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-4, -1, 7, 1);
        break;
      }
      case 'amazon_dart_frog': {
        paint('#38bdf8');
        ctx.beginPath();
        ctx.ellipse(0, 1, 11, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#0ea5e9');
        ctx.beginPath();
        ctx.ellipse(-9, 6, 5, 3, -0.4, 0, Math.PI * 2);
        ctx.ellipse(9, 6, 5, 3, 0.4, 0, Math.PI * 2);
        ctx.fill();
        paint('#facc15');
        ctx.beginPath();
        ctx.arc(-4, -1, 2, 0, Math.PI * 2);
        ctx.arc(4, 2, 1.8, 0, Math.PI * 2);
        ctx.arc(0, 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        paint('#1e293b');
        ctx.beginPath();
        ctx.arc(0, -6, 6, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-3, -6, 1.8, 0, Math.PI * 2);
        ctx.arc(3, -6, 1.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'amazon_mantis': {
        paint('#22c55e');
        ctx.beginPath();
        ctx.ellipse(0, 3, 5, 11, 0.35, 0, Math.PI * 2);
        ctx.fill();
        paint('#16a34a');
        ctx.beginPath();
        ctx.moveTo(3, -2);
        ctx.lineTo(11, -6);
        ctx.lineTo(9, 3);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -8, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.arc(11, -9, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ink('#16a34a');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(7, -4);
        ctx.lineTo(15, -1);
        ctx.lineTo(12, 5);
        ctx.moveTo(5, -5);
        ctx.lineTo(13, -3);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-2, 6);
        ctx.lineTo(-9, 12);
        ctx.moveTo(2, 6);
        ctx.lineTo(9, 12);
        ctx.moveTo(-1, 11);
        ctx.lineTo(-5, 16);
        ctx.stroke();
        break;
      }
      case 'amazon_stick_insect': {
        paint('#8a5a2b');
        ctx.beginPath();
        ctx.ellipse(0, 1, 4, 14, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(3, -12, 3.5, 4.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ink('#5b3a1a');
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-2, 8);
        ctx.lineTo(-13, 14);
        ctx.moveTo(2, 8);
        ctx.lineTo(13, 14);
        ctx.moveTo(-1, 2);
        ctx.lineTo(-14, 4);
        ctx.moveTo(1, 2);
        ctx.lineTo(14, 4);
        ctx.moveTo(0, -8);
        ctx.lineTo(-11, -12);
        ctx.moveTo(5, -11);
        ctx.lineTo(12, -17);
        ctx.stroke();
        ctx.strokeStyle = '#a16207';
        ctx.beginPath();
        ctx.moveTo(3, -15);
        ctx.lineTo(0, -20);
        ctx.moveTo(4, -15);
        ctx.lineTo(8, -19);
        ctx.stroke();
        break;
      }
      case 'amazon_toucan': {
        paint('#1e293b');
        ctx.beginPath();
        ctx.ellipse(-1, 1, 10, 12, 0.1, 0, Math.PI * 2);
        ctx.fill();
        paint('#f8fafc');
        ctx.beginPath();
        ctx.ellipse(8, -6, 6, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#f97316');
        ctx.beginPath();
        ctx.moveTo(12, -8);
        ctx.quadraticCurveTo(25, -5, 13, -1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.fillRect(17, -5, 4, 2);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(9, -8, 1.8, 0, Math.PI * 2);
        ctx.fill();
        paint('#334155');
        ctx.beginPath();
        ctx.ellipse(-3, 4, 5, 7, 0.4, 0, Math.PI * 2);
        ctx.fill();
        paint('#f97316');
        ctx.beginPath();
        ctx.ellipse(-2, 13, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'amazon_boto': {
        paint('#f472b6');
        ctx.beginPath();
        ctx.ellipse(0, 0, 17, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#ec4899');
        ctx.beginPath();
        ctx.moveTo(-2, -3);
        ctx.lineTo(2, -13);
        ctx.lineTo(7, -3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(-24, -8);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-24, 8);
        ctx.closePath();
        ctx.fill();
        paint('#fbcfe8');
        ctx.beginPath();
        ctx.ellipse(11, -2, 7, 5, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#831843';
        ctx.beginPath();
        ctx.arc(14, -3, 1.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'amazon_capybara': {
        paint('#8b5e34');
        ctx.beginPath();
        ctx.ellipse(-2, 2, 17, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#6b4423');
        ctx.beginPath();
        ctx.ellipse(12, -4, 8, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(16, 2, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3f2a16';
        ctx.beginPath();
        ctx.arc(8, -9, 2.5, 0, Math.PI * 2);
        ctx.arc(15, -9, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(16, -5, 1.8, 0, Math.PI * 2);
        ctx.fill();
        paint('#5c3b1e');
        ctx.fillRect(-12, 10, 4, 7);
        ctx.fillRect(-1, 10, 4, 7);
        break;
      }
      case 'amazon_sloth': {
        paint('#78716c');
        ctx.beginPath();
        ctx.ellipse(-2, 1, 15, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#a8a29e');
        ctx.beginPath();
        ctx.ellipse(9, -3, 9, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#f5f5f4');
        ctx.beginPath();
        ctx.ellipse(10, -3, 6, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#44403c';
        ctx.beginPath();
        ctx.ellipse(8, -5, 2.2, 3.2, 0.3, 0, Math.PI * 2);
        ctx.ellipse(13, -5, 2.2, 3.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(10, -2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ink('#57534e');
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-14, 6);
        ctx.lineTo(-22, 12);
        ctx.moveTo(-12, 9);
        ctx.lineTo(-19, 16);
        ctx.stroke();
        break;
      }
      case 'amazon_rhino_beetle': {
        paint('#27272a');
        ctx.beginPath();
        ctx.ellipse(-2, 1, 12, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#3f3f46');
        ctx.beginPath();
        ctx.ellipse(9, -1, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#52525b');
        ctx.beginPath();
        ctx.moveTo(13, -3);
        ctx.lineTo(22, -10);
        ctx.lineTo(15, 1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 7);
        ctx.lineTo(-14, 14);
        ctx.moveTo(0, 8);
        ctx.lineTo(-2, 16);
        ctx.moveTo(8, 6);
        ctx.lineTo(13, 13);
        ctx.stroke();
        break;
      }
      case 'amazon_stag_beetle': {
        paint('#44403c');
        ctx.beginPath();
        ctx.ellipse(-3, 1, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#292524');
        ctx.beginPath();
        ctx.ellipse(9, -1, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ink('#1c1917');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(12, -4);
        ctx.quadraticCurveTo(20, -10, 23, -3);
        ctx.moveTo(12, 2);
        ctx.quadraticCurveTo(20, 8, 23, 1);
        ctx.stroke();
        ctx.strokeStyle = '#57534e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-8, 7);
        ctx.lineTo(-14, 13);
        ctx.moveTo(0, 8);
        ctx.lineTo(-2, 15);
        ctx.moveTo(7, 6);
        ctx.lineTo(12, 13);
        ctx.stroke();
        break;
      }
      case 'amazon_centipede': {
        for (let i = 0; i < 6; i++) {
          const px = -12 + i * 5;
          const py = Math.sin(this.animTimer + i * 0.8) * 3;
          paint(i % 2 === 0 ? '#c2410c' : '#ea580c');
          ctx.beginPath();
          ctx.ellipse(px, py, 4.5, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ink('#7c2d12');
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py + 3);
          ctx.lineTo(px - 3, py + 9);
          ctx.moveTo(px, py + 3);
          ctx.lineTo(px + 3, py + 9);
          ctx.stroke();
        }
        paint('#9a3412');
        ctx.beginPath();
        ctx.arc(17, Math.sin(this.animTimer + 5) * 3, 5, 0, Math.PI * 2);
        ctx.fill();
        ink('#7c2d12');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, -2);
        ctx.lineTo(25, -7);
        ctx.moveTo(20, 2);
        ctx.lineTo(26, 5);
        ctx.stroke();
        break;
      }
      case 'amazon_otter': {
        paint('#78350f');
        ctx.beginPath();
        ctx.ellipse(-1, 1, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#92400e');
        ctx.beginPath();
        ctx.ellipse(10, -5, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(-12, 4, 4, 3, -0.6, 0, Math.PI * 2);
        ctx.fill();
        paint('#fde68a');
        ctx.beginPath();
        ctx.ellipse(0, 4, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(12, -6, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(15, -3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(15, 1);
        ctx.lineTo(21, -1);
        ctx.moveTo(15, 2);
        ctx.lineTo(21, 3);
        ctx.stroke();
        break;
      }
      case 'amazon_jaguar': {
        paint('#f59e0b');
        ctx.beginPath();
        ctx.ellipse(-2, 1, 16, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#d97706');
        ctx.beginPath();
        ctx.ellipse(12, -5, 9, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(7, -12, 3, 0, Math.PI * 2);
        ctx.arc(17, -12, 3, 0, Math.PI * 2);
        ctx.fill();
        paint('#78350f');
        ctx.beginPath();
        ctx.ellipse(-17, 0, 4, 2.5, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        for (let i = 0; i < 6; i++) {
          const sx = -12 + (i % 3) * 7;
          const sy = -3 + Math.floor(i / 3) * 8;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(14, -6, 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(12, 1, 8, 1.5);
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.moveTo(18, -10);
        ctx.lineTo(22, -15);
        ctx.lineTo(21, -8);
        ctx.fill();
        break;
      }
      case 'amazon_tapir': {
        paint('#57534e');
        ctx.beginPath();
        ctx.ellipse(-2, 2, 17, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#44403c');
        ctx.beginPath();
        ctx.ellipse(12, -4, 8, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#78716c');
        ctx.beginPath();
        ctx.ellipse(18, 2, 6, 4, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(8, -10, 2.5, 0, Math.PI * 2);
        ctx.arc(16, -10, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(14, -5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        paint('#3f3f46');
        ctx.fillRect(-12, 11, 4, 7);
        ctx.fillRect(-1, 11, 4, 7);
        break;
      }
      case 'amazon_goliath_spider': {
        ink('#292524');
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 4; i++) {
          const off = -8 + i * 6;
          ctx.beginPath();
          ctx.moveTo(off, 2);
          ctx.lineTo(off - 12, -12 + i * 2);
          ctx.moveTo(off, 4);
          ctx.lineTo(off - 10, 16 - i * 2);
          ctx.stroke();
        }
        paint('#44403c');
        ctx.beginPath();
        ctx.ellipse(-7, 2, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#57534e');
        ctx.beginPath();
        ctx.ellipse(9, -2, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(8, -5, 1.5, 0, Math.PI * 2);
        ctx.arc(12, -4, 1.5, 0, Math.PI * 2);
        ctx.fill();
        paint('#292524');
        ctx.beginPath();
        ctx.ellipse(-9, 2, 3, 5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'amazon_caiman': {
        paint('#3f6212');
        ctx.beginPath();
        ctx.ellipse(-4, 1, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#4d7c0f');
        ctx.beginPath();
        ctx.ellipse(14, -1, 11, 5, 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(-25, -7);
        ctx.lineTo(-22, 1);
        ctx.lineTo(-25, 8);
        ctx.closePath();
        ctx.fill();
        paint('#365314');
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(-9 + i * 5, -8, 3, 4);
        }
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(10, -4, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(7, 1);
        ctx.lineTo(25, 1);
        ctx.lineTo(23, 3);
        ctx.lineTo(9, 3);
        ctx.fill();
        ctx.fillStyle = '#166534';
        ctx.beginPath();
        ctx.arc(9, 2, 1, 0, Math.PI * 2);
        ctx.arc(15, 2, 1, 0, Math.PI * 2);
        ctx.arc(21, 2, 1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        break;
    }
  }
}
