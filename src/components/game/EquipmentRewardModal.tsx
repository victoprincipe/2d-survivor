'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { EQUIPMENT_SLOTS, equipmentArtwork, formatEquipmentStat } from '@/game/data/inventory';
import { EquipmentItem, EquipmentStats } from '@/game/types';

export function EquipmentRewardModal({ item, onClose }: { item: EquipmentItem; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-labelledby="equipment-reward-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border-2 border-amber-700 bg-stone-950 p-6 text-center text-amber-50 shadow-2xl backdrop:bg-black/75">
    <p className="text-xs uppercase tracking-widest text-amber-400">Recompensa resgatada · {EQUIPMENT_SLOTS[item.slot]}</p>
    <h2 id="equipment-reward-title" className="mt-2 text-2xl font-bold">{item.name}</h2>
    <Image src={equipmentArtwork(item.id)!} alt={item.name} width={90} height={160} unoptimized className="mx-auto my-4" />
    <ul className="space-y-1 text-sm text-emerald-300">
      {(Object.keys(item.stats) as (keyof EquipmentStats)[]).map(key => <li key={key}>{formatEquipmentStat(key, item.stats[key]!)}</li>)}
    </ul>
    <p className="mt-4 text-sm text-stone-300">Salvo no inventário deste personagem. Equipe no slot de {EQUIPMENT_SLOTS[item.slot].toLowerCase()} na seleção de personagem para ativar os bônus na próxima partida.</p>
    <button type="button" autoFocus onClick={onClose} className="mt-5 w-full rounded border border-amber-700 bg-amber-950 px-4 py-3 hover:bg-amber-900">Continuar</button>
  </dialog>;
}
