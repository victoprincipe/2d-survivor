import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config';

const EXACT_SECRETS = new Set([
  'SSH_AUTH_SOCK',
  'SSH_AGENT_PID',
  'GPG_AGENT_INFO',
  'GIT_ASKPASS',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'KUBECONFIG',
  'DOCKER_CONFIG',
  'DOCKER_HOST',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'NPM_TOKEN',
  'NODE_AUTH_TOKEN',
  'PGPASSWORD',
  'DATABASE_URL',
  'REDIS_URL',
  'NODE_OPTIONS',
  'BASH_ENV',
  'ENV',
  'ZDOTDIR',
  'PROMPT_COMMAND',
  'LD_PRELOAD',
  'DYLD_INSERT_LIBRARIES',
  'DYLD_LIBRARY_PATH',
  'PYTHONPATH',
  'PYTHONSTARTUP',
]);

const SECRET_PREFIXES = [
  'DISCORD_',
  'GH_',
  'GITHUB_',
  'AWS_',
  'AZURE_',
  'DATABRICKS_',
  'GCLOUD_',
  'CLOUDSDK_',
  'VERCEL_',
  'NETLIFY_',
  'HEROKU_',
  'RAILWAY_',
  'FLY_',
  'OPENCODE_',
  'DYLD_',
];

function isSecret(key: string): boolean {
  if (EXACT_SECRETS.has(key)) return true;
  if (SECRET_PREFIXES.some((prefix) => key.startsWith(prefix))) return true;
  if (key.startsWith('npm_config_')) {
    const lower = key.toLowerCase();
    if (lower.includes('auth') || lower.includes('token') || lower.includes('password')) return true;
  }
  return false;
}

export function baseEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (isSecret(key)) delete env[key];
  }
  env.GIT_TERMINAL_PROMPT = '0';
  env.PAGER = 'cat';
  env.GIT_PAGER = 'cat';
  return env;
}

export function agentEnv(): NodeJS.ProcessEnv {
  const env = baseEnv();
  // HOME próprio: isola config global, MCPs, skills e credenciais do host.
  // A auth do OpenCode é copiada para lá no startup do worker.
  env.HOME = paths.agentHome;
  env.OPENCODE_CONFIG_PROJECT_DISABLE = '1';
  env.OPENCODE_DB = paths.opencodeDb;
  env.OPENCODE_DISABLE_AUTOUPDATE = '1';
  return env;
}

export function gateEnv(): NodeJS.ProcessEnv {
  const env = baseEnv();
  env.HOME = paths.gateHome;
  for (const key of [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_OAUTH_TOKEN',
    'OPENAI_API_KEY',
    'OPENAI_ORG_ID',
    'GEMINI_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'OPENROUTER_API_KEY',
    'XAI_API_KEY',
    'DEEPSEEK_API_KEY',
    'GROQ_API_KEY',
    'MISTRAL_API_KEY',
    'OPENAI_BASE_URL',
    'ANTHROPIC_BASE_URL',
  ]) {
    delete env[key];
  }
  return env;
}

/** Chave do OpenCode Go usada pelo provider customizado (config: {env:GO_KEY}). */
export function openCodeGoKey(): string | null {
  const fromEnv = process.env.GO_KEY?.trim();
  if (fromEnv) return fromEnv;

  try {
    const auth = JSON.parse(
      fs.readFileSync(
        path.join(paths.agentHome, '.local', 'share', 'opencode', 'auth.json'),
        'utf8',
      ),
    ) as Record<string, { key?: string } | undefined>;
    return auth['opencode-go']?.key?.trim() || null;
  } catch {
    return null;
  }
}
