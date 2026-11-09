import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { planConfig, queueConfig } from '../config';
import {
  countQueued,
  countQueuedPlans,
  countTodayGlobal,
  getRunningJob,
  isQueuePaused,
  listQueued,
} from '../db';
import { getRepoState } from '../git';
import { canManageGuildForInteraction } from '../services/permissions';
import {
  discordTimestamp,
  jobLineWithPrompt,
  promptPreview,
  truncate,
} from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('fila')
  .setDescription('Mostra o estado da fila de implementações');

export interface FilaView {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}

/** Monta a visão da fila; o botão de pausa só aparece para quem gerencia o servidor. */
export function filaView(canManage: boolean): FilaView {
  const repo = getRepoState();
  const running = getRunningJob();
  const queued = countQueued();
  const plansQueued = countQueuedPlans();
  const next = listQueued(5);
  const today = countTodayGlobal();
  const paused = isQueuePaused();

  const embed = new EmbedBuilder()
    .setTitle('Fila de implementações')
    .setColor(paused ? 0xe67e22 : 0x2ecc71)
    .addFields(
      {
        name: 'Estado',
        value: paused ? 'Pausada' : 'Ativa',
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
        name: 'Planos na fila',
        value: `${plansQueued}/${planConfig.queueLimit}`,
        inline: true,
      },
      {
        name: 'Últimas 24h',
        value:
          queueConfig.dailyGlobalLimit > 0
            ? `${today}/${queueConfig.dailyGlobalLimit}`
            : `${today} (${queueConfig.dailyUserLimit}/usuário)`,
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
          ? `**#${running.id}** ${truncate(running.title, 60)} ${discordTimestamp(running.started_at)}\n> <@${running.author_id}> • ${promptPreview(running, 70)}`
          : '—',
      },
      {
        name: 'Próximos',
        value:
          next.length > 0
            ? next.map((job) => jobLineWithPrompt(job, 70)).join('\n')
            : '—',
      },
    )
    .setFooter({ text: 'Use /implementar para enviar uma implementação' })
    .setTimestamp();

  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  if (canManage) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        paused
          ? new ButtonBuilder()
              .setCustomId('queue:resume')
              .setLabel('Retomar fila')
              .setStyle(ButtonStyle.Success)
          : new ButtonBuilder()
              .setCustomId('queue:pause')
              .setLabel('Pausar fila')
              .setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  return { embeds: [embed], components };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    ...filaView(canManageGuildForInteraction(interaction)),
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}
