import { DifficultyConfig, EnemyType, MapId } from '../types';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Camera } from '../engine/Camera';
import { SoundEngine } from '../engine/SoundEngine';

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

export class WaveDirector {
  public survivalTime: number = 0;
  public difficulty: DifficultyConfig;
  private mapId: MapId;
  private nextEnemyId: number = 1;
  private spawnTimer: number = 0;

  constructor(difficulty: DifficultyConfig, mapId: MapId = 'night_plain') {
    this.difficulty = difficulty;
    this.mapId = mapId;
  }

  private get isAmazonForest(): boolean {
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
      this.bossActive = null;
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
    if (!this.freezeSpawns && this.spawnTimer >= spawnInterval && enemies.length < maxEnemies) {
      this.spawnTimer = 0;
      this.spawnRegularEnemy(player, camera, hpMultiplier, onSpawn);
    }

    if (this.freezeSpawns) {
      return;
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

    // Event 5: 05:00 - Final Boss: Senhor da Corrupção!
    if (sec >= 300 && !this.triggeredEvents.has('final_boss')) {
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

        if ((minuteMark - 5) % 3 === 0 && !this.bossActive) {
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
      // tougher medium threats as the run goes on.
      const mediumChance = Math.min(0.55, Math.max(0, (minutes - 0.5) * 0.16));
      const pool = Math.random() < mediumChance ? AMAZON_MEDIUM_ENEMIES : AMAZON_BASIC_ENEMIES;
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
