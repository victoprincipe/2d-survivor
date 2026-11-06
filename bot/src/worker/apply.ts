import { queueConfig } from '../config';
import { Job, updateJob } from '../db';
import {
  assertRepoReady,
  branchExists,
  createTag,
  git,
  gitTry,
  mergeFf,
  revParse,
  worktreeRemove,
} from '../git';
import { createLogger } from '../logger';
import { NeedsReviewError, PostMergeError } from './errors';
import { runGate } from './gate';
import { createVerifyWorktree, removeVerifyWorktree } from './workspace';

const log = createLogger('apply');

function assertMainAt(baseSha: string): void {
  const ready = assertRepoReady();
  if (!ready.ok) {
    throw new NeedsReviewError(ready.reason ?? 'Repo não está pronto para o merge.');
  }

  const head = revParse(queueConfig.mainBranch);
  if (head !== baseSha) {
    throw new NeedsReviewError(
      `A main avançou de ${baseSha.slice(0, 8)} para ${head.slice(0, 8)}; o job precisa ser reprocessado.`,
    );
  }
}

async function verifyAfterMerge(job: Job): Promise<void> {
  if (!queueConfig.postMergeVerify) return;

  let dir = '';
  try {
    dir = createVerifyWorktree(job.id);
    const gate = await runGate(job.id, dir, 'verify');
    if (!gate.ok) {
      throw new PostMergeError(
        `Build/lint falhou depois do merge. Log: ${gate.logPath}`,
        false,
      );
    }
  } finally {
    if (dir) removeVerifyWorktree(dir);
  }
}

function revertMain(job: Job, commitSha: string): boolean {
  try {
    git(['revert', '--no-edit', commitSha]);
    log.warn(`Revert automático do job #${job.id} aplicado na main.`);
    return true;
  } catch (error) {
    gitTry(['revert', '--abort']);
    log.error(`Revert automático do job #${job.id} falhou: ${String(error)}`);
    return false;
  }
}

export async function applyJob(job: Job): Promise<void> {
  const { branch, commit_sha: commitSha, base_sha: baseSha } = job;

  if (!branch || !commitSha || !baseSha) {
    throw new NeedsReviewError('Job sem branch/commit/base para aplicar.');
  }
  if (!branchExists(branch)) {
    throw new NeedsReviewError(`A branch ${branch} não existe mais.`);
  }

  assertMainAt(baseSha);

  const newHead = mergeFf(branch);
  if (newHead !== commitSha) {
    throw new Error(`O merge terminou em ${newHead.slice(0, 8)}, esperado ${commitSha.slice(0, 8)}.`);
  }

  createTag(`pre-job-${job.id}`, baseSha);
  createTag(`job-${job.id}`, commitSha);

  try {
    await verifyAfterMerge(job);
  } catch (error) {
    if (error instanceof PostMergeError) {
      const reverted = revertMain(job, newHead);
      throw new PostMergeError(error.message, reverted);
    }
    const reverted = revertMain(job, newHead);
    throw new PostMergeError(`Falha na verificação pós-merge: ${String(error)}`, reverted);
  }

  if (job.worktree) worktreeRemove(job.worktree);
  updateJob(job.id, { worktree: null });
}
