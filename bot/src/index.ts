import { Client, Events, GatewayIntentBits } from 'discord.js';
import { notifyRestart } from './alerts';
import { discordConfig, requireBotConfig } from './config';
import { getDb } from './db';
import { execute as onInteraction } from './events/interactionCreate';
import { startHealthWatch, writeLastExit } from './health';
import { createLogger } from './logger';

const log = createLogger('bot');

requireBotConfig();
getDb();
void notifyRestart();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  log.info(`Online como ${readyClient.user.tag} (${readyClient.user.id})`);
  startHealthWatch(readyClient);
});

client.on(Events.InteractionCreate, onInteraction);

client.on(Events.Error, (error) => {
  log.error(`Erro do client: ${String(error)}`);
});

client.login(discordConfig.token).catch((error) => {
  log.error(`Falha no login: ${String(error)}`);
  writeLastExit('falha_no_login', String(error));
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log.error(`Unhandled rejection: ${String(error)}`);
});

process.on('uncaughtException', (error) => {
  log.error(`Exceção não capturada: ${error.stack ?? String(error)}`);
  writeLastExit('excecao_nao_capturada', error.message);
  process.exit(1);
});

async function shutdown(signal: string): Promise<void> {
  log.info(`Recebido ${signal}, desligando...`);
  await client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
