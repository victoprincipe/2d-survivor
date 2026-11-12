import fs from 'node:fs';
import path from 'node:path';
import { paths } from './config';

type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function enabled(level: Level): boolean {
  const configured = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as Level;
  return order[level] >= (order[configured] ?? order.info);
}

function format(scope: string, level: Level, message: string): string {
  return `${new Date().toISOString()} [${level.toUpperCase()}] [${scope}] ${message}`;
}

export function createLogger(scope: string) {
  return {
    debug(message: string): void {
      if (enabled('debug')) console.debug(format(scope, 'debug', message));
    },
    info(message: string): void {
      if (enabled('info')) console.log(format(scope, 'info', message));
    },
    warn(message: string): void {
      if (enabled('warn')) console.warn(format(scope, 'warn', message));
    },
    error(message: string): void {
      if (enabled('error')) console.error(format(scope, 'error', message));
    },
  };
}

export function ensureLogDir(): void {
  fs.mkdirSync(paths.logs, { recursive: true });
}

export function jobLogPath(jobId: number, suffix = ''): string {
  ensureLogDir();
  return path.join(paths.logs, `job-${jobId}${suffix}.log`);
}

export function planLogPath(planId: number, suffix = ''): string {
  ensureLogDir();
  return path.join(paths.logs, `plan-${planId}${suffix}.log`);
}

export function appendBotError(context: string, error: unknown): void {
  try {
    ensureLogDir();
    const file = path.join(paths.logs, 'bot-errors.log');
    // rotaciona antes de crescer demais (o health.ts lê esse arquivo a cada 30 s)
    try {
      if (fs.statSync(file).size > 1_000_000) fs.renameSync(file, `${file}.1`);
    } catch {
      // ainda não existe
    }
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    fs.appendFileSync(
      file,
      `${new Date().toISOString()} ${context}\n${detail}\n\n`,
    );
  } catch {
    // log de diagnóstico não pode derrubar o bot
  }
}

export function appendJobLog(jobId: number, line: string, suffix = ''): void {
  fs.appendFileSync(jobLogPath(jobId, suffix), line.endsWith('\n') ? line : `${line}\n`);
}

export function readLogTail(filePath: string, maxChars = 2500): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.length <= maxChars ? content : content.slice(content.length - maxChars);
  } catch {
    return '';
  }
}
