export type WeaponId = 'wand' | 'whip' | 'knife' | 'bible' | 'garlic' | 'lightning';
export type EvolvedWeaponId =
  | 'holy_wand'
  | 'bloody_tear'
  | 'thousand_edge'
  | 'unholy_vespers'
  | 'soul_eater'
  | 'thunder_loop';

export type PassiveId = 'spinach' | 'wings' | 'heart' | 'tome' | 'magnet' | 'bracer';

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
  color: string;
  portraitColor: string;
  statBonuses: {
    maxHp?: number;
    speed?: number;
    might?: number; // damage multiplier
    cooldownReduction?: number;
    xpMultiplier?: number;
    pickupRadius?: number;
    armor?: number;
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

export interface SavedGameData {
  gold: number;
  powerUps: Record<string, number>;
  highScore: {
    timeSurvived: number;
    kills: number;
    highestLevel: number;
    wins: number;
  };
}

export type EnemyType = 'bat' | 'skeleton' | 'zombie' | 'ghost' | 'elite_minotaur' | 'boss_vampire';

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
  weaponStats: {
    id: WeaponId;
    name: string;
    evolved: boolean;
    damage: number;
    dps: number;
    percentage: number;
  }[];
}
