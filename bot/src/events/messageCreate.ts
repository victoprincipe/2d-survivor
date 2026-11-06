import { Events, Message, TextChannel } from 'discord.js';
import { discordConfig } from '../config';
import { createJob, getQueuePosition, updateJob } from '../db';
import { createLogger } from '../logger';
import { cleanText, deriveTitle, validatePrompt } from '../services/moderation';
import { hasSubmitterRoleForMessage } from '../services/permissions';
import { checkAccountAge, checkSubmissionQuota } from '../services/quotas';
import { jobEmbed, truncate } from '../ui/embeds';

export const name = Events.MessageCreate;
export const once = false;

const log = createLogger('message');

async function reply(message: Message, content: string): Promise<void> {
  try {
    await message.reply({
      content: truncate(content, 1900),
      allowedMentions: { repliedUser: false },
    });
  } catch (error) {
    log.warn(`Falha ao responder ${message.author.id}: ${String(error)}`);
  }
}

export async function execute(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  if (message.author.bot) return;
  if (message.system) return;
  if (message.channelId !== discordConfig.promptChannelId) return;

  const prompt = cleanText(message.content);
  if (!prompt) return;

  if (!(await hasSubmitterRoleForMessage(message))) {
    await reply(message, 'Você não tem o cargo necessário para enviar implementações.');
    return;
  }

  const age = checkAccountAge(message.author.createdAt);
  if (!age.ok) {
    await reply(message, age.reason ?? 'Conta muito nova.');
    return;
  }

  const quota = checkSubmissionQuota(message.author.id);
  if (!quota.ok) {
    await reply(message, quota.reason ?? 'Quota indisponível.');
    return;
  }

  const validation = validatePrompt(prompt);
  if (!validation.ok) {
    await reply(message, validation.reason ?? 'Implementação inválida.');
    return;
  }

  const title = deriveTitle(prompt);
  let jobId: number | null = null;

  try {
    const job = createJob({
      authorId: message.author.id,
      authorName: message.author.username,
      title,
      prompt,
    });
    jobId = job.id;

    const channel = await message.client.channels.fetch(discordConfig.suggestionsChannelId);
    if (!(channel instanceof TextChannel)) {
      throw new Error('SUGGESTIONS_CHANNEL_ID não aponta para um canal de texto.');
    }

    const embedMessage = await channel.send({
      embeds: [jobEmbed(job)],
      allowedMentions: { parse: [] },
    });

    let threadId: string | null = null;
    try {
      const thread = await embedMessage.startThread({
        name: truncate(`Implementação #${job.id} — ${job.title}`, 90),
        autoArchiveDuration: 1440,
      });
      threadId = thread.id;
    } catch (error) {
      log.warn(`Não consegui criar thread para o job #${job.id}: ${String(error)}`);
    }

    updateJob(job.id, {
      channel_id: embedMessage.channelId,
      message_id: embedMessage.id,
      thread_id: threadId,
    });

    const position = getQueuePosition(job.id);
    const threadHint = threadId ? ` Acompanhe: <#${threadId}>.` : '';
    await reply(message, `Implementação #${job.id} na fila — posição ${position}.${threadHint}`);
  } catch (error) {
    log.error(`Falha ao registrar implementação: ${String(error)}`);
    if (jobId !== null) {
      updateJob(jobId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: `Falha ao publicar no Discord: ${String(error)}`,
      });
    }
    await reply(message, 'Não consegui registrar a implementação. Avise o administrador do servidor.');
  }
}
