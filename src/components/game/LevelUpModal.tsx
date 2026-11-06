'use client';

import React, { useEffect } from 'react';
import { UpgradeOption } from '@/game/types';
import {
  Flame,
  Wand2,
  Sword,
  BookOpen,
  Shield,
  Zap,
  Sparkles,
  Feather,
  Heart,
  Clock,
  Compass,
  Crosshair,
  Crown,
  BowArrow,
  Utensils,
} from 'lucide-react';

interface LevelUpModalProps {
  options: UpgradeOption[];
  onSelect: (option: UpgradeOption) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Flame: <Flame className="w-8 h-8 text-orange-400" />,
  Wand2: <Wand2 className="w-8 h-8 text-blue-400" />,
  Sword: <Sword className="w-8 h-8 text-slate-200" />,
  BookOpen: <BookOpen className="w-8 h-8 text-indigo-400" />,
  Shield: <Shield className="w-8 h-8 text-yellow-300" />,
  Zap: <Zap className="w-8 h-8 text-cyan-300" />,
  Sparkles: <Sparkles className="w-8 h-8 text-emerald-400" />,
  Feather: <Feather className="w-8 h-8 text-sky-400" />,
  Heart: <Heart className="w-8 h-8 text-rose-400" />,
  Clock: <Clock className="w-8 h-8 text-purple-400" />,
  Compass: <Compass className="w-8 h-8 text-amber-400" />,
  Crosshair: <Crosshair className="w-8 h-8 text-red-400" />,
  BowArrow: <BowArrow className="w-8 h-8 text-lime-400" />,
  Utensils: <Utensils className="w-8 h-8 text-amber-300" />,
};

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ options, onSelect }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1' && options[0]) onSelect(options[0]);
      if (e.key === '2' && options[1]) onSelect(options[1]);
      if (e.key === '3' && options[2]) onSelect(options[2]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, onSelect]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-amber-500/80 rounded-2xl shadow-2xl p-6 relative flex flex-col items-center">
        {/* Header Ribbon */}
        <div className="absolute -top-6 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 border-2 border-yellow-200 px-8 py-1.5 rounded-full shadow-xl flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-950 animate-bounce" />
          <h2 className="text-xl font-black tracking-widest uppercase text-yellow-950">
            SUBIU DE NÍVEL!
          </h2>
          <Crown className="w-5 h-5 text-yellow-950 animate-bounce" />
        </div>

        <p className="text-slate-400 text-xs sm:text-sm mt-4 mb-5 text-center">
          Escolha uma bênção ou aprimoramento para sua jornada de sobrevivência:
        </p>

        {/* Upgrade Cards Grid */}
        <div className="w-full flex flex-col gap-3">
          {options.map((opt, index) => {
            const isEvolution = opt.isEvolution;
            return (
              <button
                key={`${opt.id}-${index}`}
                onClick={() => onSelect(opt)}
                className={`group w-full flex items-center gap-4 p-3.5 sm:p-4 rounded-xl border-2 transition-all duration-150 text-left cursor-pointer active:scale-[0.99] relative overflow-hidden ${
                  isEvolution
                    ? 'bg-gradient-to-r from-purple-950/80 via-slate-900 to-rose-950/80 border-amber-400 hover:border-amber-300 shadow-lg shadow-purple-500/20'
                    : 'bg-slate-900/90 hover:bg-slate-850 border-slate-700/80 hover:border-amber-500/80 shadow-md'
                }`}
              >
                {/* Keyboard shortcut badge */}
                <div className="hidden sm:flex items-center justify-center w-7 h-7 rounded-lg bg-slate-950 border border-slate-700 font-mono text-xs font-bold text-amber-400 group-hover:border-amber-500">
                  {index + 1}
                </div>

                {/* Icon Box */}
                <div
                  className={`w-14 h-14 rounded-xl flex items-center justify-center border shadow-inner ${
                    isEvolution
                      ? 'bg-purple-900/50 border-amber-400'
                      : 'bg-slate-950 border-slate-700 group-hover:border-slate-500'
                  }`}
                >
                  {ICON_MAP[opt.iconName] || <Flame className="w-8 h-8 text-amber-400" />}
                </div>

                {/* Info Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-base sm:text-lg text-white group-hover:text-amber-300 transition truncate">
                      {opt.name}
                    </h3>

                    {/* Tag badge */}
                    {isEvolution ? (
                      <span className="bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        🔥 EVOLUÇÃO!
                      </span>
                    ) : opt.isNew ? (
                      <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        NOVO
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700">
                        Nível {opt.level}
                      </span>
                    )}
                  </div>

                  <p className="text-slate-300 text-xs sm:text-sm line-clamp-2 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-slate-500 text-[11px] text-center">
          Pressione <span className="text-amber-400 font-mono">[1]</span>,{' '}
          <span className="text-amber-400 font-mono">[2]</span> ou{' '}
          <span className="text-amber-400 font-mono">[3]</span> no teclado
        </div>
      </div>
    </div>
  );
};
