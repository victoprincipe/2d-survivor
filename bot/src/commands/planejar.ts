import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { hasSubmitterRoleForInteraction } from '../services/permissions';
import { submitPlan } from '../services/plan';
import { truncate } from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('planejar')
  .setDescription('Planeja uma feature antes de implementar')
  .addStringOption((option) =>
    option
      .setName('prompt')
      .setDescription('Descreva a feature que deve ser planejada (20 a 1500 caracteres)')
      .setRequired(true)
      .setMinLength(20)
      .setMaxLength(1500),
  )
  .addAttachmentOption((option) =>
    option
      .setName('imagem')
      .setDescription('Imagem de referência (opcional, até 8 MB)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const prompt = interaction.options.getString('prompt', true);
  const image = interaction.options.getAttachment('imagem');

  await submitPlan({
    authorId: interaction.user.id,
    authorName: interaction.user.username,
    authorCreatedAt: interaction.user.createdAt,
    prompt,
    images: image ? [image] : [],
    hasRole: await hasSubmitterRoleForInteraction(interaction),
    submissionId: interaction.id,
    reply: async (content) => {
      await interaction.editReply({ content: truncate(content, 1900) });
    },
  });
}
