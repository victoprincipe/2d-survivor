import { queueConfig } from '../config';
import { Job, updateJob } from '../db';
import {
  abortRevert,
  assertRepoReady,
  createTag,
  isAncestor,
  revertCommit,
} from '../git';
import { NeedsReviewError } from './errors';
import { runGate } from './gate';
import { createVerifyWorktree, removeVerifyWorktree } from './workspace';

export async function rollbackJob(job: Job): Promise<{ ok: boolean; note?: string }> {
  const sha = job.commit_sha;
  if (!sha) {
    throw new Error('Job sem commit para reverter.');
  }

  const ready = assertRepoReady();
  if (!ready.ok) {
    throw new NeedsReviewError(ready.reason ?? 'Repo não está pronto para o rollback.');
  }

  if (!isAncestor(sha)) {
    throw new Error('O commit do job não está mais na main.');
  }

  let reverted: string;
  try {
    reverted = revertCommit(sha);
  } catch (error) {
    abortRevert();
    throw new Error(`git revert falhou (possível conflito): ${String(error)}`);
  }

  createTag(`rollback-${job.id}`, reverted);
  updateJob(job.id, { commit_sha: reverted });

  if (!queueConfig.postMergeVerify) {
    return { ok: true };
  }

  const dir = createVerifyWorktree(job.id);
  try {
    const gate = await runGate(job.id, dir, 'rollback-verify');
    if (!gate.ok) {
      return {
        ok: true,
        note: `Rollback aplicado, mas build/lint falhou. Log: ${gate.logPath}`,
      };
    }
    return { ok: true };
  } finally {
    removeVerifyWorktree(dir);
  }
}
