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
      // Amazon Forest basics: deliberately fragile and quick.
      case 'bullet_ant':
        this.name = 'Formiga-bala';
        this.radius = 9;
        this.maxHp = Math.round(12 * hpMultiplier);
        this.speed = 210;
        this.damage = 6;
        this.xpValue = 4;
        this.knockbackResistance = 1.35;
        break;
      case 'leafcutter_ant':
        this.name = 'Formiga-cortadeira';
        this.radius = 13;
        this.maxHp = Math.round(26 * hpMultiplier);
        this.speed = 148;
        this.damage = 10;
        this.xpValue = 7;
        this.knockbackResistance = 0.9;
        break;
      case 'blue_butterfly':
        this.name = 'Borboleta-azul';
        this.radius = 10;
        this.maxHp = Math.round(14 * hpMultiplier);
        this.speed = 185;
        this.damage = 7;
        this.xpValue = 5;
        this.knockbackResistance = 1.25;
        break;
      case 'cicada':
        this.name = 'Cigarra';
        this.radius = 12;
        this.maxHp = Math.round(20 * hpMultiplier);
        this.speed = 165;
        this.damage = 8;
        this.xpValue = 6;
        this.knockbackResistance = 1.1;
        break;
      // Amazon Forest medium threats: tougher than the local insects, but
      // still well below elite level.
      case 'poison_dart_frog':
        this.name = 'Rã-dardo-venenosa';
        this.radius = 14;
        this.maxHp = Math.round(44 * hpMultiplier);
        this.speed = 120;
        this.damage = 13;
        this.xpValue = 14;
        this.knockbackResistance = 0.8;
        break;
      case 'praying_mantis':
        this.name = 'Louva-a-deus';
        this.radius = 15;
        this.maxHp = Math.round(38 * hpMultiplier);
        this.speed = 148;
        this.damage = 16;
        this.xpValue = 15;
        this.knockbackResistance = 0.9;
        break;
      case 'stick_bug':
        this.name = 'Bicho-pau';
        this.radius = 17;
        this.maxHp = Math.round(72 * hpMultiplier);
        this.speed = 70;
        this.damage = 14;
        this.xpValue = 18;
        this.knockbackResistance = 0.4;
        break;
      case 'toucan':
        this.name = 'Tucano';
        this.radius = 13;
        this.maxHp = Math.round(34 * hpMultiplier);
        this.speed = 170;
        this.damage = 12;
        this.xpValue = 14;
        this.knockbackResistance = 1.05;
        break;
      // Amazon Forest resistant fauna: slow, heavy and hard to put down.
      case 'capybara':
        this.name = 'Capivara';
        this.radius = 22;
        this.maxHp = Math.round(260 * hpMultiplier);
        this.speed = 46;
        this.damage = 20;
        this.xpValue = 42;
        this.knockbackResistance = 0.3;
        break;
      case 'sloth':
        this.name = 'Bicho-preguiça';
        this.radius = 20;
        this.maxHp = Math.round(220 * hpMultiplier);
        this.speed = 30;
        this.damage = 18;
        this.xpValue = 40;
        this.knockbackResistance = 0.22;
        break;
      case 'rhino_beetle':
        this.name = 'Besouro-rinoceronte';
        this.radius = 19;
        this.maxHp = Math.round(320 * hpMultiplier);
        this.speed = 52;
        this.damage = 24;
        this.xpValue = 55;
        this.knockbackResistance = 0.12;
        break;
      case 'sawyer_beetle':
        this.name = 'Besouro-serra-pau';
        this.radius = 18;
        this.maxHp = Math.round(240 * hpMultiplier);
        this.speed = 60;
        this.damage = 21;
        this.xpValue = 48;
        this.knockbackResistance = 0.2;
        break;
      case 'giant_centipede':
        this.name = 'Lacraia-gigante';
        this.radius = 24;
        this.maxHp = Math.round(280 * hpMultiplier);
        this.speed = 66;
        this.damage = 26;
        this.xpValue = 60;
        this.knockbackResistance = 0.16;
        break;
      // Rare Amazon Forest elites. Big, dangerous and loaded with XP/gold.
      case 'elite_jaguar':
        this.name = 'Onça-pintada Elite';
        this.radius = 30;
        this.maxHp = Math.round(620 * hpMultiplier);
        this.speed = 150;
        this.damage = 30;
        this.xpValue = 220;
        this.isElite = true;
        this.knockbackResistance = 0.24;
        this.skillCooldown = 3.2 + Math.random() * 1.5;
        break;
      case 'elite_tapir':
        this.name = 'Anta Elite';
        this.radius = 36;
        this.maxHp = Math.round(1050 * hpMultiplier);
        this.speed = 70;
        this.damage = 28;
        this.xpValue = 260;
        this.isElite = true;
        this.knockbackResistance = 0.14;
        this.skillCooldown = 5.5 + Math.random() * 1.5;
        break;
      case 'elite_goliath_spider':
        this.name = 'Aranha-golias Elite';
        this.radius = 32;
        this.maxHp = Math.round(780 * hpMultiplier);
        this.speed = 95;
        this.damage = 26;
        this.xpValue = 240;
        this.isElite = true;
        this.knockbackResistance = 0.18;
        this.skillCooldown = 4.0 + Math.random() * 1.5;
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
    } else if (this.type === 'bullet_ant') {
      // Small, glossy black ant with a red warning stripe: long and low.
      const legPhase = Math.sin(this.animTimer * 4) * 2;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#24140d';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-2, 1);
      ctx.lineTo(-8, 6 + legPhase);
      ctx.moveTo(-4, 0);
      ctx.lineTo(-10, 3 - legPhase);
      ctx.moveTo(-2, 0);
      ctx.lineTo(-7, -5 - legPhase);
      ctx.moveTo(3, 1);
      ctx.lineTo(8, 6 - legPhase);
      ctx.moveTo(4, 0);
      ctx.lineTo(10, 3 + legPhase);
      ctx.moveTo(3, 0);
      ctx.lineTo(8, -5 + legPhase);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#2b1a12';
      ctx.beginPath();
      ctx.ellipse(-7, 1, 6, 4, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(1, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(7, -1, 3.2, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#dc2626';
      ctx.fillRect(-10, -1.5, 3, 2);
      ctx.fillRect(-3, -1.5, 3, 2);

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#24140d';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(13, -6);
      ctx.moveTo(9, -2);
      ctx.lineTo(14, -2);
      ctx.moveTo(9, 1);
      ctx.lineTo(12, 4);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#fde68a';
      ctx.fillRect(7, -2, 1.5, 1.5);
    } else if (this.type === 'leafcutter_ant') {
      // Bulky reddish-brown ant carrying a bright green leaf above its head.
      const legPhase = Math.sin(this.animTimer * 3.2) * 2.4;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#3f1d10';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, 2);
      ctx.lineTo(-12, 8 + legPhase);
      ctx.moveTo(-6, 1);
      ctx.lineTo(-14, 4 - legPhase);
      ctx.moveTo(-5, 0);
      ctx.lineTo(-11, -5 - legPhase);
      ctx.moveTo(4, 2);
      ctx.lineTo(11, 8 - legPhase);
      ctx.moveTo(5, 1);
      ctx.lineTo(13, 4 + legPhase);
      ctx.moveTo(4, 0);
      ctx.lineTo(10, -5 + legPhase);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#7f2d1a';
      ctx.beginPath();
      ctx.ellipse(-8, 1, 8, 6, -0.1, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#a8432a';
      ctx.beginPath();
      ctx.arc(1, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#4d1f12';
      ctx.beginPath();
      ctx.arc(8, -1, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#2f130a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(10, -3);
      ctx.lineTo(14, -6);
      ctx.moveTo(11, 0);
      ctx.lineTo(15, 2);
      ctx.stroke();

      // Leaf fragment held over the body.
      if (!isFlashing) ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(-2, -12, 9, 4.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) {
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, -10);
        ctx.lineTo(-1, -15);
        ctx.stroke();
      }

      if (!isFlashing) ctx.fillStyle = '#fef3c7';
      ctx.fillRect(6, -3, 2, 2);
    } else if (this.type === 'blue_butterfly') {
      // Vivid blue wings that flap, with a thin dark body.
      const flap = 0.55 + Math.abs(Math.sin(this.animTimer * 2.2)) * 0.45;
      if (!isFlashing) ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.ellipse(-7, -2, 8, 10 * flap, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(7, -2, 8, 10 * flap, 0.35, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#60a5fa';
      ctx.beginPath();
      ctx.ellipse(-5, 7, 5.5, 6 * flap, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(5, 7, 5.5, 6 * flap, -0.25, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#bfdbfe';
      ctx.beginPath();
      ctx.arc(-7, -3, 2, 0, Math.PI * 2);
      ctx.arc(7, -3, 2, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(0, 1, 2.5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -9, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#1e293b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-1, -11);
      ctx.lineTo(-6, -16);
      ctx.moveTo(1, -11);
      ctx.lineTo(6, -16);
      ctx.stroke();
    } else if (this.type === 'cicada') {
      // Wide green body and translucent veined wings.
      const wingLift = Math.sin(this.animTimer * 1.7) * 2;
      ctx.globalAlpha = 0.72;
      if (!isFlashing) ctx.fillStyle = '#a5f3fc';
      ctx.beginPath();
      ctx.ellipse(-7, -1 + wingLift, 9, 4.5, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(7, -1 + wingLift, 9, 4.5, 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (!isFlashing) ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.ellipse(0, 3, 6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#365314';
      ctx.beginPath();
      ctx.arc(0, -7, 5, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-2.5, -8, 1.5, 0, Math.PI * 2);
      ctx.arc(2.5, -8, 1.5, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) {
        ctx.strokeStyle = '#0e7490';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(-12, -3 + wingLift);
        ctx.moveTo(3, 0);
        ctx.lineTo(12, -3 + wingLift);
        ctx.stroke();
      }
    } else if (this.type === 'poison_dart_frog') {
      // Warning colors: blue body, yellow dorsal stripe and black spots.
      const hop = Math.abs(Math.sin(this.animTimer * 2.4)) * 2;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#0891b2';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-8, 4 + hop);
      ctx.lineTo(-14, 9 + hop);
      ctx.moveTo(8, 4 + hop);
      ctx.lineTo(14, 9 + hop);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.ellipse(0, 1 + hop, 13, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(0, -1 + hop, 9.5, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-6, 4 + hop, 2.1, 0, Math.PI * 2);
      ctx.arc(5, 5 + hop, 1.8, 0, Math.PI * 2);
      ctx.arc(-1, -4 + hop, 1.4, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-5, -8 + hop, 3.4, 0, Math.PI * 2);
      ctx.arc(5, -8 + hop, 3.4, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(-5, -8 + hop, 1.6, 0, Math.PI * 2);
      ctx.arc(5, -8 + hop, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'praying_mantis') {
      // Slender mantis with folded raptorial forelegs and a triangular head.
      const stride = Math.sin(this.animTimer * 3.4);
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#3f6212';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-4, 6);
      ctx.lineTo(-11, 13 + stride * 2);
      ctx.moveTo(-2, 7);
      ctx.lineTo(-6, 15 - stride * 2);
      ctx.moveTo(4, 6);
      ctx.lineTo(11, 13 - stride * 2);
      ctx.moveTo(2, 7);
      ctx.lineTo(6, 15 + stride * 2);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.ellipse(-3, 4, 6.5, 12, 0.22, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.moveTo(1, -13);
      ctx.lineTo(-6, -3);
      ctx.lineTo(8, -3);
      ctx.closePath();
      ctx.fill();

      // Folded front arms.
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#3f6212';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, -1);
      ctx.lineTo(-11, -9);
      ctx.moveTo(6, -1);
      ctx.lineTo(13, -8);
      ctx.stroke();

      // Antennae.
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#365314';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-1, -13);
      ctx.lineTo(-6, -19);
      ctx.moveTo(3, -13);
      ctx.lineTo(8, -19);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#ecfccb';
      ctx.beginPath();
      ctx.arc(-2, -7, 1.8, 0, Math.PI * 2);
      ctx.arc(4, -7, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'stick_bug') {
      // Long twig-like body with branch legs and a tiny head.
      const sway = Math.sin(this.animTimer * 1.6) * 1.8;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#422006';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-9, 5);
      ctx.lineTo(-15, 11 + sway);
      ctx.moveTo(-7, 5);
      ctx.lineTo(-11, 13 - sway);
      ctx.moveTo(6, 5);
      ctx.lineTo(13, 11 - sway);
      ctx.moveTo(8, 5);
      ctx.lineTo(10, 13 + sway);
      ctx.stroke();

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#78350f';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-15, 1 + sway);
      ctx.lineTo(13, -2 + sway);
      ctx.stroke();
      ctx.lineCap = 'butt';

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#92400e';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-6, 0 + sway);
      ctx.lineTo(-13, -3 + sway);
      ctx.moveTo(3, -1 + sway);
      ctx.lineTo(10, -5 + sway);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(15, -2 + sway, 3.2, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fde68a';
      ctx.fillRect(15, -3 + sway, 1.5, 1.5);
    } else if (this.type === 'toucan') {
      // Black bird with a huge orange beak and flapping wings.
      const flap = Math.sin(this.animTimer * 2.6) * 4;
      if (!isFlashing) ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.ellipse(-10, -1, 6, 9 + flap * 0.4, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(10, -1, 6, 9 - flap * 0.4, 0.5, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(4, 3, 5, 6.5, 0.1, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(6, -5);
      ctx.lineTo(21, -1);
      ctx.lineTo(7, 4);
      ctx.closePath();
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(7, -1);
      ctx.lineTo(18, -1);
      ctx.lineTo(7, 2);
      ctx.closePath();
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(2, -6, 3, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(3, -6, 1.5, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-2, 10);
        ctx.lineTo(-4, 15);
        ctx.moveTo(3, 10);
        ctx.lineTo(5, 15);
        ctx.stroke();
      }
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
    } else if (this.type === 'capybara') {
      // Heavy brown rodent: barrel body, stubby legs and a blunt muzzle.
      const step = Math.sin(this.animTimer * 2.2);
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#4a2f1d';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-11, 8);
      ctx.lineTo(-12, 15 + step * 2);
      ctx.moveTo(-3, 9);
      ctx.lineTo(-2, 16 - step * 2);
      ctx.moveTo(7, 9);
      ctx.lineTo(8, 16 - step * 2);
      ctx.moveTo(14, 8);
      ctx.lineTo(16, 15 + step * 2);
      ctx.stroke();
      ctx.lineCap = 'butt';

      if (!isFlashing) ctx.fillStyle = '#8b5e3c';
      ctx.beginPath();
      ctx.ellipse(-3, 1, 19, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#a47148';
      ctx.beginPath();
      ctx.ellipse(16, -2, 9, 8, 0.12, 0, Math.PI * 2);
      ctx.fill();

      // Small rounded ears.
      if (!isFlashing) ctx.fillStyle = '#6b4423';
      ctx.beginPath();
      ctx.arc(12, -9, 3, 0, Math.PI * 2);
      ctx.arc(20, -8, 3, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#3f2a17';
      ctx.beginPath();
      ctx.ellipse(24, 0, 3.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(18, -4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'sloth') {
      // Shaggy grey body, sleepy face and long hooked claws.
      const sway = Math.sin(this.animTimer * 0.55) * 2;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#57534e';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-5, -2);
      ctx.lineTo(-14, 8 + sway);
      ctx.moveTo(6, -4);
      ctx.lineTo(17, 4 - sway);
      ctx.moveTo(-7, 8);
      ctx.lineTo(-10, 16);
      ctx.moveTo(7, 8);
      ctx.lineTo(9, 16);
      ctx.stroke();
      ctx.lineCap = 'butt';

      if (!isFlashing) ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.ellipse(0, 2, 15, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#a8a29e';
      ctx.beginPath();
      ctx.arc(7, -12, 9, 0, Math.PI * 2);
      ctx.fill();

      // Dark eye patches and closed sleepy eyes.
      if (!isFlashing) ctx.fillStyle = '#44403c';
      ctx.beginPath();
      ctx.ellipse(4, -13, 3, 2.5, -0.3, 0, Math.PI * 2);
      ctx.ellipse(11, -12, 3, 2.5, 0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#1c1917';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2.5, -13);
      ctx.lineTo(5.5, -13);
      ctx.moveTo(9.5, -12);
      ctx.lineTo(12.5, -12);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.ellipse(8, -8, 2, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hooked claws on the long arms.
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#e7e5e4';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-15, 8 + sway);
      ctx.lineTo(-18, 11 + sway);
      ctx.moveTo(-13, 9 + sway);
      ctx.lineTo(-15, 13 + sway);
      ctx.moveTo(17, 4 - sway);
      ctx.lineTo(21, 6 - sway);
      ctx.moveTo(16, 6 - sway);
      ctx.lineTo(19, 9 - sway);
      ctx.stroke();
    } else if (this.type === 'rhino_beetle') {
      // Armoured black beetle with a large forked horn.
      const legPhase = Math.sin(this.animTimer * 4.5) * 2;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#1c1917';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-8, 8);
      ctx.lineTo(-14, 14 + legPhase);
      ctx.moveTo(-2, 9);
      ctx.lineTo(-6, 16 - legPhase);
      ctx.moveTo(5, 9);
      ctx.lineTo(10, 16 + legPhase);
      ctx.moveTo(11, 7);
      ctx.lineTo(16, 13 - legPhase);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.ellipse(-2, 1, 19, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) {
        ctx.strokeStyle = '#57534e';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-19, -2);
        ctx.lineTo(14, -1);
        ctx.stroke();
      }

      if (!isFlashing) ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.ellipse(14, -2, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Forward horn with a small fork at the tip.
      if (!isFlashing) ctx.fillStyle = '#44403c';
      ctx.beginPath();
      ctx.moveTo(15, -7);
      ctx.quadraticCurveTo(24, -13, 30, -8);
      ctx.lineTo(24, -4);
      ctx.quadraticCurveTo(20, -6, 15, -2);
      ctx.closePath();
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.moveTo(27, -9);
      ctx.lineTo(33, -12);
      ctx.lineTo(30, -7);
      ctx.closePath();
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(16, -4, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'sawyer_beetle') {
      // Slender brown longhorn beetle with serrated antennae.
      const legPhase = Math.sin(this.animTimer * 5) * 1.8;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#451a03';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-10, 6);
      ctx.lineTo(-17, 12 + legPhase);
      ctx.moveTo(-4, 7);
      ctx.lineTo(-8, 14 - legPhase);
      ctx.moveTo(3, 7);
      ctx.lineTo(7, 14 + legPhase);
      ctx.moveTo(10, 5);
      ctx.lineTo(15, 11 - legPhase);
      ctx.stroke();

      // Long serrated antennae.
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#78350f';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(17, -4);
      ctx.lineTo(25, -11);
      ctx.lineTo(31, -9);
      ctx.moveTo(17, -1);
      ctx.lineTo(26, 1);
      ctx.lineTo(31, 4);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const ax = 22 + i * 4;
        const ay = -10 + i * 0.7;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + 1.5, ay - 3);
        ctx.moveTo(ax + 1, 1 + i * 0.9);
        ctx.lineTo(ax + 2.5, 4 + i * 0.9);
        ctx.stroke();
      }

      if (!isFlashing) ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(-3, 0, 21, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) {
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-23, 0);
        ctx.lineTo(16, -1);
        ctx.stroke();
      }

      if (!isFlashing) ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.arc(-8, -3, 2.2, 0, Math.PI * 2);
      ctx.arc(1, 3, 1.8, 0, Math.PI * 2);
      ctx.arc(7, -4, 1.6, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.arc(17, -2, 5.5, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(19, -4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'giant_centipede') {
      // Long segmented body with a rippling leg wave and forked tail.
      const legPhase = this.animTimer * 7;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#7f1d1d';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const sx = -18 + i * 6.2;
        const wave = Math.sin(legPhase + i * 0.9) * 3;
        ctx.beginPath();
        ctx.moveTo(sx, 3);
        ctx.lineTo(sx - 3, 12 + wave);
        ctx.moveTo(sx, -3);
        ctx.lineTo(sx + 3, -11 - wave);
        ctx.stroke();
      }

      for (let i = 0; i < 8; i++) {
        const sx = -22 + i * 6;
        const sy = Math.sin(this.animTimer * 0.9 + i * 0.75) * 1.4;
        if (!isFlashing) ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#7f1d1d';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 5.5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Forked tail.
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#7f1d1d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.lineTo(-35, -5);
      ctx.moveTo(-28, 0);
      ctx.lineTo(-35, 5);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#450a0a';
      ctx.beginPath();
      ctx.arc(23, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Mandibles and antennae.
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#450a0a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(27, -3);
      ctx.lineTo(34, -8);
      ctx.moveTo(27, 3);
      ctx.lineTo(34, 8);
      ctx.moveTo(25, -4);
      ctx.lineTo(30, -7);
      ctx.moveTo(25, 4);
      ctx.lineTo(30, 7);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(25, -2, 1.5, 0, Math.PI * 2);
      ctx.arc(25, 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'elite_jaguar') {
      // Large spotted jaguar: low prowling body, muscular legs and a sweeping tail.
      ctx.save();
      const stride = Math.sin(this.animTimer * 3.8);
      const tailSway = Math.sin(this.animTimer * 2.1) * 6;

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#92400e';
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-17, 10);
      ctx.lineTo(-21, 23 + stride * 3);
      ctx.moveTo(-7, 12);
      ctx.lineTo(-4, 25 - stride * 3);
      ctx.moveTo(11, 12);
      ctx.lineTo(15, 25 + stride * 3);
      ctx.moveTo(19, 10);
      ctx.lineTo(25, 22 - stride * 3);
      ctx.stroke();
      ctx.lineCap = 'butt';

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#b45309';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-25, 0);
      ctx.quadraticCurveTo(-38, -8 + tailSway, -43, 5 + tailSway);
      ctx.stroke();
      if (!isFlashing) {
        ctx.fillStyle = '#3f2a14';
        ctx.beginPath();
        ctx.arc(-42, 5 + tailSway, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!isFlashing) {
        const bodyGrad = ctx.createLinearGradient(0, -18, 0, 18);
        bodyGrad.addColorStop(0, '#f59e0b');
        bodyGrad.addColorStop(0.55, '#d97706');
        bodyGrad.addColorStop(1, '#92400e');
        ctx.fillStyle = bodyGrad;
      }
      ctx.beginPath();
      ctx.ellipse(-3, 2, 27, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.ellipse(25, -3, 14, 12, 0.08, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(19, -14, 5, 0, Math.PI * 2);
      ctx.arc(31, -13, 4.5, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.ellipse(36, 1, 7, 5.5, 0.08, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) {
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.ellipse(41, -0.5, 2.1, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(34, 4);
        ctx.lineTo(39, 3.2);
        ctx.stroke();
      }

      if (!isFlashing) {
        ctx.strokeStyle = '#3f2a14';
        ctx.lineWidth = 2.2;
        const rosettes: [number, number][] = [
          [-16, -3],
          [-5, 6],
          [6, -4],
          [16, 5],
          [-21, 7],
          [2, -8],
        ];
        for (let i = 0; i < rosettes.length; i++) {
          ctx.beginPath();
          ctx.arc(rosettes[i][0], rosettes[i][1], 3.6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#3f2a14';
          ctx.beginPath();
          ctx.arc(rosettes[i][0], rosettes[i][1], 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!isFlashing) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(28, -8, 2.5, 0, Math.PI * 2);
        ctx.arc(35, -6, 2.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(28.7, -8, 1.1, 0, Math.PI * 2);
        ctx.arc(35.6, -6, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#fef3c7';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(38, 4);
      ctx.lineTo(41, 6);
      ctx.moveTo(-20, 23 + stride * 3);
      ctx.lineTo(-23, 25 + stride * 3);
      ctx.moveTo(15, 25 + stride * 3);
      ctx.lineTo(18, 27 + stride * 3);
      ctx.stroke();

      ctx.restore();
    } else if (this.type === 'elite_tapir') {
      // Massive tapir: barrel body, stubby hooves and the iconic flexible snout.
      ctx.save();
      const stride = Math.sin(this.animTimer * 2.4);
      const earTwitch = Math.sin(this.animTimer * 1.3) * 1.5;

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#374151';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-21, 11);
      ctx.lineTo(-23, 26 + stride * 2);
      ctx.moveTo(-9, 13);
      ctx.lineTo(-7, 27 - stride * 2);
      ctx.moveTo(9, 13);
      ctx.lineTo(11, 27 + stride * 2);
      ctx.moveTo(20, 11);
      ctx.lineTo(24, 26 - stride * 2);
      ctx.stroke();
      ctx.lineCap = 'butt';

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#4b5563';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-30, -4);
      ctx.lineTo(-36, 2);
      ctx.stroke();

      if (!isFlashing) {
        const bodyGrad = ctx.createLinearGradient(0, -22, 0, 20);
        bodyGrad.addColorStop(0, '#9ca3af');
        bodyGrad.addColorStop(0.55, '#6b7280');
        bodyGrad.addColorStop(1, '#4b5563');
        ctx.fillStyle = bodyGrad;
      }
      ctx.beginPath();
      ctx.ellipse(-5, 0, 30, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.ellipse(22, -6, 15, 12, 0.06, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#4b5563';
      ctx.beginPath();
      ctx.ellipse(17, -17 + earTwitch * 0.2, 4.5, 7, -0.35, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      ctx.moveTo(30, -13);
      ctx.quadraticCurveTo(45, -12, 46, -2);
      ctx.quadraticCurveTo(46, 5, 39, 4);
      ctx.quadraticCurveTo(34, 2, 31, -2);
      ctx.closePath();
      ctx.fill();

      if (!isFlashing) {
        ctx.fillStyle = '#374151';
        ctx.beginPath();
        ctx.ellipse(45, -2, 2.4, 3.2, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(40, 4);
        ctx.lineTo(45, 3);
        ctx.stroke();
      }

      if (!isFlashing) ctx.fillStyle = 'rgba(209, 213, 219, 0.45)';
      ctx.beginPath();
      ctx.ellipse(-6, 10, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) {
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(25, -10, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f9fafb';
        ctx.beginPath();
        ctx.arc(25.7, -10.7, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!isFlashing) {
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.ellipse(-23, 27 + stride * 2, 4.5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(-7, 28 - stride * 2, 4.5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(11, 28 + stride * 2, 4.5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(24, 27 - stride * 2, 4.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    } else if (this.type === 'elite_goliath_spider') {
      // Goliath birdeater: eight jointed legs, huge abdomen and a cluster of eyes.
      ctx.save();
      const legPhase = this.animTimer * 3.4;

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#57534e';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const baseY = -7 + i * 5;
        const reach = 18 + i * 4;
        const wave = Math.sin(legPhase + i * 1.25) * 3;
        ctx.beginPath();
        ctx.moveTo(-8, baseY);
        ctx.lineTo(-reach, baseY - 13 + wave);
        ctx.lineTo(-reach - 9, baseY + 4 + wave);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, baseY);
        ctx.lineTo(reach, baseY - 13 - wave);
        ctx.lineTo(reach + 9, baseY + 4 - wave);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';

      if (!isFlashing) {
        const abdomenGrad = ctx.createRadialGradient(-18, -4, 3, -14, 2, 24);
        abdomenGrad.addColorStop(0, '#92400e');
        abdomenGrad.addColorStop(0.6, '#78350f');
        abdomenGrad.addColorStop(1, '#451a03');
        ctx.fillStyle = abdomenGrad;
      }
      ctx.beginPath();
      ctx.ellipse(-15, 3, 21, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.ellipse(12, -1, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) {
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.ellipse(22, 6, 4.5, 5.5, 0.3, 0, Math.PI * 2);
        ctx.ellipse(27, 4, 3.5, 4.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(23, 10);
        ctx.lineTo(24, 14);
        ctx.moveTo(27, 8);
        ctx.lineTo(29, 12);
        ctx.stroke();
      }

      if (!isFlashing) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(15, -6, 1.9, 0, Math.PI * 2);
        ctx.arc(19, -7, 1.7, 0, Math.PI * 2);
        ctx.arc(15, 0, 1.6, 0, Math.PI * 2);
        ctx.arc(20, 1, 1.5, 0, Math.PI * 2);
        ctx.arc(11, -8, 1.2, 0, Math.PI * 2);
        ctx.arc(23, -3, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(16, -6, 0.8, 0, Math.PI * 2);
        ctx.arc(20, -7, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!isFlashing) {
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2;
          const hx = -15 + Math.cos(angle) * 21;
          const hy = 3 + Math.sin(angle) * 18;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx + Math.cos(angle) * 4, hy + Math.sin(angle) * 4);
          ctx.stroke();
        }
      }

      ctx.restore();
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
}
