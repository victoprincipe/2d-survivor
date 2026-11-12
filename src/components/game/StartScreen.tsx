'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { LulaPortrait } from './LulaPortrait';
import { CharacterConfig, DifficultyId, MapId, SavedGameData } from '@/game/types';
import { CHARACTERS } from '@/game/data/characters';
import { POWER_UP_DEFINITIONS, getPowerUpCost, saveGameData } from '@/game/data/persistence';
import { DIFFICULTIES, getDifficulty } from '@/game/data/difficulties';
import { GAME_MAPS } from '@/game/data/maps';
import { countClaimableMissions, getAccountLevel } from '@/game/data/missions';
import { WEAPON_REGISTRY } from '@/game/data/upgrades';
import { EquipmentModal } from './EquipmentModal';
import { MissionsTab } from './MissionsTab';
import { AmazonGuideModal } from './AmazonGuideModal';
import { renderWeaponIcon, renderNamedIcon } from './GameIcons';
import {
  Flame,
  Sword,
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
  Pause,
  ShoppingBag,
  Info,
  Target,
  Volume2,
  Map as MapIcon,
  Moon,
  TreePine,
} from 'lucide-react';

interface StartScreenProps {
  savedData: SavedGameData;
  onStartGame: (
    character: CharacterConfig,
    savedData: SavedGameData,
    difficulty: DifficultyId,
    mapId: MapId
  ) => void;
  onUpdateSave: (savedData: SavedGameData) => void;
}

const POWERUP_ICONS: Record<string, React.ReactNode> = {
  might: <Sparkles className="w-4 h-4 text-orange-400" />,
  armor: <Shield className="w-4 h-4 text-slate-300" />,
  maxHp: <Heart className="w-4 h-4 text-rose-400" />,
  recovery: <Zap className="w-4 h-4 text-emerald-400" />,
  speed: <Feather className="w-4 h-4 text-sky-400" />,
  greed: <Coins className="w-4 h-4 text-amber-400" />,
};

const DIFFICULTY_DOT_COLORS: Record<DifficultyId, string> = {
  easy: '#4ade80',
  normal: '#f97316',
  hard: '#facc15',
  nightmare: '#a855f7',
  infernal: '#ef4444',
};

const CHARACTER_SELECTION_MUSIC: Record<string, string> = {
  kayrurururu: '/audio/job-57-audio-1.mp3',
  derson: '/audio/job-54-audio-1.mp3',
  lula: '/audio/job-63-audio-1.mp3',
};

// Per-character music volume multiplier, applied on top of the selection volume slider.
const CHARACTER_SELECTION_MUSIC_VOLUME: Record<string, number> = {
  derson: 0.5,
  lula: 0.5,
};

const getSelectionMusicVolume = (characterId: string, masterVolume: number) =>
  masterVolume * (CHARACTER_SELECTION_MUSIC_VOLUME[characterId] ?? 1);

