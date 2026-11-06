import fs from 'node:fs';
import path from 'node:path';
import { Attachment, Client, TextChannel } from 'discord.js';
import { discordConfig, imageConfig, paths } from '../config';
import {
  JobAttachment,
  createJob,
  getQueuePosition,
  updateJob,
} from '../db';
import { createLogger } from '../logger';
import { cleanText, deriveTitle, validatePrompt } from './moderation';
import { checkAccountAge, checkSubmissionQuota } from './quotas';
import { jobEmbed, truncate } from '../ui/embeds';

const log = createLogger('submit');

const IMAGE_NAME_PATTERN = /\.(png|jpe?g|gif|webp)$/i;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Detecta o formato real pelos magic bytes; o contentType do Discord pode mentir. */
function detectImage(buffer: Buffer): { contentType: string; extension: string } | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { contentType: 'image/png', extension: '.png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: '.jpg' };
  }
  const header6 = buffer.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') {
    return { contentType: 'image/gif', extension: '.gif' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', extension: '.webp' };
  }
  return null;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageAttachment(attachment: Attachment): boolean {
  return (
    (attachment.contentType ?? '').startsWith('image/') ||
    IMAGE_NAME_PATTERN.test(attachment.name)
  );
}

/**
 * Baixa os anexos para bot/data/assets/message-<id>/.
 * O nome local é gerado pelo tipo (nunca pelo nome enviado) para evitar
 * path traversal; o nome original fica só como metadado.
 */
async function downloadImages(
  submissionId: string,
  images: Attachment[],
): Promise<JobAttachment[]> {
  const dir = path.join(paths.assets, `message-${submissionId}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const saved: JobAttachment[] = [];

  try {
    for (const [index, image] of images.entries()) {
      const response = await fetch(image.url, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`Download de "${image.name}" falhou (HTTP ${response.status}).`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const detected = detectImage(buffer);
      if (!detected) {
        throw new Error(
          `"${image.name}" não é uma imagem PNG, JPEG, GIF ou WebP válida.`,
        );
      }
      if (buffer.byteLength > imageConfig.maxBytes) {
        throw new Error(
          `"${image.name}" tem ${formatMb(buffer.byteLength)}; o limite é ${formatMb(imageConfig.maxBytes)}.`,
        );
      }

      const file = path.join(dir, `image-${index + 1}${detected.extension}`);
      fs.writeFileSync(file, buffer);

      saved.push({
        name: image.name,
        file,
        contentType: detected.contentType,
        size: buffer.byteLength,
        url: image.url,
      });
    }
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }

  return saved;
}

export interface SubmitImplementationInput {
  client: Client;
  authorId: string;
  authorName: string;
  authorCreatedAt: Date;
  prompt: string;
  images: Attachment[];
  hasRole: boolean;
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

  if (prompt.length === 0 && images.length === 0) {
    await input.reply('Escreva uma descrição ou anexe uma imagem.');
    return null;
  }

  if (images.length > imageConfig.maxCount) {
    await input.reply(`Envie no máximo ${imageConfig.maxCount} imagens por prompt.`);
    return null;
  }

  const oversized = images.find((image) => image.size > imageConfig.maxBytes);
  if (oversized) {
    await input.reply(
      `A imagem "${oversized.name}" tem ${formatMb(oversized.size)}; o limite é ${formatMb(imageConfig.maxBytes)} por imagem.`,
    );
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

  const validation = validatePrompt(prompt, images.length);
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

  const title = deriveTitle(
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
