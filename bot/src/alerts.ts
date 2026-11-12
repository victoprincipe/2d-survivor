import { clearLastExit, readLastExit } from './health';
import { createLogger } from './logger';

const log = createLogger('alerts');

/**
 * Avisa no Discord que o processo foi reiniciado por causa de uma falha.
 * Sem webhook configurado, só registra no log e limpa a marca.
 */
export async function notifyRestart(): Promise<void> {
  const last = readLastExit();
  if (!last) return;

  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) {
    log.warn(`Reinício anterior por ${last.reason}; ALERT_WEBHOOK_URL não configurado.`);
    clearLastExit();
    return;
  }

  const when = new Date(last.at).toLocaleString('pt-BR');
  const detail = last.detail ? `\n> ${last.detail}` : '';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: `♻️ Bot reiniciado automaticamente após \`${last.reason}\` (${when}).${detail}`,
      }),
    });
    if (!response.ok) {
      log.warn(`Webhook respondeu ${response.status} ao avisar reinício.`);
    }
    clearLastExit();
  } catch (error) {
    log.warn(`Falha ao avisar reinício: ${String(error)}`);
  }
}
