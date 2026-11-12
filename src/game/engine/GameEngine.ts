import {
  EquipmentItem,
  CharacterConfig,
  DifficultyConfig,
  DifficultyId,
  GameEndSummary,
  HUDState,
  MapId,
  MissionObjectivesHUD,
  AmazonMissionMetric,
  UpgradeOption,
  SavedGameData,
  WeaponId,
  PassiveId,
  DevDebugConfig,
  DevTelemetrySnapshot,
  EnemyType,
} from '../types';
import { claimGuardianBow, emptyInventory, FOREST_ARMOR, GUARDIAN_BOW, ANACONDA_GLOVES, withEquipment } from '../data/inventory';
import { Camera } from './Camera';
import { InputManager } from './Input';
import { SoundEngine } from './SoundEngine';
import { SpatialGrid } from './SpatialGrid';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { GorillaNpc } from '../entities/GorillaNpc';
import { CaveInterior } from '../entities/CaveInterior';
import { KopenawaNpc } from '../entities/KopenawaNpc';
import { KopenawaBoss, KopenawaClone } from '../entities/KopenawaBoss';
import { GorillaBoss } from '../entities/GorillaBoss';
import { AnacondaBoss } from '../entities/AnacondaBoss';
import { AnacondaNpc } from '../entities/AnacondaNpc';
import { EquipmentDrop } from '../entities/EquipmentDrop';
import { ANACONDA } from '../data/anaconda';
import { GORILLA_ARENA, GORILLA_LEAP, GORILLA_ROAR } from '../data/gorilla';
import { KOPENAWAS } from '../data/kopenawa';
import { Drop } from '../entities/Drops';
import { VFXManager } from '../entities/VFX';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { WaveDirector } from '../systems/WaveDirector';
import {
  CollectedFruit,
  HerbProp,
  MUD_OTTER_SPEED_MULTIPLIER,
  MUD_RIVER_PREDATOR_SPEED_MULTIPLIER,
  MUD_SPEED_MULTIPLIER,
  WATER_SPEED_MULTIPLIER,
  WorldSystem,
} from '../systems/WorldProps';
import { WEAPON_REGISTRY, PASSIVE_REGISTRY, AMAZON_STARTING_WEAPON_BY_CHARACTER } from '../data/upgrades';
import { saveGameData, loadSavedData } from '../data/persistence';
import { getDifficulty } from '../data/difficulties';
import { applyRunToMissions } from '../data/missions';

export interface GameEngineCallbacks {
  onAnacondaDialogue?: () => void;
  onEquipmentReward: (item: EquipmentItem) => void;
  onGorillaDialogue?: () => void;
  onHUDUpdate: (hud: HUDState) => void;
  onLevelUp: (options: UpgradeOption[]) => void;
  onTreasureChest: (gold: number, upgrade?: UpgradeOption) => void;
  onGameOver: (summary: GameEndSummary) => void;
  onVictory: (summary: GameEndSummary) => void;
}

interface BossProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  kind: 'fireball' | 'soundwave' | 'water' | 'sonic' | 'spore' | 'spirit';
}

interface BossHazard {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  kind: 'ember' | 'wind' | 'puddle' | 'thorns';
  tickTimer: number;
  damage: number;
  windStrength: number;
  // Wind combo: after the whirlpool pulls the hero, it flings them toward
  // Matinta Pereira's line of sonic waves.
  windTargetX?: number;
  windTargetY?: number;
}

interface WaterRipple {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  maxRadius: number;
  splash: boolean;
  angle: number;
}

// Amazon food-chain tuning. Animals only leave the player alone outside this
// radius; predators hunt on the requested 10-12s / 15s cycles.
const ECOLOGY_PLAYER_SAFE_RADIUS = 420;
const ECOLOGY_GRAZING_ARRIVAL = 52;
const ECOLOGY_FRUIT_EAT_RADIUS = 54;
const ECOLOGY_RIVER_PREDATOR_RANGE = 320;
const ECOLOGY_JAGUAR_RANGE = 360;
const ECOLOGY_FRUIT_FEED_COOLDOWN = 8;

// The Sucuri ignores the usual water/mud penalties and is faster on wet ground.
const SUCURI_WATER_SPEED_MULTIPLIER = 1.5;
const SUCURI_SHORE_SPEED_MULTIPLIER = 1.3;

// Entering the Sucuri's combat detection radius automatically starts the duel
// and seals the upper lake with small stone mountains. Reuse her dive radius
// as the detection range.
const SUCURI_ARENA_TRIGGER_RADIUS = ANACONDA.dive.radius;

// Land animals climb a plateau's vertical wall 20% slower than they walk on
// flat ground, simulating the effort of scaling it.
const PLATEAU_CLIMB_SPEED_MULTIPLIER = 0.8;

// Amazon thorn bushes: immediate damage, a 40% slow and a 10s bleeding wound.
const THORN_BUSH_DAMAGE = 7;
const THORN_BUSH_BLEED_DPS = 2;
const THORN_BUSH_BLEED_DURATION = 10;
const THORN_BUSH_SLOW = 0.4;
const THORN_BUSH_HIT_COOLDOWN = 2;

// Iara's Dynamic Flood: 7s rising, 5s at the peak, 7s receding (19s loop).
const FLOOD_RISE_DURATION = 7;
const FLOOD_HOLD_DURATION = 5;
const FLOOD_RECEDE_DURATION = 7;
const FLOOD_CYCLE_DURATION =
  FLOOD_RISE_DURATION + FLOOD_HOLD_DURATION + FLOOD_RECEDE_DURATION;

// While Iara's flood covers the forest, the Boto and the Vitória-Régia swim
// 30% faster and their signature attacks sweep the newly flooded area.
const FLOOD_RIVER_SPIRIT_SPEED_MULTIPLIER = 1.3;

// Amazon Forest mission objectives.
const OBJECTIVE_ACT1_FRUITS = 3;
const OBJECTIVE_ACT1_LEVEL = 10;
const OBJECTIVE_ACT2_BOSSES = 5;
const OBJECTIVE_ACT2_PREDATORS = 2;
const OBJECTIVE_ACT2_START = 300;
const OBJECTIVE_MAP_END = 1200;

// Random Amazon Forest missions: seven options per phase, drawn before the run.
const AMAZON_TURN_ENDS = [300, 900, 1200] as const;
const AMAZON_TURN_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Fase 1 · 00:00–05:00',
  2: 'Fase 2 · 05:00–15:00',
  3: 'Fase 3 · 15:00–20:00',
};

interface AmazonMissionTemplate {
  id: string;
  title: string;
  metric: AmazonMissionMetric;
  target: number;
}

const AMAZON_MISSION_BANK: Record<1 | 2 | 3, AmazonMissionTemplate[]> = {
  1: [
    { id: 'a1_fruits', title: 'Coletar frutas', metric: 'fruits', target: 5 },
    { id: 'a1_level', title: 'Alcançar nível', metric: 'level', target: 10 },
    {
      id: 'a1_water',
      title: 'Bichos na água/praia',
      metric: 'waterKills',
      target: 15,
    },
    { id: 'a1_gold', title: 'Juntar ouro', metric: 'gold', target: 300 },
    {
      id: 'a1_predators',
      title: 'Abater predadores',
      metric: 'evolvedPredators',
      target: 1,
    },
    {
      id: 'a1_fruits_big',
      title: 'Coleta reforçada',
      metric: 'fruits',
      target: 8,
    },
    { id: 'a1_gold_big', title: 'Ouro da mata', metric: 'gold', target: 500 },
  ],
  2: [
    { id: 'a2_fruits', title: 'Coletar frutas', metric: 'fruits', target: 10 },
    { id: 'a2_level', title: 'Alcançar nível', metric: 'level', target: 20 },
    {
      id: 'a2_water',
      title: 'Bichos na água/praia',
      metric: 'waterKills',
      target: 30,
    },
    {
      id: 'a2_predators',
      title: 'Abater predadores',
      metric: 'evolvedPredators',
      target: 3,
    },
    {
      id: 'a2_bosses',
      title: 'Derrotar chefes',
      metric: 'bosses',
      target: 5,
    },
    {
      id: 'a2_fruits_big',
      title: 'Fartura da floresta',
      metric: 'fruits',
      target: 15,
    },
    { id: 'a2_gold', title: 'Fortuna verde', metric: 'gold', target: 800 },
  ],
  3: [
    { id: 'a3_level', title: 'Alcançar nível', metric: 'level', target: 30 },
    {
      id: 'a3_water',
      title: 'Bichos na água/praia',
      metric: 'waterKills',
      target: 50,
    },
    {
      id: 'a3_predators',
      title: 'Abater predadores',
      metric: 'evolvedPredators',
      target: 5,
    },
    { id: 'a3_gold', title: 'Juntar ouro', metric: 'gold', target: 1500 },
    {
      id: 'a3_bosses',
      title: 'Derrotar chefes',
      metric: 'bosses',
      target: 8,
    },
    {
      id: 'a3_fruits',
      title: 'Colheita final',
      metric: 'fruits',
      target: 20,
    },
    {
      id: 'a3_water_big',
      title: 'Rio infestado',
      metric: 'waterKills',
      target: 75,
    },
  ],
};

interface AmazonMissionBaseline {
  fruits: number;
  waterKills: number;
  evolvedPredators: number;
  bosses: number;
  gold: number;
}

interface AmazonTurnState {
  turn: 1 | 2 | 3;
  endTime: number;
  missions: AmazonMissionTemplate[];
  baseline: AmazonMissionBaseline;
  claimedMissions: string[];
  bonusApplied: boolean;
}

interface AmazonObjectivesState {
  fruitsCollected: number;
  waterKills: number;
  folkloreBossesDefeated: number;
  evolvedPredatorsDefeated: number;
  cobraGrandeDefeated: boolean;
  boitataDefeated: boolean;
  act1Complete: boolean;
  act2Complete: boolean;
  act3Complete: boolean;
  act1RewardApplied: boolean;
  act2RewardApplied: boolean;
}

const RIVER_PREDATOR_PREY: EnemyType[] = [
  'capybara',
  'elite_tapir',
  'pink_river_dolphin',
  'piranha',
  'poison_dart_frog',
];

const JAGUAR_PREY: EnemyType[] = [
  'capybara',
  'elite_tapir',
  'sloth',
  'toucan',
  'poison_dart_frog',
];

