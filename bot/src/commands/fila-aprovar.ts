import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { updateJob } from '../db';
import { requireJobOption, requireMod } from './_helpers';

export const data = new SlashCommandBuilder()
  .setName('fila-aprovar')
  .setDescription('Aprova e aplica um job que está aguardando revisão')
  .addIntegerOption((option) =>
    option.setName('id').setDescription('ID da sugestão').setRequired(true).setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireMod(interaction))) return;

  const job = await requireJobOption(interaction);
  if (!job) return;

  if (job.status !== 'needs_review') {
    await interaction.reply({
      content: `O job #${job.id} está com status "${job.status}", não "needs_review".`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (job.kind === 'rollback') {
    await interaction.reply({
      content: `O job #${job.id} é um rollback. Use \`/fila-reprocessar ${job.id}\`.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!job.commit_sha || !job.branch) {
    await interaction.reply({
      content: `O job #${job.id} não tem commit aplicável. Use \`/fila-reprocessar ${job.id}\`.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  updateJob(job.id, {
    status: 'queued',
    kind: 'apply',
    started_at: null,
    finished_at: null,
    heartbeat_at: null,
    error: null,
    review_reason: null,
  });

  await interaction.reply({
    content: `Job #${job.id} marcado para aplicação. O worker vai mesclar \`${job.branch}\` na main.`,
    flags: MessageFlags.Ephemeral,
  });
}
