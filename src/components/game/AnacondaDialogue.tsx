'use client';

import { useEffect, useRef } from 'react';

export function AnacondaDialogue({ onClose, onStartCombat }: { onClose: () => void; onStartCombat: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} aria-labelledby="anaconda-title" aria-describedby="anaconda-description"
    onCancel={event => { event.preventDefault(); onClose(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border-2 border-emerald-700 bg-stone-950 p-6 text-emerald-50 shadow-2xl backdrop:bg-black/70">
    <p className="mb-2 text-xs uppercase tracking-widest text-lime-400">Senhora do lago superior</p>
    <h2 id="anaconda-title" className="mb-5 text-2xl font-bold">Sucuri Gigante</h2>
    <p id="anaconda-description" className="text-lg">Você ousa desafiar a guardiã destas águas?</p>
    <p className="mt-4 text-sm text-stone-300">Os outros monstros ficam suspensos durante o duelo. Sair do lago cancela a luta. Derrote a sucuri e colete as Luvas da Sucuri na água.</p>
    <button type="button" onClick={onStartCombat} className="mt-6 w-full rounded-lg border border-red-500 bg-red-950 px-4 py-3 font-bold hover:bg-red-900">Iniciar combate</button>
    <button type="button" onClick={onClose} className="mt-3 w-full rounded-lg border border-emerald-700 px-4 py-3 hover:bg-emerald-950">Sair</button>
  </dialog>;
}
