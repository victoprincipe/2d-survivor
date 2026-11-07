import { DifficultyConfig, EnemyType, MapId } from '../types';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Camera } from '../engine/Camera';
import { SoundEngine } from '../engine/SoundEngine';
import { WorldSystem } from './WorldProps';

const AMAZON_BASIC_ENEMIES: EnemyType[] = [
  'bullet_ant',
  'leafcutter_ant',
  'blue_butterfly',
  'cicada',
];

const AMAZON_MEDIUM_ENEMIES: EnemyType[] = [
  'poison_dart_frog',
  'praying_mantis',
  'stick_bug',
  'toucan',
];

const AMAZON_RESISTANT_ENEMIES: EnemyType[] = [
  'capybara',
  'sloth',
  'rhino_beetle',
  'sawyer_beetle',
  'giant_centipede',
];

// Rare Amazon Forest elites. Spawned on a slow independent timer so they stay
// uncommon even when the regular spawn rate is very high.
const AMAZON_ELITE_ENEMIES: EnemyType[] = [
  'elite_jaguar',
  'elite_tapir',
  'elite_goliath_spider',
];

// Aquatic Amazon Forest fauna. These are only ever spawned on top of real
// water and are kept there by the engine's aquatic movement resolver.
const AMAZON_AQUATIC_BASIC_ENEMIES: EnemyType[] = ['piranha'];
const AMAZON_AQUATIC_MEDIUM_ENEMIES: EnemyType[] = ['pink_river_dolphin'];
const AMAZON_AQUATIC_RESISTANT_ENEMIES: EnemyType[] = ['giant_otter'];
const AMAZON_AQUATIC_ELITE_ENEMIES: EnemyType[] = ['elite_black_caiman'];

export class WaveDirector {
  public survivalTime: number = 0;
  public difficulty: DifficultyConfig;
  private mapId: MapId;
  private worldProps: WorldSystem | null;
  private nextEnemyId: number = 1;
  private spawnTimer: number = 0;
  private nextAmazonEliteTime: number = 80 + Math.random() * 40;
  private nextAmazonBossTime: number = 300;
  private nextAmazonEliteHordeTime: number = 1120;
  private amazonBossWave: number = 0;

  constructor(
    difficulty: DifficultyConfig,
    mapId: MapId = 'night_plain',
    worldProps: WorldSystem | null = null
  ) {
    this.difficulty = difficulty;
    this.mapId = mapId;
    this.worldProps = worldProps;
  }

  public get isAmazonForest(): boolean {
    return this.mapId === 'amazon_forest';
  }

  // Event flags to ensure one-time triggers
  public eventAlert: string | null = null;
  public eventAlertTimer: number = 0;
  private triggeredEvents: Set<string> = new Set();
  public bossActive: Enemy | null = null;
  public isEndless: boolean = false;
  public freezeSpawns: boolean = false;

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
      this.bossActive = enemies.find((e) => e.isBoss && e.hp > 0) ?? null;
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

    // While an Amazon boss is alive, regular mobs spawn at half the usual rate.
    const amazonBossFight =
      this.isAmazonForest && enemies.some((e) => e.isBoss && e.hp > 0);
    const effectiveSpawnInterval = amazonBossFight ? spawnInterval * 2 : spawnInterval;

    // Regular interval spawning
    if (!this.freezeSpawns && this.spawnTimer >= effectiveSpawnInterval && enemies.length < maxEnemies) {
      this.spawnTimer = 0;
      this.spawnRegularEnemy(player, camera, hpMultiplier, onSpawn);
    }

    if (this.freezeSpawns) {
      return;
    }

