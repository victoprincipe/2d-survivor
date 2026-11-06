import { Events, Message } from 'discord.js';
import { discordConfig } from '../config';
import { createLogger } from '../logger';
import { cleanText } from '../services/moderation';
import { hasSubmitterRoleForMessage } from '../services/permissions';
import { isImageAttachment, submitImplementation } from '../services/submit';
import { truncate } from '../ui/embeds';

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
  const allAttachments = [...message.attachments.values()];
  const images = allAttachments.filter(isImageAttachment);
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

  if (images.length === 0 && ignoredAttachments > 0) {
    log.warn(
      `Mensagem ${message.id} tem ${ignoredAttachments} anexo(s) não-imagem; usando só o texto.`,
    );
  }

  await submitImplementation({
    client: message.client,
    authorId: message.author.id,
    authorName: message.author.username,
    authorCreatedAt: message.author.createdAt,
    prompt,
    images,
    hasRole: await hasSubmitterRoleForMessage(message),
    submissionId: message.id,
    reply: (content) => reply(message, content),
  });
}
