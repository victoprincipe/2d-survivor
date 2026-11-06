import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config';
import { git, worktreeRemove } from '../git';
import { gateEnv } from './env';

function removePath(target: string): void {
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(target);
    } else {
      fs.rmSync(target, { recursive: true, force: true });
    }
  } catch {
    // não existe
  }
}

/**
 * Cria um node_modules real dentro do worktree.
 *
 * Symlink para fora do worktree quebra o Turbopack ("Could not find the
 * Next.js package"). Hardlinks são rápidos e mantêm o node_modules dentro do
 * workspace root.
 */
export function prepareNodeModules(worktree: string): void {
  const source = path.join(paths.repo, 'node_modules');
  if (!fs.existsSync(source)) {
    throw new Error('node_modules do repositório não existe. Rode "npm install" na raiz.');
  }

  const target = path.join(worktree, 'node_modules');
  removePath(target);

  if (process.platform === 'win32') {
    execFileSync('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], {
      cwd: worktree,
      stdio: 'ignore',
      env: gateEnv(),
    });
    return;
  }

  try {
    execFileSync('cp', ['-al', source, target], { stdio: 'ignore' });
  } catch {
    // Fallback para filesystems sem hardlink (ex.: volumes diferentes).
    execFileSync('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], {
      cwd: worktree,
      stdio: 'ignore',
      env: gateEnv(),
    });
  }
}

export function createVerifyWorktree(jobId: number): string {
  fs.mkdirSync(paths.worktrees, { recursive: true });
  const dir = path.join(paths.worktrees, `verify-${jobId}`);
  worktreeRemove(dir);
  git(['worktree', 'add', '--detach', dir, 'HEAD']);
  prepareNodeModules(dir);
  return dir;
}

export function removeVerifyWorktree(dir: string): void {
  worktreeRemove(dir);
}
