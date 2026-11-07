import { DifficultyConfig, EnemyType, MapId } from '../types';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Camera } from '../engine/Camera';
import { SoundEngine } from '../engine/SoundEngine';
import { WorldSystem } from './WorldProps';

interface AmazonSpawn {
  type: EnemyType;
  aquatic: boolean;
}

type AmazonTier = 'basic' | 'medium' | 'resistant' | 'elite';

const AMAZON_FAUNA: Record<AmazonTier, AmazonSpawn[]> = {
  basic: [
    { type: 'amazon_ant_bullet', aquatic: false },
    { type: 'amazon_ant_leafcutter', aquatic: false },
    { type: 'amazon_butterfly', aquatic: false },
    { type: 'amazon_cicada', aquatic: false },
    { type: 'amazon_piranha', aquatic: true },
  ],
  medium: [
    { type: 'amazon_dart_frog', aquatic: false },
    { type: 'amazon_mantis', aquatic: false },
    { type: 'amazon_stick_insect', aquatic: false },
    { type: 'amazon_toucan', aquatic: false },
    { type: 'amazon_boto', aquatic: true },
  ],
  resistant: [
    { type: 'amazon_capybara', aquatic: false },
    { type: 'amazon_sloth', aquatic: false },
    { type: 'amazon_rhino_beetle', aquatic: false },
    { type: 'amazon_stag_beetle', aquatic: false },
    { type: 'amazon_centipede', aquatic: false },
    { type: 'amazon_otter', aquatic: true },
  ],
  elite: [
    { type: 'amazon_jaguar', aquatic: false },
    { type: 'amazon_tapir', aquatic: false },
    { type: 'amazon_goliath_spider', aquatic: false },
    { type: 'amazon_caiman', aquatic: true },
  ],
};

const AMAZON_AQUATIC = new Set<EnemyType>([
  'amazon_piranha',
  'amazon_boto',
  'amazon_otter',
  'amazon_caiman',
]);

export class WaveDirector {
  public survivalTime: number = 0;
  public difficulty: DifficultyConfig;
  private nextEnemyId: number = 1;
  private spawnTimer: number = 0;
  private mapId: MapId;
  private world: WorldSystem | null;

  constructor(difficulty: DifficultyConfig, mapId: MapId = 'night_plain', world?: WorldSystem) {
    this.difficulty = difficulty;
    this.mapId = mapId;
    this.world = world ?? null;
  }

  private get isAmazon(): boolean {
    return this.mapId === 'amazon_forest';
  }

  // Event flags to ensure one-time triggers
  public eventAlert: string | null = null;
  public eventAlertTimer: number = 0;
  private triggeredEvents: Set<string> = new Set();
  public bossActive: Enemy | null = null;
  public isEndless: boolean = false;

