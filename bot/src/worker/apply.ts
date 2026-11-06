import { queueConfig } from '../config';
import { Job, updateJob } from '../db';
import { pushMasterFromClone, worktreeRemove } from '../git';
import { createLogger } from '../logger';
import { PushError } from './errors';

const log = createLogger('apply');

export async function applyJob(job: Job): Promise<void> {
  const { worktree } = job;
  if (!worktree) {
    throw new Error('Job sem repo de trabalho.');
  }

  try {
    pushMasterFromClone(worktree, queueConfig.mainBranch);
    log.info(`Job #${job.id} enviado para origin/${queueConfig.mainBranch}.`);
  } catch (error) {
    throw new PushError(
      `Push para origin/${queueConfig.mainBranch} falhou: ${String(error)}`,
    );
  }

  worktreeRemove(worktree);
  updateJob(job.id, { worktree: null });
}
