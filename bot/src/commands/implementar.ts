import {
  ChatInputCommandInteraction,
  FileUploadBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { audioConfig, imageConfig } from '../config';
import { getApprovedPlansForUser } from '../db';
import { IMPLEMENTAR_MODAL_ID } from '../handlers/modalSubmit';
import {
  AUDIO_FILE_TYPES,
  formatMb,
} from '../services/attachments';
import { hasSubmitterRoleForInteraction } from '../services/permissions';
import { checkAccountAge, checkSubmissionQuota } from '../services/quotas';
import { truncate } from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('implementar')
  .setDescription('Abre o formulário de implementação');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!hasSubmitterRoleForInteraction(interaction)) {
    await interaction.reply({
      content: 'Você não tem o cargo necessário para enviar implementações.',
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

  const quota = checkSubmissionQuota(interaction.user.id);
  if (!quota.ok) {
    await interaction.reply({
      content: quota.reason ?? 'Quota indisponível.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const canManage =
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  const plans = getApprovedPlansForUser(interaction.user.id, canManage);
  const labels: LabelBuilder[] = [];

  if (plans.length > 0) {
    labels.push(
      new LabelBuilder()
        .setLabel('Plano aprovado (opcional)')
        .setDescription(
          'Escolha um plano aprovado ou deixe vazio para uma implementação nova.',
        )
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId('plano')
            .setPlaceholder('Nenhum plano (implementação nova)')
            .setMinValues(0)
            .setMaxValues(1)
            .setRequired(false)
            .addOptions(
              plans.map((plan) => ({
                label: truncate(`#${plan.id} — ${plan.title}`, 80),
                value: String(plan.id),
              })),
            ),
        ),
    );
  }

  labels.push(
    new LabelBuilder()
      .setLabel('Descreva a implementação')
      .setDescription(
        'Até 4000 caracteres. Obrigatório se não houver plano nem anexo.',
      )
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId('prompt')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('O que deve mudar no jogo? Seja específico.')
          .setMaxLength(4000)
          .setRequired(false),
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

  const modal = new ModalBuilder()
    .setCustomId(IMPLEMENTAR_MODAL_ID)
    .setTitle('Implementar uma ideia')
    .addLabelComponents(...labels);

  await interaction.showModal(modal);
}
