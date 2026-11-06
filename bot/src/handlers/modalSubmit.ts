import {
  MessageFlags,
  ModalSubmitInteraction,
  TextChannel,
} from 'discord.js';
import { discordConfig } from '../config';
import { createJob, getQueuePosition, updateJob } from '../db';
import { createLogger } from '../logger';
import { cleanText, deriveTitle, validatePrompt } from '../services/moderation';
import { hasSubmitterRole } from '../services/permissions';
import { checkAccountAge, checkSubmissionQuota } from '../services/quotas';
import { jobEmbed, truncate } from '../ui/embeds';

const log = createLogger('modal');

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== 'implementacao:criar') return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!interaction.guildId) {
    await interaction.editReply('Este formulário só funciona dentro do servidor.');
    return;
  }

  if (!hasSubmitterRole(interaction)) {
    await interaction.editReply('Você não tem o cargo necessário para enviar implementações.');
    return;
  }

  const age = checkAccountAge(interaction.user.createdAt);
  if (!age.ok) {
    await interaction.editReply(age.reason ?? 'Conta muito nova.');
    return;
  }

  const quota = checkSubmissionQuota(interaction.user.id);
  if (!quota.ok) {
    await interaction.editReply(quota.reason ?? 'Quota indisponível.');
    return;
  }

  const prompt = cleanText(interaction.fields.getTextInputValue('descricao'));

  const validation = validatePrompt(prompt);
  if (!validation.ok) {
    await interaction.editReply(validation.reason ?? 'Implementação inválida.');
    return;
  }

  const title = deriveTitle(prompt);

  let jobId: number | null = null;

  try {
    const job = createJob({
      authorId: interaction.user.id,
      authorName: interaction.user.username,
      title,
      prompt,
    });
    jobId = job.id;

    const channel = await interaction.client.channels.fetch(discordConfig.suggestionsChannelId);
    if (!(channel instanceof TextChannel)) {
      throw new Error('SUGGESTIONS_CHANNEL_ID não aponta para um canal de texto.');
    }

    const message = await channel.send({
      embeds: [jobEmbed(job)],
      allowedMentions: { parse: [] },
    });

    let threadId: string | null = null;
    try {
      const thread = await message.startThread({
        name: truncate(`Implementação #${job.id} — ${job.title}`, 90),
        autoArchiveDuration: 1440,
      });
      threadId = thread.id;
    } catch (error) {
      log.warn(`Não consegui criar thread para o job #${job.id}: ${String(error)}`);
    }

    updateJob(job.id, {
      channel_id: message.channelId,
      message_id: message.id,
      thread_id: threadId,
    });

    const position = getQueuePosition(job.id);
    await interaction.editReply(
      `Implementação **#${job.id}** registrada. Posição na fila: **${position}**. ` +
        'Acompanhe pelo thread criado no canal de implementações.',
    );
  } catch (error) {
    log.error(`Falha ao registrar implementação: ${String(error)}`);
    if (jobId !== null) {
      updateJob(jobId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: `Falha ao publicar no Discord: ${String(error)}`,
      });
    }
    await interaction.editReply(
      'Não consegui registrar a implementação. Avise o administrador do servidor para verificar os logs do bot.',
    );
  }
}
