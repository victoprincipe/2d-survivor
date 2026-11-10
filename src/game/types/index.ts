export type AmazonWeaponId =
  | 'garras_onca'
  | 'espinhos_pupunha'
  | 'ferrao_formiga'
  | 'bandeja_inox'
  | 'ciclone_saci'
  | 'lanca_caipora'
  | 'esporos_vitoria'
  | 'mordida_piranha'
  | 'rugido_mapinguari'
  | 'chicotada_cipo'
  | 'enxame_mutuca'
  | 'gota_resina'
  | 'voo_tucano'
  | 'teia_aranha'
  | 'arrancada_sucuri';

export type SupremeWeaponId =
  | 'furia_onca_acu'
  | 'metralha_floresta'
  | 'nuvem_biologica'
  | 'tempestade_lendaria'
  | 'injecao_letal';

export type WeaponId =
  | 'bottle_51'
  | 'wand'
  | 'whip'
  | 'knife'
  | 'bow'
  | 'bible'
  | 'garlic'
  | 'lightning'
  | 'derson_combo'
  | 'flying_tray'
  | 'syringe'
  | 'fire_flask'
  | 'executioner_axe'
  | 'lula_power'
  | AmazonWeaponId
  | SupremeWeaponId;

export type EvolvedWeaponId =
  | 'rain_51'
  | 'holy_wand'
  | 'bloody_tear'
  | 'thousand_edge'
  | 'arrow_storm'
  | 'unholy_vespers'
  | 'soul_eater'
  | 'thunder_loop'
  | 'derson_banquet'
  | 'infinite_rodizio'
  | 'supreme_serum'
  | 'purifying_blaze'
  | 'death_spiral'
  | 'poder_do_l_maximo'
  | AmazonWeaponId
  | SupremeWeaponId;

export type AmazonPassiveId =
  | 'casco_tartaruga'
  | 'essencia_acai'
  | 'energia_guarana'
  | 'raiz_ginseng'
  | 'casca_marupa'
  | 'olho_gato_maracaja'
  | 'vigor_anta'
  | 'plumas_arara'
  | 'coracao_jacare'
  | 'resiliencia_preguica';

export type PassiveId =
  | 'spinach'
  | 'wings'
  | 'heart'
  | 'tome'
  | 'magnet'
  | 'bracer'
  | 'lantern'
  | 'clover'
  | 'hourglass'
  | 'duplicator'
  | 'hunter_mark'
  | 'bio_shield'
  | AmazonPassiveId;

export interface WeaponInstance {
  id: WeaponId;
  evolvedId?: EvolvedWeaponId;
  level: number;
  maxLevel: number;
  evolved: boolean;
  cooldownTimer: number;
  totalDamageDealt: number;
  comboStep?: number;
}

export interface PassiveInstance {
  id: PassiveId;
  level: number;
  maxLevel: number;
}

export interface CharacterConfig {
  id: string;
  name: string;
  title: string;
  description: string;
  startingWeapon: WeaponId;
  iconName: string;
  color: string;
  portraitColor: string;
  sprite?: string;
  /** Four columns: walk, jump, bow attack and idle on successive rows. */
  animationSprite?: string;
  walkSprite?: string;
  attackSprite?: string;
  walkFrames?: number;
  attackFrames?: number;
  statBonuses: {
    maxHp?: number;
    speed?: number;
    might?: number; // damage multiplier
    cooldownReduction?: number;
    xpMultiplier?: number;
    pickupRadius?: number;
    armor?: number;
    recovery?: number;
    critChance?: number;
    attackSpeed?: number;
    bonusAmount?: number;
    area?: number;
  };
}

export interface UpgradeOption {
  type: 'weapon' | 'passive' | 'evolution' | 'fusion';
  id: WeaponId | PassiveId | EvolvedWeaponId;
  baseId?: WeaponId;
  fusionPassiveId?: PassiveId;
  name: string;
  description: string;
  level: number;
  isNew: boolean;
  isEvolution?: boolean;
  isFusion?: boolean;
  synergyWith?: string;
  hasSynergyOwned?: boolean;
  iconName: string;
}

export interface PermanentPowerUp {
  id: 'might' | 'armor' | 'maxHp' | 'recovery' | 'speed' | 'greed';
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
}

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'nightmare' | 'infernal';

export type MapId = 'night_plain' | 'amazon_forest';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  description: string;
  color: string;
  enemyHp: number;
  enemyDamage: number;
  enemyCount: number;
  spawnRate: number;
  xpMultiplier: number;
  goldMultiplier: number;
  levelUpHealFraction: number;
}

export type MissionPeriod = 'daily' | 'weekly' | 'secret';
export type MissionMetric =
  | 'kills'
  | 'survivalSeconds'
  | 'goldCollected'
  | 'bossesDefeated'
  | 'wins';

export interface MissionDefinition {
  id: string;
  period: MissionPeriod;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  goldReward: number;
  xpReward: number;
  secret?: boolean;
}

export interface MissionProgressBucket {
  periodKey: string;
  progress: Record<string, number>;
  claimed: string[];
}

export interface MissionSaveState {
  daily: MissionProgressBucket;
  weekly: MissionProgressBucket;
  secret: MissionProgressBucket;
}

export interface MissionRunStats {
  kills: number;
  survivalSeconds: number;
  goldCollected: number;
  bossesDefeated: number;
  wins: number;
}

export type EquipmentSlot = 'armor' | 'boots' | 'gloves' | 'helmet' | 'weapon';

