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

/** Ten-level descriptions used by the Amazon Forest catalogue (levels 1–10). */
const levels10 = (format: (level: number) => string): string[] =>
  Array.from({ length: 10 }, (_, index) => format(index + 1));

export const WEAPON_REGISTRY: Record<WeaponId, WeaponMeta> = {
  bottle_51: {
    id: 'bottle_51',
    name: 'Garrafa de 51',
    description: 'Arremessa garrafas de 51 que se quebram em estilhaços, causando dano em área.',
    maxLevel: 8,
    iconName: 'Bottle51',
    synergyPassive: 'duplicator',
    evolvedId: 'rain_51',
    evolvedName: 'Chuva de 51',
    evolvedDescription: 'Uma chuva de 7 garrafas por ataque, com impactos mais fortes, área maior e recarga acelerada!',
    levelDescriptions: [
      'Lança 1 garrafa de 51 no inimigo mais próximo: 25 de dano em área.',
      'Dano dos estilhaços aumentado para 32.',
      'Lança +1 garrafa por ataque (base 2).',
      'Dano aumentado para 40 e raio de impacto para 55.',
      'Dano aumentado para 48 e recarga reduzida para 2,1s.',
      'Lança +1 garrafa por ataque (base 3).',
      'Dano aumentado para 58 e raio de impacto para 65.',
      'Lança 4 garrafas, com 68 de dano e recarga de 1,8s!',
    ],
  },
  bow: {
    id: 'bow',
    name: 'Arco do Amazonas',
    description: 'Balista pesada que prioriza automaticamente os inimigos mais próximos ao alcance.',
    maxLevel: 5,
    iconName: 'BowArrow',
    synergyPassive: 'hunter_mark',
    evolvedId: 'arrow_storm',
    evolvedName: 'Flecha Titânica',
    evolvedDescription: 'Arpões dourados de perfuração infinita que detonam ondas de choque esmeralda em Elites.',
    levelDescriptions: [
      'Mira no alvo mais próximo e dispara uma flecha pesada que atravessa 4 inimigos.',
      'Dano aumentado em +35% e maior impacto de recuo.',
      'Atravessa até 7 inimigos com +25% de bônus crítico.',
      'Dispara +1 flecha pesada simultânea.',
      'Perfuração quase ilimitada na linha de tiro e recarga acelerada!',
    ],
  },
  bible: {
    id: 'bible',
    name: 'Bíblia Sagrada',
    description: 'Tomos sagrados orbitam em ciclos temporizados repelindo quem tenta se aproximar.',
    maxLevel: 5,
    iconName: 'BookOpen',
    synergyPassive: 'hourglass',
    evolvedId: 'unholy_vespers',
    evolvedName: 'Vésperas Profanas',
    evolvedDescription: 'Anel perpétuo de 6 tomos profanos que jamais desaparecem.',
    levelDescriptions: [
      '1 tomo sagrado orbita o jogador em ciclos de proteção.',
      '+1 tomo em órbita (base 2) e mais dano.',
      'Velocidade de rotação e raio orbital +25%.',
      '+1 tomo (base 3) e duração ativa ampliada.',
      '+1 tomo (base 4) com intervalo de recarga mínimo!',
    ],
  },
  lightning: {
    id: 'lightning',
    name: 'Anel do Trovão',
    description: 'Relâmpagos atingem grupos visíveis na tela e saltam em cadeia elétrica.',
    maxLevel: 5,
    iconName: 'Zap',
    synergyPassive: 'duplicator',
    evolvedId: 'thunder_loop',
    evolvedName: 'Loop do Trovão',
    evolvedDescription: 'Cada trovão dispara uma 2ª descarga atrasada e encadeia raios por até 4 inimigos.',
    levelDescriptions: [
      'Desfere 1 relâmpago explosivo sobre inimigos visíveis.',
      '+1 relâmpago simultâneo por tempestade.',
      'Área +30% e o raio salta em cadeia para 1 inimigo próximo!',
      '+1 relâmpago simultâneo (base 3) e mais dano.',
      'Salta para 2 vizinhos e deixa campo estático eletrizado no solo!',
    ],
  },
  derson_combo: {
    id: 'derson_combo',
    name: 'Combo do Derson',
    description: 'Sequência gastronômica 1-2-3: Pão de Queijo ricocheteante, Café espiral móvel e Bolo explosivo.',
    maxLevel: 5,
    iconName: 'Utensils',
    synergyPassive: 'wings',
    evolvedId: 'derson_banquet',
    evolvedName: 'Banquete do Derson',
    evolvedDescription: 'Serve o cardápio inteiro de uma só vez: pães, café escaldante e fatias de bolo juntos!',
    levelDescriptions: [
      'Alterna: 3 pães de queijo com ricochete, café em espiral que te segue e 3 fatias de bolo.',
      'Dano de todos os pratos +25% e +1 ricochete no pão de queijo.',
      'O café gira por mais tempo perfurando mais alvos.',
      'As fatias de bolo explodem glacê em área maior e +1 pão de queijo.',
      'Recarga acelerada e todo o combo atinge força máxima!',
    ],
  },
  flying_tray: {
    id: 'flying_tray',
    name: 'Bandeja Bumerangue',
    description: 'Arremessa bandejas inox que giram no ar e retornam rasgando a tela inteira.',
    maxLevel: 5,
    iconName: 'ConciergeBell',
    synergyPassive: 'magnet',
    evolvedId: 'infinite_rodizio',
    evolvedName: 'Rodízio Infinito',
    evolvedDescription: 'Bandejas douradas gigantes que emitem ondas de choque sempre que cruzam o atendente.',
    levelDescriptions: [
      'Lança 1 bandeja giratória que para, fatia no pico e volta atravessando você.',
      'Lança +1 bandeja em direção complementar.',
      'Raio de corte +25% e maior tempo fatiando antes de voltar.',
      'Dano +35% na trajetória de retorno em alta velocidade.',
      'Lança +1 bandeja (base 3) com recarga reduzida!',
    ],
  },
  syringe: {
    id: 'syringe',
    name: 'Seringa Epidêmica',
    description: 'Injeta sedativo desacelerador e veneno clínico que se espalha entre monstros.',
    maxLevel: 5,
    iconName: 'Syringe',
    synergyPassive: 'bio_shield',
    evolvedId: 'supreme_serum',
    evolvedName: 'Soro Supremo',
    evolvedDescription: 'Lanças bioquímicas que perfuram hordas e liberam nuvens corrosivas persistentes.',
    levelDescriptions: [
      'Dispara 1 seringa que aplica 35% de Lentidão e Veneno contínuo.',
      'Dispara +1 seringa priorizando alvos ainda saudáveis.',
      'Perfura +1 inimigo e o Veneno causa +40% de dano.',
      'Dispara +1 seringa simultânea (base 3).',
      'Contágio: inimigos que morrem infectados espalham Veneno e Lentidão em área!',
    ],
  },
  fire_flask: {
    id: 'fire_flask',
    name: 'Frasco Incendiário',
    description: 'Arremessa frascos alquímicos que incendeiam o chão criando zonas de dano contínuo.',
    maxLevel: 5,
    iconName: 'FlaskConical',
    synergyPassive: 'lantern',
    evolvedId: 'purifying_blaze',
    evolvedName: 'Chama Purificadora',
    evolvedDescription: 'Zonas de fogo azul-solar gigantes que avançam lentamente rumo ao jogador.',
    levelDescriptions: [
      'Arremessa 1 frasco que cria uma poça de fogo grego por 3s.',
      'Raio da zona incendiada aumentado em +25%.',
      'Arremessa +1 frasco simultâneo.',
      'Duração do fogo +35% e dano de queimadura ampliado.',
      'Arremessa +1 frasco (base 3) com recarga reduzida!',
    ],
  },
  executioner_axe: {
    id: 'executioner_axe',
    name: 'Machado Ceifador',
    description: 'Lança machados pesados em parábola vertical com altíssimo dano crítico.',
    maxLevel: 5,
    iconName: 'Axe',
    synergyPassive: 'clover',
    evolvedId: 'death_spiral',
    evolvedName: 'Espiral da Morte',
    evolvedDescription: 'Dispara 7 foices espectrais em estrela radial 360° atravessando toda a arena.',
    levelDescriptions: [
      'Arremessa 1 machado pesado em arco parabólico (+20% Crítico).',
      'Arremessa +1 machado em arco.',
      'Perfura +2 inimigos e aumenta o tamanho da lâmina em +25%.',
      'Arremessa +1 machado (base 3) e mais dano base.',
      'Perfuração massiva e golpes críticos devastadores!',
    ],
  },
  lula_power: {
    id: 'lula_power',
    name: 'Poder do L',
    description: 'Lula ergue o braço no gesto do L e libera uma onda de energia vermelha que atinge os inimigos ao redor.',
    maxLevel: 5,
    iconName: 'Hand',
    synergyPassive: 'spinach',
    evolvedId: 'poder_do_l_maximo',
    evolvedName: 'Poder do L Máximo',
    evolvedDescription: 'Onda carmesim avassaladora que varre a arena com dano e repulsão massivos.',
    levelDescriptions: [
      'Ergue o braço e libera uma onda vermelha (35 de dano, raio 150).',
      'Dano da onda aumentado para 45 e raio para 165.',
      'Dano 55, raio 180 e onda mais densa.',
      'Dano 68 e raio 200.',
      'Dano 82, raio 225 e recarga reduzida!',
    ],
  },
  garras_onca: {
    id: 'garras_onca',
    name: 'Garras de Onça',
    description: 'Golpes curtos e ferozes de onça rasgam tudo à frente do herói.',
    maxLevel: 10,
    iconName: 'Swords',
    synergyPassive: 'coracao_jacare',
    evolvedId: 'garras_onca',
    evolvedName: 'Garras de Onça',
    evolvedDescription: 'Golpes curtos e ferozes de onça rasgam tudo à frente do herói.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: 3 garras em cone com ${16 + lv * 4} de dano e sangramento.`
    ),
  },
  espinhos_pupunha: {
    id: 'espinhos_pupunha',
    name: 'Espinhos de Pupunha',
    description: 'Dispara espinhos de pupunha em todas as direções, perfurando a horda.',
    maxLevel: 10,
    iconName: 'Target',
    synergyPassive: 'energia_guarana',
    evolvedId: 'espinhos_pupunha',
    evolvedName: 'Espinhos de Pupunha',
    evolvedDescription: 'Dispara espinhos de pupunha em todas as direções, perfurando a horda.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: ${5 + Math.floor(lv / 2)} espinhos radiais com ${10 + lv * 3} de dano cada.`
    ),
  },
  ferrao_formiga: {
    id: 'ferrao_formiga',
    name: 'Ferrão de Formiga-Bala',
    description: 'Dispara ferrões venenosos e velozes que perfuram os inimigos mais próximos.',
    maxLevel: 10,
    iconName: 'Syringe',
    synergyPassive: 'casco_tartaruga',
    evolvedId: 'ferrao_formiga',
    evolvedName: 'Ferrão de Formiga-Bala',
    evolvedDescription: 'Dispara ferrões venenosos e velozes que perfuram os inimigos mais próximos.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: ferrão perfurante com ${18 + lv * 5} de dano e veneno.`
    ),
  },
  bandeja_inox: {
    id: 'bandeja_inox',
    name: 'Bandeja de Inox',
    description: 'Arremessa bandejas de inox que cortam na ida e voltam girando.',
    maxLevel: 10,
    iconName: 'ConciergeBell',
    synergyPassive: 'essencia_acai',
    evolvedId: 'bandeja_inox',
    evolvedName: 'Bandeja de Inox',
    evolvedDescription: 'Arremessa bandejas de inox que cortam na ida e voltam girando.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: ${1 + Math.floor(lv / 4)} bandeja(s) bumerangue com ${15 + lv * 4} de dano.`
    ),
  },
  ciclone_saci: {
    id: 'ciclone_saci',
    name: 'Ciclone do Saci',
    description: 'Invoca redemoinhos que giram ao redor do herói, repelindo e cortando a horda.',
    maxLevel: 10,
    iconName: 'Orbit',
    synergyPassive: 'plumas_arara',
    evolvedId: 'ciclone_saci',
    evolvedName: 'Ciclone do Saci',
    evolvedDescription: 'Invoca redemoinhos que giram ao redor do herói, repelindo e cortando a horda.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: ciclone com ${13 + lv * 3} de dano, raio e duração crescentes.`
    ),
  },
  lanca_caipora: {
    id: 'lanca_caipora',
    name: 'Lança do Caipora',
    description: 'Arremessa uma lança ancestral que atravessa fileiras inteiras de criaturas.',
    maxLevel: 10,
    iconName: 'BowArrow',
    synergyPassive: 'olho_gato_maracaja',
    evolvedId: 'lanca_caipora',
    evolvedName: 'Lança do Caipora',
    evolvedDescription: 'Arremessa uma lança ancestral que atravessa fileiras inteiras de criaturas.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: lança perfurante com ${26 + lv * 7} de dano e ${2 + Math.floor(lv / 2)} perfurações.`
    ),
  },
  esporos_vitoria: {
    id: 'esporos_vitoria',
    name: 'Esporos de Vitória-Régia',
    description: 'Lança cápsulas de esporos que formam nuvens biológicas no chão.',
    maxLevel: 10,
    iconName: 'FlaskConical',
    synergyPassive: 'raiz_ginseng',
    evolvedId: 'esporos_vitoria',
    evolvedName: 'Esporos de Vitória-Régia',
    evolvedDescription: 'Lança cápsulas de esporos que formam nuvens biológicas no chão.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: esporo cria nuvem com ${5 + lv * 2} de dano por tick e raio ${34 + lv * 2}.`
    ),
  },
  mordida_piranha: {
    id: 'mordida_piranha',
    name: 'Mordida de Piranha',
    description: 'Cardumes de piranhas rasgam em um raio curto ao redor do herói.',
    maxLevel: 10,
    iconName: 'Flame',
    synergyPassive: 'vigor_anta',
    evolvedId: 'mordida_piranha',
    evolvedName: 'Mordida de Piranha',
    evolvedDescription: 'Cardumes de piranhas rasgam em um raio curto ao redor do herói.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: ${3 + Math.floor(lv / 2)} mordidas ao redor com ${9 + lv * 3} de dano.`
    ),
  },
  rugido_mapinguari: {
    id: 'rugido_mapinguari',
    name: 'Rugido do Mapinguari',
    description: 'Um rugido ensurdecedor empurra e atordoa todos os inimigos próximos.',
    maxLevel: 10,
    iconName: 'Shield',
    synergyPassive: 'casca_marupa',
    evolvedId: 'rugido_mapinguari',
    evolvedName: 'Rugido do Mapinguari',
    evolvedDescription: 'Um rugido ensurdecedor empurra e atordoa todos os inimigos próximos.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: onda de choque em raio ${110 + lv * 9} com ${12 + lv * 4} de dano.`
    ),
  },
  chicotada_cipo: {
    id: 'chicotada_cipo',
    name: 'Chicotada de Cipó',
    description: 'Cipós vivos estalam em arco, empurrando e enredando os inimigos.',
    maxLevel: 10,
    iconName: 'FlameKindling',
    synergyPassive: 'vigor_anta',
    evolvedId: 'chicotada_cipo',
    evolvedName: 'Chicotada de Cipó',
    evolvedDescription: 'Cipós vivos estalam em arco, empurrando e enredando os inimigos.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: chicotada em arco com ${18 + lv * 4} de dano e lentidão.`
    ),
  },
  enxame_mutuca: {
    id: 'enxame_mutuca',
    name: 'Enxame de Mutuca',
    description: 'Solta um enxame de mutucas que persegue os alvos mais próximos.',
    maxLevel: 10,
    iconName: 'Sparkles',
    synergyPassive: 'essencia_acai',
    evolvedId: 'enxame_mutuca',
    evolvedName: 'Enxame de Mutuca',
    evolvedDescription: 'Solta um enxame de mutucas que persegue os alvos mais próximos.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: ${3 + Math.floor(lv / 2)} mutucas perseguidoras com ${7 + lv * 2} de dano.`
    ),
  },
  gota_resina: {
    id: 'gota_resina',
    name: 'Gota de Resina Ardente',
    description: 'Arremessa resina em chamas que incendeia o chão e queima a horda.',
    maxLevel: 10,
    iconName: 'Flame',
    synergyPassive: 'coracao_jacare',
    evolvedId: 'gota_resina',
    evolvedName: 'Gota de Resina Ardente',
    evolvedDescription: 'Arremessa resina em chamas que incendeia o chão e queima a horda.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: resina cria fogo com ${7 + lv * 2} de dano por tick e raio ${28 + lv * 2}.`
    ),
  },
  voo_tucano: {
    id: 'voo_tucano',
    name: 'Voo do Tucano',
    description: 'Tucanos coloridos cruzam a tela ricocheteando entre as criaturas.',
    maxLevel: 10,
    iconName: 'Feather',
    synergyPassive: 'plumas_arara',
    evolvedId: 'voo_tucano',
    evolvedName: 'Voo do Tucano',
    evolvedDescription: 'Tucanos coloridos cruzam a tela ricocheteando entre as criaturas.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: ${2 + Math.floor(lv / 3)} tucanos com ${12 + lv * 3} de dano e ricochete.`
    ),
  },
  teia_aranha: {
    id: 'teia_aranha',
    name: 'Teia de Aranha-Golias',
    description: 'Lança teias que prendem e desaceleram grupos de inimigos.',
    maxLevel: 10,
    iconName: 'Crosshair',
    synergyPassive: 'olho_gato_maracaja',
    evolvedId: 'teia_aranha',
    evolvedName: 'Teia de Aranha-Golias',
    evolvedDescription: 'Lança teias que prendem e desaceleram grupos de inimigos.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: ${1 + Math.floor(lv / 3)} teia(s) com ${7 + lv * 2} de dano e lentidão.`
    ),
  },
  arrancada_sucuri: {
    id: 'arrancada_sucuri',
    name: 'Arrancada da Sucuri',
    description: 'Uma sucuri gigante dispara em linha reta esmagando tudo no caminho.',
    maxLevel: 10,
    iconName: 'Zap',
    synergyPassive: 'casca_marupa',
    evolvedId: 'arrancada_sucuri',
    evolvedName: 'Arrancada da Sucuri',
    evolvedDescription: 'Uma sucuri gigante dispara em linha reta esmagando tudo no caminho.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: investida com ${30 + lv * 8} de dano, perfuração total e recuo.`
    ),
  },
  furia_onca_acu: {
    id: 'furia_onca_acu',
    name: 'Fúria da Onça-Açu',
    description: 'Fusão suprema: garras colossais rasgam a arena em uma tempestade de cortes.',
    maxLevel: 10,
    iconName: 'Swords',
    synergyPassive: 'coracao_jacare',
    evolvedId: 'furia_onca_acu',
    evolvedName: 'Fúria da Onça-Açu',
    evolvedDescription: 'Fusão suprema: garras colossais rasgam a arena em uma tempestade de cortes.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: garras supremas causam ${38 + lv * 9} de dano em área e sangramento profundo.`
    ),
  },
  metralha_floresta: {
    id: 'metralha_floresta',
    name: 'Metralha da Floresta',
    description: 'Fusão suprema: chuva contínua de espinhos de pupunha cobre a floresta.',
    maxLevel: 10,
    iconName: 'Target',
    synergyPassive: 'energia_guarana',
    evolvedId: 'metralha_floresta',
    evolvedName: 'Metralha da Floresta',
    evolvedDescription: 'Fusão suprema: chuva contínua de espinhos de pupunha cobre a floresta.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: rajada de espinhos com ${14 + lv * 4} de dano por projétil.`
    ),
  },
  nuvem_biologica: {
    id: 'nuvem_biologica',
    name: 'Nuvem Biológica',
    description: 'Fusão suprema: esporos vivos perseguem os inimigos em nuvens corrosivas.',
    maxLevel: 10,
    iconName: 'Biohazard',
    synergyPassive: 'raiz_ginseng',
    evolvedId: 'nuvem_biologica',
    evolvedName: 'Nuvem Biológica',
    evolvedDescription: 'Fusão suprema: esporos vivos perseguem os inimigos em nuvens corrosivas.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: nuvem biológica com ${9 + lv * 3} de dano por tick e raio ampliado.`
    ),
  },
  tempestade_lendaria: {
    id: 'tempestade_lendaria',
    name: 'Tempestade Lendária',
    description: 'Fusão suprema: ciclones e raios do Saci varrem a floresta sem parar.',
    maxLevel: 10,
    iconName: 'Zap',
    synergyPassive: 'plumas_arara',
    evolvedId: 'tempestade_lendaria',
    evolvedName: 'Tempestade Lendária',
    evolvedDescription: 'Fusão suprema: ciclones e raios do Saci varrem a floresta sem parar.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: tempestade causa ${18 + lv * 5} de dano por ciclone e raio em cadeia.`
    ),
  },
  injecao_letal: {
    id: 'injecao_letal',
    name: 'Injeção Letal',
    description: 'Fusão suprema: ferrões bioquímicos explodem em veneno e corroem a horda.',
    maxLevel: 10,
    iconName: 'Syringe',
    synergyPassive: 'casco_tartaruga',
    evolvedId: 'injecao_letal',
    evolvedName: 'Injeção Letal',
    evolvedDescription: 'Fusão suprema: ferrões bioquímicos explodem em veneno e corroem a horda.',
    levelDescriptions: levels10((lv) =>
      `Nv.${lv}: ferrão supremo com ${28 + lv * 7} de dano, veneno e explosão corrosiva.`
    ),
  },
};

