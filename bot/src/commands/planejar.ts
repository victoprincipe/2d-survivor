import {
  Attachment,
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
  )
  .addAttachmentOption((option) =>
    option
      .setName('audio')
      .setDescription('Áudio de referência ou asset (opcional, até 10 MB)')
      .setRequired(false),
  )
  .addAttachmentOption((option) =>
    option
      .setName('audio2')
      .setDescription('Segundo áudio opcional (até 10 MB)')
      .setRequired(false),
  )
  .addAttachmentOption((option) =>
    option
      .setName('audio3')
      .setDescription('Terceiro áudio opcional (até 10 MB)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const prompt = interaction.options.getString('prompt', true);
  const image = interaction.options.getAttachment('imagem');
  const audios = ['audio', 'audio2', 'audio3']
    .map((name) => interaction.options.getAttachment(name))
    .filter((attachment): attachment is Attachment => attachment !== null);

  await submitPlan({
    authorId: interaction.user.id,
    authorName: interaction.user.username,
    authorCreatedAt: interaction.user.createdAt,
    prompt,
    images: image ? [image] : [],
    audios,
    hasRole: await hasSubmitterRoleForInteraction(interaction),
    submissionId: interaction.id,
    reply: async (content) => {
      await interaction.editReply({ content: truncate(content, 1900) });
    },
  });
}
