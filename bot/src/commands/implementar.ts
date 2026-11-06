import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { checkAccountAge, checkSubmissionQuota } from '../services/quotas';
import { hasSubmitterRole } from '../services/permissions';

export const data = new SlashCommandBuilder()
  .setName('implementar')
  .setDescription('Envia uma ideia para ser implementada no jogo');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Este comando só funciona dentro do servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!hasSubmitterRole(interaction)) {
    await interaction.reply({
      content: 'Você não tem o cargo necessário para enviar implementações.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const age = checkAccountAge(interaction.user.createdAt);
  if (!age.ok) {
    await interaction.reply({ content: age.reason ?? 'Conta muito nova.', flags: MessageFlags.Ephemeral });
    return;
  }

  const quota = checkSubmissionQuota(interaction.user.id);
  if (!quota.ok) {
    await interaction.reply({ content: quota.reason ?? 'Quota indisponível.', flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId('implementacao:criar')
    .setTitle('Implementar uma ideia')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('titulo')
          .setLabel('Título')
          .setPlaceholder('Ex.: Adicionar uma arma de gelo')
          .setStyle(TextInputStyle.Short)
          .setMinLength(5)
          .setMaxLength(100)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('descricao')
          .setLabel('Descreva a implementação')
          .setPlaceholder('O que deve mudar no jogo? Seja específico.')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(20)
          .setMaxLength(1500)
          .setRequired(true),
      ),
    );

  await interaction.showModal(modal);
}
