import {
  MissionDefinition,
  MissionMetric,
  MissionProgressBucket,
  MissionRunStats,
  MissionSaveState,
  SavedGameData,
} from '../types';

const DAY_MS = 86_400_000;
export const DAILY_MISSION_COUNT = 4;
export const SECRET_PERIOD_KEY = 'lifetime';

export const DAILY_POOL: MissionDefinition[] = [
  { id: 'daily_kills_250', period: 'daily', title: 'Caçada Diária', description: 'Elimine 250 inimigos.', metric: 'kills', target: 250, goldReward: 120, xpReward: 40 },
  { id: 'daily_kills_500', period: 'daily', title: 'Extermínio', description: 'Elimine 500 inimigos.', metric: 'kills', target: 500, goldReward: 220, xpReward: 70 },
  { id: 'daily_kills_750', period: 'daily', title: 'Massacre', description: 'Elimine 750 inimigos.', metric: 'kills', target: 750, goldReward: 320, xpReward: 110 },
  { id: 'daily_survive_600', period: 'daily', title: 'Fôlego', description: 'Acumule 10 minutos de sobrevivência.', metric: 'survivalSeconds', target: 600, goldReward: 120, xpReward: 40 },
  { id: 'daily_survive_900', period: 'daily', title: 'Resistência', description: 'Acumule 15 minutos de sobrevivência.', metric: 'survivalSeconds', target: 900, goldReward: 180, xpReward: 60 },
  { id: 'daily_gold_300', period: 'daily', title: 'Coleta de Ouro', description: 'Colete 300 de ouro em partidas.', metric: 'goldCollected', target: 300, goldReward: 100, xpReward: 35 },
  { id: 'daily_bosses_3', period: 'daily', title: 'Caçador de Chefes', description: 'Derrote 3 chefes.', metric: 'bossesDefeated', target: 3, goldReward: 250, xpReward: 80 },
  { id: 'daily_wins_2', period: 'daily', title: 'Vitórias Diárias', description: 'Vença 2 partidas.', metric: 'wins', target: 2, goldReward: 300, xpReward: 100 },
];

export const WEEKLY_MISSIONS: MissionDefinition[] = [
  { id: 'weekly_kills_10000', period: 'weekly', title: 'Legião Dizimada', description: 'Elimine 10.000 inimigos.', metric: 'kills', target: 10000, goldReward: 1500, xpReward: 500 },
  { id: 'weekly_bosses_10', period: 'weekly', title: 'Senhor da Caçada', description: 'Derrote 10 chefes.', metric: 'bossesDefeated', target: 10, goldReward: 1200, xpReward: 400 },
  { id: 'weekly_wins_5', period: 'weekly', title: 'Conquistador', description: 'Vença 5 partidas.', metric: 'wins', target: 5, goldReward: 2000, xpReward: 750 },
];

export const SECRET_MISSIONS: MissionDefinition[] = [
  { id: 'secret_kills_5000', period: 'secret', title: 'Caçador Lendário', description: 'Elimine 5.000 inimigos no total.', metric: 'kills', target: 5000, goldReward: 800, xpReward: 300, secret: true },
  { id: 'secret_bosses_25', period: 'secret', title: 'Carrasco de Chefes', description: 'Derrote 25 chefes no total.', metric: 'bossesDefeated', target: 25, goldReward: 1000, xpReward: 350, secret: true },
  { id: 'secret_wins_10', period: 'secret', title: 'Lenda Imortal', description: 'Vença 10 partidas no total.', metric: 'wins', target: 10, goldReward: 1500, xpReward: 500, secret: true },
];

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function getDailyKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function getWeeklyKey(date: Date = new Date()): string {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  return `week-${getDailyKey(monday)}`;
}

export function getDailyMissions(date: Date = new Date()): MissionDefinition[] {
  const dayIndex = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS
  );
  const start = ((dayIndex % DAILY_POOL.length) + DAILY_POOL.length) % DAILY_POOL.length;
  return Array.from(
    { length: Math.min(DAILY_MISSION_COUNT, DAILY_POOL.length) },
    (_, index) => DAILY_POOL[(start + index) % DAILY_POOL.length]
  );
}

export function getActiveMissions(date: Date = new Date()) {
  return {
    daily: getDailyMissions(date),
    weekly: WEEKLY_MISSIONS,
    secret: SECRET_MISSIONS,
  };
}

function createBucket(periodKey: string): MissionProgressBucket {
  return { periodKey, progress: {}, claimed: [] };
}

interface BucketCandidate {
  periodKey?: unknown;
  progress?: unknown;
  claimed?: unknown;
}

function sanitizeProgress(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const progress: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) progress[key] = parsed;
  }
  return progress;
}

