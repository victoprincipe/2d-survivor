import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { discordConfig } from '../config';

type GuildInteraction = ChatInputCommandInteraction | ModalSubmitInteraction;

export function isMod(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member;
  if (member && 'roles' in member && discordConfig.modRoleId) {
    if (Array.isArray(member.roles)) {
      if (member.roles.includes(discordConfig.modRoleId)) return true;
    } else if (member.roles.cache.has(discordConfig.modRoleId)) {
      return true;
    }
  }
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

export function hasSubmitterRole(interaction: GuildInteraction): boolean {
  if (!discordConfig.submitterRoleId) return true;
  const member = interaction.member;
  if (!member || !('roles' in member)) return false;
  if (Array.isArray(member.roles)) return member.roles.includes(discordConfig.submitterRoleId);
  return member.roles.cache.has(discordConfig.submitterRoleId);
}
