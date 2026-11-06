import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { listRecent } from '../db';
import { discordTimestamp, statusLabel } from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('ultimas-implementacoes')
  .setDescription('Lista as últimas implementações do servidor');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const jobs = listRecent(10);

  if (jobs.length === 0) {
    await interaction.reply({
      content: 'Ainda não há implementações registradas. Use `/implementar`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const lines = jobs.map(
    (job) =>
      `**#${job.id}** ${job.title}\n> ${statusLabel(job.status)} • ${discordTimestamp(job.created_at)}`,
  );

  const embed = new EmbedBuilder()
    .setTitle('Últimas implementações')
    .setColor(0x2ecc71)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: `${jobs.length} implementação(ões) mais recente(s)` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
