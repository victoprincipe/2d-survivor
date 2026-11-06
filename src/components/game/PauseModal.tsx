'use client';

import React from 'react';
import { Play, Volume2, VolumeX, Home } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onQuitToMenu: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  sfxVolume: number;
  bgmVolume: number;
  onSfxVolumeChange: (val: number) => void;
  onBgmVolumeChange: (val: number) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onQuitToMenu,
  isMuted,
  onToggleMute,
  sfxVolume,
  bgmVolume,
  onSfxVolumeChange,
  onBgmVolumeChange,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col items-center">
        <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-6">
          JOGO PAUSADO
        </h2>

        {/* Audio Controls */}
        <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3.5 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Som Global</span>
            <button
              onClick={onToggleMute}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Efeitos Sonoros (SFX)</span>
              <span>{Math.round(sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sfxVolume}
              onChange={(e) => onSfxVolumeChange(parseFloat(e.target.value))}
              className="accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Música (BGM)</span>
              <span>{Math.round(bgmVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={bgmVolume}
              onChange={(e) => onBgmVolumeChange(parseFloat(e.target.value))}
              className="accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm tracking-wider uppercase shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            Continuar
          </button>

          <button
            onClick={onQuitToMenu}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Menu Principal
          </button>
        </div>
      </div>
    </div>
  );
};
