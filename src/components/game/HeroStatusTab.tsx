'use client';

import React, { useMemo } from 'react';
import { Player } from '@/game/entities/Player';
import { CHARACTERS } from '@/game/data/characters';
import { LULA_SKILL, WEAPON_REGISTRY } from '@/game/data/upgrades';
import type { CharacterConfig } from '@/game/types';
import { renderWeaponIcon } from './GameIcons';

// Level-1 starter-weapon values mirrored from WeaponSystem.fireWeapon and each
// trigger. Damage is shown before the character's might bonus; cooldown is
// multiplied by the character's cooldown reduction below.
const HERO_WEAPON_LEVEL_ONE: Record<
  string,
  { damage: number[]; cooldown: number; cooldownFactor?: number; damageNote?: string }
> = {
  derson: { damage: [14, 18, 15], cooldown: 0.82, damageNote: 'pão / café / bolo' },
  dukarai: { damage: [18], cooldown: 1.28 },
  kayrurururu: { damage: [30], cooldown: 1.42, cooldownFactor: 0.7 },
  dr_janelinha: { damage: [13], cooldown: 0.9 },
  lula: { damage: [LULA_SKILL.damage], cooldown: LULA_SKILL.cooldown / 1000 },
};

const formatNumber = (value: number, digits = 1): string =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: digits });

const formatSeconds = (value: number): string => `${formatNumber(value, 2)} s`;

function describeCharacterPassive(character: CharacterConfig): string {
  const bonuses = character.statBonuses;
  const parts: string[] = [];
  if (bonuses.maxHp) parts.push(`+${formatNumber(bonuses.maxHp)} HP máx`);
  if (bonuses.armor) parts.push(`+${formatNumber(bonuses.armor)} armadura`);
  if (bonuses.speed) parts.push(`+${formatNumber(bonuses.speed * 100)}% velocidade`);
  if (bonuses.might) parts.push(`+${formatNumber(bonuses.might * 100)}% dano`);
  if (bonuses.cooldownReduction) {
    parts.push(`-${formatNumber(bonuses.cooldownReduction * 100)}% recarga`);
  }
  if (bonuses.recovery) parts.push(`+${formatNumber(bonuses.recovery)} HP/s regeneração`);
  if (bonuses.pickupRadius) parts.push(`+${formatNumber(bonuses.pickupRadius)} coleta`);
  if (bonuses.critChance) parts.push(`+${formatNumber(bonuses.critChance * 100)}% crítico`);
  if (bonuses.xpMultiplier) parts.push(`+${formatNumber(bonuses.xpMultiplier * 100)}% XP`);
  if (bonuses.attackSpeed) parts.push(`+${formatNumber(bonuses.attackSpeed * 100)}% vel. ataque`);
  if (bonuses.bonusAmount) parts.push(`+${formatNumber(bonuses.bonusAmount)} projétil`);
  if (bonuses.area) parts.push(`+${formatNumber(bonuses.area * 100)}% área`);
  if (bonuses.damageReduction) {
    parts.push(`+${formatNumber(bonuses.damageReduction * 100)}% redução de dano`);
  }
  if (character.id === 'lula') {
    parts.push('a cada nível: +0,8% dano, +0,8% cadência e +0,4% velocidade');
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sem bônus passivos adicionais.';
}

const StatRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 border-b border-[#2a2f3a] py-1 last:border-0">
    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-[#9ca3af]">
      {label}
    </span>
    <span className="text-right text-[11px] font-semibold leading-relaxed text-[#f3f4f6]">
      {value}
    </span>
  </div>
);

export const HeroStatusTab: React.FC = () => {
  const heroes = useMemo(
    () =>
      CHARACTERS.map((character) => ({
        character,
        player: new Player(character),
        weapon: WEAPON_REGISTRY[character.startingWeapon],
      })),
    []
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-lg border border-[#383e4c] bg-[#14171c] p-2.5 text-[11px] leading-relaxed text-[#9ca3af]">
        <span className="font-bold text-[#f3f4f6]">Valores reais no nível 1:</span> sem power-ups
        permanentes ou equipamentos. Dano e recarga mostram a arma nativa no nível 1; a recarga já
        inclui a redução do próprio herói.
      </div>

      <div className="flex max-h-[30rem] w-full flex-col gap-3 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {heroes.map(({ character, player, weapon }) => {
            const profile = HERO_WEAPON_LEVEL_ONE[character.id] ?? {
              damage: [0],
              cooldown: 0,
              cooldownFactor: 1,
              damageNote: undefined,
            };
            const cooldown =
              profile.cooldown *
              Math.max(0.45, 1 - player.cooldownReduction) *
              (profile.cooldownFactor ?? 1);
            const damage = profile.damage
              .map((value) => formatNumber(value * player.might))
              .join(' / ');

            return (
              <div
                key={character.id}
                className="flex h-full flex-col gap-2 rounded-lg border border-[#383e4c] bg-gradient-to-b from-[#1c2027] to-[#121419] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-black text-white shadow-inner"
                    style={{
                      backgroundColor: character.color,
                      borderColor: character.portraitColor,
                    }}
                    aria-hidden="true"
                  >
                    {character.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-tight text-[#f3f4f6]">
                      {character.name}
                    </div>
                    <div className="text-[10px] font-semibold text-[#e69f22]">
                      {character.title}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col">
                  <StatRow label="HP Máximo" value={formatNumber(player.maxHp)} />
                  <StatRow label="Armadura" value={formatNumber(player.armor)} />
                  <StatRow label="Velocidade" value={`${formatNumber(player.speed)} u/s`} />
                  <StatRow
                    label="Dano Base"
                    value={`${damage}${profile.damageNote ? ` (${profile.damageNote})` : ''}`}
                  />
                  <StatRow label="Cooldown" value={`${formatSeconds(cooldown)} por ataque`} />
                  <StatRow
                    label="Arma Nativa"
                    value={
                      <span className="flex items-center justify-end gap-1">
                        {renderWeaponIcon(character.startingWeapon, 'w-4 h-4')}
                        <span>{weapon.name}</span>
                      </span>
                    }
                  />
                  <StatRow
                    label="Habilidade Passiva"
                    value={describeCharacterPassive(character)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
