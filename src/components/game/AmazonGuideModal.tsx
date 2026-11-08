'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Clock, Crown, Droplets, Heart, Leaf, MousePointerClick, PawPrint, Shield, Skull, Sparkles, Trees, X, Zap } from 'lucide-react';
import { Enemy } from '@/game/entities/Enemy';
import { Camera } from '@/game/engine/Camera';
import type { EnemyType } from '@/game/types';

interface AmazonGuideModalProps {
  onClose: () => void;
}

type GuideTab = 'fruits' | 'fauna' | 'bosses';

const TABS: { id: GuideTab; label: string; icon: React.ReactNode }[] = [
  { id: 'fruits', label: '1. Frutas & Regras', icon: <Leaf className="h-4 w-4" /> },
  { id: 'fauna', label: '2. Fauna (20 Animais)', icon: <PawPrint className="h-4 w-4" /> },
  { id: 'bosses', label: '3. Chefes (10 Guardiões)', icon: <Crown className="h-4 w-4" /> },
];

type FaunaRank = 'Básico' | 'Médio' | 'Resistente' | 'Elite';
type FaunaHabitat = 'Terra' | 'Água';

interface FaunaEntry {
  type: EnemyType;
  name: string;
  rank: FaunaRank;
  habitat: FaunaHabitat;
  behavior: string;
  nightFrenzy?: boolean;
}

interface FaunaStats {
  hp: number;
  attack: number;
  defense: number;
}

const FAUNA_RANK_ORDER: FaunaRank[] = ['Básico', 'Médio', 'Resistente', 'Elite'];

const FAUNA_RANK_STYLES: Record<
  FaunaRank,
  { badge: string; section: string; icon: React.ReactNode; description: string }
> = {
  Básico: {
    badge: 'border-emerald-700/60 bg-emerald-950/50 text-emerald-300',
    section: 'text-emerald-300',
    icon: <Leaf className="h-4 w-4" />,
    description: 'Enxames rápidos, frágeis e em grande número.',
  },
  Médio: {
    badge: 'border-sky-700/60 bg-sky-950/50 text-sky-300',
    section: 'text-sky-300',
    icon: <Zap className="h-4 w-4" />,
    description: 'Ameaças intermediárias que exigem atenção.',
  },
  Resistente: {
    badge: 'border-amber-700/60 bg-amber-950/50 text-amber-300',
    section: 'text-amber-300',
    icon: <Shield className="h-4 w-4" />,
    description: 'Muito HP, lentos e difíceis de empurrar.',
  },
  Elite: {
    badge: 'border-rose-700/60 bg-rose-950/50 text-rose-300',
    section: 'text-rose-300',
    icon: <Crown className="h-4 w-4" />,
    description: 'Predadores raros, enormes e muito recompensadores.',
  },
};

const FAUNA_HABITAT_STYLES: Record<FaunaHabitat, { badge: string; icon: React.ReactNode }> = {
  Terra: {
    badge: 'border-lime-700/60 bg-lime-950/40 text-lime-300',
    icon: <Trees className="h-3 w-3" />,
  },
  'Água': {
    badge: 'border-cyan-700/60 bg-cyan-950/40 text-cyan-300',
    icon: <Droplets className="h-3 w-3" />,
  },
};