function sanitizeClaimed(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

function normalizeBucket(
  raw: unknown,
  periodKey: string,
  resetOnPeriodChange: boolean
): MissionProgressBucket {
  if (!raw || typeof raw !== 'object') return createBucket(periodKey);
  const candidate = raw as BucketCandidate;
  if (resetOnPeriodChange && candidate.periodKey !== periodKey) return createBucket(periodKey);
  return {
    periodKey,
    progress: sanitizeProgress(candidate.progress),
    claimed: sanitizeClaimed(candidate.claimed),
  };
}

export function createInitialMissionState(date: Date = new Date()): MissionSaveState {
  return {
    daily: createBucket(getDailyKey(date)),
    weekly: createBucket(getWeeklyKey(date)),
    secret: createBucket(SECRET_PERIOD_KEY),
  };
}

export function normalizeMissionState(
  raw: unknown,
  date: Date = new Date()
): MissionSaveState {
  const candidate: Record<string, unknown> =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    daily: normalizeBucket(candidate.daily, getDailyKey(date), true),
    weekly: normalizeBucket(candidate.weekly, getWeeklyKey(date), true),
    secret: normalizeBucket(candidate.secret, SECRET_PERIOD_KEY, false),
  };
}

function getMetricValue(run: MissionRunStats, metric: MissionMetric): number {
  const value = run[metric];
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function getMissionProgress(
  missions: MissionSaveState,
  mission: MissionDefinition
): number {
  const value = missions[mission.period].progress[mission.id] ?? 0;
  return Math.max(0, Math.min(mission.target, value));
}

export function isMissionClaimed(
  missions: MissionSaveState,
  mission: MissionDefinition
): boolean {
  return missions[mission.period].claimed.includes(mission.id);
}

export function isMissionComplete(
  missions: MissionSaveState,
  mission: MissionDefinition
): boolean {
  return getMissionProgress(missions, mission) >= mission.target;
}

export function applyRunToMissions(
  data: SavedGameData,
  run: MissionRunStats,
  date: Date = new Date()
): SavedGameData {
  const missions = normalizeMissionState(data.missions, date);
  const active = getActiveMissions(date);

  const updateBucket = (
    bucket: MissionProgressBucket,
    definitions: MissionDefinition[]
  ): MissionProgressBucket => {
    const progress = { ...bucket.progress };
    for (const mission of definitions) {
      if (bucket.claimed.includes(mission.id)) continue;
      const gained = getMetricValue(run, mission.metric);
      if (gained <= 0) continue;
      const current = progress[mission.id] ?? 0;
      progress[mission.id] = Math.min(mission.target, current + gained);
    }
    return { ...bucket, progress };
  };

  return {
    ...data,
    missions: {
      daily: updateBucket(missions.daily, active.daily),
      weekly: updateBucket(missions.weekly, active.weekly),
      secret: updateBucket(missions.secret, active.secret),
    },
  };
}

export function claimMissionReward(
  data: SavedGameData,
  missionId: string,
  date: Date = new Date()
): { data: SavedGameData; claimed: boolean } {
  const missions = normalizeMissionState(data.missions, date);
  const active = getActiveMissions(date);
  const mission = [...active.daily, ...active.weekly, ...active.secret].find(
    (item) => item.id === missionId
  );
  const normalizedData: SavedGameData = { ...data, missions };

  if (!mission) return { data: normalizedData, claimed: false };

  const bucket = missions[mission.period];
  const progress = bucket.progress[mission.id] ?? 0;
  if (progress < mission.target || bucket.claimed.includes(mission.id)) {
    return { data: normalizedData, claimed: false };
  }

  const updatedBucket: MissionProgressBucket = {
    ...bucket,
    claimed: [...bucket.claimed, mission.id],
  };
  const updatedMissions: MissionSaveState = {
    daily: mission.period === 'daily' ? updatedBucket : missions.daily,
    weekly: mission.period === 'weekly' ? updatedBucket : missions.weekly,
    secret: mission.period === 'secret' ? updatedBucket : missions.secret,
  };

  return {
    data: {
      ...normalizedData,
      gold: Math.max(0, normalizedData.gold ?? 0) + mission.goldReward,
      accountXp: Math.max(0, normalizedData.accountXp ?? 0) + mission.xpReward,
      missions: updatedMissions,
    },
    claimed: true,
  };
}

export function countClaimableMissions(
  data: SavedGameData,
  date: Date = new Date()
): number {
  const missions = normalizeMissionState(data.missions, date);
  const active = getActiveMissions(date);
  return [...active.daily, ...active.weekly, ...active.secret].filter(
    (mission) => isMissionComplete(missions, mission) && !isMissionClaimed(missions, mission)
  ).length;
}

export function getAccountLevel(accountXp: number): number {
  const safeXp = Number.isFinite(accountXp) ? Math.max(0, accountXp) : 0;
  return 1 + Math.floor(Math.sqrt(safeXp / 100));
}

export function formatMissionProgress(metric: MissionMetric, value: number): string {
  const safeValue = Math.max(0, Math.floor(value));
  if (metric === 'survivalSeconds') {
    const minutes = Math.floor(safeValue / 60);
    const seconds = safeValue % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return safeValue.toLocaleString('pt-BR');
}
