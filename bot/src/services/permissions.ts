import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { discordConfig } from '../config';

type GuildInteraction = ChatInputCommandInteraction | ModalSubmitInteraction;

export function hasSubmitterRole(interaction: GuildInteraction): boolean {
  if (!discordConfig.submitterRoleId) return true;
  const member = interaction.member;
  if (!member || !('roles' in member)) return false;
  if (Array.isArray(member.roles)) return member.roles.includes(discordConfig.submitterRoleId);
  return member.roles.cache.has(discordConfig.submitterRoleId);
}
