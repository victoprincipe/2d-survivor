import {
  ChatInputCommandInteraction,
  FileUploadBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { audioConfig, imageConfig } from '../config';
import { PLANEJAR_MODAL_ID } from '../handlers/modalSubmit';
import {
  AUDIO_FILE_TYPES,
  formatMb,
} from '../services/attachments';
import { hasSubmitterRoleForInteraction } from '../services/permissions';
import { checkAccountAge, checkPlanQuota } from '../services/quotas';

export const data = new SlashCommandBuilder()
  .setName('planejar')
  .setDescription('Abre o formulário de planejamento');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!hasSubmitterRoleForInteraction(interaction)) {
    await interaction.reply({
      content: 'Você não tem o cargo necessário para enviar planejamentos.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const age = checkAccountAge(interaction.user.createdAt);
  if (!age.ok) {
    await interaction.reply({
      content: age.reason ?? 'Conta muito nova.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const quota = checkPlanQuota(interaction.user.id);
  if (!quota.ok) {
    await interaction.reply({
      content: quota.reason ?? 'Quota de planejamento indisponível.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(PLANEJAR_MODAL_ID)
    .setTitle('Planejar uma feature')
    .addLabelComponents(
      new LabelBuilder()
        .setLabel('Descreva a feature')
        .setDescription('Até 4000 caracteres. Obrigatório.')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('prompt')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('O que deve ser planejado? Seja específico.')
            .setMaxLength(4000)
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel(`Imagens (opcional, até ${imageConfig.maxCount})`)
        .setDescription(
          `PNG, JPEG, GIF ou WebP; até ${formatMb(imageConfig.maxBytes)} cada.`,
        )
        .setFileUploadComponent(
          new FileUploadBuilder()
            .setCustomId('imagens')
            .setMinValues(0)
            .setMaxValues(Math.min(10, imageConfig.maxCount))
            .setFileTypes('image')
            .setRequired(false),
        ),
      new LabelBuilder()
        .setLabel(`Áudios (opcional, até ${audioConfig.maxCount})`)
        .setDescription(
          `MP3, WAV, OGG/OPUS, M4A/AAC, FLAC ou WebM; até ${formatMb(audioConfig.maxBytes)} cada.`,
        )
        .setFileUploadComponent(
          new FileUploadBuilder()
            .setCustomId('audios')
            .setMinValues(0)
            .setMaxValues(Math.min(10, audioConfig.maxCount))
            .setFileTypes(...AUDIO_FILE_TYPES)
            .setRequired(false),
        ),
    );

  await interaction.showModal(modal);
}
