import { Events, Interaction, MessageFlags } from 'discord.js';
import { commandMap } from '../commands';
import { handleModalSubmit } from '../handlers/modalSubmit';
import { appendBotError, createLogger } from '../logger';
import { handlePlanButton } from './planButtons';
import { handleQueueButton } from './queueButtons';

const log = createLogger('interaction');

export const name = Events.InteractionCreate;
export const once = false;

function interactionContext(interaction: Interaction): string {
  if (interaction.isChatInputCommand()) {
    return `chat-input /${interaction.commandName} user=${interaction.user.id} guild=${interaction.guildId ?? '-'}`;
  }
  if (interaction.isModalSubmit()) {
    return `modal ${interaction.customId} user=${interaction.user.id} guild=${interaction.guildId ?? '-'}`;
  }
  if (interaction.isButton()) {
    return `button ${interaction.customId} user=${interaction.user.id} guild=${interaction.guildId ?? '-'}`;
  }
  return `interaction type=${interaction.type} user=${interaction.user?.id ?? '-'}`;
}

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
      return;
    }

    if (interaction.isButton()) {
      const match = /^plan:(approve|reject):(\d+)$/.exec(interaction.customId);
      if (match) {
        await handlePlanButton(
          interaction,
          match[1] as 'approve' | 'reject',
          Number(match[2]),
        );
        return;
      }

      const queueMatch = /^queue:(pause|resume)$/.exec(interaction.customId);
      if (queueMatch) {
        await handleQueueButton(interaction, queueMatch[1] as 'pause' | 'resume');
      }
      return;
    }
  } catch (error) {
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    log.error(`Erro em interação: ${detail}`);
    appendBotError(interactionContext(interaction), error);
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
