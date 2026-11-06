import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { requireWorkerConfig, paths, queueConfig } from '../config';
import {
  claimNextJob,
  getDb,
  isQueuePaused,
  recoverRunningJobs,
  updateJob,
} from '../db';
import { assertRepoReady, worktreeRemove } from '../git';
import { createLogger } from '../logger';
import { processJob } from './job';

const log = createLogger('worker');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

requireWorkerConfig();
getDb();
fs.mkdirSync(paths.logs, { recursive: true });
fs.mkdirSync(paths.worktrees, { recursive: true });

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
}

cleanupRecovered();
cleanupStaleWorktrees();

let stopping = false;
let lastNotice = '';
let lastNoticeAt = 0;

function notice(message: string): void {
  const now = Date.now();
  if (message === lastNotice && now - lastNoticeAt < 60_000) return;
  lastNotice = message;
  lastNoticeAt = now;
  log.warn(message);
}

async function main(): Promise<void> {
  log.info('Worker iniciado. Aguardando jobs...');

  while (!stopping) {
    if (isQueuePaused()) {
      notice('Fila pausada. Use /fila-retomar no Discord.');
      await sleep(queueConfig.pollMs);
      continue;
    }

    const ready = assertRepoReady();
    if (!ready.ok) {
      notice(`Fila parada: ${ready.reason}`);
      await sleep(queueConfig.pollMs);
      continue;
    }

    lastNotice = '';

    const job = claimNextJob();
    if (!job) {
      await sleep(queueConfig.pollMs);
      continue;
    }

    log.info(`Processando job #${job.id} (${job.kind}, tentativa ${job.attempts})...`);
    try {
      await processJob(job);
    } catch (error) {
      log.error(`Falha não tratada no job #${job.id}: ${String(error)}`);
    }
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

main().catch((error) => {
  log.error(`Worker abortou: ${String(error)}`);
  process.exit(1);
});
