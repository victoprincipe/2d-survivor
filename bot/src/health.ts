import fs from 'node:fs';
import path from 'node:path';
import type { Client } from 'discord.js';
import { paths } from './config';
import { createLogger } from './logger';

const log = createLogger('health');

const heartbeatFile = path.join(paths.data, 'heartbeat.json');
const heartbeatLog = path.join(paths.data, 'heartbeat.log');
const lastExitFile = path.join(paths.data, 'last-exit.json');
const botErrorLog = path.join(paths.logs, 'bot-errors.log');

function readInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const checkMs = Math.max(5, readInt('HEALTH_CHECK_SECONDS', 30)) * 1000;
const notReadyLimitMs = Math.max(60, readInt('HEALTH_NOT_READY_SECONDS', 180)) * 1000;
const pingFailureLimit = Math.max(1, readInt('HEALTH_PING_FAILURES', 3));
const errorWindowMs = Math.max(1, readInt('HEALTH_ERROR_WINDOW_MIN', 10)) * 60_000;
const errorLimit = Math.max(1, readInt('HEALTH_ERROR_LIMIT', 5));
const heartbeatLogMaxBytes = 1_000_000;

export interface LastExit {
  reason: string;
  at: string;
  detail?: string;
}

export function writeLastExit(reason: string, detail = ''): void {
  try {
    fs.mkdirSync(paths.data, { recursive: true });
    fs.writeFileSync(
      lastExitFile,
      JSON.stringify({ reason, at: new Date().toISOString(), detail } satisfies LastExit),
      'utf8',
    );
  } catch {
    // diagnóstico não pode falhar o processo
  }
}

export function readLastExit(): LastExit | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(lastExitFile, 'utf8')) as LastExit;
    return typeof parsed?.reason === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLastExit(): void {
  try {
    fs.rmSync(lastExitFile, { force: true });
  } catch {
    // ignora
  }
}

/** Marca o motivo e derruba o processo: o supervisor do Termux reabre em segundos. */
export function fail(reason: string, detail = ''): never {
  writeLastExit(reason, detail);
  log.error(`Encerrando para reinício: ${reason}${detail ? ` — ${detail}` : ''}`);
  process.exit(1);
}

function countRecentErrors(now: number): number {
  try {
    const content = fs.readFileSync(botErrorLog, 'utf8');
    let count = 0;
    for (const line of content.split('\n')) {
      const match = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/.exec(line);
      if (!match) continue;
      const at = Date.parse(match[1]);
      if (Number.isFinite(at) && now - at <= errorWindowMs) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

function rotate(file: string): void {
  try {
    if (fs.statSync(file).size > heartbeatLogMaxBytes) {
      fs.renameSync(file, `${file}.1`);
    }
  } catch {
    // arquivo ainda não existe
  }
}

/**
 * Vigia do processo: grava o heartbeat que o supervisor externo monitora e encerra o
 * processo quando o gateway fica surdo ou quando há erros repetidos, para que o
 * reinício automático aconteça antes de o bot ficar "online mas mudo".
 */
export function startHealthWatch(client: Client): void {
  fs.mkdirSync(paths.data, { recursive: true });
  const startedAt = Date.now();
  let notReadySince = startedAt;
  let everReady = client.isReady();
  let pingFailures = 0;

  const tick = (): void => {
    const now = Date.now();
    const ready = client.isReady();
    const ping = client.ws.ping;

    if (ready) {
      everReady = true;
      notReadySince = now;
    }

    try {
      fs.writeFileSync(
        heartbeatFile,
        JSON.stringify({
          pid: process.pid,
          ready,
          ping: Number.isFinite(ping) ? ping : null,
          at: new Date(now).toISOString(),
        }),
        'utf8',
      );
      fs.appendFileSync(
        heartbeatLog,
        `${new Date(now).toISOString()} ready=${ready} ping=${Number.isFinite(ping) ? ping : 'null'}\n`,
      );
    } catch {
      // disco cheio não deve derrubar o bot
    }
    rotate(heartbeatLog);

    if (ready) {
      if (!Number.isFinite(ping) || ping < 0) {
        pingFailures += 1;
        if (pingFailures >= pingFailureLimit) {
          fail('gateway_ping_invalido', `${pingFailures} checagens seguidas sem ACK`);
        }
      } else {
        pingFailures = 0;
      }
    } else {
      pingFailures = 0;
      if (!everReady && now - startedAt > notReadyLimitMs) {
        fail('gateway_nunca_conectou', `isReady()=false desde o início (${Math.round((now - startedAt) / 1000)}s)`);
      }
      if (everReady && now - notReadySince > notReadyLimitMs) {
        fail('gateway_desconectado', `isReady()=false há ${Math.round((now - notReadySince) / 1000)}s`);
      }
    }

    const recent = countRecentErrors(now);
    if (recent >= errorLimit) {
      fail('erros_repetidos', `${recent} erros em ${Math.round(errorWindowMs / 60_000)} min`);
    }
  };

  const timer = setInterval(tick, checkMs);
  timer.unref();
  tick();
  log.info(`vigia ativo (cada ${checkMs / 1000}s; heartbeat em ${heartbeatFile})`);
}
