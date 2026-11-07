'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RelicConfig, UpgradeOption } from '@/game/types';
import { RARITY_COLOR, RARITY_LABEL } from '@/game/data/items';
import { Coins, Sparkles } from 'lucide-react';

interface TreasureChestModalProps {
  gold: number;
  upgrade?: UpgradeOption;
  relic?: RelicConfig;
  onClose: () => void;
}

export const TreasureChestModal: React.FC<TreasureChestModalProps> = ({ gold, upgrade, relic, onClose }) => {
  useEffect(() => {
    // Fire festive golden confetti burst
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#d97706', '#ef4444', '#ffffff'],
      });
    } catch {
      // Ignore if confetti context not available
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-amber-950/40 to-black border-2 border-yellow-500 rounded-2xl shadow-2xl p-6 relative flex flex-col items-center text-center">
        {/* Chest Icon / Animation */}
        <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-yellow-600 rounded-2xl border-4 border-yellow-200 shadow-xl flex items-center justify-center mb-4 animate-bounce">
          <Sparkles className="w-10 h-10 text-amber-950" />
        </div>

        <h2 className="text-2xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 drop-shadow">
          BAÚ DE TESOURO!
        </h2>

        <p className="text-slate-300 text-xs mt-1 mb-5">
          O monstro de elite deixou despojos valiosos para sua sobrevivência!
        </p>

        {/* Rewards Box */}
        <div className="w-full bg-slate-950/80 border border-amber-500/40 rounded-xl p-4 flex flex-col gap-3 mb-6">
          {/* Gold amount */}
          <div className="flex items-center justify-center gap-2 text-yellow-300 font-mono text-xl font-bold">
            <Coins className="w-6 h-6 text-yellow-400" />
            <span>+{gold} Ouro Coletado</span>
          </div>

          {/* Upgrade reward if provided */}
          {upgrade && (
            <div className="border-t border-slate-800 pt-3 flex flex-col items-center">
              <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider mb-1">
                Bônus Adicional Concedido:
              </span>
              <span className="text-white font-bold text-base">{upgrade.name}</span>
              <span className="text-slate-400 text-xs mt-0.5">{upgrade.description}</span>
            </div>
          )}

          {/* Relic reward if provided */}
          {relic && (
            <div
              className="border-t border-slate-800 pt-3 flex flex-col items-center"
              style={{ color: RARITY_COLOR[relic.rarity] }}
            >
              <span className="text-[10px] uppercase font-black tracking-wider mb-1">
                Relíquia {RARITY_LABEL[relic.rarity]} Encontrada:
              </span>
              <span className="font-bold text-base" style={{ color: RARITY_COLOR[relic.rarity] }}>
                {relic.name}
              </span>
              <span className="text-slate-400 text-xs mt-0.5">{relic.description}</span>
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
