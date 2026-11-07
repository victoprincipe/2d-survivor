import { ItemRarity, RelicConfig, RelicId } from '../types';

export const RELICS: RelicConfig[] = [
  {
    id: 'iron_ring',
    name: 'Anel de Ferro',
    description: '+2 de armadura. Um clássico que nunca falha.',
    rarity: 'comum',
    color: '#94a3b8',
    iconName: 'Shield',
    effects: { armor: 2 },
  },
  {
    id: 'swift_boots',
    name: 'Botas Velozes',
    description: '+12% de velocidade de movimento.',
    rarity: 'comum',
    color: '#38bdf8',
    iconName: 'Feather',
    effects: { speed: 0.12 },
  },
  {
    id: 'moon_charm',
    name: 'Amuleto da Lua',
    description: '+12% de dano global.',
    rarity: 'rara',
    color: '#a78bfa',
    iconName: 'Sparkles',
    effects: { might: 0.12 },
  },
  {
    id: 'sapphire_lens',
    name: 'Lente Safira',
    description: '+20% de experiência e +15 de raio de coleta.',
    rarity: 'rara',
    color: '#60a5fa',
    iconName: 'Compass',
    effects: { xpMultiplier: 0.2, pickupRadius: 15 },
  },
  {
    id: 'blood_chalice',
    name: 'Cálice de Sangue',
    description: '+35 de vida máxima e regeneração de 0.6 HP/s.',
    rarity: 'epica',
    color: '#fb7185',
    iconName: 'Heart',
    effects: { maxHp: 35, recoveryPerSec: 0.6 },
  },
  {
    id: 'storm_coil',
    name: 'Espiral da Tempestade',
    description: '-12% de recarga de armas e +8% de velocidade.',
    rarity: 'epica',
    color: '#22d3ee',
    iconName: 'Zap',
    effects: { cooldownReduction: 0.12, speed: 0.08 },
  },
  {
    id: 'phoenix_ember',
    name: 'Brasa da Fênix',
    description: '+22% de dano, +2 de armadura e +10% de ouro.',
    rarity: 'lendaria',
    color: '#f97316',
    iconName: 'Flame',
    effects: { might: 0.22, armor: 2, goldMultiplier: 0.1 },
  },
  {
    id: 'void_heart',
    name: 'Coração do Vazio',
    description: '+50 de vida máxima, +20% de XP e +25 de coleta.',
    rarity: 'lendaria',
    color: '#c084fc',
    iconName: 'Heart',
    effects: { maxHp: 50, xpMultiplier: 0.2, pickupRadius: 25 },
  },
];

const RARITY_WEIGHT: Record<ItemRarity, number> = {
  comum: 50,
  rara: 28,
  epica: 15,
  lendaria: 7,
};

export const RARITY_LABEL: Record<ItemRarity, string> = {
  comum: 'Comum',
  rara: 'Rara',
  epica: 'Épica',
  lendaria: 'Lendária',
};

export const RARITY_COLOR: Record<ItemRarity, string> = {
  comum: '#94a3b8',
  rara: '#38bdf8',
  epica: '#a855f7',
  lendaria: '#f59e0b',
};

export function getRelic(id: RelicId): RelicConfig {
  return RELICS.find((relic) => relic.id === id) ?? RELICS[0];
}

export function rollRelic(ownedIds: RelicId[]): RelicConfig | undefined {
  const available = RELICS.filter((relic) => !ownedIds.includes(relic.id));
  if (available.length === 0) return undefined;

  const totalWeight = available.reduce((total, relic) => total + RARITY_WEIGHT[relic.rarity], 0);
  let roll = Math.random() * totalWeight;

  for (let i = 0; i < available.length; i++) {
    roll -= RARITY_WEIGHT[available[i].rarity];
    if (roll <= 0) return available[i];
  }

  return available[available.length - 1];
}
