import { Enemy } from '../entities/Enemy';
import { Drop } from '../entities/Drops';
import { Player } from '../entities/Player';
import { Camera } from '../engine/Camera';
import { SoundEngine } from '../engine/SoundEngine';
import { DifficultyConfig } from '../data/difficulty';
import { EnemyType } from '../types';

export class WaveDirector {
  public survivalTime: number = 0;
  private nextEnemyId: number = 1;
  private spawnTimer: number = 0;

  // Event flags to ensure one-time triggers
  public eventAlert: string | null = null;
  public eventAlertTimer: number = 0;
  private triggeredEvents: Set<string> = new Set();
  public bossActive: Enemy | null = null;
  public isEndless: boolean = false;

  private nextRandomEventTime: number = 75;
  private nextEndlessBossTime: number = 420;
  private readonly difficulty: DifficultyConfig;

  constructor(difficulty: DifficultyConfig) {
    this.difficulty = difficulty;
  }

  update(
    dt: number,
    player: Player,
    camera: Camera,
    enemies: Enemy[],
    sound: SoundEngine,
    onSpawn: (enemy: Enemy) => void,
    onDrop: (drop: Drop) => void
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

    // Calculate dynamic spawn rate and HP scaling based on time and difficulty
    const minutes = this.survivalTime / 60;
    const hpMultiplier = 1.0 + minutes * 0.45;
    const spawnInterval = Math.max(0.08, (0.6 - minutes * 0.09) / this.difficulty.spawnRateMult);
    const maxEnemies = Math.min(420, Math.floor((90 + minutes * 55) * this.difficulty.spawnRateMult));

    // Regular interval spawning
    if (this.spawnTimer >= spawnInterval && enemies.length < maxEnemies) {
      this.spawnTimer = 0;
      this.spawnRegularEnemy(camera, hpMultiplier, onSpawn);
    }

    // Timed Events
    const sec = Math.floor(this.survivalTime);

    // Event 1: 01:00 - Bat Swarm
    if (sec >= 60 && !this.triggeredEvents.has('bat_swarm')) {
      this.triggeredEvents.add('bat_swarm');
      this.triggerAlert('🦇 ENXAME DE MORCEGOS APROXIMA-SE!', 4);
      sound.playBossWarning();
      this.spawnBatSwarm(camera, onSpawn);
    }

    // Event 2: 02:00 - Elite Minotaur (Treasure Chest drop!)
    if (sec >= 120 && !this.triggeredEvents.has('elite_1')) {
      this.triggeredEvents.add('elite_1');
      this.triggerAlert('⚔️ MINOTAURO ELITE SURGIU! DERROTE-O PARA UM BAÚ DE TESOURO!', 5);
      sound.playBossWarning();
      this.spawnElite(camera, hpMultiplier, onSpawn, 'elite_minotaur');
    }

    // Event 3: 03:00 - Ring Formation
    if (sec >= 180 && !this.triggeredEvents.has('ring_swarm')) {
      this.triggeredEvents.add('ring_swarm');
      this.triggerAlert('💀 CERCO DE ZUMBIS! ELES ESTÃO TE CERCANDO!', 4);
      sound.playBossWarning();
      this.spawnRingEnemies(player, hpMultiplier, onSpawn);
    }

    // Event 4: 04:00 - Elite Banshee
    if (sec >= 240 && !this.triggeredEvents.has('elite_2')) {
      this.triggeredEvents.add('elite_2');
      this.triggerAlert('👻 BANSHEE ELITE SURGIU! SEU GRITO ATRAVESSA A ALMA!', 5);
      sound.playBossWarning();
      this.spawnElite(camera, hpMultiplier, onSpawn, 'elite_banshee');
    }

    // Event 5: 04:30 - Mini-boss Golem
    if (sec >= 270 && !this.triggeredEvents.has('miniboss')) {
      this.triggeredEvents.add('miniboss');
      this.triggerAlert('🗿 GOLEM ANCESTRAL DESPERTOU! CUIDADO COM ONDAS SÍSMICAS!', 5);
      sound.playBossWarning();
      this.spawnElite(camera, hpMultiplier, onSpawn, 'miniboss_golem');
    }

    // Event 6: 05:00 - Final Boss: Crimson Vampire Lord!
    if (sec >= 300 && !this.triggeredEvents.has('final_boss')) {
      this.triggeredEvents.add('final_boss');
      this.triggerAlert('👑 LORDE CARMESIM SURGIU! DERROTE-O PARA VENCER A PARTIDA!', 6);
      sound.playBossWarning();
      const boss = this.spawnBoss(camera, hpMultiplier, onSpawn);
      this.bossActive = boss;
    }

    // Random events after the first minute
    if (this.survivalTime >= this.nextRandomEventTime && sec >= 90) {
      this.nextRandomEventTime += 55;
      this.triggerRandomEvent(player, camera, hpMultiplier, onSpawn, onDrop);
    }

    // Endless mode keeps spawning powerful bosses after victory
    if (this.isEndless && this.survivalTime >= this.nextEndlessBossTime) {
      this.nextEndlessBossTime += 120;
      this.triggerAlert('☠️ UM NECROMANTE DO VÉU EMERGE DO ABISMO!', 5);
      sound.playBossWarning();
      const pos = this.getSpawnPositionOutsideScreen(camera);
      const boss = this.spawnEnemy('boss_necromancer', pos.x, pos.y, hpMultiplier);
      this.bossActive = boss;
      onSpawn(boss);
    }
  }

