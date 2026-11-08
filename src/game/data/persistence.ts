import { PermanentPowerUp, SavedGameData } from '../types';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from './difficulties';
import { normalizeInventories } from './inventory';
import { createInitialMissionState, normalizeMissionState } from './missions';

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

export function getInitialSave(): SavedGameData {
  return {
    inventories: {},
    gold: 0,
    accountXp: 0,
    powerUps: {},
    difficulty: DEFAULT_DIFFICULTY,
    highScore: {
      timeSurvived: 0,
      kills: 0,
      highestLevel: 0,
      wins: 0,
    },
    missions: createInitialMissionState(),
  };
}

export function loadSavedData(): SavedGameData {
  if (typeof window === 'undefined') return getInitialSave();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialSave();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return getInitialSave();
    }

    const savedDifficulty = DIFFICULTIES.find((d) => d.id === parsed.difficulty)?.id;
    const highScore =
      parsed.highScore && typeof parsed.highScore === 'object' ? parsed.highScore : {};

    return {
      ...parsed,
      inventories: normalizeInventories(parsed.inventories),
      gold: typeof parsed.gold === 'number' && Number.isFinite(parsed.gold) ? parsed.gold : 0,
      accountXp:
        typeof parsed.accountXp === 'number' && Number.isFinite(parsed.accountXp)
          ? Math.max(0, parsed.accountXp)
          : 0,
      powerUps:
        parsed.powerUps && typeof parsed.powerUps === 'object' && !Array.isArray(parsed.powerUps)
          ? parsed.powerUps
          : {},
      difficulty: savedDifficulty ?? DEFAULT_DIFFICULTY,
      highScore: {
        timeSurvived: highScore.timeSurvived ?? 0,
        kills: highScore.kills ?? 0,
        highestLevel: highScore.highestLevel ?? 0,
        wins: highScore.wins ?? 0,
      },
      missions: normalizeMissionState(parsed.missions),
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
