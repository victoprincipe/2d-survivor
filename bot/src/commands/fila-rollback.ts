import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { updateJob } from '../db';
import { isAncestor } from '../git';
import { requireJobOption, requireMod } from './_helpers';

export const data = new SlashCommandBuilder()
  .setName('fila-rollback')
  .setDescription('Reverte um job já aplicado na main')
  .addIntegerOption((option) =>
    option.setName('id').setDescription('ID da sugestão').setRequired(true).setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireMod(interaction))) return;

  const job = await requireJobOption(interaction);
  if (!job) return;

  if (job.status === 'reverted') {
    await interaction.reply({
      content: `O job #${job.id} já foi revertido.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (job.status !== 'done' && job.status !== 'failed') {
    await interaction.reply({
      content: `O job #${job.id} está com status "${job.status}" e não foi aplicado na main.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!job.commit_sha || !isAncestor(job.commit_sha)) {
    await interaction.reply({
      content: `O commit do job #${job.id} não está mais na main. Nada para reverter.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  updateJob(job.id, {
    status: 'queued',
    kind: 'rollback',
    started_at: null,
    finished_at: null,
    heartbeat_at: null,
    error: null,
    review_reason: null,
  });

  await interaction.reply({
    content: `Rollback do job #${job.id} enfileirado. O worker vai rodar \`git revert\` na main.`,
    flags: MessageFlags.Ephemeral,
  });
}
