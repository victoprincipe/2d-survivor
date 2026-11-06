import { REST, Routes } from 'discord.js';
import { commands } from './commands';
import { discordConfig, requireDeployConfig } from './config';
import { createLogger } from './logger';

const log = createLogger('deploy');

async function main(): Promise<void> {
  requireDeployConfig();

  const body = commands.map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(discordConfig.token);

  log.info(`Registrando ${body.length} comandos na guild ${discordConfig.guildId}...`);
  const data = (await rest.put(
    Routes.applicationGuildCommands(discordConfig.clientId, discordConfig.guildId),
    { body },
  )) as unknown[];

  log.info(`OK: ${data.length} comandos registrados.`);
  log.info(body.map((command) => `/${command.name}`).join(', '));
}

main().catch((error) => {
  log.error(String(error));
  process.exit(1);
});
