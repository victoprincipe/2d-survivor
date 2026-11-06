import fs from 'node:fs';
import path from 'node:path';
import { Attachment, Events, Message, TextChannel } from 'discord.js';
import { discordConfig, imageConfig, paths } from '../config';
import {
  JobAttachment,
  createJob,
  getQueuePosition,
  updateJob,
} from '../db';
import { createLogger } from '../logger';
import { cleanText, deriveTitle, validatePrompt } from '../services/moderation';
import { hasSubmitterRoleForMessage } from '../services/permissions';
import { checkAccountAge, checkSubmissionQuota } from '../services/quotas';
import { jobEmbed, truncate } from '../ui/embeds';

export const name = Events.MessageCreate;
export const once = false;

const log = createLogger('message');

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

/**
 * Baixa os anexos para bot/data/assets/message-<id>/.
 * O nome local é gerado pelo tipo (nunca pelo nome enviado) para evitar
 * path traversal; o nome original fica só como metadado.
 */
async function downloadImages(
  messageId: string,
  images: Attachment[],
): Promise<JobAttachment[]> {
  const dir = path.join(paths.assets, `message-${messageId}`);
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

export async function execute(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  if (message.author.bot) return;
  if (message.system) return;
  if (message.channelId !== discordConfig.promptChannelId) return;

  const prompt = cleanText(message.content);
  const allAttachments = [...message.attachments.values()];
  const images = allAttachments.filter(
    (attachment) =>
      (attachment.contentType ?? '').startsWith('image/') ||
      IMAGE_NAME_PATTERN.test(attachment.name),
  );
  const ignoredAttachments = allAttachments.length - images.length;

  if (images.length === 0 && prompt.length === 0) {
    if (ignoredAttachments > 0) {
      await reply(
        message,
        'Anexe imagens PNG, JPEG, GIF ou WebP (até 3) ou escreva uma descrição com pelo menos 20 caracteres.',
      );
    }
    return;
  }

  if (images.length > imageConfig.maxCount) {
    await reply(message, `Envie no máximo ${imageConfig.maxCount} imagens por prompt.`);
    return;
  }

  const oversized = images.find((image) => image.size > imageConfig.maxBytes);
  if (oversized) {
    await reply(
      message,
      `A imagem "${oversized.name}" tem ${formatMb(oversized.size)}; o limite é ${formatMb(imageConfig.maxBytes)} por imagem.`,
    );
    return;
  }

  if (images.length === 0 && ignoredAttachments > 0) {
    log.warn(
      `Mensagem ${message.id} tem ${ignoredAttachments} anexo(s) não-imagem; usando só o texto.`,
    );
  }

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

  const validation = validatePrompt(prompt, images.length);
  if (!validation.ok) {
    await reply(message, validation.reason ?? 'Implementação inválida.');
    return;
  }

  let attachments: JobAttachment[] = [];
  if (images.length > 0) {
    try {
      attachments = await downloadImages(message.id, images);
    } catch (error) {
      log.error(`Falha ao baixar imagens da mensagem ${message.id}: ${String(error)}`);
      await reply(
        message,
        `Não consegui baixar as imagens: ${truncate(String(error), 300)}`,
      );
      return;
    }
  }

  const title = deriveTitle(
    prompt,
    attachments.map((attachment) => attachment.name),
  );
  let jobId: number | null = null;

  try {
    const job = createJob({
      authorId: message.author.id,
      authorName: message.author.username,
      title,
      prompt,
      attachments,
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
    const imageHint =
      attachments.length > 0
        ? ` ${attachments.length} imagem(ns) anexada(s).`
        : '';
    await reply(
      message,
      `Implementação #${job.id} na fila — posição ${position}.${imageHint}${threadHint}`,
    );
  } catch (error) {
    log.error(`Falha ao registrar implementação: ${String(error)}`);
    if (jobId !== null) {
      updateJob(jobId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: `Falha ao publicar no Discord: ${String(error)}`,
      });
    } else if (attachments.length > 0) {
      fs.rmSync(path.join(paths.assets, `message-${message.id}`), {
        recursive: true,
        force: true,
      });
    }
    await reply(message, 'Não consegui registrar a implementação. Avise o administrador do servidor.');
  }
}
