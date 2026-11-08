'use client';

import React, { useState, useEffect } from 'react';
import {
  WeaponId,
  PassiveId,
  SavedGameData,
  DevTelemetrySnapshot,
  EnemyType,
} from '@/game/types';
import { GameEngine } from '@/game/engine/GameEngine';
import { WEAPON_REGISTRY, PASSIVE_REGISTRY } from '@/game/data/upgrades';
import { POWER_UP_DEFINITIONS, saveGameData, getInitialSave } from '@/game/data/persistence';
import { DAILY_POOL, WEEKLY_MISSIONS, SECRET_MISSIONS } from '@/game/data/missions';
import { renderWeaponIcon, renderPassiveIcon } from './GameIcons';
import {
  Wrench,
  X,
  Shield,
  Swords,
  Globe,
  Activity,
  Save,
  Zap,
  Heart,
  Skull,
  Trophy,
  Coins,
  Magnet,
  Plus,
  Trash2,
  Eye,
  Sparkles,
  Crosshair,
} from 'lucide-react';

const AMAZON_DEV_MONSTERS: { type: EnemyType; label: string }[] = [
  { type: 'bullet_ant', label: '🐜 Formiga-bala' },
  { type: 'leafcutter_ant', label: '🐜 Formiga-cortadeira' },
  { type: 'blue_butterfly', label: '🦋 Borboleta-azul' },
  { type: 'cicada', label: '🦗 Cigarra' },
  { type: 'poison_dart_frog', label: '🐸 Rã-dardo-venenosa' },
  { type: 'praying_mantis', label: '🦗 Louva-a-deus' },
  { type: 'stick_bug', label: '🥢 Bicho-pau' },
  { type: 'toucan', label: '🦜 Tucano' },
  { type: 'capybara', label: '🦫 Capivara' },
  { type: 'sloth', label: '🦥 Bicho-preguiça' },
  { type: 'rhino_beetle', label: '🪲 Besouro-rinoceronte' },
  { type: 'sawyer_beetle', label: '🪲 Besouro-serra-pau' },
  { type: 'giant_centipede', label: '🐛 Lacraia-gigante' },
  { type: 'sucuri', label: '🐍 Sucuri' },
  { type: 'elite_jaguar', label: '🐆 Onça-pintada' },
  { type: 'elite_tapir', label: '🐗 Anta' },
  { type: 'elite_goliath_spider', label: '🕷️ Aranha-golias' },
  { type: 'piranha', label: '🐟 Piranha' },
  { type: 'pink_river_dolphin', label: '🐬 Boto-cor-de-rosa' },
  { type: 'giant_otter', label: '🦦 Ariranha' },
  { type: 'elite_black_caiman', label: '🐊 Jacaré-açu' },
];

const AMAZON_DEV_BOSSES: { type: EnemyType; label: string }[] = [
  { type: 'boss_curupira', label: '🌳 Curupira' },
  { type: 'boss_saci', label: '🌪️ Saci-pererê' },
  { type: 'boss_boto', label: '🐬 Boto-cor-de-rosa' },
  { type: 'boss_iara', label: '🧜 Iara' },
  { type: 'boss_caipora', label: '🐗 Caipora' },
  { type: 'boss_matinta', label: '🦉 Matinta Pereira' },
  { type: 'boss_vitoria_regia', label: '🪷 Vitória-Régia' },
  { type: 'boss_mapinguari', label: '👁️ Mapinguari' },
  { type: 'boss_cobra_grande', label: '🐍 Cobra-Grande' },
  { type: 'boss_boitata', label: '🔥 Boitatá' },
];

interface DevToolsProps {
  getEngine: () => GameEngine | null;
  savedData: SavedGameData;
  onUpdateSave: (newData: SavedGameData) => void;
  gameState: string;
}

type TabType = 'player' | 'arsenal' | 'world' | 'debug' | 'save';

