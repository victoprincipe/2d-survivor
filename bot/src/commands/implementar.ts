import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Plan, getPlan } from '../db';
import { hasSubmitterRoleForInteraction } from '../services/permissions';
import { submitImplementation } from '../services/submit';
import { planStatusLabel, truncate } from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('implementar')
  .setDescription('Envia uma implementação ou implementa um plano aprovado')
  .addStringOption((option) =>
    option
      .setName('prompt')
      .setDescription('O que deve ser implementado (ou um complemento ao plano)')
      .setRequired(false)
      .setMaxLength(1500),
  )
  .addIntegerOption((option) =>
    option
      .setName('plano')
      .setDescription('ID de um plano aprovado (use /planejar)')
      .setRequired(false)
      .setMinValue(1),
  )
  .addAttachmentOption((option) =>
    option
      .setName('imagem')
      .setDescription('Imagem de referência ou asset (opcional, até 8 MB)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const planId = interaction.options.getInteger('plano');
  const prompt = (interaction.options.getString('prompt') ?? '').trim();
  const image = interaction.options.getAttachment('imagem');

  if (!planId && prompt.length < 20) {
    await interaction.editReply(
      'Informe um prompt com pelo menos 20 caracteres ou use `plano:<id>` com um plano aprovado.',
    );
    return;
  }

  let plan: Plan | null = null;
  if (planId) {
    plan = getPlan(planId) ?? null;
    if (!plan) {
      await interaction.editReply(`Plano #${planId} não encontrado.`);
      return;
    }
    if (plan.status !== 'approved') {
      await interaction.editReply(
        `O plano #${planId} está com status "${planStatusLabel(plan.status)}". Ele precisa ser aprovado antes de implementar.`,
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

  await submitImplementation({
    client: interaction.client,
    authorId: interaction.user.id,
    authorName: interaction.user.username,
    authorCreatedAt: interaction.user.createdAt,
    prompt,
    images: image ? [image] : [],
    hasRole: await hasSubmitterRoleForInteraction(interaction),
    planId: plan?.id,
    titleOverride: plan ? `Plano #${plan.id} — ${plan.title}` : undefined,
    submissionId: interaction.id,
    reply: async (content) => {
      await interaction.editReply({ content: truncate(content, 1900) });
    },
  });
}
