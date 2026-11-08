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
  public isAquatic: boolean = false;
  // Water ambush state, refreshed by the engine every frame.
  public isSubmerged: boolean = false;
  public playerInWater: boolean = false;
  // Rate limiter for the water splash/ripple trail while walking in the river.
  public waterRippleTimer: number = Math.random() * 0.2;
  // Set by the engine for the Amazon Forest night frenzy (+25% speed).
  public isAmazonNight: boolean = false;
  public terrainSpeedMultiplier: number = 1;
  public name: string = '';
  private spriteImage: HTMLImageElement | null = null;

  // Dynamic food-chain ecology (Amazon Forest). The engine assigns a target
  // when the hero is far away so herbivores can graze and tapirs can forage.
  public ecologyTargetX: number | null = null;
  public ecologyTargetY: number | null = null;
  public ecologyTargetTreeId: number | null = null;
  public ecologyHuntTimer: number = 0;
  public ecologyActionCooldown: number = 0;
  public ecologyGrazingTimer: number = 0;
  public growthScale: number = 1;
  public ecologyFedCount: number = 0;
  public shieldHp: number = 0;

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

  // Amazon Forest boss attacks (resolved by GameEngine).
  public pendingFireballBurst: number = 0;
  public pendingEmberTrail: boolean = false;
  public pendingTeleport: boolean = false;
  public pendingWindBurst: number = 0;
  public pendingSoundWave: boolean = false;
  // Iara (water jets + slowing puddles), Caipora (wild summons) and
  // Matinta Pereira (sonic whistles + shadow birds).
  public pendingWaterJet: number = 0;
  public pendingSlowPool: boolean = false;
  public pendingSummonWild: number = 0;
  public pendingSonicWave: boolean = false;
  public pendingSummonBirds: number = 0;
  // Vitória-Régia (poison spore rings + thorn roots) and Mapinguari
  // (ground stomp + sonic roar).
  public pendingSporeRing: number = 0;
  public pendingThornRoots: boolean = false;
  public pendingStomp: boolean = false;
  public pendingRoar: boolean = false;
  // Cobra-Grande (long lunges) and Boitatá (fire trail + radial fireballs).
  public emberTrailTimer: number = 0;
  public pendingFireRing: number = 0;

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
      // Aquatic Amazon Forest fauna: exclusive to the river and lakes.
      case 'piranha':
        this.name = 'Piranha';
        this.radius = 10;
        this.maxHp = Math.round(14 * hpMultiplier);
        this.speed = 195;
        this.damage = 7;
        this.xpValue = 5;
        this.knockbackResistance = 1.25;
        this.isAquatic = true;
        break;
      case 'pink_river_dolphin':
        this.name = 'Boto-cor-de-rosa';
        this.radius = 18;
        this.maxHp = Math.round(55 * hpMultiplier);
        this.speed = 130;
        this.damage = 15;
        this.xpValue = 18;
        this.knockbackResistance = 0.7;
        this.isAquatic = true;
        break;
      case 'giant_otter':
        this.name = 'Ariranha';
        this.radius = 20;
        this.maxHp = Math.round(300 * hpMultiplier);
        this.speed = 78;
        this.damage = 24;
        this.xpValue = 58;
        this.knockbackResistance = 0.15;
        this.isAquatic = true;
        break;
      case 'elite_black_caiman':
        this.name = 'Jacaré-açu Elite';
        this.radius = 34;
        this.maxHp = Math.round(900 * hpMultiplier);
        this.speed = 85;
        this.damage = 32;
        this.xpValue = 280;
        this.isElite = true;
        this.knockbackResistance = 0.15;
        this.isAquatic = true;
        this.skillCooldown = 4.5 + Math.random() * 1.5;
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
      // Amazon Forest bosses: each wave uses one of these three guardians.
      case 'boss_curupira':
        this.name = 'Curupira (Guardião da Floresta)';
        this.radius = 38;
        this.maxHp = Math.round(1200 * hpMultiplier);
        this.speed = 88;
        this.damage = 30;
        this.xpValue = 520;
        this.isBoss = true;
        this.knockbackResistance = 0.06;
        this.skillCooldown = 2.2;
        break;
      case 'boss_saci':
        this.name = 'Saci-pererê (Redemoinho)';
        this.radius = 30;
        this.maxHp = Math.round(1000 * hpMultiplier);
        this.speed = 122;
        this.damage = 24;
        this.xpValue = 480;
        this.isBoss = true;
        this.knockbackResistance = 0.08;
        this.skillCooldown = 2.6;
        break;
      case 'boss_boto':
        this.name = 'Boto-cor-de-rosa (Encantado)';
        this.radius = 40;
        this.maxHp = Math.round(1300 * hpMultiplier);
        this.speed = 94;
        this.damage = 32;
        this.xpValue = 560;
        this.isBoss = true;
        this.knockbackResistance = 0.07;
        this.skillCooldown = 2.8;
        break;
      case 'boss_iara':
        this.name = 'Iara (Senhora das Águas)';
        this.radius = 34;
        this.maxHp = Math.round(1500 * hpMultiplier);
        this.speed = 84;
        this.damage = 28;
        this.xpValue = 540;
        this.isBoss = true;
        this.knockbackResistance = 0.07;
        this.skillCooldown = 2.6;
        break;
      case 'boss_caipora':
        this.name = 'Caipora (Protetor da Mata)';
        this.radius = 36;
        this.maxHp = Math.round(1650 * hpMultiplier);
        this.speed = 100;
        this.damage = 30;
        this.xpValue = 580;
        this.isBoss = true;
        this.knockbackResistance = 0.06;
        this.skillCooldown = 2.8;
        break;
      case 'boss_matinta':
        this.name = 'Matinta Pereira (Bruxa da Floresta)';
        this.radius = 34;
        this.maxHp = Math.round(1800 * hpMultiplier);
        this.speed = 96;
        this.damage = 31;
        this.xpValue = 620;
        this.isBoss = true;
        this.knockbackResistance = 0.07;
        this.skillCooldown = 2.6;
        break;
      case 'boss_vitoria_regia':
        this.name = 'Vitória-Régia (Dama das Águas)';
        this.radius = 46;
        this.maxHp = Math.round(2200 * hpMultiplier);
        this.speed = 46;
        this.damage = 34;
        this.xpValue = 700;
        this.isBoss = true;
        this.knockbackResistance = 0.05;
        this.skillCooldown = 3.0;
        break;
      case 'boss_mapinguari':
        this.name = 'Mapinguari (Colosso da Mata)';
        this.radius = 52;
        this.maxHp = Math.round(3300 * hpMultiplier);
        this.speed = 52;
        this.damage = 40;
        this.xpValue = 900;
        this.isBoss = true;
        this.knockbackResistance = 0.03;
        this.skillCooldown = 3.2;
        break;
      case 'boss_cobra_grande':
        this.name = 'Cobra-Grande (Boiúna)';
        this.radius = 50;
        this.maxHp = Math.round(4200 * hpMultiplier);
        this.speed = 118;
        this.damage = 44;
        this.xpValue = 1000;
        this.isBoss = true;
        this.knockbackResistance = 0.03;
        this.skillCooldown = 1.6;
        break;
      case 'boss_boitata':
        this.name = 'Boitatá (Chefe Final)';
        this.radius = 48;
        this.maxHp = Math.round(5200 * hpMultiplier);
        this.speed = 124;
        this.damage = 46;
        this.xpValue = 1200;
        this.isBoss = true;
        this.knockbackResistance = 0.03;
        this.skillCooldown = 2.2;
        break;
    }

    // Predators start their hunt cycle with the requested delay.
    if (this.type === 'elite_black_caiman' || this.type === 'boss_cobra_grande') {
      this.ecologyHuntTimer = 10 + Math.random() * 2;
    } else if (this.type === 'elite_jaguar') {
      this.ecologyHuntTimer = 15;
    }

    this.hp = this.maxHp;
  }

  /**
   * Jacaré-açu and the giant river serpent (Sucuri / Cobra-Grande) are tied to
   * the river: they flee on dry forest ground, attack in the water and never
   * leave the river and its beach.
   */
  public get isRiverPredator(): boolean {
    return this.type === 'elite_black_caiman' || this.type === 'boss_cobra_grande';
  }

  /** Piranha, Boto-cor-de-rosa and Ariranha hide underwater unless the hero is wet. */
  public get isAmbushAquatic(): boolean {
    return (
      this.type === 'piranha' ||
      this.type === 'pink_river_dolphin' ||
      this.type === 'giant_otter'
    );
  }

  /** Herbivores that leave the hunt to graze on the riverbank crops. */
  public get isGrazingHerbivore(): boolean {
    return (
      this.type === 'capybara' ||
      this.type === 'sloth' ||
      this.type === 'rhino_beetle' ||
      this.type === 'sawyer_beetle' ||
      this.type === 'bullet_ant' ||
      this.type === 'leafcutter_ant'
    );
  }

  /** Only the Anta (elite tapir) searches for fruit trees on its own. */
  public get isFruitForager(): boolean {
    return this.type === 'elite_tapir';
  }

  /** Jacaré-açu, Sucuri and Onça-pintada grow by devouring other animals. */
  public get isEcologyPredator(): boolean {
    return (
      this.type === 'elite_black_caiman' ||
      this.type === 'boss_cobra_grande' ||
      this.type === 'elite_jaguar'
    );
  }

  public get isJaguarPredator(): boolean {
    return this.type === 'elite_jaguar';
  }

  /** The Anta restores health and raises a damage-absorbing shield. */
  public feedOnFruit(): void {
    const heal = Math.max(1, Math.round(this.maxHp * 0.2));
    this.hp = Math.min(this.maxHp, this.hp + heal);
    this.shieldHp = Math.max(this.shieldHp, Math.round(this.maxHp * 0.3));
  }

  /**
   * Grows after devouring prey. Jacaré-açu/Sucuri gain +15% max HP and +12%
   * damage per meal; the Onça also becomes faster. There is no growth cap.
   */
  public growFromPrey(): void {
    const oldMaxHp = this.maxHp;
    if (this.isJaguarPredator) {
      this.maxHp = Math.round(this.maxHp * 1.12);
      this.speed *= 1.06;
      this.damage = Math.max(1, Math.round(this.damage * 1.1));
    } else {
      this.maxHp = Math.round(this.maxHp * 1.15);
      this.damage = Math.max(1, Math.round(this.damage * 1.12));
    }
    this.hp = Math.min(this.maxHp, this.hp + Math.max(1, this.maxHp - oldMaxHp));
    this.growthScale *= 1.07;
    this.ecologyFedCount += 1;
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
    // Ecology target (beach or fruit tree) only replaces the standard walk;
    // combat skills still aim at the hero.
    const moveDx = (this.ecologyTargetX ?? player.x) - this.x;
    const moveDy = (this.ecologyTargetY ?? player.y) - this.y;
    const moveDist = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
    const terrainMult =
      this.isRiverPredator && this.playerInWater ? this.terrainSpeedMultiplier : 1.0;
    const speedMult =
      (this.slowTimer > 0 ? Math.max(0.35, 1 - this.slowFactor) : 1.0) * terrainMult;
    // Forest night frenzy: +25% movement speed only (skills keep their cadence).
    const movementMult = speedMult * (this.isAmazonNight ? 1.25 : 1.0);

    // River predators flee while the hero stays in the forest. They only
    // charge (and use their skills) once the hero steps into the water.
    if (this.isRiverPredator && !this.playerInWater) {
      // Cancel any charge/lunge started while the hero was still in the water.
      this.skillState = 'idle';
      this.skillStateTimer = 0;
      if (dist > 0) {
        const fleeSpeed = this.speed * movementMult;
        this.x += (-dx / dist) * fleeSpeed * dt;
        this.y += (-dy / dist) * fleeSpeed * dt;
      }
      return this.hp > 0;
    }

    // Elite & Boss special skill state machine
    if (this.isElite || this.isBoss) {
      this.updateSpecialSkills(dt, dx, dy, dist, speedMult);
    }

    if (this.skillState === 'dashing') {
      const baseDashSpeed =
        this.type === 'boss_cobra_grande'
          ? 620
          : this.type === 'boss_boitata'
            ? 340
            : this.isBoss
              ? 275
              : 210;
      const dashSpeed = baseDashSpeed * movementMult;
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
        this.x += (dx / dist) * this.speed * 0.25 * movementMult * dt;
        this.y += (dy / dist) * this.speed * 0.25 * movementMult * dt;
      }
      return this.hp > 0;
    }

    // Standard movement towards the current walk target (player by default).
    if (moveDist > 0) {
      const currentSpeed = this.speed * movementMult;
      let vx = (moveDx / moveDist) * currentSpeed;
      let vy = (moveDy / moveDist) * currentSpeed;

      // Add separation force from flocking
      vx += separation.vx * currentSpeed * 0.8;
      vy += separation.vy * currentSpeed * 0.8;

      // Special ghost waving movement
      if (this.type === 'ghost') {
        const norm = dist > 0 ? dist : 1;
        const perpX = -dy / norm;
        const perpY = dx / norm;
        const wave = Math.sin(this.animTimer * 1.5) * 44 * movementMult;
        vx += perpX * wave;
        vy += perpY * wave;
      }

      this.x += vx * dt;
      this.y += vy * dt;
    }

    return this.hp > 0;
  }

  private updateSpecialSkills(dt: number, dx: number, dy: number, dist: number, speedMult: number): void {
    if (
      this.type === 'boss_curupira' ||
      this.type === 'boss_saci' ||
      this.type === 'boss_boto' ||
      this.type === 'boss_iara' ||
      this.type === 'boss_caipora' ||
      this.type === 'boss_matinta' ||
      this.type === 'boss_vitoria_regia' ||
      this.type === 'boss_mapinguari' ||
      this.type === 'boss_cobra_grande' ||
      this.type === 'boss_boitata'
    ) {
      this.updateAmazonBossSkills(dt, dx, dy, dist, speedMult);
      return;
    }

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

  private updateAmazonBossSkills(
    dt: number,
    dx: number,
    dy: number,
    dist: number,
    speedMult: number
  ): void {
    // Boitatá leaves a continuous line of fire behind it wherever it slithers.
    if (this.type === 'boss_boitata') {
      this.emberTrailTimer -= dt;
      if (this.emberTrailTimer <= 0) {
        this.emberTrailTimer = 0.22;
        this.pendingEmberTrail = true;
      }
    }

    // Cobra-Grande uses long, fast lunges that carry it across land and river.
    if (this.type === 'boss_cobra_grande') {
      if (this.skillState === 'telegraph_dash') {
        this.skillStateTimer -= dt;
        if (this.skillStateTimer <= 0) {
          this.skillState = 'dashing';
          this.skillDuration = 0.95;
          this.skillStateTimer = 0.95;
        }
        return;
      }
      if (this.skillState === 'dashing') {
        this.skillStateTimer -= dt;
        if (this.skillStateTimer <= 0) {
          this.skillState = 'idle';
          this.skillCooldown = 1.8;
        }
        return;
      }

      this.skillCooldown -= dt * speedMult;
      if (this.skillCooldown > 0 || dist > 900) return;

      const norm = dist > 0 ? dist : 1;
      this.dashDirX = dx / norm;
      this.dashDirY = dy / norm;
      this.skillState = 'telegraph_dash';
      this.skillDuration = 0.55;
      this.skillStateTimer = 0.55;
      this.skillCooldown = 2.1;
      return;
    }

    // Caipora's mounted charge has its own short state machine so the engine's
    // existing dash movement can carry it toward the player.
    if (this.type === 'boss_caipora') {
      if (this.skillState === 'telegraph_dash') {
        this.skillStateTimer -= dt;
        if (this.skillStateTimer <= 0) {
          this.skillState = 'dashing';
          this.skillDuration = 0.5;
          this.skillStateTimer = 0.5;
        }
        return;
      }
      if (this.skillState === 'dashing') {
        this.skillStateTimer -= dt;
        if (this.skillStateTimer <= 0) {
          this.skillState = 'idle';
          this.skillCooldown = 3.0;
        }
        return;
      }
    }

    this.skillCooldown -= dt * speedMult;
    if (this.skillCooldown > 0 || dist > 760) return;

    if (this.type === 'boss_curupira') {
      if (this.bossSkillIndex % 2 === 0) {
        this.pendingEmberTrail = true;
      } else {
        this.pendingFireballBurst = 3;
      }
      this.skillCooldown = 2.4;
    } else if (this.type === 'boss_saci') {
      if (this.bossSkillIndex % 2 === 0) {
        this.pendingTeleport = true;
      } else {
        this.pendingWindBurst += 1;
      }
      this.skillCooldown = 2.8;
    } else if (this.type === 'boss_boto') {
      this.pendingSoundWave = true;
      this.skillCooldown = 3.0;
    } else if (this.type === 'boss_iara') {
      if (this.bossSkillIndex % 2 === 0) {
        this.pendingWaterJet = 3;
      } else {
        this.pendingSlowPool = true;
      }
      this.skillCooldown = 2.8;
    } else if (this.type === 'boss_caipora') {
      if (this.bossSkillIndex % 2 === 0) {
        const norm = dist > 0 ? dist : 1;
        this.dashDirX = dx / norm;
        this.dashDirY = dy / norm;
        this.skillState = 'telegraph_dash';
        this.skillDuration = 0.5;
        this.skillStateTimer = 0.5;
      } else {
        this.pendingSummonWild = 5;
      }
      this.skillCooldown = 3.2;
    } else if (this.type === 'boss_matinta') {
      if (this.bossSkillIndex % 2 === 0) {
        this.pendingSonicWave = true;
      } else {
        this.pendingSummonBirds = 6;
      }
      this.skillCooldown = 2.6;
    } else if (this.type === 'boss_vitoria_regia') {
      if (this.bossSkillIndex % 2 === 0) {
        this.pendingSporeRing += 1;
      } else {
        this.pendingThornRoots = true;
      }
      this.skillCooldown = 3.2;
    } else if (this.type === 'boss_mapinguari') {
      if (this.bossSkillIndex % 2 === 0) {
        this.pendingStomp = true;
      } else {
        this.pendingRoar = true;
      }
      this.skillCooldown = 3.4;
    } else if (this.type === 'boss_boitata') {
      // Alternates a radial fire burst with a wide fan of fireballs.
      if (this.bossSkillIndex % 2 === 0) {
        this.pendingFireRing = 12;
      } else {
        this.pendingFireballBurst = 7;
      }
      this.skillCooldown = 2.4;
    }

    this.bossSkillIndex += 1;
  }

  takeDamage(amount: number, knockX: number = 0, knockY: number = 0, knockForce: number = 200): boolean {
    // Submerged ambush fauna is intangible: no damage, knockback or death.
    if (this.isSubmerged) return false;

    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, amount);
      this.shieldHp -= absorbed;
      amount -= absorbed;
    }

    this.hp -= amount;
    this.hitFlashTimer = 0.12;

    this.knockbackX += knockX * knockForce * this.knockbackResistance;
    this.knockbackY += knockY * knockForce * this.knockbackResistance;

    return this.hp <= 0;
  }

  /**
   * Draws the faint shadow of an aquatic ambusher while it is hidden below
   * the surface. This is purely cosmetic: the enemy stays out of the spatial
   * grid and is intangible until the hero enters the water.
   */
  public renderSubmergedSilhouette(
    ctx: CanvasRenderingContext2D,
    camera: Camera
  ): void {
    if (!this.isSubmerged) return;
    if (!camera.isInView(this.x, this.y, 120)) return;

    const screen = camera.worldToScreen(this.x, this.y);
    const flip = this.x > camera.x ? -1 : 1;
    const bob = Math.sin(this.animTimer * 1.4) * 1.5;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    if (this.growthScale !== 1) {
      ctx.scale(this.growthScale, this.growthScale);
    }
    ctx.scale(flip, 1);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#031a1e';
    ctx.shadowColor = 'rgba(2, 14, 18, 0.55)';
    ctx.shadowBlur = 7;

    if (this.type === 'piranha') {
      const tailWag = Math.sin(this.animTimer * 3.4) * 2;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-17, -6 + tailWag);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-17, 6 + tailWag);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, bob, 10, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'pink_river_dolphin') {
      ctx.beginPath();
      ctx.ellipse(-2, bob, 19, 8, -0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(16, 2 + bob, 8, 4.2, 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Dorsal fin.
      ctx.beginPath();
      ctx.moveTo(-2, -6 + bob);
      ctx.lineTo(-7, -16 + bob);
      ctx.lineTo(6, -5 + bob);
      ctx.closePath();
      ctx.fill();

      // Tail flukes.
      ctx.beginPath();
      ctx.moveTo(-17, 1 + bob);
      ctx.lineTo(-27, -5 + bob);
      ctx.lineTo(-24, 1 + bob);
      ctx.lineTo(-27, 7 + bob);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'giant_otter') {
      const paddle = Math.sin(this.animTimer * 2.8) * 1.8;
      ctx.beginPath();
      ctx.ellipse(-2, 1 + bob, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.quadraticCurveTo(-27, -4 + paddle + bob, -35, 1 + paddle + bob);
      ctx.quadraticCurveTo(-27, 3 + paddle + bob, -15, 5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(15, -2 + bob, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.isSubmerged) return;
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
    // Predators grow without limit as they devour other animals.
    if (this.growthScale !== 1) {
      ctx.scale(this.growthScale, this.growthScale);
    }

    const isFlashing = this.hitFlashTimer > 0;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, this.radius * 0.9, this.radius, this.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fruit-fed tapir shield.
    if (this.shieldHp > 0) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, this.radius * 0.85, this.radius + 6, this.radius * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

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
    } else if (this.type === 'piranha') {
      // Small silver fish with a red belly and a mouth full of sharp teeth.
      const tailWag = Math.sin(this.animTimer * 4.2) * 3;
      if (!isFlashing) ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-18, -7 + tailWag);
      ctx.lineTo(-15, 0);
      ctx.lineTo(-18, 7 + tailWag);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(-1, 3, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(6, -2, 1.7, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(7, 2);
      ctx.lineTo(11, 3.2);
      ctx.lineTo(8, 4.2);
      ctx.lineTo(10, 5.4);
      ctx.lineTo(6, 5);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'pink_river_dolphin') {
      // Pink river dolphin: rounded body, long rostrum and a small dorsal fin.
      const bob = Math.sin(this.animTimer * 1.8) * 2;
      if (!isFlashing) ctx.fillStyle = '#f9a8d4';
      ctx.beginPath();
      ctx.ellipse(-2, bob, 20, 9, -0.06, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(17, 2 + bob, 8, 4.5, 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Dorsal fin.
      ctx.beginPath();
      ctx.moveTo(-2, -7 + bob);
      ctx.lineTo(-7, -18 + bob);
      ctx.lineTo(6, -6 + bob);
      ctx.closePath();
      ctx.fill();

      // Tail flukes.
      ctx.beginPath();
      ctx.moveTo(-18, 1 + bob);
      ctx.lineTo(-29, -7 + bob);
      ctx.lineTo(-26, 1 + bob);
      ctx.lineTo(-29, 9 + bob);
      ctx.closePath();
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.ellipse(-3, 4 + bob, 12, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.ellipse(4, 7 + bob, 6, 2.8, 0.4, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(16, -1 + bob, 1.8, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(16.5, -1.5 + bob, 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'giant_otter') {
      // Giant otter: long brown body, small ears, pale muzzle and whiskers.
      const paddle = Math.sin(this.animTimer * 3.2) * 2;
      if (!isFlashing) ctx.fillStyle = '#6b4423';
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.quadraticCurveTo(-30, -5 + paddle, -38, 2 + paddle);
      ctx.quadraticCurveTo(-30, 4 + paddle, -15, 6);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(-2, 1, 19, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(16, -2, 8.5, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#4a2f1d';
      ctx.beginPath();
      ctx.arc(12, -9, 3, 0, Math.PI * 2);
      ctx.arc(20, -9, 3, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#a47148';
      ctx.beginPath();
      ctx.ellipse(22, 1, 5.5, 4.2, 0.1, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.ellipse(26, 0, 2, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(15, -3, 1.7, 0, Math.PI * 2);
      ctx.arc(20, -2.5, 1.5, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(15.5, -3, 0.8, 0, Math.PI * 2);
      ctx.arc(20.3, -2.5, 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#e7e5e4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, 2);
      ctx.lineTo(32, -1);
      ctx.moveTo(25, 3);
      ctx.lineTo(33, 3);
      ctx.moveTo(24, 4);
      ctx.lineTo(31, 7);
      ctx.stroke();

      if (!isFlashing) ctx.fillStyle = '#4a2f1d';
      ctx.beginPath();
      ctx.ellipse(2, 9 + paddle * 0.2, 5, 2.5, 0.2, 0, Math.PI * 2);
      ctx.ellipse(-10, 9 - paddle * 0.2, 5, 2.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'elite_black_caiman') {
      // Jacaré-açu: long dark snout, ridged back, heavy tail and pale teeth.
      ctx.save();
      const sway = Math.sin(this.animTimer * 1.9) * 2;

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#1f3d2b';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-18, 3);
      ctx.quadraticCurveTo(-34, -8 + sway, -52, 7 + sway);
      ctx.stroke();

      ctx.strokeStyle = isFlashing ? '#ffffff' : '#254a34';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-8, 8);
      ctx.lineTo(-15, 17);
      ctx.moveTo(10, 8);
      ctx.lineTo(17, 16);
      ctx.stroke();
      ctx.lineCap = 'butt';

      if (!isFlashing) ctx.fillStyle = '#2f5d3a';
      ctx.beginPath();
      ctx.ellipse(-3, 0, 25, 13, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#3f7a4a';
      ctx.beginPath();
      ctx.moveTo(16, -9);
      ctx.lineTo(48, -4);
      ctx.lineTo(48, 4);
      ctx.lineTo(18, 9);
      ctx.closePath();
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#274a2f';
      ctx.beginPath();
      ctx.arc(19, -7, 4.5, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(20, -7, 2, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(20.6, -7, 0.9, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(44, -2, 1.3, 0, Math.PI * 2);
      ctx.arc(44, 2, 1.3, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#f8fafc';
      for (let i = 0; i < 5; i++) {
        const tx = 30 + i * 3.4;
        ctx.beginPath();
        ctx.moveTo(tx, 4);
        ctx.lineTo(tx + 1.5, 6.5);
        ctx.lineTo(tx + 3, 4);
        ctx.closePath();
        ctx.fill();
      }

      if (!isFlashing) ctx.fillStyle = '#1f3d2b';
      for (let i = 0; i < 5; i++) {
        const rx = -20 + i * 8;
        ctx.beginPath();
        ctx.moveTo(rx, -11);
        ctx.lineTo(rx + 4, -18);
        ctx.lineTo(rx + 8, -11);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    } else if (this.type === 'boss_curupira') {
      // Curupira: fire hair, green forest body and backwards feet.
      const flicker = Math.sin(this.animTimer * 5) * 4;

      if (!isFlashing) {
        const aura = ctx.createRadialGradient(0, 0, 12, 0, 0, 52);
        aura.addColorStop(0, 'rgba(249, 115, 22, 0.35)');
        aura.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 52, 0, Math.PI * 2);
        ctx.fill();
      }

      // Reversed feet: the toes point away from the walking direction.
      if (!isFlashing) ctx.fillStyle = '#5b3a1c';
      ctx.beginPath();
      ctx.ellipse(-12, 26, 9, 5, -0.5, 0, Math.PI * 2);
      ctx.ellipse(12, 26, 9, 5, 0.5, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#d6a15f';
      ctx.beginPath();
      ctx.moveTo(-19, 24);
      ctx.lineTo(-28, 27);
      ctx.lineTo(-19, 29);
      ctx.closePath();
      ctx.moveTo(19, 24);
      ctx.lineTo(28, 27);
      ctx.lineTo(19, 29);
      ctx.closePath();
      ctx.fill();

      // Branch-like legs and mossy body.
      if (!isFlashing) ctx.fillStyle = '#3f6212';
      ctx.beginPath();
      ctx.roundRect(-16, 0, 32, 28, 8);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#365314';
      ctx.beginPath();
      ctx.ellipse(0, -10, 15, 13, 0, 0, Math.PI * 2);
      ctx.fill();

      // Face.
      if (!isFlashing) ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(-5, -12, 2.4, 0, Math.PI * 2);
      ctx.arc(5, -12, 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#166534';
      ctx.fillRect(-3, -5, 6, 2);

      // Flaming hair.
      if (!isFlashing) ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-15, -14);
      ctx.quadraticCurveTo(-20, -30 - flicker, -8, -24);
      ctx.quadraticCurveTo(-4, -40 + flicker, 2, -26);
      ctx.quadraticCurveTo(8, -38 - flicker, 13, -22);
      ctx.quadraticCurveTo(20, -28 + flicker, 15, -12);
      ctx.closePath();
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(-11, -15);
      ctx.quadraticCurveTo(-13, -27 - flicker, -2, -21);
      ctx.quadraticCurveTo(2, -32 + flicker, 7, -20);
      ctx.quadraticCurveTo(12, -25 - flicker, 11, -13);
      ctx.closePath();
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(-5, -17);
      ctx.quadraticCurveTo(-3, -25 + flicker, 3, -22);
      ctx.quadraticCurveTo(7, -25 - flicker, 6, -16);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'boss_saci') {
      // Saci-pererê: small dark boy with a bright red cap and a wind swirl.
      const swirl = this.animTimer * 2.4;

      if (!isFlashing) {
        ctx.strokeStyle = 'rgba(148, 197, 255, 0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.2) {
          const r = 14 + a * 3.2;
          const px = Math.cos(a + swirl) * r;
          const py = Math.sin(a + swirl) * r * 0.55;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      if (!isFlashing) ctx.fillStyle = '#3b2214';
      ctx.beginPath();
      ctx.ellipse(0, 8, 12, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Single leg, in keeping with the folklore.
      if (!isFlashing) ctx.fillStyle = '#2b160d';
      ctx.fillRect(-3, 18, 6, 12);

      // Head and red cap.
      if (!isFlashing) ctx.fillStyle = '#c08457';
      ctx.beginPath();
      ctx.arc(0, -8, 11, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-13, -10);
      ctx.quadraticCurveTo(0, -34, 14, -12);
      ctx.quadraticCurveTo(0, -18, -13, -10);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -11, 4, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(-4, -7, 1.7, 0, Math.PI * 2);
      ctx.arc(4, -7, 1.7, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(-1, -2, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'boss_boto') {
      // Boto-cor-de-rosa: large pink river dolphin surrounded by sound ripples.
      const bob = Math.sin(this.animTimer * 1.7) * 3;

      if (!isFlashing) {
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.4)';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, 24 + i * 9 + Math.sin(this.animTimer * 2 + i) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      if (!isFlashing) ctx.fillStyle = '#f9a8d4';
      ctx.beginPath();
      ctx.ellipse(-4, bob, 32, 15, -0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(27, 4 + bob, 12, 7, 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Dorsal fin.
      if (!isFlashing) ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.moveTo(-4, -11 + bob);
      ctx.lineTo(-12, -29 + bob);
      ctx.lineTo(9, -10 + bob);
      ctx.closePath();
      ctx.fill();

      // Tail flukes.
      ctx.beginPath();
      ctx.moveTo(-30, 2 + bob);
      ctx.lineTo(-48, -12 + bob);
      ctx.lineTo(-43, 2 + bob);
      ctx.lineTo(-48, 15 + bob);
      ctx.closePath();
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#fbcfe8';
      ctx.beginPath();
      ctx.ellipse(-5, 7 + bob, 19, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!isFlashing) ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(26, -2 + bob, 2.6, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(27, -3 + bob, 1, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) {
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(37, 5 + bob);
        ctx.lineTo(44, 6 + bob);
        ctx.stroke();
      }
    } else if (this.type === 'boss_iara') {
      // Iara: river mermaid with a watery aura and a long blue tail.
      const sway = Math.sin(this.animTimer * 1.9) * 3;

      if (!isFlashing) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 4, 20 + i * 9 + Math.sin(this.animTimer * 2 + i) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Tail and caudal fin.
      if (!isFlashing) ctx.fillStyle = '#0ea5e9';
      ctx.beginPath();
      ctx.moveTo(-4, 10 + sway);
      ctx.quadraticCurveTo(-30, 24 + sway, -48, 8 + sway);
      ctx.quadraticCurveTo(-34, 12 + sway, -20, 2 + sway);
      ctx.closePath();
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(-46, 8 + sway);
      ctx.lineTo(-58, -4 + sway);
      ctx.lineTo(-50, 8 + sway);
      ctx.lineTo(-58, 20 + sway);
      ctx.closePath();
      ctx.fill();

      // Torso and shell.
      if (!isFlashing) ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.ellipse(0, 2, 13, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.ellipse(0, 2, 8, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head and long blue hair.
      if (!isFlashing) ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.ellipse(-11, -17, 8, 15, 0.25, 0, Math.PI * 2);
      ctx.ellipse(11, -17, 8, 15, -0.25, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, -18, 11, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.arc(0, -24, 11, Math.PI, Math.PI * 2);
      ctx.fill();

      // Face.
      if (!isFlashing) ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-4, -18, 1.8, 0, Math.PI * 2);
      ctx.arc(4, -18, 1.8, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(0, -11, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'boss_caipora') {
      // Caipora: forest protector riding a fast peccary (queixada).
      const gallop = Math.sin(this.animTimer * 5) * 2.5;

      // Peccary legs.
      if (!isFlashing) ctx.fillStyle = '#3f2a1a';
      ctx.fillRect(-20, 20, 6, 12 + gallop);
      ctx.fillRect(-6, 20, 6, 14 - gallop);
      ctx.fillRect(8, 20, 6, 12 + gallop);
      ctx.fillRect(20, 20, 6, 14 - gallop);

      // Peccary body.
      if (!isFlashing) ctx.fillStyle = '#5b3a1c';
      ctx.beginPath();
      ctx.ellipse(0, 10, 30, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#7c4a23';
      ctx.beginPath();
      ctx.ellipse(24, 4, 14, 11, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Snout, ear and tusk.
      if (!isFlashing) ctx.fillStyle = '#d6a15f';
      ctx.beginPath();
      ctx.ellipse(38, 6, 8, 5, 0.1, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#3f2a1a';
      ctx.beginPath();
      ctx.moveTo(22, -5);
      ctx.lineTo(27, -16);
      ctx.lineTo(33, -5);
      ctx.closePath();
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(40, 9);
      ctx.lineTo(47, 4);
      ctx.lineTo(43, 11);
      ctx.closePath();
      ctx.fill();

      // Rider: small green-skinned guardian with a straw cape.
      if (!isFlashing) ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.roundRect(-12, -22, 20, 24, 6);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#a3a35a';
      ctx.beginPath();
      ctx.moveTo(-18, -20);
      ctx.lineTo(4, -26);
      ctx.lineTo(12, -6);
      ctx.lineTo(-12, -2);
      ctx.closePath();
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.arc(-2, -32, 10, 0, Math.PI * 2);
      ctx.fill();
      // Straw headdress.
      if (!isFlashing) ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.moveTo(-14, -36);
      ctx.lineTo(-2, -52);
      ctx.lineTo(10, -36);
      ctx.closePath();
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(-6, -32, 1.7, 0, Math.PI * 2);
      ctx.arc(2, -32, 1.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'boss_matinta') {
      // Matinta Pereira: hovering forest witch surrounded by shadow birds.
      const hover = Math.sin(this.animTimer * 2.2) * 4;

      if (!isFlashing) {
        const aura = ctx.createRadialGradient(0, hover, 6, 0, hover, 52);
        aura.addColorStop(0, 'rgba(88, 28, 135, 0.45)');
        aura.addColorStop(1, 'rgba(88, 28, 135, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, hover, 52, 0, Math.PI * 2);
        ctx.fill();

        // Shadow bird silhouettes circling the witch.
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        for (let i = 0; i < 3; i++) {
          const a = this.animTimer * 1.4 + (i * Math.PI * 2) / 3;
          const bx = Math.cos(a) * 40;
          const by = Math.sin(a) * 22 + hover;
          ctx.beginPath();
          ctx.moveTo(bx - 7, by);
          ctx.lineTo(bx, by - 4);
          ctx.lineTo(bx + 7, by);
          ctx.lineTo(bx, by + 2);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Cloak.
      if (!isFlashing) ctx.fillStyle = '#3b0764';
      ctx.beginPath();
      ctx.moveTo(-20, 22 + hover);
      ctx.quadraticCurveTo(-24, -8 + hover, 0, -18 + hover);
      ctx.quadraticCurveTo(24, -8 + hover, 20, 22 + hover);
      ctx.quadraticCurveTo(0, 30 + hover, -20, 22 + hover);
      ctx.closePath();
      ctx.fill();
      // Tattered hem.
      if (!isFlashing) ctx.fillStyle = '#581c87';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 8 - 4, 22 + hover);
        ctx.lineTo(i * 8, 32 + hover);
        ctx.lineTo(i * 8 + 4, 22 + hover);
        ctx.closePath();
        ctx.fill();
      }
      // Pale face.
      if (!isFlashing) ctx.fillStyle = '#d6d3d1';
      ctx.beginPath();
      ctx.arc(0, -14 + hover, 10, 0, Math.PI * 2);
      ctx.fill();
      // Pointed hat.
      if (!isFlashing) ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(-16, -20 + hover);
      ctx.lineTo(0, -54 + hover);
      ctx.lineTo(16, -20 + hover);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -20 + hover, 22, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glowing eyes.
      if (!isFlashing) ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-4, -15 + hover, 1.8, 0, Math.PI * 2);
      ctx.arc(4, -15 + hover, 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'boss_vitoria_regia') {
      // Vitória-Régia: gigantic floating lily pad with a crowned flower and
      // thorny vines trailing around the rim.
      const sway = Math.sin(this.animTimer * 1.3) * 3;

      if (!isFlashing) {
        const aura = ctx.createRadialGradient(0, 0, 18, 0, 0, 70);
        aura.addColorStop(0, 'rgba(16, 185, 129, 0.32)');
        aura.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 70, 0, Math.PI * 2);
        ctx.fill();
      }

      // Giant lily pad.
      if (!isFlashing) ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.ellipse(0, 18, 54, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(0, 14, 46, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Radial veins and the pad's characteristic notch.
      if (!isFlashing) ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(Math.cos(a) * 44, 14 + Math.sin(a) * 18);
        ctx.stroke();
      }
      if (!isFlashing) ctx.fillStyle = '#0b3d24';
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(18, 3);
      ctx.lineTo(22, 15);
      ctx.closePath();
      ctx.fill();

      // Flower crown.
      if (!isFlashing) ctx.fillStyle = '#fbcfe8';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + sway * 0.05;
        const px = Math.cos(a) * 17;
        const py = -12 + Math.sin(a) * 10;
        ctx.beginPath();
        ctx.ellipse(px, py, 10, 6, a, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!isFlashing) ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(0, -12, 12, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(0, -12, 5, 0, Math.PI * 2);
      ctx.fill();

      // Thorny vines around the rim.
      if (!isFlashing) ctx.strokeStyle = '#3f6212';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 14, 48, 0.15, Math.PI - 0.15);
      ctx.stroke();
      if (!isFlashing) ctx.fillStyle = '#a16207';
      for (let i = 0; i < 8; i++) {
        const a = 0.2 + (i / 7) * (Math.PI - 0.4);
        const px = Math.cos(a) * 50;
        const py = 14 + Math.sin(a) * 22;
        ctx.beginPath();
        ctx.moveTo(px - 3, py);
        ctx.lineTo(px, py - 7);
        ctx.lineTo(px + 3, py);
        ctx.closePath();
        ctx.fill();
      }
    } else if (this.type === 'boss_mapinguari') {
      // Mapinguari: colossal shaggy beast with a single eye and a mouth on
      // its belly.
      const walk = Math.sin(this.animTimer * 2.4);
      const breathe = Math.sin(this.animTimer * 1.1) * 2;

      if (!isFlashing) {
        const aura = ctx.createRadialGradient(0, 0, 20, 0, 0, 78);
        aura.addColorStop(0, 'rgba(120, 53, 15, 0.35)');
        aura.addColorStop(1, 'rgba(120, 53, 15, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 78, 0, Math.PI * 2);
        ctx.fill();
      }

      // Long shaggy arms.
      if (!isFlashing) ctx.fillStyle = '#3f2a17';
      ctx.beginPath();
      ctx.ellipse(-38, 8 + walk * 2, 15, 26, 0.35, 0, Math.PI * 2);
      ctx.ellipse(38, 8 - walk * 2, 15, 26, -0.35, 0, Math.PI * 2);
      ctx.fill();
      // Claws.
      if (!isFlashing) ctx.fillStyle = '#e7e5e4';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-46 + i * 6, 30 + walk * 2);
        ctx.lineTo(-48 + i * 6, 40 + walk * 2);
        ctx.lineTo(-43 + i * 6, 31 + walk * 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(35 + i * 6, 30 - walk * 2);
        ctx.lineTo(33 + i * 6, 40 - walk * 2);
        ctx.lineTo(38 + i * 6, 31 - walk * 2);
        ctx.closePath();
        ctx.fill();
      }

      // Massive fur-covered body.
      if (!isFlashing) ctx.fillStyle = '#4a2f1d';
      ctx.beginPath();
      ctx.ellipse(0, 2 + breathe * 0.3, 34, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#5b3a1c';
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      // Shaggy fur tufts.
      if (!isFlashing) ctx.fillStyle = '#3f2a17';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const px = Math.cos(a) * 30;
        const py = Math.sin(a) * 34;
        ctx.beginPath();
        ctx.moveTo(px - 4, py);
        ctx.lineTo(px + Math.cos(a) * 8, py + Math.sin(a) * 8);
        ctx.lineTo(px + 4, py);
        ctx.closePath();
        ctx.fill();
      }

      // Single glowing eye.
      if (!isFlashing) ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(0, -16, 13, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(walk * 2, -16, 5.5, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(walk * 2, -16, 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Mouth on the belly, opening and closing.
      const gape = 3 + (Math.sin(this.animTimer * 2) + 1) * 3;
      if (!isFlashing) ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.ellipse(0, 12, 17, gape, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#f8fafc';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 6, 12 - gape);
        ctx.lineTo(i * 6 + 3, 12 - gape + 5);
        ctx.lineTo(i * 6 + 6, 12 - gape);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(i * 6, 12 + gape);
        ctx.lineTo(i * 6 + 3, 12 + gape - 5);
        ctx.lineTo(i * 6 + 6, 12 + gape);
        ctx.closePath();
        ctx.fill();
      }
    } else if (this.type === 'boss_cobra_grande') {
      // Cobra-Grande (Boiúna): colossal dark serpent with glowing eyes.
      const slither = Math.sin(this.animTimer * 3.4) * 5;

      if (!isFlashing) {
        const aura = ctx.createRadialGradient(0, 0, 16, 0, 0, 76);
        aura.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
        aura.addColorStop(0.55, 'rgba(30, 64, 175, 0.22)');
        aura.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 76, 0, Math.PI * 2);
        ctx.fill();
      }

      // Long sinuous body with a tapered tail.
      if (!isFlashing) ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.moveTo(-58, 20 + slither);
      ctx.quadraticCurveTo(-32, -12 + slither, -4, 6);
      ctx.quadraticCurveTo(18, 22, 38, 4);
      ctx.lineTo(42, 18);
      ctx.quadraticCurveTo(16, 34, -6, 20);
      ctx.quadraticCurveTo(-32, 8, -58, 32 + slither);
      ctx.closePath();
      ctx.fill();

      // Blue-black dorsal scales.
      if (!isFlashing) ctx.fillStyle = '#1e293b';
      for (let i = 0; i < 7; i++) {
        const sx = -44 + i * 12;
        const sy = 8 + Math.sin(i * 1.3 + this.animTimer * 3) * 5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 8, 5, -0.25, 0, Math.PI * 2);
        ctx.fill();
      }

      // Head with a broad jaw.
      if (!isFlashing) ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(36, -2, 22, 15, -0.12, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(46, 2, 12, 8, -0.05, 0, Math.PI * 2);
      ctx.fill();

      // Forked tongue.
      if (!isFlashing) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(56, 3);
        ctx.lineTo(70, -2 + Math.sin(this.animTimer * 6) * 2);
        ctx.moveTo(56, 3);
        ctx.lineTo(70, 8 + Math.sin(this.animTimer * 6) * 2);
        ctx.stroke();
      }

      // Glowing eyes.
      if (!isFlashing) {
        const eyeGlow = ctx.createRadialGradient(30, -8, 1, 30, -8, 12);
        eyeGlow.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
        eyeGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = eyeGlow;
        ctx.beginPath();
        ctx.arc(30, -8, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(30, -8, 3.6, 0, Math.PI * 2);
        ctx.arc(40, -9, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.arc(30.5, -8, 1.4, 0, Math.PI * 2);
        ctx.arc(40.5, -9, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'boss_boitata') {
      // Boitatá: giant fire serpent wreathed in flames.
      const undulate = Math.sin(this.animTimer * 4.2) * 6;
      const flicker = Math.sin(this.animTimer * 11) * 3;

      if (!isFlashing) {
        const aura = ctx.createRadialGradient(0, 0, 12, 0, 0, 84);
        aura.addColorStop(0, 'rgba(251, 146, 60, 0.55)');
        aura.addColorStop(0.5, 'rgba(220, 38, 38, 0.28)');
        aura.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, 84, 0, Math.PI * 2);
        ctx.fill();
      }

      // Flame spikes along the back.
      if (!isFlashing) {
        for (let i = 0; i < 10; i++) {
          const bx = -50 + i * 10;
          const by = 6 + Math.sin(i * 0.9 + this.animTimer * 4) * 6;
          const height = 14 + (i % 3) * 6 + flicker;
          ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#dc2626';
          ctx.beginPath();
          ctx.moveTo(bx - 5, by);
          ctx.quadraticCurveTo(bx, by - height, bx + 5, by);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.moveTo(bx - 2, by);
          ctx.quadraticCurveTo(bx, by - height * 0.55, bx + 2, by);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Sinuous body.
      if (!isFlashing) {
        const body = ctx.createLinearGradient(-58, -10, 50, 20);
        body.addColorStop(0, '#7f1d1d');
        body.addColorStop(0.5, '#dc2626');
        body.addColorStop(1, '#f97316');
        ctx.fillStyle = body;
      }
      ctx.beginPath();
      ctx.moveTo(-58, 22 + undulate);
      ctx.quadraticCurveTo(-30, -10 + undulate, -2, 8);
      ctx.quadraticCurveTo(20, 24, 40, 5);
      ctx.lineTo(44, 19);
      ctx.quadraticCurveTo(18, 36, -6, 22);
      ctx.quadraticCurveTo(-32, 10, -58, 34 + undulate);
      ctx.closePath();
      ctx.fill();

      // Lighter belly scales.
      if (!isFlashing) ctx.fillStyle = '#fbbf24';
      for (let i = 0; i < 7; i++) {
        const sx = -42 + i * 12;
        const sy = 16 + Math.sin(i * 1.2 + this.animTimer * 3.5) * 5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Head with burning eyes.
      if (!isFlashing) ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.ellipse(36, -2, 21, 14, -0.12, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.ellipse(46, 2, 11, 7, -0.05, 0, Math.PI * 2);
      ctx.fill();
      if (!isFlashing) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(30, -8, 3.8, 0, Math.PI * 2);
        ctx.arc(40, -9, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.arc(30.5, -8, 1.4, 0, Math.PI * 2);
        ctx.arc(40.5, -9, 1.2, 0, Math.PI * 2);
        ctx.fill();
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

    // Health bar for Elites and Amazon Forest bosses.
    const showBossBar =
      this.isBoss &&
      (this.type === 'boss_curupira' ||
        this.type === 'boss_saci' ||
        this.type === 'boss_boto' ||
        this.type === 'boss_iara' ||
        this.type === 'boss_caipora' ||
        this.type === 'boss_matinta' ||
        this.type === 'boss_vitoria_regia' ||
        this.type === 'boss_mapinguari' ||
        this.type === 'boss_cobra_grande' ||
        this.type === 'boss_boitata');
    if (this.isElite || showBossBar) {
      const barW = showBossBar ? 76 : 44;
      const barH = showBossBar ? 7 : 5;
      const barX = screen.x - barW / 2;
      const barY = screen.y - this.radius - (showBossBar ? 18 : 12);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = showBossBar ? '#f43f5e' : '#eab308';
      ctx.fillRect(barX, barY, barW * Math.max(0, this.hp / this.maxHp), barH);
    }
  }
}
