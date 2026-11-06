import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getJob, Job } from '../db';
import { isMod } from '../services/permissions';

export async function requireMod(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!isMod(interaction)) {
    await interaction.reply({
      content: 'Só moderadores podem usar este comando.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
}

export async function requireJobOption(
  interaction: ChatInputCommandInteraction,
): Promise<Job | null> {
  const id = interaction.options.getInteger('id', true);
  const job = getJob(id);
  if (!job) {
    await interaction.reply({
      content: `Job #${id} não encontrado.`,
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return job;
}