export const DevTools: React.FC<DevToolsProps> = ({
  getEngine,
  savedData,
  onUpdateSave,
  gameState,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('player');
  const [spawnMultiplier, setSpawnMultiplier] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [pauseWhenOpen, setPauseWhenOpen] = useState(false);

  // Telemetry state synced via useEffect (avoids ref access during render)
  const [telemetry, setTelemetry] = useState<DevTelemetrySnapshot | null>(null);

  // Poll telemetry when open or every 400ms when playing
  useEffect(() => {
    const updateSnapshot = () => {
      const engine = getEngine();
      if (engine) {
        setTelemetry(engine.getDevTelemetry());
      } else {
        setTelemetry(null);
      }
    };

    updateSnapshot();
    const interval = setInterval(updateSnapshot, isOpen ? 150 : 500);
    return () => clearInterval(interval);
  }, [getEngine, isOpen, gameState]);

  // Handle global shortcut: Backquote (` or ~)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle "pause when open"
  useEffect(() => {
    const engine = getEngine();
    if (!engine || !pauseWhenOpen) return;
    if (isOpen) {
      engine.pause();
    } else {
      if (gameState === 'playing') {
        engine.resume();
      }
    }
  }, [isOpen, pauseWhenOpen, getEngine, gameState]);

  const allWeaponIds = Object.keys(WEAPON_REGISTRY) as WeaponId[];
  const allPassiveIds = Object.keys(PASSIVE_REGISTRY) as PassiveId[];

  const hasEngine = telemetry !== null;

  // Actions
  const handleToggleGodMode = () => {
    const engine = getEngine();
    if (!engine) return;
    engine.devToggleGodMode();
    setTelemetry(engine.getDevTelemetry());
  };

  const handleToggleInfiniteStamina = () => {
    const engine = getEngine();
    if (!engine) return;
    engine.devToggleInfiniteStamina();
    setTelemetry(engine.getDevTelemetry());
  };

  const handleToggleFreezeSpawns = () => {
    const engine = getEngine();
    if (!engine) return;
    engine.devSetFreezeSpawns(!engine.debugConfig.freezeSpawns);
    setTelemetry(engine.getDevTelemetry());
  };

  const handleToggleHitboxes = () => {
    const engine = getEngine();
    if (!engine) return;
    engine.devToggleHitboxes();
    setTelemetry(engine.getDevTelemetry());
  };

  const handleToggleRanges = () => {
    const engine = getEngine();
    if (!engine) return;
    engine.devToggleRanges();
    setTelemetry(engine.getDevTelemetry());
  };

  const handleToggleSpatialGrid = () => {
    const engine = getEngine();
    if (!engine) return;
    engine.devToggleSpatialGrid();
    setTelemetry(engine.getDevTelemetry());
  };

  const handleSetTimeScale = (scale: number) => {
    const engine = getEngine();
    if (!engine) return;
    engine.devSetTimeScale(scale);
    setTelemetry(engine.getDevTelemetry());
  };

  const handleModifyStat = (
    stat: 'might' | 'speed' | 'cooldownReduction' | 'pickupRadius',
    delta: number
  ) => {
    const engine = getEngine();
    if (!engine) return;
    engine.devModifyStat(stat, delta);
    setTelemetry(engine.getDevTelemetry());
  };

  const handleMaximizeAllEquipped = () => {
    const engine = getEngine();
    if (!engine) return;
    engine.devMaximizeAllEquipped();
    setTelemetry(engine.getDevTelemetry());
  };

  const handleEvolveAllEquipped = () => {
    const engine = getEngine();
    if (!engine) return;
    engine.devEvolveAllEquipped();
    setTelemetry(engine.getDevTelemetry());
  };

  const handleClearExtraWeapons = () => {
    const engine = getEngine();
    if (!engine) return;
    engine.devClearExtraWeapons();
    setTelemetry(engine.getDevTelemetry());
  };

  // Save Helpers
  const addSaveGold = (amount: number) => {
    const updated: SavedGameData = {
      ...savedData,
      gold: Math.max(0, (savedData.gold || 0) + amount),
    };
    saveGameData(updated);
    onUpdateSave(updated);
  };

  const addAccountXp = (amount: number) => {
    const updated: SavedGameData = {
      ...savedData,
      accountXp: Math.max(0, (savedData.accountXp || 0) + amount),
    };
    saveGameData(updated);
    onUpdateSave(updated);
  };

  const maximizePowerUps = () => {
    const powerUps: Record<string, number> = {};
    POWER_UP_DEFINITIONS.forEach((def) => {
      powerUps[def.id] = def.maxLevel;
    });
    const updated: SavedGameData = {
      ...savedData,
      powerUps,
    };
    saveGameData(updated);
    onUpdateSave(updated);
  };

  const completeActiveMissions = () => {
    const currentMissions = { ...savedData.missions };
    const maxProgress: Record<string, number> = {};
    DAILY_POOL.forEach((m) => {
      maxProgress[m.id] = m.target;
    });
    WEEKLY_MISSIONS.forEach((m) => {
      maxProgress[m.id] = m.target;
    });
    SECRET_MISSIONS.forEach((m) => {
      maxProgress[m.id] = m.target;
    });

    if (currentMissions.daily) {
      currentMissions.daily = {
        ...currentMissions.daily,
        progress: { ...currentMissions.daily.progress, ...maxProgress },
      };
    }
    if (currentMissions.weekly) {
      currentMissions.weekly = {
        ...currentMissions.weekly,
        progress: { ...currentMissions.weekly.progress, ...maxProgress },
      };
    }
    if (currentMissions.secret) {
      currentMissions.secret = {
        ...currentMissions.secret,
        progress: { ...currentMissions.secret.progress, ...maxProgress },
      };
    }
    const updated: SavedGameData = {
      ...savedData,
      missions: currentMissions,
    };
    saveGameData(updated);
    onUpdateSave(updated);
  };

  const handleResetSave = () => {
    const initial = getInitialSave();
    saveGameData(initial);
    onUpdateSave(initial);
    setConfirmReset(false);
  };

  return (
    <aside
      className="fixed bottom-4 right-4 z-[120] pointer-events-auto select-none font-sans"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      aria-label="Ferramentas de Desenvolvedor"
    >
      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all cursor-pointer ${
          isOpen
            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold scale-105'
            : 'bg-slate-900/90 hover:bg-slate-800 text-amber-400 border-amber-500/40 hover:border-amber-400 shadow-amber-950/40'
        }`}
        title="Ferramentas Dev (Atalho: `)"
      >
        {isOpen ? (
          <X className="w-5 h-5 shrink-0" />
        ) : (
          <Wrench className="w-5 h-5 shrink-0 group-hover:rotate-45 transition-transform" />
        )}
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
          {isOpen ? 'Fechar Dev' : 'DevTools'}
        </span>

        {/* Small Badges on Button */}
        {!isOpen && telemetry && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300">
              {telemetry.fps} FPS
            </span>
            {telemetry.godMode && (
              <span className="text-[9px] font-black px-1 rounded bg-red-600 text-white animate-pulse">
                GOD
              </span>
            )}
            {telemetry.timeScale !== 1 && (
              <span className="text-[9px] font-black px-1 rounded bg-cyan-600 text-white">
                {telemetry.timeScale}x
              </span>
            )}
          </div>
        )}
      </button>

      {/* DevTools Drawer / Popover */}
      {isOpen && (
        <div
          className="fixed bottom-16 right-4 w-[360px] sm:w-[460px] max-h-[82vh] flex flex-col bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl text-slate-200 overflow-hidden"
          role="dialog"
          aria-label="Painel de Ferramentas de Desenvolvedor"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/70">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <h2 className="font-bold text-sm tracking-wide text-white">Ferramentas de Desenvolvedor</h2>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  hasEngine
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {hasEngine ? 'Em Partida' : 'No Menu'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {hasEngine && (
                <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pauseWhenOpen}
                    onChange={(e) => setPauseWhenOpen(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  Pausar ao abrir
                </label>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800/80 bg-slate-900/40 text-xs font-semibold overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('player')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'player'
                  ? 'border-amber-400 text-amber-300 bg-amber-400/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Jogador
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('arsenal')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'arsenal'
                  ? 'border-amber-400 text-amber-300 bg-amber-400/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              Arsenal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('world')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'world'
                  ? 'border-amber-400 text-amber-300 bg-amber-400/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Mundo & Spawns
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('debug')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'debug'
                  ? 'border-amber-400 text-amber-300 bg-amber-400/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Telemetria
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('save')}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'save'
                  ? 'border-amber-400 text-amber-300 bg-amber-400/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              Conta & Save
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* 1. JOGADOR & CHEATS */}
            {activeTab === 'player' && (
              <>
                {!hasEngine ? (
                  <div className="text-center py-8 text-slate-400">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-300">Modificadores de Jogador</p>
                    <p className="text-[11px] mt-1">Inicie uma partida para usar os cheats e comandos de jogador.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Toggles */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleToggleGodMode}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                          telemetry?.godMode
                            ? 'bg-red-950/80 border-red-500 text-red-200 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-red-400" />
                          Modo Deus
                        </span>
                        <span className={`text-[10px] uppercase font-mono px-1.5 rounded ${telemetry?.godMode ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          {telemetry?.godMode ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleInfiniteStamina}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                          telemetry?.infiniteStamina
                            ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-cyan-400" />
                          Stamina Infinita
                        </span>
                        <span className={`text-[10px] uppercase font-mono px-1.5 rounded ${telemetry?.infiniteStamina ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          {telemetry?.infiniteStamina ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </div>

                    {/* Quick Player Actions */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Ações Rápidas
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            getEngine()?.devHealPlayer();
                            const eng = getEngine();
                            if (eng) setTelemetry(eng.getDevTelemetry());
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800/80 text-emerald-300 font-semibold transition cursor-pointer"
                        >
                          <Heart className="w-3.5 h-3.5 text-emerald-400" />
                          Curar 100% HP
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            getEngine()?.devMagnetAll();
                            const eng = getEngine();
                            if (eng) setTelemetry(eng.getDevTelemetry());
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/80 text-amber-300 font-semibold transition cursor-pointer"
                        >
                          <Magnet className="w-3.5 h-3.5 text-amber-400" />
                          Ímã Global
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            getEngine()?.devForceLevelUp();
                            const eng = getEngine();
                            if (eng) setTelemetry(eng.getDevTelemetry());
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800/80 text-indigo-300 font-semibold transition cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          +1 Nível (Escolher)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            getEngine()?.devDirectAddLevel(1);
                            const eng = getEngine();
                            if (eng) setTelemetry(eng.getDevTelemetry());
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-slate-400" />
                          +1 Nível Direto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            getEngine()?.devDirectAddLevel(5);
                            const eng = getEngine();
                            if (eng) setTelemetry(eng.getDevTelemetry());
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-slate-400" />
                          +5 Níveis Direto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            getEngine()?.devAddGold(500);
                            const eng = getEngine();
                            if (eng) setTelemetry(eng.getDevTelemetry());
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-yellow-950/50 hover:bg-yellow-900/60 border border-yellow-800/80 text-yellow-300 font-semibold transition cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5 text-yellow-400" />
                          +500 Ouro
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            getEngine()?.devForceVictory();
                            const eng = getEngine();
                            if (eng) setTelemetry(eng.getDevTelemetry());
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/80 text-purple-300 font-semibold transition cursor-pointer"
                        >
                          <Trophy className="w-3.5 h-3.5 text-purple-400" />
                          Forçar Vitória
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            getEngine()?.devForceGameOver();
                            const eng = getEngine();
                            if (eng) setTelemetry(eng.getDevTelemetry());
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 font-semibold transition cursor-pointer"
                        >
                          <Skull className="w-3.5 h-3.5 text-rose-400" />
                          Forçar Game Over
                        </button>
                      </div>
                    </div>

                    {/* Stats Overrides / Sliders */}
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Modificadores em Tempo Real
                      </span>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Poder de Dano (Might):</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleModifyStat('might', -0.5)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-amber-300 min-w-10 text-center">
                            {telemetry?.might ?? 1}x
                          </span>
                          <button
                            type="button"
                            onClick={() => handleModifyStat('might', 0.5)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Velocidade de Movimento:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleModifyStat('speed', -30)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-cyan-300 min-w-10 text-center">
                            {telemetry?.speed ?? 160}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleModifyStat('speed', 30)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Redução de Recarga:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleModifyStat('cooldownReduction', -0.1)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-purple-300 min-w-10 text-center">
                            {telemetry?.cooldownReduction ?? 0}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleModifyStat('cooldownReduction', 0.1)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Raio de Coleta (Ímã):</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleModifyStat('pickupRadius', -25)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-yellow-300 min-w-10 text-center">
                            {telemetry?.pickupRadius ?? 65}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleModifyStat('pickupRadius', 25)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 2. ARSENAL & BUILDS */}
            {activeTab === 'arsenal' && (
              <>
                {!hasEngine ? (
                  <div className="text-center py-8 text-slate-400">
                    <Swords className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-300">Editor de Arsenal</p>
                    <p className="text-[11px] mt-1">Inicie uma partida para equipar, evoluir ou remover armas e passivos.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Global Build Actions */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={handleMaximizeAllEquipped}
                        className="p-2 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800 text-indigo-200 font-semibold text-[11px] transition cursor-pointer"
                      >
                        ⚡ Maximizar Equipados
                      </button>
                      <button
                        type="button"
                        onClick={handleEvolveAllEquipped}
                        className="p-2 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-200 font-semibold text-[11px] transition cursor-pointer"
                      >
                        🌟 Evoluir Armas
                      </button>
                      <button
                        type="button"
                        onClick={handleClearExtraWeapons}
                        className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-200 font-semibold text-[11px] transition cursor-pointer"
                      >
                        🗑️ Limpar Extras
                      </button>
                    </div>

                    {/* Filter Input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar arma ou passivo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Weapons List */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Armas ({allWeaponIds.length})
                      </span>
                      <div className="space-y-1.5 max-h-[35vh] overflow-y-auto pr-1">
                        {allWeaponIds
                          .filter((wId) => {
                            const meta = WEAPON_REGISTRY[wId];
                            return (
                              meta.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              meta.evolvedName.toLowerCase().includes(searchTerm.toLowerCase())
                            );
                          })
                          .map((wId) => {
                            const meta = WEAPON_REGISTRY[wId];
                            const current = telemetry?.weapons.find((w) => w.id === wId);
                            const level = current?.level ?? 0;
                            const isEvolved = current?.evolved ?? false;

                            return (
                              <div
                                key={wId}
                                className={`flex items-center justify-between p-2 rounded-lg border transition ${
                                  level > 0
                                    ? isEvolved
                                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                                      : 'bg-slate-900 border-slate-700 text-slate-200'
                                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-1 rounded bg-slate-950 border border-slate-800 shrink-0">
                                    {renderWeaponIcon(wId, 'w-4 h-4')}
                                  </div>
                                  <div className="truncate">
                                    <div className="font-bold text-xs truncate">
                                      {isEvolved ? `★ ${meta.evolvedName}` : meta.name}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {level === 0 ? 'Não equipada' : `Nível ${level}/${meta.maxLevel}`}
                                      {isEvolved && ' (Evoluída)'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const engine = getEngine();
                                      if (!engine) return;
                                      engine.weaponSystem.devSetWeaponLevel(wId, level + 1);
                                      setTelemetry(engine.getDevTelemetry());
                                    }}
                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
                                    title="+1 Nível"
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const engine = getEngine();
                                      if (!engine) return;
                                      engine.weaponSystem.devSetWeaponLevel(wId, meta.maxLevel);
                                      setTelemetry(engine.getDevTelemetry());
                                    }}
                                    className="px-2 py-1 rounded bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 font-bold transition cursor-pointer"
                                    title="Nível Máximo"
                                  >
                                    Max
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const engine = getEngine();
                                      if (!engine) return;
                                      engine.weaponSystem.devSetWeaponLevel(wId, meta.maxLevel, true);
                                      setTelemetry(engine.getDevTelemetry());
                                    }}
                                    className={`px-2 py-1 rounded font-bold transition cursor-pointer ${
                                      isEvolved
                                        ? 'bg-amber-500 text-slate-950'
                                        : 'bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-700/60'
                                    }`}
                                    title="Evoluir Arma"
                                  >
                                    ★
                                  </button>
                                  {level > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const engine = getEngine();
                                        if (!engine) return;
                                        engine.weaponSystem.devRemoveWeapon(wId);
                                        setTelemetry(engine.getDevTelemetry());
                                      }}
                                      className="p-1 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 transition cursor-pointer"
                                      title="Remover Arma"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Passives List */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Passivos ({allPassiveIds.length})
                      </span>
                      <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
                        {allPassiveIds
                          .filter((pId) => {
                            const meta = PASSIVE_REGISTRY[pId];
                            return meta.name.toLowerCase().includes(searchTerm.toLowerCase());
                          })
                          .map((pId) => {
                            const meta = PASSIVE_REGISTRY[pId];
                            const engine = getEngine();
                            const current = engine?.weaponSystem.passives.get(pId);
                            const level = current?.level ?? 0;

                            return (
                              <div
                                key={pId}
                                className={`flex items-center justify-between p-2 rounded-lg border transition ${
                                  level > 0
                                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="p-1 rounded bg-slate-950 border border-slate-800 shrink-0">
                                    {renderPassiveIcon(pId, 'w-4 h-4')}
                                  </div>
                                  <div className="truncate">
                                    <div className="font-bold text-xs truncate">{meta.name}</div>
                                    <div className="text-[10px] text-slate-400">
                                      {level === 0 ? 'Não equipado' : `Nível ${level}/${meta.maxLevel}`}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const eng = getEngine();
                                      if (!eng) return;
                                      eng.weaponSystem.devSetPassiveLevel(pId, level + 1, eng.player);
                                      setTelemetry(eng.getDevTelemetry());
                                    }}
                                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer"
                                    title="+1 Nível"
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const eng = getEngine();
                                      if (!eng) return;
                                      eng.weaponSystem.devSetPassiveLevel(pId, meta.maxLevel, eng.player);
                                      setTelemetry(eng.getDevTelemetry());
                                    }}
                                    className="px-2 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 font-bold transition cursor-pointer"
                                    title="Nível Máximo"
                                  >
                                    Max
                                  </button>
                                  {level > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const eng = getEngine();
                                        if (!eng) return;
                                        eng.weaponSystem.devRemovePassive(pId, eng.player);
                                        setTelemetry(eng.getDevTelemetry());
                                      }}
                                      className="p-1 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 transition cursor-pointer"
                                      title="Remover Passivo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 3. MUNDO, TEMPO & SPAWNS */}
            {activeTab === 'world' && (
              <>
                {!hasEngine ? (
                  <div className="text-center py-8 text-slate-400">
                    <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-300">Controles de Mundo & Horda</p>
                    <p className="text-[11px] mt-1">Inicie uma partida para controlar o tempo, spawns e monstros.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Time Scale */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Velocidade do Jogo (Time Scale)
                      </span>
                      <div className="grid grid-cols-6 gap-1">
                        {[0.25, 0.5, 1.0, 2.0, 4.0, 8.0].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleSetTimeScale(s)}
                            className={`py-1.5 rounded-lg font-mono font-bold text-xs transition cursor-pointer ${
                              telemetry?.timeScale === s
                                ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/30 shadow'
                                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Clock Skips */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Avançar Relógio da Partida
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSkipTime(30);
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer"
                        >
                          +30s
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSkipTime(60);
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer"
                        >
                          +1 Minuto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            const target = 295; // 04:55
                            if (engine.waveDirector.survivalTime < target) {
                              engine.devSkipTime(target - engine.waveDirector.survivalTime);
                            }
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-1.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          04:55 (Boss)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnEnemy('boss_vampire');
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          👑 Boss Já
                        </button>
                      </div>
                    </div>

                    {/* Spawner / Horde Controls */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Controle da Horda
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">Qtd:</span>
                          {[1, 5, 20].map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => setSpawnMultiplier(q)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                                spawnMultiplier === q
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {q}x
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Horde Clears & Freeze */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleToggleFreezeSpawns}
                          className={`flex items-center justify-between p-2 rounded-lg border transition cursor-pointer ${
                            telemetry?.freezeSpawns
                              ? 'bg-sky-950/80 border-sky-500 text-sky-200 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span>❄️ Pausar Spawns</span>
                          <span className="text-[9px] uppercase font-mono px-1 rounded bg-slate-800">
                            {telemetry?.freezeSpawns ? 'ATIVO' : 'LIVRE'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devKillAllEnemies(true);
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs transition cursor-pointer"
                        >
                          <Skull className="w-3.5 h-3.5" />
                          Matar Todos (+Drops)
                        </button>
                      </div>

                      {/* Spawn Monsters Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnDummy();
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/80 text-amber-300 font-semibold text-[11px] transition cursor-pointer text-left"
                        >
                          🎯 Boneco Dummy (1M HP)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnEnemy('bat', spawnMultiplier);
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer text-left"
                        >
                          🦇 Morcego
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnEnemy('skeleton', spawnMultiplier);
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer text-left"
                        >
                          💀 Esqueleto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnEnemy('zombie', spawnMultiplier);
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer text-left"
                        >
                          🧟 Zumbi
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnEnemy('ghost', spawnMultiplier);
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-[11px] transition cursor-pointer text-left"
                        >
                          👻 Fantasma
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnEnemy('elite_minotaur', Math.min(5, spawnMultiplier));
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800 text-purple-300 font-semibold text-[11px] transition cursor-pointer text-left"
                        >
                          ⚔️ Minotauro Elite
                        </button>
                      </div>

                      {/* Spawn Amazon Forest Monsters Grid */}
                      <div>
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-2">
                          Animais da Floresta Amazônica
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {AMAZON_DEV_MONSTERS.map(({ type, label }) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                const engine = getEngine();
                                if (!engine) return;
                                const count = type.startsWith('elite_')
                                  ? Math.min(5, spawnMultiplier)
                                  : spawnMultiplier;
                                engine.devSpawnEnemy(type, count);
                                setTelemetry(engine.getDevTelemetry());
                              }}
                              className="p-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/80 text-emerald-300 font-semibold text-[11px] transition cursor-pointer text-left"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Spawn Amazon Folklore Bosses Grid */}
                      <div>
                        <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-2">
                          Chefes do Folclore Amazônico (10)
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {AMAZON_DEV_BOSSES.map(({ type, label }) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                const engine = getEngine();
                                if (!engine) return;
                                engine.devSpawnEnemy(type, 1);
                                setTelemetry(engine.getDevTelemetry());
                              }}
                              className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 font-semibold text-[11px] transition cursor-pointer text-left"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Spawn Drops Grid */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Gerar Drops / Itens
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnDrop('chest');
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800 text-amber-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          🎁 Baú de Tesouro
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnDrop('chicken');
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          🍗 Frango Assado
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnDrop('magnet');
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800 text-sky-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          🧲 Ímã
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnDrop('rosary');
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800 text-indigo-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          ✝️ Rosário
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnDrop('gem_red');
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800 text-rose-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          💎 Gema Boss (XP)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const engine = getEngine();
                            if (!engine) return;
                            engine.devSpawnDrop('coin', 5);
                            setTelemetry(engine.getDevTelemetry());
                          }}
                          className="p-2 rounded-lg bg-yellow-950/50 hover:bg-yellow-900/60 border border-yellow-800 text-yellow-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          🪙 Moedas (x5)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 4. TELEMETRIA & DEBUG VISUAL */}
            {activeTab === 'debug' && (
              <>
                {!hasEngine ? (
                  <div className="text-center py-8 text-slate-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-300">Telemetria & Overlays</p>
                    <p className="text-[11px] mt-1">Inicie uma partida para monitorar FPS, hitboxes e métricas de dano.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Performance Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Taxa de Quadros</span>
                        <span className="font-mono text-lg font-black text-emerald-400">
                          {telemetry?.fps ?? 60} <span className="text-xs font-normal">FPS</span>
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Tempo de Frame</span>
                        <span className="font-mono text-lg font-black text-cyan-400">
                          {telemetry?.frameTimeMs ?? 16.6} <span className="text-xs font-normal">ms</span>
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Inimigos Vivos</span>
                        <span className="font-mono text-lg font-black text-rose-400">
                          {telemetry?.enemyCount ?? 0}
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Projéteis & Zonas</span>
                        <span className="font-mono text-lg font-black text-amber-400">
                          {(telemetry?.projectileCount ?? 0) + (telemetry?.groundZoneCount ?? 0)}
                        </span>
                      </div>
                    </div>

                    {/* Canvas Overlays Toggles */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Camadas de Renderização de Debug
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={handleToggleHitboxes}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                            telemetry && telemetry.weapons ? 'border-slate-700' : ''
                          } ${
                            telemetry?.godMode !== undefined
                              ? 'bg-slate-900 hover:bg-slate-800 text-slate-200'
                              : ''
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                            Hitboxes
                          </span>
                          <span className="text-[9px] uppercase font-mono px-1 rounded bg-slate-800 text-slate-300">
                            Alternar
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleToggleRanges}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-purple-400" />
                            Raios & Auras
                          </span>
                          <span className="text-[9px] uppercase font-mono px-1 rounded bg-slate-800 text-slate-300">
                            Alternar
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={handleToggleSpatialGrid}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-sky-400" />
                            Grade 110px
                          </span>
                          <span className="text-[9px] uppercase font-mono px-1 rounded bg-slate-800 text-slate-300">
                            Alternar
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Live Weapon DPS Table */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        Medidor de DPS por Arma Ao Vivo
                      </span>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                            <tr>
                              <th className="p-2">Arma</th>
                              <th className="p-2 text-center">Nível</th>
                              <th className="p-2 text-right">Dano Total</th>
                              <th className="p-2 text-right">DPS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {telemetry?.weapons && telemetry.weapons.length > 0 ? (
                              telemetry.weapons.map((w) => (
                                <tr key={w.id} className="hover:bg-slate-800/40">
                                  <td className="p-2 font-sans font-semibold text-slate-200 flex items-center gap-1.5">
                                    {renderWeaponIcon(w.id, 'w-3.5 h-3.5')}
                                    <span className="truncate">{w.name}</span>
                                  </td>
                                  <td className="p-2 text-center text-slate-400">
                                    {w.evolved ? '★ Nv.Max' : `Nv. ${w.level}`}
                                  </td>
                                  <td className="p-2 text-right text-amber-300 font-bold">
                                    {w.totalDamage.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-right text-emerald-400 font-bold">
                                    {w.dps}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="p-3 text-center text-slate-500 font-sans text-xs">
                                  Nenhuma arma ativa.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 5. CONTA & SAVE */}
            {activeTab === 'save' && (
              <div className="space-y-4">
                {/* Save Info */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Perfil Atual em Disco (`localStorage`)
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Ouro Acumulado:</span>
                      <span className="font-mono font-bold text-yellow-300 text-sm">
                        {(savedData.gold || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">XP de Conta:</span>
                      <span className="font-mono font-bold text-indigo-300 text-sm">
                        {(savedData.accountXp || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Vitórias Registradas:</span>
                      <span className="font-mono font-bold text-emerald-300 text-sm">
                        {savedData.highScore?.wins || 0}
                      </span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">Kills Recorde:</span>
                      <span className="font-mono font-bold text-rose-300 text-sm">
                        {(savedData.highScore?.kills || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Save Actions */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Modificar Moedas e Progresso
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => addSaveGold(1000)}
                      className="p-2 rounded-lg bg-yellow-950/50 hover:bg-yellow-900/60 border border-yellow-800 text-yellow-300 font-semibold text-xs transition cursor-pointer"
                    >
                      +1.000 Ouro
                    </button>
                    <button
                      type="button"
                      onClick={() => addSaveGold(10000)}
                      className="p-2 rounded-lg bg-yellow-950/50 hover:bg-yellow-900/60 border border-yellow-800 text-yellow-300 font-semibold text-xs transition cursor-pointer"
                    >
                      +10.000 Ouro
                    </button>
                    <button
                      type="button"
                      onClick={() => addSaveGold(-(savedData.gold || 0))}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                    >
                      Zerar Ouro
                    </button>
                    <button
                      type="button"
                      onClick={() => addAccountXp(500)}
                      className="p-2 rounded-lg bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800 text-indigo-300 font-semibold text-xs transition cursor-pointer"
                    >
                      +500 XP Conta
                    </button>
                    <button
                      type="button"
                      onClick={() => addAccountXp(5000)}
                      className="p-2 rounded-lg bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-800 text-indigo-300 font-semibold text-xs transition cursor-pointer"
                    >
                      +5.000 XP Conta
                    </button>
                    <button
                      type="button"
                      onClick={completeActiveMissions}
                      className="p-2 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-300 font-semibold text-xs transition cursor-pointer"
                    >
                      Completar Missões
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={maximizePowerUps}
                    className="w-full p-2.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-800 text-purple-200 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Maximizar Todas as Melhorias da Loja
                  </button>
                </div>

                {/* Factory Reset */}
                <div className="pt-2 border-t border-slate-800/80">
                  {confirmReset ? (
                    <div className="bg-rose-950/70 border border-rose-500 rounded-xl p-3 text-center space-y-2">
                      <p className="font-bold text-xs text-rose-200">
                        Tem certeza? Todo o progresso do jogo será apagado.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={handleResetSave}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition cursor-pointer"
                        >
                          Sim, Apagar Tudo
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="w-full p-2 rounded-lg bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Resetar Save Completo
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
