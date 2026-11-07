import { queueConfig } from '../config';
import { Job, updateJob } from '../db';
import {
  abortRebase,
  conflictedPaths,
  continueRebase,
  fetchMain,
  getDiffStats,
  isAncestor,
  pushJobBranch,
  pushMainWithLease,
  rebaseInProgress,
  rebaseTakingJobChanges,
  resolveConflictsTakingTheirs,
  revParse,
  shortSha,
  worktreeRemove,
} from '../git';
import { createLogger } from '../logger';
import {
  GateError,
  IntegrationConflictError,
  NeedsReviewError,
  PushError,
} from './errors';
import { runGate } from './gate';
import { reviewReasons } from './review';

const log = createLogger('apply');

/** Quantas vezes reintegrar/pushar antes de desistir (origin mudando durante o push). */
const MAX_INTEGRATION_ATTEMPTS = 3;

/** Rodadas de resolução de conflito (normalmente uma: o job tem um commit). */
const MAX_CONFLICT_ROUNDS = 10;

export interface ApplyResult {
  /** A master já continha a mudança; nada novo foi aplicado. */
  empty: boolean;
  /** Houve rebase sobre uma master que avançou durante o job. */
  rebased: boolean;
  /** Arquivos cujos conflitos foram resolvidos a favor do job. */
  resolvedFiles: string[];
  /** Base final usada no push. */
  baseSha: string;
}

type Integration = ApplyResult;

/**
 * Resolve os conflitos pendentes da rebase a favor do job.
 * Qualquer conflito que não dê para resolver por caminho aborta a rebase.
 */
function resolveConflicts(job: Job, worktree: string): string[] {
  const resolved = new Set<string>();

  try {
    for (let round = 0; round < MAX_CONFLICT_ROUNDS && rebaseInProgress(worktree); round++) {
      const files = conflictedPaths(worktree);

      if (files.length > 0) {
        log.warn(
          `Job #${job.id}: ${files.length} conflito(s) resolvido(s) a favor do job: ${files.join(', ')}`,
        );
        for (const file of files) resolved.add(file);
        resolveConflictsTakingTheirs(worktree, files);
      }

      continueRebase(worktree);
    }

    if (rebaseInProgress(worktree)) {
      throw new Error('a rebase continuou parada depois de todas as rodadas');
    }
  } catch (error) {
    abortRebase(worktree);
    throw new IntegrationConflictError(
      `Conflito ao integrar com a master em ${
        [...resolved].join(', ') || 'arquivo(s) não identificado(s)'
      }: ${String(error)}`,
    );
  }

  return [...resolved];
}

/**
 * Garante que o commit do job está em cima do topo atual da master.
 * Se a master avançou, rebaseia mantendo as mudanças do job, roda o gate de
 * novo e republica a branch. Nunca aplica na master sem passar pelo gate.
 */
async function integrate(
  job: Job,
  worktree: string,
  remoteSha: string,
  attempt: number,
): Promise<Integration> {
  const main = queueConfig.mainBranch;

  if (isAncestor(remoteSha, 'HEAD', worktree)) {
    return { empty: false, rebased: false, resolvedFiles: [], baseSha: remoteSha };
  }

  log.info(
    `origin/${main} avançou para ${shortSha(remoteSha)}; integrando o job #${job.id} sobre a nova base.`,
  );

  let resolvedFiles: string[] = [];
  try {
    rebaseTakingJobChanges(worktree, remoteSha);
  } catch (error) {
    log.warn(
      `Job #${job.id}: rebase parou em conflito (${String(error)}); mantendo as mudanças do job.`,
    );
    resolvedFiles = resolveConflicts(job, worktree);
  }

  if (!isAncestor(remoteSha, 'HEAD', worktree)) {
    abortRebase(worktree);
    throw new IntegrationConflictError(
      `O job #${job.id} não ficou sobre ${shortSha(remoteSha)} depois da integração (rebase incompleta).`,
    );
  }

  const head = revParse('HEAD', worktree);
  if (head === remoteSha) {
    updateJob(job.id, { base_sha: remoteSha, commit_sha: head });
    log.info(`Job #${job.id}: a master já contém a mudança; nada a aplicar.`);
    return { empty: true, rebased: true, resolvedFiles, baseSha: remoteSha };
  }

  // O origin deve refletir o estado integrado mesmo se o gate falhar.
  pushJobBranch(worktree, job.branch as string);

  const gate = await runGate(job.id, worktree, `rebase-${attempt}`);
  if (!gate.ok) {
    throw new GateError(
      `Build/lint falhou ao integrar o job com ${shortSha(remoteSha)} (a master avançou durante a execução). Log: ${gate.logPath}`,
      gate.logPath,
    );
  }

  const stats = getDiffStats(worktree, remoteSha);
  updateJob(job.id, {
    base_sha: remoteSha,
    commit_sha: head,
    diff_files: stats.files,
    diff_lines: stats.lines,
    log_path: gate.logPath,
  });

  const reasons = reviewReasons(stats);
  if (reasons.length > 0) {
    throw new NeedsReviewError(reasons.join('; '));
  }

  return { empty: false, rebased: true, resolvedFiles, baseSha: remoteSha };
}

