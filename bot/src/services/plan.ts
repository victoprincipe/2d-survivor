import fs from 'node:fs';
import path from 'node:path';
import { Attachment } from 'discord.js';
import { paths } from '../config';
import {
  JobAttachment,
  Plan,
  attachmentKind,
  createPlan,
  getPlanQueuePosition,
} from '../db';
import { createLogger } from '../logger';
import {
  downloadAttachments,
  validateAudioMetadata,
  validateImageMetadata,
} from './attachments';
import { cleanText, deriveTitle, validatePrompt } from './moderation';
import { checkAccountAge, checkPlanQuota } from './quotas';
import { truncate } from '../ui/embeds';

const log = createLogger('plan');

export interface SubmitPlanInput {
  authorId: string;
  authorName: string;
  authorCreatedAt: Date;
  prompt: string;
  images: Attachment[];
  audios: Attachment[];
  hasRole: boolean;
  /** ID da interação; usado para nomear a pasta de assets. */
  submissionId: string;
  reply: (content: string) => Promise<void>;
}

export async function submitPlan(input: SubmitPlanInput): Promise<Plan | null> {
  const prompt = cleanText(input.prompt);

  if (prompt.length === 0) {
    await input.reply('Descreva a feature que você quer planejar.');
    return null;
  }

  const imageError = validateImageMetadata(input.images);
  if (imageError) {
    await input.reply(imageError);
    return null;
  }

  const audioError = validateAudioMetadata(input.audios);
  if (audioError) {
    await input.reply(audioError);
    return null;
  }

  if (!input.hasRole) {
    await input.reply('Você não tem o cargo necessário para enviar planejamentos.');
    return null;
  }

  const age = checkAccountAge(input.authorCreatedAt);
  if (!age.ok) {
    await input.reply(age.reason ?? 'Conta muito nova.');
    return null;
  }

  const quota = checkPlanQuota(input.authorId);
  if (!quota.ok) {
    await input.reply(quota.reason ?? 'Quota de planejamento indisponível.');
    return null;
  }

  const validation = validatePrompt(prompt, input.images.length);
  if (!validation.ok) {
    await input.reply(validation.reason ?? 'Planejamento inválido.');
    return null;
  }

  let attachments: JobAttachment[] = [];
  if (input.images.length > 0 || input.audios.length > 0) {
    try {
      attachments = await downloadAttachments(
        input.submissionId,
        input.images,
        input.audios,
      );
    } catch (error) {
      log.error(`Falha ao baixar anexos do plano ${input.submissionId}: ${String(error)}`);
      await input.reply(
        `Não consegui baixar os anexos: ${truncate(String(error), 300)}`,
      );
      return null;
    }
  }

  try {
    const plan = createPlan({
      authorId: input.authorId,
      authorName: input.authorName,
      title: deriveTitle(
        prompt,
        attachments.map((attachment) => attachment.name),
      ),
      prompt,
      attachments,
    });

    const position = getPlanQueuePosition(plan.id);
    const imageCount = attachments.filter(
      (attachment) => attachmentKind(attachment) === 'image',
    ).length;
    const audioCount = attachments.length - imageCount;
    const parts: string[] = [];
    if (imageCount > 0) parts.push(`${imageCount} imagem(ns)`);
    if (audioCount > 0) parts.push(`${audioCount} áudio(s)`);
    const attachmentHint =
      parts.length > 0 ? ` ${parts.join(' e ')}.` : '';
    await input.reply(
      `Plano #${plan.id} na fila — posição ${position}.${attachmentHint} O plano será publicado para aprovação.`,
    );

    return plan;
  } catch (error) {
    log.error(`Falha ao criar plano: ${String(error)}`);
    if (attachments.length > 0) {
      fs.rmSync(path.join(paths.assets, `message-${input.submissionId}`), {
        recursive: true,
        force: true,
      });
    }
    await input.reply('Não consegui registrar o planejamento. Avise o administrador do servidor.');
    return null;
  }
}
