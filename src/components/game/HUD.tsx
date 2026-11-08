'use client';

import React from 'react';
import { HUDState } from '@/game/types';
import { renderWeaponIcon, renderPassiveIcon } from './GameIcons';
import {
  Skull,
  Coins,
  Clock,
  Heart,
  Zap,
  Volume2,
  VolumeX,
  Pause,
} from 'lucide-react';

interface HUDProps {
  hud: HUDState;
  onPause: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  difficultyName: string;
  onClaimMission: (missionId: string) => void;
}

export const HUD: React.FC<HUDProps> = ({
  hud,
  onPause,
  isMuted,
  onToggleMute,
  difficultyName,
  onClaimMission,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hpPercent = Math.min(100, Math.max(0, (hud.playerHp / Math.max(1, hud.playerMaxHp)) * 100));
  const staminaPercent = Math.min(100, Math.max(0, (hud.stamina / Math.max(1, hud.maxStamina)) * 100));
  const objectives = hud.objectives;

  return (
    <div className="pointer-events-none absolute inset-0 select-none flex flex-col justify-between p-3 font-sans text-white">
      {/* Difficulty Badge */}
      <div className="pointer-events-none absolute right-3 top-3 select-none">
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 shadow-md backdrop-blur-sm">
          <Skull className="h-3 w-3 text-red-400" />
          {difficultyName}
        </div>
      </div>

      {/* Top Section */}
      <div className="flex flex-col gap-2 pt-24">
        {/* Boss Health Bar (if active) */}
        {hud.activeBoss && (
          <div className="w-full max-w-lg mx-auto bg-slate-950/90 border-2 border-red-700 rounded-xl p-2 shadow-2xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-1 text-xs font-bold text-red-400 uppercase tracking-widest">
              <span>👑 {hud.activeBoss.name}</span>
              <span>{Math.max(0, Math.round((hud.activeBoss.hp / hud.activeBoss.maxHp) * 100))}%</span>
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
        <div className="flex justify-between items-start sm:items-center gap-2">
          {/* Left: Mission Objectives, HP & Inventory */}
          <div className="flex flex-col gap-1.5 max-w-[46%] sm:max-w-none">
            {/* Amazon Forest Mission Objectives (compact, current turn only) */}
            {objectives && (
              <div className="w-56 max-w-full rounded-lg border border-emerald-800/60 bg-slate-950/85 px-2 py-1.5 shadow-lg backdrop-blur-sm">
                <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-widest">
                  <span className="shrink-0 text-emerald-300">Missão</span>
                  <span className="truncate text-right text-slate-400">{objectives.turnLabel}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {objectives.missions.map((mission) => {
                    const claimable = mission.claimable;
                    return (
                      <button
                        key={mission.id}
                        type="button"
                        disabled={!claimable}
                        onClick={claimable ? () => onClaimMission(mission.id) : undefined}
                        className={`w-full rounded border px-1.5 py-1 text-left text-[10px] transition ${
                          mission.claimed
                            ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-200'
                            : claimable
                              ? 'pointer-events-auto animate-pulse cursor-pointer border-amber-400 bg-amber-950/50 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.75)]'
                              : 'border-slate-700/70 bg-slate-900/70 text-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {mission.claimed ? '✓' : mission.complete ? '★' : '○'} {mission.title}
                          </span>
                          <span className="shrink-0 font-mono text-[9px] text-slate-300">
                            {mission.progress}/{mission.target}
                          </span>
                        </div>
                        {claimable && (
                          <div className="mt-0.5 text-center text-[9px] font-black uppercase tracking-wider">
                            Clique para Resgatar!
                          </div>
                        )}
                        {mission.claimed && (
                          <div className="mt-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                            Resgatado
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Amazon Forest restricted inventory: 4 attack + 4 buff squares */}
            {hud.mapId === 'amazon_forest' && (
              <div className="w-56 max-w-full rounded-lg border border-slate-700/80 bg-slate-950/85 px-2 py-1.5 shadow-lg backdrop-blur-sm">
                <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest">
                  <span className="text-amber-300">Ataques</span>
                  <span className="text-slate-500">{Math.min(4, hud.weapons.length)}/4</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 4 }).map((_, index) => {
                    const weapon = hud.weapons[index];
                    return weapon ? (
                      <div
                        key={weapon.id}
                        title={`${weapon.name} (Nv.${weapon.level})`}
                        className={`relative flex h-8 items-center justify-center rounded border bg-slate-900/85 ${
                          weapon.evolved ? 'border-amber-400 shadow shadow-amber-500/30' : 'border-amber-700/60'
                        }`}
                      >
                        {renderWeaponIcon(weapon.id, 'h-4 w-4')}
                        <span className="absolute -bottom-1.5 -right-1 rounded border border-slate-700 bg-slate-950 px-0.5 text-[8px] font-black text-yellow-300">
                          Nv.{weapon.level}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={`empty-weapon-${index}`}
                        className="h-8 rounded border border-dashed border-slate-700/80 bg-slate-900/40"
                      />
                    );
                  })}
                </div>
                <div className="mb-1 mt-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest">
                  <span className="text-emerald-300">Buffs</span>
                  <span className="text-slate-500">{Math.min(4, hud.passives.length)}/4</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 4 }).map((_, index) => {
                    const passive = hud.passives[index];
                    return passive ? (
                      <div
                        key={passive.id}
                        title={`${passive.name} (Nv.${passive.level})`}
                        className="relative flex h-8 items-center justify-center rounded border border-emerald-700/60 bg-slate-900/85"
                      >
                        {renderPassiveIcon(passive.id, 'h-4 w-4')}
                        <span className="absolute -bottom-1.5 -right-1 rounded border border-slate-700 bg-slate-950 px-0.5 text-[8px] font-black text-emerald-300">
                          Nv.{passive.level}
                        </span>
                      </div>
                    ) : (
                      <div
                        key={`empty-passive-${index}`}
                        className="h-8 rounded border border-dashed border-slate-700/80 bg-slate-900/40"
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* HP Bar */}
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2.5 py-1 backdrop-blur-sm shadow">
              <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse shrink-0" />
              <div className="w-24 sm:w-36 bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
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

            {/* Stamina Bar */}
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/80 rounded-lg px-2.5 py-1 backdrop-blur-sm shadow">
              <Zap className={`w-4 h-4 shrink-0 ${staminaPercent > 15 ? 'text-cyan-400' : 'text-red-500'}`} />
              <div className="w-24 sm:w-36 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-150 ${
                    staminaPercent > 40 ? 'bg-cyan-400' : staminaPercent > 15 ? 'bg-amber-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${staminaPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold font-mono text-slate-200 min-w-14 text-right">
                {hud.stamina}/{hud.maxStamina}
              </span>
            </div>

            {/* Weapons & Passives Slots (night plain keeps the free inventory) */}
            {hud.mapId !== 'amazon_forest' && (
            <div className="flex flex-wrap gap-1">
              {hud.weapons.map((w) => (
                <div
                  key={w.id}
                  className={`relative p-1 rounded-md border flex items-center justify-center bg-slate-900/85 backdrop-blur-sm ${
                    w.evolved ? 'border-amber-400 shadow-amber-500/30 shadow' : 'border-slate-700'
                  }`}
                  title={`${w.name} (Lv. ${w.level})`}
                >
                  {renderWeaponIcon(w.id, 'w-4 h-4')}
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
                  {renderPassiveIcon(p.id, 'w-4 h-4')}
                  <span className="absolute -bottom-1 -right-1 text-[9px] font-black bg-slate-950 px-1 rounded border border-slate-700 text-emerald-300">
                    {p.level}
                  </span>
                </div>
              ))}
            </div>
            )}
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
        <span className="hidden sm:inline">
          WASD ou Setas para mover • SHIFT para dash • ESPAÇO para pular • ESC para pausar
        </span>
        <span className="sm:hidden">Arraste para mover (Joystick Virtual)</span>
      </div>
    </div>
  );
};
