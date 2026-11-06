import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config';
import {
  Plan,
  getPlan,
  updatePlan,
} from '../db';
import { createPlanRepo, worktreeRemove } from '../git';
import { createLogger } from '../logger';
import {
  postPlanFailure,
  postPlanMessage,
} from '../services/notify';
import { runPlanner } from './planner';

const log = createLogger('plan');

const MAX_ARTIFACT_CHARS = 100_000;

function nowIso(): string {
  return new Date().toISOString();
}

function readArtifactIfExists(worktree: string, name: string): string | null {
  const file = path.join(worktree, '.plan-artifacts', name);
  if (!fs.existsSync(file)) return null;

  const content = fs.readFileSync(file, 'utf8').trim();
  if (!content) return null;
  if (content.length > MAX_ARTIFACT_CHARS) {
    throw new Error(
      `${name} tem ${content.length} caracteres; o limite é ${MAX_ARTIFACT_CHARS}.`,
    );
  }
  return content;
}

function extractTagged(output: string, tag: 'PLAN' | 'TASKS'): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(output);
  const content = match?.[1]?.trim();
  if (!content) return null;
  if (content.length > MAX_ARTIFACT_CHARS) {
    throw new Error(
      `<${tag}> tem ${content.length} caracteres; o limite é ${MAX_ARTIFACT_CHARS}.`,
    );
  }
  return content;
}

function saveArtifacts(planId: number, planMd: string, tasksMd: string): void {
  const dir = path.join(paths.plans, `plan-${planId}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'PLAN.md'), planMd);
  fs.writeFileSync(path.join(dir, 'TASKS.md'), tasksMd);
}

export async function processPlan(plan: Plan): Promise<void> {
  let worktree: string | null = null;

  try {
    const repo = createPlanRepo(plan.id);
    worktree = repo.dir;

    updatePlan(plan.id, {
      status: 'running',
      started_at: nowIso(),
      finished_at: null,
      error: null,
      worktree,
    });

    log.info(`Plano #${plan.id} repo isolado: ${worktree}`);
    const planner = await runPlanner(plan, worktree);

    const planMd =
      readArtifactIfExists(worktree, 'PLAN.md') ??
      extractTagged(planner.output, 'PLAN');
    const tasksMd =
      readArtifactIfExists(worktree, 'TASKS.md') ??
      extractTagged(planner.output, 'TASKS');

    if (!planMd || !tasksMd) {
      throw new Error(
        'O planejador não gerou PLAN.md/TASKS.md nem as tags <PLAN>/<TASKS>. ' +
          `Veja o log: ${planner.logPath}`,
      );
    }

    saveArtifacts(plan.id, planMd, tasksMd);

    const ready = updatePlan(plan.id, {
      status: 'ready',
      plan_md: planMd,
      tasks_md: tasksMd,
      finished_at: nowIso(),
      error: null,
      worktree: null,
    });

    await postPlanMessage(ready);
    log.info(`Plano #${plan.id} publicado para aprovação.`);
  } catch (error) {
    const fresh = getPlan(plan.id);
    if (fresh && fresh.status !== 'approved' && fresh.status !== 'rejected') {
      const failed = updatePlan(plan.id, {
        status: 'failed',
        finished_at: nowIso(),
        error: String(error),
        worktree: null,
      });
      log.error(`Plano #${plan.id} falhou: ${String(error)}`);
      await postPlanFailure(failed);
    } else {
      log.error(`Plano #${plan.id} falhou após revisão: ${String(error)}`);
    }
  } finally {
    if (worktree) {
      try {
        worktreeRemove(worktree);
      } catch (error) {
        log.warn(`Falha ao remover worktree do plano #${plan.id}: ${String(error)}`);
      }
    }
  }
}