  update(
    dt: number,
    player: Player,
    camera: Camera,
    enemies: Enemy[],
    sound: SoundEngine,
    onSpawn: (enemy: Enemy) => void
  ): void {
    this.survivalTime += dt;
    this.spawnTimer += dt;

    if (this.eventAlertTimer > 0) {
      this.eventAlertTimer -= dt;
      if (this.eventAlertTimer <= 0) {
        this.eventAlert = null;
      }
    }

    // Check boss status
    if (this.bossActive && this.bossActive.hp <= 0) {
      this.bossActive = null;
    }

    // The four aquatic animals are locked to the river.
    if (this.isAmazon) {
      this.keepAquaticEnemiesInRiver(enemies);
    }

    // Smooth early scaling + steeper late/endless scaling
    const minutes = this.survivalTime / 60;
    const endlessExtra = minutes > 5 ? Math.pow(minutes - 5, 1.35) * 0.45 : 0;
    const hpMultiplier = (1.0 + minutes * 0.52 + endlessExtra) * this.difficulty.enemyHp;
    const spawnInterval = Math.max(0.11, 0.56 - minutes * 0.085) / this.difficulty.spawnRate;
    const maxEnemies = Math.min(
      420,
      Math.floor((95 + Math.floor(minutes * 58)) * this.difficulty.enemyCount)
    );

    // Regular interval spawning
    if (this.spawnTimer >= spawnInterval && enemies.length < maxEnemies) {
      this.spawnTimer = 0;
      this.spawnRegularEnemy(player, camera, hpMultiplier, onSpawn);
    }

    // Timed Events (4 Elite Chests before 05:00 + Final Boss + Endless Loop)
    const sec = Math.floor(this.survivalTime);

    // Event 1: 01:00 - Bat Swarm + Vanguard Elite (#1 Chest)
    if (sec >= 60 && !this.triggeredEvents.has('wave_60')) {
      this.triggeredEvents.add('wave_60');
      sound.playBossWarning();
      if (this.isAmazon) {
        this.triggerAlert('🐜 ENXAME DA FAUNA AMAZÔNICA E UM PREDADOR ELITE SURGIRAM!', 4.5);
        this.spawnAmazonSwarm(player, camera, onSpawn);
        this.spawnAmazonElite(player, camera, hpMultiplier * 0.75, onSpawn);
      } else {
        this.triggerAlert('🦇 ENXAME DE MORCEGOS E GUARDA ELITE SURGIRAM!', 4.5);
        this.spawnBatSwarm(player, camera, onSpawn);
        this.spawnElite(player, camera, hpMultiplier * 0.75, 'Capitão da Guarda Elite', onSpawn);
      }
    }

    // Event 2: 02:00 - Minotaur Elite (#2 Chest)
    if (sec >= 120 && !this.triggeredEvents.has('wave_120')) {
      this.triggeredEvents.add('wave_120');
      sound.playBossWarning();
      if (this.isAmazon) {
        this.triggerAlert('🐆 PREDADOR AMAZÔNICO ELITE SURGIU! DERROTE-O PARA EVOLUIR NO BAÚ!', 5);
        this.spawnAmazonElite(player, camera, hpMultiplier, onSpawn);
      } else {
        this.triggerAlert('⚔️ MINOTAURO ELITE SURGIU! DERROTE-O PARA EVOLUIR NO BAÚ!', 5);
        this.spawnElite(player, camera, hpMultiplier, 'Minotauro Elite', onSpawn);
      }
    }

    // Event 3: 03:00 - Zombie Ring + Butcher Elite (#3 Chest)
    if (sec >= 180 && !this.triggeredEvents.has('wave_180')) {
      this.triggeredEvents.add('wave_180');
      sound.playBossWarning();
      if (this.isAmazon) {
        this.triggerAlert('🐍 CERCO DE CRIATURAS DA FLORESTA COM UM PREDADOR ELITE!', 4.5);
        this.spawnAmazonRing(player, hpMultiplier, 'basic', onSpawn);
        this.spawnAmazonElite(player, camera, hpMultiplier * 1.05, onSpawn);
      } else {
        this.triggerAlert('💀 CERCO DE ZUMBIS COM CARNICEIRO ELITE!', 4.5);
        this.spawnRingEnemies(player, hpMultiplier, 'zombie', onSpawn);
        this.spawnElite(player, camera, hpMultiplier * 1.05, 'Carniceiro Elite', onSpawn);
      }
    }

    // Event 4: 04:00 - Spectral General Elite (#4 Chest)
    if (sec >= 240 && !this.triggeredEvents.has('wave_240')) {
      this.triggeredEvents.add('wave_240');
      sound.playBossWarning();
      if (this.isAmazon) {
        this.triggerAlert('🦅 PREDADORES AMAZÔNICOS ELITE SURGIRAM!', 5);
        this.spawnAmazonElite(player, camera, hpMultiplier * 1.15, onSpawn);
        if (this.difficulty.enemyCount >= 1.15) {
          this.spawnAmazonElite(player, camera, hpMultiplier, onSpawn);
        }
      } else {
        this.triggerAlert('⚔️ GENERAL ESPECTRAL ELITE SURGIU!', 5);
        this.spawnElite(player, camera, hpMultiplier * 1.15, 'General Espectral Elite', onSpawn);
        if (this.difficulty.enemyCount >= 1.15) {
          this.spawnElite(player, camera, hpMultiplier, 'Guardião Sombrio Elite', onSpawn);
        }
      }
    }

    // Event 5: 05:00 - Final Boss: Senhor da Corrupção!
    if (sec >= 300 && !this.triggeredEvents.has('final_boss')) {
      this.triggeredEvents.add('final_boss');
      sound.playBossWarning();
      if (this.isAmazon) {
        this.triggerAlert('👑 ONÇA-PINTADA ANCIÃ SURGIU! DERROTE-A PARA VENCER!', 6);
      } else {
        this.triggerAlert('👑 SENHOR DA CORRUPÇÃO SURGIU! DERROTE-O PARA VENCER!', 6);
      }
      const boss = this.spawnBoss(player, camera, hpMultiplier, onSpawn);
      this.bossActive = boss;
    }

    // Endless Mode Events (> 05:00): Every 60s Elite + Wave, Every 180s Reincarnated Boss!
    if (this.isEndless && sec >= 360) {
      const minuteMark = Math.floor(sec / 60);
      const endlessKey = `endless_min_${minuteMark}`;
      if (!this.triggeredEvents.has(endlessKey)) {
        this.triggeredEvents.add(endlessKey);
        sound.playBossWarning();

        if ((minuteMark - 5) % 3 === 0 && !this.bossActive) {
          this.triggerAlert(
            this.isAmazon
              ? `👑 ONÇA-PINTADA ANCIÃ (MINUTO ${minuteMark})!`
              : `👑 REENCARNAÇÃO DO SENHOR DA CORRUPÇÃO (MINUTO ${minuteMark})!`,
            5.5
          );
          const boss = this.spawnBoss(player, camera, hpMultiplier * 1.15, onSpawn);
          this.bossActive = boss;
        } else {
          this.triggerAlert(`🔥 ONDA INFINITA DO MINUTO ${minuteMark}: CAÇADORES ELITE!`, 4.5);
          if (this.isAmazon) {
            this.spawnAmazonRing(player, hpMultiplier * 0.95, minuteMark % 2 === 0 ? 'basic' : 'medium', onSpawn);
            this.spawnAmazonElite(player, camera, hpMultiplier * 1.1, onSpawn);
          } else {
            this.spawnRingEnemies(player, hpMultiplier * 0.95, minuteMark % 2 === 0 ? 'ghost' : 'skeleton', onSpawn);
            this.spawnElite(player, camera, hpMultiplier * 1.1, 'Executor Abissal Elite', onSpawn);
          }
        }
      }
    }
  }

