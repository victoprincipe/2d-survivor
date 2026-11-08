'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Crown, Droplets, Heart, Leaf, MousePointerClick, PawPrint, Shield, Skull, Sparkles, Trees, X, Zap } from 'lucide-react';

interface AmazonGuideModalProps {
  onClose: () => void;
}

type GuideTab = 'fruits' | 'fauna' | 'bosses';

const TABS: { id: GuideTab; label: string; icon: React.ReactNode }[] = [
  { id: 'fruits', label: '1. Frutas & Regras', icon: <Leaf className="h-4 w-4" /> },
  { id: 'fauna', label: '2. Fauna (20 Animais)', icon: <PawPrint className="h-4 w-4" /> },
  { id: 'bosses', label: '3. Chefes (10 Guardiões)', icon: <Crown className="h-4 w-4" /> },
];

const RULES: { title: string; icon: React.ReactNode; accent: string; text: string }[] = [
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
    text: 'Caça na mata e devora as presas que encontra pela frente. Também fica mais rápida a cada refeição.',
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

export const AmazonGuideModal: React.FC<AmazonGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('fruits');

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
            </div>
          )}

          {activeTab === 'fauna' && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#383e4c] p-6 text-center">
              <PawPrint className="h-8 w-8 text-[#6b7280]" />
              <p className="text-sm font-bold text-[#cbd5e1]">Fauna da Floresta</p>
              <p className="max-w-sm text-[11px] text-[#9ca3af]">
                Os 20 animais serão catalogados nesta aba em uma próxima atualização. Nada da
                jogabilidade atual foi alterado.
              </p>
            </div>
          )}

          {activeTab === 'bosses' && (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#383e4c] p-6 text-center">
              <Crown className="h-8 w-8 text-[#6b7280]" />
              <p className="text-sm font-bold text-[#cbd5e1]">Chefes da Floresta</p>
              <p className="max-w-sm text-[11px] text-[#9ca3af]">
                Os 10 Guardiões serão catalogados nesta aba em uma próxima atualização. Nada da
                jogabilidade atual foi alterado.
              </p>
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
