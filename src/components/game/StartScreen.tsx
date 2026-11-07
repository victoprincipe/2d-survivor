'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CharacterConfig, SavedGameData } from '@/game/types';
import { CHARACTERS } from '@/game/data/characters';
import { POWER_UP_DEFINITIONS, getPowerUpCost, saveGameData } from '@/game/data/persistence';
import { WEAPON_REGISTRY } from '@/game/data/upgrades';
import {
  Flame,
  Sword,
  Wand2,
  Coins,
  Trophy,
  Skull,
  Clock,
  Sparkles,
  Shield,
  Heart,
  Feather,
  Zap,
  Play,
  ShoppingBag,
  Info,
  Crosshair,
  Swords,
  BowArrow,
  Dumbbell,
  Bike,
  Utensils,
  Syringe,
} from 'lucide-react';

interface StartScreenProps {
  savedData: SavedGameData;
  onStartGame: (character: CharacterConfig, savedData: SavedGameData) => void;
  onUpdateSave: (savedData: SavedGameData) => void;
}

const WEAPON_ICONS: Record<string, React.ReactNode> = {
  whip: <Flame className="w-5 h-5 text-orange-400" />,
  wand: <Wand2 className="w-5 h-5 text-blue-400" />,
  knife: <Sword className="w-5 h-5 text-slate-300" />,
  bow: <BowArrow className="w-5 h-5 text-lime-400" />,
  garlic: <Shield className="w-5 h-5 text-emerald-400" />,
  derson_combo: <Utensils className="w-5 h-5 text-amber-400" />,
  syringe: <Syringe className="w-5 h-5 text-cyan-400" />,
};

const POWERUP_ICONS: Record<string, React.ReactNode> = {
  might: <Sparkles className="w-4 h-4 text-orange-400" />,
  armor: <Shield className="w-4 h-4 text-slate-300" />,
  maxHp: <Heart className="w-4 h-4 text-rose-400" />,
  recovery: <Zap className="w-4 h-4 text-emerald-400" />,
  speed: <Feather className="w-4 h-4 text-sky-400" />,
  greed: <Coins className="w-4 h-4 text-amber-400" />,
};

const CHARACTER_ICONS: Record<string, React.ReactNode> = {
  Crosshair: <Crosshair className="w-6 h-6 text-white/90 drop-shadow" />,
  Sparkles: <Sparkles className="w-6 h-6 text-white/90 drop-shadow" />,
  Swords: <Swords className="w-6 h-6 text-white/90 drop-shadow" />,
  Shield: <Shield className="w-6 h-6 text-white/90 drop-shadow" />,
  Dumbbell: <Dumbbell className="w-6 h-6 text-white/90 drop-shadow" />,
  Bike: <Bike className="w-6 h-6 text-white/90 drop-shadow" />,
  Syringe: <Syringe className="w-6 h-6 text-white/90 drop-shadow" />,
  Utensils: <Utensils className="w-6 h-6 text-white/90 drop-shadow" />,
};

