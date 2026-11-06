import { REST, Routes } from 'discord.js';
import { discordConfig } from '../config';
import { Job } from '../db';
import { createLogger } from '../logger';
import { jobEmbed, truncate } from '../ui/embeds';

const log = createLogger('notify');
let rest: REST | null = null;

function getRest(): REST {
  if (!rest) {
    rest = new REST({ version: '10' }).setToken(discordConfig.token);
  }
  return rest;
}

function targetChannel(job: Job): string {
  return job.thread_id ?? job.channel_id ?? discordConfig.suggestionsChannelId;
}

export async function postToJob(job: Job, content: string): Promise<void> {
  const channelId = targetChannel(job);
  if (!channelId) return;

  try {
    await getRest().post(Routes.channelMessages(channelId), {
      body: {
        content: truncate(content, 1900),
        allowed_mentions: { parse: [] },
      },
    });
  } catch (error) {
    log.warn(`Falha ao postar no Discord (job #${job.id}): ${String(error)}`);
  }
}

export async function postEmbedToJob(job: Job, content?: string): Promise<void> {
  const channelId = targetChannel(job);
  if (!channelId) return;

  try {
    await getRest().post(Routes.channelMessages(channelId), {
      body: {
        content: content ? truncate(content, 1900) : undefined,
        embeds: [jobEmbed(job).toJSON()],
        allowed_mentions: { parse: [] },
      },
    });
  } catch (error) {
    log.warn(`Falha ao postar embed no Discord (job #${job.id}): ${String(error)}`);
  }
}

export async function updateJobMessage(job: Job): Promise<void> {
  if (!job.channel_id || !job.message_id) return;

  try {
    await getRest().patch(Routes.channelMessage(job.channel_id, job.message_id), {
      body: {
        embeds: [jobEmbed(job).toJSON()],
        allowed_mentions: { parse: [] },
      },
    });
  } catch (error) {
    log.warn(`Falha ao editar mensagem do job #${job.id}: ${String(error)}`);
  }
}

export async function notifyJob(job: Job, content: string): Promise<void> {
  await postToJob(job, content);
  await updateJobMessage(job);
}
