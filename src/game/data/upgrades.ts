import { WeaponId, PassiveId, EvolvedWeaponId } from '../types';

export interface WeaponMeta {
  id: WeaponId;
  name: string;
  description: string;
  maxLevel: number;
  iconName: string;
  synergyPassive: PassiveId;
  evolvedId: EvolvedWeaponId;
  evolvedName: string;
  evolvedDescription: string;
  levelDescriptions: string[];
}

export interface PassiveMeta {
  id: PassiveId;
  name: string;
  description: string;
  maxLevel: number;
  iconName: string;
  synergyWeapon: WeaponId;
  levelDescriptions: string[];
}

export const WEAPON_REGISTRY: Record<WeaponId, WeaponMeta> = {
  whip: {
    id: 'whip',
    name: 'Chicote',
    description: 'Golpeia horizontalmente perfurando inimigos.',
    maxLevel: 5,
    iconName: 'Flame',
    synergyPassive: 'heart',
    evolvedId: 'bloody_tear',
    evolvedName: 'Lágrima Sangrenta',
    evolvedDescription: 'Golpes críticos devastadores que regeneram HP ao acertar.',
    levelDescriptions: [
      'Golpeia horizontalmente perfurando inimigos.',
      'Dano base +25% e área de corte ampliada.',
      'Atinge também para trás simultaneamente!',
      'Dano base +30% e recarga acelerada.',
      'Área massiva e acertos duplos.',
    ],
  },
  wand: {
    id: 'wand',
    name: 'Varinha Mágica',
    description: 'Dispara mísseis mágicos no inimigo mais próximo.',
    maxLevel: 5,
    iconName: 'Wand2',
    synergyPassive: 'tome',
    evolvedId: 'holy_wand',
    evolvedName: 'Varinha Sagrada',
    evolvedDescription: 'Dispara rajadas mágicas ininterruptas sem tempo de recarga.',
    levelDescriptions: [
      'Dispara 1 míssil mágico no inimigo mais próximo.',
      'Dispara +1 míssil simultâneo.',
      'Dano aumentado em +20% e velocidade de tiro maior.',
      'Dispara +1 míssil simultâneo (total 3).',
      'Tempo de recarga reduzido em -25% e dano +30%.',
    ],
  },
  knife: {
    id: 'knife',
    name: 'Facas de Arremesso',
    description: 'Arremessa adagas perfurantes na direção que você anda/olha.',
    maxLevel: 5,
    iconName: 'Sword',
    synergyPassive: 'bracer',
    evolvedId: 'thousand_edge',
    evolvedName: 'Mil Lâminas',
    evolvedDescription: 'Torrente infinita de adagas de alta velocidade perfurando qualquer monstro.',
    levelDescriptions: [
      'Dispara 1 adaga rápida na direção do movimento.',
      'Dispara +1 adaga em leque.',
      'Projéteis perfuram 1 inimigo adicional.',
      'Dispara +1 adaga (total 3 em cone).',
      'Velocidade dobrada e dano +40%.',
    ],
  },
  bow: {
    id: 'bow',
    name: 'Arco do Amazonas',
    description: 'Dispara flechas certeiras no inimigo mais próximo.',
    maxLevel: 5,
    iconName: 'BowArrow',
    synergyPassive: 'bracer',
    evolvedId: 'arrow_storm',
    evolvedName: 'Tempestade de Flechas',
    evolvedDescription: 'Flechas velozes em rajada que atravessam hordas inteiras.',
    levelDescriptions: [
      'Dispara 1 flecha certeira no inimigo mais próximo.',
      'Dano da flecha aumentado.',
      'Flechas perfuram 1 inimigo adicional.',
      'Dispara +1 flecha simultânea.',
      'Dano aumentado e perfuração ampliada.',
    ],
  },
  bible: {
    id: 'bible',
    name: 'Bíblia Sagrada',
    description: 'Livros sagrados orbitam ao redor do jogador repelindo inimigos.',
    maxLevel: 5,
    iconName: 'BookOpen',
    synergyPassive: 'magnet',
    evolvedId: 'unholy_vespers',
    evolvedName: 'Vésperas Profanas',
    evolvedDescription: 'Círculo perpétuo de tomos negros que nunca desaparecem.',
    levelDescriptions: [
      '1 livro sagrado gira ao redor do jogador.',
      '+1 livro em órbita (total 2).',
      'Velocidade de rotação e área +30%.',
      '+1 livro em órbita (total 3) e duração aumentada.',
      'Dano aumentado em +40% e repulsão intensificada.',
    ],
  },
  garlic: {
    id: 'garlic',
    name: 'Aura de Alho',
    description: 'Dano em área contínuo a inimigos próximos e repele hordas fracas.',
    maxLevel: 5,
    iconName: 'Shield',
    synergyPassive: 'spinach',
    evolvedId: 'soul_eater',
    evolvedName: 'Devorador de Almas',
    evolvedDescription: 'Aura de trevas gigante que drena vida e explode inimigos.',
    levelDescriptions: [
      'Cria uma aura protetora de dano contínuo.',
      'Área da aura aumentada em +25%.',
      'Dano aumentado em +35% e recuo mais forte.',
      'Área aumentada em +25% adicional.',
      'Reduz a resistência a dano dos inimigos tocados.',
    ],
  },
  lightning: {
    id: 'lightning',
    name: 'Anel do Trovão',
    description: 'Relâmpagos caem dos céus acertando inimigos aleatórios na tela.',
    maxLevel: 5,
    iconName: 'Zap',
    synergyPassive: 'wings',
    evolvedId: 'thunder_loop',
    evolvedName: 'Loop do Trovão',
    evolvedDescription: 'Tempestades de relâmpagos duplicados que provocam explosões em cadeia.',
    levelDescriptions: [
      '1 relâmpago atinge um inimigo aleatório com dano massivo.',
      'Atinge +1 alvo simultâneo.',
      'Área de impacto elétrico aumentada em +30%.',
      'Atinge +1 alvo simultâneo (total 3).',
      'Dano aumentado em +50% com explosão residual.',
    ],
  },
  derson_combo: {
    id: 'derson_combo',
    name: 'Combo do Derson',
    description: 'Arremessa aleatoriamente pão de queijo, café em espiral ou fatias de bolo.',
    maxLevel: 5,
    iconName: 'Utensils',
    synergyPassive: 'bracer',
    evolvedId: 'derson_banquet',
    evolvedName: 'Banquete do Derson',
    evolvedDescription: 'O entregador serve um banquete completo com petiscos mais fortes e perfurantes.',
    levelDescriptions: [
      'Sorteia entre pão de queijo veloz, café em espiral ou 3 fatias de bolo em leque.',
      'Petiscos causam mais dano.',
      'O café atravessa 1 inimigo adicional.',
      'Mais dano e leque do bolo mais aberto.',
      'O café atravessa mais inimigos e os petiscos ficam velozes.',
    ],
  },
  syringe: {
    id: 'syringe',
    name: 'Seringas',
    description: 'Dispara seringas tranquilizantes nos inimigos mais próximos.',
    maxLevel: 5,
    iconName: 'Syringe',
    synergyPassive: 'tome',
    evolvedId: 'supreme_serum',
    evolvedName: 'Soro Supremo',
    evolvedDescription: 'Seringas gigantes de soro que perfuram e enfraquecem hordas inteiras.',
    levelDescriptions: [
      'Dispara 1 seringa certeira no inimigo mais próximo.',
      'Dispara +1 seringa simultânea.',
      'As seringas perfuram 1 inimigo adicional.',
      'Dispara +1 seringa simultânea (total 3).',
      'Seringas mais rápidas, dano +35% e perfuração ampliada.',
    ],
  },
};

