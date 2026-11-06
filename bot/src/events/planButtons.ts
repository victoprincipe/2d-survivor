import { ButtonInteraction, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { getPlan, updatePlan } from '../db';
import { planEmbed, planStatusLabel } from '../ui/embeds';

export async function handlePlanButton(
  interaction: ButtonInteraction,
  action: 'approve' | 'reject',
  planId: number,
): Promise<void> {
  const plan = getPlan(planId);
  if (!plan) {
    await interaction.reply({
      content: `Plano #${planId} não encontrado.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (plan.status !== 'ready') {
    await interaction.reply({
      content: `Este plano já está com status "${planStatusLabel(plan.status)}".`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const canManage =
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  if (plan.author_id !== interaction.user.id && !canManage) {
    await interaction.reply({
      content: 'Só o autor do plano ou um moderador pode aprovar/rejeitar.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const updated = updatePlan(planId, {
    status: action === 'approve' ? 'approved' : 'rejected',
    reviewed_by: interaction.user.id,
    reviewed_at: new Date().toISOString(),
  });

  await interaction.update({
    embeds: [planEmbed(updated)],
    components: [],
  });

  const content =
    action === 'approve'
      ? `Plano #${planId} aprovado. Use \`/implementar plano:${planId}\` para implementar.`
      : `Plano #${planId} rejeitado.`;
  await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
}
