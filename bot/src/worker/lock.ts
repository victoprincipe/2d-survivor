import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config';
import { createLogger } from '../logger';

const log = createLogger('lock');

const LOCK_FILE = path.join(paths.data, 'worker.lock');

interface LockInfo {
  pid: number;
  startedAt: string;
}

function readLock(): LockInfo | null {
  try {
    const raw = fs.readFileSync(LOCK_FILE, 'utf8');
    const [pidLine = '', startedAt = ''] = raw.split('\n');
    const pid = Number.parseInt(pidLine, 10);
    return Number.isFinite(pid) && pid > 0 ? { pid, startedAt } : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM significa que o processo existe, mas não é nosso.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function release(): void {
  const current = readLock();
  if (current?.pid !== process.pid) return;
  try {
    fs.rmSync(LOCK_FILE, { force: true });
  } catch {
    // não derruba o encerramento por causa do lock
  }
}

/**
 * Garante uma única instância do worker por bancada.
 *
 * Dois workers em paralelo rodam jobs simultâneos a partir da mesma master,
 * competem pelo push e pelo `recoverRunningJobs()` (um marcaria o job do outro
 * como interrompido). O lock usa o pid do processo; um lock de processo morto
 * (crash/SIGKILL) é assumido pelo próximo worker.
 */
export function acquireWorkerLock(): void {
  const existing = readLock();

  if (existing && existing.pid !== process.pid && isProcessAlive(existing.pid)) {
    throw new Error(
      `Já existe um worker ativo (pid ${existing.pid}${existing.startedAt ? `, desde ${existing.startedAt}` : ''}). ` +
        `Encerre-o ou remova ${LOCK_FILE} se ele não estiver rodando.`,
    );
  }

  fs.mkdirSync(paths.data, { recursive: true });
  fs.writeFileSync(LOCK_FILE, `${process.pid}\n${new Date().toISOString()}\n`, 'utf8');
  process.once('exit', release);
  log.info(`Lock do worker adquirido (pid ${process.pid}).`);
}
