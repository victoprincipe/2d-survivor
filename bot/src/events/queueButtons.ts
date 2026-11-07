import { ButtonInteraction, MessageFlags } from 'discord.js';
import { filaView } from '../commands/fila';
import { setQueuePaused } from '../db';
import { canManageGuildForInteraction } from '../services/permissions';

export async function handleQueueButton(
  interaction: ButtonInteraction,
  action: 'pause' | 'resume',
): Promise<void> {
  if (!canManageGuildForInteraction(interaction)) {
    await interaction.reply({
      content: 'Só quem gerencia o servidor pode pausar ou retomar a fila.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const paused = action === 'pause';
  setQueuePaused(paused);

  // Atualiza a mensagem efêmera do /fila com o estado novo.
  await interaction.update(filaView(true));

  await interaction.followUp({
    content: paused
      ? 'Fila pausada. O worker termina o job atual e não pega novos até retomar.'
      : 'Fila retomada.',
    flags: MessageFlags.Ephemeral,
  });
}
