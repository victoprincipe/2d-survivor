import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { getJob } from '../db';
import { discordTimestamp, statusLabel, truncate } from '../ui/embeds';

export const data = new SlashCommandBuilder()
  .setName('prompt')
  .setDescription('Mostra o prompt usado em uma implementação')
  .addIntegerOption((option) =>
    option
      .setName('id')
      .setDescription('ID da implementação')
      .setRequired(true)
      .setMinValue(1),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getInteger('id', true);
  const job = getJob(id);

  if (!job) {
    await interaction.reply({
      content: `Implementação #${id} não encontrada.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const prompt = job.prompt.trim();
  const description = prompt
    ? truncate(prompt, 4000)
    : job.plan_id !== null
      ? `(sem prompt; implementação do plano #${job.plan_id})`
      : '(sem prompt; use os anexos)';

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: 'Título', value: truncate(job.title, 1000), inline: false },
    { name: 'Autor', value: `<@${job.author_id}>`, inline: true },
    { name: 'Status', value: statusLabel(job.status), inline: true },
    { name: 'Criada', value: discordTimestamp(job.created_at), inline: true },
  ];
  if (job.plan_id !== null) {
    fields.push({ name: 'Plano', value: `#${job.plan_id}`, inline: true });
  }

  const embed = new EmbedBuilder()
    .setTitle(`Prompt da implementação #${job.id}`)
    .setColor(0x9b59b6)
    .setDescription(description)
    .addFields(fields)
    .setFooter({ text: `job #${job.id} • ${job.kind}` })
    .setTimestamp(new Date(job.created_at));

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}