    // Rare Amazon Forest elite: one of the map's oversized predators appears
    // from time to time on top of the regular waves. The Jacaré-açu only
    // replaces the land elite when there is water just outside the camera.
    if (this.isAmazonForest && this.survivalTime >= this.nextAmazonEliteTime) {
      this.nextAmazonEliteTime = this.survivalTime + 90 + Math.random() * 60;
      let eliteType =
        AMAZON_ELITE_ENEMIES[Math.floor(Math.random() * AMAZON_ELITE_ENEMIES.length)];
      let elitePos = this.getSpawnPositionOutsideScreen(camera);
      let aquaticElite = false;

      if (Math.random() < 0.4) {
        const waterPos = this.getWaterSpawnPosition(camera, 44);
        if (waterPos) {
          eliteType =
            AMAZON_AQUATIC_ELITE_ENEMIES[
              Math.floor(Math.random() * AMAZON_AQUATIC_ELITE_ENEMIES.length)
            ];
          elitePos = waterPos;
          aquaticElite = true;
        }
      }

      const amazonElite = this.createEnemy(eliteType, elitePos.x, elitePos.y, hpMultiplier * 1.05);
      this.triggerAlert(
        aquaticElite
          ? `⚠️ ${amazonElite.name.toUpperCase()} SURGIU NO RIO!`
          : `⚠️ ${amazonElite.name.toUpperCase()} SURGIU NA FLORESTA!`,
        4.5
      );
      sound.playBossWarning();
      onSpawn(amazonElite);
    }

    // Timed Events (4 Elite Chests before 05:00 + Final Boss + Endless Loop)
    const sec = Math.floor(this.survivalTime);

    // Event 1: 01:00 - Bat / Bullet-Ant Swarm + Vanguard Elite (#1 Chest)
    if (sec >= 60 && !this.triggeredEvents.has('wave_60')) {
      this.triggeredEvents.add('wave_60');
      this.triggerAlert(
        this.isAmazonForest
          ? '🐜 ENXAME DE FORMIGAS-BALA E GUARDA ELITE SURGIRAM!'
          : '🦇 ENXAME DE MORCEGOS E GUARDA ELITE SURGIRAM!',
        4.5
      );
      sound.playBossWarning();
      this.spawnSwarm(player, camera, this.isAmazonForest ? 'bullet_ant' : 'bat', onSpawn);
      this.spawnElite(player, camera, hpMultiplier * 0.75, 'Capitão da Guarda Elite', onSpawn);
    }

    // Event 2: 02:00 - Minotaur Elite (#2 Chest)
    if (sec >= 120 && !this.triggeredEvents.has('wave_120')) {
      this.triggeredEvents.add('wave_120');
      this.triggerAlert('⚔️ MINOTAURO ELITE SURGIU! DERROTE-O PARA EVOLUIR NO BAÚ!', 5);
      sound.playBossWarning();
      this.spawnElite(player, camera, hpMultiplier, 'Minotauro Elite', onSpawn);
    }

    // Event 3: 03:00 - Zombie / Leafcutter-Ant Ring + Butcher Elite (#3 Chest)
    if (sec >= 180 && !this.triggeredEvents.has('wave_180')) {
      this.triggeredEvents.add('wave_180');
      this.triggerAlert(
        this.isAmazonForest
          ? '🐜 CERCO DE FORMIGAS-CORTADEIRAS COM CARNICEIRO ELITE!'
          : '💀 CERCO DE ZUMBIS COM CARNICEIRO ELITE!',
        4.5
      );
      sound.playBossWarning();
      this.spawnRingEnemies(player, hpMultiplier, this.isAmazonForest ? 'leafcutter_ant' : 'zombie', onSpawn);
      this.spawnElite(player, camera, hpMultiplier * 1.05, 'Carniceiro Elite', onSpawn);
    }

    // Event 4: 04:00 - Spectral General Elite (#4 Chest)
    if (sec >= 240 && !this.triggeredEvents.has('wave_240')) {
      this.triggeredEvents.add('wave_240');
      this.triggerAlert('⚔️ GENERAL ESPECTRAL ELITE SURGIU!', 5);
      sound.playBossWarning();
      this.spawnElite(player, camera, hpMultiplier * 1.15, 'General Espectral Elite', onSpawn);
      if (this.difficulty.enemyCount >= 1.15) {
        this.spawnElite(player, camera, hpMultiplier, 'Guardião Sombrio Elite', onSpawn);
      }
    }