export const PASSIVE_REGISTRY: Record<PassiveId, PassiveMeta> = {
  spinach: {
    id: 'spinach',
    name: 'Espinafre de Ferro',
    description: 'Aumenta o dano de todos os seus ataques.',
    maxLevel: 5,
    iconName: 'Sparkles',
    synergyWeapon: 'garlic',
    levelDescriptions: [
      'Aumenta o dano causado em +10%.',
      'Aumenta o dano causado em +20% (total).',
      'Aumenta o dano causado em +30% (total).',
      'Aumenta o dano causado em +40% (total).',
      'Aumenta o dano causado em +50% (total).',
    ],
  },
  wings: {
    id: 'wings',
    name: 'Asas da Rapidez',
    description: 'Aumenta a velocidade de movimento do personagem.',
    maxLevel: 5,
    iconName: 'Feather',
    synergyWeapon: 'lightning',
    levelDescriptions: [
      'Velocidade de movimento +10%.',
      'Velocidade de movimento +20% (total).',
      'Velocidade de movimento +30% (total).',
      'Velocidade de movimento +40% (total).',
      'Velocidade de movimento +50% (total).',
    ],
  },
  heart: {
    id: 'heart',
    name: 'Coração Sagrado',
    description: 'Aumenta a vida máxima e regenera HP.',
    maxLevel: 5,
    iconName: 'Heart',
    synergyWeapon: 'whip',
    levelDescriptions: [
      '+20% HP Máximo e cura instantânea.',
      '+20% HP Máximo e regeneração de 1 HP/s.',
      '+20% HP Máximo e regeneração aprimorada.',
      '+20% HP Máximo e cura de emergência.',
      '+20% HP Máximo (total +100%) e vida imensa.',
    ],
  },
  tome: {
    id: 'tome',
    name: 'Tomo Vazio',
    description: 'Reduz o tempo de recarga de todas as suas armas.',
    maxLevel: 5,
    iconName: 'Clock',
    synergyWeapon: 'wand',
    levelDescriptions: [
      'Recarga de armas -8%.',
      'Recarga de armas -16% (total).',
      'Recarga de armas -24% (total).',
      'Recarga de armas -32% (total).',
      'Recarga de armas -40% (total)! Disparos velozes.',
    ],
  },
  magnet: {
    id: 'magnet',
    name: 'Ímã de Almas',
    description: 'Aumenta o raio de atração para coletar gemas e itens.',
    maxLevel: 5,
    iconName: 'Compass',
    synergyWeapon: 'bible',
    levelDescriptions: [
      'Raio de coleta +30%.',
      'Raio de coleta +60% (total).',
      'Raio de coleta +90% (total).',
      'Raio de coleta +120% (total).',
      'Raio de coleta +150%! Puxa gemas de quase toda a tela.',
    ],
  },
  bracer: {
    id: 'bracer',
    name: 'Braçadeira de Precisão',
    description: 'Aumenta a velocidade e perfuração de todos os projéteis.',
    maxLevel: 5,
    iconName: 'Crosshair',
    synergyWeapon: 'knife',
    levelDescriptions: [
      'Velocidade de projéteis +15%.',
      'Velocidade de projéteis +30% (total).',
      'Velocidade de projéteis +45% (total).',
      'Velocidade de projéteis +60% (total).',
      'Velocidade de projéteis +75% (total).',
    ],
  },
};
