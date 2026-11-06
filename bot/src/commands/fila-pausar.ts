import {
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { setQueuePaused } from '../db';
import { requireMod } from './_helpers';

export const data = new SlashCommandBuilder()
  .setName('fila-pausar')
  .setDescription('Pausa a fila antes do próximo job');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!(await requireMod(interaction))) return;

  setQueuePaused(true);
  await interaction.reply({
    content: 'Fila pausada. O job que já está rodando termina normalmente.',
    flags: MessageFlags.Ephemeral,
  });
}
