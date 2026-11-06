import { ChatInputCommandInteraction } from 'discord.js';
import { discordConfig } from '../config';

export async function hasSubmitterRoleForInteraction(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!discordConfig.submitterRoleId) return true;
  if (!interaction.inGuild()) return false;

  const member = await interaction.guild?.members
    .fetch(interaction.user.id)
    .catch(() => null);

  return member?.roles.cache.has(discordConfig.submitterRoleId) ?? false;
}
