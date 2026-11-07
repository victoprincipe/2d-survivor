import {
  MessageFlags,
  ModalSubmitInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Plan, getPlan } from '../db';
import {
  validateAudioMetadata,
  validateImageMetadata,
} from '../services/attachments';
import { cleanText } from '../services/moderation';
import { fetchSubmitterRoleForInteraction } from '../services/permissions';
import { submitPlan } from '../services/plan';
import { submitImplementation } from '../services/submit';
import { planStatusLabel, truncate } from '../ui/embeds';

export const IMPLEMENTAR_MODAL_ID = 'implementar:modal';
export const PLANEJAR_MODAL_ID = 'planejar:modal';

export async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const isImplementar = interaction.customId === IMPLEMENTAR_MODAL_ID;
  const isPlanejar = interaction.customId === PLANEJAR_MODAL_ID;
  if (!isImplementar && !isPlanejar) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const prompt = cleanText(interaction.fields.getTextInputValue('prompt'));
  const images = [
    ...(interaction.fields.getUploadedFiles('imagens')?.values() ?? []),
  ];
  const audios = [
    ...(interaction.fields.getUploadedFiles('audios')?.values() ?? []),
  ];

  const imageError = validateImageMetadata(images);
  if (imageError) {
    await interaction.editReply(imageError);
    return;
  }

  const audioError = validateAudioMetadata(audios);
  if (audioError) {
    await interaction.editReply(audioError);
    return;
  }

  const hasRole = await fetchSubmitterRoleForInteraction(interaction);

  if (isImplementar) {
    let plan: Plan | null = null;

    if (interaction.fields.fields.has('plano')) {
      const selected = interaction.fields.getStringSelectValues('plano')[0];
      if (selected) {
        const planId = Number.parseInt(selected, 10);
        if (!Number.isInteger(planId) || planId < 1) {
          await interaction.editReply('Plano inválido.');
          return;
        }

        plan = getPlan(planId) ?? null;
        if (!plan) {
          await interaction.editReply(`Plano #${planId} não encontrado.`);
          return;
        }
        if (plan.status !== 'approved') {
          await interaction.editReply(
            `O plano #${plan.id} está com status "${planStatusLabel(plan.status)}". Ele precisa ser aprovado antes de implementar.`,
          );
          return;
        }

        const canManage =
          interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
        if (plan.author_id !== interaction.user.id && !canManage) {
          await interaction.editReply('Você só pode implementar os seus próprios planos.');
          return;
        }
      }
    }

    await submitImplementation({
      client: interaction.client,
      authorId: interaction.user.id,
      authorName: interaction.user.username,
      authorCreatedAt: interaction.user.createdAt,
      prompt,
      images,
      audios,
      hasRole,
      planId: plan?.id,
      titleOverride: plan ? `Plano #${plan.id} — ${plan.title}` : undefined,
      submissionId: interaction.id,
      reply: async (content) => {
        await interaction.editReply({ content: truncate(content, 1900) });
      },
    });
    return;
  }

  await submitPlan({
    authorId: interaction.user.id,
    authorName: interaction.user.username,
    authorCreatedAt: interaction.user.createdAt,
    prompt,
    images,
    audios,
    hasRole,
    submissionId: interaction.id,
    reply: async (content) => {
      await interaction.editReply({ content: truncate(content, 1900) });
    },
  });
}
