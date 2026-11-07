'use client';

import React, { useRef } from 'react';
import { MissionDefinition, MissionPeriod, SavedGameData } from '@/game/types';
import {
  claimMissionReward,
  formatMissionProgress,
  getActiveMissions,
  getMissionProgress,
  isMissionClaimed,
  isMissionComplete,
  normalizeMissionState,
} from '@/game/data/missions';
import { loadSavedData, saveGameData } from '@/game/data/persistence';
import { Check, Clock, Coins, Lock, Sparkles, Target, Trophy } from 'lucide-react';

interface MissionsTabProps {
  savedData: SavedGameData;
  onUpdateSave: (savedData: SavedGameData) => void;
}

const SECTION_META: Record<
  MissionPeriod,
  { title: string; subtitle: string; accent: string; icon: React.ReactNode }
> = {
  daily: {
    title: 'Missões Diárias',
    subtitle: 'Renovam todos os dias à meia-noite (UTC).',
    accent: 'text-cyan-400 border-cyan-700/60',
    icon: <Clock className="w-4 h-4 text-cyan-400" />,
  },
  weekly: {
    title: 'Missões Semanais',
    subtitle: 'Renovam toda segunda-feira (UTC).',
    accent: 'text-purple-400 border-purple-700/60',
    icon: <Trophy className="w-4 h-4 text-purple-400" />,
  },
  secret: {
    title: 'Missões Secretas',
    subtitle: 'Objetivos ocultos que revelam a recompensa ao serem concluídos.',
    accent: 'text-amber-400 border-amber-700/60',
    icon: <Lock className="w-4 h-4 text-amber-400" />,
  },
};

export const MissionsTab: React.FC<MissionsTabProps> = ({ savedData, onUpdateSave }) => {
  const claimingRef = useRef(false);
  const missions = normalizeMissionState(savedData.missions);
  const active = getActiveMissions();

  const handleClaim = (mission: MissionDefinition) => {
    if (claimingRef.current) return;
    claimingRef.current = true;
    try {
      // Read the latest save to guarantee a mission cannot be claimed twice.
      const result = claimMissionReward(loadSavedData(), mission.id);
      saveGameData(result.data);
      onUpdateSave(result.data);
    } finally {
      claimingRef.current = false;
    }
  };

  const renderMission = (mission: MissionDefinition) => {
    const progress = getMissionProgress(missions, mission);
    const complete = isMissionComplete(missions, mission);
    const claimed = isMissionClaimed(missions, mission);
    const revealed = mission.period !== 'secret' || complete || claimed;
    const percentage = Math.min(100, Math.round((progress / mission.target) * 100));

    return (
      <div
        key={mission.id}
        className={`bg-slate-950/80 border rounded-xl p-3 flex flex-col gap-2 ${
          claimed
            ? 'border-emerald-800/70'
            : complete
              ? 'border-amber-600/80 shadow-lg shadow-amber-500/5'
              : 'border-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              {!revealed && <Lock className="w-3.5 h-3.5 text-slate-500" />}
              <h4 className="font-bold text-white text-sm">
                {revealed ? mission.title : 'Objetivo Secreto'}
              </h4>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              {revealed
                ? mission.description
                : 'Conclua este objetivo oculto para revelar a recompensa.'}
            </p>
          </div>

          <div className="text-right shrink-0">
            {revealed ? (
              <div className="flex flex-col items-end gap-0.5 font-mono text-[11px]">
                <span className="text-yellow-300 flex items-center gap-1">
                  <Coins className="w-3 h-3" /> {mission.goldReward}
                </span>
                <span className="text-purple-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {mission.xpReward} XP
                </span>
              </div>
            ) : (
              <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                ???
              </span>
            )}
          </div>
        </div>

        {revealed && (
          <div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span>
                {formatMissionProgress(mission.metric, progress)} /{' '}
                {formatMissionProgress(mission.metric, mission.target)}
              </span>
              <span>{percentage}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  claimed
                    ? 'bg-emerald-500'
                    : complete
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-cyan-500'
                }`}
                style={{ width: `${Math.max(2, percentage)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          {claimed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-800 rounded-lg px-2.5 py-1">
              <Check className="w-3.5 h-3.5" /> Resgatado
            </span>
          ) : complete ? (
            <button
              onClick={() => handleClaim(mission)}
              className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg px-3 py-1.5 transition cursor-pointer active:scale-95"
            >
              <Target className="w-3.5 h-3.5" /> Resgatar
            </button>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 py-1.5">
              {revealed ? 'Em andamento' : 'Oculto'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const sections: { period: MissionPeriod; missions: MissionDefinition[] }[] = [
    { period: 'daily', missions: active.daily },
    { period: 'weekly', missions: active.weekly },
    { period: 'secret', missions: active.secret },
  ];

  return (
    <div className="w-full flex flex-col gap-3">
      {sections.map(({ period, missions: definitions }) => {
        const meta = SECTION_META[period];
        const completed = definitions.filter(
          (mission) => isMissionComplete(missions, mission) && !isMissionClaimed(missions, mission)
        ).length;

        return (
          <div
            key={period}
            className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider ${meta.accent}`}>
                  {meta.icon}
                  {meta.title}
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">{meta.subtitle}</p>
              </div>
              {completed > 0 && (
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-950/50 border border-amber-700 rounded-full px-2 py-0.5">
                  {completed} para resgatar
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">{definitions.map(renderMission)}</div>
          </div>
        );
      })}
    </div>
  );
};
