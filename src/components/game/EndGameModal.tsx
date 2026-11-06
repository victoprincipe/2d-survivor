'use client';

import React from 'react';
import { GameEndSummary } from '@/game/types';
import { Trophy, Skull, Clock, Coins, Award, Swords, RotateCcw, Infinity as InfinityIcon } from 'lucide-react';

interface EndGameModalProps {
  summary: GameEndSummary;
  onRestart: () => void;
  onContinueEndless?: () => void;
}

export const EndGameModal: React.FC<EndGameModalProps> = ({ summary, onRestart, onContinueEndless }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isVictory = summary.won;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div
        className={`w-full max-w-xl bg-gradient-to-b rounded-2xl border-2 p-6 shadow-2xl relative my-auto ${
          isVictory
            ? 'from-amber-950/70 via-slate-950 to-black border-amber-500 shadow-amber-500/20'
            : 'from-red-950/70 via-slate-950 to-black border-red-700 shadow-red-500/20'
        }`}
      >
        {/* Title Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div
            className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center mb-3 shadow-lg ${
              isVictory
                ? 'bg-amber-500/20 border-amber-400 text-amber-400'
                : 'bg-red-500/20 border-red-500 text-red-500'
            }`}
          >
            {isVictory ? <Trophy className="w-9 h-9" /> : <Skull className="w-9 h-9" />}
          </div>

          <h2
            className={`text-3xl font-black uppercase tracking-wider drop-shadow ${
              isVictory ? 'text-amber-400' : 'text-red-500'
            }`}
          >
            {isVictory ? 'VITÓRIA! O LORDE FOI DERROTADO' : 'FIM DE JOGO'}
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Sobrevivente: <span className="text-slate-200 font-bold">{summary.characterName}</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
            <Clock className="w-4 h-4 text-cyan-400 mb-1" />
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Sobrevivência</span>
            <span className="text-base font-black font-mono text-white">
              {formatTime(summary.survivalTime)}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
            <Skull className="w-4 h-4 text-red-400 mb-1" />
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Eliminações</span>
            <span className="text-base font-black font-mono text-white">{summary.kills}</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
            <Award className="w-4 h-4 text-purple-400 mb-1" />
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Nível Final</span>
            <span className="text-base font-black font-mono text-white">Lv. {summary.level}</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
            <Coins className="w-4 h-4 text-yellow-400 mb-1" />
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Ouro Ganho</span>
            <span className="text-base font-black font-mono text-yellow-300">+{summary.goldEarned}</span>
          </div>
        </div>

        {/* Weapon Performance & DPS Breakdown Chart */}
        <div className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Swords className="w-4 h-4 text-amber-400" />
              <span>Desempenho por Arma</span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Total: {summary.totalDamage.toLocaleString()} dano
            </span>
          </div>

          <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
            {summary.weaponStats.map((w) => (
              <div key={w.id} className="flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1">
                    {w.name} {w.evolved && <span className="text-amber-400 text-[10px]">★</span>}
                  </span>
                  <div className="flex gap-3 text-slate-400 font-mono text-[11px]">
                    <span>{w.dps} DPS</span>
                    <span className="text-white font-bold">{w.damage.toLocaleString()} ({w.percentage}%)</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      w.evolved ? 'bg-gradient-to-r from-purple-500 to-amber-400' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.max(4, w.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {isVictory && onContinueEndless && (
            <button
              onClick={onContinueEndless}
              className="flex-1 py-3 rounded-xl bg-purple-900/60 hover:bg-purple-800 border border-purple-500 text-purple-200 font-bold flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 text-sm"
            >
              <InfinityIcon className="w-4 h-4" />
              Modo Infinito (Endless)
            </button>
          )}

          <button
            onClick={onRestart}
            className={`flex-1 py-3 rounded-xl font-black text-sm tracking-wide uppercase transition cursor-pointer active:scale-95 flex items-center justify-center gap-2 ${
              isVictory
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Jogar Novamente
          </button>
        </div>
      </div>
    </div>
  );
};