export const StartScreen: React.FC<StartScreenProps> = ({ savedData, onStartGame, onUpdateSave }) => {
  const [selectedCharIndex, setSelectedCharIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'character' | 'shop' | 'missions'>('character');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyId>(
    savedData.difficulty ?? 'normal'
  );
  const [selectedMap, setSelectedMap] = useState<MapId>('night_plain');
  const [isEquipmentOpen, setIsEquipmentOpen] = useState(false);
  const [isAmazonGuideOpen, setIsAmazonGuideOpen] = useState(false);
  const [selectionVolume, setSelectionVolume] = useState(1);
  const [isSelectionMusicPlaying, setIsSelectionMusicPlaying] = useState(false);
  const selectionAudioRef = useRef<HTMLAudioElement | null>(null);

  const selectedChar = CHARACTERS[selectedCharIndex];
  const difficultyMeta = getDifficulty(selectedDifficulty);
  const claimableMissions = countClaimableMissions(savedData);
  const selectedCharHasMusic = Boolean(CHARACTER_SELECTION_MUSIC[selectedChar.id]);

  const playSelectionAudio = (audio: HTMLAudioElement) => {
    audio
      .play()
      .then(() => {
        if (selectionAudioRef.current === audio) setIsSelectionMusicPlaying(true);
      })
      .catch(() => {
        if (selectionAudioRef.current === audio) setIsSelectionMusicPlaying(false);
      });
  };

  const handleSelectCharacter = (index: number) => {
    setSelectedCharIndex(index);
    const musicUrl = CHARACTER_SELECTION_MUSIC[CHARACTERS[index].id];
    if (musicUrl) {
      selectionAudioRef.current?.pause();
      const audio = new Audio(musicUrl);
      audio.volume = getSelectionMusicVolume(CHARACTERS[index].id, selectionVolume);
      audio.onended = () => {
        if (selectionAudioRef.current === audio) setIsSelectionMusicPlaying(false);
      };
      selectionAudioRef.current = audio;
      playSelectionAudio(audio);
    } else {
      selectionAudioRef.current?.pause();
      selectionAudioRef.current = null;
      setIsSelectionMusicPlaying(false);
    }
  };

  const handleToggleSelectionMusic = () => {
    const currentAudio = selectionAudioRef.current;
    if (currentAudio) {
      if (isSelectionMusicPlaying) {
        currentAudio.pause();
        setIsSelectionMusicPlaying(false);
      } else {
        currentAudio.volume = getSelectionMusicVolume(selectedChar.id, selectionVolume);
        playSelectionAudio(currentAudio);
      }
      return;
    }

    const musicUrl = CHARACTER_SELECTION_MUSIC[selectedChar.id];
    if (!musicUrl) return;
    const audio = new Audio(musicUrl);
    audio.volume = getSelectionMusicVolume(selectedChar.id, selectionVolume);
    audio.onended = () => {
      if (selectionAudioRef.current === audio) setIsSelectionMusicPlaying(false);
    };
    selectionAudioRef.current = audio;
    playSelectionAudio(audio);
  };

  const handleSelectionVolumeChange = (vol: number) => {
    setSelectionVolume(vol);
    if (selectionAudioRef.current) {
      selectionAudioRef.current.volume = getSelectionMusicVolume(selectedChar.id, vol);
    }
  };

  const handleSelectDifficulty = (difficulty: DifficultyId) => {
    setSelectedDifficulty(difficulty);
    const updatedData: SavedGameData = { ...savedData, difficulty };
    saveGameData(updatedData);
    onUpdateSave(updatedData);
  };

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
    <div className="dungeon-bg font-ui fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-3 select-none sm:p-5">
      <div aria-hidden="true" className="torch-glow torch-glow-left" />
      <div aria-hidden="true" className="torch-glow torch-glow-right" />
      <div aria-hidden="true" className="dungeon-web dungeon-web-tl" />
      <div aria-hidden="true" className="dungeon-web dungeon-web-tr" />

      <div className="relative z-10 my-auto flex w-full max-w-[1120px] flex-col items-center">
        {/* Header */}
        <header className="mb-4 w-full text-center">
          <div className="badge-pill mb-2.5">
            <Flame className="h-3 w-3 text-[#ff6b4a]" />
            <span>Roguelite Survivor MVP</span>
          </div>
          <h1 className="gothic-title text-3xl sm:text-5xl">Teste</h1>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-[#9ca3af] sm:text-sm">
            Sobreviva às hordas noturnas, ganhe experiência ao derrotar monstros e desbloqueie armas supremas!
          </p>
        </header>

        {/* Top Currency & Records Bar */}
        <div className="stone-panel mb-3 flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-mono text-base font-bold text-[#ffcc33]">
              <Coins className="h-5 w-5 text-[#ffaa00] drop-shadow-[0_0_6px_rgba(255,170,0,0.55)]" />
              <span>{savedData.gold} Ouro</span>
            </div>
            <div
              className="flex items-center gap-1 font-mono text-xs font-bold text-purple-300"
              title="XP da conta"
            >
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span>Nv. {getAccountLevel(savedData.accountXp)}</span>
              <span className="text-[10px] text-[#6b7280]">{savedData.accountXp} XP</span>
            </div>
          </div>

          <div className="flex gap-4 text-xs font-mono text-[#cbd5e1]">
            <div className="flex items-center gap-1" title="Melhor Tempo">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <span>{formatTime(savedData.highScore.timeSurvived)}</span>
            </div>
            <div className="flex items-center gap-1" title="Mais Abates">
              <Skull className="h-3.5 w-3.5 text-red-400" />
              <span>{savedData.highScore.kills}</span>
            </div>
            <div className="flex items-center gap-1" title="Vitórias">
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>{savedData.highScore.wins}</span>
            </div>
          </div>
        </div>

        {/* Desktop: map/difficulty on the left, roster/shop/missions on the right */}
        <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
          {/* Left column: Map + Difficulty */}
          <div className="flex w-full flex-col gap-3">
            {/* Map Selector */}
            <div className="stone-panel w-full p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <MapIcon className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#e69f22]">
                  Mapas
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {GAME_MAPS.map((map, index) => {
                  const isSelected = selectedMap === map.id;
                  return (
                    <button
                      key={map.id}
                      onClick={() => setSelectedMap(map.id)}
                      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition ${
                        isSelected
                          ? 'border-[#f5a623] bg-gradient-to-b from-[#3b2a12] to-[#1e1812] shadow-[0_0_14px_rgba(245,166,35,0.22)]'
                          : 'border-[#383e4c] bg-gradient-to-b from-[#1c2027] to-[#14171c] hover:border-[#4b5363]'
                      }`}
                      title={map.description}
                      aria-pressed={isSelected}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-bold ${
                          isSelected
                            ? 'border-[#f5a623] bg-[#3b2a12] text-[#ffd700]'
                            : 'border-[#383e4c] bg-[#121419] text-[#9ca3af]'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-xs font-bold ${
                            isSelected ? 'text-[#ffd700]' : 'text-[#f3f4f6]'
                          }`}
                        >
                          {map.name}
                        </span>
                        <span className="block text-[10px] leading-snug text-[#9ca3af]">
                          {map.description}
                        </span>
                      </span>
                      {map.id === 'amazon_forest' ? (
                        <TreePine className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <Moon className="h-4 w-4 shrink-0 text-sky-400" />
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedMap === 'amazon_forest' && (
                <button
                  type="button"
                  onClick={() => setIsAmazonGuideOpen(true)}
                  className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-emerald-500/70 bg-gradient-to-b from-emerald-900/70 to-emerald-950 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-200 shadow-[0_0_14px_rgba(16,185,129,0.25)] transition hover:border-emerald-400 hover:text-emerald-100 active:scale-[0.99]"
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    📖
                  </span>
                  Guia do Mapa / Bestiário
                </button>
              )}
            </div>

            {/* Difficulty Selector */}
            <div className="stone-panel w-full p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Skull className="h-4 w-4 text-[#d9381e]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#e69f22]">
                  Dificuldade
                </span>
              </div>
              <p className="mb-2 text-[11px] leading-snug text-[#9ca3af]">
                {difficultyMeta.description}
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5 lg:grid-cols-2">
            {DIFFICULTIES.map((difficulty) => (
              <button
                key={difficulty.id}
                onClick={() => handleSelectDifficulty(difficulty.id)}
                className={`diff-btn ${selectedDifficulty === difficulty.id ? 'diff-btn-active' : ''}`}
                title={difficulty.description}
              >
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: DIFFICULTY_DOT_COLORS[difficulty.id],
                    boxShadow: `0 0 6px ${DIFFICULTY_DOT_COLORS[difficulty.id]}`,
                  }}
                />
                {difficulty.name}
              </button>
            ))}
              </div>
            </div>
          </div>

          {/* Right column: tabs, character grid and start button */}
          <div className="flex w-full min-w-0 flex-col">
            {/* Tabs: Escolha de Personagem vs Loja de Power-Ups */}
            <div className="mb-3 flex w-full gap-2">
          <button
            onClick={() => setActiveTab('character')}
            className={`tab-btn ${activeTab === 'character' ? 'tab-btn-active' : ''}`}
          >
            <Sword className="h-4 w-4" />
            Personagens
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`tab-btn ${activeTab === 'shop' ? 'tab-btn-active' : ''}`}
          >
            <ShoppingBag className="h-4 w-4 text-yellow-400" />
            Loja
          </button>
          <button
            onClick={() => setActiveTab('missions')}
            className={`tab-btn ${activeTab === 'missions' ? 'tab-btn-active' : ''}`}
          >
            <Target className="h-4 w-4 text-purple-400" />
            Missões
            {claimableMissions > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950">
                {claimableMissions}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: Character Select */}
        {activeTab === 'character' && (
          <div className="flex w-full flex-col gap-4">
            <div className="flex w-full justify-end">
              <div className="flex items-center gap-2">
                <label className="stone-panel flex items-center gap-2 px-3 py-1.5">
                  <Volume2 className="h-4 w-4 text-[#e69f22]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">
                    Volume
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={selectionVolume}
                    onChange={(e) => handleSelectionVolumeChange(parseFloat(e.target.value))}
                    className="w-24 cursor-pointer accent-amber-500"
                    aria-label="Volume da música de seleção"
                  />
                  <span className="w-8 text-right font-mono text-[11px] text-[#cbd5e1]">
                    {Math.round(selectionVolume * 100)}%
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleToggleSelectionMusic}
                  disabled={!selectedCharHasMusic}
                  className="stone-panel flex cursor-pointer items-center justify-center p-1.5 text-[#e69f22] transition hover:text-[#ffcc33] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={isSelectionMusicPlaying ? 'Pausar música de seleção' : 'Tocar música de seleção'}
                  title={isSelectionMusicPlaying ? 'Pausar música' : 'Tocar música'}
                >
                  {isSelectionMusicPlaying ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {CHARACTERS.map((char, index) => {
                const isSelected = selectedCharIndex === index;
                const startingWeaponMeta = WEAPON_REGISTRY[char.startingWeapon];
                return (
                  <button
                    key={char.id}
                    onClick={() => {
                      handleSelectCharacter(index);
                      setIsEquipmentOpen(true);
                    }}
                    aria-label={`Selecionar ${char.name} e abrir equipamento`}
                    className={`char-card ${isSelected ? 'char-card-active' : ''}`}
                  >
                    <div>
                      {/* Character avatar with icon */}
                      <div
                        className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg border shadow-inner"
                        style={{
                          backgroundColor: char.color,
                          borderColor: isSelected ? '#f5a623' : char.portraitColor,
                          boxShadow: isSelected
                            ? '0 0 12px rgba(245,166,35,0.35), inset 0 2px 8px rgba(0,0,0,0.45)'
                            : 'inset 0 2px 8px rgba(0,0,0,0.45)',
                        }}
                      >
                        {char.id === 'lula' ? (
                          <LulaPortrait character={char} animated />
                        ) : char.id === 'kayrurururu' && char.animationSprite ? (
                          <span
                            role="img"
                            aria-label={char.name}
                            className="kayru-selection-idle h-full w-full drop-shadow"
                            style={{ backgroundImage: `url("${char.animationSprite}")` }}
                          />
                        ) : char.sprite ? (
                          <Image
                            src={char.sprite}
                            alt={char.name}
                            width={48}
                            height={55}
                            unoptimized
                            className="h-full w-full object-contain drop-shadow"
                          />
                        ) : (
                          renderNamedIcon(char.iconName, 'w-6 h-6', 'text-white/90 drop-shadow')
                        )}
                      </div>
                      <h3 className="font-display text-base font-black text-[#f3f4f6]">{char.name}</h3>
                      <p className="mb-2 text-[11px] font-semibold text-[#e69f22]">{char.title}</p>
                      <p className="text-xs leading-relaxed text-[#9ca3af]">{char.description}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#383e4c] pt-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">
                        Arma Inicial:
                      </span>
                      <div className="flex items-center gap-1 text-xs font-bold text-[#e5e7eb]">
                        {renderWeaponIcon(char.startingWeapon, 'w-5 h-5')}
                        <span>{startingWeaponMeta.name}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Power-Ups Meta Shop */}
        {activeTab === 'shop' && (
          <div className="flex max-h-80 w-full flex-col gap-2.5 overflow-y-auto pr-1">
            {POWER_UP_DEFINITIONS.map((p) => {
              const currentLv = savedData.powerUps[p.id] || 0;
              const isMax = currentLv >= p.maxLevel;
              const cost = getPowerUpCost(p, currentLv);
              const canAfford = savedData.gold >= cost;

              return (
                <div
                  key={p.id}
                  className="stone-panel flex w-full items-center justify-between gap-3 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#383e4c] bg-[#121419] shadow-inner">
                      {POWERUP_ICONS[p.id]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#f3f4f6]">{p.name}</span>
                        <span className="rounded border border-[#383e4c] bg-[#121419] px-2 py-0.5 font-mono text-[10px] text-[#ffcc33]">
                          {currentLv} / {p.maxLevel}
                        </span>
                      </div>
                      <p className="text-xs text-[#9ca3af]">{p.description}</p>
                    </div>
                  </div>

                  {isMax ? (
                    <span className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-400">
                      MÁXIMO
                    </span>
                  ) : (
                    <button
                      onClick={() => handleBuyPowerUp(p.id)}
                      disabled={!canAfford}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition ${
                        canAfford
                          ? 'bg-gradient-to-b from-[#ffcc33] to-[#e69f22] text-[#1e1812] shadow-[0_0_12px_rgba(245,166,35,0.25)] hover:from-[#ffe28a] hover:to-[#f5a623] active:scale-95'
                          : 'cursor-not-allowed bg-[#121419] text-[#6b7280]'
                      }`}
                    >
                      <Coins className="h-3.5 w-3.5" />
                      {cost}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

            {/* TAB 3: Missions */}
            {activeTab === 'missions' && (
              <MissionsTab savedData={savedData} onUpdateSave={onUpdateSave} />
            )}

            {/* Play Button */}
            <button
              onClick={() => {
                selectionAudioRef.current?.pause();
                onStartGame(selectedChar, savedData, selectedDifficulty, selectedMap);
              }}
              className="cta-btn"
            >
              <Play className="h-5 w-5 fill-white" />
              INICIAR COM {selectedChar.name.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Instructions footer */}
        <div className="mt-4 flex items-center gap-2 text-[11px] text-[#6b7280]">
          <Info className="h-4 w-4 text-[#9ca3af]" />
          <span>
            Controles: WASD ou Setas no teclado • SHIFT para dash • ESPAÇO para pular • Arraste o
            mouse ou toque para mover
          </span>
        </div>
      </div>

      {isEquipmentOpen && (
        <EquipmentModal character={selectedChar} savedData={savedData} onUpdateSave={onUpdateSave}
          onClose={() => setIsEquipmentOpen(false)} />
      )}
      {isAmazonGuideOpen && <AmazonGuideModal onClose={() => setIsAmazonGuideOpen(false)} />}
    </div>
  );
};