/** Percent bonuses use fractions: 0.05 means 5%. */
export type EquipmentStats = Partial<Record<'maxHp' | 'armor' | 'might' | 'speed' | 'recovery' | 'critChance' | 'attackSpeed' | 'bonusAmount', number>>;
export interface EquipmentItem { id: string; name: string; slot: EquipmentSlot; stats: EquipmentStats; }
export interface CharacterInventory { items: EquipmentItem[]; equipped: Partial<Record<EquipmentSlot, string>>; forestQuizCompleted?: boolean; }

export interface SavedGameData {
  inventories: Record<string, CharacterInventory>;
  gold: number;
  accountXp: number;
  powerUps: Record<string, number>;
  difficulty: DifficultyId;
  highScore: {
    timeSurvived: number;
    kills: number;
    highestLevel: number;
    wins: number;
  };
  missions: MissionSaveState;
}

export type EnemyType =
  | 'bat'
  | 'skeleton'
  | 'zombie'
  | 'ghost'
  | 'elite_minotaur'
  | 'boss_vampire'
  | 'boss_gorilla'
  // Amazon Forest boss waves: Curupira, Saci-pererê, Boto-cor-de-rosa,
  // Iara, Caipora, Matinta Pereira, Vitória-Régia, Mapinguari,
  // Cobra-Grande (Boiúna) and Boitatá (final boss).
  | 'boss_curupira'
  | 'boss_saci'
  | 'boss_boto'
  | 'boss_iara'
  | 'boss_caipora'
  | 'boss_matinta'
  | 'boss_vitoria_regia'
  | 'boss_mapinguari'
  | 'boss_cobra_grande'
  | 'boss_boitata'
  // Basic enemies exclusive to the Amazon Forest map.
  | 'bullet_ant'
  | 'leafcutter_ant'
  | 'blue_butterfly'
  | 'cicada'
  // Medium threats exclusive to the Amazon Forest map.
  | 'poison_dart_frog'
  | 'praying_mantis'
  | 'stick_bug'
  | 'toucan'
  // Amazon constrictor: an elite/medium predator that roams land, river and mud.
  | 'sucuri'
  // Resistant threats exclusive to the Amazon Forest map: high HP and slow.
  | 'capybara'
  | 'sloth'
  | 'rhino_beetle'
  | 'sawyer_beetle'
  | 'giant_centipede'
  // Rare Amazon Forest elites: oversized, powerful and highly rewarding.
  | 'elite_jaguar'
  | 'elite_tapir'
  | 'elite_goliath_spider'
  // Aquatic Amazon Forest enemies: they only spawn and move inside water.
  | 'piranha'
  | 'pink_river_dolphin'
  | 'giant_otter'
  // Adult Jacaré-açu and its hatchling are separate identities: the adult has
  // its own spawn logic while the baby keeps the eat-and-grow mechanic.
  | 'elite_black_caiman'
  | 'baby_black_caiman';

export type DropType =
  | 'gem_blue'
  | 'gem_green'
  | 'gem_red'
  | 'chicken'
  | 'magnet'
  | 'rosary'
  | 'chest'
  | 'coin';

export type AmazonMissionMetric =
  | 'fruits'
  | 'level'
  | 'waterKills'
  | 'evolvedPredators'
  | 'gold'
  | 'bosses';

export interface MissionHUDItem {
  id: string;
  title: string;
  progress: number;
  target: number;
  complete: boolean;
  claimed: boolean;
  claimable: boolean;
}

export interface MissionObjectivesHUD {
  turn: 1 | 2 | 3;
  turnLabel: string;
  missions: MissionHUDItem[];
}

export interface HUDState {
  mapId?: MapId;
  playerHp: number;
  playerMaxHp: number;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  survivalTime: number; // in seconds
  kills: number;
  gold: number;
  weapons: {
    id: WeaponId;
    level: number;
    evolved: boolean;
    name: string;
    totalDamage: number;
  }[];
  passives: {
    id: PassiveId;
    level: number;
    name: string;
  }[];
  activeBoss?: {
    name: string;
    hp: number;
    maxHp: number;
  };
  eventAlert?: string;
  objectives?: MissionObjectivesHUD;
}

export interface GameEndSummary {
  won: boolean;
  survivalTime: number;
  kills: number;
  bossesDefeated: number;
  level: number;
  goldEarned: number;
  totalDamage: number;
  characterName: string;
  difficulty: DifficultyId;
  difficultyName: string;
  weaponStats: {
    id: WeaponId;
    name: string;
    evolved: boolean;
    damage: number;
    dps: number;
    percentage: number;
  }[];
}

export interface DevDebugConfig {
  showHitboxes: boolean;
  showRanges: boolean;
  showSpatialGrid: boolean;
  timeScale: number;
  freezeSpawns: boolean;
  cameraZoom: number;
}

export interface DevTelemetrySnapshot {
  fps: number;
  frameTimeMs: number;
  enemyCount: number;
  projectileCount: number;
  groundZoneCount: number;
  dropCount: number;
  vfxCount: number;
  godMode: boolean;
  infiniteStamina: boolean;
  timeScale: number;
  freezeSpawns: boolean;
  survivalTime: number;
  playerLevel: number;
  playerHp: number;
  playerMaxHp: number;
  stamina: number;
  maxStamina: number;
  might: number;
  speed: number;
  cooldownReduction: number;
  areaMultiplier: number;
  pickupRadius: number;
  critChance: number;
  luck: number;
  weapons: {
    id: WeaponId;
    level: number;
    evolved: boolean;
    name: string;
    totalDamage: number;
    dps: number;
  }[];
}

