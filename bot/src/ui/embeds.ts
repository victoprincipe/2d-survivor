import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import {
  Job,
  JobStatus,
  Plan,
  PlanStatus,
  attachmentKind,
  jobAttachments,
  planAttachments,
} from '../db';
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

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  queued: 'Na fila',
  running: 'Planejando',
  ready: 'Aguardando aprovação',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

const PLAN_STATUS_COLOR: Record<PlanStatus, number> = {
  queued: 0x95a5a6,
  running: 0x3498db,
  ready: 0xf1c40f,
  approved: 0x2ecc71,
  rejected: 0xe74c3c,
  failed: 0xe74c3c,
  cancelled: 0x7f8c8d,
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

export function planStatusLabel(status: PlanStatus): string {
  return PLAN_STATUS_LABEL[status] ?? status;
}

export function planStatusColor(status: PlanStatus): number {
  return PLAN_STATUS_COLOR[status] ?? 0x95a5a6;
}

export function discordTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const seconds = Math.floor(new Date(iso).getTime() / 1000);
  return Number.isFinite(seconds) ? `<t:${seconds}:R>` : '—';
}

export function jobEmbed(job: Job): EmbedBuilder {
  const attachments = jobAttachments(job);
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

  if (job.plan_id !== null) {
    fields.push({ name: 'Plano', value: `#${job.plan_id}`, inline: true });
  }

  if (attachments.length > 0) {
    const images = attachments.filter(
      (attachment) => attachmentKind(attachment) === 'image',
    );
    const audios = attachments.filter(
      (attachment) => attachmentKind(attachment) === 'audio',
    );
    if (images.length > 0) {
      fields.push({
        name: `Imagens (${images.length})`,
        value: truncate(
          images.map((attachment) => truncate(attachment.name, 40)).join(', '),
          1000,
        ),
      });
    }
    if (audios.length > 0) {
      fields.push({
        name: `Áudios (${audios.length})`,
        value: truncate(
          audios.map((attachment) => truncate(attachment.name, 40)).join(', '),
          1000,
        ),
      });
    }
  }

  if (job.summary) {
    fields.push({ name: 'Resumo', value: truncate(job.summary, 1000) });
  }
  if (job.review_reason) {
    fields.push({ name: 'Revisão necessária', value: truncate(job.review_reason, 1000) });
  }
  if (job.error) {
    fields.push({ name: 'Erro', value: truncate(job.error, 1000) });
  }

  const embed = new EmbedBuilder()
    .setColor(statusColor(job.status))
    .setTitle(truncate(`Implementação #${job.id} — ${job.title}`, 250))
    .setDescription(
      job.prompt
        ? truncate(job.prompt, 3500)
        : job.plan_id !== null
          ? `(implementação do plano #${job.plan_id})`
          : '(sem descrição — use as imagens como referência)',
    )
    .addFields(fields)
    .setFooter({ text: `job #${job.id} • ${job.kind}` })
    .setTimestamp(new Date(job.created_at));

  const thumbnail = attachments.find(
    (attachment) =>
      attachmentKind(attachment) === 'image' && Boolean(attachment.url),
  )?.url;
  if (thumbnail && /^https?:\/\//i.test(thumbnail)) {
    embed.setThumbnail(thumbnail);
  }

  return embed;
}

export function planEmbed(plan: Plan): EmbedBuilder {
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'Autor', value: `<@${plan.author_id}>`, inline: true },
    { name: 'Status', value: planStatusLabel(plan.status), inline: true },
    { name: 'Criado', value: discordTimestamp(plan.created_at), inline: true },
  ];

  if (plan.plan_md && plan.tasks_md) {
    fields.push({
      name: 'Artefatos',
      value: '`PLAN.md` e `TASKS.md` anexados nesta mensagem.',
    });
  }

  const inputs = planAttachments(plan);
  if (inputs.length > 0) {
    const images = inputs.filter(
      (attachment) => attachmentKind(attachment) === 'image',
    ).length;
    const audios = inputs.length - images;
    const parts: string[] = [];
    if (images > 0) parts.push(`${images} imagem(ns)`);
    if (audios > 0) parts.push(`${audios} áudio(s)`);
    fields.push({ name: 'Anexos de entrada', value: parts.join(' e ') });
  }

  if (plan.reviewed_at) {
    const who = plan.reviewed_by ? `<@${plan.reviewed_by}>` : '—';
    fields.push({
      name: 'Revisão',
      value: `${who} ${discordTimestamp(plan.reviewed_at)}`,
    });
  }

  if (plan.error) {
    fields.push({ name: 'Erro', value: truncate(plan.error, 1000) });
  }

  const hint =
    plan.status === 'ready'
      ? '\n\nUse os botões **Aprovar** ou **Rejeitar** abaixo.'
      : plan.status === 'approved'
        ? `\n\nPlano aprovado. Use \`/implementar plano:${plan.id}\` para implementar.`
        : '';

  return new EmbedBuilder()
    .setColor(planStatusColor(plan.status))
    .setTitle(truncate(`Plano #${plan.id} — ${plan.title}`, 250))
    .setDescription(truncate(`${plan.prompt}${hint}`, 3800))
    .addFields(fields)
    .setFooter({ text: `plano #${plan.id}` })
    .setTimestamp(new Date(plan.created_at));
}

export function planComponents(planId: number): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`plan:approve:${planId}`)
        .setLabel('Aprovar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`plan:reject:${planId}`)
        .setLabel('Rejeitar')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

export function jobLine(job: Job): string {
  return `**#${job.id}** ${truncate(job.title, 70)} — *${statusLabel(job.status)}*`;
}
