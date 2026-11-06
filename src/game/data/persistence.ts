import { PermanentPowerUp, SavedGameData } from '../types';

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
    gold: 0,
    powerUps: {},
    highScore: {
      timeSurvived: 0,
      kills: 0,
      highestLevel: 0,
      wins: 0,
    },
  };
}

export function loadSavedData(): SavedGameData {
  if (typeof window === 'undefined') return getInitialSave();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialSave();
    const parsed = JSON.parse(raw);
    return {
      gold: parsed.gold ?? 0,
      powerUps: parsed.powerUps ?? {},
      highScore: {
        timeSurvived: parsed.highScore?.timeSurvived ?? 0,
        kills: parsed.highScore?.kills ?? 0,
        highestLevel: parsed.highScore?.highestLevel ?? 0,
        wins: parsed.highScore?.wins ?? 0,
      },
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
