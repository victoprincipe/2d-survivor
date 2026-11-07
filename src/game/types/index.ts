export type WeaponId =
  | 'wand'
  | 'whip'
  | 'knife'
  | 'bow'
  | 'bible'
  | 'garlic'
  | 'lightning'
  | 'derson_combo'
  | 'syringe';
export type EvolvedWeaponId =
  | 'holy_wand'
  | 'bloody_tear'
  | 'thousand_edge'
  | 'arrow_storm'
  | 'unholy_vespers'
  | 'soul_eater'
  | 'thunder_loop'
  | 'derson_banquet'
  | 'supreme_serum';

export type PassiveId = 'spinach' | 'wings' | 'heart' | 'tome' | 'magnet' | 'bracer';

export type DifficultyId = 'facil' | 'normal' | 'dificil' | 'pesadelo' | 'infernal';
export type ItemRarity = 'comum' | 'rara' | 'epica' | 'lendaria';
export type RelicId =
  | 'iron_ring'
  | 'swift_boots'
  | 'moon_charm'
  | 'sapphire_lens'
  | 'blood_chalice'
  | 'storm_coil'
  | 'phoenix_ember'
  | 'void_heart';

export interface RelicEffects {
  might?: number;
  armor?: number;
  maxHp?: number;
  speed?: number;
  cooldownReduction?: number;
  xpMultiplier?: number;
  pickupRadius?: number;
  recoveryPerSec?: number;
  goldMultiplier?: number;
}

export interface RelicConfig {
  id: RelicId;
  name: string;
  description: string;
  rarity: ItemRarity;
  color: string;
  iconName: string;
  effects: RelicEffects;
}

export type SpecialAbilityKind = 'heal' | 'nova' | 'shield' | 'haste';

export interface SpecialAbilityConfig {
  name: string;
  description: string;
  kind: SpecialAbilityKind;
  cooldown: number;
  power: number;
  radius?: number;
  duration?: number;
}

export interface LifetimeStats {
  runs: number;
  kills: number;
  timeSurvived: number;
  bossesKilled: number;
  elitesKilled: number;
  goldEarned: number;
  levelsGained: number;
  evolutions: number;
  relicsFound: number;
  charactersPlayed: string[];
  bestTime: number;
  bestKills: number;
  bestRelics: number;
  highestLevel: number;
  winsByDifficulty: Partial<Record<DifficultyId, number>>;
}

export interface MissionState {
  dailyKey: string;
  weeklyKey: string;
  dailyBaseline: LifetimeStats;
  weeklyBaseline: LifetimeStats;
  claimed: string[];
}

export interface WeaponInstance {
  id: WeaponId;
  evolvedId?: EvolvedWeaponId;
  level: number;
  maxLevel: number;
  evolved: boolean;
  cooldownTimer: number;
  totalDamageDealt: number;
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
  skinAccent?: string;
  statBonuses: {
    maxHp?: number;
    speed?: number;
    might?: number; // damage multiplier
    cooldownReduction?: number;
    xpMultiplier?: number;
    pickupRadius?: number;
    armor?: number;
  };
  unlockLevel?: number;
  specialAbility?: SpecialAbilityConfig;
}

export interface CharacterSkinConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  portraitColor: string;
  accentColor: string;
  unlockLevel: number;
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
  iconName: string;
}

export interface RunRecord {
  won: boolean;
  survivalTime: number;
  kills: number;
  level: number;
  goldEarned: number;
  bossesKilled: number;
  elitesKilled: number;
  evolutions: number;
  relicsFound: number;
  characterId: string;
  difficulty: DifficultyId;
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

export interface SavedGameData {
  gold: number;
  powerUps: Record<string, number>;
  highScore: {
    timeSurvived: number;
    kills: number;
    highestLevel: number;
    wins: number;
  };
  accountXp: number;
  difficulty: DifficultyId;
  skin: string;
  achievements: string[];
  lifetimeStats: LifetimeStats;
  missionState: MissionState;
}

export type EnemyType =
  | 'bat'
  | 'skeleton'
  | 'zombie'
  | 'ghost'
  | 'elite_minotaur'
  | 'elite_banshee'
  | 'miniboss_golem'
  | 'boss_necromancer'
  | 'boss_vampire';

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
  relics: {
    id: RelicId;
    name: string;
    rarity: ItemRarity;
  }[];
  difficultyName?: string;
  ability?: {
    name: string;
    description: string;
    cooldown: number;
    remaining: number;
  };
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
  level: number;
  goldEarned: number;
  totalDamage: number;
  characterName: string;
  difficultyName: string;
  accountXpEarned: number;
  newAchievements: string[];
  relicsFound: number;
  weaponStats: {
    id: WeaponId;
    name: string;
    evolved: boolean;
    damage: number;
    dps: number;
    percentage: number;
  }[];
}
