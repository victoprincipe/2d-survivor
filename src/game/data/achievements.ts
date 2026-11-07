import { ProgressMetric } from './metrics';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  metric: ProgressMetric;
  target: number;
  rewardGold: number;
  rewardXp: number;
  hidden?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_blood',
    name: 'Primeiro Sangue',
    description: 'Elimine 10 inimigos.',
    metric: 'kills',
    target: 10,
    rewardGold: 40,
    rewardXp: 30,
  },
  {
    id: 'centurion',
    name: 'Centurião Noturno',
    description: 'Elimine 1000 inimigos no total.',
    metric: 'kills',
    target: 1000,
    rewardGold: 300,
    rewardXp: 220,
  },
  {
    id: 'survivor_3',
    name: 'Sobrevivente',
    description: 'Sobreviva 3 minutos em uma partida.',
    metric: 'bestTime',
    target: 180,
    rewardGold: 150,
    rewardXp: 120,
  },
  {
    id: 'survivor_5',
    name: 'Lenda do Amanhecer',
    description: 'Vença uma partida derrotando o chefe final.',
    metric: 'wins',
    target: 1,
    rewardGold: 400,
    rewardXp: 300,
  },
  {
    id: 'boss_slayer',
    name: 'Caçador de Chefes',
    description: 'Derrote 5 chefes no total.',
    metric: 'bossesKilled',
    target: 5,
    rewardGold: 350,
    rewardXp: 260,
  },
  {
    id: 'elite_hunter',
    name: 'Quebra-Elites',
    description: 'Derrote 10 inimigos de elite.',
    metric: 'elitesKilled',
    target: 10,
    rewardGold: 250,
    rewardXp: 180,
  },
  {
    id: 'evolutionist',
    name: 'Evolução Arcana',
    description: 'Evolua uma arma.',
    metric: 'evolutions',
    target: 1,
    rewardGold: 180,
    rewardXp: 140,
  },
  {
    id: 'relic_collector',
    name: 'Colecionador',
    description: 'Encontre 5 relíquias.',
    metric: 'relicsFound',
    target: 5,
    rewardGold: 260,
    rewardXp: 190,
  },
  {
    id: 'roster',
    name: 'Liga dos Sobreviventes',
    description: 'Jogue com 4 personagens diferentes.',
    metric: 'charactersPlayed',
    target: 4,
    rewardGold: 300,
    rewardXp: 220,
  },
  {
    id: 'gold_hoarder',
    name: 'Cofre Ambulante',
    description: 'Colete 5000 de ouro no total.',
    metric: 'goldEarned',
    target: 5000,
    rewardGold: 500,
    rewardXp: 360,
  },
  {
    id: 'nightmare',
    name: 'Pesadelo Vencido',
    description: 'Vença no modo Pesadelo ou superior.',
    metric: 'hardWins',
    target: 1,
    rewardGold: 700,
    rewardXp: 500,
    hidden: true,
  },
];
