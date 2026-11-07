import {
  APIInteractionGuildMember,
  ButtonInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  ModalSubmitInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { discordConfig } from '../config';

type GuildInteraction = ChatInputCommandInteraction | ModalSubmitInteraction;
type InteractionMember = GuildMember | APIInteractionGuildMember | null;

/** `Manage Server` na interação atual (sem fetch). */
export function canManageGuildForInteraction(
  interaction: GuildInteraction | ButtonInteraction,
): boolean {
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

function memberHasSubmitterRole(member: InteractionMember): boolean {
  if (!discordConfig.submitterRoleId) return true;
  if (!member || !('roles' in member)) return false;

  const roles = member.roles;
  if (Array.isArray(roles)) {
    return roles.includes(discordConfig.submitterRoleId);
  }

  return roles.cache.has(discordConfig.submitterRoleId);
}

/** Checagem rápida usando o member já resolvido na interação. */
export function hasSubmitterRoleForInteraction(
  interaction: GuildInteraction,
): boolean {
  if (!discordConfig.submitterRoleId) return true;
  if (!interaction.inGuild()) return false;
  return memberHasSubmitterRole(interaction.member);
}

/** Checagem autoritativa: busca o membro se o cache não tiver os cargos. */
export async function fetchSubmitterRoleForInteraction(
  interaction: GuildInteraction,
): Promise<boolean> {
  if (hasSubmitterRoleForInteraction(interaction)) return true;
  if (!discordConfig.submitterRoleId) return true;
  if (!interaction.inGuild()) return false;

  if (!interaction.guild) return false;

  const member = await interaction.guild.members
    .fetch(interaction.user.id)
    .catch(() => null);

  return memberHasSubmitterRole(member);
}
