import { CharacterConfig } from '../types';

export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'antonio',
    name: 'Antonio Belpaese',
    title: 'Caçador de Vampiros',
    description: 'Especialista no chicote tradicional. Possui mais vida e força bruta.',
    startingWeapon: 'whip',
    color: '#e63946',
    portraitColor: '#800f2f',
    statBonuses: {
      maxHp: 20,
      might: 0.15,
      armor: 1,
    },
  },
  {
    id: 'imelda',
    name: 'Imelda Belpaese',
    title: 'Maga Arcana',
    description: 'Estudiosa das artes místicas. Ganha mais experiência e recarrega feitiços mais rápido.',
    startingWeapon: 'wand',
    color: '#4361ee',
    portraitColor: '#1d3557',
    statBonuses: {
      xpMultiplier: 0.25,
      cooldownReduction: 0.1,
      speed: 0.05,
    },
  },
  {
    id: 'gennaro',
    name: 'Gennaro Belpaese',
    title: 'Mestre das Lâminas',
    description: 'Arremessa adagas perfurantes na direção do movimento com extrema agilidade.',
    startingWeapon: 'knife',
    color: '#2a9d8f',
    portraitColor: '#264653',
    statBonuses: {
      speed: 0.2,
      might: 0.05,
      pickupRadius: 20,
    },
  },
];