const FAUNA: FaunaEntry[] = [
  {
    type: 'bullet_ant',
    name: 'Formiga-bala',
    rank: 'Básico',
    habitat: 'Terra',
    behavior: 'Enxame terrestre veloz que pasta na praia; frágil, mas ataca em grande número.',
  },
  {
    type: 'leafcutter_ant',
    name: 'Formiga-cortadeira',
    rank: 'Básico',
    habitat: 'Terra',
    behavior: 'Enxame terrestre que pasta na praia carregando folhas; mais resistente que a formiga-bala.',
  },
  {
    type: 'blue_butterfly',
    name: 'Borboleta-azul',
    rank: 'Básico',
    habitat: 'Terra',
    behavior: 'Enxame terrestre de asas azuis; rápida, errática e muito frágil.',
  },
  {
    type: 'cicada',
    name: 'Cigarra',
    rank: 'Básico',
    habitat: 'Terra',
    behavior: 'Enxame terrestre que avança em massa, saltando entre as folhas.',
  },
  {
    type: 'piranha',
    name: 'Piranha',
    rank: 'Básico',
    habitat: 'Água',
    behavior:
      'Emboscada aquática: fica oculta até o herói entrar na água; só pode ser vista e atacada debaixo da água.',
  },
  {
    type: 'poison_dart_frog',
    name: 'Rã-dardo-venenosa',
    rank: 'Médio',
    habitat: 'Terra',
    behavior: 'Terrestre de médio porte; salta em direção ao herói e contamina com veneno.',
  },
  {
    type: 'praying_mantis',
    name: 'Louva-a-deus',
    rank: 'Médio',
    habitat: 'Terra',
    behavior: 'Terrestre ágil; golpeia com as patas dianteiras em investidas rápidas.',
  },
  {
    type: 'stick_bug',
    name: 'Bicho-pau',
    rank: 'Médio',
    habitat: 'Terra',
    behavior: 'Terrestre lento e camuflado; aguenta mais dano que os insetos básicos.',
  },
  {
    type: 'toucan',
    name: 'Tucano',
    rank: 'Médio',
    habitat: 'Terra',
    behavior: 'Terrestre veloz; avança em bicadas rápidas e muda de direção com facilidade.',
  },
  {
    type: 'pink_river_dolphin',
    name: 'Boto-cor-de-rosa',
    rank: 'Médio',
    habitat: 'Água',
    behavior: 'Emboscada aquática: oculto na água até o herói se molhar; nada rápido e morde forte.',
  },
  {
    type: 'capybara',
    name: 'Capivara',
    rank: 'Resistente',
    habitat: 'Terra',
    behavior: 'Terrestre pesada que pasta na praia; muita vida e quase não recua.',
  },
  {
    type: 'sloth',
    name: 'Bicho-preguiça',
    rank: 'Resistente',
    habitat: 'Terra',
    behavior: 'Terrestre lento e resistente; avança sem pressa, mas aguenta muito dano.',
  },
  {
    type: 'rhino_beetle',
    name: 'Besouro-rinoceronte',
    rank: 'Resistente',
    habitat: 'Terra',
    behavior: 'Terrestre blindado; tem a maior vida dos resistentes e é o mais difícil de empurrar.',
  },
  {
    type: 'sawyer_beetle',
    name: 'Besouro-serra-pau',
    rank: 'Resistente',
    habitat: 'Terra',
    behavior: 'Terrestre robusto; serra e avança devagar, absorvendo golpes.',
  },
  {
    type: 'giant_centipede',
    name: 'Lacraia-gigante',
    rank: 'Resistente',
    habitat: 'Terra',
    behavior: 'Terrestre rastejante; alta vida e o maior ataque entre os resistentes.',
  },
  {
    type: 'giant_otter',
    name: 'Ariranha',
    rank: 'Resistente',
    habitat: 'Água',
    behavior: 'Emboscada aquática: oculta na água até o herói entrar; morde forte e resiste a empurrões.',
  },
  {
    type: 'elite_jaguar',
    name: 'Onça-pintada',
    rank: 'Elite',
    habitat: 'Terra',
    behavior: 'Elite terrestre que investe de longe, salta na distância média e morde de perto. Desvie das áreas marcadas e ataque durante a recuperação; cresce ao devorar presas.',
    nightFrenzy: true,
  },
  {
    type: 'elite_tapir',
    name: 'Anta',
    rank: 'Elite',
    habitat: 'Terra',
    behavior: 'Elite terrestre que come frutas das árvores; ao devorar uma frutífera, recupera vida e ganha escudo.',
  },
  {
    type: 'elite_goliath_spider',
    name: 'Aranha-golias',
    rank: 'Elite',
    habitat: 'Terra',
    behavior: 'Elite terrestre; enorme, venenosa e difícil de derrubar.',
  },
  {
    type: 'elite_black_caiman',
    name: 'Jacaré-açu',
    rank: 'Elite',
    habitat: 'Água',
    behavior: 'Foge em terra; ataca com +50% de velocidade na água (+30% na praia) e cresce sem limite ao caçar, como a Sucuri.',
    nightFrenzy: true,
  },
];

