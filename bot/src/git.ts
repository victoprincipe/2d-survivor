import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { paths, queueConfig } from './config';

export class GitError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = 'GitError';
  }
}

const COMMIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? '2d-survivor bot',
  GIT_AUTHOR_EMAIL:
    process.env.GIT_AUTHOR_EMAIL ??
    '6431486+victoprincipe@users.noreply.github.com',
  GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? '2d-survivor bot',
  GIT_COMMITTER_EMAIL:
    process.env.GIT_COMMITTER_EMAIL ??
    '6431486+victoprincipe@users.noreply.github.com',
  GIT_TERMINAL_PROMPT: '0',
  // `git rebase --continue` não deve abrir editor no worker.
  GIT_EDITOR: process.env.GIT_EDITOR ?? 'true',
  GIT_SEQUENCE_EDITOR: process.env.GIT_SEQUENCE_EDITOR ?? 'true',
};

export function git(args: string[], cwd = paths.repo, trim = true): string {
  try {
    const output = execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: COMMIT_ENV,
    });
    return trim ? output.trim() : output;
  } catch (error) {
    const err = error as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
    const stderr = err.stderr ? err.stderr.toString().trim() : '';
    const stdout = err.stdout ? err.stdout.toString().trim() : '';
    throw new GitError(
      `git ${args.join(' ')} falhou: ${stderr || stdout || err.message || 'erro desconhecido'}`,
      stderr,
    );
  }
}

export function gitTry(args: string[], cwd = paths.repo): { ok: boolean; stdout: string } {
  try {
    return { ok: true, stdout: git(args, cwd) };
  } catch {
    return { ok: false, stdout: '' };
  }
}

export interface RepoState {
  branch: string;
  head: string;
  shortHead: string;
  clean: boolean;
  dirtyFiles: string[];
}

export function getRepoState(cwd = paths.repo): RepoState {
  const branch = gitTry(['branch', '--show-current'], cwd).stdout || '(detached)';
  const head = gitTry(['rev-parse', 'HEAD'], cwd).stdout;
  const shortHead = head ? head.slice(0, 8) : '(sem commit)';
  const dirty = gitTry(['status', '--porcelain'], cwd).stdout;
  const dirtyFiles = dirty ? dirty.split('\n').filter(Boolean) : [];
  return { branch, head, shortHead, clean: dirtyFiles.length === 0, dirtyFiles };
}

export function assertRepoReady(): { ok: boolean; reason?: string } {
  const state = getRepoState();
  if (state.branch !== queueConfig.mainBranch) {
    return {
      ok: false,
      reason: `O repo está na branch "${state.branch}", não em "${queueConfig.mainBranch}".`,
    };
  }
  if (!state.clean) {
    return {
      ok: false,
      reason: `O repo tem ${state.dirtyFiles.length} alteração(ões) não commitada(s).`,
    };
  }
  return { ok: true };
}

export function createJobRepo(id: number): { dir: string; branch: string; base: string } {
  const branch = `implementacao/${id}`;
  const dir = `${paths.worktrees}/job-${id}`;

  worktreeRemove(dir);
  fs.mkdirSync(paths.worktrees, { recursive: true });

  const origin = gitTry(['remote', 'get-url', 'origin'], paths.repo).stdout;
  if (!origin) {
    throw new Error('Remote "origin" não configurado no repo principal.');
  }

  // Clone do origin: o job parte do que já foi publicado, não do checkout local.
  git(['clone', '--branch', queueConfig.mainBranch, origin, dir], paths.repo);
  const base = git(['rev-parse', 'HEAD'], dir);
  git(['checkout', '-B', branch, base], dir);
  return { dir, branch, base };
}

export function pushJobBranch(dir: string, branch: string): string {
  return git(['push', '--force', 'origin', branch], dir);
}

/**
 * Atualiza `origin/<branch>` no clone e devolve o sha remoto.
 * Usa refspec explícito para não depender da configuração do clone.
 */
