import { LifetimeStats } from '../types';

export type ProgressMetric =
  | 'kills'
  | 'timeSurvived'
  | 'bossesKilled'
  | 'elitesKilled'
  | 'goldEarned'
  | 'runs'
  | 'levelsGained'
  | 'evolutions'
  | 'relicsFound'
  | 'charactersPlayed'
  | 'bestTime'
  | 'bestKills'
  | 'bestRelics'
  | 'highestLevel'
  | 'infernalWins'
  | 'hardWins'
  | 'wins';

export function getMetricValue(stats: LifetimeStats, metric: ProgressMetric): number {
  switch (metric) {
    case 'kills':
      return stats.kills;
    case 'timeSurvived':
      return stats.timeSurvived;
    case 'bossesKilled':
      return stats.bossesKilled;
    case 'elitesKilled':
      return stats.elitesKilled;
    case 'goldEarned':
      return stats.goldEarned;
    case 'runs':
      return stats.runs;
    case 'levelsGained':
      return stats.levelsGained;
    case 'evolutions':
      return stats.evolutions;
    case 'relicsFound':
      return stats.relicsFound;
    case 'charactersPlayed':
      return stats.charactersPlayed.length;
    case 'bestTime':
      return stats.bestTime;
    case 'bestKills':
      return stats.bestKills;
    case 'bestRelics':
      return stats.bestRelics;
    case 'highestLevel':
      return stats.highestLevel;
    case 'infernalWins':
      return stats.winsByDifficulty.infernal ?? 0;
    case 'hardWins':
      return (stats.winsByDifficulty.dificil ?? 0) + (stats.winsByDifficulty.pesadelo ?? 0) + (stats.winsByDifficulty.infernal ?? 0);
    case 'wins':
      return Object.values(stats.winsByDifficulty).reduce((total, wins) => total + (wins ?? 0), 0);
    default:
      return 0;
  }
}