interface BossEntry {
  type: EnemyType;
  name: string;
  time: string;
  ability: string;
  finalBoss?: boolean;
  nightFrenzy?: boolean;
}

const BOSSES: BossEntry[] = [
  {
    type: 'boss_curupira',
    name: 'Curupira',
    time: '05:00',
    ability: 'Rastros de fogo e bolas de fogo.',
  },
  {
    type: 'boss_saci',
    name: 'Saci-pererê',
    time: '06:30',
    ability: 'Redemoinhos de vento e teleporte.',
  },
  {
    type: 'boss_boto',
    name: 'Boto-cor-de-rosa',
    time: '08:00',
    ability: 'Ondas sonoras encantadas no rio.',
  },
  {
    type: 'boss_iara',
    name: 'Iara',
    time: '09:30',
    ability: 'Jatos de água e poças de lentidão.',
  },
  {
    type: 'boss_caipora',
    name: 'Caipora',
    time: '11:00',
    ability: 'Investida de queixada e invocação de animais.',
  },
  {
    type: 'boss_matinta',
    name: 'Matinta Pereira',
    time: '12:30',
    ability: 'Voo livre, assobios sônicos e aves sombrias.',
  },
  {
    type: 'boss_vitoria_regia',
    name: 'Vitória-Régia',
    time: '14:00',
    ability: 'Anéis de esporos venenosos e raízes espinhosas.',
  },
  {
    type: 'boss_mapinguari',
    name: 'Mapinguari',
    time: '15:30',
    ability: 'Pisões atordoantes e rugido sônico.',
  },
  {
    type: 'boss_cobra_grande',
    name: 'Sucuri (Cobra-Grande)',
    time: '17:00',
    ability: 'Arrancadas colossais pela terra e pelo rio.',
    nightFrenzy: true,
  },
  {
    type: 'boss_boitata',
    name: 'Boitatá',
    time: '18:30',
    ability: 'Chefe final; paredes de chamas contínuas e bolas de fogo.',
    finalBoss: true,
  },
];

function getEnemyStats(type: EnemyType): FaunaStats {
  const enemy = new Enemy(0, type, 0, 0, 1);
  return {
    hp: enemy.maxHp,
    attack: enemy.damage,
    // Enemies have no flat armor stat; their real defensive stat is knockback
    // resistance. Lower resistance means a heavier, harder-to-push creature.
    defense: Math.max(0, Math.round((1 - enemy.knockbackResistance) * 100)),
  };
}

const EnemySprite: React.FC<{ type: EnemyType; label: string }> = ({ type, label }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 96;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    // Reuse the exact in-game sprite renderer so the guide matches the map.
    const enemy = new Enemy(0, type, 0, 0, 1);
    enemy.isElite = false; // Hide the elite health bar inside the thumbnail.
    enemy.isBoss = false; // Hide the boss health bar inside the thumbnail.
    const camera = new Camera(size, size);
    camera.x = 0;
    camera.y = 0;

    const scale = Math.max(0.8, Math.min(2.2, 58 / (enemy.radius * 2.2)));
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(scale, scale);
    ctx.translate(-size / 2, -size / 2);
    enemy.render(ctx, camera);
    ctx.restore();
  }, [type]);

  return (
    <canvas
      ref={canvasRef}
      width={96}
      height={96}
      className="h-16 w-16"
      role="img"
      aria-label={`Sprite de ${label}`}
    />
  );
};

const StatBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
  suffix?: string;
}> = ({ label, value, max, color, suffix }) => {
  const width = Math.max(4, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-10 shrink-0 text-[9px] font-bold uppercase tracking-wide text-[#9ca3af]">
        {label}
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full border border-[#2a2f3a] bg-[#0b0d10]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </span>
      <span className="w-10 shrink-0 text-right text-[10px] font-black tabular-nums text-[#f3f4f6]">
        {value}
        {suffix ?? ''}
      </span>
    </div>
  );
};

const FaunaCard: React.FC<{
  animal: FaunaEntry;
  stats: FaunaStats;
  maxStats: { hp: number; attack: number; defense: number };
}> = ({ animal, stats, maxStats }) => {
  const rankStyle = FAUNA_RANK_STYLES[animal.rank];
  const habitatStyle = FAUNA_HABITAT_STYLES[animal.habitat];

  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-[#383e4c] bg-gradient-to-b from-[#1c2027] to-[#121419] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 rounded-xl border border-[#2a3a30] bg-gradient-to-b from-[#26362c] to-[#151d18] p-1 shadow-inner">
          <EnemySprite type={animal.type} label={animal.name} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold leading-tight text-[#f3f4f6]">{animal.name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${rankStyle.badge}`}
            >
              {rankStyle.icon}
              {animal.rank}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${habitatStyle.badge}`}
            >
              {habitatStyle.icon}
              {animal.habitat}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <StatBar label="Vida" value={stats.hp} max={maxStats.hp} color="#34d399" />
        <StatBar label="Ataque" value={stats.attack} max={maxStats.attack} color="#fb923c" />
        <StatBar
          label="Defesa"
          value={stats.defense}
          max={maxStats.defense}
          color="#60a5fa"
          suffix="%"
        />
      </div>

      <p className="text-[10.5px] leading-relaxed text-[#9ca3af]">{animal.behavior}</p>

      {animal.nightFrenzy && (
        <p className="rounded border border-indigo-700/60 bg-indigo-950/40 px-2 py-1.5 text-[10px] leading-relaxed text-indigo-200">
          <span className="font-bold text-indigo-100">Frenesi Noturno (10:00–20:00):</span>{' '}
          +25% de velocidade; caça e cresce no dobro da frequência.
        </p>
      )}
    </div>
  );
};

const BossCard: React.FC<{
  boss: BossEntry;
  stats: FaunaStats;
  maxStats: { hp: number; attack: number; defense: number };
}> = ({ boss, stats, maxStats }) => {
  return (
    <div
      className={`flex h-full flex-col gap-2 rounded-lg border bg-gradient-to-b from-[#1c2027] to-[#121419] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
        boss.finalBoss ? 'border-rose-700/70' : 'border-[#383e4c]'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 rounded-xl border border-[#3a2a2a] bg-gradient-to-b from-[#362626] to-[#1d1515] p-1 shadow-inner">
          <EnemySprite type={boss.type} label={boss.name} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold leading-tight text-[#f3f4f6]">{boss.name}</span>
            {boss.finalBoss && (
              <span className="inline-flex items-center gap-1 rounded border border-rose-700/60 bg-rose-950/50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-300">
                <Crown className="h-3 w-3" />
                Final
              </span>
            )}
          </div>
          <span className="mt-1 inline-flex items-center gap-1 rounded border border-amber-700/60 bg-amber-950/50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-300">
            <Clock className="h-3 w-3" />
            {boss.time}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <StatBar label="Vida" value={stats.hp} max={maxStats.hp} color="#34d399" />
        <StatBar label="Ataque" value={stats.attack} max={maxStats.attack} color="#fb923c" />
        <StatBar
          label="Defesa"
          value={stats.defense}
          max={maxStats.defense}
          color="#60a5fa"
          suffix="%"
        />
      </div>

      <p className="text-[10.5px] leading-relaxed text-[#9ca3af]">
        <span className="font-bold text-[#cbd5e1]">Habilidade:</span> {boss.ability}
      </p>

      {boss.nightFrenzy && (
        <p className="rounded border border-indigo-700/60 bg-indigo-950/40 px-2 py-1.5 text-[10px] leading-relaxed text-indigo-200">
          <span className="font-bold text-indigo-100">Frenesi Noturno (10:00–20:00):</span>{' '}
          +25% de velocidade; caça e cresce no dobro da frequência.
        </p>
      )}
    </div>
  );
};

const RULES: { title: string; icon: React.ReactNode; accent: string; text: string }[] = [
  {
    title: 'Ciclo Dia / Pôr do Sol / Noite',
    icon: <Clock className="h-4 w-4" />,
    accent: 'text-indigo-300',
    text: '00:00–05:00: dia claro com folhas ao vento. 05:00–10:00: pôr do sol alaranjado, quando surgem os primeiros chefes. 10:00–20:00: noite azul-escura com luz ao redor do herói, vaga-lumes e chefes de fogo em destaque. À noite, todos os animais ficam 25% mais rápidos e os predadores (Jacaré-açu, Sucuri e Onça-pintada) caçam e crescem no dobro da frequência.',
  },
  {
    title: '3 Turnos de Missão',
    icon: <MousePointerClick className="h-4 w-4" />,
    accent: 'text-amber-300',
    text: 'A partida é dividida em três turnos: 00:00–05:00, 05:00–15:00 e 15:00–20:00. Complete os objetivos de cada turno e faça o resgate por clique antes do tempo acabar.',
  },
  {
    title: 'Animais aquáticos ocultos',
    icon: <Droplets className="h-4 w-4" />,
    accent: 'text-cyan-300',
    text: 'Piranha, Boto-cor-de-rosa e Ariranha ficam ocultos até o herói entrar na água. Fora dela, não podem ser vistos nem atacados.',
  },
  {
    title: 'Jacaré-açu & Sucuri',
    icon: <Skull className="h-4 w-4" />,
    accent: 'text-orange-300',
    text: 'Fogem em terra, mas atacam com +50% de velocidade na água (+30% na praia). Crescem sem limite ao devorar outros bichos, ficando cada vez mais fortes.',
  },
  {
    title: 'Onça-pintada',
    icon: <PawPrint className="h-4 w-4" />,
    accent: 'text-yellow-300',
    text: 'Investe em linha reta, pula até o local marcado e morde em um cone à sua frente. Saia dos avisos ou pule para evitar o golpe; aproveite a recuperação para atacar. Continua caçando e ficando mais rápida e forte a cada refeição.',
  },
  {
    title: 'Anta',
    icon: <Trees className="h-4 w-4" />,
    accent: 'text-emerald-300',
    text: 'Come as frutas do mapa. Ao devorar uma árvore frutífera, recupera vida e ganha um escudo que absorve dano.',
  },
];

const FRUIT_TREES: {
  name: string;
  color: string;
  effect: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    name: 'Açaizeiro',
    color: '#a855f7',
    effect: 'Ímã de XP',
    description: 'Atrai todo o XP do mapa para o herói.',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    name: 'Cupuaçuzeiro',
    color: '#d4a017',
    effect: 'Cura 35% HP',
    description: 'Restaura 35% da vida máxima do herói.',
    icon: <Heart className="h-4 w-4" />,
  },
  {
    name: 'Castanheira-do-Pará',
    color: '#8b5a2b',
    effect: 'Pacote de Ouro',
    description: 'Dropa um pacote de Ouro no chão.',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    name: 'Buritizeiro',
    color: '#f97316',
    effect: '+Velocidade e Ataque (10s)',
    description: 'Concede frenesi de velocidade e ataque por 10 segundos.',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    name: 'Pupunheira',
    color: '#ef4444',
    effect: 'Escudo protetor (10s)',
    description: 'Cria um escudo protetor por 10 segundos.',
    icon: <Shield className="h-4 w-4" />,
  },
  {
    name: 'Araçazeiro',
    color: '#a3e635',
    effect: 'Explosão em área',
    description: 'Provoca uma explosão que causa dano em área nos inimigos.',
    icon: <Sparkles className="h-4 w-4" />,
  },
];

const FIELD_PLANTS: {
  name: string;
  color: string;
  effect: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    name: 'Arbustos de Espinho',
    color: '#ef4444',
    effect: 'Perigo Ambiental · Dano + Slow 40% + Sangramento',
    description:
      'Arbusto baixo de galhos retorcidos e espinhos claros, espalhado pelo chão da floresta. Ao tocar, causa dano imediato, reduz a velocidade em 40% (Slow) e abre uma ferida que causa sangramento contínuo por 10 segundos, exibindo gotas de sangue no herói. Afeta o jogador e criaturas comuns.',
    icon: <Skull className="h-4 w-4" />,
  },
  {
    name: 'Erva de São-Caetano',
    color: '#bef264',
    effect: 'Antídoto Natural · Remove Slow e Sangramento',
    description:
      'Planta rasteira verde-claro com ícone brilhante no radar. Coletada com a tecla E perto do herói, remove instantaneamente a lentidão (Slow) e cancela o efeito de sangramento causado pelos espinhos.',
    icon: <Leaf className="h-4 w-4" />,
  },
];

export const AmazonGuideModal: React.FC<AmazonGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('fruits');

  const faunaWithStats = useMemo(
    () => FAUNA.map((animal) => ({ ...animal, stats: getEnemyStats(animal.type) })),
    []
  );
  const maxStats = useMemo(
    () => ({
      hp: Math.max(...faunaWithStats.map((animal) => animal.stats.hp)),
      attack: Math.max(...faunaWithStats.map((animal) => animal.stats.attack)),
      defense: Math.max(...faunaWithStats.map((animal) => animal.stats.defense)),
    }),
    [faunaWithStats]
  );

  const bossesWithStats = useMemo(
    () => BOSSES.map((boss) => ({ ...boss, stats: getEnemyStats(boss.type) })),
    []
  );
  const bossMaxStats = useMemo(
    () => ({
      hp: Math.max(...bossesWithStats.map((boss) => boss.stats.hp)),
      attack: Math.max(...bossesWithStats.map((boss) => boss.stats.attack)),
      defense: Math.max(...bossesWithStats.map((boss) => boss.stats.defense)),
    }),
    [bossesWithStats]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="amazon-guide-title"
      onClick={onClose}
    >
      <div
        className="stone-panel flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#383e4c] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-700/60 bg-emerald-950/50 text-emerald-300">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="amazon-guide-title"
                className="font-display text-base font-black uppercase tracking-wide text-[#ffd700] sm:text-lg"
              >
                Guia do Mapa / Bestiário
              </h2>
              <p className="text-[11px] text-[#9ca3af]">
                Floresta Amazônica · Ecossistema, frutas, fauna e chefes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md border border-[#383e4c] bg-[#121419] p-1.5 text-[#9ca3af] transition hover:border-[#f5a623] hover:text-[#ffd700]"
            aria-label="Fechar guia"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-[#383e4c] px-3 py-2 sm:px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider transition sm:text-xs ${
                activeTab === tab.id
                  ? 'border-[#f5a623] bg-gradient-to-b from-[#3b2a12] to-[#1e1812] text-[#ffd700] shadow-[0_0_12px_rgba(245,166,35,0.2)]'
                  : 'border-[#383e4c] bg-[#14171c] text-[#9ca3af] hover:border-[#4b5363] hover:text-[#f3f4f6]'
              }`}
              aria-pressed={activeTab === tab.id}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {activeTab === 'fruits' && (
            <div className="flex flex-col gap-4">
              {/* Ecosystem rules */}
              <section>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#e69f22]">
                  <Trees className="h-4 w-4 text-emerald-400" />
                  Regras do Ecossistema
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {RULES.map((rule) => (
                    <div
                      key={rule.title}
                      className="rounded-lg border border-[#383e4c] bg-gradient-to-b from-[#1c2027] to-[#121419] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <div className={`mb-1 flex items-center gap-1.5 text-xs font-bold ${rule.accent}`}>
                        {rule.icon}
                        <span>{rule.title}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-[#9ca3af]">{rule.text}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Fruit trees */}
              <section>
                <h3 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#e69f22]">
                  <Leaf className="h-4 w-4 text-lime-400" />
                  As 6 Árvores Frutíferas
                </h3>
                <p className="mb-2 text-[11px] text-[#9ca3af]">
                  Coleta com a tecla <span className="font-bold text-[#f3f4f6]">E</span> (ou toque no
                  aviso) · Respawn de <span className="font-bold text-[#f3f4f6]">45s</span>.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FRUIT_TREES.map((fruit) => (
                    <div
                      key={fruit.name}
                      className="flex items-start gap-2.5 rounded-lg border border-[#383e4c] bg-gradient-to-b from-[#1c2027] to-[#121419] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-white shadow-inner"
                        style={{
                          backgroundColor: fruit.color,
                          borderColor: fruit.color,
                          boxShadow: `0 0 10px ${fruit.color}66`,
                        }}
                        aria-hidden="true"
                      >
                        {fruit.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#f3f4f6]">{fruit.name}</div>
                        <div className="text-[11px] font-semibold" style={{ color: fruit.color }}>
                          {fruit.effect}
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#9ca3af]">
                          {fruit.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Environmental hazards and natural antidote */}
              <section className="rounded-lg border border-rose-900/60 bg-gradient-to-b from-[#241412] to-[#121419] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <h3 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#e69f22]">
                  <Shield className="h-4 w-4 text-rose-400" />
                  Elementos do Cenário & Perigos Ambientais
                </h3>
                <p className="mb-2 text-[11px] text-[#9ca3af]">
                  Cuidado com os arbustos de espinho · Use a Erva de São-Caetano com{' '}
                  <span className="font-bold text-[#f3f4f6]">E</span> para curar a Ferida.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FIELD_PLANTS.map((plant) => (
                    <div
                      key={plant.name}
                      className="flex items-start gap-2.5 rounded-lg border border-[#383e4c] bg-gradient-to-b from-[#1c2027] to-[#121419] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-white shadow-inner"
                        style={{
                          backgroundColor: plant.color,
                          borderColor: plant.color,
                          boxShadow: `0 0 10px ${plant.color}66`,
                        }}
                        aria-hidden="true"
                      >
                        {plant.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#f3f4f6]">{plant.name}</div>
                        <div className="text-[11px] font-semibold" style={{ color: plant.color }}>
                          {plant.effect}
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#9ca3af]">
                          {plant.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'fauna' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-[#383e4c] bg-[#14171c] p-2.5 text-[11px] leading-relaxed text-[#9ca3af]">
                <span className="font-bold text-[#f3f4f6]">Valores-base (1×):</span> Vida, Ataque
                e Defesa reais do jogo. A Defesa representa a resistência a empurrão: quanto
                maior, menos o bicho recua.
              </div>

              {FAUNA_RANK_ORDER.map((rank) => {
                const animals = faunaWithStats.filter((animal) => animal.rank === rank);
                const rankStyle = FAUNA_RANK_STYLES[rank];
                return (
                  <section key={rank} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h3
                        className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${rankStyle.section}`}
                      >
                        {rankStyle.icon}
                        {rank} <span className="text-[#6b7280]">({animals.length})</span>
                      </h3>
                      <span className="text-[10px] text-[#6b7280]">{rankStyle.description}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {animals.map((animal) => (
                        <FaunaCard
                          key={animal.type}
                          animal={animal}
                          stats={animal.stats}
                          maxStats={maxStats}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {activeTab === 'bosses' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-[#383e4c] bg-[#14171c] p-2.5 text-[11px] leading-relaxed text-[#9ca3af]">
                <span className="font-bold text-[#f3f4f6]">
                  Surgem a partir de 05:00, a cada 1m30s.
                </span>{' '}
                Vida, Ataque e Defesa são os valores-base (1×) do jogo. A Defesa representa a
                resistência a empurrão: quanto maior, menos o chefe recua.
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {bossesWithStats.map((boss) => (
                  <BossCard
                    key={boss.type}
                    boss={boss}
                    stats={boss.stats}
                    maxStats={bossMaxStats}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#383e4c] px-3 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full cursor-pointer rounded-lg border border-[#f5a623] bg-gradient-to-b from-[#3b2a12] to-[#1e1812] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#ffd700] transition hover:from-[#4b3616] hover:to-[#262016] active:scale-[0.99]"
          >
            Fechar guia
          </button>
        </div>
      </div>
    </div>
  );
};
