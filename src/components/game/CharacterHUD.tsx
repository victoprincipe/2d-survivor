'use client';

import React from 'react';
import Image from 'next/image';
import { CharacterConfig } from '@/game/types';
import {
  Bike,
  Crosshair,
  Dumbbell,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Syringe,
  Utensils,
  Hand,
} from 'lucide-react';

interface CharacterHUDProps {
  character: CharacterConfig;
  level: number;
  currentXp: number;
  maxXp: number;
}

const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const FALLBACK_ICONS: Record<string, React.ReactNode> = {
  Bike: <Bike className="h-7 w-7 text-white/90 drop-shadow" />,
  Crosshair: <Crosshair className="h-7 w-7 text-white/90 drop-shadow" />,
  Sparkles: <Sparkles className="h-7 w-7 text-white/90 drop-shadow" />,
  Swords: <Swords className="h-7 w-7 text-white/90 drop-shadow" />,
  Dumbbell: <Dumbbell className="h-7 w-7 text-white/90 drop-shadow" />,
  Shield: <Shield className="h-7 w-7 text-white/90 drop-shadow" />,
  Syringe: <Syringe className="h-7 w-7 text-white/90 drop-shadow" />,
  Utensils: <Utensils className="h-7 w-7 text-white/90 drop-shadow" />,
  Hand: <Hand className="h-7 w-7 text-white/90 drop-shadow" />,
};

export const CharacterHUD: React.FC<CharacterHUDProps> = ({
  character,
  level,
  currentXp,
  maxXp,
}) => {
  const safeMaxXp = Math.max(1, maxXp);
  const xpPercent = Math.min(100, Math.max(0, (currentXp / safeMaxXp) * 100));
  const dashOffset = RING_CIRCUMFERENCE * (1 - xpPercent / 100);
  const safeLevel = Math.max(1, Math.floor(level));

  return (
    <div
      className="pointer-events-none absolute left-5 top-5 z-[100] flex select-none items-center font-ui"
      aria-label={`${character.name}, nível ${safeLevel}`}
    >
      <div className="relative z-10 h-16 w-16 shrink-0 sm:h-[72px] sm:w-[72px]">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke="#334155"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className="transition-[stroke-dashoffset] duration-200 ease-out"
          />
        </svg>

        <div
          className="absolute inset-[7px] flex items-center justify-center overflow-hidden rounded-full border border-slate-700/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.65)]"
          style={{
            background: `linear-gradient(145deg, ${character.color}, ${character.portraitColor})`,
          }}
          title={`XP ${currentXp} / ${maxXp}`}
        >
          {character.sprite ? (
            <Image
              src={character.sprite}
              alt={character.name}
              width={72}
              height={72}
              unoptimized
              className="h-full w-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            FALLBACK_ICONS[character.iconName] ?? (
              <Sword className="h-7 w-7 text-white/90" />
            )
          )}
        </div>

        <div className="absolute -bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-baseline gap-1 rounded-full border border-slate-700 bg-slate-950/95 px-2 py-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
            Nv
          </span>
          <span className="text-sm font-black leading-none text-white sm:text-base">
            {safeLevel}
          </span>
        </div>
      </div>

      <div className="-ml-2 flex h-8 min-w-[92px] max-w-[120px] items-center rounded-lg border border-slate-700/80 bg-slate-950/90 pl-4 pr-3 shadow-[0_4px_14px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:max-w-[200px]">
        <span className="truncate whitespace-nowrap text-xs font-bold text-white sm:text-sm">
          {character.name}
        </span>
      </div>
    </div>
  );
};
