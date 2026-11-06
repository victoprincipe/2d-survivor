import { EmbedBuilder } from 'discord.js';
import { Job, JobStatus } from '../db';
import { shortSha } from '../git';

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: 'Na fila',
  running: 'Executando',
  done: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  interrupted: 'Interrompida',
  needs_review: 'Aguardando revisão',
  reverted: 'Revertida',
};

const STATUS_COLOR: Record<JobStatus, number> = {
  queued: 0x95a5a6,
  running: 0x3498db,
  done: 0x2ecc71,
  failed: 0xe74c3c,
  cancelled: 0x7f8c8d,
  interrupted: 0xe67e22,
  needs_review: 0xf1c40f,
  reverted: 0x9b59b6,
};

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function statusLabel(status: JobStatus): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusColor(status: JobStatus): number {
  return STATUS_COLOR[status] ?? 0x95a5a6;
}

export function discordTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const seconds = Math.floor(new Date(iso).getTime() / 1000);
  return Number.isFinite(seconds) ? `<t:${seconds}:R>` : '—';
}

export function jobEmbed(job: Job): EmbedBuilder {
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'Autor', value: `<@${job.author_id}>`, inline: true },
    { name: 'Status', value: statusLabel(job.status), inline: true },
    { name: 'Criada', value: discordTimestamp(job.created_at), inline: true },
    {
      name: 'Branch',
      value: job.branch ? `\`${job.branch}\`` : '—',
      inline: true,
    },
    {
      name: 'Commit',
      value: job.commit_sha ? `\`${shortSha(job.commit_sha)}\`` : '—',
      inline: true,
    },
    {
      name: 'Diff',
      value:
        job.diff_files === null || job.diff_lines === null
          ? '—'
          : `${job.diff_files} arquivo(s) • ${job.diff_lines} linha(s)`,
      inline: true,
    },
  ];

  if (job.summary) {
    fields.push({ name: 'Resumo', value: truncate(job.summary, 1000) });
  }
  if (job.review_reason) {
    fields.push({ name: 'Revisão necessária', value: truncate(job.review_reason, 1000) });
  }
  if (job.error) {
    fields.push({ name: 'Erro', value: truncate(job.error, 1000) });
  }

  return new EmbedBuilder()
    .setColor(statusColor(job.status))
    .setTitle(truncate(`Sugestão #${job.id} — ${job.title}`, 250))
    .setDescription(truncate(job.prompt, 3500))
    .addFields(fields)
    .setFooter({ text: `job #${job.id} • ${job.kind}` })
    .setTimestamp(new Date(job.created_at));
}

export function jobLine(job: Job): string {
  return `**#${job.id}** ${truncate(job.title, 70)} — *${statusLabel(job.status)}*`;
}
