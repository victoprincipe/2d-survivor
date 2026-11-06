import { Events, Interaction, MessageFlags } from 'discord.js';
import { commandMap } from '../commands';
import { handleModalSubmit } from '../handlers/modalSubmit';
import { createLogger } from '../logger';

const log = createLogger('interaction');

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      if (!interaction.guildId) {
        await interaction.reply({
          content: 'Este bot só funciona dentro do servidor.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const command = commandMap.get(interaction.commandName);
      if (!command) {
        log.warn(`Comando desconhecido: ${interaction.commandName}`);
        return;
      }

      await command.execute(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (error) {
    log.error(`Erro em interação: ${String(error)}`);
    if (!interaction.isRepliable()) return;

    const payload = {
      content: 'Ocorreu um erro ao executar essa ação. Tente de novo ou avise um moderador.',
      flags: MessageFlags.Ephemeral,
    } as const;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => undefined);
    } else {
      await interaction.reply(payload).catch(() => undefined);
    }
  }
}
