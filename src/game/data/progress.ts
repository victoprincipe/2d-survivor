import { LifetimeStats, MissionState, RunRecord, SavedGameData } from '../types';
import { getDifficulty } from './difficulty';
import { getMetricValue, ProgressMetric } from './metrics';
import {
  MissionDef,
  MissionProgress,
  SECRET_MISSIONS,
  SPECIAL_MISSIONS,
  getDailyMissions,
  getWeeklyMissions,
} from './missions';
import { ACHIEVEMENTS, AchievementDef } from './achievements';
import { getDailyKey, getWeeklyKey } from './time';

export interface AccountLevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number;
}

export interface RunApplication {
  data: SavedGameData;
  accountXpEarned: number;
  unlockedAchievements: AchievementDef[];
}

export function getAccountLevelInfo(totalXp: number): AccountLevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  let needed = 250;

  while (remaining >= needed && level < 99) {
    remaining -= needed;
    level += 1;
    needed = Math.round(needed * 1.35);
  }

  return {
    level,
    xpIntoLevel: remaining,
    xpForNext: needed,
    progress: needed > 0 ? Math.min(100, (remaining / needed) * 100) : 100,
  };
}

export function isCharacterUnlocked(unlockLevel: number | undefined, accountXp: number): boolean {
  if (!unlockLevel) return true;
  return getAccountLevelInfo(accountXp).level >= unlockLevel;
}

function periodKeyFor(category: MissionDef['category'], state: MissionState): string {
  if (category === 'diaria') return state.dailyKey;
  if (category === 'semanal') return state.weeklyKey;
  return 'permanente';
}

function baselineFor(category: MissionDef['category'], state: MissionState): LifetimeStats {
  return category === 'diaria' ? state.dailyBaseline : state.weeklyBaseline;
}

function missionProgressValue(
  def: MissionDef,
  stats: LifetimeStats,
  state: MissionState
): number {
  const current = getMetricValue(stats, def.metric);
  if (def.absolute) return current;

  const baseline = baselineFor(def.category, state);
  return Math.max(0, current - getMetricValue(baseline, def.metric));
}

export function getActiveMissions(data: SavedGameData): MissionProgress[] {
  const dailySeed = Number(data.missionState.dailyKey.replace(/\D/g, '')) || 0;
  const dayMissions = getDailyMissions(dailySeed);
  const weeklySeed = Number(data.missionState.weeklyKey.replace(/\D/g, '').slice(-2)) || 0;
  const weeklyMissions = getWeeklyMissions(weeklySeed);
  const allDefs: MissionDef[] = [
    ...dayMissions,
    ...weeklyMissions,
    ...SECRET_MISSIONS,
    ...SPECIAL_MISSIONS,
  ];

  return allDefs.map((def) => {
    const periodKey = periodKeyFor(def.category, data.missionState);
    const key = `${def.category}:${periodKey}:${def.id}`;
    const progress = missionProgressValue(def, data.lifetimeStats, data.missionState);
    const claimed = data.missionState.claimed.includes(key);

    return {
      key,
      def,
      progress,
      claimed,
      complete: progress >= def.target,
    };
  });
}

export function claimMission(data: SavedGameData, missionKey: string): SavedGameData | null {
  const mission = getActiveMissions(data).find((entry) => entry.key === missionKey);
  if (!mission || !mission.complete || mission.claimed) return null;

  return {
    ...data,
    gold: data.gold + mission.def.rewardGold,
    accountXp: data.accountXp + mission.def.rewardXp,
    missionState: {
      ...data.missionState,
      claimed: [...data.missionState.claimed, mission.key],
    },
  };
}

export function evaluateAchievements(data: SavedGameData): { data: SavedGameData; unlocked: AchievementDef[] } {
  const unlocked: AchievementDef[] = [];
  let gold = data.gold;
  let accountXp = data.accountXp;
  const achievements = [...data.achievements];

  for (const achievement of ACHIEVEMENTS) {
    if (achievements.includes(achievement.id)) continue;
    if (getMetricValue(data.lifetimeStats, achievement.metric) < achievement.target) continue;

    achievements.push(achievement.id);
    gold += achievement.rewardGold;
    accountXp += achievement.rewardXp;
    unlocked.push(achievement);
  }

  if (unlocked.length === 0) return { data, unlocked };

  return {
    data: { ...data, gold, accountXp, achievements },
    unlocked,
  };
}

