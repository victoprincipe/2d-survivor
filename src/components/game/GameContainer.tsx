'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CharacterConfig, DifficultyId, GameEndSummary, HUDState, MapId, SavedGameData, UpgradeOption } from '@/game/types';
import { CHARACTERS } from '@/game/data/characters';
import { loadSavedData } from '@/game/data/persistence';
import { getDifficulty } from '@/game/data/difficulties';
import { DEFAULT_MAP_ID } from '@/game/data/maps';
import { GameEngine } from '@/game/engine/GameEngine';
import { HUD } from './HUD';
import { CharacterHUD } from './CharacterHUD';
import { StartScreen } from './StartScreen';
import { LevelUpModal } from './LevelUpModal';
import { TreasureChestModal } from './TreasureChestModal';
import { EndGameModal } from './EndGameModal';
import { PauseModal } from './PauseModal';
import { DevTools } from './DevTools';
import { GorillaDialogue } from './GorillaDialogue';
import { ForestQuizDialogue } from './ForestQuizDialogue';
import { ForestQuizView } from '@/game/data/forestQuiz';

type GameState = 'menu' | 'playing' | 'paused' | 'level_up' | 'chest' | 'game_over' | 'victory' | 'dialogue' | 'quiz';

const DEFAULT_HUD: HUDState = {
  playerHp: 100,
  playerMaxHp: 100,
  stamina: 100,
  maxStamina: 100,
  level: 1,
  xp: 0,
  xpToNextLevel: 12,
  survivalTime: 0,
  kills: 0,
  gold: 0,
  weapons: [],
  passives: [],
};

