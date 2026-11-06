import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getJob, JobStatus, markCancelled } from '../db';
import { branchExists, deleteBranch, worktreeRemove } from '../git';
import { updateJobMessage } from '../services/notify';
import { requireJobOption, requireMod } from './_helpers';

export const data = new SlashCommandBuilder()
  .setName('fila-descartar')
  .setDescription('Descarta um job e apaga a branch/worktree dele')
  .addIntegerOption((option) =>
    option.setName('id').setDescription('ID da sugestão').setRequired(true).setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireMod(interaction))) return;

  const job = await requireJobOption(interaction);
  if (!job) return;

  const discardable: JobStatus[] = ['queued', 'needs_review', 'failed', 'interrupted', 'cancelled'];
  if (!discardable.includes(job.status)) {
    await interaction.reply({
      content: `O job #${job.id} está com status "${job.status}" e não pode ser descartado.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!markCancelled(job.id, discardable, true)) {
    await interaction.editReply(`O job #${job.id} já começou a rodar e não foi descartado.`);
    return;
  }

  if (job.worktree) worktreeRemove(job.worktree);
  if (job.branch && branchExists(job.branch)) deleteBranch(job.branch);

  const updated = getJob(job.id);
  if (updated) await updateJobMessage(updated);

  await interaction.editReply({
    content: `Job #${job.id} descartado.`,
  });
}