export function fetchMain(dir: string, branch: string): string {
  git(
    ['fetch', '--prune', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`],
    dir,
  );
  return git(['rev-parse', `origin/${branch}`], dir);
}

/**
 * Reaplica o commit do job sobre o novo topo da master.
 * `-X theirs` numa rebase significa "o commit sendo reaplicado vence" — ou seja,
 * em caso de conflito as alterações do job são mantidas.
 * Conflitos que a estratégia não resolve sozinhos (modify/delete, add/add)
 * param a rebase e são tratados por resolveConflictsTakingTheirs().
 */
export function rebaseTakingJobChanges(dir: string, upstream: string): void {
  git(['rebase', '-X', 'theirs', upstream], dir);
}

export function rebaseInProgress(dir: string): boolean {
  for (const name of ['rebase-merge', 'rebase-apply']) {
    const raw = gitTry(['rev-parse', '--git-path', name], dir).stdout;
    if (!raw) continue;
    const resolved = path.isAbsolute(raw) ? raw : path.join(dir, raw);
    if (fs.existsSync(resolved)) return true;
  }
  return false;
}

export function conflictedPaths(dir: string): string[] {
  return gitTry(['diff', '--name-only', '--diff-filter=U'], dir).stdout
    .split('\n')
    .filter(Boolean);
}

function hasTheirsStage(dir: string, file: string): boolean {
  return gitTry(['ls-files', '-u', '--', file], dir).stdout
    .split('\n')
    .filter(Boolean)
    .some((entry) => {
      const [, , stage] = (entry.split('\t')[0] ?? '').split(' ');
      return stage === '3';
    });
}

/**
 * Resolve os conflitos pendentes a favor do job (o lado "theirs" da rebase).
 * Quando o job removeu o arquivo, mantém a remoção.
 */
export function resolveConflictsTakingTheirs(dir: string, files: string[]): void {
  for (const file of files) {
    if (hasTheirsStage(dir, file)) {
      git(['checkout', '--theirs', '--', file], dir);
      git(['add', '--', file], dir);
    } else {
      git(['rm', '-f', '--', file], dir);
    }
  }
}

/**
 * Continua a rebase; se o commit ficou vazio (a master já tinha a mudança),
 * descarta o commit em vez de falhar.
 */
export function continueRebase(dir: string): void {
  try {
    git(['rebase', '--continue'], dir);
  } catch (error) {
    if (gitTry(['diff', '--cached', '--quiet'], dir).ok) {
      git(['rebase', '--skip'], dir);
      return;
    }
    throw error;
  }
}

export function abortRebase(dir: string): void {
  if (rebaseInProgress(dir)) gitTry(['rebase', '--abort'], dir);
}

/**
 * Push da master com trava: falha se o origin não estiver exatamente em
 * `expectedSha` (alguém empurrou entre o fetch e o push). Assim o worker nunca
 * sobrescreve um commit que não viu; ele reintegra e tenta de novo.
 */
export function pushMainWithLease(
  dir: string,
  branch: string,
  expectedSha: string,
): string {
  return git(
    [
      'push',
      `--force-with-lease=refs/heads/${branch}:${expectedSha}`,
      'origin',
      `HEAD:${branch}`,
    ],
    dir,
  );
}

export function createPlanRepo(id: number): { dir: string; base: string } {
  const dir = `${paths.worktrees}/plan-${id}`;

  worktreeRemove(dir);
  fs.mkdirSync(paths.worktrees, { recursive: true });

  const origin = gitTry(['remote', 'get-url', 'origin'], paths.repo).stdout;
  if (!origin) {
    throw new Error('Remote "origin" não configurado no repo principal.');
  }

  git(['clone', '--branch', queueConfig.mainBranch, origin, dir], paths.repo);
  const base = git(['rev-parse', 'HEAD'], dir);
  return { dir, base };
}

export function worktreeRemove(dir: string): void {
  if (!fs.existsSync(dir)) return;
  if (!gitTry(['worktree', 'remove', '--force', dir]).ok) {
    fs.rmSync(dir, { recursive: true, force: true });
    gitTry(['worktree', 'prune']);
  }
}

export function hasChanges(worktree: string): boolean {
  return git(['status', '--porcelain'], worktree).length > 0;
}

/**
 * Como hasChanges, mas ignora os caminhos informados.
 * Usado para os áudios que o worker copia para public/ antes do agente não
 * contarem como trabalho do agente.
 */
export function hasChangesExcluding(
  worktree: string,
  ignoredPaths: string[],
): boolean {
  if (ignoredPaths.length === 0) return hasChanges(worktree);

  const ignored = new Set(
    ignoredPaths.filter(Boolean).map((file) => file.replace(/\\/g, '/')),
  );
  const entries = git(['status', '--porcelain', '-z', '-uall'], worktree, false)
    .split('\0')
    .filter(Boolean);

  return entries.some(
    (entry) => !ignored.has(entry.slice(3).replace(/\\/g, '/')),
  );
}

export function commitAll(worktree: string, message: string): string {
  git(['add', '-A'], worktree);
  git(['commit', '--no-verify', '-m', message], worktree);
  return git(['rev-parse', 'HEAD'], worktree);
}

export function getDiffStats(
  worktree: string,
  base: string,
): { files: number; lines: number; changedFiles: string[]; deletedFiles: string[] } {
  const numstat = gitTry(['diff', '--numstat', `${base}..HEAD`], worktree).stdout;
  let files = 0;
  let lines = 0;

  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue;
    const [added, removed] = line.split('\t');
    files += 1;
    if (added !== '-') lines += Number.parseInt(added, 10) || 0;
    if (removed !== '-') lines += Number.parseInt(removed, 10) || 0;
  }

  const nameStatus = gitTry(['diff', '--name-status', `${base}..HEAD`], worktree).stdout;
  const changedFiles: string[] = [];
  const deletedFiles: string[] = [];

  for (const line of nameStatus.split('\n')) {
    if (!line.trim()) continue;
    const [status, ...rest] = line.split('\t');
    const file = rest.join('\t');
    if (!file) continue;
    changedFiles.push(file);
    if (status.startsWith('D')) deletedFiles.push(file);
  }

  return { files, lines, changedFiles, deletedFiles };
}

export function mergeFf(branch: string): string {
  git(['merge', '--ff-only', branch]);
  return git(['rev-parse', 'HEAD']);
}

export function pushBranch(remote: string, branch: string): string {
  return git(['push', remote, branch]);
}

export function createTag(name: string, sha: string): void {
  gitTry(['tag', '-f', name, sha]);
}

export function deleteBranch(branch: string): void {
  gitTry(['branch', '-D', branch]);
}

export function branchExists(branch: string): boolean {
  return gitTry(['rev-parse', '--verify', branch]).ok;
}

export function isAncestor(sha: string, ref = 'HEAD', cwd = paths.repo): boolean {
  return gitTry(['merge-base', '--is-ancestor', sha, ref], cwd).ok;
}

export function revertCommit(sha: string): string {
  git(['revert', '--no-edit', sha]);
  return git(['rev-parse', 'HEAD']);
}

export function abortRevert(): void {
  gitTry(['revert', '--abort']);
}

export function revParse(ref: string, cwd = paths.repo): string {
  return git(['rev-parse', ref], cwd);
}

export function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 8) : '—';
}


