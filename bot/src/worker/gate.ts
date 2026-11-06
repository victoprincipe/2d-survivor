import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { queueConfig } from '../config';
import { jobLogPath, readLogTail } from '../logger';
import { gateEnv } from './env';

interface StepResult {
  label: string;
  ok: boolean;
  exitCode: number | null;
  tail: string;
}

export interface GateResult {
  ok: boolean;
  logPath: string;
  steps: StepResult[];
  tail: string;
}

function killTree(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // já morreu
    }
  }
}

function runStep(
  label: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  logPath: string,
): Promise<StepResult> {
  fs.appendFileSync(logPath, `\n=== ${label}: npm ${args.join(' ')} ===\n`);

  return new Promise<StepResult>((resolve) => {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npm, args, {
      cwd,
      env: gateEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    let output = '';
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;

    const append = (chunk: Buffer): void => {
      const text = chunk.toString();
      output += text;
      if (output.length > 20_000) output = output.slice(-20_000);
      try {
        fs.appendFileSync(logPath, text);
      } catch {
        // ignora falha de log
      }
    };

    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      append(Buffer.from(`\n[worker] timeout de ${timeoutMs / 60_000} min; encerrando.\n`));
      killTree(child.pid, 'SIGTERM');
      killTimer = setTimeout(() => killTree(child.pid, 'SIGKILL'), 5_000);
    }, timeoutMs);

    child.on('error', (error) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      fs.appendFileSync(logPath, `\n[worker] erro ao executar npm: ${error.message}\n`);
      resolve({ label, ok: false, exitCode: null, tail: error.message });
    });

    child.on('close', (code) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);

      if (timedOut) {
        append(Buffer.from(`\n[worker] ${label} abortado por timeout.\n`));
        resolve({
          label,
          ok: false,
          exitCode: null,
          tail: `${label} excedeu o timeout de ${timeoutMs / 60_000} min.`,
        });
        return;
      }

      resolve({
        label,
        ok: code === 0,
        exitCode: code,
        tail: output.length > 6_000 ? output.slice(-6_000) : output,
      });
    });
  });
}

export async function runGate(jobId: number, worktree: string, suffix = ''): Promise<GateResult> {
  const logPath = jobLogPath(jobId, `-${suffix || 'gate'}`);
  fs.writeFileSync(logPath, `# Gate — job #${jobId}\n`);

  const build = await runStep('build', ['run', 'build'], worktree, queueConfig.buildTimeoutMs, logPath);
  const lint = build.ok
    ? await runStep('lint', ['run', 'lint'], worktree, queueConfig.lintTimeoutMs, logPath)
    : {
        label: 'lint',
        ok: false,
        exitCode: null,
        tail: 'lint não executado porque o build falhou.',
      };

  const lintOk = lint.ok || !queueConfig.lintStrict;
  const ok = build.ok && lintOk;

  return {
    ok,
    logPath,
    steps: [build, lint],
    tail: readLogTail(logPath, 3_500),
  };
}
