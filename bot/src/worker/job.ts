import fs from 'node:fs';
import path from 'node:path';
import { queueConfig } from '../config';
import {
  getJob,
  heartbeatJob,
  Job,
  requireJob,
  updateJob,
} from '../db';
import {
  assertRepoReady,
  commitAll,
  createJobRepo,
  createTag,
  getDiffStats,
  hasChanges,
  pushJobBranch,
  revParse,
  worktreeRemove,
} from '../git';
import { createLogger } from '../logger';
import {
  postEmbedToJob,
  postToJob,
  updateJobMessage,
} from '../services/notify';
import { applyJob } from './apply';
import {
  AgentError,
  GateError,
  NeedsReviewError,
  PostMergeError,
  PushError,
  RepoNotReadyError,
} from './errors';
import { runGate } from './gate';
import { runAgent } from './opencode';
import { rollbackJob } from './rollback';
import { prepareNodeModules } from './workspace';

const log = createLogger('job');

const PROTECTED_PATTERNS = [
  /^bot\//,
  /^\.github\//,
  /^\.git\//,
  /(^|\/)\.env(\.|$)/,
  /^AGENTS\.md$/,
  /^opencode\.jsonc?$/,
  /^\.opencode\//,
  /^package(-lock)?\.json$/,
  /^next\.config\./,
  /^tsconfig\.json$/,
  /^eslint\.config\./,
  /^postcss\.config\./,
  /^tailwind\.config\./,
  /^\.npmrc$/,
  /^\.yarnrc/,
];

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function readSummary(worktree: string): string | null {
  const file = path.join(worktree, 'JOB_SUMMARY.md');
  try {
    const content = fs.readFileSync(file, 'utf8').trim();
    fs.rmSync(file, { force: true });
    return content ? truncate(content, 3000) : null;
  } catch {
    return null;
  }
}

function removeLocalSecrets(worktree: string): void {
  for (const name of ['.env', '.env.local', '.env.development.local', '.env.production.local']) {
    fs.rmSync(path.join(worktree, name), { force: true });
  }
}

function preserveWork(job: Job, reason: string): string | null {
  const fresh = getJob(job.id);
  const worktree = fresh?.worktree;
  if (!worktree || !fs.existsSync(worktree)) return null;

  try {
    removeLocalSecrets(worktree);
    if (!hasChanges(worktree)) return null;
    const sha = commitAll(worktree, `wip(job-${job.id}): ${reason}`);
    log.warn(`Trabalho do job #${job.id} preservado em ${sha.slice(0, 8)}.`);
    if (fresh?.branch) {
      try {
        pushJobBranch(worktree, fresh.branch);
        log.warn(`Branch ${fresh.branch} preservada no repo principal.`);
      } catch (error) {
        log.warn(`Não consegui preservar a branch ${fresh.branch}: ${String(error)}`);
      }
    }
    return sha;
  } catch (error) {
    log.error(`Não consegui preservar o trabalho do job #${job.id}: ${String(error)}`);
    return null;
  }
}

function cleanupWorktree(job: Job): void {
  const fresh = getJob(job.id);
  if (!fresh?.worktree) return;
  try {
    worktreeRemove(fresh.worktree);
  } catch (error) {
    log.warn(`Falha ao remover worktree do job #${job.id}: ${String(error)}`);
  }
  updateJob(job.id, { worktree: null });
}