export const GameContainer: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [forestQuiz, setForestQuiz] = useState<ForestQuizView | null>(null);
  const [savedData, setSavedData] = useState<SavedGameData>(loadSavedData);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterConfig>(CHARACTERS[0]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyId>(
    savedData.difficulty ?? 'normal'
  );
  const [selectedMap, setSelectedMap] = useState<MapId>(DEFAULT_MAP_ID);
  const [hud, setHud] = useState<HUDState>(DEFAULT_HUD);
  const [levelUpOptions, setLevelUpOptions] = useState<UpgradeOption[]>([]);
  const [chestReward, setChestReward] = useState<{ gold: number; upgrade?: UpgradeOption } | null>(null);
  const [endSummary, setEndSummary] = useState<GameEndSummary | null>(null);

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [sfxVolume, setSfxVolume] = useState<number>(0.5);
  const [bgmVolume, setBgmVolume] = useState<number>(0.3);

  const engineRef = useRef<GameEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef<GameState>('menu');

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const handleStartGame = (
    character: CharacterConfig,
    currentSavedData: SavedGameData,
    difficulty: DifficultyId = currentSavedData.difficulty ?? 'normal',
    mapId: MapId = DEFAULT_MAP_ID
  ) => {
    setSelectedCharacter(character);
    setSelectedDifficulty(difficulty);
    setSelectedMap(mapId);
    setGameState('playing');

    // Wait for canvas to be mounted in DOM
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (engineRef.current) {
        engineRef.current.destroy();
      }

      const engine = new GameEngine(canvas, character, currentSavedData, difficulty, mapId, {
        onForestQuiz: quiz => {
          setForestQuiz(quiz);
          gameStateRef.current = 'quiz';
          setGameState('quiz');
        },
        onGorillaDialogue: () => {
          gameStateRef.current = 'dialogue';
          setGameState('dialogue');
        },
        onHUDUpdate: (newHud) => {
          setHud(newHud);
        },
        onLevelUp: (options) => {
          setLevelUpOptions(options);
          setGameState('level_up');
        },
        onTreasureChest: (gold, upgrade) => {
          setChestReward({ gold, upgrade });
          setGameState('chest');
        },
        onGameOver: (summary) => {
          setEndSummary(summary);
          setGameState('game_over');
          setSavedData(loadSavedData());
        },
        onVictory: (summary) => {
          setEndSummary(summary);
          setGameState('victory');
          setSavedData(loadSavedData());
        },
      });

      engine.sound.setMuted(isMuted);
      engine.sound.setSfxVolume(sfxVolume);
      engine.sound.setBgmVolume(bgmVolume);

      engine.input.onPauseToggle = () => {
        if (gameStateRef.current === 'playing') {
          engine.pause();
          setGameState('paused');
        } else if (gameStateRef.current === 'paused') {
          engine.resume();
          setGameState('playing');
        }
      };

      engineRef.current = engine;
      engine.start();
    }, 50);
  };

  const handleSelectUpgrade = (option: UpgradeOption) => {
    if (engineRef.current) {
      engineRef.current.applyUpgrade(option);
    }
    setGameState('playing');
  };

  const handleCloseChest = () => {
    if (engineRef.current) {
      if (chestReward?.upgrade) {
        engineRef.current.applyUpgrade(chestReward.upgrade);
      } else {
        engineRef.current.resume();
      }
    }
    setChestReward(null);
    setGameState('playing');
  };

  const handlePause = () => {
    if (engineRef.current && gameState === 'playing') {
      engineRef.current.pause();
      setGameState('paused');
    }
  };

  const handleClaimMission = (missionId: string) => {
    engineRef.current?.claimAmazonMission(missionId);
  };

  const handleResume = () => {
    if (engineRef.current) {
      engineRef.current.resume();
      setGameState('playing');
    }
  };

  const handleQuitToMenu = () => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    setGameState('menu');
    setSavedData(loadSavedData());
  };

  const handleRestart = () => {
    handleStartGame(selectedCharacter, loadSavedData(), selectedDifficulty, selectedMap);
  };

  const handleContinueEndless = () => {
    if (engineRef.current) {
      engineRef.current.continueEndless();
      setGameState('playing');
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (engineRef.current) {
      engineRef.current.sound.setMuted(next);
    }
  };

  const handleSfxVolumeChange = (vol: number) => {
    setSfxVolume(vol);
    if (engineRef.current) {
      engineRef.current.sound.setSfxVolume(vol);
    }
  };

  const handleBgmVolumeChange = (vol: number) => {
    setBgmVolume(vol);
    if (engineRef.current) {
      engineRef.current.sound.setBgmVolume(vol);
    }
  };

  // Attach pointer events to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!engineRef.current) return;
      const rect = canvas.getBoundingClientRect();
      engineRef.current.handlePointerDown(e.clientX - rect.left, e.clientY - rect.top);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!engineRef.current) return;
      const rect = canvas.getBoundingClientRect();
      engineRef.current.input.handlePointerMove(e.clientX - rect.left, e.clientY - rect.top);
    };

    const onPointerUp = () => {
      if (!engineRef.current) return;
      engineRef.current.input.handlePointerUp();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    const onResize = () => {
      if (engineRef.current) engineRef.current.handleResize();
    };
    window.addEventListener('resize', onResize);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', onResize);
    };
  }, [gameState]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none touch-none">
      {/* 2D Canvas Viewport */}
      {gameState !== 'menu' && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block cursor-crosshair touch-none"
        />
      )}

      {/* Game HUD */}
      {gameState !== 'menu' && (
        <HUD
          hud={hud}
          onPause={handlePause}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          difficultyName={getDifficulty(selectedDifficulty).name}
          onClaimMission={handleClaimMission}
        />
      )}

      {/* Floating Character Status HUD */}
      {gameState === 'playing' && (
        <CharacterHUD
          character={selectedCharacter}
          level={hud.level}
          currentXp={hud.xp}
          maxXp={hud.xpToNextLevel}
        />
      )}

      {/* Overlays / Modals */}
      {gameState === 'quiz' && forestQuiz && (
        <ForestQuizDialogue quiz={forestQuiz} onAnswer={choice => {
          const next = engineRef.current?.answerForestQuiz(choice);
          if (next?.status === 'failed') {
            gameStateRef.current = 'playing';
            setGameState('playing');
            setForestQuiz(null);
          } else if (next) setForestQuiz(next);
        }} onClose={() => {
          engineRef.current?.closeForestQuiz();
          gameStateRef.current = 'playing';
          setGameState('playing');
          setForestQuiz(null);
        }} />
      )}
      {gameState === 'dialogue' && (
        <GorillaDialogue onStartCombat={() => {
          if (engineRef.current?.startGorillaCombat()) {
            gameStateRef.current = 'playing';
            setGameState('playing');
          }
        }} onClose={() => {
          engineRef.current?.resume();
          gameStateRef.current = 'playing';
          setGameState('playing');
        }} />
      )}
      {gameState === 'menu' && (
        <StartScreen
          savedData={savedData}
          onStartGame={handleStartGame}
          onUpdateSave={(newData) => setSavedData(newData)}
        />
      )}

      {gameState === 'level_up' && (
        <LevelUpModal options={levelUpOptions} onSelect={handleSelectUpgrade} />
      )}

      {gameState === 'chest' && chestReward && (
        <TreasureChestModal
          gold={chestReward.gold}
          upgrade={chestReward.upgrade}
          onClose={handleCloseChest}
        />
      )}

      {gameState === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onQuitToMenu={handleQuitToMenu}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          sfxVolume={sfxVolume}
          bgmVolume={bgmVolume}
          onSfxVolumeChange={handleSfxVolumeChange}
          onBgmVolumeChange={handleBgmVolumeChange}
        />
      )}

      {(gameState === 'game_over' || gameState === 'victory') && endSummary && (
        <EndGameModal
          summary={endSummary}
          onRestart={handleRestart}
          onContinueEndless={gameState === 'victory' ? handleContinueEndless : undefined}
        />
      )}

      {/* Developer Tools Floating Trigger & Drawer */}
      <DevTools
        getEngine={() => engineRef.current}
        savedData={savedData}
        onUpdateSave={(newData) => setSavedData(newData)}
        gameState={gameState}
      />
    </div>
  );
};
