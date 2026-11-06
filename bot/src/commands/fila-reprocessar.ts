import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getQueuePosition, requeueJob } from '../db';
import { requireJobOption, requireMod } from './_helpers';

export const data = new SlashCommandBuilder()
  .setName('fila-reprocessar')
  .setDescription('Recoloca um job que falhou de volta na fila')
  .addIntegerOption((option) =>
    option.setName('id').setDescription('ID da sugestão').setRequired(true).setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireMod(interaction))) return;

  const job = await requireJobOption(interaction);
  if (!job) return;

  const retryable = ['failed', 'interrupted', 'cancelled', 'needs_review'];
  if (!retryable.includes(job.status)) {
    await interaction.reply({
      content: `O job #${job.id} está com status "${job.status}" e não pode ser reprocessado.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  requeueJob(job.id);
  const position = getQueuePosition(job.id);

  await interaction.reply({
    content: `Job #${job.id} recolocado na fila (posição ${position}).`,
    flags: MessageFlags.Ephemeral,
  });
}