/**
 * Aplica o job na master.
 *
 * Fluxo: fetch → (master avançou?) rebase a favor do job → gate → push da
 * branch → push da master com `--force-with-lease`. Se alguém empurrar entre o
 * fetch e o push, a trava rejeita, o worker reintegra e tenta de novo; nunca
 * sobrescreve um commit que não viu.
 */
export async function applyJob(job: Job): Promise<ApplyResult> {
  const { worktree, branch } = job;
  if (!worktree) {
    throw new Error('Job sem repo de trabalho.');
  }
  if (!branch) {
    throw new Error('Job sem branch.');
  }

  const main = queueConfig.mainBranch;
  const resolvedFiles = new Set<string>();
  let rebased = false;
  let baseSha = job.base_sha ?? '';
  let lastError: unknown = null;

  try {
    for (let attempt = 1; attempt <= MAX_INTEGRATION_ATTEMPTS; attempt++) {
      let remoteSha: string;
      try {
        remoteSha = fetchMain(worktree, main);
      } catch (error) {
        throw new PushError(`Não consegui buscar origin/${main}: ${String(error)}`);
      }

      const integration = await integrate(job, worktree, remoteSha, attempt);
      rebased = rebased || integration.rebased;
      baseSha = integration.baseSha;
      for (const file of integration.resolvedFiles) resolvedFiles.add(file);

      if (integration.empty) {
        finish(worktree, job.id);
        return { empty: true, rebased, resolvedFiles: [...resolvedFiles], baseSha };
      }

      try {
        pushMainWithLease(worktree, main, remoteSha);
        log.info(`Job #${job.id} enviado para origin/${main} (base ${shortSha(remoteSha)}).`);
        finish(worktree, job.id);
        return { empty: false, rebased, resolvedFiles: [...resolvedFiles], baseSha };
      } catch (error) {
        lastError = error;
        log.warn(
          `Job #${job.id}: push para origin/${main} rejeitado na tentativa ${attempt}/${MAX_INTEGRATION_ATTEMPTS} (${String(error)}). Reintegrando...`,
        );
      }
    }

    throw new PushError(
      `Push para origin/${main} falhou após ${MAX_INTEGRATION_ATTEMPTS} tentativas: ${String(lastError)}`,
    );
  } catch (error) {
    // Deixa no origin o estado mais recente do job para inspeção.
    try {
      pushJobBranch(worktree, branch);
    } catch (pushError) {
      log.warn(`Não consegui atualizar a branch ${branch} no origin: ${String(pushError)}`);
    }
    throw error;
  }
}

function finish(worktree: string, jobId: number): void {
  try {
    worktreeRemove(worktree);
  } catch (error) {
    // A master já foi atualizada; não transformar sucesso em falha por isso.
    log.warn(`Não consegui remover o clone de #${jobId} (${worktree}): ${String(error)}`);
  }
  updateJob(jobId, { worktree: null });
}
