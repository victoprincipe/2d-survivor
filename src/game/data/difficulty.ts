import { DifficultyId } from '../types';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  description: string;
  enemyHpMult: number;
  enemyDamageMult: number;
  spawnRateMult: number;
  goldMult: number;
  accountXpMult: number;
  color: string;
}

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: 'facil',
    name: 'Fácil',
    description: 'Hordas menores e recompensas reduzidas. Ideal para aprender.',
    enemyHpMult: 0.8,
    enemyDamageMult: 0.75,
    spawnRateMult: 0.85,
    goldMult: 0.8,
    accountXpMult: 0.8,
    color: '#22c55e',
  },
  {
    id: 'normal',
    name: 'Normal',
    description: 'A experiência equilibrada original.',
    enemyHpMult: 1,
    enemyDamageMult: 1,
    spawnRateMult: 1,
    goldMult: 1,
    accountXpMult: 1,
    color: '#eab308',
  },
  {
    id: 'dificil',
    name: 'Difícil',
    description: 'Inimigos mais resistentes e agressivos. +50% de ouro.',
    enemyHpMult: 1.35,
    enemyDamageMult: 1.25,
    spawnRateMult: 1.15,
    goldMult: 1.5,
    accountXpMult: 1.4,
    color: '#f97316',
  },
  {
    id: 'pesadelo',
    name: 'Pesadelo',
    description: 'Elites implacáveis e hordas densas. +120% de ouro.',
    enemyHpMult: 1.8,
    enemyDamageMult: 1.6,
    spawnRateMult: 1.35,
    goldMult: 2.2,
    accountXpMult: 2,
    color: '#dc2626',
  },
  {
    id: 'infernal',
    name: 'Infernal',
    description: 'O abismo não perdoa. Chefes colossais e +220% de ouro.',
    enemyHpMult: 2.4,
    enemyDamageMult: 2.1,
    spawnRateMult: 1.6,
    goldMult: 3.2,
    accountXpMult: 3,
    color: '#a855f7',
  },
];

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

export function isDifficultyId(value: unknown): value is DifficultyId {
  return typeof value === 'string' && DIFFICULTIES.some((difficulty) => difficulty.id === value);
}

export function getDifficulty(id: DifficultyId | string | undefined): DifficultyConfig {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? DIFFICULTIES[1];
}
