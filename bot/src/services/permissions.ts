import { Message } from 'discord.js';
import { discordConfig } from '../config';

export async function hasSubmitterRoleForMessage(message: Message): Promise<boolean> {
  if (!discordConfig.submitterRoleId) return true;
  if (!message.inGuild()) return false;

  const member =
    message.member ??
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  return member?.roles.cache.has(discordConfig.submitterRoleId) ?? false;
}