    // Event 5: 05:00 - Amazon boss waves every 90s (night plain keeps its final boss).
    // The 10 scheduled folklore bosses end with Boitatá at 18:30; after that
    // only the elite hordes below keep spawning.
    if (
      this.isAmazonForest &&
      sec >= this.nextAmazonBossTime &&
      this.amazonBossWave < 10
    ) {
      this.nextAmazonBossTime += 90;
      this.spawnAmazonBossWave(camera, hpMultiplier, onSpawn, sound);
    }

    // After Boitatá (18:30), the forest keeps the pressure up with intense
    // elite packs until the 20:00 mark.
    if (
      this.isAmazonForest &&
      sec >= 1110 &&
      sec < 1200 &&
      sec >= this.nextAmazonEliteHordeTime &&
      enemies.length < 380
    ) {
      this.nextAmazonEliteHordeTime = sec + 12;
      this.spawnAmazonEliteHorde(camera, hpMultiplier, onSpawn);
      this.triggerAlert('🔥 HORDA DE ELITES DA MATA!', 3.5);
      sound.playBossWarning();
    }

    // Event 5: 05:00 - Final Boss: Senhor da Corrupção! (night plain only)
    if (!this.isAmazonForest && sec >= 300 && !this.triggeredEvents.has('final_boss')) {
      this.triggeredEvents.add('final_boss');
      this.triggerAlert('👑 SENHOR DA CORRUPÇÃO SURGIU! DERROTE-O PARA VENCER!', 6);
      sound.playBossWarning();
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

        if (!this.isAmazonForest && (minuteMark - 5) % 3 === 0 && !this.bossActive) {
          this.triggerAlert(`👑 REENCARNAÇÃO DO SENHOR DA CORRUPÇÃO (MINUTO ${minuteMark})!`, 5.5);
          const boss = this.spawnBoss(player, camera, hpMultiplier * 1.15, onSpawn);
          this.bossActive = boss;
        } else {
          this.triggerAlert(`🔥 ONDA INFINITA DO MINUTO ${minuteMark}: CAÇADORES ELITE!`, 4.5);
          const ringType: EnemyType = this.isAmazonForest
            ? minuteMark % 2 === 0
              ? 'blue_butterfly'
              : 'cicada'
            : minuteMark % 2 === 0
              ? 'ghost'
              : 'skeleton';
          this.spawnRingEnemies(player, hpMultiplier * 0.95, ringType, onSpawn);
          this.spawnElite(player, camera, hpMultiplier * 1.1, 'Executor Abissal Elite', onSpawn);
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

  private getWaterSpawnPosition(camera: Camera, radius: number): { x: number; y: number } | null {
    if (!this.worldProps) return null;

    // The off-screen spawn ring is sampled until it intersects the river or a
    // lake. If this part of the map has no water nearby, callers fall back to
    // the regular land fauna instead of dropping an aquatic enemy on dry land.
    for (let i = 0; i < 24; i++) {
      const pos = this.getSpawnPositionOutsideScreen(camera);
      if (this.worldProps.isNavigableWater(pos.x, pos.y, radius)) return pos;
    }
    return null;
  }

  private spawnRegularEnemy(
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const pos = this.getSpawnPositionOutsideScreen(camera);
    const minutes = this.survivalTime / 60;

    let type: Enemy['type'] = 'bat';
    const roll = Math.random();

    if (this.isAmazonForest) {
      // The forest starts with its fast basic fauna and gradually mixes in
      // tougher medium threats, then slow high-HP resistant fauna.
      const mediumChance = Math.min(0.55, Math.max(0, (minutes - 0.5) * 0.16));
      const resistantChance = Math.min(0.3, Math.max(0, (minutes - 2) * 0.07));
      const isResistant = Math.random() < resistantChance;
      const isMedium = !isResistant && Math.random() < mediumChance;

      // A share of the forest waves comes from the river fauna. The spawn is
      // only accepted when the off-screen point is genuinely over water.
      if (Math.random() < 0.28) {
        const aquaticPool = isResistant
          ? AMAZON_AQUATIC_RESISTANT_ENEMIES
          : isMedium
            ? AMAZON_AQUATIC_MEDIUM_ENEMIES
            : AMAZON_AQUATIC_BASIC_ENEMIES;
        const aquaticType = aquaticPool[Math.floor(Math.random() * aquaticPool.length)];
        const aquaticPos = this.getWaterSpawnPosition(camera, 24);
        if (aquaticPos) {
          onSpawn(this.createEnemy(aquaticType, aquaticPos.x, aquaticPos.y, hpMult));
          return;
        }
      }

      const pool = isResistant
        ? AMAZON_RESISTANT_ENEMIES
        : isMedium
          ? AMAZON_MEDIUM_ENEMIES
          : AMAZON_BASIC_ENEMIES;
      type = pool[Math.floor(Math.random() * pool.length)];
    } else if (minutes < 1) {
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

  /** Enemy type spawned by boss summon skills: bats elsewhere, bullet ants in the forest. */
  public getMinionEnemyType(): EnemyType {
    return this.isAmazonForest ? 'bullet_ant' : 'bat';
  }

  public createEnemy(type: EnemyType, x: number, y: number, hpMult: number): Enemy {
    const enemy = new Enemy(this.nextEnemyId++, type, x, y, hpMult);
    enemy.damage = Math.max(1, Math.round(enemy.damage * this.difficulty.enemyDamage));
    enemy.xpValue = Math.max(1, Math.round(enemy.xpValue * this.difficulty.xpMultiplier));
    return enemy;
  }

  private spawnSwarm(
    player: Player,
    camera: Camera,
    type: EnemyType,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const count = Math.round(32 * this.difficulty.enemyCount);
    for (let i = 0; i < count; i++) {
      const pos = this.getSpawnPositionOutsideScreen(camera);
      onSpawn(this.createEnemy(type, pos.x, pos.y, 0.85));
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

  private spawnAmazonBossWave(
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void,
    sound: SoundEngine
  ): void {
    const simultaneous =
      this.difficulty.id === 'hard'
        ? 2
        : this.difficulty.id === 'nightmare' || this.difficulty.id === 'infernal'
          ? 3
          : 1;
    const order: EnemyType[] = [
      'boss_curupira',
      'boss_saci',
      'boss_boto',
      'boss_iara',
      'boss_caipora',
      'boss_matinta',
      'boss_vitoria_regia',
      'boss_mapinguari',
      'boss_cobra_grande',
      'boss_boitata',
    ];
    const type = order[this.amazonBossWave % order.length];
    this.amazonBossWave += 1;

    let bossName = '';
    for (let i = 0; i < simultaneous; i++) {
      let pos = this.getSpawnPositionOutsideScreen(camera);
      // Iara, Boto and the Cobra-Grande are river spirits: try to make them
      // surface near the river or a lake when there is water just outside the
      // camera. The Cobra (Sucuri) must never start stranded on dry forest.
      if (type === 'boss_boto' || type === 'boss_iara' || type === 'boss_cobra_grande') {
        const waterPos = this.getWaterSpawnPosition(camera, 48);
        if (waterPos) {
          pos = waterPos;
        } else if (type === 'boss_cobra_grande' && this.worldProps) {
          pos = this.worldProps.getNearestRiverPoint(pos.x);
        }
      }

      const boss = this.createEnemy(type, pos.x, pos.y, hpMult);
      if (i === 0) {
        this.bossActive = boss;
        bossName = boss.name;
      }
      onSpawn(boss);
    }

    this.triggerAlert(`👑 ${bossName.toUpperCase()} SURGIU NA FLORESTA!`, 6);
    sound.playBossWarning();
  }

  private spawnAmazonEliteHorde(
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const eliteTypes: EnemyType[] = [
      'elite_jaguar',
      'elite_tapir',
      'elite_goliath_spider',
    ];
    const count = Math.max(2, Math.round(3 * this.difficulty.enemyCount));
    for (let i = 0; i < count; i++) {
      const pos = this.getSpawnPositionOutsideScreen(camera);
      const type = eliteTypes[Math.floor(Math.random() * eliteTypes.length)];
      onSpawn(this.createEnemy(type, pos.x, pos.y, hpMult * 1.1));
    }
  }

  private spawnBoss(
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): Enemy {
    const pos = this.getSpawnPositionOutsideScreen(camera);
    const boss = this.createEnemy('boss_vampire', pos.x, pos.y, hpMult);
    onSpawn(boss);
    return boss;
  }
}
