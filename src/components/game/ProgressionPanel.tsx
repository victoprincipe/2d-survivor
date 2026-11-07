'use client';

import React, { useState } from 'react';
import { SavedGameData } from '@/game/types';
import { ACHIEVEMENTS } from '@/game/data/achievements';
import { saveGameData } from '@/game/data/persistence';
import {
  claimMission,
  getAccountLevelInfo,
  getActiveMissions,
  metricLabel,
} from '@/game/data/progress';
import { MissionCategory } from '@/game/data/missions';
import { Coins, Sparkles, Trophy, Clock } from 'lucide-react';

interface ProgressionPanelProps {
  savedData: SavedGameData;
  onUpdateSave: (data: SavedGameData) => void;
}

const CATEGORY_LABEL: Record<MissionCategory, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  secreta: 'Secreta',
  especial: 'Especial',
};

const CATEGORY_STYLE: Record<MissionCategory, string> = {
  diaria: 'bg-cyan-950/80 border-cyan-700 text-cyan-300',
  semanal: 'bg-purple-950/80 border-purple-700 text-purple-300',
  secreta: 'bg-rose-950/80 border-rose-700 text-rose-300',
  especial: 'bg-amber-950/80 border-amber-700 text-amber-300',
};

export const ProgressionPanel: React.FC<ProgressionPanelProps> = ({ savedData, onUpdateSave }) => {
  const [tab, setTab] = useState<'missions' | 'achievements'>('missions');
  const account = getAccountLevelInfo(savedData.accountXp);
  const missions = getActiveMissions(savedData);

  const handleClaim = (key: string) => {
    const updated = claimMission(savedData, key);
    if (!updated) return;
    saveGameData(updated);
    onUpdateSave(updated);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Account level */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 border border-yellow-300 flex items-center justify-center font-black text-amber-950">
              {account.level}
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-white">Nível de Conta</div>
              <div className="text-[10px] text-slate-400 font-mono">
                {account.xpIntoLevel} / {account.xpForNext} XP
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-400 font-mono">
            Total: {savedData.accountXp} XP
          </div>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full"
            style={{ width: `${account.progress}%` }}
          />
        </div>
      </div>

      {/* Inner tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('missions')}
          className={`flex-1 py-2 rounded-lg border text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            tab === 'missions'
              ? 'bg-cyan-950/80 border-cyan-500 text-white'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Missões
        </button>
        <button
          onClick={() => setTab('achievements')}
          className={`flex-1 py-2 rounded-lg border text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
            tab === 'achievements'
              ? 'bg-amber-950/80 border-amber-500 text-white'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Conquistas
        </button>
      </div>

      {tab === 'missions' && (
        <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          {missions.map((mission) => {
            const revealed = !mission.def.secret || mission.complete;
            const progressPercent = Math.min(100, (mission.progress / mission.def.target) * 100);
            const canClaim = mission.complete && !mission.claimed;

            return (
              <div
                key={mission.key}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${CATEGORY_STYLE[mission.def.category]}`}
                      >
                        {CATEGORY_LABEL[mission.def.category]}
                      </span>
                      <span className="text-sm font-bold text-white truncate">
                        {revealed ? mission.def.title : 'Missão Secreta'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {revealed ? mission.def.description : 'Conclua a missão para revelar seus detalhes.'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-yellow-300 font-mono text-xs font-bold">
                      <Coins className="w-3 h-3" />
                      {mission.def.rewardGold}
                    </div>
                    <div className="text-[10px] text-cyan-300 font-mono">+{mission.def.rewardXp} XP</div>
                  </div>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      mission.claimed
                        ? 'bg-emerald-500'
                        : mission.complete
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                          : 'bg-cyan-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {revealed
                      ? `${Math.min(mission.progress, mission.def.target)} / ${mission.def.target} ${metricLabel(mission.def.metric)}`
                      : `${mission.def.target}+ ${metricLabel(mission.def.metric)}`}
                  </span>

                  {mission.claimed ? (
                    <span className="text-[10px] font-black uppercase text-emerald-400">✓ Coletado</span>
                  ) : (
                    <button
                      onClick={() => handleClaim(mission.key)}
                      disabled={!canClaim}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                        canClaim
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer active:scale-95'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {canClaim ? 'Resgatar' : 'Em andamento'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'achievements' && (
        <div className="grid grid-cols-1 gap-2 max-h-72 overflow-y-auto pr-1">
          {ACHIEVEMENTS.map((achievement) => {
            const unlocked = savedData.achievements.includes(achievement.id);
            const revealed = !achievement.hidden || unlocked;
            return (
              <div
                key={achievement.id}
                className={`rounded-xl p-3 border flex items-center justify-between gap-3 ${
                  unlocked
                    ? 'bg-amber-950/40 border-amber-600/70'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                      unlocked
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-700 text-slate-600'
                    }`}
                  >
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-bold truncate ${unlocked ? 'text-amber-200' : 'text-slate-300'}`}>
                      {revealed ? achievement.name : 'Conquista Secreta'}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {revealed ? achievement.description : 'Um feito oculto aguarda ser descoberto.'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {unlocked ? (
                    <span className="text-[10px] font-black uppercase text-emerald-400">✓ Feito</span>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-yellow-300 font-mono flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {achievement.rewardGold}
                      </span>
                      <span className="text-[9px] text-cyan-300 font-mono">
                        <Sparkles className="inline w-2.5 h-2.5 mr-0.5" />
                        {achievement.rewardXp} XP
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