export const StartScreen: React.FC<StartScreenProps> = ({ savedData, onStartGame, onUpdateSave }) => {
  const [selectedCharIndex, setSelectedCharIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'character' | 'shop'>('character');

  const selectedChar = CHARACTERS[selectedCharIndex];

  const handleBuyPowerUp = (powerUpId: string) => {
    const def = POWER_UP_DEFINITIONS.find((p) => p.id === powerUpId);
    if (!def) return;

    const currentLv = savedData.powerUps[powerUpId] || 0;
    if (currentLv >= def.maxLevel) return;

    const cost = getPowerUpCost(def, currentLv);
    if (savedData.gold < cost) return;

    const updatedData: SavedGameData = {
      ...savedData,
      gold: savedData.gold - cost,
      powerUps: {
        ...savedData.powerUps,
        [powerUpId]: currentLv + 1,
      },
    };

    saveGameData(updatedData);
    onUpdateSave(updatedData);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-slate-950 via-slate-900 to-black flex items-center justify-center p-4 select-none overflow-y-auto">
      <div className="w-full max-w-2xl flex flex-col items-center my-auto">
        {/* Game Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-800 text-red-400 text-xs font-bold uppercase tracking-widest mb-2 shadow-lg">
            <span>Roguelite Survival MVP</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-300 to-amber-400 drop-shadow-lg">
            VAMPIRE SURVIVORS 2D
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-md mx-auto">
            Sobreviva às hordas noturnas, colete gemas arcanas e desbloqueie armas supremas!
          </p>
        </div>

        {/* Top Currency & Records Bar */}
        <div className="w-full flex justify-between items-center bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5 mb-5 shadow-xl">
          <div className="flex items-center gap-2 text-yellow-400 font-mono font-bold text-base">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span>{savedData.gold} Ouro</span>
          </div>

          <div className="flex gap-4 text-xs font-mono text-slate-300">
            <div className="flex items-center gap-1" title="Melhor Tempo">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatTime(savedData.highScore.timeSurvived)}</span>
            </div>
            <div className="flex items-center gap-1" title="Mais Abates">
              <Skull className="w-3.5 h-3.5 text-red-400" />
              <span>{savedData.highScore.kills}</span>
            </div>
            <div className="flex items-center gap-1" title="Vitórias">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{savedData.highScore.wins}</span>
            </div>
          </div>
        </div>

        {/* Tabs: Escolha de Personagem vs Loja de Power-Ups */}
        <div className="w-full flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('character')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 border ${
              activeTab === 'character'
                ? 'bg-red-950/80 border-red-500 text-white shadow-lg'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Sword className="w-4 h-4" />
            Personagens
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 border ${
              activeTab === 'shop'
                ? 'bg-amber-950/80 border-amber-500 text-white shadow-lg'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-yellow-400" />
            Loja de Power-Ups
          </button>
        </div>

        {/* TAB 1: Character Select */}
        {activeTab === 'character' && (
          <div className="w-full flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CHARACTERS.map((char, index) => {
                const isSelected = selectedCharIndex === index;
                const startingWeaponMeta = WEAPON_REGISTRY[char.startingWeapon];
                return (
                  <button
                    key={char.id}
                    onClick={() => setSelectedCharIndex(index)}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                      isSelected
                        ? 'bg-slate-900 border-amber-400 shadow-xl shadow-amber-500/10 scale-[1.02]'
                        : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Character avatar with icon */}
                      <div
                        className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center border shadow-inner"
                        style={{ backgroundColor: char.color, borderColor: char.portraitColor }}
                      >
                        {char.sprite ? (
                          <Image
                            src={char.sprite}
                            alt={char.name}
                            width={48}
                            height={55}
                            unoptimized
                            className="w-full h-full object-contain drop-shadow"
                          />
                        ) : (
                          CHARACTER_ICONS[char.iconName] ?? <Sword className="w-6 h-6 text-white/90 drop-shadow" />
                        )}
                      </div>
                      <h3 className="font-black text-white text-base">{char.name}</h3>
                      <p className="text-amber-400 text-[11px] font-semibold mb-2">{char.title}</p>
                      <p className="text-slate-400 text-xs leading-relaxed">{char.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Arma Inicial:</span>
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-200">
                        {WEAPON_ICONS[char.startingWeapon]}
                        <span>{startingWeaponMeta.name}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Play Button */}
            <button
              onClick={() => onStartGame(selectedChar, savedData)}
              className="w-full mt-2 py-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-base uppercase tracking-widest shadow-2xl shadow-red-500/30 transition cursor-pointer active:scale-98 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-white" />
              INICIAR COM {selectedChar.name.toUpperCase()}
            </button>
          </div>
        )}

        {/* TAB 2: Power-Ups Meta Shop */}
        {activeTab === 'shop' && (
          <div className="w-full flex flex-col gap-2.5 max-h-80 overflow-y-auto pr-1">
            {POWER_UP_DEFINITIONS.map((p) => {
              const currentLv = savedData.powerUps[p.id] || 0;
              const isMax = currentLv >= p.maxLevel;
              const cost = getPowerUpCost(p, currentLv);
              const canAfford = savedData.gold >= cost;

              return (
                <div
                  key={p.id}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                      {POWERUP_ICONS[p.id]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{p.name}</span>
                        <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-amber-300 font-mono">
                          {currentLv} / {p.maxLevel}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs">{p.description}</p>
                    </div>
                  </div>

                  {isMax ? (
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wider px-3 py-1.5 bg-emerald-950/40 rounded-lg border border-emerald-800">
                      MÁXIMO
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBuyPowerUp(p.id)}
                      disabled={!canAfford}
                      className={`px-4 py-2 rounded-xl font-bold text-xs font-mono uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 ${
                        canAfford
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      {cost}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Instructions footer */}
        <div className="mt-5 flex items-center gap-2 text-slate-500 text-xs">
          <Info className="w-4 h-4 text-slate-400" />
          <span>Controles: WASD ou Setas no teclado • Arraste o mouse ou toque para mover</span>
        </div>
      </div>
    </div>
  );
};
