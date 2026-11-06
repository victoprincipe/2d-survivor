import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { hasSubmitterRoleForInteraction } from '../services/permissions';
import { submitImplementation } from '../services/submit';
import { truncate } from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('implementar')
  .setDescription('Envia uma implementação para a fila')
  .addStringOption((option) =>
    option
      .setName('prompt')
      .setDescription('O que deve ser implementado no jogo (20 a 1500 caracteres)')
      .setRequired(true)
      .setMinLength(20)
      .setMaxLength(1500),
  )
  .addAttachmentOption((option) =>
    option
      .setName('imagem')
      .setDescription('Imagem de referência ou asset (opcional, até 8 MB)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const prompt = interaction.options.getString('prompt', true);
  const image = interaction.options.getAttachment('imagem');

  await submitImplementation({
    client: interaction.client,
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