function ensureMissionWindows(data: SavedGameData): SavedGameData {
  const dailyKey = getDailyKey();
  const weeklyKey = getWeeklyKey();
  if (data.missionState.dailyKey === dailyKey && data.missionState.weeklyKey === weeklyKey) {
    return data;
  }

  return {
    ...data,
    missionState: {
      ...data.missionState,
      dailyKey,
      weeklyKey,
      dailyBaseline: data.missionState.dailyKey === dailyKey ? data.missionState.dailyBaseline : { ...data.lifetimeStats },
      weeklyBaseline: data.missionState.weeklyKey === weeklyKey ? data.missionState.weeklyBaseline : { ...data.lifetimeStats },
    },
  };
}

export function getRunAccountXp(run: RunRecord): number {
  const difficulty = getDifficulty(run.difficulty);
  const base =
    run.survivalTime * 1.5 +
    run.kills * 0.4 +
    run.level * 8 +
    run.bossesKilled * 120 +
    run.elitesKilled * 40 +
    run.relicsFound * 30;

  return Math.max(10, Math.floor(base * difficulty.accountXpMult));
}

export function applyRunToSave(data: SavedGameData, run: RunRecord): RunApplication {
  const base = ensureMissionWindows(data);
  const stats = base.lifetimeStats;
  const charactersPlayed = stats.charactersPlayed.includes(run.characterId)
    ? stats.charactersPlayed
    : [...stats.charactersPlayed, run.characterId];
  const winsByDifficulty = { ...stats.winsByDifficulty };

  if (run.won) {
    winsByDifficulty[run.difficulty] = (winsByDifficulty[run.difficulty] ?? 0) + 1;
  }

  const lifetimeStats: LifetimeStats = {
    ...stats,
    runs: stats.runs + 1,
    kills: stats.kills + run.kills,
    timeSurvived: stats.timeSurvived + run.survivalTime,
    bossesKilled: stats.bossesKilled + run.bossesKilled,
    elitesKilled: stats.elitesKilled + run.elitesKilled,
    goldEarned: stats.goldEarned + run.goldEarned,
    levelsGained: stats.levelsGained + Math.max(0, run.level - 1),
    evolutions: stats.evolutions + run.evolutions,
    relicsFound: stats.relicsFound + run.relicsFound,
    charactersPlayed,
    bestTime: Math.max(stats.bestTime, run.survivalTime),
    bestKills: Math.max(stats.bestKills, run.kills),
    bestRelics: Math.max(stats.bestRelics, run.relicsFound),
    highestLevel: Math.max(stats.highestLevel, run.level),
    winsByDifficulty,
  };

  const accountXpEarned = getRunAccountXp(run);
  const updated: SavedGameData = {
    ...base,
    accountXp: base.accountXp + accountXpEarned,
    lifetimeStats,
  };

  const evaluated = evaluateAchievements(updated);

  return {
    data: evaluated.data,
    accountXpEarned,
    unlockedAchievements: evaluated.unlocked,
  };
}

export function metricLabel(metric: ProgressMetric): string {
  const labels: Record<ProgressMetric, string> = {
    kills: 'abates',
    timeSurvived: 'segundos sobrevividos',
    bossesKilled: 'chefes derrotados',
    elitesKilled: 'elites derrotados',
    goldEarned: 'ouro coletado',
    runs: 'partidas',
    levelsGained: 'níveis ganhos',
    evolutions: 'evoluções',
    relicsFound: 'relíquias',
    charactersPlayed: 'personagens',
    bestTime: 'segundos (recorde)',
    bestKills: 'abates (recorde)',
    bestRelics: 'relíquias (recorde)',
    highestLevel: 'nível máximo',
    infernalWins: 'vitórias no Infernal',
    hardWins: 'vitórias em Difícil+',
    wins: 'vitórias',
  };
  return labels[metric] ?? metric;
}