export const LULA_SKILL = {
  name: 'Poder do L',
  damage: 35,
  radius: 150,
  cooldown: 2900,
  animationDuration: 800,
  // Frame 4 of the eight-frame gesture is the first fully formed L.
  releaseDelay: 400,
  color: '#ff1744',
  knockback: 80,
};

export const PASSIVE_REGISTRY: Record<PassiveId, PassiveMeta> = {
  spinach: {
    id: 'spinach',
    name: 'Espinafre de Ferro',
    description: 'Aumenta o dano global de todos os seus ataques.',
    maxLevel: 5,
    iconName: 'Sparkles',
    synergyWeapon: 'lula_power',
    levelDescriptions: [
      'Dano global +10%.',
      'Dano global +20% (total).',
      'Dano global +30% (total).',
      'Dano global +40% (total).',
      'Dano global +50% (total).',
    ],
  },
  wings: {
    id: 'wings',
    name: 'Asas da Rapidez',
    description: 'Aumenta a velocidade de deslocamento do sobrevivente.',
    maxLevel: 5,
    iconName: 'Feather',
    synergyWeapon: 'derson_combo',
    levelDescriptions: [
      'Velocidade de movimento +9%.',
      'Velocidade de movimento +18% (total).',
      'Velocidade de movimento +27% (total).',
      'Velocidade de movimento +36% (total).',
      'Velocidade de movimento +45% (total).',
    ],
  },
  heart: {
    id: 'heart',
    name: 'Coração Sagrado',
    description: 'Aumenta o HP máximo, cura imediatamente e regenera vida por segundo.',
    maxLevel: 5,
    iconName: 'Heart',
    synergyWeapon: 'derson_combo',
    levelDescriptions: [
      '+20 HP Máx (cura +20 na hora) e +0.6 HP/s de regeneração.',
      '+40 HP Máx (cura +20) e +1.2 HP/s de regeneração.',
      '+60 HP Máx (cura +20) e +1.8 HP/s de regeneração.',
      '+80 HP Máx (cura +20) e +2.4 HP/s de regeneração.',
      '+100 HP Máx (cura +20) e +3.0 HP/s de regeneração!',
    ],
  },
  tome: {
    id: 'tome',
    name: 'Tomo Vazio',
    description: 'Reduz o tempo de recarga de todas as suas armas.',
    maxLevel: 5,
    iconName: 'Clock',
    synergyWeapon: 'flying_tray',
    levelDescriptions: [
      'Tempo de recarga -7%.',
      'Tempo de recarga -14% (total).',
      'Tempo de recarga -21% (total).',
      'Tempo de recarga -28% (total).',
      'Tempo de recarga -35% (total)!',
    ],
  },
  magnet: {
    id: 'magnet',
    name: 'Ímã de Almas',
    description: 'Amplia o campo magnético de coleta de moedas e itens.',
    maxLevel: 5,
    iconName: 'Magnet',
    synergyWeapon: 'flying_tray',
    levelDescriptions: [
      'Raio de coleta +25%.',
      'Raio de coleta +50% (total).',
      'Raio de coleta +75% (total).',
      'Raio de coleta +100% (total).',
      'Raio de coleta +125% (total)!',
    ],
  },
  bracer: {
    id: 'bracer',
    name: 'Braçadeira de Precisão',
    description: 'Acelera projéteis e concede perfuração extra a armas de disparo.',
    maxLevel: 5,
    iconName: 'Crosshair',
    synergyWeapon: 'bow',
    levelDescriptions: [
      'Velocidade de projéteis +14%.',
      'Velocidade de projéteis +28% (total).',
      'Velocidade de projéteis +42% e +1 Perfuração global!',
      'Velocidade de projéteis +56% (total).',
      'Velocidade de projéteis +70% e +2 Perfuração global!',
    ],
  },
  lantern: {
    id: 'lantern',
    name: 'Candelabro Arcano',
    description: 'Aumenta a área, largura e raio de impacto de todas as armas.',
    maxLevel: 5,
    iconName: 'FlameKindling',
    synergyWeapon: 'fire_flask',
    levelDescriptions: [
      'Área de ataque +10%.',
      'Área de ataque +20% (total).',
      'Área de ataque +30% (total).',
      'Área de ataque +40% (total).',
      'Área de ataque +50% (total)!',
    ],
  },
  clover: {
    id: 'clover',
    name: 'Trevo da Sorte',
    description: 'Aumenta a chance de acerto crítico global e melhora a sorte nos drops.',
    maxLevel: 5,
    iconName: 'Clover',
    synergyWeapon: 'executioner_axe',
    levelDescriptions: [
      '+6% de Chance Crítica global e +Sorte.',
      '+12% de Chance Crítica global (total).',
      '+18% de Chance Crítica global (total).',
      '+24% de Chance Crítica global (total).',
      '+30% de Chance Crítica global e Sorte máxima!',
    ],
  },
  hourglass: {
    id: 'hourglass',
    name: 'Ampulheta Astral',
    description: 'Prolonga a duração de órbitas, zonas no solo, debuffs e alcance de tiro.',
    maxLevel: 5,
    iconName: 'Hourglass',
    synergyWeapon: 'bible',
    levelDescriptions: [
      'Duração de efeitos e zonas +15%.',
      'Duração de efeitos e zonas +30% (total).',
      'Duração de efeitos e zonas +45% (total).',
      'Duração de efeitos e zonas +60% (total).',
      'Duração de efeitos e zonas +75% (total)!',
    ],
  },
  duplicator: {
    id: 'duplicator',
    name: 'Anel Duplicador',
    description: 'Multiplica a quantidade de projéteis, orbes e descargas de suas armas.',
    maxLevel: 3,
    iconName: 'Orbit',
    synergyWeapon: 'lightning',
    levelDescriptions: [
      'Todas as armas elegíveis lançam +1 projétil/golpe adicional!',
      'Dano global +10% além do projétil extra.',
      'Lança +2 projéteis/golpes adicionais em todas as armas elegíveis!',
    ],
  },
  hunter_mark: {
    id: 'hunter_mark',
    name: 'Insígnia do Predador',
    description: 'Amplifica o multiplicador de dano crítico e a força de repulsão.',
    maxLevel: 5,
    iconName: 'Target',
    synergyWeapon: 'bow',
    levelDescriptions: [
      'Dano Crítico +20% e Repulsão +10%.',
      'Dano Crítico +40% e Repulsão +20% (total).',
      'Dano Crítico +60% e Repulsão +30% (total).',
      'Dano Crítico +80% e Repulsão +40% (total).',
      'Dano Crítico +100% e Repulsão +50% (total)!',
    ],
  },
  bio_shield: {
    id: 'bio_shield',
    name: 'Couraça Bioquímica',
    description: 'Concede Armadura e aumenta o dano contra monstros lentos, sangrando ou envenenados.',
    maxLevel: 5,
    iconName: 'Biohazard',
    synergyWeapon: 'syringe',
    levelDescriptions: [
      '+1 Armadura e +10% de dano contra alvos debilitados.',
      '+2 Armadura e +20% de dano contra alvos debilitados.',
      '+3 Armadura e +30% de dano contra alvos debilitados.',
      '+4 Armadura e +40% de dano contra alvos debilitados.',
      '+5 Armadura e +50% de dano contra alvos debilitados!',
    ],
  },
  casco_tartaruga: {
    id: 'casco_tartaruga',
    name: 'Casco de Tartaruga',
    description: 'Endurece a carapaça do herói, aumentando a armadura contra todo dano.',
    maxLevel: 10,
    iconName: 'Shield',
    synergyWeapon: 'ferrao_formiga',
    levelDescriptions: levels10((lv) => `Nv.${lv}: +${lv} de Armadura.`),
  },
  essencia_acai: {
    id: 'essencia_acai',
    name: 'Essência de Açaí',
    description: 'Amplia o magnetismo de coleta e a experiência absorvida.',
    maxLevel: 10,
    iconName: 'Magnet',
    synergyWeapon: 'bandeja_inox',
    levelDescriptions: levels10((lv) => `Nv.${lv}: +${lv * 18} de alcance de coleta e +${lv * 4}% de XP.`),
  },
  energia_guarana: {
    id: 'energia_guarana',
    name: 'Energia de Guaraná',
    description: 'Acelera o deslocamento do sobrevivente pela floresta.',
    maxLevel: 10,
    iconName: 'Feather',
    synergyWeapon: 'espinhos_pupunha',
    levelDescriptions: levels10((lv) => `Nv.${lv}: +${lv * 5}% de Velocidade de movimento.`),
  },
  raiz_ginseng: {
    id: 'raiz_ginseng',
    name: 'Raiz de Ginseng',
    description: 'Regenera a vida do herói continuamente enquanto ele sobrevive.',
    maxLevel: 10,
    iconName: 'Heart',
    synergyWeapon: 'esporos_vitoria',
    levelDescriptions: levels10((lv) => `Nv.${lv}: +${(lv * 0.5).toFixed(1)} HP por segundo.`),
  },
  casca_marupa: {
    id: 'casca_marupa',
    name: 'Casca de Marupá',
    description: 'Aumenta a chance de crítico e a quantidade de ouro obtida.',
    maxLevel: 10,
    iconName: 'Clover',
    synergyWeapon: 'rugido_mapinguari',
    levelDescriptions: levels10((lv) => `Nv.${lv}: +${lv * 3}% de Crítico e +${lv * 5}% de Ouro.`),
  },
  olho_gato_maracaja: {
    id: 'olho_gato_maracaja',
    name: 'Olho de Gato-Maracajá',
    description: 'Expande a área de efeito de todas as armas.',
    maxLevel: 10,
    iconName: 'Target',
    synergyWeapon: 'teia_aranha',
    levelDescriptions: levels10((lv) => `Nv.${lv}: +${lv * 6}% de Área de ataque.`),
  },
  vigor_anta: {
    id: 'vigor_anta',
    name: 'Vigor de Anta',
    description: 'Aumenta o HP máximo do herói e cura ao receber o bônus.',
    maxLevel: 10,
    iconName: 'Dumbbell',
    synergyWeapon: 'mordida_piranha',
    levelDescriptions: levels10((lv) => `Nv.${lv}: +${lv * 12} de HP Máximo.`),
  },
  plumas_arara: {
    id: 'plumas_arara',
    name: 'Plumas de Arara',
    description: 'Reduz o tempo de recarga de todas as armas.',
    maxLevel: 10,
    iconName: 'Clock',
    synergyWeapon: 'ciclone_saci',
    levelDescriptions: levels10((lv) => `Nv.${lv}: -${lv * 3}% de Recarga.`),
  },
  coracao_jacare: {
    id: 'coracao_jacare',
    name: 'Coração de Jacaré-Açu',
    description: 'Aumenta o dano global de todos os ataques.',
    maxLevel: 10,
    iconName: 'Sparkles',
    synergyWeapon: 'garras_onca',
    levelDescriptions: levels10((lv) => `Nv.${lv}: +${lv * 6}% de Dano global.`),
  },
  resiliencia_preguica: {
    id: 'resiliencia_preguica',
    name: 'Resiliência do Bicho-Preguiça',
    description: 'Reduz atordoamentos e, no nível máximo, torna o herói imune a stun.',
    maxLevel: 10,
    iconName: 'Hourglass',
    synergyWeapon: 'chicotada_cipo',
    levelDescriptions: levels10((lv) =>
      lv >= 10
        ? 'Nv.10: Imunidade total a atordoamentos!'
        : `Nv.${lv}: -${lv * 10}% de duração de atordoamento.`
    ),
  },
};

