import { DifficultyId, LifetimeStats, MissionState, PermanentPowerUp, SavedGameData } from '../types';
import { DEFAULT_DIFFICULTY, isDifficultyId } from './difficulty';
import { getDailyKey, getWeeklyKey } from './time';

export const POWER_UP_DEFINITIONS: PermanentPowerUp[] = [
  {
    id: 'might',
    name: 'Poder Bruto',
    description: '+5% de dano global para todos os ataques por nível.',
    level: 0,
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.5,
  },
  {
    id: 'armor',
    name: 'Armadura de Ferro',
    description: 'Reduz todo dano recebido em 1 por nível.',
    level: 0,
    maxLevel: 3,
    baseCost: 200,
    costMultiplier: 2.0,
  },
  {
    id: 'maxHp',
    name: 'Vitalidade',
    description: '+10% de vida máxima inicial por nível.',
    level: 0,
    maxLevel: 5,
    baseCost: 120,
    costMultiplier: 1.5,
  },
  {
    id: 'recovery',
    name: 'Regeneração',
    description: 'Recupera +0.5 HP por segundo continuamente por nível.',
    level: 0,
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 1.6,
  },
  {
    id: 'speed',
    name: 'Agilidade',
    description: '+5% de velocidade de movimento base por nível.',
    level: 0,
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.4,
  },
  {
    id: 'greed',
    name: 'Ganância',
    description: '+15% de ouro recebido de moedas e baús por nível.',
    level: 0,
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 1.5,
  },
];

const STORAGE_KEY = 'vampire_survivors_2d_save';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function createLifetimeStats(): LifetimeStats {
  return {
    runs: 0,
    kills: 0,
    timeSurvived: 0,
    bossesKilled: 0,
    elitesKilled: 0,
    goldEarned: 0,
    levelsGained: 0,
    evolutions: 0,
    relicsFound: 0,
    charactersPlayed: [],
    bestTime: 0,
    bestKills: 0,
    bestRelics: 0,
    highestLevel: 0,
    winsByDifficulty: {},
  };
}

export function normalizeLifetimeStats(value: unknown): LifetimeStats {
  const raw = isRecord(value) ? value : {};
  const winsRaw = isRecord(raw.winsByDifficulty) ? raw.winsByDifficulty : {};
  const winsByDifficulty: Partial<Record<DifficultyId, number>> = {};

  for (const [key, wins] of Object.entries(winsRaw)) {
    if (isDifficultyId(key)) {
      winsByDifficulty[key] = Math.max(0, Math.floor(numberOr(wins, 0)));
    }
  }

  return {
    runs: Math.max(0, Math.floor(numberOr(raw.runs, 0))),
    kills: Math.max(0, Math.floor(numberOr(raw.kills, 0))),
    timeSurvived: Math.max(0, numberOr(raw.timeSurvived, 0)),
    bossesKilled: Math.max(0, Math.floor(numberOr(raw.bossesKilled, 0))),
    elitesKilled: Math.max(0, Math.floor(numberOr(raw.elitesKilled, 0))),
    goldEarned: Math.max(0, Math.floor(numberOr(raw.goldEarned, 0))),
    levelsGained: Math.max(0, Math.floor(numberOr(raw.levelsGained, 0))),
    evolutions: Math.max(0, Math.floor(numberOr(raw.evolutions, 0))),
    relicsFound: Math.max(0, Math.floor(numberOr(raw.relicsFound, 0))),
    charactersPlayed: stringArray(raw.charactersPlayed),
    bestTime: Math.max(0, numberOr(raw.bestTime, 0)),
    bestKills: Math.max(0, Math.floor(numberOr(raw.bestKills, 0))),
    bestRelics: Math.max(0, Math.floor(numberOr(raw.bestRelics, 0))),
    highestLevel: Math.max(0, Math.floor(numberOr(raw.highestLevel, 0))),
    winsByDifficulty,
  };
}

