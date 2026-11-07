'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { UpgradeOption } from '@/game/types';
import { renderNamedIcon } from './GameIcons';
import { Coins, Sparkles, Heart } from 'lucide-react';

interface TreasureChestModalProps {
  gold: number;
  upgrade?: UpgradeOption;
  onClose: () => void;
}

export const TreasureChestModal: React.FC<TreasureChestModalProps> = ({ gold, upgrade, onClose }) => {
  useEffect(() => {
    try {
      confetti({
        particleCount: upgrade?.isEvolution ? 110 : 70,
        spread: upgrade?.isEvolution ? 80 : 60,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#d97706', '#ef4444', '#a855f7', '#ffffff'],
      });
    } catch {
      // Ignore if confetti context not available
    }
  }, [upgrade]);

  const isEvo = Boolean(upgrade?.isEvolution);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md bg-gradient-to-b rounded-2xl shadow-2xl p-6 relative flex flex-col items-center text-center border-2 ${
          isEvo
            ? 'from-purple-950/90 via-slate-900 to-black border-amber-400 shadow-purple-500/30'
            : 'from-slate-900 via-amber-950/40 to-black border-yellow-500'
        }`}
      >
        {/* Chest Icon / Animation */}
        <div
          className={`w-20 h-20 rounded-2xl border-4 shadow-xl flex items-center justify-center mb-4 animate-bounce ${
            isEvo
              ? 'bg-gradient-to-br from-purple-500 via-rose-500 to-amber-400 border-yellow-200'
              : 'bg-gradient-to-br from-amber-400 to-yellow-600 border-yellow-200'
          }`}
        >
          {upgrade ? (
            renderNamedIcon(upgrade.iconName, 'w-10 h-10', 'text-white drop-shadow')
          ) : (
            <Sparkles className="w-10 h-10 text-amber-950" />
          )}
        </div>

        <h2 className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 drop-shadow">
          {isEvo ? 'ARMA EVOLUÍDA!' : 'BAÚ DE TESOURO!'}
        </h2>

        <p className="text-slate-300 text-xs mt-1 mb-5">
          {isEvo
            ? 'A sinergia despertou a forma suprema da sua arma!'
            : 'O monstro de elite deixou despojos valiosos para sua sobrevivência!'}
        </p>

        {/* Rewards Box */}
        <div className="w-full bg-slate-950/80 border border-amber-500/40 rounded-xl p-4 flex flex-col gap-3 mb-6">
          {/* Gold amount */}
          <div className="flex items-center justify-center gap-2 text-yellow-300 font-mono text-xl font-bold">
            <Coins className="w-6 h-6 text-yellow-400" />
            <span>+{gold} Ouro Coletado</span>
          </div>

          {/* Upgrade reward if provided */}
          {upgrade ? (
            <div className="border-t border-slate-800 pt-3 flex flex-col items-center">
              <span
                className={`text-[10px] uppercase font-black tracking-wider mb-1 px-2.5 py-0.5 rounded-full ${
                  isEvo
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950'
                    : 'text-amber-400'
                }`}
              >
                {isEvo ? '🔥 Evolução Suprema Concedida' : `Aprimoramento Concedido (Nv. ${upgrade.level})`}
              </span>
              <span className="text-white font-bold text-base mt-1">{upgrade.name}</span>
              <span className="text-slate-300 text-xs mt-1 leading-relaxed">{upgrade.description}</span>
            </div>
          ) : (
            <div className="border-t border-slate-800 pt-3 flex items-center justify-center gap-1.5 text-emerald-400 text-xs font-bold">
              <Heart className="w-4 h-4 fill-emerald-400" />
              <span>Inventário no máximo: +35 HP Recuperado e Ouro Bônus!</span>
            </div>
          )}
        </div>

        {/* Claim Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 hover:from-yellow-400 hover:to-amber-500 border border-yellow-300 font-black text-slate-950 tracking-wider uppercase shadow-lg shadow-amber-500/30 transition cursor-pointer active:scale-95"
        >
          COLETAR E CONTINUAR
        </button>
      </div>
    </div>
  );
};
