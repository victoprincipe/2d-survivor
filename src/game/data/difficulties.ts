import { DifficultyConfig, DifficultyId } from '../types';

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: 'easy',
    name: 'Fácil',
    description: 'Inimigos mais fracos e menos numerosos. Ideal para aprender.',
    color: '#4ade80',
    enemyHp: 0.75,
    enemyDamage: 0.7,
    enemyCount: 0.8,
    spawnRate: 0.8,
    xpMultiplier: 1.1,
    goldMultiplier: 1.1,
  },
  {
    id: 'normal',
    name: 'Normal',
    description: 'A experiência equilibrada padrão do jogo.',
    color: '#38bdf8',
    enemyHp: 1,
    enemyDamage: 1,
    enemyCount: 1,
    spawnRate: 1,
    xpMultiplier: 1,
    goldMultiplier: 1,
  },
  {
    id: 'hard',
    name: 'Difícil',
    description: 'Hordas maiores e inimigos mais resistentes.',
    color: '#f59e0b',
    enemyHp: 1.3,
    enemyDamage: 1.3,
    enemyCount: 1.15,
    spawnRate: 1.2,
    xpMultiplier: 1.1,
    goldMultiplier: 1.15,
  },
  {
    id: 'nightmare',
    name: 'Pesadelo',
    description: 'Sobrevivência brutal com dano e volume elevados.',
    color: '#a855f7',
    enemyHp: 1.7,
    enemyDamage: 1.6,
    enemyCount: 1.35,
    spawnRate: 1.5,
    xpMultiplier: 1.25,
    goldMultiplier: 1.35,
  },
  {
    id: 'infernal',
    name: 'Infernal',
    description: 'O caos absoluto. Apenas os mais fortes resistem.',
    color: '#ef4444',
    enemyHp: 2.2,
    enemyDamage: 2,
    enemyCount: 1.6,
    spawnRate: 1.9,
    xpMultiplier: 1.5,
    goldMultiplier: 1.6,
  },
];

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

export function getDifficulty(id: DifficultyId | string | undefined): DifficultyConfig {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
