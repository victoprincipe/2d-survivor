import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Camera } from '../engine/Camera';
import { SoundEngine } from '../engine/SoundEngine';

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

    // Calculate dynamic spawn rate and HP scaling based on time
    const minutes = this.survivalTime / 60;
    const hpMultiplier = 1.0 + minutes * 0.45;
    const spawnInterval = Math.max(0.18, 0.9 - minutes * 0.12);
    const maxEnemies = Math.min(300, 60 + Math.floor(minutes * 40));

    // Regular interval spawning
    if (this.spawnTimer >= spawnInterval && enemies.length < maxEnemies) {
      this.spawnTimer = 0;
      this.spawnRegularEnemy(player, camera, hpMultiplier, onSpawn);
    }

    // Timed Events
    const sec = Math.floor(this.survivalTime);

    // Event 1: 01:00 - Bat Swarm
    if (sec === 60 && !this.triggeredEvents.has('bat_swarm')) {
      this.triggeredEvents.add('bat_swarm');
      this.triggerAlert('🦇 ENXAME DE MORCEGOS APROXIMA-SE!', 4);
      sound.playBossWarning();
      this.spawnBatSwarm(player, camera, onSpawn);
    }

    // Event 2: 02:00 - Elite Minotaur (Treasure Chest drop!)
    if (sec === 120 && !this.triggeredEvents.has('elite_1')) {
      this.triggeredEvents.add('elite_1');
      this.triggerAlert('⚔️ MINOTAURO ELITE SURGIU! DERROTE-O PARA UM BAÚ DE TESOURO!', 5);
      sound.playBossWarning();
      this.spawnElite(player, camera, hpMultiplier, onSpawn);
    }

    // Event 3: 03:00 - Ring Formation
    if (sec === 180 && !this.triggeredEvents.has('ring_swarm')) {
      this.triggeredEvents.add('ring_swarm');
      this.triggerAlert('💀 CERCO DE ZUMBIS! ELES ESTÃO TE CERCANDO!', 4);
      sound.playBossWarning();
      this.spawnRingEnemies(player, hpMultiplier, onSpawn);
    }

    // Event 4: 04:00 - Second Elite
    if (sec === 240 && !this.triggeredEvents.has('elite_2')) {
      this.triggeredEvents.add('elite_2');
      this.triggerAlert('⚔️ GENERAL ESPECTRAL ELITE SURGIU!', 5);
      sound.playBossWarning();
      this.spawnElite(player, camera, hpMultiplier, onSpawn);
    }

    // Event 5: 05:00 - Final Boss: Crimson Vampire Lord!
    if (sec === 300 && !this.triggeredEvents.has('final_boss')) {
      this.triggeredEvents.add('final_boss');
      this.triggerAlert('👑 LORDE CARMESIM SURGIU! DERROTE-O PARA VENCER A PARTIDA!', 6);
      sound.playBossWarning();
      const boss = this.spawnBoss(player, camera, hpMultiplier, onSpawn);
      this.bossActive = boss;
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
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const pos = this.getSpawnPositionOutsideScreen(camera);
    const minutes = this.survivalTime / 60;

    let type: Enemy['type'] = 'bat';
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

    onSpawn(new Enemy(this.nextEnemyId++, type, pos.x, pos.y, hpMult));
  }

  private spawnBatSwarm(player: Player, camera: Camera, onSpawn: (enemy: Enemy) => void): void {
    const count = 35;
    for (let i = 0; i < count; i++) {
      const pos = this.getSpawnPositionOutsideScreen(camera);
      onSpawn(new Enemy(this.nextEnemyId++, 'bat', pos.x, pos.y, 0.8));
    }
  }

  private spawnRingEnemies(player: Player, hpMult: number, onSpawn: (enemy: Enemy) => void): void {
    const count = 28;
    const radius = 420;
    for (let i = 0; i < count; i++) {
      const angle = (i * Math.PI * 2) / count;
      const x = player.x + Math.cos(angle) * radius;
      const y = player.y + Math.sin(angle) * radius;
      onSpawn(new Enemy(this.nextEnemyId++, 'zombie', x, y, hpMult));
    }
  }

  private spawnElite(
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): void {
    const pos = this.getSpawnPositionOutsideScreen(camera);
    onSpawn(new Enemy(this.nextEnemyId++, 'elite_minotaur', pos.x, pos.y, hpMult));
  }

  private spawnBoss(
    player: Player,
    camera: Camera,
    hpMult: number,
    onSpawn: (enemy: Enemy) => void
  ): Enemy {
    const pos = this.getSpawnPositionOutsideScreen(camera);
    const boss = new Enemy(this.nextEnemyId++, 'boss_vampire', pos.x, pos.y, hpMult);
    onSpawn(boss);
    return boss;
  }
}