  private triggerAlert(text: string, duration: number = 4): void {
    this.eventAlert = text;
    this.eventAlertTimer = duration;
  }

  private getSpawnPositionOutsideScreen(camera: Camera): { x: number; y: number } {
    const margin = 70;
    const halfW = camera.viewportWidth / 2 + margin;
    const halfH = camera.viewportHeight / 2 + margin;

    const side = Math.floor(Math.random() * 4);
    let x = camera.x;
    let y = camera.y;

    if (side === 0) {
      x += (Math.random() - 0.5) * 2 * halfW;
      y -= halfH;
    } else if (side === 1) {
      x += halfW;
      y += (Math.random() - 0.5) * 2 * halfH;
    } else if (side === 2) {
      x += (Math.random() - 0.5) * 2 * halfW;
      y += halfH;
    } else {
      x -= halfW;
      y += (Math.random() - 0.5) * 2 * halfH;
    }

    return { x, y };
  }

  private spawnRegularEnemy(
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): void {
    if (this.isAmazon) {
      this.spawnAmazonOfTier(this.rollAmazonTier(), player, camera, hpMult, onSpawn);
      return;
    }

    const pos = this.getSpawnPositionOutsideScreen(camera);
    const minutes = this.survivalTime / 60;

    let type: Enemy['type'] = 'bat';
    const roll = Math.random();

    if (minutes < 1) {
      type = roll < 0.68 ? 'bat' : roll < 0.9 ? 'skeleton' : 'zombie';
    } else if (minutes < 2) {
      type = roll < 0.35 ? 'bat' : roll < 0.78 ? 'skeleton' : 'zombie';
    } else if (minutes < 3.5) {
      type = roll < 0.28 ? 'skeleton' : roll < 0.65 ? 'ghost' : 'zombie';
    } else {
      type = roll < 0.22 ? 'bat' : roll < 0.52 ? 'ghost' : roll < 0.78 ? 'skeleton' : 'zombie';
    }

    onSpawn(this.createEnemy(type, pos.x, pos.y, hpMult));
  }

