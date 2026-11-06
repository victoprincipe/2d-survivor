'use client';

import React from 'react';
import { HUDState } from '@/game/types';
import {
  Skull,
  Coins,
  Clock,
  Heart,
  Volume2,
  VolumeX,
  Pause,
  Zap,
  Flame,
  Shield,
  BookOpen,
  Sword,
  Wand2,
  Feather,
  Sparkles,
  Compass,
  Crosshair,
  BowArrow,
  Utensils,
} from 'lucide-react';

interface HUDProps {
  hud: HUDState;
  onPause: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const WEAPON_ICONS: Record<string, React.ReactNode> = {
  whip: <Flame className="w-4 h-4 text-orange-400" />,
  wand: <Wand2 className="w-4 h-4 text-blue-400" />,
  knife: <Sword className="w-4 h-4 text-slate-300" />,
  bow: <BowArrow className="w-4 h-4 text-lime-400" />,
  bible: <BookOpen className="w-4 h-4 text-indigo-400" />,
  garlic: <Shield className="w-4 h-4 text-yellow-300" />,
  lightning: <Zap className="w-4 h-4 text-cyan-300" />,
  derson_combo: <Utensils className="w-4 h-4 text-amber-300" />,
};

const PASSIVE_ICONS: Record<string, React.ReactNode> = {
  spinach: <Sparkles className="w-4 h-4 text-emerald-400" />,
  wings: <Feather className="w-4 h-4 text-sky-400" />,
  heart: <Heart className="w-4 h-4 text-rose-400" />,
  tome: <Clock className="w-4 h-4 text-purple-400" />,
  magnet: <Compass className="w-4 h-4 text-amber-400" />,
  bracer: <Crosshair className="w-4 h-4 text-red-400" />,
};

export const HUD: React.FC<HUDProps> = ({ hud, onPause, isMuted, onToggleMute }) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const xpPercent = Math.min(100, Math.max(0, (hud.xp / Math.max(1, hud.xpToNextLevel)) * 100));
  const hpPercent = Math.min(100, Math.max(0, (hud.playerHp / Math.max(1, hud.playerMaxHp)) * 100));

  return (
    <div className="pointer-events-none absolute inset-0 select-none flex flex-col justify-between p-3 font-sans text-white">
      {/* Top Section */}
      <div className="flex flex-col gap-2">
        {/* XP Bar */}
        <div className="w-full flex items-center gap-3">
          <div className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-full h-5 overflow-hidden p-0.5 shadow-lg backdrop-blur-sm relative">
            <div
              className="bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-400 h-full rounded-full transition-all duration-150 relative"
              style={{ width: `${xpPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            </div>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tracking-wider text-white drop-shadow">
              XP {hud.xp} / {hud.xpToNextLevel}
            </span>
          </div>

          {/* Level Badge */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-yellow-300 rounded-lg px-2.5 py-0.5 shadow-md font-black text-sm text-yellow-100 flex items-center">
            LV {hud.level}
          </div>
        </div>

        {/* Boss Health Bar (if active) */}
        {hud.activeBoss && (
          <div className="w-full max-w-lg mx-auto bg-slate-950/90 border-2 border-red-700 rounded-xl p-2 shadow-2xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-1 text-xs font-bold text-red-400 uppercase tracking-widest">
              <span>👑 {hud.activeBoss.name}</span>
              <span>{Math.round((hud.activeBoss.hp / hud.activeBoss.maxHp) * 100)}%</span>
            </div>
            <div className="w-full bg-red-950/80 rounded-full h-3.5 overflow-hidden border border-red-900">
              <div
                className="bg-gradient-to-r from-red-600 to-rose-500 h-full rounded-full transition-all duration-150"
                style={{ width: `${Math.max(0, (hud.activeBoss.hp / hud.activeBoss.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Event Banner Alert */}
        {hud.eventAlert && (
          <div className="w-full flex justify-center">
            <div className="bg-red-950/90 border-2 border-red-500 text-red-200 px-4 py-1.5 rounded-full font-black text-sm tracking-wide shadow-2xl animate-bounce backdrop-blur-sm">
              {hud.eventAlert}
            </div>
          </div>
        )}

        {/* Middle Stats Bar: HP, Kills, Gold, Timer, Audio/Pause Controls */}
        <div className="flex justify-between items-center">
          {/* Left: Player HP & Inventory */}
          <div className="flex flex-col gap-1.5">
            {/* HP Bar */}
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2.5 py-1 backdrop-blur-sm shadow">
              <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
              <div className="w-28 sm:w-36 bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-150 ${
                    hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 25 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold font-mono text-slate-200 min-w-14 text-right">
                {hud.playerHp}/{hud.playerMaxHp}
              </span>
            </div>

            {/* Weapons & Passives Slots */}
            <div className="flex gap-1">
              {hud.weapons.map((w) => (
                <div
                  key={w.id}
                  className={`relative p-1 rounded-md border flex items-center justify-center bg-slate-900/85 backdrop-blur-sm ${
                    w.evolved ? 'border-amber-400 shadow-amber-500/30 shadow' : 'border-slate-700'
                  }`}
                  title={`${w.name} (Lv. ${w.level})`}
                >
                  {WEAPON_ICONS[w.id]}
                  <span className="absolute -bottom-1 -right-1 text-[9px] font-black bg-slate-950 px-1 rounded border border-slate-700 text-yellow-300">
                    {w.evolved ? '★' : w.level}
                  </span>
                </div>
              ))}
              {hud.passives.map((p) => (
                <div
                  key={p.id}
                  className="relative p-1 rounded-md border border-slate-700 bg-slate-900/85 backdrop-blur-sm flex items-center justify-center"
                  title={`${p.name} (Lv. ${p.level})`}
                >
                  {PASSIVE_ICONS[p.id]}
                  <span className="absolute -bottom-1 -right-1 text-[9px] font-black bg-slate-950 px-1 rounded border border-slate-700 text-emerald-300">
                    {p.level}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Center: Clock */}
          <div className="bg-slate-900/90 border-2 border-slate-700 rounded-xl px-4 py-1.5 flex items-center gap-2 shadow-2xl backdrop-blur-md">
            <Clock className="w-5 h-5 text-amber-400" />
            <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-white">
              {formatTime(hud.survivalTime)}
            </span>
          </div>

          {/* Right: Kills, Gold, and Controls */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1 text-right">
              <div className="flex items-center justify-end gap-1.5 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2.5 py-0.5 backdrop-blur-sm">
                <Skull className="w-4 h-4 text-red-400" />
                <span className="font-mono font-bold text-sm text-slate-100">{hud.kills}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2.5 py-0.5 backdrop-blur-sm">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="font-mono font-bold text-sm text-yellow-300">{hud.gold}</span>
              </div>
            </div>

            {/* Buttons (Pause & Sound) */}
            <div className="flex gap-1.5 pointer-events-auto">
              <button
                onClick={onToggleMute}
                className="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
                title={isMuted ? 'Desmutar Áudio' : 'Mutar Áudio'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onPause}
                className="p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer active:scale-95"
                title="Pausar Jogo (ESC)"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Hint for mobile/desktop */}
      <div className="flex justify-between items-end text-[10px] text-slate-400/80">
        <span className="hidden sm:inline">WASD ou Setas para mover • ESC para pausar</span>
        <span className="sm:hidden">Arraste para mover (Joystick Virtual)</span>
      </div>
    </div>
  );
};
