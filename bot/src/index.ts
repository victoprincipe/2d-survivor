import { Client, Events, GatewayIntentBits } from 'discord.js';
import { discordConfig, requireBotConfig } from './config';
import { getDb } from './db';
import { execute as onInteraction } from './events/interactionCreate';
import { createLogger } from './logger';

const log = createLogger('bot');

requireBotConfig();
getDb();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  log.info(`Online como ${readyClient.user.tag} (${readyClient.user.id})`);
});

client.on(Events.InteractionCreate, onInteraction);

client.on(Events.Error, (error) => {
  log.error(`Erro do client: ${String(error)}`);
});

client.login(discordConfig.token).catch((error) => {
  log.error(`Falha no login: ${String(error)}`);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log.error(`Unhandled rejection: ${String(error)}`);
});

async function shutdown(signal: string): Promise<void> {
  log.info(`Recebido ${signal}, desligando...`);
  await client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
