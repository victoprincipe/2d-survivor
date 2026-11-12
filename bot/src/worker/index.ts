import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { requireWorkerConfig, paths, queueConfig } from '../config';
import {
  claimNextJob,
  claimNextPlan,
  getDb,
  isQueuePaused,
  recoverRunningJobs,
  recoverRunningPlans,
  updateJob,
  updatePlan,
} from '../db';
import { worktreeRemove } from '../git';
import { createLogger } from '../logger';
import { cleanupOldAssets } from './assets';
import { processJob } from './job';
import { acquireWorkerLock } from './lock';
import { processPlan } from './plan';

const log = createLogger('worker');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

requireWorkerConfig();

try {
  acquireWorkerLock();
} catch (error) {
  log.error(String(error));
  process.exit(1);
}

getDb();
fs.mkdirSync(paths.logs, { recursive: true });
fs.mkdirSync(paths.worktrees, { recursive: true });
fs.mkdirSync(paths.assets, { recursive: true });
fs.mkdirSync(paths.plans, { recursive: true });

function prepareAgentHome(): void {
  fs.mkdirSync(path.join(paths.agentHome, '.config', 'opencode'), { recursive: true });
  fs.mkdirSync(path.join(paths.agentHome, '.local', 'share', 'opencode'), { recursive: true });
  fs.mkdirSync(paths.gateHome, { recursive: true });

  fs.copyFileSync(paths.agentConfigSource, paths.agentConfig);

  const sourceAuth = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
  const targetAuth = path.join(paths.agentHome, '.local', 'share', 'opencode', 'auth.json');
  if (fs.existsSync(sourceAuth)) {
    fs.copyFileSync(sourceAuth, targetAuth);
    fs.chmodSync(targetAuth, 0o600);
  } else {
    log.warn('auth.json do OpenCode não encontrado; o agente pode falhar ao autenticar.');
  }
}

prepareAgentHome();

function cleanupRecovered(): void {
  const recovered = recoverRunningJobs();
  for (const job of recovered) {
    if (job.worktree) {
      worktreeRemove(job.worktree);
      updateJob(job.id, { worktree: null });
    }
    log.warn(`Job #${job.id} estava rodando quando o worker parou; marcado como interrompido.`);
  }

  const recoveredPlans = recoverRunningPlans();
  for (const plan of recoveredPlans) {
    if (plan.worktree) {
      worktreeRemove(plan.worktree);
      updatePlan(plan.id, { worktree: null });
    }
    log.warn(`Plano #${plan.id} estava rodando quando o worker parou; marcado como falho.`);
  }
}

function cleanupStaleWorktrees(): void {
  const rows = getDb()
    .prepare("SELECT * FROM jobs WHERE worktree IS NOT NULL")
    .all() as Array<{ id: number; worktree: string | null }>;

  for (const row of rows) {
    if (row.worktree) {
      worktreeRemove(row.worktree);
      updateJob(row.id, { worktree: null });
    }
  }

  const planRows = getDb()
    .prepare("SELECT * FROM plans WHERE worktree IS NOT NULL")
    .all() as Array<{ id: number; worktree: string | null }>;

  for (const row of planRows) {
    if (row.worktree) {
      worktreeRemove(row.worktree);
      updatePlan(row.id, { worktree: null });
    }
  }
}

cleanupRecovered();
cleanupStaleWorktrees();
cleanupOldAssets();

let stopping = false;
let claimFailures = 0;

function writeWorkerHeartbeat(state: string): void {
  try {
    fs.writeFileSync(
      path.join(paths.data, 'worker-heartbeat.json'),
      JSON.stringify({ pid: process.pid, state, at: new Date().toISOString() }),
      'utf8',
    );
  } catch {
    // disco cheio não deve derrubar o worker
  }
}

async function main(): Promise<void> {
  log.info('Worker iniciado. Aguardando jobs...');

  while (!stopping) {
    if (isQueuePaused()) {
      writeWorkerHeartbeat('paused');
      await sleep(queueConfig.pollMs);
      continue;
    }

    let job;
    try {
      job = claimNextJob();
      claimFailures = 0;
    } catch (error) {
      claimFailures += 1;
      log.error(`Falha ao buscar job (${claimFailures}/5): ${String(error)}`);
      if (claimFailures >= 5) {
        log.error('Busca de jobs falhando repetidamente; encerrando para reinício automático.');
        process.exit(1);
      }
      await sleep(queueConfig.pollMs);
      continue;
    }
    if (job) {
      log.info(`Processando job #${job.id} (${job.kind}, tentativa ${job.attempts})...`);
      writeWorkerHeartbeat(`job:${job.id}`);
      try {
        await processJob(job);
      } catch (error) {
        log.error(`Falha não tratada no job #${job.id}: ${String(error)}`);
      }
      continue;
    }

    const plan = claimNextPlan();
    if (plan) {
      log.info(`Processando plano #${plan.id}...`);
      writeWorkerHeartbeat(`plan:${plan.id}`);
      try {
        await processPlan(plan);
      } catch (error) {
        log.error(`Falha não tratada no plano #${plan.id}: ${String(error)}`);
      }
      continue;
    }

    writeWorkerHeartbeat('idle');
    await sleep(queueConfig.pollMs);
  }

  log.info('Worker encerrado.');
}

process.on('SIGINT', () => {
  if (stopping) {
    log.warn('Segundo SIGINT: saindo agora (o job em execução ficará como interrompido).');
    process.exit(1);
  }
  stopping = true;
  log.info('SIGINT recebido. Terminando o job atual antes de sair...');
});

process.on('SIGTERM', () => {
  stopping = true;
  log.info('SIGTERM recebido. Terminando o job atual antes de sair...');
});

process.on('unhandledRejection', (error) => {
  log.error(`Unhandled rejection: ${String(error)}`);
});

process.on('uncaughtException', (error) => {
  log.error(`Exceção não capturada: ${error.stack ?? String(error)}`);
  process.exit(1);
});

main().catch((error) => {
  log.error(`Worker abortou: ${String(error)}`);
  process.exit(1);
});
