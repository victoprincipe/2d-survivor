import { DifficultyConfig, DifficultyId } from '../types';

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: 'easy',
    name: 'Fácil',
    description: 'Inimigos mais frágeis e menos numerosos. Ideal para conhecer o arsenal.',
    color: '#4ade80',
    enemyHp: 0.75,
    enemyDamage: 0.7,
    enemyCount: 0.8,
    spawnRate: 0.8,
    xpMultiplier: 0.95,
    goldMultiplier: 0.85,
  },
  {
    id: 'normal',
    name: 'Normal',
    description: 'A experiência equilibrada padrão do jogo (100% recompensas).',
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
    description: 'Hordas densas e monstros resistentes (+15% XP, +35% Ouro).',
    color: '#f59e0b',
    enemyHp: 1.35,
    enemyDamage: 1.25,
    enemyCount: 1.18,
    spawnRate: 1.22,
    xpMultiplier: 1.15,
    goldMultiplier: 1.35,
  },
  {
    id: 'nightmare',
    name: 'Pesadelo',
    description: 'Sobrevivência implacável contra enxames letais (+30% XP, +75% Ouro).',
    color: '#a855f7',
    enemyHp: 1.75,
    enemyDamage: 1.55,
    enemyCount: 1.38,
    spawnRate: 1.5,
    xpMultiplier: 1.3,
    goldMultiplier: 1.75,
  },
  {
    id: 'infernal',
    name: 'Infernal',
    description: 'O caos absoluto. Apenas builds sinérgicas sobrevivem (+50% XP, +125% Ouro).',
    color: '#ef4444',
    enemyHp: 2.3,
    enemyDamage: 1.95,
    enemyCount: 1.65,
    spawnRate: 1.85,
    xpMultiplier: 1.5,
    goldMultiplier: 2.25,
  },
];

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

export function getDifficulty(id: DifficultyId | string | undefined): DifficultyConfig {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
