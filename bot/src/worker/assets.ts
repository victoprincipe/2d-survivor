import fs from 'node:fs';
import path from 'node:path';
import { imageConfig, paths } from '../config';
import {
  Job,
  JobAttachment,
  Plan,
  attachmentKind,
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

export interface CopyAssetsOptions {
  /** Áudios são preparados em public/audio pelo worker e não precisam ir para .job-assets. */
  skipAudio?: boolean;
}

/**
 * Copia anexos para .job-assets/ dentro do clone.
 * O diretório é excluído do git; só o que o agente copiar para public/ entra
 * no commit. Retorna os caminhos relativos para citar no prompt.
 *
 * Com skipAudio, os áudios viram strings vazias para manter o alinhamento com
 * o array de anexos; use audioAssetPath() para obter o caminho público.
 */
export function copyAssets(
  attachments: JobAttachment[],
  worktree: string,
  label: string,
  options: CopyAssetsOptions = {},
): string[] {
  if (attachments.length === 0) return [];

  ensureExcluded(worktree);

  const destDir = path.join(worktree, JOB_ASSETS_DIR);
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  const relativePaths: string[] = [];
  let copied = 0;

  for (const attachment of attachments) {
    if (options.skipAudio && attachmentKind(attachment) === 'audio') {
      relativePaths.push('');
      continue;
    }

    if (!fs.existsSync(attachment.file)) {
      throw new Error(
        `Anexo "${attachment.name}" do ${label} não encontrado em ${attachment.file}. ` +
          'Ele pode ter expirado; reenvie o prompt com os anexos.',
      );
    }

    const name = path.basename(attachment.file);
    const dest = path.join(destDir, name);
    fs.copyFileSync(attachment.file, dest);
    relativePaths.push(`${JOB_ASSETS_DIR}/${name}`);
    copied += 1;
  }

  log.info(`${label}: ${copied} anexo(s) em ${destDir}`);
  return relativePaths;
}

export function copyJobAssets(job: Job, worktree: string): string[] {
  return copyAssets(jobAttachments(job), worktree, `Job #${job.id}`, {
    skipAudio: true,
  });
}

export function copyPlanAssets(plan: Plan, worktree: string): string[] {
  return copyAssets(planAttachments(plan), worktree, `Plano #${plan.id}`);
}

/** Caminho relativo (no clone) onde o worker disponibiliza um áudio para o agente. */
export function audioAssetPath(jobId: number, attachment: JobAttachment): string {
  return path.posix.join(
    'public',
    'audio',
    `job-${jobId}-${path.basename(attachment.file)}`,
  );
}

/**
 * Copia os áudios do job para public/audio/ antes do agente.
 * O agente referencia a URL pública; não precisa (e não consegue) copiar binários.
 */
export function stageJobAudio(job: Job, worktree: string): string[] {
  const attachments = jobAttachments(job).filter(
    (attachment) => attachmentKind(attachment) === 'audio',
  );
  if (attachments.length === 0) return [];

  const staged: string[] = [];
  try {
    for (const attachment of attachments) {
      if (!fs.existsSync(attachment.file)) {
        throw new Error(
          `Áudio "${attachment.name}" do Job #${job.id} não encontrado em ${attachment.file}. ` +
            'Ele pode ter expirado; reenvie o prompt com os anexos.',
        );
      }

      const relativePath = audioAssetPath(job.id, attachment);
      const destination = path.join(worktree, relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(attachment.file, destination);
      staged.push(relativePath);
    }
  } catch (error) {
    removeStagedAudio(worktree, staged);
    throw error;
  }

  log.info(`Job #${job.id}: ${staged.length} áudio(s) em public/audio.`);
  return staged;
}

/** Remove áudios preparados pelo worker (usado quando o job não produziu mudanças). */
export function removeStagedAudio(worktree: string, relativePaths: string[]): void {
  const audioDir = path.resolve(worktree, 'public', 'audio');

  for (const relativePath of relativePaths) {
    if (!relativePath) continue;
    const target = path.resolve(worktree, relativePath);
    if (path.dirname(target) !== audioDir) continue;
    try {
      fs.rmSync(target, { force: true });
    } catch {
      // limpeza best-effort
    }
  }

  try {
    if (fs.existsSync(audioDir) && fs.readdirSync(audioDir).length === 0) {
      fs.rmdirSync(audioDir);
    }
  } catch {
    // diretório pode ter sido removido ou não estar vazio
  }
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
