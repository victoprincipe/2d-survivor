'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { HunterQuestProgress } from '@/game/types';
import { HUNTER_FISH_TARGET } from '@/game/data/hunterQuest';

export function HunterDialogue({ quest, onAccept, onDeliver, onClose }: {
  quest: HunterQuestProgress; onAccept: () => void; onDeliver: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  const ready = quest.accepted && !quest.completed && quest.fish >= HUNTER_FISH_TARGET;
  return (
    <dialog ref={ref} aria-labelledby="hunter-title" aria-describedby="hunter-story"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-2 border-amber-700 bg-stone-950 p-5 text-amber-50 shadow-2xl backdrop:bg-black/70">
      <div className="mb-3 flex items-center gap-4">
        <Image src="/sprites/tribe-hunter/seated-elder.png" alt="" width={92} height={92} unoptimized className="h-24 w-24 object-contain" />
        <div><p className="text-xs uppercase tracking-widest text-amber-400">Comida para a tribo</p>
          <h2 id="hunter-title" className="mt-1 text-2xl font-bold">Caçador da Tribo</h2></div>
      </div>
      <div id="hunter-story" className="space-y-3 leading-relaxed">
        {quest.completed ? <p>O alimento que você trouxe já está no fogo. Minha tribo terá o que comer hoje. Use o cocar com orgulho, amigo. Nossa fogueira sempre terá um lugar para você.</p>
          : !quest.accepted ? <>
            <p>Quando eu era mais jovem, era mais fácil conseguir alimento. O rio era generoso, e sempre voltávamos com o suficiente para repartir. Agora, os monstros tomaram suas águas e minha tribo está com fome.</p>
            <p>Você pode nos ajudar? Derrote os monstros comuns do rio principal, recolha os peixes que deixarem e traga <strong>30 peixes</strong>. Os animais dos lagos, elites e chefes não contam para esta caçada.</p>
          </> : ready ? <p>Você voltou com comida para todos! Entregue os 30 peixes e vamos preparar a refeição. Como agradecimento, este Cocar da Tribo será seu.</p>
            : <p>A tribo aguarda sua ajuda. Você já trouxe {quest.fish} de 30 peixes; faltam {HUNTER_FISH_TARGET - quest.fish}. Procure o rio principal e lembre-se de recolher os peixes após derrotar os monstros.</p>}
      </div>
      {!quest.completed && <p className="mt-4 rounded-lg border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-200">Recompensa: Cocar da Tribo (capacete) · 5% de redução de dano · 5% de velocidade de ataque · +15 de vida máxima · 15% de velocidade de projétil. Equipe no inventário, no menu.</p>}
      {!quest.accepted && <button type="button" onClick={onAccept} className="mt-5 w-full rounded-lg bg-amber-700 px-4 py-3 font-bold hover:bg-amber-600">Aceitar missão</button>}
      {ready && <button type="button" onClick={onDeliver} className="mt-5 w-full rounded-lg bg-amber-700 px-4 py-3 font-bold hover:bg-amber-600">Entregar 30 peixes</button>}
      <button type="button" onClick={onClose} className="mt-3 w-full rounded-lg border border-stone-600 px-4 py-3 hover:bg-stone-800">Voltar</button>
    </dialog>
  );
}