  public createEnemy(type: EnemyType, x: number, y: number, hpMult: number): Enemy {
    const enemy = new Enemy(this.nextEnemyId++, type, x, y, hpMult);
    enemy.damage = Math.max(1, Math.round(enemy.damage * this.difficulty.enemyDamage));
    enemy.xpValue = Math.max(1, Math.round(enemy.xpValue * this.difficulty.xpMultiplier));
    return enemy;
  }

  public createSummonEnemy(x: number, y: number, hpMult: number): Enemy {
    const type = this.isAmazon ? this.pickAmazonType('basic', false) : 'bat';
    return this.createEnemy(type, x, y, hpMult);
  }

  private rollAmazonTier(): AmazonTier {
    const minutes = this.survivalTime / 60;
    const roll = Math.random();

    if (minutes < 1) {
      return roll < 0.78 ? 'basic' : 'medium';
    }
    if (minutes < 2) {
      return roll < 0.55 ? 'basic' : roll < 0.9 ? 'medium' : 'resistant';
    }
    if (minutes < 3.5) {
      return roll < 0.38 ? 'basic' : roll < 0.7 ? 'medium' : roll < 0.97 ? 'resistant' : 'elite';
    }
    return roll < 0.28 ? 'basic' : roll < 0.56 ? 'medium' : roll < 0.94 ? 'resistant' : 'elite';
  }

  private pickAmazonType(tier: AmazonTier, allowWater: boolean): EnemyType {
    const pool = AMAZON_FAUNA[tier];
    const canUseWater = allowWater && pool.some((spawn) => spawn.aquatic);
    const useWater = canUseWater && Math.random() < 0.3;
    const candidates = pool.filter((spawn) => spawn.aquatic === useWater);
    return candidates[Math.floor(Math.random() * candidates.length)].type;
  }

  private isNearRiver(player: Player): boolean {
    if (!this.world) return false;
    const center = this.world.getRiverCenterY(player.x);
    return Math.abs(player.y - center) <= this.world.getRiverHalfWidth() + 700;
  }

  private getLandSpawnPosition(camera: Camera): { x: number; y: number } {
    for (let i = 0; i < 20; i++) {
      const pos = this.getSpawnPositionOutsideScreen(camera);
      if (!this.world || !this.world.isWaterAt(pos.x, pos.y)) return pos;
    }
    return this.getSpawnPositionOutsideScreen(camera);
  }

  private getRiverSpawnPosition(camera: Camera): { x: number; y: number } {
    const margin = 70;
    const halfW = camera.viewportWidth / 2 + margin;
    const side = Math.random() < 0.5 ? -1 : 1;
    const rawX = camera.x + side * halfW * (0.65 + Math.random() * 0.6);
    const forestHalf = this.world ? this.world.getForestHalfSize() : 7000;
    const x = Math.max(-forestHalf + 100, Math.min(forestHalf - 100, rawX));
    const center = this.world ? this.world.getRiverCenterY(x) : 0;
    const riverHalf = this.world ? this.world.getRiverHalfWidth() : 450;
    const y = center + (Math.random() * 2 - 1) * riverHalf * 0.75;
    return { x, y };
  }

  private spawnAmazonOfTier(
    tier: AmazonTier,
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const type = this.pickAmazonType(tier, this.isNearRiver(player));
    const pos = AMAZON_AQUATIC.has(type)
      ? this.getRiverSpawnPosition(camera)
      : this.getLandSpawnPosition(camera);
    onSpawn(this.createEnemy(type, pos.x, pos.y, hpMult));
  }