const SUCURI_PREY: EnemyType[] = [
  'capybara',
  'toucan',
  'poison_dart_frog',
  'rhino_beetle',
  'sawyer_beetle',
  'bullet_ant',
  'leafcutter_ant',
];

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public camera: Camera;
  public input: InputManager;
  public sound: SoundEngine;
  public spatialGrid: SpatialGrid<Enemy>;

  public player: Player;
  public weaponSystem: WeaponSystem;
  public waveDirector: WaveDirector;
  public worldProps: WorldSystem;
  public vfx: VFXManager;
  public difficulty: DifficultyConfig;

  public enemies: Enemy[] = [];
  private readonly gorillaNpc: GorillaNpc | null;
  private readonly anacondaNpc: AnacondaNpc | null;
  private anacondaDefeated = false;
  private challengeBossSerial = -1;
  private readonly kopenawaNpc: KopenawaNpc | null;
  private kopenawaDefeated = false;
  private caveUnlocked = false;
  private readonly caveInterior = new CaveInterior();
  private insideCave = false;
  private caveRewardClaimed = false;
  private gorillaDefeated = false;
  private gorillaArena: { x: number; y: number; radius: number } | null = null;
  private arenaKind: 'stone' | 'roots' = 'stone';
  private bossEncounter: { kind: 'gorilla' | 'anaconda' | 'kopenawa'; boss: GorillaBoss | AnacondaBoss | KopenawaBoss; hiddenEnemies: Enemy[]; previousBoss: Enemy | null } | null = null;

  private get anacondaAvailable(): boolean {
    return !!this.anacondaNpc && !this.bossEncounter && !this.anacondaDefeated;
  }

  private beginBossEncounter(kind: 'gorilla' | 'anaconda' | 'kopenawa', boss: GorillaBoss | AnacondaBoss | KopenawaBoss): void {
    this.bossEncounter = { kind, boss, hiddenEnemies: this.enemies, previousBoss: this.waveDirector.bossActive };
    this.enemies = [boss];
    this.spatialGrid.clear(); this.bossProjectiles = []; this.bossHazards = [];
    this.waveDirector.bossActive = boss;
    this.resume(); this.syncHUD();
  }

  private restoreBossEncounter(): void {
    const encounter = this.bossEncounter;
    if (!encounter) return;
    if (encounter.kind === 'gorilla' || encounter.kind === 'kopenawa') this.gorillaArena = null;
    if (encounter.kind === 'anaconda') this.worldProps.deactivateAnacondaArena();
    // Disarm stale homing-projectile references when a challenge is cancelled.
    encounter.boss.hp = 0;
    this.processedEnemyDeaths.add(encounter.boss);
    if (encounter.boss instanceof AnacondaBoss) encounter.boss.clearEffects();
    this.enemies = encounter.hiddenEnemies.filter(enemy => enemy.hp > 0);
    this.waveDirector.bossActive = encounter.previousBoss && encounter.previousBoss.hp > 0 ? encounter.previousBoss : null;
    this.bossEncounter = null;
    this.spatialGrid.clear(); this.bossProjectiles = []; this.bossHazards = [];
  }

  private isNearAnaconda(): boolean {
    if (!this.anacondaNpc) return false;
    return Math.hypot(this.player.x - this.anacondaNpc.x, this.player.y - this.anacondaNpc.y) <= SUCURI_ARENA_TRIGGER_RADIUS;
  }

  public startAnacondaCombat(): boolean {
    const npc = this.anacondaNpc;
    if (!this.anacondaAvailable || !npc || !this.isNearAnaconda() || this.isGameOver ||
      !this.worldProps.isInUpperLake(this.player.x, this.player.y)) return false;
    // The arena becomes solid on the exact frame combat begins.
    this.worldProps.activateAnacondaArena();
    const minutes = this.waveDirector.survivalTime / 60;
    const boss = new AnacondaBoss(this.challengeBossSerial--, npc.x, npc.y,
      (1 + minutes * 0.3) * this.difficulty.enemyHp, this.worldProps);
    boss.damage = Math.round(boss.damage * this.difficulty.enemyDamage);
    this.beginBossEncounter('anaconda', boss);
    this.sound.playWaterStep();
    return true;
  }

  private get gorillaAvailable(): boolean {
    return !!this.gorillaNpc && !this.bossEncounter && !this.gorillaDefeated;
  }

  private isNearGorilla(): boolean {
    if (!this.gorillaNpc) return false;
    return Math.hypot(this.player.x - this.gorillaNpc.x, this.player.y - this.gorillaNpc.y) <= GORILLA_ARENA.triggerRadius;
  }

  private activateArena(boss: { x: number; y: number }, kind: 'stone' | 'roots'): void {
    const distance = Math.hypot(this.player.x - boss.x, this.player.y - boss.y);
    // Both guardians use a 1200-unit diameter arena; the minimum always
    // encloses the hero on the exact frame the staff/fists strike the ground.
    this.arenaKind = kind;
    this.gorillaArena = {
      x: boss.x,
      y: boss.y,
      radius: Math.max(GORILLA_ARENA.radius, distance + this.player.radius + 32),
    };
    this.camera.shake(0.35, 11);
    this.sound.playGorillaGroundSlam();
    this.weaponSystem.spawnRingPulse(
      this.gorillaArena.x,
      this.gorillaArena.y,
      this.gorillaArena.radius,
      kind === 'roots' ? '#7c3aed' : '#a8a29e',
      0.65
    );
  }

  private clampToGorillaArena(x: number, y: number, radius: number): { x: number; y: number } {
    const arena = this.gorillaArena;
    if (!arena) return { x, y };
    const dx = x - arena.x;
    const dy = y - arena.y;
    const limit = arena.radius - radius;
    const distance = Math.hypot(dx, dy);
    if (distance <= limit || distance === 0) return { x, y };
    return { x: arena.x + (dx / distance) * limit, y: arena.y + (dy / distance) * limit };
  }

  public startGorillaCombat(): boolean {
    if (!this.gorillaAvailable || !this.isNearGorilla() || this.isGameOver) return false;
    const npc = this.gorillaNpc;
    if (!npc) return false;
    const minutes = this.waveDirector.survivalTime / 60;
    const boss = new GorillaBoss(this.challengeBossSerial--, npc.x, npc.y,
      (1 + minutes * 0.3) * this.difficulty.enemyHp);
    boss.damage = Math.round(boss.damage * this.difficulty.enemyDamage);
    this.beginBossEncounter('gorilla', boss);
    return true;
  }

  private get kopenawaAvailable(): boolean {
    return !!this.kopenawaNpc && !this.bossEncounter && !this.kopenawaDefeated;
  }

  private isNearKopenawa(): boolean {
    if (!this.kopenawaNpc) return false;
    return Math.hypot(this.player.x - this.kopenawaNpc.x, this.player.y - this.kopenawaNpc.y) <= KOPENAWAS.triggerRadius;
  }

  public startKopenawaCombat(): boolean {
    if (!this.kopenawaAvailable || !this.isNearKopenawa() || this.isGameOver) return false;
    const npc = this.kopenawaNpc;
    if (!npc) return false;
    const minutes = this.waveDirector.survivalTime / 60;
    const boss = new KopenawaBoss(this.challengeBossSerial--, npc.x, npc.y,
      (1 + minutes * 0.3) * this.difficulty.enemyHp);
    boss.damage = Math.round(boss.damage * this.difficulty.enemyDamage);
    this.beginBossEncounter('kopenawa', boss);
    return true;
  }
  public drops: Drop[] = [];
  private bossProjectiles: BossProjectile[] = [];
  private bossHazards: BossHazard[] = [];
  private waterRipples: WaterRipple[] = [];
  private playerWaterFxTimer: number = 0;
  private floodCycleTime: number = 0;
  private floodPhysicsActive: boolean = false;
  // Amazon elemental combo presence, refreshed once per frame.
  private fireComboActive: boolean = false;
  private windComboActive: boolean = false;
  private earthComboActive: boolean = false;

  public kills: number = 0;
  public goldCollected: number = 0;
  public bossesDefeated: number = 0;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public hasWon: boolean = false;

  // DevTools / Telemetry / Debug
  public debugConfig: DevDebugConfig = {
    showHitboxes: false,
    showRanges: false,
    showSpatialGrid: false,
    timeScale: 1.0,
    freezeSpawns: false,
    cameraZoom: 1.0,
  };
  public currentFps: number = 60;
  public currentFrameTimeMs: number = 16.6;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private animFrameId: number | null = null;
  private hudThrottleTimer: number = 0;
  private itemSpawnTimer: number = 0;
  private processedEnemyDeaths = new WeakSet<Enemy>();
  private thornCooldowns = new WeakMap<Enemy, number>();
  private missionSnapshot = { kills: 0, survivalSeconds: 0, goldCollected: 0, bossesDefeated: 0 };
  private amazonObjectives: AmazonObjectivesState = {
    fruitsCollected: 0,
    waterKills: 0,
    folkloreBossesDefeated: 0,
    evolvedPredatorsDefeated: 0,
    cobraGrandeDefeated: false,
    boitataDefeated: false,
    act1Complete: false,
    act2Complete: false,
    act3Complete: false,
    act1RewardApplied: false,
    act2RewardApplied: false,
  };
  private amazonTurns: AmazonTurnState[] = [];
  private amazonCurrentTurn: number = 0;

  private callbacks: GameEngineCallbacks;

  constructor(
    canvas: HTMLCanvasElement,
    character: CharacterConfig,
    savedData: SavedGameData,
    difficultyId: DifficultyId,
    mapId: MapId,
    callbacks: GameEngineCallbacks
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;

    this.callbacks = callbacks;
    this.camera = new Camera(canvas.width, canvas.height);
    this.input = new InputManager();
    this.sound = new SoundEngine();
    this.spatialGrid = new SpatialGrid<Enemy>(110);
    this.vfx = new VFXManager();
    this.worldProps = new WorldSystem(mapId);
    this.gorillaNpc = mapId === 'amazon_forest' ? new GorillaNpc() : null;
    this.anacondaNpc = mapId === 'amazon_forest' ? new AnacondaNpc() : null;
    this.kopenawaNpc = mapId === 'amazon_forest' ? new KopenawaNpc() : null;
    const inventory = savedData.inventories?.[character.id] ?? emptyInventory();
    this.caveRewardClaimed = inventory.items.some(item => item.id === GUARDIAN_BOW.id);
    // Kopenawa respawns like the Gorilla and the Giant Anaconda: the save only
    // keeps the cave unlocked, never the boss defeated for the next run.
    this.caveUnlocked = inventory.kopenawaDefeated === true || this.caveRewardClaimed;
    if (this.caveUnlocked) this.worldProps.unlockForestCave();
    this.difficulty = getDifficulty(difficultyId);
    this.waveDirector = new WaveDirector(this.difficulty, mapId, this.worldProps);
    this.amazonTurns = this.createAmazonMissionTurns();
    this.beginAmazonTurn(0);

    this.player = new Player(withEquipment(character, savedData.inventories?.[character.id] ?? emptyInventory()), savedData.powerUps);
    // Randomize the hero spawn on the Amazon Forest and snap the camera to it
    // before the first frame, so the view/minimap never start at the old centre.
    const spawn = this.worldProps.getRandomPlayerSpawn(this.player.radius);
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.camera.x = spawn.x;
    this.camera.y = spawn.y;
    this.player.levelUpHealFraction = this.difficulty.levelUpHealFraction;
    this.player.setCollisionResolver((fromX, fromY, dx, dy, radius, airborne) => {
      const resolved = this.insideCave
        ? this.caveInterior.resolveMovement(fromX, fromY, dx, dy, radius)
        : this.worldProps.resolvePlayerMovement(fromX, fromY, dx, dy, radius, airborne);
      return this.clampToGorillaArena(resolved.x, resolved.y, radius);
    });
    this.weaponSystem = new WeaponSystem(
      mapId === 'amazon_forest'
        ? (AMAZON_STARTING_WEAPON_BY_CHARACTER[character.id] ?? 'garras_onca')
        : character.startingWeapon,
      mapId === 'amazon_forest'
        ? { maxWeaponSlots: 4, maxPassiveSlots: 4, maxItemLevel: 10 }
        : undefined
    );
    this.weaponSystem.recalculatePlayerStats(this.player);
    this.player.hp = this.player.maxHp;

    // Initial resize
    this.handleResize();

    // Hook input pause toggle
    this.input.onPauseToggle = () => {
      if (!this.isGameOver) {
        this.togglePause();
      }
    };
  }

  public handleResize(): void {
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const width = this.canvas.parentElement?.clientWidth || window.innerWidth || 800;
    const height = this.canvas.parentElement?.clientHeight || window.innerHeight || 600;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
    this.camera.resize(width, height);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.sound.startBgm(this.waveDirector.isAmazonForest ? 'amazon_forest' : 'night_plain');
    if (this.waveDirector.isAmazonForest) {
      this.sound.startAmazonAmbient();
    }
    this.loop(this.lastTime);
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.input.clearJump();
    this.input.clearInteract();
    this.lastTime = performance.now();
  }

  public togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Canvas pointer input. Tapping the floating fruit prompt harvests the tree;
   * every other tap keeps driving the virtual joystick.
   */
  public handlePointerDown(screenX: number, screenY: number): void {
    const fruit = this.worldProps.collectFruitTreeAtScreenPoint(
      screenX,
      screenY,
      this.camera,
      this.player
    );
    if (fruit) {
      this.handleFruitCollected(fruit);
      return;
    }
    this.input.handlePointerDown(screenX, screenY);
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    // A queued RAF timestamp can precede performance.now() recorded by resume().
    // Never rewind the simulation or index animation frames with negative time.
    const frameTime = Math.max(0, currentTime - this.lastTime);
    this.currentFrameTimeMs = Math.round(frameTime * 10) / 10;
    this.frameCount++;
    this.fpsTimer += frameTime;
    if (this.fpsTimer >= 400) {
      this.currentFps = Math.max(1, Math.round((this.frameCount * 1000) / this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    const rawDt = frameTime / 1000;
    this.lastTime = Math.max(this.lastTime, currentTime);
    const timeScale = Math.max(0.1, Math.min(10, this.debugConfig.timeScale || 1.0));
    const dt = Math.min(rawDt, 0.1) * timeScale;

    if (!this.isPaused && !this.isGameOver) {
      this.update(dt);
    }

    this.render();

    this.animFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  private update(dt: number): void {
    this.anacondaNpc?.update(dt);
    this.kopenawaNpc?.update(dt);
    this.gorillaNpc?.update(dt);
    const interactRequested = this.input.consumeInteract();
    if (this.insideCave) {
      this.player.isWadingInWater = false;
      this.player.isInMud = false;
      this.player.isMired = false;
      this.player.terrainSpeedMultiplier = 1;
      if (!this.player.update(dt, this.input)) { this.handlePlayerDeath(); return; }
      if (interactRequested && this.caveInterior.nearExit(this.player)) {
        this.insideCave = false;
        this.sound.stopCaveAmbience();
        this.sound.startBgm('amazon_forest');
        this.sound.startAmazonAmbient();
        this.player.x = -1950;
        this.player.y = 1980;
      } else if (interactRequested && this.caveInterior.nearReward(this.player) && this.caveUnlocked && !this.caveRewardClaimed) {
        const data = loadSavedData();
        const id = this.player.character.id;
        const inventory = data.inventories[id] ?? emptyInventory();
        const next = claimGuardianBow({ ...inventory, kopenawaDefeated: true });
        saveGameData({ ...data, inventories: { ...data.inventories, [id]: next } });
        this.caveRewardClaimed = true;
        this.sound.playChestOpen();
        this.syncHUD();
        this.pause();
        this.callbacks.onEquipmentReward(GUARDIAN_BOW);
      }
      if (this.insideCave) this.caveInterior.updateCamera(this.camera, this.player);
      else {
        this.camera.x = this.player.x;
        this.camera.y = this.player.y;
      }
      return;
    }
    // The forest guardians engage by themselves the moment the hero is spotted.
    if (this.kopenawaAvailable && this.isNearKopenawa()) {
      this.startKopenawaCombat();
      return;
    }
    if (this.gorillaAvailable && this.isNearGorilla()) {
      this.startGorillaCombat();
      return;
    }
    if (interactRequested && !this.bossEncounter && this.caveUnlocked && Math.hypot(this.player.x + 1950, this.player.y - 1935) < 75) {
      this.insideCave = true;
      this.sound.startCaveAmbience();
      this.player.x = this.caveInterior.spawn.x;
      this.player.y = this.caveInterior.spawn.y;
      this.player.knockbackVX = 0;
      this.player.knockbackVY = 0;
      this.player.dashTimer = 0;
      this.caveInterior.updateCamera(this.camera, this.player);
      this.input.clearJump();
      return;
    }
    if (interactRequested && this.gorillaAvailable && this.gorillaNpc?.canInteract(this.player) && this.callbacks.onGorillaDialogue) {
      this.pause();
      this.input.handlePointerUp();
      this.callbacks.onGorillaDialogue();
      return;
    }

    // Iara's Dynamic Flood cycle (rising / hold / recede) before terrain physics.
    this.updateFloodCycle(dt);

    // Sucuri proximity trigger: entering her detection radius starts the duel
    // automatically and turns the upper-lake shore into solid stone mountains.
    if (this.anacondaAvailable && this.isNearAnaconda() && this.startAnacondaCombat()) {
      return;
    }

    // 1. Terrain physics: mud and water slow the hero down before the step.
    const playerInWater = this.worldProps.isWaterSurface(this.player.x, this.player.y);
    const playerInFlood =
      !playerInWater &&
      this.floodPhysicsActive &&
      this.worldProps.isFloodWater(this.player.x, this.player.y);
    const playerOnArenaRock = this.worldProps.isInAnacondaWall(
      this.player.x,
      this.player.y + this.player.radius * 0.6
    );
    const playerInMud =
      !playerInWater &&
      !playerInFlood &&
      !playerOnArenaRock &&
      this.worldProps.isMud(this.player.x, this.player.y);
    this.player.isWadingInWater = playerInWater || playerInFlood;
    this.player.isInMud = playerInMud && !this.player.isJumping;
    this.player.isMired = false;
    this.player.terrainSpeedMultiplier = this.player.isJumping
      ? 1
      : playerInWater || playerInFlood
        ? WATER_SPEED_MULTIPLIER
        : playerInMud
          ? MUD_SPEED_MULTIPLIER
          : 1;

    // 2. Update Player
    const playerAlive = this.player.update(dt, this.input);
    if (!playerAlive) {
      this.handlePlayerDeath();
      return;
    }

    // 2.1. Refresh which Amazon elemental combos are currently on the field.
    if (this.bossEncounter?.kind === 'anaconda' && !this.anacondaDefeated && !this.worldProps.isInUpperLake(this.player.x, this.player.y)) {
      this.restoreBossEncounter();
      this.syncHUD();
      return;
    }
    this.updateAmazonElementalCombos();

    // 1.5. Water trail for the hero (and timers for the animal trails below).
    this.updateWaterEffects(dt);

    // 2. Update Camera
    this.camera.follow(this.player.x, this.player.y, dt);

    // 3. Clear and Rebuild Spatial Grid with current enemies.
    // Piranha, Boto-cor-de-rosa and Ariranha stay hidden under the surface
    // until the hero enters the water. While submerged they are left out of
    // the grid so weapons, projectiles and separation cannot detect or hit
    // them at all.
    const amazonNight = this.isAmazonNight();
    this.spatialGrid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      e.isSubmerged = e.isAmbushAquatic && !playerInWater;
      if (!e.isSubmerged) this.spatialGrid.insert(e);
    }

    // 3.5. Food-chain target selection (grazing / fruit foraging).
    this.prepareAmazonEcology(dt);

    // 4. Update Enemies + Boss Special Attacks
    const spawnedMinions: Enemy[] = [];
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.playerInWater = playerInWater;
      // The forest night frenzy accelerates every animal by 25%.
      e.isAmazonNight = amazonNight;
      // Terrain physics for land animals: the river slows them by 30% and the
      // muddy margins by 20%. River predators ignore the mud penalty and get a
      // +30% boost there; the Ariranha gets +20% instead. The Sucuri is
      // amphibious and instead earns +50% in water and +30% on banks/mud.
      const enemyInWater = this.worldProps.isWaterSurface(e.x, e.y);
      const enemyInFlood =
        !enemyInWater &&
        this.floodPhysicsActive &&
        this.worldProps.isFloodWater(e.x, e.y);
      const enemyInMud =
        !enemyInWater && !enemyInFlood && this.worldProps.isMud(e.x, e.y);
      // The flood only drags ordinary land animals; bosses, elites, flyers and
      // native water creatures keep their own movement rules.
      const floodSlowsEnemy =
        enemyInFlood &&
        !e.isBoss &&
        !e.isElite &&
        !e.isWaterDweller &&
        !e.isRiverPredator &&
        e.type !== 'bat' &&
        e.type !== 'ghost';
      if (e.type === 'sucuri') {
        e.terrainSpeedMultiplier = enemyInWater
          ? SUCURI_WATER_SPEED_MULTIPLIER
          : enemyInMud || this.worldProps.isRiverBankTerrain(e.x, e.y, e.radius)
            ? SUCURI_SHORE_SPEED_MULTIPLIER
            : 1.0;
      } else if (e.isRiverPredator) {
        e.terrainSpeedMultiplier = enemyInMud
          ? MUD_RIVER_PREDATOR_SPEED_MULTIPLIER
          : playerInWater
            ? (enemyInWater ? 1.5 : 1.3)
            : 1.0;
      } else if (e.type === 'giant_otter') {
        e.terrainSpeedMultiplier = enemyInMud ? MUD_OTTER_SPEED_MULTIPLIER : 1.0;
      } else if (
        this.floodPhysicsActive &&
        (e.type === 'boss_boto' || e.type === 'boss_vitoria_regia')
      ) {
        // Iara's flood lets the river spirits leave the original river bed and
        // swim across the whole flooded area with a 30% speed boost.
        e.terrainSpeedMultiplier = FLOOD_RIVER_SPIRIT_SPEED_MULTIPLIER;
      } else if (e.isWaterDweller) {
        e.terrainSpeedMultiplier = 1.0;
      } else {
        e.terrainSpeedMultiplier =
          enemyInWater || floodSlowsEnemy
            ? WATER_SPEED_MULTIPLIER
            : enemyInMud
              ? MUD_SPEED_MULTIPLIER
              : 1.0;
      }

      // Scaling a plateau's vertical wall is slower than walking on flat
      // ground; the penalty ends as soon as the animal reaches the top or the
      // forest floor.
      if (!e.isWaterDweller && this.worldProps.isOnPlateauWall(e.x, e.y)) {
        e.terrainSpeedMultiplier *= PLATEAU_CLIMB_SPEED_MULTIPLIER;
      }

      const sep = e.isSubmerged
        ? { vx: 0, vy: 0 }
        : this.spatialGrid.applySeparation(e, e.radius * 2, 0.45);
      const previousX = e.x;
      const previousY = e.y;
      const previousJaguarState = e.jaguarState;
      const previousSkillState = e.skillState;
      const alive = e.update(dt, this.player, sep);
      if (alive && e instanceof GorillaBoss && previousSkillState !== 'dashing' && e.skillState === 'dashing') {
        this.sound.playGorillaCharge();
      }
      if (e.isJaguarPredator && e.jaguarState === 'warning' && e.jaguarAttack !== 'bite' &&
        (previousJaguarState === 'idle' || (e.jaguarAttack === 'charge' && e.jaguarTimer > 0.15))) {
        // Keep the displayed corridor terrain-safe while aiming; lock it before launch.
        const dx = e.jaguarTargetX - e.x;
        const dy = e.jaguarTargetY - e.y;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
        let targetX = e.x;
        let targetY = e.y;
        for (let step = 1; step <= steps; step++) {
          const x = e.x + dx * step / steps;
          const y = e.y + dy * step / steps;
          const resolved = this.worldProps.resolveLandMovement(targetX, targetY, x, y, e.radius);
          if (Math.hypot(resolved.x - x, resolved.y - y) > 0.1) break;
          targetX = x;
          targetY = y;
        }
        e.jaguarTargetX = targetX;
        e.jaguarTargetY = targetY;
        if (e.jaguarAttack === 'charge') {
          e.jaguarAttackDuration = Math.max(0.001, Math.hypot(targetX - e.x, targetY - e.y) / 1188);
        }
      }

      if (e.isJaguarPredator && previousJaguarState === 'idle' && e.jaguarState === 'warning' && e.jaguarAttack === 'charge') {
        this.sound.playJaguarCharge();
      }

      if (!alive) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Aquatic enemies are locked to the water: reject any step that would
      // carry them onto the riverbank or dry forest floor. The Ariranha may
      // also slide through the muddy margin, while river predators may haul
      // out onto the beach but never leave the river/beach band. The
      // Cobra-Grande's Earth-combo trample is the exception and may cross land.
      const cobraTrampling = e.type === 'boss_cobra_grande' && e.comboChargeActive;
      if (e instanceof AnacondaBoss) {
        const position = this.worldProps.resolveUpperLakeMovement(previousX, previousY, e.x, e.y, e.radius);
        e.x = position.x; e.y = position.y;
      } else if (e.isRiverPredator && !cobraTrampling) {
        const resolved = this.worldProps.resolveRiverBankMovement(
          previousX,
          previousY,
          e.x,
          e.y,
          e.radius
        );
        e.x = resolved.x;
        e.y = resolved.y;
      } else if (e.isAquatic) {
        const resolved = this.worldProps.resolveAquaticMovement(
          previousX,
          previousY,
          e.x,
          e.y,
          e.radius,
          e.type === 'giant_otter'
        );
        e.x = resolved.x;
        e.y = resolved.y;
      } else if (!(e instanceof GorillaBoss && (e.isLeaping || e.pendingLeapImpact)) && !(e.isJaguarPredator && e.jaguarAttack === 'leap' &&
        (e.jaguarState === 'active' || e.pendingJaguarStrike === 'leap'))) {
        // Land animals may scale the plateau cliffs in any direction, straight
        // towards the hero; only solid trunks and the cave still block them.
        const resolved = this.worldProps.resolveLandMovement(
          previousX,
          previousY,
          e.x,
          e.y,
          e.radius
        );
        e.x = resolved.x;
        e.y = resolved.y;
      }

      if (this.gorillaArena) {
        const clamped = this.clampToGorillaArena(e.x, e.y, e.radius);
        e.x = clamped.x;
        e.y = clamped.y;
      }

      if (e instanceof GorillaBoss) {
        if (e.pendingArenaSlam) {
          e.pendingArenaSlam = false;
          this.activateArena(e, 'stone');
        }
        if (e.pendingEntranceRoar) {
          e.pendingEntranceRoar = false;
          this.sound.playGorillaRoar();
          this.camera.shake(0.28, 8);
          this.weaponSystem.spawnRingPulse(e.x, e.y, 240, '#fbbf24', 0.45);
        }
        if (e.pendingLeapSound) {
          e.pendingLeapSound = false;
          this.sound.playGorillaLeap();
        }
        if (e.pendingRoarStart) {
          e.pendingRoarStart = false;
          if (e.pendingRoarHeal > 0) this.vfx.addDamageNumber(e.x, e.y - 80, e.pendingRoarHeal, false, true);
          e.pendingRoarHeal = 0;
          this.sound.playGorillaRoar();
          this.weaponSystem.spawnRingPulse(e.x, e.y, GORILLA_ROAR.radius, '#4ade80', 0.5);
        }
        const ticks = e.pendingRoarTicks;
        e.pendingRoarTicks = 0;
        for (let tick = 0; tick < ticks; tick++) {
          if (Math.hypot(this.player.x - e.x, this.player.y - e.y) > GORILLA_ROAR.radius + this.player.radius) continue;
          const fatal = this.applyPlayerDamage(Math.max(1, Math.round(e.damage * GORILLA_ROAR.damageMultiplier)), true, false);
          if (fatal) { this.handlePlayerDeath(); return; }
        }
      }

      if (e instanceof KopenawaBoss) {
        if (e.pendingArenaSlam) {
          e.pendingArenaSlam = false;
          this.activateArena(e, 'roots');
          this.vfx.addDeathBurst(e.x, e.y, '#7c3aed', 22);
        }
        if (e.pendingBreathHit) {
          e.pendingBreathHit = false;
          this.camera.shake(0.14, 4);
          this.weaponSystem.spawnRingPulse(e.x, e.y, KOPENAWAS.breath.range, '#a78bfa', 0.35);
          this.vfx.addSparks(e.x, e.y - 40, '#c4b5fd', 14);
          if (e.breathHits(this.player)) {
            this.player.applyTranse(KOPENAWAS.breath.transeDuration);
            const fatal = this.applyPlayerDamage(
              Math.max(1, Math.round(e.damage * KOPENAWAS.breath.damageMultiplier)),
              false,
              true
            );
            if (fatal) { this.handlePlayerDeath(); return; }
          }
        }
        if (e.pendingSpiritBolt) {
          e.pendingSpiritBolt = false;
          const angle = Math.atan2(
            this.player.y - (e.y - 28),
            this.player.x - e.x
          );
          this.vfx.addSparks(e.x, e.y - 42, '#a855f7', 12);
          this.vfx.addDeathBurst(e.x, e.y - 42, '#4ade80', 6);
          this.bossProjectiles.push({
            x: e.x,
            y: e.y - 28,
            vx: Math.cos(angle) * KOPENAWAS.spiritBolt.speed,
            vy: Math.sin(angle) * KOPENAWAS.spiritBolt.speed,
            radius: KOPENAWAS.spiritBolt.radius,
            damage: Math.max(1, Math.round(e.damage * KOPENAWAS.spiritBolt.damageMultiplier)),
            life: KOPENAWAS.spiritBolt.life,
            maxLife: KOPENAWAS.spiritBolt.life,
            kind: 'spirit',
          });
        }
        if (e.pendingClones > 0) {
          const count = e.pendingClones;
          e.pendingClones = 0;
          const arena = this.gorillaArena;
          const radius = Math.max(160, (arena?.radius ?? KOPENAWAS.arenaRadius) - 90);
          for (let clone = 0; clone < count; clone++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 110 + Math.random() * Math.max(40, radius - 110);
            const cx = e.x + Math.cos(angle) * distance;
            const cy = e.y + Math.sin(angle) * distance;
            this.enemies.push(new KopenawaClone(this.challengeBossSerial--, cx, cy));
            this.vfx.addDeathBurst(cx, cy, '#a78bfa', 16);
          }
          this.camera.shake(0.2, 6);
        }
      }

      if (e instanceof AnacondaBoss) {
        if (e.dive.pendingSound) { e.dive.pendingSound = false; this.sound.playWaterStep(); }
        if (e.dive.pendingEmergeImpact) {
          e.dive.pendingEmergeImpact = false;
          this.weaponSystem.spawnRingPulse(e.x, e.y, ANACONDA.dive.emergeRadius, '#a5f3fc', 0.45);
          this.sound.playWaterStep(); this.camera.shake(0.2, 6);
          if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= ANACONDA.dive.emergeRadius + this.player.radius &&
            this.applyPlayerDamage(Math.max(1, Math.round(ANACONDA.dive.emergeDamage * this.difficulty.enemyDamage)), true, true)) {
            this.handlePlayerDeath(); return;
          }
        }
        const waves = e.dive.pendingTicks;
        e.dive.pendingTicks = 0;
        for (let tick = 0; tick < waves; tick++) {
          this.sound.playWaterStep();
          if (Math.hypot(this.player.x - e.x, this.player.y - e.y) > ANACONDA.dive.radius + this.player.radius) continue;
          const hp = this.player.hp;
          const fatal = this.applyPlayerDamage(Math.max(1, Math.round(ANACONDA.dive.damage * this.difficulty.enemyDamage)), true, false);
          if (this.player.hp < hp) this.player.applyStun(ANACONDA.dive.stun);
          if (fatal) { this.handlePlayerDeath(); return; }
        }
        if (e.consumeBiteHit(this.player)) {
          if (this.applyPlayerDamage(e.damage, false, true)) { this.handlePlayerDeath(); return; }
        }
        const ticks = e.acid.pendingTicks;
        e.acid.pendingTicks = 0;
        for (let tick = 0; tick < ticks; tick++) {
          if (this.applyPlayerDamage(Math.max(1, Math.round(e.damage * ANACONDA.acid.damage)), true, false)) { this.handlePlayerDeath(); return; }
        }
      }
      if (e instanceof GorillaBoss && e.pendingLeapImpact) {
        const leap = GORILLA_LEAP;
        e.pendingLeapImpact = false;
        this.weaponSystem.spawnRingPulse(e.x, e.y, leap.radius, '#f59e0b', 0.4);
        this.camera.shake(0.25, 8);
        this.sound.playThunder();
        if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= leap.radius + this.player.radius &&
          !this.player.isJumping && !this.player.godMode && this.player.invulnerableTimer <= 0) {
          const hp = this.player.hp;
          const fatal = this.applyPlayerDamage(e.damage, true, true);
          if (this.player.hp < hp) this.player.applyStun(leap.stun);
          if (fatal) { this.handlePlayerDeath(); return; }
        }
      }

      // Land creatures standing on the river/lake/flood surface are drawn
      // waist-deep while the active flood is rising or at its peak.
      e.isWadingInWater =
        !e.isWaterDweller &&
        (this.worldProps.isWaterSurface(e.x, e.y) ||
          (this.floodPhysicsActive && this.worldProps.isFloodWater(e.x, e.y)));

      // Animals wading through the river leave the same ring/splash trail as
      // the hero. Submerged ambushers stay hidden and therefore leave no wake.
      const movedX = e.x - previousX;
      const movedY = e.y - previousY;
      if (
        !e.isSubmerged &&
        movedX * movedX + movedY * movedY > 4 &&
        this.worldProps.isWaterSurface(e.x, e.y) &&
        e.waterRippleTimer <= 0
      ) {
        e.waterRippleTimer = 0.2 + Math.random() * 0.16;
        this.spawnWaterRipple(e.x, e.y + e.radius * 0.55, e.radius >= 22);
      }

      // Boss Nova Burst Resolution
      if (e.pendingNovaBurst) {
        e.pendingNovaBurst = false;
        this.weaponSystem.spawnRingPulse(e.x, e.y, e.novaRadius, '#ef4444', 0.32);
        if (e instanceof AnacondaBoss) this.sound.playWaterStep();
        else if (e instanceof GorillaBoss) this.sound.playGorillaGroundSlam();
        else this.sound.playThunder();
        this.camera.shake(0.25, 6);

        const ndx = this.player.x - e.x;
        const ndy = this.player.y - e.y;
        if (Math.sqrt(ndx * ndx + ndy * ndy) <= e.novaRadius + this.player.radius) {
          const novaDmg = Math.max(1, Math.round(e.damage * 0.85));
          const fatal = this.applyPlayerDamage(novaDmg, true, false);
          if (fatal) {
            this.handlePlayerDeath();
            return;
          }
        }
      }

      // Boss Dark Summon Resolution
      if (e.pendingSummonCount > 0) {
        const toSpawn = e.pendingSummonCount;
        e.pendingSummonCount = 0;
        if (this.enemies.length + spawnedMinions.length < 400) {
          this.vfx.addDeathBurst(e.x, e.y, '#a855f7', 16);
          const minutes = this.waveDirector.survivalTime / 60;
          const hpMult = (1.0 + minutes * 0.4) * this.difficulty.enemyHp;
          for (let s = 0; s < toSpawn; s++) {
            const ang = (s * Math.PI * 2) / toSpawn;
            const mx = e.x + Math.cos(ang) * 65;
            const my = e.y + Math.sin(ang) * 65;
            spawnedMinions.push(
              this.waveDirector.createEnemy(this.waveDirector.getMinionEnemyType(), mx, my, hpMult)
            );
          }
        }
      }

      // Amazon Forest boss attacks.
      if (e.pendingFireballBurst > 0) {
        const burst = e.pendingFireballBurst;
        e.pendingFireballBurst = 0;
        const baseAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        this.vfx.addSparks(e.x, e.y, '#f97316', 12);
        for (let k = 0; k < burst; k++) {
          const angle = baseAngle + (k - (burst - 1) / 2) * 0.18;
          this.bossProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * 290,
            vy: Math.sin(angle) * 290,
            radius: 9,
            damage: Math.max(1, Math.round(e.damage * 0.7)),
            life: 2.6,
            maxLife: 2.6,
            kind: 'fireball',
          });
        }
      }

      if (e.pendingEmberTrail) {
        e.pendingEmberTrail = false;
        const isBoitata = e.type === 'boss_boitata';
        const emberCount = isBoitata ? 1 : 3;
        for (let k = 0; k < emberCount; k++) {
          const angle = Math.random() * Math.PI * 2;
          const offset = isBoitata ? Math.random() * 8 : 10 + Math.random() * 26;
          this.bossHazards.push({
            x: e.x + Math.cos(angle) * offset,
            y: e.y + Math.sin(angle) * offset,
            radius: isBoitata ? 22 : 28,
            life: isBoitata ? 2.5 : 4.5,
            maxLife: isBoitata ? 2.5 : 4.5,
            kind: 'ember',
            tickTimer: 0,
            damage: Math.max(1, Math.round(e.damage * (isBoitata ? 0.25 : 0.3))),
            windStrength: 0,
          });
        }
        this.vfx.addSparks(e.x, e.y, '#fb923c', isBoitata ? 4 : 10);
      }

      if (e.pendingEncirclingEmbers && this.fireComboActive) {
        e.pendingEncirclingEmbers = false;
        const ringCount = 4;
        const ringOffset = e.animTimer * 0.6 + Math.random() * 0.5;
        const damage = Math.max(1, Math.round(e.damage * 0.25));
        for (let k = 0; k < ringCount; k++) {
          const ringAngle = ringOffset + (k * Math.PI * 2) / ringCount;
          const ringRadius = 96 + Math.random() * 22;
          this.bossHazards.push({
            x: this.player.x + Math.cos(ringAngle) * ringRadius,
            y: this.player.y + Math.sin(ringAngle) * ringRadius,
            radius: 24,
            life: 3.5,
            maxLife: 3.5,
            kind: 'ember',
            tickTimer: 0,
            damage,
            windStrength: 0,
          });
        }
        this.vfx.addSparks(this.player.x, this.player.y, '#fb923c', 8);
      }

      if (e.pendingFireRing > 0) {
        const count = e.pendingFireRing;
        e.pendingFireRing = 0;
        this.vfx.addSparks(e.x, e.y, '#f97316', 18);
        this.camera.shake(0.16, 4);
        for (let k = 0; k < count; k++) {
          const angle = (k * Math.PI * 2) / count;
          this.bossProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * 220,
            vy: Math.sin(angle) * 220,
            radius: 10,
            damage: Math.max(1, Math.round(e.damage * 0.55)),
            life: 3,
            maxLife: 3,
            kind: 'fireball',
          });
        }
      }

      if (e.pendingTeleport) {
        e.pendingTeleport = false;
        const oldX = e.x;
        const oldY = e.y;
        const angle = Math.random() * Math.PI * 2;
        const distance = 160 + Math.random() * 120;
        const targetX = this.player.x + Math.cos(angle) * distance;
        const targetY = this.player.y + Math.sin(angle) * distance;
        const resolved = this.worldProps.resolvePlayerMovement(
          e.x,
          e.y,
          targetX - e.x,
          targetY - e.y,
          e.radius
        );
        e.x = resolved.x;
        e.y = resolved.y;
        // Wind combo: the whirlpool pulls the hero in, then flings them toward
        // Matinta Pereira while she fires a synchronized sonic wave.
        const matinta = this.windComboActive
          ? this.enemies.find((other) => other.type === 'boss_matinta' && other.hp > 0)
          : undefined;
        this.bossHazards.push({
          x: oldX,
          y: oldY,
          radius: matinta ? 320 : 230,
          life: matinta ? 1.4 : 3.6,
          maxLife: matinta ? 1.4 : 3.6,
          kind: 'wind',
          tickTimer: 0,
          damage: 0,
          windStrength: matinta ? -260 : Math.random() < 0.5 ? 170 : -170,
          windTargetX: matinta?.x,
          windTargetY: matinta?.y,
        });
        if (matinta) matinta.pendingSonicWave = true;
        this.vfx.addDeathBurst(oldX, oldY, '#94a3b8', 12);
        this.vfx.addSparks(e.x, e.y, '#f472b6', 14);
      }

      if (e.pendingWindBurst > 0) {
        const bursts = e.pendingWindBurst;
        e.pendingWindBurst = 0;
        for (let k = 0; k < bursts; k++) {
          this.bossHazards.push({
            x: e.x,
            y: e.y,
            radius: 230,
            life: 4,
            maxLife: 4,
            kind: 'wind',
            tickTimer: 0,
            damage: 0,
            windStrength: Math.random() < 0.5 ? 170 : -170,
          });
        }
      }

      if (e.pendingSoundWave) {
        e.pendingSoundWave = false;
        const baseAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        // During the flood the Boto widens and lengthens the fan so the hero
        // cannot simply outrun it along the flooded banks.
        const floodEmpowered = this.floodPhysicsActive;
        const waveCount = floodEmpowered ? 7 : 5;
        const waveSpread = floodEmpowered ? 0.25 : 0.22;
        const waveSpeed = floodEmpowered ? 275 : 240;
        const waveLife = floodEmpowered ? 3.6 : 3;
        this.camera.shake(0.12, floodEmpowered ? 4 : 3);
        for (let k = 0; k < waveCount; k++) {
          const angle = baseAngle + (k - (waveCount - 1) / 2) * waveSpread;
          this.bossProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * waveSpeed,
            vy: Math.sin(angle) * waveSpeed,
            radius: floodEmpowered ? 12 : 11,
            damage: Math.max(1, Math.round(e.damage * 0.65)),
            life: waveLife,
            maxLife: waveLife,
            kind: 'soundwave',
          });
        }
      }

      if (e.pendingWaterJet > 0) {
        const burst = e.pendingWaterJet;
        e.pendingWaterJet = 0;
        const baseAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        this.vfx.addSparks(e.x, e.y, '#38bdf8', 12);
        for (let k = 0; k < burst; k++) {
          const angle = baseAngle + (k - (burst - 1) / 2) * 0.12;
          this.bossProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * 430,
            vy: Math.sin(angle) * 430,
            radius: 8,
            damage: Math.max(1, Math.round(e.damage * 0.65)),
            life: 2.6,
            maxLife: 2.6,
            kind: 'water',
          });
        }
      }

      if (e.pendingSlowPool) {
        e.pendingSlowPool = false;
        for (let k = 0; k < 4; k++) {
          const angle = (k * Math.PI * 2) / 4 + Math.random() * 0.4;
          const offset = 45 + Math.random() * 45;
          this.bossHazards.push({
            x: e.x + Math.cos(angle) * offset,
            y: e.y + Math.sin(angle) * offset,
            radius: 54,
            life: 5.5,
            maxLife: 5.5,
            kind: 'puddle',
            tickTimer: 0,
            damage: 0,
            windStrength: 0,
          });
        }
        this.vfx.addSparks(e.x, e.y, '#22d3ee', 10);
      }

      if (e.pendingSummonWild > 0) {
        const toSpawn = e.pendingSummonWild;
        e.pendingSummonWild = 0;
        if (this.enemies.length + spawnedMinions.length < 400) {
          this.vfx.addDeathBurst(e.x, e.y, '#65a30d', 14);
          const minutes = this.waveDirector.survivalTime / 60;
          const hpMult = (1.0 + minutes * 0.4) * this.difficulty.enemyHp;
          for (let s = 0; s < toSpawn; s++) {
            const ang = (s * Math.PI * 2) / toSpawn;
            const mx = e.x + Math.cos(ang) * 70;
            const my = e.y + Math.sin(ang) * 70;
            const wildType: EnemyType = s % 2 === 0 ? 'capybara' : 'toucan';
            spawnedMinions.push(this.waveDirector.createEnemy(wildType, mx, my, hpMult));
          }
        }
      }

      if (e.pendingSonicWave) {
        e.pendingSonicWave = false;
        const baseAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        this.camera.shake(0.16, 4);
        for (let k = 0; k < 7; k++) {
          const angle = baseAngle + (k - 3) * 0.2;
          this.bossProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * 260,
            vy: Math.sin(angle) * 260,
            radius: 10,
            damage: Math.max(1, Math.round(e.damage * 0.6)),
            life: 3.4,
            maxLife: 3.4,
            kind: 'sonic',
          });
        }
      }

      if (e.pendingSummonBirds > 0) {
        const toSpawn = e.pendingSummonBirds;
        e.pendingSummonBirds = 0;
        if (this.enemies.length + spawnedMinions.length < 400) {
          this.vfx.addDeathBurst(e.x, e.y, '#6b21a8', 14);
          const minutes = this.waveDirector.survivalTime / 60;
          const hpMult = (1.0 + minutes * 0.4) * this.difficulty.enemyHp;
          for (let s = 0; s < toSpawn; s++) {
            const ang = (s * Math.PI * 2) / toSpawn;
            const mx = e.x + Math.cos(ang) * 80;
            const my = e.y + Math.sin(ang) * 80;
            spawnedMinions.push(
              this.waveDirector.createEnemy('bat', mx, my, hpMult)
            );
          }
        }
      }

      if (e.pendingSporeRing > 0) {
        const rings = e.pendingSporeRing;
        e.pendingSporeRing = 0;
        // The flood carries the spores farther: denser rings that expand over
        // the whole flooded area instead of only the old shoreline.
        const floodEmpowered = this.floodPhysicsActive;
        const sporeCount = floodEmpowered ? 20 : 16;
        const sporeSpeed = floodEmpowered ? 220 : 190;
        const sporeLife = floodEmpowered ? 4 : 3.4;
        this.vfx.addSparks(e.x, e.y, '#84cc16', floodEmpowered ? 22 : 16);
        for (let ring = 0; ring < rings; ring++) {
          const offset = (ring * Math.PI) / sporeCount;
          for (let k = 0; k < sporeCount; k++) {
            const angle = offset + (k * Math.PI * 2) / sporeCount;
            this.bossProjectiles.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(angle) * sporeSpeed,
              vy: Math.sin(angle) * sporeSpeed,
              radius: floodEmpowered ? 9 : 8,
              damage: Math.max(1, Math.round(e.damage * 0.45)),
              life: sporeLife,
              maxLife: sporeLife,
              kind: 'spore',
            });
          }
        }
      }

      if (e.pendingThornRoots) {
        e.pendingThornRoots = false;
        for (let k = 0; k < 8; k++) {
          const angle = (k * Math.PI * 2) / 8 + Math.random() * 0.25;
          const offset = 65 + Math.random() * 40;
          this.bossHazards.push({
            x: e.x + Math.cos(angle) * offset,
            y: e.y + Math.sin(angle) * offset,
            radius: 28,
            life: 5.5,
            maxLife: 5.5,
            kind: 'thorns',
            tickTimer: 0,
            damage: Math.max(1, Math.round(e.damage * 0.28)),
            windStrength: 0,
          });
        }
        this.vfx.addSparks(e.x, e.y, '#65a30d', 12);
      }

      if (e.pendingStomp) {
        e.pendingStomp = false;
        this.camera.shake(0.28, 8);
        this.vfx.addDeathBurst(e.x, e.y, '#92400e', 18);
        const stompDx = this.player.x - e.x;
        const stompDy = this.player.y - e.y;
        const stompDist = Math.sqrt(stompDx * stompDx + stompDy * stompDy);
        if (stompDist < 190 + this.player.radius) {
          this.player.applyStun(this.earthComboActive ? 1.5 : 1.15);
          const stompDamage = Math.max(1, Math.round(e.damage * 0.7));
          const fatal = this.applyPlayerDamage(stompDamage, false, false);
          if (fatal) {
            this.handlePlayerDeath();
            return;
          }
        }
      }

      if (e.pendingRoar) {
        e.pendingRoar = false;
        this.camera.shake(0.35, 10);
        this.vfx.addDeathBurst(e.x, e.y, '#f59e0b', 24);
        const roarDx = this.player.x - e.x;
        const roarDy = this.player.y - e.y;
        const roarDist = Math.sqrt(roarDx * roarDx + roarDy * roarDy);
        if (roarDist < 360 + this.player.radius) {
          const roarDamage = Math.max(1, Math.round(e.damage * 1.1));
          const fatal = this.applyPlayerDamage(roarDamage, true, false);
          if (fatal) {
            this.handlePlayerDeath();
            return;
          }
        }
      }

      const jaguarMultiplier = e.consumeJaguarHit(this.player, previousX, previousY);
      if (jaguarMultiplier > 0 && !this.player.isJumping && !this.player.godMode && this.player.invulnerableTimer <= 0) {
        const damage = Math.max(1, Math.round(e.damage * jaguarMultiplier));
        const fatal = this.applyPlayerDamage(damage, false, true);
        if (fatal) {
          this.handlePlayerDeath();
          return;
        }
      }

      // Check body collision with player (jumping grants brief immunity)
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Sweep the wider charge over this step so a fast dash cannot skip the hero.
      const bodyHit = e instanceof GorillaBoss && e.skillState === 'dashing'
        ? e.chargeHits(this.player, previousX, previousY)
        : dist < this.player.radius + e.radius;
      if (!e.isSubmerged && !e.jaguarBusy && !(e instanceof GorillaBoss && (e.isLeaping || e.isRoaring || e.isInEntrance)) &&
        !(e instanceof KopenawaBoss && (e.isInEntrance || e.isInSmoke)) &&
        !(e instanceof KopenawaClone) &&
        !(e instanceof AnacondaBoss && !e.contactEnabled) && !this.player.isJumping && bodyHit) {
        // Fire combo: Caipora's mounted charge knocks the hero away, ideally
        // into the flame ring left by Boitatá and Curupira.
        if (e.type === 'boss_caipora' && e.skillState === 'dashing' && this.fireComboActive && dist > 0) {
          this.player.applyKnockback((dx / dist) * 520, (dy / dist) * 520);
        }
        // Earth combo: the Cobra-Grande's committed trample deals massive damage.
        const trampling = e.type === 'boss_cobra_grande' && e.comboChargeActive;
        const contactDamage = trampling
          ? Math.max(1, Math.round(e.damage * 2.4))
          : e.damage;
        const fatal = this.applyPlayerDamage(contactDamage, trampling, true);
        if (trampling) this.camera.shake(0.32, 9);

        if (fatal) {
          this.handlePlayerDeath();
          return;
        }
      }
    }

    for (let m = 0; m < spawnedMinions.length; m++) {
      this.enemies.push(spawnedMinions[m]);
      this.spatialGrid.insert(spawnedMinions[m]);
    }

    // 4.5. Thorn bushes wound the hero and common land enemies that step on them.
    if (this.updateThornBushHazards(dt)) {
      this.handlePlayerDeath();
      return;
    }

    // 5. Update World Props (Torches and fruit trees)
    this.worldProps.update(dt, this.player, (drop) => this.drops.push(drop));

    // 5.1. Fruit trees and herbs are harvested only when the player presses E nearby.
    if (interactRequested) {
      const herb = this.worldProps.collectNearbyHerb(this.player);
      if (herb) {
        this.handleHerbCollected(herb);
      } else {
        const fruit = this.worldProps.collectNearbyFruitTree(this.player);
        if (fruit) this.handleFruitCollected(fruit);
      }
    }

    // 6. Update Weapons System
    this.weaponSystem.update(
      dt,
      this.player,
      this.enemies,
      this.spatialGrid,
      this.camera,
      this.vfx,
      this.sound,
      (enemy) => this.onEnemyKilled(enemy)
    );

    // 6.2. Resolve fruit foraging and predator feeds.
    this.resolveAmazonEcology();

    // 6.5. Periodic Supply Drop on Map (every 75s)
    this.itemSpawnTimer += dt;
    if (this.itemSpawnTimer >= 75) {
      this.itemSpawnTimer -= 75;
      this.spawnRandomItem();
    }

    // 7. Update Drops & Pickups
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const collected = drop.update(dt, this.player);

      if (collected) {
        this.handleDropCollected(drop);
        this.drops.splice(i, 1);
        if (drop instanceof EquipmentDrop && this.isPaused) return;
        // A level-up or chest must finish before another pickup opens a modal.
        if (this.isPaused || this.isGameOver) {
          this.syncHUD();
          return;
        }
      }
    }

    // 8. Update Wave Director (Spawns)
    if (this.bossEncounter?.kind === 'anaconda' && this.anacondaDefeated) {
      const { x, y } = this.bossEncounter.boss;
      this.restoreBossEncounter();
      const inventory = loadSavedData().inventories[this.player.character.id] ?? emptyInventory();
      if (!inventory.items.some(item => item.id === ANACONDA_GLOVES.id) &&
        !this.drops.some(drop => drop instanceof EquipmentDrop && drop.item.id === ANACONDA_GLOVES.id)) {
        this.drops.push(new EquipmentDrop(Date.now() + Math.random(), x, y, ANACONDA_GLOVES));
      }
    }
    if (this.bossEncounter?.kind === 'gorilla' && this.gorillaDefeated) {
      this.restoreBossEncounter();
      const data = loadSavedData();
      const id = this.player.character.id;
      const inventory = data.inventories[id] ?? emptyInventory();
      if (!inventory.items.some(item => item.id === FOREST_ARMOR.id)) {
        saveGameData({ ...data, inventories: { ...data.inventories, [id]: { ...inventory, items: [...inventory.items, { ...FOREST_ARMOR, stats: { ...FOREST_ARMOR.stats } }] } } });
        this.bossProjectiles = []; this.bossHazards = []; this.spatialGrid.clear();
        this.pause(); this.callbacks.onEquipmentReward(FOREST_ARMOR); return;
      }
      this.bossProjectiles = [];
      this.bossHazards = [];
      this.spatialGrid.clear();
    }
    if (this.bossEncounter?.kind === 'kopenawa' && this.kopenawaDefeated) {
      this.restoreBossEncounter();
      const data = loadSavedData();
      const id = this.player.character.id;
      const inventory = data.inventories[id] ?? emptyInventory();
      saveGameData({
        ...data,
        inventories: { ...data.inventories, [id]: { ...inventory, kopenawaDefeated: true } },
      });
      this.bossProjectiles = [];
      this.bossHazards = [];
      this.spatialGrid.clear();
    }
    if (!this.bossEncounter) this.waveDirector.update(
      dt,
      this.player,
      this.camera,
      this.enemies,
      this.sound,
      (enemy) => this.enemies.push(enemy)
    );

    // 8.5. Update Amazon boss projectiles and ground hazards
    if (this.updateBossEffects(dt)) {
      this.handlePlayerDeath();
      return;
    }

    // 8.7. Amazon Forest mission objectives (rewards + final victory)
    if (this.updateAmazonObjectives()) return;

    // 9. Update VFX
    this.vfx.update(dt);

    // 10. Throttled React HUD synchronization (~10 Hz)
    this.hudThrottleTimer += dt;
    if (this.hudThrottleTimer >= 0.1) {
      this.hudThrottleTimer = 0;
      this.syncHUD();
    }
  }

  /**
   * Detects which folklore bosses share the battlefield and enables their
   * coordinated attacks. The fire trio counts as active with any two of its
   * guardians so the combo also works on Hard (two bosses per wave); the wind
   * and earth duos need both of their members.
   */
  private updateAmazonElementalCombos(): void {
    let fireCount = 0;
    let saci = false;
    let matinta = false;
    let mapinguari = false;
    let cobra = false;

    if (this.waveDirector.isAmazonForest) {
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.isBoss || e.hp <= 0) continue;
        if (
          e.type === 'boss_boitata' ||
          e.type === 'boss_curupira' ||
          e.type === 'boss_caipora'
        ) {
          fireCount += 1;
        } else if (e.type === 'boss_saci') {
          saci = true;
        } else if (e.type === 'boss_matinta') {
          matinta = true;
        } else if (e.type === 'boss_mapinguari') {
          mapinguari = true;
        } else if (e.type === 'boss_cobra_grande') {
          cobra = true;
        }
      }
    }

    this.fireComboActive = fireCount >= 2;
    this.windComboActive = saci && matinta;
    this.earthComboActive = mapinguari && cobra;

    const stunned = this.player.stunTimer > 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.isBoss) continue;
      e.fireComboActive = this.fireComboActive;
      e.earthComboActive = this.earthComboActive;
      e.playerStunned = stunned;
      if (!this.fireComboActive) e.pendingEncirclingEmbers = false;
    }
  }

  /**
   * Iara's Dynamic Flood. While a living Iara is on the Amazon map the river
   * rises for 7s, stays at its 70%-of-dry-land peak for 5s and recedes for 7s,
   * looping without pause until the boss dies. Only the rising/hold phases
   * apply the waist-deep water slow.
   */
  private updateFloodCycle(dt: number): void {
    if (!this.waveDirector.isAmazonForest) {
      this.floodCycleTime = 0;
      this.floodPhysicsActive = false;
      this.worldProps.setFloodIntensity(0);
      return;
    }

    const iaraAlive = this.enemies.some(
      (enemy) => enemy.type === 'boss_iara' && enemy.hp > 0
    );
    if (!iaraAlive) {
      this.floodCycleTime = 0;
      this.floodPhysicsActive = false;
      this.worldProps.setFloodIntensity(0);
      return;
    }

    this.floodCycleTime = (this.floodCycleTime + dt) % FLOOD_CYCLE_DURATION;
    const t = this.floodCycleTime;
    let intensity: number;
    if (t < FLOOD_RISE_DURATION) {
      intensity = t / FLOOD_RISE_DURATION;
      this.floodPhysicsActive = true;
    } else if (t < FLOOD_RISE_DURATION + FLOOD_HOLD_DURATION) {
      intensity = 1;
      this.floodPhysicsActive = true;
    } else {
      intensity =
        1 -
        (t - FLOOD_RISE_DURATION - FLOOD_HOLD_DURATION) / FLOOD_RECEDE_DURATION;
      this.floodPhysicsActive = false;
    }

    this.worldProps.setFloodIntensity(intensity);
  }

  /**
   * Thorn bushes hurt the hero and ordinary land animals on contact: immediate
   * damage, a 40% slow and a 10-second bleeding wound. Airborne heroes clear
   * the bush without touching it, and bosses/elites/aquatic fauna are immune.
   */
  private updateThornBushHazards(dt: number): boolean {
    if (!this.waveDirector.isAmazonForest) return false;

    if (!this.player.isJumping && this.player.thornCooldown <= 0) {
      const bush = this.worldProps.getThornBushAt(
        this.player.x,
        this.player.y,
        this.player.radius
      );
      if (bush) {
        this.player.thornCooldown = THORN_BUSH_HIT_COOLDOWN;
        const damage = Math.max(1, Math.round(THORN_BUSH_DAMAGE * this.difficulty.enemyDamage));
        const fatal = this.applyPlayerDamage(damage, false, true);
        this.player.applySlow(THORN_BUSH_SLOW, THORN_BUSH_BLEED_DURATION);
        this.player.applyBleed(THORN_BUSH_BLEED_DPS, THORN_BUSH_BLEED_DURATION);
        this.vfx.addSparks(this.player.x, this.player.y, '#dc2626', 7);
        if (fatal) return true;
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (
        enemy.hp <= 0 ||
        enemy.isSubmerged ||
        enemy.isAquatic ||
        enemy.isBoss ||
        enemy.isElite ||
        enemy.type === 'bat' ||
        enemy.type === 'ghost'
      ) {
        continue;
      }

      const cooldown = Math.max(0, (this.thornCooldowns.get(enemy) ?? 0) - dt);
      const bush =
        cooldown <= 0
          ? this.worldProps.getThornBushAt(enemy.x, enemy.y, enemy.radius)
          : null;

      if (!bush) {
        if (cooldown > 0) this.thornCooldowns.set(enemy, cooldown);
        continue;
      }

      this.thornCooldowns.set(enemy, THORN_BUSH_HIT_COOLDOWN);
      const dead = enemy.takeDamage(THORN_BUSH_DAMAGE);
      enemy.applySlow(THORN_BUSH_SLOW, THORN_BUSH_BLEED_DURATION);
      enemy.applyBleed(
        THORN_BUSH_BLEED_DPS,
        THORN_BUSH_BLEED_DPS * 4,
        THORN_BUSH_BLEED_DURATION,
        'knife'
      );
      this.vfx.addSparks(enemy.x, enemy.y, '#dc2626', 4);

      if (dead) {
        this.onEnemyKilled(enemy);
        this.thornCooldowns.delete(enemy);
      }
    }

    return false;
  }

  private handleHerbCollected(herb: HerbProp): void {
    this.player.clearSlow();
    this.player.clearBleeding();
    this.sound.playFruitCollect();
    this.vfx.addSparks(herb.x, herb.y, '#bef264', 14);
    this.vfx.addSparks(this.player.x, this.player.y, '#65a30d', 8);
  }

  /**
   * Expands and fades the water rings left by the hero and the animals, and
   * emits a fresh splash under the hero's feet while it wades.
   */
  private updateWaterEffects(dt: number): void {
    this.playerWaterFxTimer = Math.max(0, this.playerWaterFxTimer - dt);
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (enemy.waterRippleTimer > 0) {
        enemy.waterRippleTimer = Math.max(0, enemy.waterRippleTimer - dt);
      }
    }

    for (let i = this.waterRipples.length - 1; i >= 0; i--) {
      const ripple = this.waterRipples[i];
      ripple.life -= dt;
      if (ripple.life <= 0) {
        this.waterRipples.splice(i, 1);
      }
    }

    if (
      this.player.isMoving &&
      !this.player.isJumping &&
      this.worldProps.isWaterSurface(this.player.x, this.player.y) &&
      this.playerWaterFxTimer <= 0
    ) {
      this.playerWaterFxTimer = 0.22;
      this.spawnWaterRipple(this.player.x, this.player.y + this.player.radius * 0.6, true);
      this.sound.playWaterStep();
    }
  }

  private spawnWaterRipple(x: number, y: number, splash: boolean): void {
    const maxLife = splash ? 0.7 : 0.55;
    this.waterRipples.push({
      x,
      y,
      life: maxLife,
      maxLife,
      maxRadius: splash ? 38 : 24,
      splash,
      angle: Math.random() * Math.PI * 2,
    });
  }

  /**
   * Night in the Amazon Forest lasts from 10:00 to 20:00 on the run clock.
   */
  private isAmazonNight(): boolean {
    return (
      this.waveDirector.isAmazonForest && this.waveDirector.survivalTime >= 600
    );
  }

  /**
   * Assigns food-chain walk targets while the hero is far enough away:
   * herbivores head to the riverbank and the Anta heads to a fruit tree.
   */
  private prepareAmazonEcology(dt: number): void {
    if (!this.waveDirector.isAmazonForest) return;

    const safeRadiusSq = ECOLOGY_PLAYER_SAFE_RADIUS * ECOLOGY_PLAYER_SAFE_RADIUS;
    const grazingArrivalSq = ECOLOGY_GRAZING_ARRIVAL * ECOLOGY_GRAZING_ARRIVAL;

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (enemy.hp <= 0) continue;

      if (enemy.ecologyActionCooldown > 0) {
        enemy.ecologyActionCooldown -= dt;
      }

      if (enemy.isEcologyPredator) {
        if (enemy.ecologyHuntTimer > 0) {
          enemy.ecologyHuntTimer -= dt;
        }
        continue;
      }

      if (!enemy.isGrazingHerbivore && !enemy.isFruitForager) continue;

      const playerDx = this.player.x - enemy.x;
      const playerDy = this.player.y - enemy.y;
      if (playerDx * playerDx + playerDy * playerDy < safeRadiusSq) {
        // The hero is close: drop the peaceful task and resume the chase.
        enemy.ecologyTargetX = null;
        enemy.ecologyTargetY = null;
        enemy.ecologyTargetTreeId = null;
        continue;
      }

      if (enemy.isFruitForager) {
        if (enemy.ecologyTargetTreeId !== null) {
          const tree = this.worldProps.fruitTrees.find(
            (candidate) => candidate.id === enemy.ecologyTargetTreeId
          );
          if (!tree || !tree.active) {
            enemy.ecologyTargetX = null;
            enemy.ecologyTargetY = null;
            enemy.ecologyTargetTreeId = null;
          }
        }

        if (enemy.ecologyTargetX === null && enemy.ecologyActionCooldown <= 0) {
          const tree = this.worldProps.getNearestActiveFruitTree(enemy.x, enemy.y);
          if (tree) {
            enemy.ecologyTargetTreeId = tree.id;
            enemy.ecologyTargetX = tree.x;
            enemy.ecologyTargetY = tree.y;
          }
        }
        continue;
      }

      if (enemy.ecologyTargetX === null) {
        const beach = this.worldProps.getBeachGrazingTarget(enemy.x, enemy.y);
        if (beach) {
          enemy.ecologyTargetX = beach.x;
          enemy.ecologyTargetY = beach.y;
        }
      }

      if (enemy.ecologyTargetX !== null && enemy.ecologyTargetY !== null) {
        const targetDx = enemy.ecologyTargetX - enemy.x;
        const targetDy = enemy.ecologyTargetY - enemy.y;
        if (targetDx * targetDx + targetDy * targetDy <= grazingArrivalSq) {
          enemy.ecologyGrazingTimer -= dt;
          if (enemy.ecologyGrazingTimer <= 0) {
            enemy.ecologyGrazingTimer = 1.4 + Math.random() * 0.9;
            this.vfx.addSparks(enemy.x, enemy.y, '#84cc16', 3);
          }
        }
      }
    }
  }

  private resolveAmazonEcology(): void {
    if (!this.waveDirector.isAmazonForest) return;

    const nightFrenzy = this.isAmazonNight();

    // Antas eat active fruit trees, then heal and gain a shield.
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (!enemy.isFruitForager || enemy.ecologyTargetTreeId === null) continue;

      const tree = this.worldProps.fruitTrees.find(
        (candidate) => candidate.id === enemy.ecologyTargetTreeId
      );
      if (!tree || !tree.active) {
        enemy.ecologyTargetX = null;
        enemy.ecologyTargetY = null;
        enemy.ecologyTargetTreeId = null;
        continue;
      }

      const dx = tree.x - enemy.x;
      const dy = tree.y - enemy.y;
      if (dx * dx + dy * dy > ECOLOGY_FRUIT_EAT_RADIUS * ECOLOGY_FRUIT_EAT_RADIUS) continue;

      this.worldProps.consumeFruitTreeById(tree.id);
      enemy.feedOnFruit();
      enemy.ecologyActionCooldown = ECOLOGY_FRUIT_FEED_COOLDOWN;
      enemy.ecologyTargetX = null;
      enemy.ecologyTargetY = null;
      enemy.ecologyTargetTreeId = null;
      this.vfx.addSparks(tree.x, tree.y, '#84cc16', 12);
      this.vfx.addSparks(enemy.x, enemy.y, '#38bdf8', 8);
    }

    // Jacaré-açu, Sucuri and Onça-pintada devour nearby prey on their cycles.
    const devoured = new Set<Enemy>();
    for (let i = 0; i < this.enemies.length; i++) {
      const predator = this.enemies[i];
      if (!predator.isEcologyPredator || predator.hp <= 0 || predator.jaguarBusy) continue;
      if (predator.ecologyHuntTimer > 0) continue;

      const isJaguar = predator.isJaguarPredator;
      const preyTypes = isJaguar
        ? JAGUAR_PREY
        : predator.type === 'sucuri'
          ? SUCURI_PREY
          : RIVER_PREDATOR_PREY;
      const range = isJaguar ? ECOLOGY_JAGUAR_RANGE : ECOLOGY_RIVER_PREDATOR_RANGE;
      const rangeSq = range * range;

      let prey: Enemy | null = null;
      let closestDistance = rangeSq;
      for (let j = 0; j < this.enemies.length; j++) {
        const candidate = this.enemies[j];
        if (candidate === predator || candidate.hp <= 0 || devoured.has(candidate)) continue;
        if (candidate.isSubmerged) continue;
        if (!preyTypes.includes(candidate.type)) continue;

        const dx = candidate.x - predator.x;
        const dy = candidate.y - predator.y;
        const distance = dx * dx + dy * dy;
        if (distance <= closestDistance) {
          closestDistance = distance;
          prey = candidate;
        }
      }

      if (prey) {
        devoured.add(prey);
        predator.growFromPrey();
        // At night predators digest faster and grow twice as fast per meal.
        if (nightFrenzy) predator.growFromPrey();
        this.vfx.addDeathBurst(prey.x, prey.y, '#ef4444', 10);
        this.vfx.addSparks(predator.x, predator.y, '#f97316', 8);
        const huntDelay =
          predator.type === 'elite_black_caiman' || predator.type === 'baby_black_caiman'
            ? 12
            : isJaguar
              ? 15
              : 10 + Math.random() * 2;
        predator.ecologyHuntTimer = huntDelay * (nightFrenzy ? 0.5 : 1);
      } else {
        // Nothing in reach: retry soon instead of waiting a full cycle.
        predator.ecologyHuntTimer = nightFrenzy ? 1 : 2;
      }
    }

    if (devoured.size > 0) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        if (devoured.has(this.enemies[i])) {
          this.enemies.splice(i, 1);
        }
      }
    }
  }

  private createAmazonMissionTurns(): AmazonTurnState[] {
    let count = 1;
    if (this.difficulty.id === 'hard') {
      count = 2;
    } else if (this.difficulty.id === 'nightmare' || this.difficulty.id === 'infernal') {
      count = 3;
    }

    return ([1, 2, 3] as const).map((turn) => {
      const options = [...AMAZON_MISSION_BANK[turn]];
      for (let i = options.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return {
        turn,
        endTime: AMAZON_TURN_ENDS[turn - 1],
        missions: options.slice(0, count),
        baseline: {
          fruits: 0,
          waterKills: 0,
          evolvedPredators: 0,
          bosses: 0,
          gold: 0,
        },
        claimedMissions: [],
        bonusApplied: false,
      };
    });
  }

  private beginAmazonTurn(index: number): void {
    this.amazonCurrentTurn = index;
    const turn = this.amazonTurns[index];
    if (!turn) return;
    turn.baseline = {
      fruits: this.amazonObjectives.fruitsCollected,
      waterKills: this.amazonObjectives.waterKills,
      evolvedPredators: this.amazonObjectives.evolvedPredatorsDefeated,
      bosses: this.amazonObjectives.folkloreBossesDefeated,
      gold: this.goldCollected,
    };
  }

  private getAmazonMissionProgress(
    turn: AmazonTurnState,
    mission: AmazonMissionTemplate
  ): number {
    switch (mission.metric) {
      case 'level':
        return this.player.level;
      case 'fruits':
        return this.amazonObjectives.fruitsCollected - turn.baseline.fruits;
      case 'waterKills':
        return this.amazonObjectives.waterKills - turn.baseline.waterKills;
      case 'evolvedPredators':
        return (
          this.amazonObjectives.evolvedPredatorsDefeated - turn.baseline.evolvedPredators
        );
      case 'bosses':
        return this.amazonObjectives.folkloreBossesDefeated - turn.baseline.bosses;
      case 'gold':
        return this.goldCollected - turn.baseline.gold;
      default:
        return 0;
    }
  }

  private updateAmazonMissionTurn(): void {
    if (!this.waveDirector.isAmazonForest) return;
    const turn = this.amazonTurns[this.amazonCurrentTurn];
    if (!turn) return;

    // The next phase only starts when the clock reaches its exact time. Any
    // objective completed but not claimed before then is lost.
    if (this.waveDirector.survivalTime < turn.endTime) return;

    if (this.amazonCurrentTurn < this.amazonTurns.length - 1) {
      this.beginAmazonTurn(this.amazonCurrentTurn + 1);
    }
  }

  public claimAmazonMission(missionId: string): boolean {
    if (!this.waveDirector.isAmazonForest) return false;
    const turn = this.amazonTurns[this.amazonCurrentTurn];
    if (!turn) return false;
    if (this.waveDirector.survivalTime >= turn.endTime) return false;

    const mission = turn.missions.find((item) => item.id === missionId);
    if (!mission || turn.claimedMissions.includes(mission.id)) return false;
    if (this.getAmazonMissionProgress(turn, mission) < mission.target) return false;

    turn.claimedMissions.push(mission.id);
    this.sound.playMissionClaim();
    if (!turn.bonusApplied) {
      turn.bonusApplied = true;
      this.applyAmazonTurnBonus(turn.turn);
    }
    this.syncHUD();
    return true;
  }

  private applyAmazonTurnBonus(turn: 1 | 2 | 3): void {
    this.sound.playLevelUp();
    this.vfx.triggerFlash('#fbbf24', 0.25);
    if (turn === 1) {
      this.amazonObjectives.act1RewardApplied = true;
      this.player.objectiveSpeedBonus = Math.max(this.player.objectiveSpeedBonus, 0.1);
      this.weaponSystem.recalculatePlayerStats(this.player);
    } else if (turn === 2) {
      this.amazonObjectives.act2RewardApplied = true;
      this.player.objectiveMightBonus = Math.max(this.player.objectiveMightBonus, 0.2);
      this.player.objectiveRecoveryBonus = Math.max(this.player.objectiveRecoveryBonus, 1);
      this.weaponSystem.recalculatePlayerStats(this.player);
    } else {
      this.goldCollected += 300;
      this.vfx.addDamageNumber(this.player.x, this.player.y, 300, true, true);
    }
  }

  private trackAmazonObjectiveKill(enemy: Enemy): void {
    if (enemy.type === 'boss_gorilla' || enemy.type === 'boss_anaconda') return;
    if (!this.waveDirector.isAmazonForest) return;
    if (enemy.isAquatic) {
      this.amazonObjectives.waterKills += 1;
    }
    if (enemy.isEcologyPredator && enemy.ecologyFedCount > 0) {
      this.amazonObjectives.evolvedPredatorsDefeated += 1;
    }
    if (this.waveDirector.survivalTime < OBJECTIVE_ACT2_START) return;

    if (enemy.type === 'boss_cobra_grande') {
      this.amazonObjectives.cobraGrandeDefeated = true;
    } else if (enemy.type === 'boss_boitata') {
      this.amazonObjectives.boitataDefeated = true;
    } else if (enemy.isBoss) {
      this.amazonObjectives.folkloreBossesDefeated += 1;
    }
  }

  private updateAmazonObjectives(): boolean {
    if (!this.waveDirector.isAmazonForest) return false;

    this.updateAmazonMissionTurn();

    const objectives = this.amazonObjectives;

    if (
      !objectives.act1Complete &&
      objectives.fruitsCollected >= OBJECTIVE_ACT1_FRUITS &&
      this.player.level >= OBJECTIVE_ACT1_LEVEL
    ) {
      objectives.act1Complete = true;
    }

    if (
      !objectives.act2Complete &&
      objectives.folkloreBossesDefeated >= OBJECTIVE_ACT2_BOSSES &&
      objectives.evolvedPredatorsDefeated >= OBJECTIVE_ACT2_PREDATORS
    ) {
      objectives.act2Complete = true;
    }

    if (
      !objectives.act3Complete &&
      objectives.cobraGrandeDefeated &&
      objectives.boitataDefeated &&
      this.waveDirector.survivalTime >= OBJECTIVE_MAP_END
    ) {
      objectives.act3Complete = true;
      this.handleVictory();
      return true;
    }

    return false;
  }

  private buildObjectivesHUD(): MissionObjectivesHUD {
    const turn = this.amazonTurns[this.amazonCurrentTurn];
    if (!turn) {
      return {
        turn: 1,
        turnLabel: AMAZON_TURN_LABELS[1],
        missions: [],
      };
    }

    return {
      turn: turn.turn,
      turnLabel: AMAZON_TURN_LABELS[turn.turn],
      missions: turn.missions.map((mission) => {
        const progress = Math.min(
          mission.target,
          Math.max(0, this.getAmazonMissionProgress(turn, mission))
        );
        const claimed = turn.claimedMissions.includes(mission.id);
        const complete = progress >= mission.target;
        return {
          id: mission.id,
          title: mission.title,
          progress,
          target: mission.target,
          complete,
          claimed,
          claimable:
            complete &&
            !claimed &&
            this.waveDirector.survivalTime < turn.endTime,
        };
      }),
    };
  }

  /** Emit hit feedback only when an attack actually removes health. */
  private applyPlayerDamage(amount: number, critical = false, shake = false): boolean {
    const previousHp = this.player.hp;
    const fatal = this.player.takeDamage(amount);
    const damageTaken = previousHp - this.player.hp;
    if (damageTaken > 0) {
      this.sound.playPlayerHurt(this.waveDirector.isAmazonForest ? 'amazon_forest' : 'night_plain');
      if (shake) this.camera.shake(0.2, 5);
      this.vfx.addDamageNumber(this.player.x, this.player.y, damageTaken, critical, false);
    }
    return fatal;
  }

  private updateBossEffects(dt: number): boolean {
    for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
      const p = this.bossProjectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      const dx = this.player.x - p.x;
      const dy = this.player.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) <= p.radius + this.player.radius) {
        const fatal = this.applyPlayerDamage(p.damage, false, false);
        // Kopenawa's magic leaves a movement-confusion debuff on impact.
        if (p.kind === 'spirit') {
          this.player.applyConfusion(KOPENAWAS.spiritBolt.confusionDuration);
          this.vfx.addDeathBurst(p.x, p.y, '#a855f7', 10);
          this.vfx.addSparks(p.x, p.y, '#4ade80', 6);
        }
        // Vitória-Régia's spores cling to the player as a mild venom slow.
        if (p.kind === 'spore') this.player.applySlow(0.25, 1.5);
        p.life = 0;
        if (fatal) return true;
      }

      if (p.life <= 0) {
        this.bossProjectiles.splice(i, 1);
      }
    }

    for (let i = this.bossHazards.length - 1; i >= 0; i--) {
      const h = this.bossHazards[i];
      h.life -= dt;

      const dx = this.player.x - h.x;
      const dy = this.player.y - h.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (h.kind === 'wind') {
        if (dist < h.radius) {
          const falloff = 1 - dist / h.radius;
          const pullPhase = h.maxLife - h.life < 0.55;
          const targetX = h.windTargetX;
          const targetY = h.windTargetY;
          let dirX = dist > 0 ? dx / dist : 1;
          let dirY = dist > 0 ? dy / dist : 0;
          let strength = h.windStrength;
          let factor = falloff;
          if (!pullPhase && targetX !== undefined && targetY !== undefined) {
            const tdx = targetX - this.player.x;
            const tdy = targetY - this.player.y;
            const targetDist = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
            dirX = tdx / targetDist;
            dirY = tdy / targetDist;
            strength = 300;
            factor = 1;
          }
          const moveX = dirX * strength * factor * dt;
          const moveY = dirY * strength * factor * dt;
          if (this.player.collisionResolver) {
            const resolved = this.player.collisionResolver(
              this.player.x,
              this.player.y,
              moveX,
              moveY,
              this.player.radius
            );
            this.player.x = resolved.x;
            this.player.y = resolved.y;
          } else {
            this.player.x += moveX;
            this.player.y += moveY;
          }
        }
      } else if (h.kind === 'puddle') {
        // Iara's water puddles do not damage; they simply drag at the player's
        // steps while they remain inside the pool.
        if (dist < h.radius + this.player.radius) {
          this.player.applySlow(0.5, 0.25);
        }
      } else {
        h.tickTimer -= dt;
        if (dist < h.radius + this.player.radius && h.tickTimer <= 0) {
          h.tickTimer = 0.55;
          const fatal = this.applyPlayerDamage(h.damage, false, false);
          if (fatal) return true;
        }
      }

      if (h.life <= 0) {
        this.bossHazards.splice(i, 1);
      }
    }

    return false;
  }

  private onEnemyKilled(enemy: Enemy): void {
    if (this.processedEnemyDeaths.has(enemy)) return;
    this.processedEnemyDeaths.add(enemy);
    // Illusory duplicates dissolve in herbal smoke and grant no loot or kills.
    if (enemy instanceof KopenawaClone) {
      this.vfx.addDeathBurst(enemy.x, enemy.y, '#c4b5fd', 18);
      return;
    }
    if (enemy === this.bossEncounter?.boss) {
      if (this.bossEncounter.kind === 'gorilla') {
        this.gorillaDefeated = true;
        this.gorillaArena = null;
      } else if (this.bossEncounter.kind === 'kopenawa') {
        this.kopenawaDefeated = true;
        this.caveUnlocked = true;
        this.worldProps.unlockForestCave();
        this.gorillaArena = null;
      } else {
        this.anacondaDefeated = true;
        (enemy as AnacondaBoss).clearEffects();
      }
    }

    this.trackAmazonObjectiveKill(enemy);

    this.kills += 1;
    this.vfx.addDeathBurst(
      enemy.x,
      enemy.y,
      enemy.type === 'bat' ? '#a855f7' : '#ef4444',
      enemy.isElite ? 25 : 8
    );

    if (enemy.isBoss) {
      this.bossesDefeated += 1;
      if (enemy.type === 'boss_anaconda') { this.persistRunStats(false); return; }
      // Kopenawa leaves no physical loot outside the cave; his bow waits inside.
      if (enemy instanceof KopenawaBoss) {
        if (!this.waveDirector.isEndless && !this.waveDirector.isAmazonForest) this.handleVictory();
        else this.persistRunStats(false);
        return;
      }
      const bossXp = Math.round(250 * this.difficulty.xpMultiplier);
      this.drops.push(new Drop(Date.now() + Math.random(), 'chest', enemy.x, enemy.y));
      this.drops.push(new Drop(Date.now() + 1 + Math.random(), 'gem_red', enemy.x + 22, enemy.y, bossXp));
      this.drops.push(new Drop(Date.now() + 2 + Math.random(), 'gem_red', enemy.x - 22, enemy.y, bossXp));

      if (!this.waveDirector.isEndless && !this.waveDirector.isAmazonForest) {
        this.handleVictory();
      } else {
        this.persistRunStats(false);
      }
      return;
    }

    if (enemy.isElite) {
      const isAmazonElite =
        enemy.type === 'sucuri' ||
        enemy.type === 'elite_jaguar' ||
        enemy.type === 'elite_tapir' ||
        enemy.type === 'elite_goliath_spider' ||
        enemy.type === 'elite_black_caiman';
      this.drops.push(new Drop(Date.now() + Math.random(), 'chest', enemy.x, enemy.y));
      this.drops.push(new Drop(Date.now() + 1 + Math.random(), 'gem_green', enemy.x + 14, enemy.y, enemy.xpValue));
      if (isAmazonElite) {
        // Rare forest elites are walking treasure piñatas: bonus XP and gold.
        this.drops.push(new Drop(Date.now() + 2 + Math.random(), 'gem_red', enemy.x - 16, enemy.y, enemy.xpValue));
        this.drops.push(new Drop(Date.now() + 3 + Math.random(), 'coin', enemy.x + 30, enemy.y, 90));
        this.drops.push(new Drop(Date.now() + 4 + Math.random(), 'coin', enemy.x - 30, enemy.y, 90));
      }
      return;
    }

    let dropType: Drop['type'] = 'gem_blue';
    if (enemy.xpValue >= 20) {
      dropType = 'gem_green';
    }
    this.drops.push(new Drop(Date.now() + Math.random(), dropType, enemy.x, enemy.y, enemy.xpValue));
  }

  private spawnRandomItem(): void {
    const luckBias = Math.min(0.12, this.player.luck * 0.25);
    const roll = Math.random();
    let type: Drop['type'] = 'coin';
    if (roll < 0.4 + luckBias * 0.5) {
      type = 'chicken';
    } else if (roll < 0.75) {
      type = 'coin';
    } else if (roll < 0.93) {
      type = 'magnet';
    } else {
      type = 'rosary';
    }

    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 280;
    this.drops.push(
      new Drop(
        Date.now() + Math.random(),
        type,
        this.player.x + Math.cos(angle) * dist,
        this.player.y + Math.sin(angle) * dist
      )
    );
  }

  private handleDropCollected(drop: Drop): void {
    if (drop instanceof EquipmentDrop) {
      const data = loadSavedData();
      const id = this.player.character.id;
      const inventory = data.inventories[id] ?? emptyInventory();
      if (!inventory.items.some(item => item.id === drop.item.id)) {
        saveGameData({ ...data, inventories: { ...data.inventories, [id]: {
          ...inventory, items: [...inventory.items, { ...drop.item, stats: { ...drop.item.stats } }],
        } } });
        if (drop.item.id === GUARDIAN_BOW.id) this.caveRewardClaimed = true;
        this.pause(); this.input.handlePointerUp(); this.sound.playMissionClaim();
        this.callbacks.onEquipmentReward(drop.item);
      }
      return;
    }
    if (drop.type === 'gem_blue' || drop.type === 'gem_green' || drop.type === 'gem_red') {
      const leveledUp = this.player.addXp(drop.value);

      if (leveledUp) {
        const options = this.weaponSystem.generateUpgradeOptions();
        if (options.length > 0) {
          this.sound.playLevelUp();
          this.pause();
          this.callbacks.onLevelUp(options);
        }
      }
    } else if (drop.type === 'coin') {
      const gained = Math.round(
        drop.value * this.difficulty.goldMultiplier * this.player.goldMultiplier
      );
      this.goldCollected += gained;
      this.sound.playGemPickup(4);
      this.vfx.addDamageNumber(this.player.x, this.player.y, gained, true, true);
    } else if (drop.type === 'chicken') {
      this.player.heal(drop.value);
      this.sound.playGemPickup(8);
      this.vfx.addDamageNumber(this.player.x, this.player.y, drop.value, false, true);
    } else if (drop.type === 'magnet') {
      this.sound.playLevelUp();
      this.vfx.triggerFlash('#38bdf8', 0.4);
      for (let i = 0; i < this.drops.length; i++) {
        if (this.drops[i].type.startsWith('gem_') || this.drops[i].type === 'coin') {
          this.drops[i].isBeingMagnetPulled = true;
        }
      }
    } else if (drop.type === 'rosary') {
      this.sound.playThunder();
      this.vfx.triggerFlash('#ffffff', 0.85);
      // Purges regular monsters, deals heavy % damage to Elites & chip damage to Bosses
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (e.isSubmerged) continue;
        if (e.isBoss) {
          const bossDmg = Math.max(1, Math.round(e.maxHp * 0.06));
          const dead = e.takeDamage(bossDmg, 0, 0, 0);
          this.vfx.addDamageNumber(e.x, e.y, bossDmg, true);
          if (dead) {
            this.onEnemyKilled(e);
            this.enemies.splice(i, 1);
          }
        } else if (e.isElite) {
          const eliteDmg = Math.max(1, Math.round(e.maxHp * 0.35));
          const dead = e.takeDamage(eliteDmg, 0, 0, 80);
          this.vfx.addDamageNumber(e.x, e.y, eliteDmg, true);
          if (dead) {
            this.onEnemyKilled(e);
            this.enemies.splice(i, 1);
          }
        } else {
          this.onEnemyKilled(e);
          this.enemies.splice(i, 1);
        }
      }
    } else if (drop.type === 'chest') {
      this.sound.playChestOpen();
      this.pause();
      const chosenUpgrade = this.weaponSystem.resolveChestUpgrade();
      const baseGold = chosenUpgrade
        ? 55 + Math.floor(Math.random() * 45)
        : 135 + Math.floor(Math.random() * 45);
      const goldBonus = Math.round(
        baseGold * this.difficulty.goldMultiplier * this.player.goldMultiplier
      );
      this.goldCollected += goldBonus;
      if (!chosenUpgrade) {
        this.player.heal(35);
      }
      this.callbacks.onTreasureChest(goldBonus, chosenUpgrade);
    }
  }

  private handleFruitCollected(fruit: CollectedFruit): void {
    this.sound.playFruitCollect();
    if (this.waveDirector.isAmazonForest) {
      this.amazonObjectives.fruitsCollected += 1;
    }

    if (fruit.kind === 'acai') {
      // Açaí: magnet every XP gem on the map toward the hero.
      this.sound.playLevelUp();
      this.vfx.triggerFlash('#38bdf8', 0.35);
      this.vfx.addSparks(fruit.x, fruit.y, '#c084fc', 12);
      for (let i = 0; i < this.drops.length; i++) {
        const drop = this.drops[i];
        if (
          drop.type === 'gem_blue' ||
          drop.type === 'gem_green' ||
          drop.type === 'gem_red'
        ) {
          drop.isBeingMagnetPulled = true;
        }
      }
    } else if (fruit.kind === 'cupuacu') {
      // Cupuaçu: restore 35% of the player's maximum HP.
      const healed = Math.max(1, Math.round(this.player.maxHp * 0.35));
      this.player.heal(healed);
      this.sound.playGemPickup(8);
      this.vfx.addSparks(fruit.x, fruit.y, '#84cc16', 12);
      this.vfx.addDamageNumber(this.player.x, this.player.y, healed, false, true);
    } else if (fruit.kind === 'castanha') {
      // Castanha-do-Pará: drop an extra gold package.
      this.sound.playGemPickup(4);
      this.vfx.addSparks(fruit.x, fruit.y, '#fbbf24', 12);
      const coins = 3;
      for (let i = 0; i < coins; i++) {
        const angle = (i / coins) * Math.PI * 2;
        this.drops.push(
          new Drop(
            Date.now() + i + Math.random(),
            'coin',
            fruit.x + Math.cos(angle) * 18,
            fruit.y + Math.sin(angle) * 18,
            50
          )
        );
      }
    } else if (fruit.kind === 'buriti') {
      // Buriti: faster movement and attack speed for 10 seconds.
      this.sound.playLevelUp();
      this.vfx.triggerFlash('#fbbf24', 0.25);
      this.vfx.addSparks(fruit.x, fruit.y, '#fb923c', 14);
      this.player.speedBoostTimer = Math.max(this.player.speedBoostTimer, 10);
      this.player.attackSpeedBoostTimer = 10;
    } else if (fruit.kind === 'pupunha') {
      // Pupunha: protective shield that halves incoming damage for 10 seconds.
      this.sound.playGemPickup(8);
      this.vfx.triggerFlash('#38bdf8', 0.2);
      this.vfx.addSparks(fruit.x, fruit.y, '#38bdf8', 14);
      this.player.shieldTimer = Math.max(this.player.shieldTimer, 10);
    } else {
      // Araçá: a shockwave that damages every nearby enemy.
      const radius = 240;
      const damage = Math.max(1, Math.round(70 * this.player.might));
      this.sound.playThunder();
      this.camera.shake(0.18, 5);
      this.vfx.triggerFlash('#f97316', 0.2);
      this.vfx.addSparks(fruit.x, fruit.y, '#f97316', 20);
      this.weaponSystem.spawnRingPulse(fruit.x, fruit.y, radius, '#f97316', 0.4);

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (enemy.isSubmerged) continue;
        const dx = enemy.x - fruit.x;
        const dy = enemy.y - fruit.y;
        if (dx * dx + dy * dy > radius * radius) continue;

        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const dead = enemy.takeDamage(damage, dx / dist, dy / dist, 240);
        this.vfx.addDamageNumber(enemy.x, enemy.y, damage, false);
        if (dead) {
          this.onEnemyKilled(enemy);
          this.enemies.splice(i, 1);
        }
      }
    }
  }

  public applyUpgrade(option: UpgradeOption): void {
    if (option.type === 'fusion') {
      this.weaponSystem.applyFusion(option, this.player);
    } else if (option.type === 'evolution') {
      if (option.baseId) {
        this.weaponSystem.evolveWeapon(option.baseId);
      }
    } else if (option.type === 'weapon') {
      const wId = option.id as WeaponId;
      if (this.weaponSystem.weapons.has(wId)) {
        this.weaponSystem.upgradeWeapon(wId);
      } else {
        this.weaponSystem.addWeapon(wId);
      }
    } else if (option.type === 'passive') {
      const pId = option.id as PassiveId;
      this.weaponSystem.addPassive(pId, this.player);
    }

    // Handle multi-level overflow XP (e.g. Boss gem)
    if (this.player.checkLevelUp()) {
      const nextOptions = this.weaponSystem.generateUpgradeOptions();
      if (nextOptions.length > 0) {
        this.sound.playLevelUp();
        this.pause();
        this.callbacks.onLevelUp(nextOptions);
        return;
      }
    }

    this.resume();
  }

  private handlePlayerDeath(): void {
    if (this.bossEncounter?.kind === 'anaconda') this.restoreBossEncounter();
    this.isGameOver = true;
    this.sound.playGameOver();
    this.sound.stopCaveAmbience();
    this.sound.stopBgm();
    this.sound.stopAmazonAmbient();
    this.persistRunStats(false);

    const summary = this.buildSummary(false);
    this.callbacks.onGameOver(summary);
  }

  private handleVictory(): void {
    this.hasWon = true;
    this.pause();
    this.sound.playVictory();
    this.sound.stopAmazonAmbient();
    this.persistRunStats(true);

    const summary = this.buildSummary(true);
    this.callbacks.onVictory(summary);
  }

  public continueEndless(): void {
    this.waveDirector.isEndless = true;
    if (this.waveDirector.isAmazonForest) {
      this.sound.startAmazonAmbient();
    }
    this.resume();
  }

  private buildSummary(won: boolean): GameEndSummary {
    let totalDmg = 0;
    this.weaponSystem.weapons.forEach((w) => {
      totalDmg += w.totalDamageDealt;
    });

    const timeSurvived = Math.max(1, Math.floor(this.waveDirector.survivalTime));

    const weaponStats = Array.from(this.weaponSystem.weapons.values()).map((w) => {
      const meta = WEAPON_REGISTRY[w.id];
      const dmg = Math.round(w.totalDamageDealt);
      return {
        id: w.id,
        name: w.evolved ? meta.evolvedName : meta.name,
        evolved: w.evolved,
        damage: dmg,
        dps: Math.round((dmg / timeSurvived) * 10) / 10,
        percentage: totalDmg > 0 ? Math.round((dmg / totalDmg) * 100) : 0,
      };
    });

    weaponStats.sort((a, b) => b.damage - a.damage);

    return {
      won,
      survivalTime: timeSurvived,
      kills: this.kills,
      bossesDefeated: this.bossesDefeated,
      level: this.player.level,
      goldEarned: this.goldCollected,
      totalDamage: Math.round(totalDmg),
      characterName: this.player.character.name,
      difficulty: this.difficulty.id,
      difficultyName: this.difficulty.name,
      weaponStats,
    };
  }

  private persistRunStats(won: boolean): void {
    const data = loadSavedData();
    data.gold += this.goldCollected;
    data.highScore.timeSurvived = Math.max(
      data.highScore.timeSurvived,
      Math.floor(this.waveDirector.survivalTime)
    );
    data.highScore.kills = Math.max(data.highScore.kills, this.kills);
    data.highScore.highestLevel = Math.max(data.highScore.highestLevel, this.player.level);
    if (won) data.highScore.wins += 1;

    const current = {
      kills: this.kills,
      survivalSeconds: Math.floor(this.waveDirector.survivalTime),
      goldCollected: this.goldCollected,
      bossesDefeated: this.bossesDefeated,
    };
    const missionData = applyRunToMissions(data, {
      kills: Math.max(0, current.kills - this.missionSnapshot.kills),
      survivalSeconds: Math.max(0, current.survivalSeconds - this.missionSnapshot.survivalSeconds),
      goldCollected: Math.max(0, current.goldCollected - this.missionSnapshot.goldCollected),
      bossesDefeated: Math.max(
        0,
        current.bossesDefeated - this.missionSnapshot.bossesDefeated
      ),
      wins: won ? 1 : 0,
    });
    this.missionSnapshot = current;
    saveGameData(missionData);
  }

  private syncHUD(): void {
    const weaponsList = Array.from(this.weaponSystem.weapons.values()).map((w) => ({
      id: w.id,
      level: w.level,
      evolved: w.evolved,
      name: w.evolved ? WEAPON_REGISTRY[w.id].evolvedName : WEAPON_REGISTRY[w.id].name,
      totalDamage: Math.round(w.totalDamageDealt),
    }));

    const passivesList = Array.from(this.weaponSystem.passives.values()).map((p) => ({
      id: p.id,
      level: p.level,
      name: PASSIVE_REGISTRY[p.id].name,
    }));

    const activeBoss = this.waveDirector.bossActive
      ? {
          name: this.waveDirector.bossActive.name,
          hp: this.waveDirector.bossActive.hp,
          maxHp: this.waveDirector.bossActive.maxHp,
        }
      : undefined;

    this.callbacks.onHUDUpdate({
      mapId: this.waveDirector.isAmazonForest ? 'amazon_forest' : 'night_plain',
      playerHp: Math.round(this.player.hp),
      playerMaxHp: Math.round(this.player.maxHp),
      stamina: Math.round(this.player.stamina),
      maxStamina: Math.round(this.player.movementConfig.maxStamina),
      level: this.player.level,
      xp: Math.round(this.player.xp),
      xpToNextLevel: this.player.xpToNextLevel,
      survivalTime: Math.floor(this.waveDirector.survivalTime),
      kills: this.kills,
      gold: this.goldCollected,
      weapons: weaponsList,
      passives: passivesList,
      activeBoss,
      eventAlert: this.waveDirector.eventAlert || undefined,
      objectives: this.waveDirector.isAmazonForest ? this.buildObjectivesHUD() : undefined,
    });
  }

  private render(): void {
    const { ctx, camera } = this;

    if (this.insideCave) {
      this.caveInterior.render(ctx, camera, this.player, this.caveUnlocked, this.caveRewardClaimed);
      this.player.render(ctx, camera);
      return;
    }
    // 1. Clear & Render Floor Tile Pattern
    this.worldProps.renderFloor(ctx, camera);
    this.renderGorillaArenaFloor();

    // 1.2. Aquatic ambushers stay invisible until the hero enters the river,
    // but a faint dark silhouette hints at them below the surface.
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].renderSubmergedSilhouette(ctx, camera);
    }

    this.worldProps.renderTrees(ctx, camera);
    this.worldProps.renderDecorTrees(ctx, camera, this.player, this.enemies);
    this.worldProps.renderFruitTrees(ctx, camera, this.player);
    this.worldProps.renderThornBushes(ctx, camera);
    this.worldProps.renderHerbs(ctx, camera, this.player);

    // 2. Render Torches & Props
    this.worldProps.renderTorches(ctx, camera);

    // 2.5. Water rings and white splashes under anyone wading in the river.
    this.renderWaterRipples();

    // 3. Render Drops (Gems, Pickups, Chests)
    for (let i = 0; i < this.drops.length; i++) {
      this.drops[i].render(ctx, camera);
    }

    // 4. Render Ground Hazards & Auras beneath Enemies/Player
    this.weaponSystem.renderGround(ctx, camera, this.player);
    if (this.bossEncounter?.boss instanceof AnacondaBoss) {
      this.bossEncounter.boss.acid.renderGround(ctx, camera);
      this.bossEncounter.boss.dive.render(ctx, camera);
    }
    this.renderBossHazards();

    // 5. Render Enemies & Player
    this.worldProps.renderForestCave(ctx, camera, this.player.y, false);
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].render(ctx, camera);
    }

    // Match the player's depth at the NPC's feet without adding it to combat.
    if (this.anacondaAvailable && this.anacondaNpc && this.player.y >= this.anacondaNpc.y) this.anacondaNpc.render(ctx, camera);
    if (this.gorillaAvailable && this.gorillaNpc && this.player.y >= this.gorillaNpc.y) {
      this.gorillaNpc.render(ctx, camera);
    }
    if (this.kopenawaAvailable && this.kopenawaNpc && this.player.y >= this.kopenawaNpc.y) this.kopenawaNpc.render(ctx, camera);
    this.player.render(ctx, camera);
    if (this.anacondaAvailable && this.anacondaNpc && this.player.y < this.anacondaNpc.y) this.anacondaNpc.render(ctx, camera);
    if (this.kopenawaAvailable && this.kopenawaNpc && this.player.y < this.kopenawaNpc.y) this.kopenawaNpc.render(ctx, camera);
    this.worldProps.renderForestCave(ctx, camera, this.player.y, true);
    if (!this.bossEncounter && Math.hypot(this.player.x + 1950, this.player.y - 1935) < 75) {
      const p = camera.worldToScreen(-1950, 1840);
      ctx.save(); ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a'; ctx.strokeStyle = '#101811'; ctx.lineWidth = 4;
      const label = this.caveUnlocked ? '[E] Entrar na caverna' : 'Entrada selada. Derrote Kopenawa.';
      if (this.caveUnlocked) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12; }
      ctx.strokeText(label, p.x, p.y); ctx.fillText(label, p.x, p.y); ctx.restore();
    }
    if (this.player.stunTimer > 0) {
      const playerScreen = camera.worldToScreen(this.player.x, this.player.y);
      ctx.save();
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1c1917';
      ctx.fillStyle = '#fde047';
      ctx.strokeText('ATORDOADO', playerScreen.x, playerScreen.y - 64);
      ctx.fillText('ATORDOADO', playerScreen.x, playerScreen.y - 64);
      ctx.restore();
    }
    if (this.player.transeTimer > 0) {
      const playerScreen = camera.worldToScreen(this.player.x, this.player.y);
      ctx.save();
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1c1917';
      ctx.fillStyle = '#c4b5fd';
      ctx.strokeText('TRANSE', playerScreen.x, playerScreen.y - 80);
      ctx.fillText('TRANSE', playerScreen.x, playerScreen.y - 80);
      ctx.restore();
    }
    if (this.player.confusionTimer > 0 && this.player.confusionDirection) {
      const playerScreen = camera.worldToScreen(this.player.x, this.player.y);
      const iconY = playerScreen.y - 98;
      const spin = this.waveDirector.survivalTime * 3.2;
      const direction = this.player.confusionDirection;
      const arrowAngle = direction === 'up'
        ? 0
        : direction === 'down'
          ? Math.PI
          : direction === 'left'
            ? -Math.PI / 2
            : Math.PI / 2;
      ctx.save();
      ctx.translate(playerScreen.x, iconY);
      // Soft spiritual aura behind the confusion icon.
      ctx.fillStyle = 'rgba(168, 85, 247, 0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();
      // Orbiting purple/green stars.
      for (let star = 0; star < 3; star++) {
        const angle = spin + (star * Math.PI * 2) / 3;
        ctx.fillStyle = star % 2 === 0 ? '#c4b5fd' : '#4ade80';
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 13, Math.sin(angle) * 7, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // Arrow shows which walk command is currently scrambled.
      ctx.save();
      ctx.rotate(arrowAngle);
      ctx.fillStyle = '#f0fdf4';
      ctx.strokeStyle = '#3b0764';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(5, -1);
      ctx.lineTo(1.8, -1);
      ctx.lineTo(1.8, 7);
      ctx.lineTo(-1.8, 7);
      ctx.lineTo(-1.8, -1);
      ctx.lineTo(-5, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
    if (this.gorillaAvailable && this.gorillaNpc && this.player.y < this.gorillaNpc.y) {
      this.gorillaNpc.render(ctx, camera);
    }
    this.renderGorillaArena();

    // Decorative canopies become translucent over anyone walking behind them.
    this.worldProps.renderDecorCanopyOverlay(ctx, camera, this.player, this.enemies);

    this.renderBossProjectiles();

    // 6. Render Aerial Projectiles, Slashes, Orbitals & Lightning
    this.weaponSystem.render(ctx, camera, this.player);

    // 7. Render VFX (Damage numbers, death particles, screen flash)
    this.vfx.render(ctx, camera);

    // 7.2. Amazon Forest day/sunset/night atmosphere
    this.worldProps.renderAmazonAtmosphere(
      ctx,
      camera,
      this.player,
      this.waveDirector.survivalTime
    );

    // 7.3. Fire bosses shine through the jungle night.
    this.renderNightFireBossGlow();
    if (this.bossEncounter?.boss instanceof AnacondaBoss) this.bossEncounter.boss.acid.renderAir(ctx, camera, this.player);
    if (!this.isPaused && !this.isGameOver && this.gorillaAvailable && this.gorillaNpc?.canInteract(this.player)) {
      this.gorillaNpc.renderPrompt(ctx, camera);
    }

    // 7.5. Render Debug Overlay (Hitboxes, Ranges, Spatial Grid)
    this.renderDebugOverlay();

    // 8. Render Virtual Joystick if active
    if (this.input.joystick.active) {
      const { startX, startY, currentX, currentY, radius } = this.input.joystick;
      ctx.save();
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(currentX, currentY, radius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
      ctx.restore();
    }

    // 9. Render Minimap Radar (fixed bottom-left)
    this.renderMinimap();
  }

  private gorillaStoneNoise(seed: number): number {
    const value = Math.sin(seed * 12.9898 + 4.1414) * 43758.5453;
    return value - Math.floor(value);
  }

  private drawGorillaCrack(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    angle: number,
    length: number,
    seed: number,
    depth: number
  ): void {
    const segments = 3 + Math.floor(this.gorillaStoneNoise(seed) * 3);
    let x = startX;
    let y = startY;
    let heading = angle;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < segments; i++) {
      heading += (this.gorillaStoneNoise(seed + i * 7.13) - 0.5) * 0.9;
      const step = length / segments;
      x += Math.cos(heading) * step;
      y += Math.sin(heading) * step;
      // Snap to a 2 px grid so the fissures read as pixel art.
      ctx.lineTo(Math.round(x / 2) * 2, Math.round(y / 2) * 2);
    }
    ctx.stroke();
    if (depth <= 0) return;
    const branchAt = 0.32 + this.gorillaStoneNoise(seed + 2.7) * 0.35;
    const branchX = startX + Math.cos(angle) * length * branchAt;
    const branchY = startY + Math.sin(angle) * length * branchAt;
    const side = this.gorillaStoneNoise(seed + 5.9) < 0.5 ? -1 : 1;
    const branchAngle = angle + side * (0.5 + this.gorillaStoneNoise(seed + 8.3) * 0.6);
    this.drawGorillaCrack(ctx, branchX, branchY, branchAngle, length * 0.52, seed + 17.31, depth - 1);
  }

  private drawGorillaBoulder(
    ctx: CanvasRenderingContext2D,
    seed: number,
    halfWidth: number,
    halfHeight: number
  ): void {
    const segments = 9;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const rx = halfWidth * (0.82 + this.gorillaStoneNoise(seed + i * 4.37) * 0.3);
      const ry = halfHeight * (0.8 + this.gorillaStoneNoise(seed + 40 + i * 3.11) * 0.32);
      points.push({
        x: Math.round((Math.cos(angle) * rx) / 2) * 2,
        y: Math.round((Math.sin(angle) * ry) / 2) * 2,
      });
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    const tone = this.gorillaStoneNoise(seed * 1.37);
    ctx.fillStyle = tone < 0.34 ? '#57534e' : tone < 0.67 ? '#6b6660' : '#78716c';
    ctx.fill();
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'miter';
    ctx.stroke();

    // Angular highlight facet on the upper-left, like raw chipped stone.
    const facet = [
      [-halfWidth * 0.78, -halfHeight * 0.32],
      [-halfWidth * 0.38, -halfHeight * 0.78],
      [halfWidth * 0.12, -halfHeight * 0.64],
      [-halfWidth * 0.06, -halfHeight * 0.12],
      [-halfWidth * 0.58, -halfHeight * 0.02],
    ];
    ctx.beginPath();
    ctx.moveTo(Math.round(facet[0][0] / 2) * 2, Math.round(facet[0][1] / 2) * 2);
    for (let i = 1; i < facet.length; i++) {
      ctx.lineTo(Math.round(facet[i][0] / 2) * 2, Math.round(facet[i][1] / 2) * 2);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(214, 211, 209, 0.2)';
    ctx.fill();

    // Internal hairline cracks.
    ctx.strokeStyle = 'rgba(24, 20, 17, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(-halfWidth * 0.56, -halfHeight * 0.22);
    ctx.lineTo(-halfWidth * 0.18, -halfHeight * 0.02);
    ctx.lineTo(-halfWidth * 0.28, halfHeight * 0.36);
    ctx.lineTo(halfWidth * 0.02, halfHeight * 0.52);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-halfWidth * 0.18, -halfHeight * 0.02);
    ctx.lineTo(halfWidth * 0.22, -halfHeight * 0.2);
    ctx.lineTo(halfWidth * 0.46, -halfHeight * 0.04);
    ctx.stroke();

    // Pixel chipping / rough speckles.
    ctx.fillStyle = 'rgba(28, 25, 23, 0.45)';
    for (let i = 0; i < 3; i++) {
      const px = (this.gorillaStoneNoise(seed + i * 9.1) - 0.5) * halfWidth * 1.2;
      const py = (this.gorillaStoneNoise(seed + i * 4.7) - 0.5) * halfHeight * 1.2;
      const size = 2 + Math.round(this.gorillaStoneNoise(seed + i * 2.3) * 3);
      ctx.fillRect(Math.round(px / 2) * 2, Math.round(py / 2) * 2, size, 2);
    }
  }

  private renderGorillaArenaFloor(): void {
    const arena = this.gorillaArena;
    if (!arena) return;
    if (this.arenaKind === 'roots') { this.renderRootArenaFloor(); return; }
    const { ctx, camera } = this;
    const origin = camera.worldToScreen(arena.x, arena.y);
    const maxRadius = arena.radius * 1.5;
    if (origin.x + maxRadius < -80 || origin.x - maxRadius > camera.viewportWidth + 80 ||
      origin.y + maxRadius < -80 || origin.y - maxRadius > camera.viewportHeight + 80) return;

    const rimRadius = (angle: number) =>
      this.worldProps.getPlateauRimRadius(arena.x, arena.y, Math.cos(angle), Math.sin(angle)) ?? arena.radius;

    ctx.save();
    // Dusty floor scar follows the plateau rim, with the dark picket ring
    // where the boulders tore out of the hilltop.
    const traceRim = (extra: number) => {
      ctx.beginPath();
      for (let step = 0; step <= 96; step++) {
        const angle = (step / 96) * Math.PI * 2;
        const radius = rimRadius(angle) + extra;
        const x = origin.x + Math.cos(angle) * radius;
        const y = origin.y + Math.sin(angle) * radius;
        if (step === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };

    traceRim(0);
    ctx.strokeStyle = 'rgba(41, 37, 36, 0.42)';
    ctx.lineWidth = 18;
    ctx.stroke();
    traceRim(-14);
    ctx.strokeStyle = 'rgba(168, 162, 158, 0.22)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Impact fissures radiating from the ape's feet.
    ctx.strokeStyle = 'rgba(12, 10, 8, 0.86)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + 0.31;
      const length = 74 + this.gorillaStoneNoise(i * 7.7 + 1) * 90;
      this.drawGorillaCrack(ctx, origin.x, origin.y, angle, length, i * 13.7 + 2, 2);
    }

    // Smaller fissures along the base where each boulder broke through.
    ctx.strokeStyle = 'rgba(14, 11, 9, 0.75)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + 0.17;
      const radius = rimRadius(angle);
      const startX = origin.x + Math.cos(angle) * (radius - 4);
      const startY = origin.y + Math.sin(angle) * (radius - 4);
      const inward = angle + Math.PI + (this.gorillaStoneNoise(i * 3.9 + 5) - 0.5) * 0.7;
      const length = 20 + this.gorillaStoneNoise(i * 5.3 + 9) * 32;
      this.drawGorillaCrack(ctx, startX, startY, inward, length, i * 4.1 + 17, 1);
    }
    ctx.restore();
  }

  private renderRootArenaFloor(): void {
    const arena = this.gorillaArena;
    if (!arena) return;
    const { ctx, camera } = this;
    const origin = camera.worldToScreen(arena.x, arena.y);
    const maxRadius = arena.radius * 1.5;
    if (origin.x + maxRadius < -80 || origin.x - maxRadius > camera.viewportWidth + 80 ||
      origin.y + maxRadius < -80 || origin.y - maxRadius > camera.viewportHeight + 80) return;

    const rimRadius = (angle: number) =>
      this.worldProps.getPlateauRimRadius(arena.x, arena.y, Math.cos(angle), Math.sin(angle)) ?? arena.radius;

    ctx.save();
    // Mossy ground and creeping roots replace the gorilla's cracked stone.
    ctx.beginPath();
    for (let step = 0; step <= 96; step++) {
      const angle = (step / 96) * Math.PI * 2;
      const radius = rimRadius(angle);
      const x = origin.x + Math.cos(angle) * radius;
      const y = origin.y + Math.sin(angle) * radius;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.fillStyle = 'rgba(22, 40, 24, 0.22)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(63, 42, 24, 0.45)';
    ctx.lineWidth = 14;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2 + this.gorillaStoneNoise(i * 3.1) * 0.2;
      const length = 40 + this.gorillaStoneNoise(i * 7.3 + 2) * 110;
      const startX = origin.x + Math.cos(angle) * (rimRadius(angle) - 6);
      const startY = origin.y + Math.sin(angle) * (rimRadius(angle) - 6);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        startX + Math.cos(angle + 0.4) * length * 0.55,
        startY + Math.sin(angle + 0.4) * length * 0.55,
        startX + Math.cos(angle) * length,
        startY + Math.sin(angle) * length
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderRootArena(): void {
    const arena = this.gorillaArena;
    if (!arena) return;
    const { ctx, camera } = this;
    const origin = camera.worldToScreen(arena.x, arena.y);
    const maxRadius = arena.radius * 1.5;
    if (origin.x + maxRadius < -80 || origin.x - maxRadius > camera.viewportWidth + 80 ||
      origin.y + maxRadius < -80 || origin.y - maxRadius > camera.viewportHeight + 80) return;

    const rimRadius = (angle: number) =>
      this.worldProps.getPlateauRimRadius(arena.x, arena.y, Math.cos(angle), Math.sin(angle)) ?? arena.radius;

    ctx.save();
    // A dense palisade of interlaced roots crowned with sharp thorns.
    for (let i = 0; i < GORILLA_ARENA.stoneCount; i++) {
      const angle = (i / GORILLA_ARENA.stoneCount) * Math.PI * 2;
      const radius = rimRadius(angle);
      const rootX = origin.x + Math.cos(angle) * radius;
      const rootY = origin.y + Math.sin(angle) * radius;
      const seed = i + 1;
      const height = 30 + this.gorillaStoneNoise(seed * 6.7) * 20;
      const halfWidth = 20 + this.gorillaStoneNoise(seed * 4.3) * 11;
      ctx.save();
      ctx.translate(rootX, rootY);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(2, 8, halfWidth * 1.15, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = i % 2 === 0 ? '#4d3320' : '#3b2a1a';
      ctx.lineWidth = 9 + this.gorillaStoneNoise(seed * 2.9) * 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-halfWidth, 2);
      ctx.bezierCurveTo(-halfWidth * 0.4, -height * 0.5, halfWidth * 0.5, -height, halfWidth * 0.25, -height);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.34)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-halfWidth * 0.5, -height * 0.15);
      ctx.quadraticCurveTo(0, -height * 0.55, halfWidth * 0.5, -height * 0.8);
      ctx.stroke();
      // Sharp thorn tips.
      ctx.fillStyle = '#e7e5e4';
      for (let thorn = 0; thorn < 3; thorn++) {
        const tx = (thorn - 1) * halfWidth * 0.55;
        const ty = -height * (0.3 + thorn * 0.18);
        ctx.beginPath();
        ctx.moveTo(tx - 3, ty);
        ctx.lineTo(tx, ty - 11);
        ctx.lineTo(tx + 3, ty);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private renderGorillaArena(): void {
    const arena = this.gorillaArena;
    if (!arena) return;
    if (this.arenaKind === 'roots') { this.renderRootArena(); return; }
    const { ctx, camera } = this;
    const origin = camera.worldToScreen(arena.x, arena.y);
    const maxRadius = arena.radius * 1.5;
    if (origin.x + maxRadius < -80 || origin.x - maxRadius > camera.viewportWidth + 80 ||
      origin.y + maxRadius < -80 || origin.y - maxRadius > camera.viewportHeight + 80) return;

    const rimRadius = (angle: number) =>
      this.worldProps.getPlateauRimRadius(arena.x, arena.y, Math.cos(angle), Math.sin(angle)) ?? arena.radius;

    ctx.save();
    // Solid boulders form a visually closed barrier along the plateau rim.
    // Collision is still the continuous circle handled by clampToGorillaArena.
    for (let i = 0; i < GORILLA_ARENA.stoneCount; i++) {
      const angle = (i / GORILLA_ARENA.stoneCount) * Math.PI * 2;
      const radius = rimRadius(angle);
      const stoneX = origin.x + Math.cos(angle) * radius;
      const stoneY = origin.y + Math.sin(angle) * radius;
      const seed = i + 1;
      const halfWidth = 24 + this.gorillaStoneNoise(seed * 5.1) * 12;
      const halfHeight = 32 + this.gorillaStoneNoise(seed * 7.3) * 15;
      ctx.save();
      ctx.translate(stoneX, stoneY);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
      ctx.beginPath();
      ctx.ellipse(2, 8, halfWidth * 1.02, halfHeight * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      this.drawGorillaBoulder(ctx, seed, halfWidth, halfHeight);
      if (i % 2 === 0) {
        // A smaller chipped boulder caps every other block, giving the wall a
        // stacked, hand-piled silhouette.
        ctx.save();
        ctx.translate(
          halfWidth * 0.58 * (i % 4 === 0 ? 1 : -1),
          -halfHeight * 0.12
        );
        this.drawGorillaBoulder(ctx, seed + 101, halfWidth * 0.55, halfHeight * 0.5);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private renderWaterRipples(): void {
    const { ctx, camera } = this;

    for (let i = 0; i < this.waterRipples.length; i++) {
      const ripple = this.waterRipples[i];
      if (!camera.isInView(ripple.x, ripple.y, ripple.maxRadius + 20)) continue;

      const screen = camera.worldToScreen(ripple.x, ripple.y);
      const progress = 1 - ripple.life / ripple.maxLife;
      const alpha = Math.max(0, ripple.life / ripple.maxLife);
      const radius = ripple.maxRadius * progress;

      ctx.save();
      ctx.strokeStyle = '#e0f2fe';
      ctx.globalAlpha = alpha * (ripple.splash ? 0.8 : 0.5);
      ctx.lineWidth = ripple.splash ? 2 : 1.2;
      ctx.beginPath();
      ctx.ellipse(screen.x, screen.y, radius, radius * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();

      if (ripple.splash) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(
          screen.x,
          screen.y,
          radius * 0.55,
          radius * 0.25,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();

        // White droplets kicked up around the feet.
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = '#f8fafc';
        for (let drop = 0; drop < 4; drop++) {
          const angle = ripple.angle + (drop * Math.PI) / 2;
          const dropX = screen.x + Math.cos(angle) * radius * 1.05;
          const dropY =
            screen.y + Math.sin(angle) * radius * 0.45 - progress * 7;
          ctx.beginPath();
          ctx.arc(dropX, dropY, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  private renderMinimap(): void {
    const { ctx, camera } = this;
    const viewport = Math.min(camera.viewportWidth, camera.viewportHeight);
    const size = viewport < 640 ? 224 : 304;
    const margin = 12;
    const x = margin;
    // Leave room for the bottom HUD hint without leaving the corner.
    const y = camera.viewportHeight - size - margin - 18;
    const half = size / 2;

    const viewSpan = this.worldProps.getMinimapViewSpan();
    const viewRadius = viewSpan / 2;
    const scale = size / viewSpan;

    const tracePanel = () => {
      const radius = 10;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + size - radius, y);
      ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
      ctx.lineTo(x + size, y + size - radius);
      ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
      ctx.lineTo(x + radius, y + size);
      ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    ctx.save();
    tracePanel();
    ctx.fillStyle = 'rgba(8, 15, 20, 0.68)';
    ctx.fill();

    ctx.save();
    ctx.clip();
    this.worldProps.renderMinimapScenery(
      ctx,
      this.player.x,
      this.player.y,
      viewRadius,
      x,
      y,
      size
    );

    const centerX = x + half;
    const centerY = y + half;

    // Active São-Caetano herbs glow light green so the wounded hero can spot
    // the nearest antidote on the radar.
    for (let i = 0; i < this.worldProps.herbs.length; i++) {
      const herb = this.worldProps.herbs[i];
      if (!herb.active) continue;
      const dx = herb.x - this.player.x;
      const dy = herb.y - this.player.y;
      if (dx * dx + dy * dy > viewRadius * viewRadius) continue;

      const blipX = centerX + dx * scale;
      const blipY = centerY + dy * scale;
      ctx.save();
      ctx.shadowColor = '#d9f99d';
      ctx.shadowBlur = 7;
      ctx.fillStyle = '#bef264';
      ctx.beginPath();
      ctx.arc(blipX, blipY, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f7fee7';
      ctx.beginPath();
      ctx.arc(blipX, blipY, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Nearby enemies as small red blips.
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (enemy.isSubmerged) continue;
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      if (dx * dx + dy * dy > viewRadius * viewRadius) continue;

      const blipRadius = enemy.isBoss ? 2.4 : enemy.isElite ? 2 : 1.4;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(centerX + dx * scale, centerY + dy * scale, blipRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Hero is always at the center of the radar.
    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 11);
    glow.addColorStop(0, 'rgba(52, 211, 153, 0.9)');
    glow.addColorStop(0.5, 'rgba(34, 211, 238, 0.35)');
    glow.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ecfeff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    tracePanel();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private renderBossHazards(): void {
    const { ctx, camera } = this;
    for (let i = 0; i < this.bossHazards.length; i++) {
      const h = this.bossHazards[i];
      if (!camera.isInView(h.x, h.y, h.radius + 30)) continue;
      const screen = camera.worldToScreen(h.x, h.y);
      const alpha = Math.min(1, h.life / 0.8);

      ctx.save();
      if (h.kind === 'ember') {
        const glow = ctx.createRadialGradient(screen.x, screen.y, 2, screen.x, screen.y, h.radius);
        glow.addColorStop(0, `rgba(254, 240, 138, ${0.8 * alpha})`);
        glow.addColorStop(0.45, `rgba(249, 115, 22, ${0.55 * alpha})`);
        glow.addColorStop(1, 'rgba(185, 28, 28, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, h.radius, 0, Math.PI * 2);
        ctx.fill();

        const pulse = 1 + Math.sin(h.life * 9) * 0.12;
        ctx.fillStyle = `rgba(251, 146, 60, ${0.55 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, h.radius * 0.4 * pulse, h.radius * 0.22 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.kind === 'puddle') {
        const shimmer = Math.sin(h.life * 6) * 0.06;
        const pool = ctx.createRadialGradient(
          screen.x,
          screen.y,
          2,
          screen.x,
          screen.y,
          h.radius
        );
        pool.addColorStop(0, `rgba(34, 211, 238, ${0.42 * alpha})`);
        pool.addColorStop(0.6, `rgba(14, 165, 233, ${0.28 * alpha})`);
        pool.addColorStop(1, 'rgba(8, 47, 73, 0)');
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.ellipse(
          screen.x,
          screen.y,
          h.radius * (1 + shimmer),
          h.radius * 0.55 * (1 - shimmer),
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.strokeStyle = `rgba(165, 243, 252, ${0.6 * alpha})`;
        ctx.lineWidth = 2;
        for (let ring = 0; ring < 2; ring++) {
          const rr = h.radius * (0.35 + ring * 0.3) * (1 + shimmer);
          ctx.beginPath();
          ctx.ellipse(screen.x, screen.y, rr, rr * 0.55, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (h.kind === 'thorns') {
        ctx.fillStyle = `rgba(63, 98, 18, ${0.55 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(screen.x, screen.y, h.radius, h.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(132, 204, 22, ${0.8 * alpha})`;
        ctx.lineWidth = 2;
        for (let spike = 0; spike < 7; spike++) {
          const a = (spike / 7) * Math.PI * 2 + h.life * 0.4;
          const sx = screen.x + Math.cos(a) * h.radius * 0.65;
          const sy = screen.y + Math.sin(a) * h.radius * 0.35;
          ctx.beginPath();
          ctx.moveTo(sx - 4, sy);
          ctx.lineTo(sx, sy - 13);
          ctx.lineTo(sx + 4, sy);
          ctx.closePath();
          ctx.fillStyle = `rgba(77, 124, 15, ${0.85 * alpha})`;
          ctx.fill();
          ctx.stroke();
        }
      } else {
        const spin = h.life * 2.4 * (h.windStrength >= 0 ? 1 : -1);
        ctx.strokeStyle = `rgba(186, 230, 253, ${0.6 * alpha})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let ring = 0; ring < 3; ring++) {
          const radius = h.radius * (0.32 + ring * 0.22);
          const start = spin + ring * 1.4;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, radius, start, start + Math.PI * 1.1);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
      ctx.restore();
    }
  }

  private renderBossProjectiles(): void {
    const { ctx, camera } = this;
    for (let i = 0; i < this.bossProjectiles.length; i++) {
      const p = this.bossProjectiles[i];
      if (!camera.isInView(p.x, p.y, p.radius + 20)) continue;
      const screen = camera.worldToScreen(p.x, p.y);
      const alpha = Math.min(1, p.life / 0.5);

      ctx.save();
      if (p.kind === 'fireball') {
        const glow = ctx.createRadialGradient(screen.x, screen.y, 1, screen.x, screen.y, p.radius * 2.2);
        glow.addColorStop(0, `rgba(254, 249, 195, ${alpha})`);
        glow.addColorStop(0.35, `rgba(249, 115, 22, ${0.95 * alpha})`);
        glow.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, p.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, p.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'soundwave') {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(screen.x, screen.y);
        ctx.rotate(angle);
        ctx.strokeStyle = `rgba(244, 114, 182, ${0.85 * alpha})`;
        ctx.lineWidth = 3;
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          ctx.arc(0, 0, p.radius + ring * 4, -0.85, 0.85);
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(251, 207, 232, ${0.7 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 14, -0.6, 0.6);
        ctx.stroke();
      } else if (p.kind === 'water') {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(screen.x, screen.y);
        ctx.rotate(angle);
        const jet = ctx.createLinearGradient(-p.radius * 5, 0, p.radius * 2, 0);
        jet.addColorStop(0, 'rgba(14, 165, 233, 0)');
        jet.addColorStop(0.6, `rgba(56, 189, 248, ${0.75 * alpha})`);
        jet.addColorStop(1, `rgba(224, 242, 254, ${alpha})`);
        ctx.fillStyle = jet;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.radius * 4.5, p.radius * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(224, 242, 254, ${alpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spore') {
        const glow = ctx.createRadialGradient(screen.x, screen.y, 1, screen.x, screen.y, p.radius * 2.4);
        glow.addColorStop(0, `rgba(220, 252, 231, ${alpha})`);
        glow.addColorStop(0.4, `rgba(132, 204, 22, ${0.9 * alpha})`);
        glow.addColorStop(1, 'rgba(22, 101, 52, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, p.radius * 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(190, 242, 100, ${alpha})`;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, p.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(22, 101, 52, ${0.8 * alpha})`;
        ctx.beginPath();
        ctx.arc(screen.x + Math.sin(p.life * 7) * 2, screen.y, p.radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spirit') {
        const pulse = 1 + Math.sin(p.life * 9) * 0.08;
        const glow = ctx.createRadialGradient(screen.x, screen.y, 1, screen.x, screen.y, p.radius * 2.8 * pulse);
        glow.addColorStop(0, `rgba(240, 253, 244, ${alpha})`);
        glow.addColorStop(0.32, `rgba(168, 85, 247, ${0.92 * alpha})`);
        glow.addColorStop(0.68, `rgba(74, 222, 128, ${0.55 * alpha})`);
        glow.addColorStop(1, 'rgba(88, 28, 135, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, p.radius * 2.8 * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(233, 213, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, p.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // Two green spiritual motes orbit the purple core.
        for (let mote = 0; mote < 2; mote++) {
          const orbit = p.life * 6 + mote * Math.PI;
          ctx.fillStyle = `rgba(74, 222, 128, ${0.9 * alpha})`;
          ctx.beginPath();
          ctx.arc(
            screen.x + Math.cos(orbit) * p.radius * 1.5,
            screen.y + Math.sin(orbit) * p.radius * 0.8,
            p.radius * 0.3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      } else {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.translate(screen.x, screen.y);
        ctx.rotate(angle);
        ctx.strokeStyle = `rgba(167, 139, 250, ${0.9 * alpha})`;
        ctx.lineWidth = 2.5;
        for (let ring = 0; ring < 4; ring++) {
          ctx.beginPath();
          ctx.arc(0, 0, p.radius + ring * 5, -0.7, 0.7);
          ctx.stroke();
        }
        ctx.strokeStyle = `rgba(216, 180, 254, ${0.75 * alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 22, -0.45, 0.45);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderNightFireBossGlow(): void {
    if (!this.isAmazonNight()) return;

    const { ctx, camera } = this;
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (enemy.type !== 'boss_curupira' && enemy.type !== 'boss_boitata') continue;
      if (!camera.isInView(enemy.x, enemy.y, enemy.radius * 3)) continue;

      const screen = camera.worldToScreen(enemy.x, enemy.y);
      const isBoitata = enemy.type === 'boss_boitata';
      const radius = enemy.radius * 3.2;
      const glow = ctx.createRadialGradient(screen.x, screen.y, 4, screen.x, screen.y, radius);
      glow.addColorStop(0, isBoitata ? 'rgba(254, 240, 138, 0.8)' : 'rgba(253, 186, 116, 0.75)');
      glow.addColorStop(0.4, 'rgba(249, 115, 22, 0.42)');
      glow.addColorStop(1, 'rgba(220, 38, 38, 0)');

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderDebugOverlay(): void {
    const { ctx, camera, debugConfig, player } = this;
    if (!debugConfig.showHitboxes && !debugConfig.showRanges && !debugConfig.showSpatialGrid) {
      return;
    }

    ctx.save();

    // 1. Spatial Grid
    if (debugConfig.showSpatialGrid) {
      const cellSize = 110;
      const left = camera.x - camera.viewportWidth / 2;
      const top = camera.y - camera.viewportHeight / 2;
      const right = camera.x + camera.viewportWidth / 2;
      const bottom = camera.y + camera.viewportHeight / 2;

      const startCol = Math.floor(left / cellSize);
      const endCol = Math.floor(right / cellSize);
      const startRow = Math.floor(top / cellSize);
      const endRow = Math.floor(bottom / cellSize);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      for (let c = startCol; c <= endCol; c++) {
        const sx = c * cellSize - camera.x + camera.viewportWidth / 2 + camera.shakeOffsetX;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, camera.viewportHeight);
        ctx.stroke();
      }
      for (let r = startRow; r <= endRow; r++) {
        const sy = r * cellSize - camera.y + camera.viewportHeight / 2 + camera.shakeOffsetY;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(camera.viewportWidth, sy);
        ctx.stroke();
      }
    }

    // 2. Ranges (Pickup radius, Bible orbital, Garlic aura)
    if (debugConfig.showRanges) {
      const pScreen = camera.worldToScreen(player.x, player.y);

      // Pickup radius
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(pScreen.x, pScreen.y, player.pickupRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Garlic aura
      if (this.weaponSystem.weapons.has('garlic')) {
        const gRadius = this.weaponSystem.garlicRadius * player.areaMultiplier;
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pScreen.x, pScreen.y, gRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Bible orbit
      if (this.weaponSystem.weapons.has('bible')) {
        const bRadius = this.weaponSystem.bibleRadius * player.areaMultiplier;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pScreen.x, pScreen.y, bRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 3. Hitboxes (Player, Enemies, Projectiles, Ground Zones)
    if (debugConfig.showHitboxes) {
      // Player
      const pScreen = camera.worldToScreen(player.x, player.y);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pScreen.x, pScreen.y, player.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Enemies
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!camera.isInView(e.x, e.y, e.radius)) continue;
        const eScreen = camera.worldToScreen(e.x, e.y);
        ctx.strokeStyle = e.isBoss ? '#f43f5e' : e.isElite ? '#f59e0b' : '#ef4444';
        ctx.lineWidth = e.isBoss ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(eScreen.x, eScreen.y, e.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Boss nova radius telegraph
        if (e.isBoss && e.skillState === 'telegraph_nova') {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(eScreen.x, eScreen.y, e.novaRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Projectiles
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < this.weaponSystem.projectiles.length; i++) {
        const p = this.weaponSystem.projectiles[i];
        if (!camera.isInView(p.x, p.y, p.radius)) continue;
        const pScreen = camera.worldToScreen(p.x, p.y);
        ctx.beginPath();
        ctx.arc(pScreen.x, pScreen.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ground Zones
      for (let i = 0; i < this.weaponSystem.groundZones.length; i++) {
        const z = this.weaponSystem.groundZones[i];
        if (!camera.isInView(z.x, z.y, z.radius)) continue;
        const zScreen = camera.worldToScreen(z.x, z.y);
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(zScreen.x, zScreen.y, z.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // --- DevTools Public API ---

  public devSpawnEnemy(type: EnemyType, count: number = 1): void {
    if (this.bossEncounter || type === 'boss_gorilla' || type === 'boss_anaconda') return;
    // The Minotaur is night-plain content and must never appear in the forest,
    // even when spawned manually through the developer tools.
    if (type === 'elite_minotaur' && this.waveDirector.isAmazonForest) return;

    const minutes = this.waveDirector.survivalTime / 60;
    const hpMult = (1.0 + minutes * 0.52) * this.difficulty.enemyHp;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 150;
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;
      const enemy = this.waveDirector.createEnemy(type, x, y, hpMult);
      this.enemies.push(enemy);
      this.spatialGrid.insert(enemy);
      if (enemy.isBoss) {
        this.waveDirector.bossActive = enemy;
      }
    }
  }

  public devSpawnDummy(): void {
    if (this.bossEncounter) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 130;
    const x = this.player.x + Math.cos(angle) * dist;
    const y = this.player.y + Math.sin(angle) * dist;
    const dummy = new Enemy(Date.now() + Math.random() * 1000, 'zombie', x, y, 100);
    dummy.name = '🎯 Boneco de Treino (Dummy)';
    dummy.maxHp = 1000000;
    dummy.hp = 1000000;
    dummy.speed = 0;
    dummy.damage = 0;
    dummy.knockbackResistance = 0;
    this.enemies.push(dummy);
    this.spatialGrid.insert(dummy);
  }

  public devSpawnDrop(type: Drop['type'], count: number = 1): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 60;
      const x = this.player.x + Math.cos(angle) * dist;
      const y = this.player.y + Math.sin(angle) * dist;
      const val = type === 'gem_red' ? 250 : type === 'gem_green' ? 25 : type === 'coin' ? 20 : 5;
      this.drops.push(new Drop(Date.now() + Math.random(), type, x, y, val));
    }
  }

  public devKillAllEnemies(withDrops: boolean = true): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (withDrops) {
        this.onEnemyKilled(e);
      }
    }
    this.enemies = [];
    this.spatialGrid.clear();
  }

  public devSkipTime(seconds: number): void {
    this.waveDirector.survivalTime = Math.max(0, this.waveDirector.survivalTime + seconds);
    this.syncHUD();
  }

  public devForceLevelUp(): void {
    const needed = Math.max(1, this.player.xpToNextLevel - this.player.xp);
    this.player.addXp(needed);
    const options = this.weaponSystem.generateUpgradeOptions();
    if (options.length > 0) {
      this.sound.playLevelUp();
      this.pause();
      this.callbacks.onLevelUp(options);
    }
  }

  public devDirectAddLevel(amount: number = 1): void {
    for (let i = 0; i < amount; i++) {
      this.player.level += 1;
      this.player.xpToNextLevel = Player.computeXpToNextLevel(this.player.level);
      this.player.heal(this.player.maxHp * this.player.levelUpHealFraction);
    }
    this.syncHUD();
  }

  public devMagnetAll(): void {
    this.sound.playLevelUp();
    this.vfx.triggerFlash('#38bdf8', 0.4);
    for (let i = 0; i < this.drops.length; i++) {
      this.drops[i].isBeingMagnetPulled = true;
    }
  }

  public devHealPlayer(): void {
    this.player.hp = this.player.maxHp;
    this.vfx.addDamageNumber(this.player.x, this.player.y, this.player.maxHp, false, true);
    this.sound.playGemPickup(8);
    this.syncHUD();
  }

  public devAddGold(amount: number = 500): void {
    this.goldCollected += amount;
    this.vfx.addDamageNumber(this.player.x, this.player.y, amount, true, true);
    this.sound.playGemPickup(4);
    this.syncHUD();
  }

  public devForceVictory(): void {
    this.handleVictory();
  }

  public devForceGameOver(): void {
    this.handlePlayerDeath();
  }

  public devSetFreezeSpawns(freeze: boolean): void {
    this.debugConfig.freezeSpawns = freeze;
    this.waveDirector.freezeSpawns = freeze;
  }

  public devToggleGodMode(): boolean {
    this.player.godMode = !this.player.godMode;
    return this.player.godMode;
  }

  public devToggleInfiniteStamina(): boolean {
    this.player.infiniteStamina = !this.player.infiniteStamina;
    return this.player.infiniteStamina;
  }

  public devToggleHitboxes(): boolean {
    this.debugConfig.showHitboxes = !this.debugConfig.showHitboxes;
    return this.debugConfig.showHitboxes;
  }

  public devToggleRanges(): boolean {
    this.debugConfig.showRanges = !this.debugConfig.showRanges;
    return this.debugConfig.showRanges;
  }

  public devToggleSpatialGrid(): boolean {
    this.debugConfig.showSpatialGrid = !this.debugConfig.showSpatialGrid;
    return this.debugConfig.showSpatialGrid;
  }

  public devSetTimeScale(scale: number): void {
    this.debugConfig.timeScale = scale;
  }

  public devModifyStat(
    stat: 'might' | 'speed' | 'cooldownReduction' | 'pickupRadius',
    delta: number
  ): void {
    if (stat === 'might') {
      this.player.might = Math.max(0.5, Math.min(10, this.player.might + delta));
    } else if (stat === 'speed') {
      this.player.speed = Math.max(60, Math.min(600, this.player.speed + delta));
    } else if (stat === 'cooldownReduction') {
      this.player.cooldownReduction = Math.max(0, Math.min(0.7, this.player.cooldownReduction + delta));
    } else if (stat === 'pickupRadius') {
      this.player.pickupRadius = Math.max(20, Math.min(500, this.player.pickupRadius + delta));
    }
  }

  public devMaximizeAllEquipped(): void {
    this.weaponSystem.weapons.forEach((w) => {
      this.weaponSystem.devSetWeaponLevel(w.id, w.maxLevel);
    });
    this.weaponSystem.passives.forEach((p) => {
      this.weaponSystem.devSetPassiveLevel(p.id, p.maxLevel, this.player);
    });
  }

  public devEvolveAllEquipped(): void {
    this.weaponSystem.weapons.forEach((w) => {
      this.weaponSystem.devSetWeaponLevel(w.id, w.maxLevel, true);
    });
  }

  public devClearExtraWeapons(): void {
    const initial = this.player.character.startingWeapon;
    this.weaponSystem.weapons.forEach((_, id) => {
      if (id !== initial) {
        this.weaponSystem.devRemoveWeapon(id);
      }
    });
    this.weaponSystem.passives.forEach((_, id) => {
      this.weaponSystem.devRemovePassive(id, this.player);
    });
  }

  public getDevTelemetry(): DevTelemetrySnapshot {
    const timeSurvived = Math.max(1, Math.floor(this.waveDirector.survivalTime));
    const weapons = Array.from(this.weaponSystem.weapons.values()).map((w) => {
      const meta = WEAPON_REGISTRY[w.id];
      return {
        id: w.id,
        level: w.level,
        evolved: w.evolved,
        name: w.evolved ? meta.evolvedName : meta.name,
        totalDamage: Math.round(w.totalDamageDealt),
        dps: Math.round((w.totalDamageDealt / timeSurvived) * 10) / 10,
      };
    });

    return {
      fps: this.currentFps,
      frameTimeMs: this.currentFrameTimeMs,
      enemyCount: this.enemies.length,
      projectileCount: this.weaponSystem.projectiles.length,
      groundZoneCount: this.weaponSystem.groundZones.length,
      dropCount: this.drops.length,
      vfxCount: this.vfx.count,
      godMode: this.player.godMode,
      infiniteStamina: this.player.infiniteStamina,
      timeScale: this.debugConfig.timeScale,
      freezeSpawns: this.debugConfig.freezeSpawns,
      survivalTime: Math.floor(this.waveDirector.survivalTime),
      playerLevel: this.player.level,
      playerHp: Math.round(this.player.hp),
      playerMaxHp: Math.round(this.player.maxHp),
      stamina: Math.round(this.player.stamina),
      maxStamina: Math.round(this.player.movementConfig.maxStamina),
      might: Math.round(this.player.might * 100) / 100,
      speed: Math.round(this.player.speed),
      cooldownReduction: Math.round(this.player.cooldownReduction * 100),
      areaMultiplier: Math.round(this.player.areaMultiplier * 100) / 100,
      pickupRadius: Math.round(this.player.pickupRadius),
      critChance: Math.round(this.player.critChance * 100),
      luck: Math.round(this.player.luck * 100),
      weapons,
    };
  }

  public destroy(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.input.destroy();
    this.sound.destroy();
  }
}