function getCurrentMissionKeys(): { dailyKey: string; weeklyKey: string } {
  // During SSR the initial save must stay deterministic; the real keys are
  // resolved on the client, where localStorage is available.
  if (typeof window === 'undefined') {
    return { dailyKey: '', weeklyKey: '' };
  }

  return { dailyKey: getDailyKey(), weeklyKey: getWeeklyKey() };
}

export function createMissionState(lifetimeStats: LifetimeStats): MissionState {
  return {
    ...getCurrentMissionKeys(),
    dailyBaseline: { ...lifetimeStats },
    weeklyBaseline: { ...lifetimeStats },
    claimed: [],
  };
}

function normalizeMissionState(value: unknown, lifetimeStats: LifetimeStats): MissionState {
  const raw = isRecord(value) ? value : {};
  const dailyKey = getDailyKey();
  const weeklyKey = getWeeklyKey();
  const storedDailyKey = typeof raw.dailyKey === 'string' ? raw.dailyKey : '';
  const storedWeeklyKey = typeof raw.weeklyKey === 'string' ? raw.weeklyKey : '';

  return {
    dailyKey,
    weeklyKey,
    dailyBaseline:
      storedDailyKey === dailyKey && isRecord(raw.dailyBaseline)
        ? normalizeLifetimeStats(raw.dailyBaseline)
        : { ...lifetimeStats },
    weeklyBaseline:
      storedWeeklyKey === weeklyKey && isRecord(raw.weeklyBaseline)
        ? normalizeLifetimeStats(raw.weeklyBaseline)
        : { ...lifetimeStats },
    claimed: stringArray(raw.claimed),
  };
}

export function getInitialSave(): SavedGameData {
  const lifetimeStats = createLifetimeStats();
  return {
    gold: 0,
    powerUps: {},
    highScore: {
      timeSurvived: 0,
      kills: 0,
      highestLevel: 0,
      wins: 0,
    },
    accountXp: 0,
    difficulty: DEFAULT_DIFFICULTY,
    skin: 'classico',
    achievements: [],
    lifetimeStats,
    missionState: createMissionState(lifetimeStats),
  };
}

export function loadSavedData(): SavedGameData {
  if (typeof window === 'undefined') return getInitialSave();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialSave();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const lifetimeStats = normalizeLifetimeStats(parsed.lifetimeStats);
    const highScore = isRecord(parsed.highScore) ? parsed.highScore : {};
    const powerUpsRaw = isRecord(parsed.powerUps) ? parsed.powerUps : {};
    const powerUps: Record<string, number> = {};

    for (const [key, value] of Object.entries(powerUpsRaw)) {
      powerUps[key] = Math.max(0, Math.floor(numberOr(value, 0)));
    }

    return {
      gold: Math.max(0, Math.floor(numberOr(parsed.gold, 0))),
      powerUps,
      highScore: {
        timeSurvived: Math.max(0, numberOr(highScore.timeSurvived, 0)),
        kills: Math.max(0, Math.floor(numberOr(highScore.kills, 0))),
        highestLevel: Math.max(0, Math.floor(numberOr(highScore.highestLevel, 0))),
        wins: Math.max(0, Math.floor(numberOr(highScore.wins, 0))),
      },
      accountXp: Math.max(0, Math.floor(numberOr(parsed.accountXp, 0))),
      difficulty: isDifficultyId(parsed.difficulty) ? parsed.difficulty : DEFAULT_DIFFICULTY,
      skin: typeof parsed.skin === 'string' && parsed.skin.length > 0 ? parsed.skin : 'classico',
      achievements: stringArray(parsed.achievements),
      lifetimeStats,
      missionState: normalizeMissionState(parsed.missionState, lifetimeStats),
    };
  } catch {
    return getInitialSave();
  }
}

export function saveGameData(data: SavedGameData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save game data', err);
  }
}

export function getPowerUpCost(def: PermanentPowerUp, currentLevel: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, currentLevel));
}
