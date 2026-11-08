'use client';

import { useEffect, useRef } from 'react';

export function GorillaDialogue({ onClose, onStartCombat }: { onClose: () => void; onStartCombat: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="gorilla-dialogue-title"
      aria-describedby="gorilla-dialogue-text"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border-2 border-amber-700 bg-stone-950 p-6 text-amber-50 shadow-2xl backdrop:bg-black/70"
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-500">Guardião do platô</p>
      <h2 id="gorilla-dialogue-title" className="mb-5 text-2xl font-bold">O Maior da Floresta</h2>
      <p id="gorilla-dialogue-text" className="text-lg leading-relaxed">
        Você está desafiando o maior da floresta para um combate?
      </p>
      <button type="button" onClick={onClose} className="mt-8 w-full rounded-lg border border-amber-700 bg-amber-950 px-5 py-3 font-bold hover:bg-amber-900 focus-visible:outline-2 focus-visible:outline-amber-300">
        Encerrar conversa
      </button>
      <button type="button" onClick={onStartCombat} className="mt-3 w-full rounded-lg border border-red-500 bg-red-900 px-5 py-3 font-bold hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-amber-300">
        Iniciar combate
      </button>
      <p className="mt-3 text-center text-xs text-stone-400">Os outros monstros só voltam após a vitória. Esc para voltar à floresta.</p>
    </dialog>
  );
}
