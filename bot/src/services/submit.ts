import fs from 'node:fs';
import path from 'node:path';
import { Attachment, Client, TextChannel } from 'discord.js';
import { discordConfig, paths } from '../config';
import {
  JobAttachment,
  createJob,
  getQueuePosition,
  updateJob,
} from '../db';
import { createLogger } from '../logger';
import { downloadImages, validateImageMetadata } from './attachments';
import { cleanText, deriveTitle, validatePrompt } from './moderation';
import { checkAccountAge, checkSubmissionQuota } from './quotas';
import { jobEmbed, truncate } from '../ui/embeds';

const log = createLogger('submit');

export interface SubmitImplementationInput {
  client: Client;
  authorId: string;
  authorName: string;
  authorCreatedAt: Date;
  prompt: string;
  images: Attachment[];
  hasRole: boolean;
  /** Plano aprovado que originou a implementação. */
  planId?: number;
  /** Título pronto (ex.: plano); se ausente, deriva do prompt. */
  titleOverride?: string;
  /** ID da mensagem/interação; usado para nomear a pasta de assets. */
  submissionId: string;
  reply: (content: string) => Promise<void>;
}

export interface SubmissionResult {
  jobId: number;
  position: number;
  threadId: string | null;
  imageCount: number;
}

/**
 * Fluxo comum de envio: usado pelo chat e pelo /implementar.
 * Valida, baixa imagens, cria o job no SQLite e publica o embed na fila.
 */
export async function submitImplementation(
  input: SubmitImplementationInput,
): Promise<SubmissionResult | null> {
  const prompt = cleanText(input.prompt);
  const images = input.images;

  if (prompt.length === 0 && images.length === 0 && !input.planId) {
    await input.reply('Escreva uma descrição ou anexe uma imagem.');
    return null;
  }

  const imageError = validateImageMetadata(images);
  if (imageError) {
    await input.reply(imageError);
    return null;
  }

  if (!input.hasRole) {
    await input.reply('Você não tem o cargo necessário para enviar implementações.');
    return null;
  }

  const age = checkAccountAge(input.authorCreatedAt);
  if (!age.ok) {
    await input.reply(age.reason ?? 'Conta muito nova.');
    return null;
  }

  const quota = checkSubmissionQuota(input.authorId);
  if (!quota.ok) {
    await input.reply(quota.reason ?? 'Quota indisponível.');
    return null;
  }

  const validation = validatePrompt(prompt, images.length, Boolean(input.planId));
  if (!validation.ok) {
    await input.reply(validation.reason ?? 'Implementação inválida.');
    return null;
  }

  let attachments: JobAttachment[] = [];
  if (images.length > 0) {
    try {
      attachments = await downloadImages(input.submissionId, images);
    } catch (error) {
      log.error(`Falha ao baixar imagens do envio ${input.submissionId}: ${String(error)}`);
      await input.reply(
        `Não consegui baixar as imagens: ${truncate(String(error), 300)}`,
      );
      return null;
    }
  }

  const title = input.titleOverride
    ? truncate(input.titleOverride, 100)
    : deriveTitle(
        prompt,
        attachments.map((attachment) => attachment.name),
      );
  let jobId: number | null = null;

  try {
    const job = createJob({
      authorId: input.authorId,
      authorName: input.authorName,
      title,
      prompt,
      planId: input.planId,
      attachments,
    });
    jobId = job.id;

    const channel = await input.client.channels.fetch(discordConfig.suggestionsChannelId);
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
    const imageHint =
      attachments.length > 0
        ? ` ${attachments.length} imagem(ns) anexada(s).`
        : '';
    await input.reply(
      `Implementação #${job.id} na fila — posição ${position}.${imageHint}${threadHint}`,
    );

    return {
      jobId: job.id,
      position,
      threadId,
      imageCount: attachments.length,
    };
  } catch (error) {
    log.error(`Falha ao registrar implementação: ${String(error)}`);
    if (jobId !== null) {
      updateJob(jobId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: `Falha ao publicar no Discord: ${String(error)}`,
      });
    } else if (attachments.length > 0) {
      fs.rmSync(path.join(paths.assets, `message-${input.submissionId}`), {
        recursive: true,
        force: true,
      });
    }
    await input.reply('Não consegui registrar a implementação. Avise o administrador do servidor.');
    return null;
  }
}
