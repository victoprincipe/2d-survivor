'use client';

import React from 'react';
import Image from 'next/image';
import { WeaponId, PassiveId } from '@/game/types';
import {
  Flame,
  Wand2,
  Sword,
  Swords,
  BowArrow,
  BookOpen,
  Shield,
  Zap,
  Utensils,
  ConciergeBell,
  Syringe,
  FlaskConical,
  Axe,
  Sparkles,
  Feather,
  Heart,
  Clock,
  Magnet,
  Compass,
  Crosshair,
  FlameKindling,
  Clover,
  Hourglass,
  Orbit,
  Target,
  Biohazard,
  Dumbbell,
  Bike,
  Hand,
} from 'lucide-react';

export function renderWeaponIcon(id: WeaponId, sizeClass: string = 'w-4 h-4'): React.ReactNode {
  switch (id) {
    case 'bottle_51':
      return renderNamedIcon('Bottle51', sizeClass);
    case 'whip':
      return <Flame className={`${sizeClass} text-orange-400`} />;
    case 'wand':
      return <Wand2 className={`${sizeClass} text-sky-400`} />;
    case 'knife':
      return <Sword className={`${sizeClass} text-slate-200`} />;
    case 'bow':
      return <BowArrow className={`${sizeClass} text-lime-400`} />;
    case 'bible':
      return <BookOpen className={`${sizeClass} text-indigo-400`} />;
    case 'garlic':
      return <Shield className={`${sizeClass} text-yellow-300`} />;
    case 'lightning':
      return <Zap className={`${sizeClass} text-cyan-300`} />;
    case 'derson_combo':
      return <Utensils className={`${sizeClass} text-amber-300`} />;
    case 'flying_tray':
      return <ConciergeBell className={`${sizeClass} text-amber-400`} />;
    case 'syringe':
      return <Syringe className={`${sizeClass} text-teal-300`} />;
    case 'fire_flask':
      return <FlaskConical className={`${sizeClass} text-orange-500`} />;
    case 'executioner_axe':
      return <Axe className={`${sizeClass} text-rose-400`} />;
    case 'lula_power':
      return <Hand className={`${sizeClass} text-red-400`} />;
    case 'garras_onca':
    case 'furia_onca_acu':
      return <Swords className={`${sizeClass} text-orange-400`} />;
    case 'espinhos_pupunha':
    case 'metralha_floresta':
      return <Target className={`${sizeClass} text-yellow-300`} />;
    case 'ferrao_formiga':
    case 'injecao_letal':
      return <Syringe className={`${sizeClass} text-emerald-400`} />;
    case 'bandeja_inox':
      return <ConciergeBell className={`${sizeClass} text-slate-300`} />;
    case 'ciclone_saci':
    case 'tempestade_lendaria':
      return <Orbit className={`${sizeClass} text-amber-500`} />;
    case 'lanca_caipora':
      return <BowArrow className={`${sizeClass} text-lime-400`} />;
    case 'esporos_vitoria':
    case 'nuvem_biologica':
      return <FlaskConical className={`${sizeClass} text-green-400`} />;
    case 'mordida_piranha':
      return <Flame className={`${sizeClass} text-red-500`} />;
    case 'rugido_mapinguari':
      return <Shield className={`${sizeClass} text-amber-700`} />;
    case 'chicotada_cipo':
      return <FlameKindling className={`${sizeClass} text-green-500`} />;
    case 'enxame_mutuca':
      return <Sparkles className={`${sizeClass} text-slate-400`} />;
    case 'gota_resina':
      return <FlaskConical className={`${sizeClass} text-amber-500`} />;
    case 'voo_tucano':
      return <Feather className={`${sizeClass} text-orange-400`} />;
    case 'teia_aranha':
      return <Crosshair className={`${sizeClass} text-slate-200`} />;
    case 'arrancada_sucuri':
      return <Zap className={`${sizeClass} text-green-700`} />;
    default:
      return <Flame className={`${sizeClass} text-amber-400`} />;
  }
}

