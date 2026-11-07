import { ProgressMetric } from './metrics';

export type MissionCategory = 'diaria' | 'semanal' | 'secreta' | 'especial';

export interface MissionDef {
  id: string;
  category: MissionCategory;
  title: string;
  description: string;
  metric: ProgressMetric;
  target: number;
  rewardGold: number;
  rewardXp: number;
  absolute?: boolean;
  secret?: boolean;
}

export interface MissionProgress {
  key: string;
  def: MissionDef;
  progress: number;
  claimed: boolean;
  complete: boolean;
}

export const DAILY_POOL: MissionDef[] = [
  {
    id: 'd_kills',
    category: 'diaria',
    title: 'Caçada Diária',
    description: 'Elimine 120 inimigos hoje.',
    metric: 'kills',
    target: 120,
    rewardGold: 80,
    rewardXp: 60,
  },
  {
    id: 'd_time',
    category: 'diaria',
    title: 'Fôlego do Dia',
    description: 'Sobreviva por 180 segundos no total hoje.',
    metric: 'timeSurvived',
    target: 180,
    rewardGold: 70,
    rewardXp: 55,
  },
  {
    id: 'd_elites',
    category: 'diaria',
    title: 'Elite do Dia',
    description: 'Derrote 2 inimigos de elite hoje.',
    metric: 'elitesKilled',
    target: 2,
    rewardGold: 110,
    rewardXp: 80,
  },
  {
    id: 'd_gold',
    category: 'diaria',
    title: 'Bolso Cheio',
    description: 'Colete 250 de ouro hoje.',
    metric: 'goldEarned',
    target: 250,
    rewardGold: 90,
    rewardXp: 60,
  },
  {
    id: 'd_runs',
    category: 'diaria',
    title: 'Rotina de Combate',
    description: 'Inicie 2 partidas hoje.',
    metric: 'runs',
    target: 2,
    rewardGold: 60,
    rewardXp: 45,
  },
];

export const WEEKLY_POOL: MissionDef[] = [
  {
    id: 'w_kills',
    category: 'semanal',
    title: 'Ceifador Semanal',
    description: 'Elimine 1200 inimigos nesta semana.',
    metric: 'kills',
    target: 1200,
    rewardGold: 400,
    rewardXp: 300,
  },
  {
    id: 'w_time',
    category: 'semanal',
    title: 'Maratona Noturna',
    description: 'Sobreviva por 900 segundos nesta semana.',
    metric: 'timeSurvived',
    target: 900,
    rewardGold: 380,
    rewardXp: 280,
  },
  {
    id: 'w_bosses',
    category: 'semanal',
    title: 'Caçador de Chefes',
    description: 'Derrote 3 chefes nesta semana.',
    metric: 'bossesKilled',
    target: 3,
    rewardGold: 500,
    rewardXp: 380,
  },
  {
    id: 'w_gold',
    category: 'semanal',
    title: 'Tesouro Semanal',
    description: 'Colete 2000 de ouro nesta semana.',
    metric: 'goldEarned',
    target: 2000,
    rewardGold: 450,
    rewardXp: 320,
  },
  {
    id: 'w_roster',
    category: 'semanal',
    title: 'Novos Estilos',
    description: 'Jogue com 4 personagens diferentes.',
    metric: 'charactersPlayed',
    target: 4,
    rewardGold: 420,
    rewardXp: 300,
    absolute: true,
  },
  {
    id: 'w_levels',
    category: 'semanal',
    title: 'Ascensão',
    description: 'Ganhe 25 níveis nesta semana.',
    metric: 'levelsGained',
    target: 25,
    rewardGold: 430,
    rewardXp: 310,
  },
];

export const SECRET_MISSIONS: MissionDef[] = [
  {
    id: 's_infernal',
    category: 'secreta',
    title: 'Coroa de Cinzas',
    description: 'Vença uma partida no modo Infernal.',
    metric: 'infernalWins',
    target: 1,
    rewardGold: 1200,
    rewardXp: 900,
    absolute: true,
    secret: true,
  },
  {
    id: 's_hard',
    category: 'secreta',
    title: 'Sangue Frio',
    description: 'Vença uma partida no Difícil, Pesadelo ou Infernal.',
    metric: 'hardWins',
    target: 1,
    rewardGold: 700,
    rewardXp: 500,
    absolute: true,
    secret: true,
  },
  {
    id: 's_relics',
    category: 'secreta',
    title: 'Colecionador do Abismo',
    description: 'Encontre 3 relíquias em uma única partida.',
    metric: 'bestRelics',
    target: 3,
    rewardGold: 800,
    rewardXp: 600,
    absolute: true,
    secret: true,
  },
  {
    id: 's_time',
    category: 'secreta',
    title: 'Além do Amanhecer',
    description: 'Sobreviva 8 minutos em uma única partida.',
    metric: 'bestTime',
    target: 480,
    rewardGold: 900,
    rewardXp: 650,
    absolute: true,
    secret: true,
  },
];

export const SPECIAL_MISSIONS: MissionDef[] = [
  {
    id: 'e_runs',
    category: 'especial',
    title: 'Veterano',
    description: 'Complete 5 partidas no total.',
    metric: 'runs',
    target: 5,
    rewardGold: 150,
    rewardXp: 120,
    absolute: true,
  },
  {
    id: 'e_evolve',
    category: 'especial',
    title: 'Evolução Suprema',
    description: 'Evolua uma arma pela primeira vez.',
    metric: 'evolutions',
    target: 1,
    rewardGold: 200,
    rewardXp: 160,
    absolute: true,
  },
  {
    id: 'e_relics',
    category: 'especial',
    title: 'Arsenal Reluzente',
    description: 'Encontre 5 relíquias no total.',
    metric: 'relicsFound',
    target: 5,
    rewardGold: 250,
    rewardXp: 180,
    absolute: true,
  },
  {
    id: 'e_bosses',
    category: 'especial',
    title: 'Lenda da Noite',
    description: 'Derrote 5 chefes no total.',
    metric: 'bossesKilled',
    target: 5,
    rewardGold: 300,
    rewardXp: 220,
    absolute: true,
  },
];

function pickFromPool(pool: MissionDef[], amount: number, seed: number): MissionDef[] {
  if (pool.length === 0) return [];
  const picked: MissionDef[] = [];
  const count = Math.min(amount, pool.length);
  const start = ((seed % pool.length) + pool.length) % pool.length;

  for (let i = 0; i < count; i++) {
    picked.push(pool[(start + i) % pool.length]);
  }

  return picked;
}

export function getDailyMissions(seed: number): MissionDef[] {
  return pickFromPool(DAILY_POOL, 3, seed);
}

export function getWeeklyMissions(seed: number): MissionDef[] {
  return pickFromPool(WEEKLY_POOL, 2, seed);
}
