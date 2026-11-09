import { getDb, resetQuota } from '../db';
import { queueConfig } from '../config';

getDb();
const at = resetQuota();

console.log(`Quota resetada em ${at}.`);
console.log(`Limite diário por usuário: ${queueConfig.dailyUserLimit} prompts.`);
if (queueConfig.dailyGlobalLimit > 0) {
  console.log(`Limite diário global: ${queueConfig.dailyGlobalLimit}.`);
} else {
  console.log('Limite diário global: desativado (por usuário).');
}
