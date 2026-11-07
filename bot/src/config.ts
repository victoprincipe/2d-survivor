import path from 'node:path';
import dotenv from 'dotenv';

const botDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(botDir, '.env'), quiet: true });
// Também tenta o .env do diretório atual, sem sobrescrever o anterior.
dotenv.config({ quiet: true });

function readString(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

function readInt(name: string, fallback: number): number {
  const raw = readString(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = readString(name).toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on', 'sim'].includes(raw);
}

const repoPath = readString('REPO_PATH')
  ? path.resolve(readString('REPO_PATH'))
  : path.resolve(botDir, '..');

const dataDir = path.join(botDir, 'data');

export const paths = {
  botDir,
  repo: repoPath,
  data: dataDir,
  db: readString('DATABASE_PATH')
    ? path.resolve(readString('DATABASE_PATH'))
    : path.join(dataDir, 'bot.db'),
  logs: readString('LOG_DIR')
    ? path.resolve(readString('LOG_DIR'))
    : path.join(dataDir, 'logs'),
  worktrees: readString('WORKTREE_DIR')
    ? path.resolve(readString('WORKTREE_DIR'))
    : path.resolve(repoPath, '..', '.2d-survivor-worktrees'),
  agentHome: path.join(dataDir, 'agent-home'),
  gateHome: path.join(dataDir, 'gate-home'),
  agentConfigSource: path.join(botDir, 'agent', 'opencode.json'),
  agentConfig: path.join(dataDir, 'agent-home', '.config', 'opencode', 'opencode.json'),
  opencodeDb: path.join(dataDir, 'opencode-worker.db'),
  assets: path.join(dataDir, 'assets'),
  plans: path.join(dataDir, 'plans'),
  plannerConfigSource: path.join(botDir, 'agent', 'planner.json'),
};

export const imageConfig = {
  maxCount: Math.min(10, Math.max(1, readInt('MAX_PROMPT_IMAGES', 3))),
  maxBytes: Math.max(1, readInt('MAX_IMAGE_MB', 8)) * 1024 * 1024,
  retentionDays: Math.max(1, readInt('IMAGE_RETENTION_DAYS', 7)),
};

export const audioConfig = {
  maxCount: Math.min(10, Math.max(1, readInt('MAX_PROMPT_AUDIOS', 3))),
  maxBytes: Math.max(1, readInt('MAX_AUDIO_MB', 10)) * 1024 * 1024,
};

export const planConfig = {
  dailyUserLimit: Math.max(1, readInt('DAILY_PLAN_LIMIT', 10)),
  maxActivePerUser: Math.max(1, readInt('MAX_ACTIVE_PLANS_PER_USER', 1)),
  queueLimit: Math.max(1, readInt('PLAN_QUEUE_LIMIT', 10)),
  timeoutMs: Math.max(1, readInt('PLAN_TIMEOUT_MIN', 10)) * 60_000,
};

export const discordConfig = {
  token: readString('DISCORD_TOKEN'),
  clientId: readString('CLIENT_ID'),
  guildId: readString('GUILD_ID'),
  suggestionsChannelId: readString('SUGGESTIONS_CHANNEL_ID'),
  modRoleId: readString('MOD_ROLE_ID') || null,
  submitterRoleId: readString('SUBMITTER_ROLE_ID') || null,
};

export const queueConfig = {
  mainBranch: readString('MAIN_BRANCH', 'master'),
  maxActivePerUser: readInt('MAX_ACTIVE_PER_USER', 1),
  dailyUserLimit: readInt('DAILY_USER_LIMIT', 30),
  dailyGlobalLimit: readInt('DAILY_GLOBAL_LIMIT', 40),
  queueLimit: readInt('QUEUE_LIMIT', 20),
  minAccountAgeDays: readInt('MIN_ACCOUNT_AGE_DAYS', 7),
  maxDiffFiles: readInt('MAX_DIFF_FILES', 20),
  maxDiffLines: readInt('MAX_DIFF_LINES', 800),
  jobTimeoutMs: readInt('JOB_TIMEOUT_MIN', 20) * 60_000,
  buildTimeoutMs: readInt('BUILD_TIMEOUT_MIN', 10) * 60_000,
  lintTimeoutMs: readInt('LINT_TIMEOUT_MIN', 5) * 60_000,
  lintStrict: readBool('LINT_STRICT', true),
  pollMs: Math.max(500, readInt('WORKER_POLL_MS', 2000)),
};

export const agentConfig = {
  bin: readString('OPENCODE_BIN', 'opencode'),
  name: readString('AGENT_NAME', 'implementer'),
  model: readString('AGENT_MODEL'),
  visionModel: readString(
    'AGENT_VISION_MODEL',
    'opencode/nemotron-3.5-super-vl-free',
  ),
  plannerModel: readString('AGENT_PLANNER_MODEL'),
};

function missing(names: string[]): string[] {
  const map: Record<string, string> = {
    DISCORD_TOKEN: discordConfig.token,
    CLIENT_ID: discordConfig.clientId,
    GUILD_ID: discordConfig.guildId,
    SUGGESTIONS_CHANNEL_ID: discordConfig.suggestionsChannelId,
  };
  return names.filter((name) => !map[name]);
}

export function requireBotConfig(): void {
  const absent = missing(['DISCORD_TOKEN', 'SUGGESTIONS_CHANNEL_ID']);
  if (absent.length > 0) {
    throw new Error(`Variáveis ausentes no bot/.env: ${absent.join(', ')}`);
  }
}

export function requireDeployConfig(): void {
  const absent = missing(['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID']);
  if (absent.length > 0) {
    throw new Error(`Variáveis ausentes no bot/.env: ${absent.join(', ')}`);
  }
}

export function requireWorkerConfig(): void {
  const absent = missing(['DISCORD_TOKEN', 'SUGGESTIONS_CHANNEL_ID']);
  if (absent.length > 0) {
    throw new Error(`Variáveis ausentes no bot/.env: ${absent.join(', ')}`);
  }
}