export function renderPassiveIcon(id: PassiveId, sizeClass: string = 'w-4 h-4'): React.ReactNode {
  switch (id) {
    case 'spinach':
      return <Sparkles className={`${sizeClass} text-emerald-400`} />;
    case 'wings':
      return <Feather className={`${sizeClass} text-sky-400`} />;
    case 'heart':
      return <Heart className={`${sizeClass} text-rose-400`} />;
    case 'tome':
      return <Clock className={`${sizeClass} text-purple-400`} />;
    case 'magnet':
      return <Magnet className={`${sizeClass} text-amber-400`} />;
    case 'bracer':
      return <Crosshair className={`${sizeClass} text-red-400`} />;
    case 'lantern':
      return <FlameKindling className={`${sizeClass} text-orange-400`} />;
    case 'clover':
      return <Clover className={`${sizeClass} text-lime-400`} />;
    case 'hourglass':
      return <Hourglass className={`${sizeClass} text-indigo-300`} />;
    case 'duplicator':
      return <Orbit className={`${sizeClass} text-cyan-400`} />;
    case 'hunter_mark':
      return <Target className={`${sizeClass} text-amber-300`} />;
    case 'bio_shield':
      return <Biohazard className={`${sizeClass} text-teal-400`} />;
    case 'casco_tartaruga':
      return <Shield className={`${sizeClass} text-emerald-500`} />;
    case 'essencia_acai':
      return <Magnet className={`${sizeClass} text-purple-400`} />;
    case 'energia_guarana':
      return <Feather className={`${sizeClass} text-red-400`} />;
    case 'raiz_ginseng':
      return <Heart className={`${sizeClass} text-green-400`} />;
    case 'casca_marupa':
      return <Clover className={`${sizeClass} text-amber-300`} />;
    case 'olho_gato_maracaja':
      return <Target className={`${sizeClass} text-yellow-400`} />;
    case 'vigor_anta':
      return <Dumbbell className={`${sizeClass} text-orange-300`} />;
    case 'plumas_arara':
      return <Clock className={`${sizeClass} text-sky-400`} />;
    case 'coracao_jacare':
      return <Sparkles className={`${sizeClass} text-rose-400`} />;
    case 'resiliencia_preguica':
      return <Hourglass className={`${sizeClass} text-lime-400`} />;
    default:
      return <Sparkles className={`${sizeClass} text-emerald-400`} />;
  }
}

export function renderNamedIcon(
  iconName: string,
  sizeClass: string = 'w-8 h-8',
  overrideColorClass?: string
): React.ReactNode {
  const c = (defaultColor: string) => `${sizeClass} ${overrideColorClass ?? defaultColor}`;
  switch (iconName) {
    case 'Bottle51':
      return <Image src="/bottle-51.svg" alt="Garrafa de 51" width={64} height={96} unoptimized className={`${sizeClass} object-contain`} />;
    case 'Flame':
      return <Flame className={c('text-orange-400')} />;
    case 'Wand2':
      return <Wand2 className={c('text-sky-400')} />;
    case 'Sword':
      return <Sword className={c('text-slate-200')} />;
    case 'Swords':
      return <Swords className={c('text-slate-200')} />;
    case 'BowArrow':
      return <BowArrow className={c('text-lime-400')} />;
    case 'BookOpen':
      return <BookOpen className={c('text-indigo-400')} />;
    case 'Shield':
      return <Shield className={c('text-yellow-300')} />;
    case 'Zap':
      return <Zap className={c('text-cyan-300')} />;
    case 'Utensils':
      return <Utensils className={c('text-amber-300')} />;
    case 'ConciergeBell':
      return <ConciergeBell className={c('text-amber-400')} />;
    case 'Syringe':
      return <Syringe className={c('text-teal-300')} />;
    case 'FlaskConical':
      return <FlaskConical className={c('text-orange-500')} />;
    case 'Axe':
      return <Axe className={c('text-rose-400')} />;
    case 'Sparkles':
      return <Sparkles className={c('text-emerald-400')} />;
    case 'Feather':
      return <Feather className={c('text-sky-400')} />;
    case 'Heart':
      return <Heart className={c('text-rose-400')} />;
    case 'Clock':
      return <Clock className={c('text-purple-400')} />;
    case 'Magnet':
      return <Magnet className={c('text-amber-400')} />;
    case 'Compass':
      return <Compass className={c('text-amber-400')} />;
    case 'Crosshair':
      return <Crosshair className={c('text-red-400')} />;
    case 'FlameKindling':
      return <FlameKindling className={c('text-orange-400')} />;
    case 'Clover':
      return <Clover className={c('text-lime-400')} />;
    case 'Hourglass':
      return <Hourglass className={c('text-indigo-300')} />;
    case 'Orbit':
      return <Orbit className={c('text-cyan-400')} />;
    case 'Target':
      return <Target className={c('text-amber-300')} />;
    case 'Biohazard':
      return <Biohazard className={c('text-teal-400')} />;
    case 'Dumbbell':
      return <Dumbbell className={c('text-lime-300')} />;
    case 'Bike':
      return <Bike className={c('text-amber-300')} />;
    case 'Hand':
      return <Hand className={c('text-red-400')} />;
    default:
      return <Flame className={c('text-amber-400')} />;
  }
}
