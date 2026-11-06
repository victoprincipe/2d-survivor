import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { queueConfig } from '../config';
import { setQueuePaused } from '../db';
import { assertRepoReady } from '../git';
import { requireMod } from './_helpers';

export const data = new SlashCommandBuilder()
  .setName('fila-retomar')
  .setDescription('Retoma a fila (exige repo limpo e na main)');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireMod(interaction))) return;

  const ready = assertRepoReady();
  if (!ready.ok) {
    await interaction.reply({
      content: `Não dá para retomar: ${ready.reason}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  setQueuePaused(false);
  await interaction.reply({
    content:
      `Fila ativa em \`${queueConfig.mainBranch}\`. ` +
      (queueConfig.autoApply
        ? 'Auto-apply ligado: jobs verdes entram direto na main.'
        : 'Auto-apply desligado: jobs verdes ficam em revisão.'),
    flags: MessageFlags.Ephemeral,
  });
}
