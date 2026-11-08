import {
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
import { emptyInventory, withEquipment } from '../data/inventory';
import { Camera } from './Camera';
import { InputManager } from './Input';
import { SoundEngine } from './SoundEngine';
import { SpatialGrid } from './SpatialGrid';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { GorillaNpc } from '../entities/GorillaNpc';
import { QuizKeeper } from '../entities/QuizKeeper';
import { ForestQuiz, ForestQuizView } from '../data/forestQuiz';
import { GorillaBoss } from '../entities/GorillaBoss';
import { GORILLA_LEAP, GORILLA_ROAR } from '../data/gorilla';
import { Drop } from '../entities/Drops';
import { VFXManager } from '../entities/VFX';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { WaveDirector } from '../systems/WaveDirector';
import { CollectedFruit, WorldSystem } from '../systems/WorldProps';
import { WEAPON_REGISTRY, PASSIVE_REGISTRY } from '../data/upgrades';
import { saveGameData, loadSavedData } from '../data/persistence';
import { getDifficulty } from '../data/difficulties';
import { applyRunToMissions } from '../data/missions';

export interface GameEngineCallbacks {
  onForestQuiz?: (quiz: ForestQuizView) => void;
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
  kind: 'fireball' | 'soundwave' | 'water' | 'sonic' | 'spore';
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
  private readonly quizKeeper: QuizKeeper | null;
  private readonly forestQuiz = new ForestQuiz();
  private forestQuizOpen = false;
  private quizLaunchRemaining = 0;
  private readonly quizLaunchDuration = 2.2;

  public answerForestQuiz(choice: number): ForestQuizView {
    if (this.forestQuizOpen && this.isPaused && !this.isGameOver) {
      const reward = this.forestQuiz.answer(choice);
      if (this.forestQuiz.view().status === 'failed') {
        this.forestQuizOpen = false;
        this.quizLaunchRemaining = this.quizLaunchDuration;
        this.input.handlePointerUp();
        this.sound.playQuizFailureScream();
        this.resume();
      }
      if (reward > 0) {
        this.goldCollected += reward;
        this.sound.playMissionClaim();
        this.syncHUD();
      }
    }
    return this.forestQuiz.view();
  }

  public closeForestQuiz(): void {
    if (!this.forestQuizOpen) return;
    this.forestQuizOpen = false;
    this.resume();
  }
  private gorillaDefeated = false;
  private gorillaFight: { boss: GorillaBoss; hiddenEnemies: Enemy[]; previousBoss: Enemy | null } | null = null;

  private get gorillaAvailable(): boolean {
    return !!this.gorillaNpc && !this.gorillaFight && !this.gorillaDefeated;
  }

  public startGorillaCombat(): boolean {
    if (!this.gorillaAvailable || !this.gorillaNpc?.canInteract(this.player) || this.isGameOver) return false;
    const minutes = this.waveDirector.survivalTime / 60;
    const boss = new GorillaBoss(-1, this.gorillaNpc.x, this.gorillaNpc.y,
      (1 + minutes * 0.3) * this.difficulty.enemyHp);
    boss.damage = Math.round(boss.damage * this.difficulty.enemyDamage);
    this.gorillaFight = { boss, hiddenEnemies: this.enemies, previousBoss: this.waveDirector.bossActive };
    this.enemies = [boss];
    this.spatialGrid.clear();
    this.bossProjectiles = [];
    this.bossHazards = [];
    this.waveDirector.bossActive = boss;
    this.sound.playBossRoar();
    this.resume();
    this.syncHUD();
    return true;
  }
  public drops: Drop[] = [];
  private bossProjectiles: BossProjectile[] = [];
  private bossHazards: BossHazard[] = [];
  private waterRipples: WaterRipple[] = [];
  private playerWaterFxTimer: number = 0;

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
  private gemStreak: number = 0;
  private gemStreakTimer: number = 0;
  private itemSpawnTimer: number = 0;
  private processedEnemyDeaths = new WeakSet<Enemy>();
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
    this.quizKeeper = mapId === 'amazon_forest' ? new QuizKeeper() : null;
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
    this.player.setCollisionResolver((fromX, fromY, dx, dy, radius, airborne) =>
      this.worldProps.resolvePlayerMovement(fromX, fromY, dx, dy, radius, airborne)
    );
    this.weaponSystem = new WeaponSystem(character.startingWeapon);
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

    const frameTime = currentTime - this.lastTime;
    this.currentFrameTimeMs = Math.round(frameTime * 10) / 10;
    this.frameCount++;
    this.fpsTimer += frameTime;
    if (this.fpsTimer >= 400) {
      this.currentFps = Math.max(1, Math.round((this.frameCount * 1000) / this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    const rawDt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    const timeScale = Math.max(0.1, Math.min(10, this.debugConfig.timeScale || 1.0));
    const dt = Math.min(rawDt, 0.1) * timeScale;

    if (!this.isPaused && !this.isGameOver) {
      this.update(dt);
    }

    this.render();

    this.animFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  private update(dt: number): void {
    // The launch is a short cinematic: hazards and controls wait for the landing.
    if (this.quizLaunchRemaining > 0) {
      this.quizLaunchRemaining = Math.max(0, this.quizLaunchRemaining - dt);
      this.quizKeeper?.update(dt);
      this.input.clearInteract();
      this.input.clearJump();
      if (this.quizLaunchRemaining === 0) {
        this.player.hp = 0;
        this.handlePlayerDeath();
      }
      return;
    }
    this.quizKeeper?.update(dt);
    this.gorillaNpc?.update(dt);
    const interactRequested = this.input.consumeInteract();
    if (interactRequested && !this.gorillaFight && this.quizKeeper?.canInteract(this.player) && this.callbacks.onForestQuiz) {
      this.pause();
      this.input.handlePointerUp();
      this.forestQuizOpen = true;
      this.callbacks.onForestQuiz(this.forestQuiz.begin());
      return;
    }
    if (interactRequested && this.gorillaAvailable && this.gorillaNpc?.canInteract(this.player) && this.callbacks.onGorillaDialogue) {
      this.pause();
      this.input.handlePointerUp();
      this.callbacks.onGorillaDialogue();
      return;
    }
    if (this.gemStreakTimer > 0) {
      this.gemStreakTimer -= dt;
      if (this.gemStreakTimer <= 0) this.gemStreak = 0;
    }

    // 1. Update Player
    const playerAlive = this.player.update(dt, this.input);
    if (!playerAlive) {
      this.handlePlayerDeath();
      return;
    }

    // 1.5. Water trail for the hero (and timers for the animal trails below).
    this.updateWaterEffects(dt);

    // 2. Update Camera
    this.camera.follow(this.player.x, this.player.y, dt);

    // 3. Clear and Rebuild Spatial Grid with current enemies.
    // Piranha, Boto-cor-de-rosa and Ariranha stay hidden under the surface
    // until the hero enters the water. While submerged they are left out of
    // the grid so weapons, projectiles and separation cannot detect or hit
    // them at all.
    const playerInWater = this.worldProps.isWaterSurface(this.player.x, this.player.y);
    this.player.isWadingInWater = playerInWater;
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
      // Jacaré-açu and Sucuri gain speed in the water (+50%) and on the beach
      // (+30%) once the hero is wet enough to hunt.
      e.terrainSpeedMultiplier =
        e.isRiverPredator && playerInWater
          ? this.worldProps.isWaterSurface(e.x, e.y)
            ? 1.5
            : 1.3
          : 1.0;

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
      // carry them onto the riverbank or dry forest floor. River predators may
      // haul out onto the beach, but never leave the river/beach band.
      if (e.isRiverPredator) {
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
          e.radius
        );
        e.x = resolved.x;
        e.y = resolved.y;
      } else if (!(e instanceof GorillaBoss && (e.isLeaping || e.pendingLeapImpact)) && !(e.isJaguarPredator && e.jaguarAttack === 'leap' &&
        (e.jaguarState === 'active' || e.pendingJaguarStrike === 'leap'))) {
        // Land animals cannot cross the plateau cliffs either: they must use
        // the dirt ramps, just like the hero.
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

      if (e instanceof GorillaBoss) {
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

      if (e instanceof GorillaBoss && e.pendingLeapImpact) {
        e.pendingLeapImpact = false;
        this.weaponSystem.spawnRingPulse(e.x, e.y, GORILLA_LEAP.radius, '#f59e0b', 0.4);
        this.camera.shake(0.25, 8);
        this.sound.playThunder();
        if (Math.hypot(this.player.x - e.x, this.player.y - e.y) <= GORILLA_LEAP.radius + this.player.radius &&
          !this.player.isJumping && !this.player.godMode && this.player.invulnerableTimer <= 0) {
          const hp = this.player.hp;
          const fatal = this.applyPlayerDamage(e.damage, true, true);
          if (this.player.hp < hp) this.player.applyStun(GORILLA_LEAP.stun);
          if (fatal) { this.handlePlayerDeath(); return; }
        }
      }

      // Land creatures standing on the river/lake surface are drawn waist-deep.
      e.isWadingInWater =
        !e.isWaterDweller && this.worldProps.isWaterSurface(e.x, e.y);

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
        if (e instanceof GorillaBoss) this.sound.playGorillaGroundSlam();
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
            radius: isBoitata ? 26 : 28,
            life: isBoitata ? 3.5 : 4.5,
            maxLife: isBoitata ? 3.5 : 4.5,
            kind: 'ember',
            tickTimer: 0,
            damage: Math.max(1, Math.round(e.damage * (isBoitata ? 0.25 : 0.3))),
            windStrength: 0,
          });
        }
        this.vfx.addSparks(e.x, e.y, '#fb923c', isBoitata ? 4 : 10);
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
        this.bossHazards.push({
          x: oldX,
          y: oldY,
          radius: 230,
          life: 3.6,
          maxLife: 3.6,
          kind: 'wind',
          tickTimer: 0,
          damage: 0,
          windStrength: Math.random() < 0.5 ? 170 : -170,
        });
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
        this.camera.shake(0.12, 3);
        for (let k = 0; k < 5; k++) {
          const angle = baseAngle + (k - 2) * 0.22;
          this.bossProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * 240,
            vy: Math.sin(angle) * 240,
            radius: 11,
            damage: Math.max(1, Math.round(e.damage * 0.65)),
            life: 3,
            maxLife: 3,
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
        this.vfx.addSparks(e.x, e.y, '#84cc16', 16);
        for (let ring = 0; ring < rings; ring++) {
          const count = 16;
          const offset = (ring * Math.PI) / count;
          for (let k = 0; k < count; k++) {
            const angle = offset + (k * Math.PI * 2) / count;
            this.bossProjectiles.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(angle) * 190,
              vy: Math.sin(angle) * 190,
              radius: 8,
              damage: Math.max(1, Math.round(e.damage * 0.45)),
              life: 3.4,
              maxLife: 3.4,
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
          this.player.applyStun(1.15);
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
      if (!e.isSubmerged && !e.jaguarBusy && !(e instanceof GorillaBoss && (e.isLeaping || e.isRoaring)) && !this.player.isJumping && bodyHit) {
        const fatal = this.applyPlayerDamage(e.damage, false, true);

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

    // 5. Update World Props (Torches and fruit trees)
    this.worldProps.update(dt, this.player, (drop) => this.drops.push(drop));

    // 5.1. Fruit trees are harvested only when the player presses E nearby.
    if (interactRequested) {
      const fruit = this.worldProps.collectNearbyFruitTree(this.player);
      if (fruit) this.handleFruitCollected(fruit);
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
      }
    }

    // 8. Update Wave Director (Spawns)
    if (this.gorillaFight && this.gorillaDefeated) {
      this.enemies = this.gorillaFight.hiddenEnemies.filter(enemy => enemy.hp > 0);
      this.waveDirector.bossActive = this.gorillaFight.previousBoss;
      this.gorillaFight = null;
      this.bossProjectiles = [];
      this.bossHazards = [];
      this.spatialGrid.clear();
    }
    if (!this.gorillaFight) this.waveDirector.update(
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
      const preyTypes = isJaguar ? JAGUAR_PREY : RIVER_PREDATOR_PREY;
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
        predator.ecologyHuntTimer =
          (isJaguar ? 15 : 10 + Math.random() * 2) * (nightFrenzy ? 0.5 : 1);
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
    if (enemy.type === 'boss_gorilla') return;
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
          const dirX = dist > 0 ? dx / dist : 1;
          const dirY = dist > 0 ? dy / dist : 0;
          const moveX = dirX * h.windStrength * falloff * dt;
          const moveY = dirY * h.windStrength * falloff * dt;
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
    if (enemy === this.gorillaFight?.boss) this.gorillaDefeated = true;

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
    if (drop.type === 'gem_blue' || drop.type === 'gem_green' || drop.type === 'gem_red') {
      this.gemStreak += 1;
      this.gemStreakTimer = 0.5;
      this.sound.playGemPickup(this.gemStreak);
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
    if (option.type === 'evolution') {
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
    this.isGameOver = true;
    this.sound.playGameOver();
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

    // 1. Clear & Render Floor Tile Pattern
    this.worldProps.renderFloor(ctx, camera);

    // 1.2. Aquatic ambushers stay invisible until the hero enters the river,
    // but a faint dark silhouette hints at them below the surface.
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].renderSubmergedSilhouette(ctx, camera);
    }

    this.worldProps.renderTrees(ctx, camera);
    this.worldProps.renderDecorTrees(ctx, camera, this.player, this.enemies);
    this.worldProps.renderFruitTrees(ctx, camera, this.player);

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
    this.renderBossHazards();

    // 5. Render Enemies & Player
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].render(ctx, camera);
    }

    // Match the player's depth at the NPC's feet without adding it to combat.
    if (this.gorillaAvailable && this.gorillaNpc && this.player.y >= this.gorillaNpc.y) {
      this.gorillaNpc.render(ctx, camera);
    }
    if (this.quizKeeper && this.player.y >= this.quizKeeper.y) this.quizKeeper.render(ctx, camera);
    ctx.save();
    if (this.quizLaunchRemaining > 0) {
      const progress = 1 - this.quizLaunchRemaining / this.quizLaunchDuration;
      const arc = Math.sin(progress * Math.PI);
      const origin = camera.worldToScreen(this.player.x, this.player.y);
      ctx.translate(origin.x + arc * 100, origin.y - arc * (camera.viewportHeight + 220));
      ctx.rotate(arc * Math.PI * 2);
      ctx.scale(1 - arc * 0.6, 1 - arc * 0.6);
      ctx.translate(-origin.x, -origin.y);
    }
    this.player.render(ctx, camera);
    ctx.restore();
    if (this.quizKeeper && this.player.y < this.quizKeeper.y) this.quizKeeper.render(ctx, camera);
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
    if (this.gorillaAvailable && this.gorillaNpc && this.player.y < this.gorillaNpc.y) {
      this.gorillaNpc.render(ctx, camera);
    }

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
    if (this.quizLaunchRemaining > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1c1917';
      ctx.fillStyle = '#fde68a';
      const message = 'Resposta errada, viajante!';
      ctx.strokeText(message, camera.viewportWidth / 2, camera.viewportHeight * 0.3);
      ctx.fillText(message, camera.viewportWidth / 2, camera.viewportHeight * 0.3);
      ctx.restore();
    }
    if (!this.isPaused && !this.isGameOver && this.quizLaunchRemaining === 0 && !this.gorillaFight && this.quizKeeper?.canInteract(this.player)) {
      this.quizKeeper.renderPrompt(ctx, camera);
    }
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
    if (this.gorillaFight || type === 'boss_gorilla') return;
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
    if (this.gorillaFight) return;
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