function reviewReasons(stats: ReturnType<typeof getDiffStats>): string[] {
  const reasons: string[] = [];

  if (stats.files > queueConfig.maxDiffFiles) {
    reasons.push(`Diff tocou ${stats.files} arquivos (limite ${queueConfig.maxDiffFiles})`);
  }
  if (stats.lines > queueConfig.maxDiffLines) {
    reasons.push(`Diff tem ${stats.lines} linhas (limite ${queueConfig.maxDiffLines})`);
  }
  if (stats.deletedFiles.length > 0) {
    reasons.push(`Arquivos removidos: ${stats.deletedFiles.slice(0, 5).join(', ')}`);
  }

  const protectedHits = stats.changedFiles.filter((file) =>
    PROTECTED_PATTERNS.some((pattern) => pattern.test(file)),
  );
  if (protectedHits.length > 0) {
    reasons.push(`Caminhos protegidos: ${protectedHits.slice(0, 5).join(', ')}`);
  }

  return reasons;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function handleExecute(job: Job): Promise<void> {
  try {
    const ready = assertRepoReady();
    if (!ready.ok) {
      throw new RepoNotReadyError(ready.reason ?? 'Repo não está pronto.');
    }

    const baseSha = revParse(queueConfig.mainBranch);
    const { dir, branch } = createJobRepo(job.id, baseSha);
    log.info(`Job #${job.id} repo isolado: ${dir}`);
    updateJob(job.id, { branch, worktree: dir, base_sha: baseSha });
    prepareNodeModules(dir);

    await postToJob(job, `Executando **#${job.id}** em \`${branch}\`...`);

    const agent = await runAgent(job, dir);
    const summary = readSummary(dir);
    updateJob(job.id, { summary, log_path: agent.logPath });

    if (!hasChanges(dir)) {
      throw new Error('O agente não alterou nenhum arquivo.');
    }

    const gate = await runGate(job.id, dir);
    if (!gate.ok) {
      const failedSha = preserveWork(job, 'gate falhou');
      const stats = getDiffStats(dir, baseSha);
      updateJob(job.id, {
        commit_sha: failedSha,
        diff_files: stats.files,
        diff_lines: stats.lines,
        log_path: gate.logPath,
      });
      throw new GateError(`Build/lint falhou. Log: ${gate.logPath}`, gate.logPath);
    }

    removeLocalSecrets(dir);
    const commitSha = commitAll(
      dir,
      `feat(job-${job.id}): ${job.title.replace(/\s+/g, ' ').slice(0, 90)}`,
    );
    const stats = getDiffStats(dir, baseSha);
    updateJob(job.id, {
      commit_sha: commitSha,
      diff_files: stats.files,
      diff_lines: stats.lines,
      log_path: gate.logPath,
      summary,
    });

    pushJobBranch(dir, branch);

    createTag(`pre-job-${job.id}`, baseSha);
    createTag(`job-${job.id}`, commitSha);

    const reasons = reviewReasons(stats);
    if (reasons.length > 0) {
      throw new NeedsReviewError(reasons.join('; '));
    }

    cleanupWorktree(job);
    await applyJob(requireJob(job.id));

    const done = updateJob(job.id, {
      status: 'done',
      finished_at: nowIso(),
      error: null,
      review_reason: null,
      worktree: null,
    });
    const message = queueConfig.gitPush
      ? `Job **#${job.id}** aplicado e enviado para \`${queueConfig.gitRemote}/${queueConfig.mainBranch}\`.`
      : `Job **#${job.id}** aplicado na \`${queueConfig.mainBranch}\`.`;
    await postEmbedToJob(done, message);
    await updateJobMessage(done);
  } catch (error) {
    const fresh = getJob(job.id);
    if (fresh?.status === 'running' || fresh?.status === 'queued') {
      const sha = preserveWork(job, 'execução interrompida');
      if (sha) updateJob(job.id, { commit_sha: sha });
    }
    throw error;
  } finally {
    cleanupWorktree(job);
  }
}

async function handleApply(job: Job): Promise<void> {
  await applyJob(job);

  const done = updateJob(job.id, {
    status: 'done',
    finished_at: nowIso(),
    error: null,
    review_reason: null,
    worktree: null,
  });
  await postEmbedToJob(done, `Job **#${job.id}** aplicado na \`${queueConfig.mainBranch}\`.`);
  await updateJobMessage(done);
}

async function handleRollback(job: Job): Promise<void> {
  const result = await rollbackJob(job);

  const final = updateJob(job.id, {
    status: 'reverted',
    finished_at: nowIso(),
    error: result.note ?? null,
    review_reason: null,
  });
  await postEmbedToJob(final, `Rollback do job **#${job.id}** aplicado na \`${queueConfig.mainBranch}\`.`);
  await updateJobMessage(final);
}

async function handleFailure(job: Job, error: unknown): Promise<void> {
  const fresh = getJob(job.id) ?? job;

  if (error instanceof RepoNotReadyError) {
    updateJob(job.id, {
      status: 'queued',
      started_at: null,
      heartbeat_at: null,
      attempts: Math.max(0, fresh.attempts - 1),
      error: null,
    });
    await postToJob(job, `Repo ocupado; o job **#${job.id}** continua na fila. ${error.message}`);
    return;
  }

  let status: Job['status'] = 'failed';
  let patch: Partial<Job> = {
    finished_at: nowIso(),
    error: String(error),
  };

  if (error instanceof NeedsReviewError) {
    status = 'failed';
    patch = {
      finished_at: nowIso(),
      error: `Bloqueado para revisão: ${error.message}`,
    };
  } else if (error instanceof PostMergeError) {
    patch = {
      finished_at: nowIso(),
      error: `${error.message}${error.reverted ? ' (revertido automaticamente)' : ` (NÃO revertido; verifique a ${queueConfig.mainBranch})`}`,
    };
  } else if (error instanceof PushError) {
    patch = {
      finished_at: nowIso(),
      error: `${error.message} O commit local foi mantido; faça o push manualmente.`,
    };
  } else if (error instanceof AgentError || error instanceof GateError) {
    patch = {
      finished_at: nowIso(),
      error: error.message,
      log_path: error.logPath,
    };
  }

  const final = updateJob(job.id, { status, ...patch });
  log.error(`Job #${job.id} terminou como ${status}: ${String(error)}`);

  const hint =
    error instanceof PushError
      ? 'O commit local foi mantido, mas o push falhou. Verifique o remote e faça o push manualmente.'
      : `Job #${job.id} falhou. A branch \`implementacao/${job.id}\` foi mantida para inspeção.`;

  await postEmbedToJob(final, hint);
  await updateJobMessage(final);
}

export async function processJob(job: Job): Promise<void> {
  const heartbeat = setInterval(() => {
    try {
      heartbeatJob(job.id);
    } catch {
      // não derruba o worker
    }
  }, 10_000);

  await updateJobMessage(job);

  try {
    if (job.kind === 'rollback') {
      await handleRollback(job);
    } else if (job.kind === 'apply') {
      await handleApply(job);
    } else {
      await handleExecute(job);
    }
  } catch (error) {
    await handleFailure(job, error);
  } finally {
    clearInterval(heartbeat);
  }
}
