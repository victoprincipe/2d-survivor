export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior)\s+instructions/i, reason: 'padrão de prompt injection' },
  { pattern: /ignore\s+(all\s+)?(previous|prior)\s+prompts/i, reason: 'padrão de prompt injection' },
  { pattern: /system\s+prompt/i, reason: 'tentativa de manipular o agente' },
  { pattern: /\.env\b/i, reason: 'referência a arquivo de segredos' },
  { pattern: /id_rsa/i, reason: 'referência a chave SSH' },
  { pattern: /ssh\s+key/i, reason: 'referência a chave SSH' },
  { pattern: /rm\s+-rf/i, reason: 'comando destrutivo' },
  { pattern: /\bsudo\b/i, reason: 'comando privilegiado' },
  { pattern: /git\s+push/i, reason: 'comando de git não permitido' },
  { pattern: /(curl|wget)\s+https?:\/\//i, reason: 'download de conteúdo externo' },
];

export function cleanText(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
}

export function validatePrompt(prompt: string): ValidationResult {
  if (prompt.length < 20 || prompt.length > 1500) {
    return { ok: false, reason: 'A descrição precisa ter entre 20 e 1500 caracteres.' };
  }

  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(prompt)) {
      return { ok: false, reason: `Implementação bloqueada: ${reason}.` };
    }
  }

  return { ok: true };
}

export function deriveTitle(prompt: string): string {
  const firstLine = prompt
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  const title = firstLine ?? 'Implementação';
  return title.length > 100 ? `${title.slice(0, 99)}…` : title;
}