  private keepAquaticEnemiesInRiver(enemies: Enemy[]): void {
    if (!this.world) return;
    const riverHalf = this.world.getRiverHalfWidth();
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!AMAZON_AQUATIC.has(enemy.type)) continue;
      const center = this.world.getRiverCenterY(enemy.x);
      const limit = Math.max(0, riverHalf - enemy.radius);
      if (enemy.y < center - limit) enemy.y = center - limit;
      else if (enemy.y > center + limit) enemy.y = center + limit;
    }
  }

  private spawnAmazonSwarm(
    player: Player,
    camera: Camera,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const count = Math.round(28 * this.difficulty.enemyCount);
    for (let i = 0; i < count; i++) {
      const tier: AmazonTier = Math.random() < 0.65 ? 'basic' : 'medium';
      this.spawnAmazonOfTier(tier, player, camera, 0.9, onSpawn);
    }
  }

  private spawnAmazonRing(
    player: Player,
    hpMult: number,
    tier: AmazonTier,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const count = Math.round(26 * this.difficulty.enemyCount);
    const radius = 420;
    const allowWater = this.isNearRiver(player);
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      const x = player.x + Math.cos(angle) * radius;
      let y = player.y + Math.sin(angle) * radius;
      const type = this.pickAmazonType(tier, allowWater);
      if (AMAZON_AQUATIC.has(type) && this.world) {
        y = this.world.getRiverCenterY(x) + (Math.random() * 2 - 1) * this.world.getRiverHalfWidth() * 0.7;
      }
      onSpawn(this.createEnemy(type, x, y, hpMult));
    }
  }

  private spawnAmazonElite(
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): void {
    this.spawnAmazonOfTier('elite', player, camera, hpMult, onSpawn);
  }

  private spawnBatSwarm(player: Player, camera: Camera, onSpawn: (enemy: Enemy) => void): void {
    const count = Math.round(32 * this.difficulty.enemyCount);
    for (let i = 0; i < count; i++) {
      const pos = this.getSpawnPositionOutsideScreen(camera);
      onSpawn(this.createEnemy('bat', pos.x, pos.y, 0.85));
    }
  }

  private spawnRingEnemies(
    player: Player,
    hpMult: number,
    type: EnemyType,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const count = Math.round(26 * this.difficulty.enemyCount);
    const radius = 420;
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      const x = player.x + Math.cos(angle) * radius;
      const y = player.y + Math.sin(angle) * radius;
      onSpawn(this.createEnemy(type, x, y, hpMult));
    }
  }

  private spawnElite(
    player: Player,
    camera: Camera,
    hpMult: number,
    customName: string,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const pos = this.getSpawnPositionOutsideScreen(camera);
    const elite = this.createEnemy('elite_minotaur', pos.x, pos.y, hpMult);
    elite.name = customName;
    onSpawn(elite);
  }

  private spawnBoss(
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): Enemy {
    if (this.isAmazon) {
      return this.spawnAmazonBoss(camera, hpMult, onSpawn);
    }

    const pos = this.getSpawnPositionOutsideScreen(camera);
    const boss = this.createEnemy('boss_vampire', pos.x, pos.y, hpMult);
    onSpawn(boss);
    return boss;
  }

  private spawnAmazonBoss(
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): Enemy {
    const pos = this.getLandSpawnPosition(camera);
    const boss = this.createEnemy('amazon_jaguar', pos.x, pos.y, hpMult);
    boss.isElite = false;
    boss.isBoss = true;
    boss.name = 'Onça-pintada Anciã (Chefe Final)';
    boss.maxHp = Math.round(3100 * hpMult);
    boss.hp = boss.maxHp;
    boss.damage = Math.max(1, Math.round(34 * this.difficulty.enemyDamage));
    boss.xpValue = Math.max(1, Math.round(500 * this.difficulty.xpMultiplier));
    boss.skillCooldown = 4.2;
    onSpawn(boss);
    return boss;
  }
}
