import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getJob, getQueuePosition, updateJob } from '../db';

export const data = new SlashCommandBuilder()
  .setName('reprocessar')
  .setDescription('Recoloca uma implementação que falhou na fila')
  .addIntegerOption((option) =>
    option.setName('id').setDescription('ID da implementação').setRequired(true).setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getInteger('id', true);
  const job = getJob(id);

  if (!job) {
    await interaction.reply({
      content: `Implementação #${id} não encontrada.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  if (job.author_id !== interaction.user.id && !canManage) {
    await interaction.reply({
      content: 'Você só pode reprocessar as suas próprias implementações.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const retryable = ['failed', 'interrupted', 'needs_review'];
  if (!retryable.includes(job.status)) {
    await interaction.reply({
      content: `A implementação #${id} está com status "${job.status}" e não pode ser reprocessada.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  updateJob(id, {
    status: 'queued',
    error: null,
    review_reason: null,
    started_at: null,
    finished_at: null,
    heartbeat_at: null,
    worktree: null,
    branch: null,
    commit_sha: null,
    base_sha: null,
    diff_files: null,
    diff_lines: null,
    summary: null,
    attempts: 0,
  });

  const position = getQueuePosition(id);
  await interaction.reply({
    content: `Implementação #${id} recolocada na fila (posição ${position}).`,
    flags: MessageFlags.Ephemeral,
  });
}
