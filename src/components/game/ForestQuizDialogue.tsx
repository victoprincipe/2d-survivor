'use client';

import { useEffect, useRef } from 'react';
import { ForestQuizView } from '@/game/data/forestQuiz';

export function ForestQuizDialogue({ quiz, onAnswer, onClose }: {
  quiz: ForestQuizView; onAnswer: (choice: number) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  useEffect(() => {
    if (quiz.status === 'question') firstOptionRef.current?.focus();
    else closeRef.current?.focus();
  }, [quiz.status, quiz.index]);
  return (
    <dialog ref={ref} aria-labelledby="forest-quiz-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border-2 border-amber-700 bg-stone-950 p-6 text-amber-50 shadow-2xl backdrop:bg-black/75">
      <p className="mb-2 text-xs uppercase tracking-widest text-amber-500">O desafio do ancião</p>
      <h2 id="forest-quiz-title" className="mb-4 text-2xl font-bold">Guardião dos Enigmas</h2>
      <div aria-live="polite" aria-atomic="true">
        {quiz.status === 'question' ? <>
          <p className="mb-3 text-sm text-stone-400">Pergunta {quiz.index + 1} de {quiz.total} · Prove sua sabedoria: acerte todas para abrir a caverna e resgatar o Arco do Guardião.</p>
          <p className="mb-5 text-lg">{quiz.text}</p>
        </> : <p className="mb-5 text-lg">
          {quiz.status === 'failed' ? 'Resposta incorreta, viajante. A recompensa exige sabedoria! Volte para tentar novamente.'
            : 'Você provou sua sabedoria! A caverna está aberta. Meu arco espera por você lá dentro. Use E para entrar e resgatar. Depois, equipe-o no inventário da seleção de personagem.'}
        </p>}
      </div>
      {quiz.status === 'question' && <div className="flex flex-col gap-3" key={quiz.index}>
        {quiz.options.map((option, index) => <button key={option} ref={index === 0 ? firstOptionRef : undefined} type="button" onClick={() => onAnswer(index)}
          className="rounded-lg border border-emerald-800 bg-emerald-950 px-4 py-3 text-left hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-amber-300">{option}</button>)}
      </div>}
      <button ref={closeRef} type="button" onClick={onClose} className="mt-6 w-full rounded-lg border border-amber-800 px-4 py-3 hover:bg-amber-950">Encerrar conversa</button>
      <p className="mt-3 text-center text-xs text-stone-400">Esc para voltar à floresta</p>
    </dialog>
  );
}
