import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { queueConfig } from '../config';
import {
  countQueued,
  countTodayGlobal,
  getRunningJob,
  listQueued,
} from '../db';
import { getRepoState } from '../git';
import { discordTimestamp, jobLine, truncate } from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('fila')
  .setDescription('Mostra o estado da fila de implementações');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const repo = getRepoState();
  const running = getRunningJob();
  const queued = countQueued();
  const next = listQueued(5);
  const today = countTodayGlobal();

  const embed = new EmbedBuilder()
    .setTitle('Fila de implementações')
    .setColor(0x2ecc71)
    .addFields(
      {
        name: 'Estado',
        value: 'Ativa',
        inline: true,
      },
      {
        name: 'Worker',
        value: `origin/${queueConfig.mainBranch}`,
        inline: true,
      },
      {
        name: 'Na fila',
        value: `${queued}/${queueConfig.queueLimit}`,
        inline: true,
      },
      {
        name: 'Últimas 24h',
        value: `${today}/${queueConfig.dailyGlobalLimit}`,
        inline: true,
      },
      {
        name: 'Repo local',
        value: `${repo.branch} @ \`${repo.shortHead}\` • ${
          repo.clean ? 'limpo' : `sujo (${repo.dirtyFiles.length}) — WIP não bloqueia`
        }`,
      },
      {
        name: 'Rodando',
        value: running
          ? `**#${running.id}** ${truncate(running.title, 60)} ${discordTimestamp(running.started_at)}`
          : '—',
      },
      {
        name: 'Próximos',
        value: next.length > 0 ? next.map(jobLine).join('\n') : '—',
      },
    )
    .setFooter({ text: 'Escreva o prompt no canal de implementações' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
