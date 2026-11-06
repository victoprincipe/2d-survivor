import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getJob, JobStatus, markCancelled } from '../db';
import { branchExists, deleteBranch, worktreeRemove } from '../git';
import { isMod } from '../services/permissions';
import { updateJobMessage } from '../services/notify';
import { requireJobOption } from './_helpers';

export const data = new SlashCommandBuilder()
  .setName('fila-cancelar')
  .setDescription('Cancela uma sugestão que ainda não foi executada')
  .addIntegerOption((option) =>
    option.setName('id').setDescription('ID da sugestão').setRequired(true).setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const job = await requireJobOption(interaction);
  if (!job) return;

  const mod = isMod(interaction);
  if (!mod && job.author_id !== interaction.user.id) {
    await interaction.reply({
      content: 'Você só pode cancelar as suas próprias sugestões.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cancellable: JobStatus[] = ['queued', 'needs_review', 'failed', 'interrupted', 'cancelled'];
  if (!cancellable.includes(job.status)) {
    await interaction.reply({
      content: `O job #${job.id} está com status "${job.status}" e não pode ser cancelado.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!markCancelled(job.id, cancellable)) {
    await interaction.editReply(
      `O job #${job.id} já começou a rodar e não foi cancelado. Use \`/fila-pausar\` e aguarde.`,
    );
    return;
  }

  if (job.worktree) worktreeRemove(job.worktree);
  if (job.branch && branchExists(job.branch)) deleteBranch(job.branch);

  const updated = getJob(job.id);
  if (updated) await updateJobMessage(updated);

  await interaction.editReply({
    content: `Sugestão #${job.id} cancelada.`,
  });
}
