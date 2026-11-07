import { AmazonEnemyType, EnemyType } from '../types';

export const AMAZON_BASIC_ENEMIES: AmazonEnemyType[] = [
  'bullet_ant',
  'leafcutter_ant',
  'blue_butterfly',
  'cicada',
  'piranha',
];

export const AMAZON_MEDIUM_ENEMIES: AmazonEnemyType[] = [
  'poison_frog',
  'mantis',
  'stick_insect',
  'toucan',
  'pink_dolphin',
];

export const AMAZON_RESISTANT_ENEMIES: AmazonEnemyType[] = [
  'capybara',
  'sloth',
  'rhino_beetle',
  'longhorn_beetle',
  'giant_centipede',
  'giant_otter',
];

export const AMAZON_ELITE_ENEMIES: AmazonEnemyType[] = [
  'jaguar',
  'tapir',
  'goliath_spider',
  'black_caiman',
];

export const AMAZON_WATER_ENEMIES: AmazonEnemyType[] = [
  'piranha',
  'pink_dolphin',
  'giant_otter',
  'black_caiman',
];

const AMAZON_WATER_SET = new Set<EnemyType>(AMAZON_WATER_ENEMIES);

export function isAmazonWaterEnemy(type: EnemyType): boolean {
  return AMAZON_WATER_SET.has(type);
}
