import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { listByAuthor } from '../db';
import { discordTimestamp, statusLabel } from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('minhas-implementacoes')
  .setDescription('Lista as suas implementações mais recentes');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const jobs = listByAuthor(interaction.user.id, 10);

  if (jobs.length === 0) {
    await interaction.reply({
      content: 'Você ainda não enviou nenhuma implementação. Use `/implementar`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lines = jobs.map(
    (job) =>
      `**#${job.id}** ${job.title}\n> ${statusLabel(job.status)} • ${discordTimestamp(job.created_at)}`,
  );

  const embed = new EmbedBuilder()
    .setTitle('Suas implementações')
    .setColor(0x3498db)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `${jobs.length} implementação(ões) mais recente(s)` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
