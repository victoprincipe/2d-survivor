import { getDb, resetQuota } from '../db';
import { queueConfig } from '../config';

getDb();
const at = resetQuota();

console.log(`Quota resetada em ${at}.`);
console.log(`Limite diário por usuário: ${queueConfig.dailyUserLimit}.`);
