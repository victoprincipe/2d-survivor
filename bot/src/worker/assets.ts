import fs from 'node:fs';
import path from 'node:path';
import { imageConfig, paths } from '../config';
import {
  Job,
  JobAttachment,
  Plan,
  jobAttachments,
  planAttachments,
} from '../db';
import { createLogger } from '../logger';

const log = createLogger('assets');

export const JOB_ASSETS_DIR = '.job-assets';

function ensureExcluded(worktree: string): void {
  const exclude = path.join(worktree, '.git', 'info', 'exclude');
  const entry = `${JOB_ASSETS_DIR}/`;
  const current = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
  const alreadyExcluded = current
    .split('\n')
    .some((line) => line.trim() === entry);

  if (alreadyExcluded) return;

  fs.mkdirSync(path.dirname(exclude), { recursive: true });
  const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(exclude, `${separator}${entry}\n`);
}

/**
 * Copia anexos para .job-assets/ dentro do clone.
 * O diretório é excluído do git; só o que o agente copiar para public/ entra
 * no commit. Retorna os caminhos relativos para citar no prompt.
 */
export function copyAssets(
  attachments: JobAttachment[],
  worktree: string,
  label: string,
): string[] {
  if (attachments.length === 0) return [];

  ensureExcluded(worktree);

  const destDir = path.join(worktree, JOB_ASSETS_DIR);
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  const relativePaths: string[] = [];

  for (const attachment of attachments) {
    if (!fs.existsSync(attachment.file)) {
      throw new Error(
        `Imagem "${attachment.name}" do ${label} não encontrada em ${attachment.file}. ` +
          'Ela pode ter expirado; reenvie o prompt com as imagens.',
      );
    }

    const name = path.basename(attachment.file);
    const dest = path.join(destDir, name);
    fs.copyFileSync(attachment.file, dest);
    relativePaths.push(`${JOB_ASSETS_DIR}/${name}`);
  }

  log.info(`${label}: ${relativePaths.length} imagem(ns) em ${destDir}`);
  return relativePaths;
}

export function copyJobAssets(job: Job, worktree: string): string[] {
  return copyAssets(jobAttachments(job), worktree, `Job #${job.id}`);
}

export function copyPlanAssets(plan: Plan, worktree: string): string[] {
  return copyAssets(planAttachments(plan), worktree, `Plano #${plan.id}`);
}

export function removeJobAssets(worktree: string): void {
  fs.rmSync(path.join(worktree, JOB_ASSETS_DIR), { recursive: true, force: true });
}

/** Remove imagens antigas para não acumular espaço em disco. */
export function cleanupOldAssets(): number {
  if (!fs.existsSync(paths.assets)) return 0;

  const cutoff = Date.now() - imageConfig.retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  for (const entry of fs.readdirSync(paths.assets, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith('message-') && !entry.name.startsWith('job-')) continue;

    const target = path.join(paths.assets, entry.name);
    // Proteção contra symlink/escape do diretório de assets.
    if (path.dirname(path.resolve(target)) !== path.resolve(paths.assets)) continue;

    try {
      const stat = fs.statSync(target);
      if (stat.mtimeMs < cutoff) {
        fs.rmSync(target, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      // item já removido
    }
  }

  if (removed > 0) {
    log.info(`Removidas ${removed} pasta(s) de imagens com mais de ${imageConfig.retentionDays} dias.`);
  }
  return removed;
}