export interface FusionRecipe {
  weaponId: WeaponId;
  passiveId: PassiveId;
  resultId: WeaponId;
  name: string;
  description: string;
  iconName: string;
}

/** Five Supreme Fusions available only in the Amazon Forest at level 10/10. */
export const FUSION_RECIPES: FusionRecipe[] = [
  {
    weaponId: 'garras_onca',
    passiveId: 'coracao_jacare',
    resultId: 'furia_onca_acu',
    name: 'Fúria da Onça-Açu',
    description: 'Garras de Onça + Coração de Jacaré-Açu: garras colossais em tempestade de cortes.',
    iconName: 'Swords',
  },
  {
    weaponId: 'espinhos_pupunha',
    passiveId: 'energia_guarana',
    resultId: 'metralha_floresta',
    name: 'Metralha da Floresta',
    description: 'Espinhos de Pupunha + Energia de Guaraná: rajada contínua de espinhos.',
    iconName: 'Target',
  },
  {
    weaponId: 'esporos_vitoria',
    passiveId: 'raiz_ginseng',
    resultId: 'nuvem_biologica',
    name: 'Nuvem Biológica',
    description: 'Esporos de Vitória-Régia + Raiz de Ginseng: nuvens corrosivas persistentes.',
    iconName: 'Biohazard',
  },
  {
    weaponId: 'ciclone_saci',
    passiveId: 'plumas_arara',
    resultId: 'tempestade_lendaria',
    name: 'Tempestade Lendária',
    description: 'Ciclone do Saci + Plumas de Arara: ciclones e raios incessantes.',
    iconName: 'Zap',
  },
  {
    weaponId: 'ferrao_formiga',
    passiveId: 'casco_tartaruga',
    resultId: 'injecao_letal',
    name: 'Injeção Letal',
    description: 'Ferrão de Formiga-Bala + Casco de Tartaruga: ferrões bioquímicos explosivos.',
    iconName: 'Syringe',
  },
];

/** Themed Amazon starting weapons so every run begins inside the local catalogue. */
export const AMAZON_STARTING_WEAPON_BY_CHARACTER: Record<string, WeaponId> = {
  derson: 'bandeja_inox',
  dukarai: 'bandeja_inox',
  kayrurururu: 'bow',
  dr_janelinha: 'ferrao_formiga',
  lula: 'lula_power',
};
