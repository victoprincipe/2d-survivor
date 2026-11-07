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
  public habitat: 'land' | 'water' = 'land';
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

      // --- Amazon fauna: 5 basics -------------------------------------------------
      case 'bullet_ant':
        this.name = 'Formiga-bala';
        this.radius = 9;
        this.maxHp = Math.round(16 * hpMultiplier);
        this.speed = 150;
        this.damage = 7;
        this.xpValue = 5;
        this.knockbackResistance = 1.25;
        break;
      case 'leafcutter_ant':
        this.name = 'Formiga-cortadeira';
        this.radius = 10;
        this.maxHp = Math.round(20 * hpMultiplier);
        this.speed = 120;
        this.damage = 8;
        this.xpValue = 6;
        this.knockbackResistance = 1.15;
        break;
      case 'blue_butterfly':
        this.name = 'Borboleta-azul';
        this.radius = 11;
        this.maxHp = Math.round(14 * hpMultiplier);
        this.speed = 165;
        this.damage = 6;
        this.xpValue = 5;
        this.knockbackResistance = 1.35;
        break;
      case 'cicada':
        this.name = 'Cigarra';
        this.radius = 11;
        this.maxHp = Math.round(22 * hpMultiplier);
        this.speed = 112;
        this.damage = 9;
        this.xpValue = 7;
        this.knockbackResistance = 1.1;
        break;
      case 'piranha':
        this.name = 'Piranha';
        this.radius = 11;
        this.maxHp = Math.round(24 * hpMultiplier);
        this.speed = 155;
        this.damage = 11;
        this.xpValue = 7;
        this.knockbackResistance = 1.1;
        this.habitat = 'water';
        break;

      // --- Amazon fauna: 5 mediums ------------------------------------------------
      case 'poison_frog':
        this.name = 'Rã-dardo-venenosa';
        this.radius = 14;
        this.maxHp = Math.round(58 * hpMultiplier);
        this.speed = 96;
        this.damage = 14;
        this.xpValue = 14;
        this.knockbackResistance = 0.85;
        break;
      case 'mantis':
        this.name = 'Louva-a-deus';
        this.radius = 15;
        this.maxHp = Math.round(66 * hpMultiplier);
        this.speed = 108;
        this.damage = 16;
        this.xpValue = 15;
        this.knockbackResistance = 0.78;
        break;
      case 'stick_insect':
        this.name = 'Bicho-pau';
        this.radius = 15;
        this.maxHp = Math.round(74 * hpMultiplier);
        this.speed = 82;
        this.damage = 13;
        this.xpValue = 14;
        this.knockbackResistance = 0.8;
        break;
      case 'toucan':
        this.name = 'Tucano';
        this.radius = 14;
        this.maxHp = Math.round(50 * hpMultiplier);
        this.speed = 135;
        this.damage = 14;
        this.xpValue = 16;
        this.knockbackResistance = 0.9;
        break;
      case 'pink_dolphin':
        this.name = 'Boto-cor-de-rosa';
        this.radius = 17;
        this.maxHp = Math.round(80 * hpMultiplier);
        this.speed = 118;
        this.damage = 17;
        this.xpValue = 17;
        this.knockbackResistance = 0.7;
        this.habitat = 'water';
        break;

      // --- Amazon fauna: 6 resistant ----------------------------------------------
      case 'capybara':
        this.name = 'Capivara';
        this.radius = 21;
        this.maxHp = Math.round(185 * hpMultiplier);
        this.speed = 66;
        this.damage = 21;
        this.xpValue = 26;
        this.knockbackResistance = 0.5;
        break;
      case 'sloth':
        this.name = 'Bicho-preguiça';
        this.radius = 20;
        this.maxHp = Math.round(230 * hpMultiplier);
        this.speed = 40;
        this.damage = 19;
        this.xpValue = 27;
        this.knockbackResistance = 0.4;
        break;
      case 'rhino_beetle':
        this.name = 'Besouro-rinoceronte';
        this.radius = 19;
        this.maxHp = Math.round(205 * hpMultiplier);
        this.speed = 72;
        this.damage = 23;
        this.xpValue = 29;
        this.knockbackResistance = 0.34;
        break;
      case 'longhorn_beetle':
        this.name = 'Besouro-serra-pau';
        this.radius = 19;
        this.maxHp = Math.round(195 * hpMultiplier);
        this.speed = 78;
        this.damage = 22;
        this.xpValue = 28;
        this.knockbackResistance = 0.34;
        break;
      case 'giant_centipede':
        this.name = 'Lacraia-gigante';
        this.radius = 21;
        this.maxHp = Math.round(175 * hpMultiplier);
        this.speed = 92;
        this.damage = 25;
        this.xpValue = 31;
        this.knockbackResistance = 0.45;
        break;
      case 'giant_otter':
        this.name = 'Ariranha';
        this.radius = 20;
        this.maxHp = Math.round(215 * hpMultiplier);
        this.speed = 100;
        this.damage = 24;
        this.xpValue = 31;
        this.knockbackResistance = 0.4;
        this.habitat = 'water';
        break;

      // --- Amazon fauna: 4 elites -------------------------------------------------
      case 'jaguar':
        this.name = 'Onça-pintada';
        this.radius = 27;
        this.maxHp = Math.round(620 * hpMultiplier);
        this.speed = 120;
        this.damage = 30;
        this.xpValue = 150;
        this.isElite = true;
        this.knockbackResistance = 0.22;
        this.skillCooldown = 4.0 + Math.random() * 2.0;
        break;
      case 'tapir':
        this.name = 'Anta';
        this.radius = 29;
        this.maxHp = Math.round(780 * hpMultiplier);
        this.speed = 86;
        this.damage = 28;
        this.xpValue = 150;
        this.isElite = true;
        this.knockbackResistance = 0.18;
        this.skillCooldown = 4.2 + Math.random() * 2.0;
        break;
      case 'goliath_spider':
        this.name = 'Aranha-golias';
        this.radius = 27;
        this.maxHp = Math.round(560 * hpMultiplier);
        this.speed = 102;
        this.damage = 27;
        this.xpValue = 145;
        this.isElite = true;
        this.knockbackResistance = 0.2;
        this.skillCooldown = 4.0 + Math.random() * 2.0;
        break;
      case 'black_caiman':
        this.name = 'Jacaré-açu';
        this.radius = 30;
        this.maxHp = Math.round(720 * hpMultiplier);
        this.speed = 96;
        this.damage = 33;
        this.xpValue = 165;
        this.isElite = true;
        this.knockbackResistance = 0.15;
        this.skillCooldown = 4.0 + Math.random() * 2.0;
        this.habitat = 'water';
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
    } else {
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
    const detail = (color: string) => {
      ctx.fillStyle = color;
    };
    const line = (color: string) => {
      ctx.strokeStyle = isFlashing ? '#ffffff' : color;
    };

    switch (this.type) {
      case 'bullet_ant': {
        line('#1c1917');
        ctx.lineWidth = 1.4;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 4);
          ctx.lineTo(-9, i * 4 - 4);
          ctx.moveTo(0, i * 4);
          ctx.lineTo(9, i * 4 - 4);
          ctx.stroke();
        }
        paint('#7f1d1d');
        ctx.beginPath();
        ctx.ellipse(-6, 2, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#111827');
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#991b1b');
        ctx.beginPath();
        ctx.arc(6, -1, 4, 0, Math.PI * 2);
        ctx.fill();
        detail('#fbbf24');
        ctx.fillRect(7, -3, 2, 2);
        break;
      }
      case 'leafcutter_ant': {
        line('#3f2a14');
        ctx.lineWidth = 1.4;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 4);
          ctx.lineTo(-9, i * 4 - 4);
          ctx.moveTo(0, i * 4);
          ctx.lineTo(9, i * 4 - 4);
          ctx.stroke();
        }
        paint('#78350f');
        ctx.beginPath();
        ctx.ellipse(-6, 2, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#5b3a1a');
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#92400e');
        ctx.beginPath();
        ctx.arc(6, -1, 4, 0, Math.PI * 2);
        ctx.fill();
        paint('#22c55e');
        ctx.beginPath();
        ctx.ellipse(-5, -10, 7, 5, -0.5, 0, Math.PI * 2);
        ctx.fill();
        line('#166534');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-9, -11);
        ctx.lineTo(-1, -8);
        ctx.stroke();
        break;
      }
      case 'blue_butterfly': {
        const flap = 0.72 + Math.abs(Math.sin(this.animTimer * 1.6)) * 0.45;
        ctx.globalAlpha = 0.9;
        paint('#2563eb');
        ctx.beginPath();
        ctx.ellipse(-8, -2, 8, 11 * flap, -0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(8, -2, 8, 11 * flap, 0.45, 0, Math.PI * 2);
        ctx.fill();
        paint('#60a5fa');
        ctx.beginPath();
        ctx.ellipse(-7, 2, 5, 6 * flap, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(7, 2, 5, 6 * flap, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        paint('#1e293b');
        ctx.beginPath();
        ctx.ellipse(0, 1, 2.5, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        line('#1e293b');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-4, -14);
        ctx.moveTo(0, -8);
        ctx.lineTo(4, -14);
        ctx.stroke();
        break;
      }
      case 'cicada': {
        ctx.globalAlpha = 0.45;
        paint('#a3e635');
        ctx.beginPath();
        ctx.ellipse(-9, -1, 6, 11, -0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(9, -1, 6, 11, 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        paint('#4d7c0f');
        ctx.beginPath();
        ctx.ellipse(0, 1, 7, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#3f6212');
        ctx.beginPath();
        ctx.arc(0, -7, 5, 0, Math.PI * 2);
        ctx.fill();
        detail('#fde047');
        ctx.beginPath();
        ctx.arc(-4, -8, 1.8, 0, Math.PI * 2);
        ctx.arc(4, -8, 1.8, 0, Math.PI * 2);
        ctx.fill();
        line('#365314');
        ctx.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 5);
          ctx.lineTo(-8, i * 5 - 3);
          ctx.moveTo(0, i * 5);
          ctx.lineTo(8, i * 5 - 3);
          ctx.stroke();
        }
        break;
      }
      case 'piranha': {
        paint('#94a3b8');
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#dc2626');
        ctx.beginPath();
        ctx.ellipse(0, 4, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#475569');
        ctx.beginPath();
        ctx.moveTo(-11, 0);
        ctx.lineTo(-19, -7);
        ctx.lineTo(-19, 7);
        ctx.closePath();
        ctx.fill();
        paint('#cbd5e1');
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(18, -4);
        ctx.lineTo(18, 4);
        ctx.closePath();
        ctx.fill();
        detail('#ffffff');
        ctx.beginPath();
        ctx.moveTo(9, 2);
        ctx.lineTo(13, 0);
        ctx.lineTo(13, 4);
        ctx.closePath();
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(7, -3, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'poison_frog': {
        paint('#1d4ed8');
        ctx.beginPath();
        ctx.ellipse(-10, 5, 6, 4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, 5, 6, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();
        paint('#facc15');
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(-6, -1, 2, 0, Math.PI * 2);
        ctx.arc(5, 3, 1.6, 0, Math.PI * 2);
        ctx.arc(-2, 5, 1.4, 0, Math.PI * 2);
        ctx.fill();
        detail('#ffffff');
        ctx.beginPath();
        ctx.arc(-6, -6, 3.2, 0, Math.PI * 2);
        ctx.arc(6, -6, 3.2, 0, Math.PI * 2);
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(-6, -6, 1.5, 0, Math.PI * 2);
        ctx.arc(6, -6, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'mantis': {
        line('#166534');
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 5);
          ctx.lineTo(-9, i * 5 - 4);
          ctx.moveTo(0, i * 5);
          ctx.lineTo(9, i * 5 - 4);
          ctx.stroke();
        }
        paint('#22c55e');
        ctx.beginPath();
        ctx.ellipse(0, 2, 6, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#4ade80');
        ctx.beginPath();
        ctx.moveTo(-6, -6);
        ctx.lineTo(0, -14);
        ctx.lineTo(6, -6);
        ctx.closePath();
        ctx.fill();
        line('#15803d');
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-3, -4);
        ctx.lineTo(-12, -10);
        ctx.lineTo(-7, -16);
        ctx.moveTo(3, -4);
        ctx.lineTo(12, -10);
        ctx.lineTo(7, -16);
        ctx.stroke();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(-3, -10, 1.5, 0, Math.PI * 2);
        ctx.arc(3, -10, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'stick_insect': {
        paint('#92400e');
        ctx.beginPath();
        ctx.roundRect(-3, -14, 6, 28, 3);
        ctx.fill();
        paint('#a16207');
        ctx.beginPath();
        ctx.arc(0, -15, 4.5, 0, Math.PI * 2);
        ctx.fill();
        line('#78350f');
        ctx.lineWidth = 1.6;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 7);
          ctx.lineTo(-9, i * 7 - 6);
          ctx.lineTo(-12, i * 7 - 2);
          ctx.moveTo(0, i * 7);
          ctx.lineTo(9, i * 7 - 6);
          ctx.lineTo(12, i * 7 - 2);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(-5, -25);
        ctx.moveTo(0, -18);
        ctx.lineTo(5, -25);
        ctx.stroke();
        break;
      }
      case 'toucan': {
        paint('#111827');
        ctx.beginPath();
        ctx.ellipse(0, 2, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#f8fafc');
        ctx.beginPath();
        ctx.ellipse(2, 5, 6, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.85;
        paint('#1e293b');
        ctx.beginPath();
        ctx.ellipse(-9, 1, 5, 10, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        paint('#0f172a');
        ctx.beginPath();
        ctx.arc(4, -9, 6, 0, Math.PI * 2);
        ctx.fill();
        detail('#f97316');
        ctx.beginPath();
        ctx.moveTo(8, -10);
        ctx.quadraticCurveTo(22, -8, 20, -1);
        ctx.quadraticCurveTo(15, 1, 9, -3);
        ctx.closePath();
        ctx.fill();
        detail('#ea580c');
        ctx.fillRect(17, -5, 3, 3);
        detail('#38bdf8');
        ctx.beginPath();
        ctx.arc(4, -10, 2.4, 0, Math.PI * 2);
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(4, -10, 1.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'pink_dolphin': {
        paint('#f472b6');
        ctx.beginPath();
        ctx.ellipse(0, 0, 17, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#db2777');
        ctx.beginPath();
        ctx.moveTo(-2, -6);
        ctx.lineTo(3, -16);
        ctx.lineTo(8, -6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(-24, -8);
        ctx.lineTo(-22, 6);
        ctx.closePath();
        ctx.fill();
        paint('#fbcfe8');
        ctx.beginPath();
        ctx.ellipse(1, 4, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        detail('#831843');
        ctx.beginPath();
        ctx.arc(10, -2, 1.8, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'capybara': {
        paint('#8b5e34');
        ctx.beginPath();
        ctx.roundRect(-16, -10, 30, 22, 9);
        ctx.fill();
        paint('#a47148');
        ctx.beginPath();
        ctx.roundRect(8, -14, 13, 15, 6);
        ctx.fill();
        paint('#6b4423');
        ctx.beginPath();
        ctx.ellipse(-12, 8, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(12, 8, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        detail('#3f2a14');
        ctx.beginPath();
        ctx.arc(15, -11, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(19, -5, 2, 0, Math.PI * 2);
        ctx.fill();
        detail('#fef3c7');
        ctx.beginPath();
        ctx.arc(15, -12, 3, 0, Math.PI * 2);
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(15, -12, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'sloth': {
        paint('#a8a29e');
        ctx.beginPath();
        ctx.ellipse(0, 1, 12, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#78716c');
        ctx.beginPath();
        ctx.ellipse(-14, 3, 8, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(14, 3, 8, 4, -0.4, 0, Math.PI * 2);
        ctx.fill();
        paint('#d6d3d1');
        ctx.beginPath();
        ctx.ellipse(0, -3, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        detail('#44403c');
        ctx.beginPath();
        ctx.ellipse(-5, -2, 3, 3.5, 0.3, 0, Math.PI * 2);
        ctx.ellipse(5, -2, 3, 3.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(-5, -2, 1.1, 0, Math.PI * 2);
        ctx.arc(5, -2, 1.1, 0, Math.PI * 2);
        ctx.fill();
        detail('#292524');
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rhino_beetle': {
        line('#1c1917');
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 5);
          ctx.lineTo(-10, i * 5 - 5);
          ctx.moveTo(0, i * 5);
          ctx.lineTo(10, i * 5 - 5);
          ctx.stroke();
        }
        paint('#3f2a14');
        ctx.beginPath();
        ctx.ellipse(0, 2, 12, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#292524');
        ctx.beginPath();
        ctx.arc(10, -2, 6, 0, Math.PI * 2);
        ctx.fill();
        paint('#78350f');
        ctx.beginPath();
        ctx.moveTo(12, -7);
        ctx.quadraticCurveTo(20, -10, 18, -18);
        ctx.lineTo(14, -12);
        ctx.closePath();
        ctx.fill();
        detail('#fbbf24');
        ctx.fillRect(10, -4, 2, 2);
        break;
      }
      case 'longhorn_beetle': {
        line('#1c1917');
        ctx.lineWidth = 1.8;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(0, i * 5);
          ctx.lineTo(-10, i * 5 - 5);
          ctx.moveTo(0, i * 5);
          ctx.lineTo(10, i * 5 - 5);
          ctx.stroke();
        }
        paint('#111827');
        ctx.beginPath();
        ctx.ellipse(0, 2, 11, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        detail('#d6d3d1');
        ctx.beginPath();
        ctx.arc(-4, 0, 1.4, 0, Math.PI * 2);
        ctx.arc(4, 4, 1.4, 0, Math.PI * 2);
        ctx.arc(2, -4, 1.2, 0, Math.PI * 2);
        ctx.fill();
        paint('#0f172a');
        ctx.beginPath();
        ctx.arc(8, -5, 3.5, 0, Math.PI * 2);
        ctx.fill();
        line('#292524');
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(9, -7);
        ctx.quadraticCurveTo(18, -14, 24, -20);
        ctx.moveTo(8, -4);
        ctx.quadraticCurveTo(17, -8, 22, -12);
        ctx.stroke();
        break;
      }
      case 'giant_centipede': {
        line('#7c2d12');
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 7; i++) {
          const x = -12 + i * 4;
          const wave = Math.sin(this.animTimer * 1.5 + i * 0.6) * 2;
          ctx.beginPath();
          ctx.moveTo(x, wave);
          ctx.lineTo(x - 3, 9 + wave);
          ctx.moveTo(x, wave);
          ctx.lineTo(x - 3, -9 + wave);
          ctx.stroke();
        }
        for (let i = 0; i < 7; i++) {
          const x = -12 + i * 4;
          const wave = Math.sin(this.animTimer * 1.5 + i * 0.6) * 2;
          paint(i % 2 === 0 ? '#ea580c' : '#c2410c');
          ctx.beginPath();
          ctx.arc(x, wave, 4.6, 0, Math.PI * 2);
          ctx.fill();
        }
        paint('#9a3412');
        ctx.beginPath();
        ctx.arc(15, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        line('#f97316');
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(17, -2);
        ctx.lineTo(24, -6);
        ctx.moveTo(17, 2);
        ctx.lineTo(24, 6);
        ctx.stroke();
        detail('#fde047');
        ctx.fillRect(15, -2, 2, 2);
        break;
      }
      case 'giant_otter': {
        paint('#6b4423');
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#4a2f1b');
        ctx.beginPath();
        ctx.arc(13, -4, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-13, 0);
        ctx.quadraticCurveTo(-24, -2, -26, 6);
        ctx.lineTo(-20, 4);
        ctx.closePath();
        ctx.fill();
        paint('#d6bfa3');
        ctx.beginPath();
        ctx.ellipse(3, 5, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(17, -6, 1.6, 0, Math.PI * 2);
        ctx.fill();
        line('#e7e5e4');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(27, -2);
        ctx.moveTo(20, 1);
        ctx.lineTo(27, 4);
        ctx.stroke();
        break;
      }
      case 'jaguar': {
        paint('#f59e0b');
        ctx.beginPath();
        ctx.ellipse(-2, 0, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(15, -5, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.quadraticCurveTo(-28, -8, -30, 2);
        ctx.lineTo(-22, 4);
        ctx.closePath();
        ctx.fill();
        paint('#d97706');
        ctx.beginPath();
        ctx.moveTo(11, -12);
        ctx.lineTo(14, -20);
        ctx.lineTo(18, -12);
        ctx.closePath();
        ctx.fill();
        detail('#111827');
        for (let i = 0; i < 8; i++) {
          const angle = i * 2.1;
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * 13, Math.sin(angle) * 7, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(16, -6, 2.2, 0, Math.PI * 2);
        ctx.fill();
        detail('#fef3c7');
        ctx.beginPath();
        ctx.arc(19, -2, 2.2, 0, Math.PI * 2);
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(19, -2, 1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'tapir': {
        paint('#44403c');
        ctx.beginPath();
        ctx.ellipse(-2, 1, 19, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#292524');
        ctx.beginPath();
        ctx.ellipse(16, -4, 9, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#57534e');
        ctx.beginPath();
        ctx.moveTo(21, -3);
        ctx.quadraticCurveTo(31, -2, 28, 6);
        ctx.quadraticCurveTo(25, 8, 20, 2);
        ctx.closePath();
        ctx.fill();
        paint('#e7e5e4');
        ctx.beginPath();
        ctx.moveTo(12, -12);
        ctx.lineTo(15, -19);
        ctx.lineTo(19, -11);
        ctx.closePath();
        ctx.fill();
        detail('#fef3c7');
        ctx.beginPath();
        ctx.arc(17, -6, 2, 0, Math.PI * 2);
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(17, -6, 1, 0, Math.PI * 2);
        ctx.fill();
        line('#1c1917');
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-12, 10);
        ctx.lineTo(-12, 16);
        ctx.moveTo(8, 10);
        ctx.lineTo(8, 16);
        ctx.stroke();
        break;
      }
      case 'goliath_spider': {
        line('#1c1917');
        ctx.lineWidth = 2.2;
        for (let i = 0; i < 4; i++) {
          const y = -8 + i * 5.5;
          ctx.beginPath();
          ctx.moveTo(-4, 0);
          ctx.lineTo(-16, y - 5);
          ctx.lineTo(-22, y);
          ctx.moveTo(4, 0);
          ctx.lineTo(16, y - 5);
          ctx.lineTo(22, y);
          ctx.stroke();
        }
        paint('#3f2a14');
        ctx.beginPath();
        ctx.ellipse(-5, 2, 11, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#1c1917');
        ctx.beginPath();
        ctx.arc(8, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        detail('#dc2626');
        ctx.beginPath();
        ctx.arc(10, -2, 1.7, 0, Math.PI * 2);
        ctx.arc(12, 1, 1.7, 0, Math.PI * 2);
        ctx.fill();
        detail('#fde047');
        ctx.beginPath();
        ctx.moveTo(13, 3);
        ctx.lineTo(18, 5);
        ctx.lineTo(13, 6);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'black_caiman': {
        paint('#14532d');
        ctx.beginPath();
        ctx.ellipse(-2, 0, 22, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#166534');
        ctx.beginPath();
        ctx.ellipse(16, 0, 11, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        paint('#052e16');
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-30, -7);
        ctx.lineTo(-28, 7);
        ctx.closePath();
        ctx.fill();
        paint('#14532d');
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-12 + i * 7, -7);
          ctx.lineTo(-9 + i * 7, -12);
          ctx.lineTo(-6 + i * 7, -7);
          ctx.closePath();
          ctx.fill();
        }
        detail('#fef08a');
        ctx.beginPath();
        ctx.moveTo(16, 4);
        ctx.lineTo(19, 8);
        ctx.lineTo(22, 4);
        ctx.closePath();
        ctx.fill();
        detail('#fbbf24');
        ctx.beginPath();
        ctx.arc(20, -3, 1.8, 0, Math.PI * 2);
        ctx.fill();
        detail('#111827');
        ctx.beginPath();
        ctx.arc(20, -3, 0.9, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
}