  private triggerAlert(text: string, duration: number = 4): void {
    this.eventAlert = text;
    this.eventAlertTimer = duration;
  }

  public spawnEnemy(type: EnemyType, x: number, y: number, hpMultiplier: number = 1): Enemy {
    const enemy = new Enemy(this.nextEnemyId++, type, x, y, hpMultiplier);
    return this.applyDifficultyToEnemy(enemy);
  }

  public applyDifficultyToEnemy(enemy: Enemy): Enemy {
    enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * this.difficulty.enemyHpMult));
    enemy.hp = enemy.maxHp;
    enemy.damage = Math.max(1, Math.round(enemy.damage * this.difficulty.enemyDamageMult));
    enemy.specialDamage = Math.max(1, Math.round(enemy.specialDamage * this.difficulty.enemyDamageMult));
    return enemy;
  }

  private getSpawnPositionOutsideScreen(camera: Camera): { x: number; y: number } {
    const margin = 70;
    const halfW = camera.viewportWidth / 2 + margin;
    const halfH = camera.viewportHeight / 2 + margin;

    // Pick a random side: 0=top, 1=right, 2=bottom, 3=left
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
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const pos = this.getSpawnPositionOutsideScreen(camera);
    const minutes = this.survivalTime / 60;

    let type: EnemyType = 'bat';
    const roll = Math.random();

    if (minutes < 1) {
      type = roll < 0.7 ? 'bat' : 'zombie';
    } else if (minutes < 2) {
      type = roll < 0.4 ? 'bat' : roll < 0.8 ? 'skeleton' : 'zombie';
    } else if (minutes < 3.5) {
      type = roll < 0.3 ? 'skeleton' : roll < 0.65 ? 'ghost' : 'zombie';
    } else {
      type = roll < 0.25 ? 'bat' : roll < 0.5 ? 'ghost' : roll < 0.8 ? 'skeleton' : 'zombie';
    }

    onSpawn(this.spawnEnemy(type, pos.x, pos.y, hpMult));
  }

  private spawnBatSwarm(camera: Camera, onSpawn: (enemy: Enemy) => void): void {
    const count = Math.round(35 * this.difficulty.spawnRateMult);
    for (let i = 0; i < count; i++) {
      const pos = this.getSpawnPositionOutsideScreen(camera);
      onSpawn(this.spawnEnemy('bat', pos.x, pos.y, 0.8));
    }
  }

  private spawnRingEnemies(player: Player, hpMult: number, onSpawn: (enemy: Enemy) => void): void {
    const count = Math.round(28 * this.difficulty.spawnRateMult);
    const radius = 420;
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      const x = player.x + Math.cos(angle) * radius;
      const y = player.y + Math.sin(angle) * radius;
      onSpawn(this.spawnEnemy('zombie', x, y, hpMult));
    }
  }

  private spawnInvasion(player: Player, hpMult: number, onSpawn: (enemy: Enemy) => void): void {
    const count = Math.round(22 * this.difficulty.spawnRateMult);
    const radius = 360;
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      const x = player.x + Math.cos(angle) * radius;
      const y = player.y + Math.sin(angle) * radius;
      const type: EnemyType = i % 3 === 0 ? 'ghost' : i % 3 === 1 ? 'skeleton' : 'bat';
      onSpawn(this.spawnEnemy(type, x, y, hpMult));
    }
  }

  private spawnElite(
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void,
    type: EnemyType = 'elite_minotaur'
  ): void {
    const pos = this.getSpawnPositionOutsideScreen(camera);
    onSpawn(this.spawnEnemy(type, pos.x, pos.y, hpMult));
  }

  private spawnBoss(
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): Enemy {
    const pos = this.getSpawnPositionOutsideScreen(camera);
    const boss = this.spawnEnemy('boss_vampire', pos.x, pos.y, hpMult);
    onSpawn(boss);
    return boss;
  }

  private triggerRandomEvent(
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void,
    onDrop: (drop: Drop) => void
  ): void {
    const roll = Math.random();

    if (roll < 0.3) {
      this.triggerAlert('🦇 EMBOSCADA! UMA NUVEM DE MORCEGOS SE APROXIMA!', 4);
      this.spawnBatSwarm(camera, onSpawn);
    } else if (roll < 0.55) {
      this.triggerAlert('💀 INVASÃO! A HORDA CERCA VOCÊ POR TODOS OS LADOS!', 4);
      this.spawnInvasion(player, hpMult, onSpawn);
    } else if (roll < 0.8) {
      this.triggerAlert('⚔️ UM ELITE VAGANTE SENTIU SEU CHEIRO!', 4);
      this.spawnElite(camera, hpMult, onSpawn, Math.random() < 0.5 ? 'elite_minotaur' : 'elite_banshee');
    } else {
      const angle = Math.random() * Math.PI * 2;
      const x = player.x + Math.cos(angle) * 120;
      const y = player.y + Math.sin(angle) * 120;
      onDrop(new Drop(Date.now(), 'chest', x, y));
      this.triggerAlert('🎁 UM BAÚ LENDÁRIO CAIU DO CÉU! CORRA PARA COLETAR!', 4);
    }
  }
}
