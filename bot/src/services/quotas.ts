import { queueConfig } from '../config';
import {
  countActiveByAuthor,
  countQueued,
  countTodayByAuthor,
  countTodayGlobal,
} from '../db';

export interface QuotaResult {
  ok: boolean;
  reason?: string;
}

export function checkAccountAge(createdAt: Date): QuotaResult {
  const ageDays = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays < queueConfig.minAccountAgeDays) {
    return {
      ok: false,
      reason: `Sua conta precisa ter pelo menos ${queueConfig.minAccountAgeDays} dias para enviar implementações.`,
    };
  }
  return { ok: true };
}

export function checkSubmissionQuota(userId: string): QuotaResult {
  if (countQueued() >= queueConfig.queueLimit) {
    return { ok: false, reason: `A fila está cheia (${queueConfig.queueLimit} jobs). Tente de novo mais tarde.` };
  }

  if (countTodayGlobal() >= queueConfig.dailyGlobalLimit) {
    return { ok: false, reason: 'O limite diário global de implementações foi atingido. Tente amanhã.' };
  }

  if (countActiveByAuthor(userId) >= queueConfig.maxActivePerUser) {
    return {
      ok: false,
      reason: `Você já tem ${queueConfig.maxActivePerUser} implementação(ões) na fila. Aguarde ela terminar.`,
    };
  }

  if (countTodayByAuthor(userId) >= queueConfig.dailyUserLimit) {
    return { ok: false, reason: `Você atingiu o limite de ${queueConfig.dailyUserLimit} implementações por dia.` };
  }

  return { ok: true };
}
