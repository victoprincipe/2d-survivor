export type WeaponId =
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
  | 'lula_power';

export type EvolvedWeaponId =
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
  | 'poder_do_l_maximo';

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
  | 'bio_shield';

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
    area?: number;
  };
}

export interface UpgradeOption {
  type: 'weapon' | 'passive' | 'evolution';
  id: WeaponId | PassiveId | EvolvedWeaponId;
  baseId?: WeaponId;
  name: string;
  description: string;
  level: number;
  isNew: boolean;
  isEvolution?: boolean;
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

export interface SavedGameData {
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

export type AmazonEnemyType =
  | 'bullet_ant'
  | 'leafcutter_ant'
  | 'blue_butterfly'
  | 'cicada'
  | 'piranha'
  | 'poison_frog'
  | 'mantis'
  | 'stick_insect'
  | 'toucan'
  | 'pink_dolphin'
  | 'capybara'
  | 'sloth'
  | 'rhino_beetle'
  | 'longhorn_beetle'
  | 'giant_centipede'
  | 'giant_otter'
  | 'jaguar'
  | 'tapir'
  | 'goliath_spider'
  | 'black_caiman';

export type EnemyType =
  | 'bat'
  | 'skeleton'
  | 'zombie'
  | 'ghost'
  | 'elite_minotaur'
  | 'boss_vampire'
  | AmazonEnemyType;

export type DropType =
  | 'gem_blue'
  | 'gem_green'
  | 'gem_red'
  | 'chicken'
  | 'magnet'
  | 'rosary'
  | 'chest'
  | 'coin';

export interface HUDState {
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
