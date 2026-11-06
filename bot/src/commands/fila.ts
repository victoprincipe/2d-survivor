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
  isQueuePaused,
  listQueued,
} from '../db';
import { assertRepoReady, getRepoState } from '../git';
import { discordTimestamp, jobLine, truncate } from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('fila')
  .setDescription('Mostra o estado da fila de sugestões');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const paused = isQueuePaused();
  const repo = getRepoState();
  const ready = assertRepoReady();
  const running = getRunningJob();
  const queued = countQueued();
  const next = listQueued(5);
  const today = countTodayGlobal();

  const embed = new EmbedBuilder()
    .setTitle('Fila de sugestões')
    .setColor(paused || !ready.ok ? 0xe67e22 : 0x2ecc71)
    .addFields(
      {
        name: 'Estado',
        value: paused ? 'Pausada' : 'Ativa',
        inline: true,
      },
      {
        name: 'Auto-apply',
        value: queueConfig.autoApply ? 'Ligado' : 'Desligado (revisão)',
        inline: true,
      },
      {
        name: 'Na fila',
        value: `${queued}/${queueConfig.queueLimit}`,
        inline: true,
      },
      {
        name: 'Repo',
        value: `${repo.branch} @ \`${repo.shortHead}\` • ${
          repo.clean ? 'limpo' : `sujo (${repo.dirtyFiles.length})`
        }`,
      },
      {
        name: 'Rodando',
        value: running
          ? `**#${running.id}** ${truncate(running.title, 60)} ${discordTimestamp(running.started_at)}`
          : '—',
      },
      {
        name: 'Últimas 24h',
        value: `${today}/${queueConfig.dailyGlobalLimit}`,
        inline: true,
      },
      {
        name: 'Próximos',
        value: next.length > 0 ? next.map(jobLine).join('\n') : '—',
      },
    )
    .setFooter({ text: 'Use /sugerir para enviar uma ideia' })
    .setTimestamp();

  if (!ready.ok && ready.reason) {
    embed.addFields({ name: 'Aviso', value: ready.reason });
  }
  if (paused) {
    embed.addFields({
      name: 'Como retomar',
      value: 'Um moderador precisa usar `/fila-retomar` com o repo limpo e na main.',
    });
  }

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
