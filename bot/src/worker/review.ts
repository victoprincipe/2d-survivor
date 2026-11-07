import { queueConfig } from '../config';
import { getDiffStats } from '../git';

/** Caminhos que o agente nunca pode alterar sem revisão humana. */
export const PROTECTED_PATTERNS = [
  /^bot\//,
  /^\.github\//,
  /^\.git\//,
  /(^|\/)\.env(\.|$)/,
  /^AGENTS\.md$/,
  /^opencode\.jsonc?$/,
  /^\.opencode\//,
  /^package(-lock)?\.json$/,
  /^next\.config\./,
  /^tsconfig\.json$/,
  /^eslint\.config\./,
  /^postcss\.config\./,
  /^tailwind\.config\./,
  /^\.npmrc$/,
  /^\.yarnrc/,
];

/**
 * Motivos para bloquear a aplicação na master sem revisão humana.
 * Roda duas vezes: logo após o commit do agente e de novo depois de integrar
 * com uma master que avançou (a base e o diff podem ter mudado).
 */
export function reviewReasons(stats: ReturnType<typeof getDiffStats>): string[] {
  const reasons: string[] = [];

  if (stats.files > queueConfig.maxDiffFiles) {
    reasons.push(`Diff tocou ${stats.files} arquivos (limite ${queueConfig.maxDiffFiles})`);
  }
  if (stats.lines > queueConfig.maxDiffLines) {
    reasons.push(`Diff tem ${stats.lines} linhas (limite ${queueConfig.maxDiffLines})`);
  }
  if (stats.deletedFiles.length > 0) {
    reasons.push(`Arquivos removidos: ${stats.deletedFiles.slice(0, 5).join(', ')}`);
  }

  const protectedHits = stats.changedFiles.filter((file) =>
    PROTECTED_PATTERNS.some((pattern) => pattern.test(file)),
  );
  if (protectedHits.length > 0) {
    reasons.push(`Caminhos protegidos: ${protectedHits.slice(0, 5).join(', ')}`);
  }

  return reasons;
}
