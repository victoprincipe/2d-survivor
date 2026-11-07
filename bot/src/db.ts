import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { paths, queueConfig } from './config';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'interrupted'
  | 'needs_review'
  | 'reverted';

export type JobKind = 'execute' | 'apply' | 'rollback';

export interface JobAttachment {
  /** Nome original enviado no Discord. */
  name: string;
  /** Caminho absoluto do arquivo no disco do bot. */
  file: string;
  contentType: string;
  size: number;
  /** URL original do CDN do Discord (pode expirar). */
  url?: string;
  /** Tipo do anexo; ausente em registros antigos (inferido pelo contentType). */
  kind?: 'image' | 'audio';
}

export interface Job {
  id: number;
  kind: JobKind;
  author_id: string;
  author_name: string;
  title: string;
  prompt: string;
  plan_id: number | null;
  status: JobStatus;
  channel_id: string | null;
  message_id: string | null;
  thread_id: string | null;
  branch: string | null;
  worktree: string | null;
  log_path: string | null;
  summary: string | null;
  error: string | null;
  review_reason: string | null;
  base_sha: string | null;
  commit_sha: string | null;
  diff_files: number | null;
  diff_lines: number | null;
  attempts: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  /** JSON serializado de JobAttachment[]; use jobAttachments() para ler. */
  attachments: string | null;
}

export interface NewJob {
  authorId: string;
  authorName: string;
  title: string;
  prompt: string;
  planId?: number;
  attachments?: JobAttachment[];
}

export type PlanStatus =
  | 'queued'
  | 'running'
  | 'ready'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export interface Plan {
  id: number;
  author_id: string;
  author_name: string;
  title: string;
  prompt: string;
  status: PlanStatus;
  channel_id: string | null;
  message_id: string | null;
  plan_md: string | null;
  tasks_md: string | null;
  error: string | null;
  attachments: string | null;
  worktree: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface NewPlan {
  authorId: string;
  authorName: string;
  title: string;
  prompt: string;
  attachments?: JobAttachment[];
}

let instance: Database.Database | null = null;

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      kind          TEXT NOT NULL DEFAULT 'execute'
                    CHECK (kind IN ('execute','apply','rollback')),
      author_id     TEXT NOT NULL,
      author_name   TEXT NOT NULL,
      title         TEXT NOT NULL,
      prompt        TEXT NOT NULL,
      plan_id       INTEGER,
      status        TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','done','failed','cancelled','interrupted','needs_review','reverted')),
      channel_id    TEXT,
      message_id    TEXT,
      thread_id     TEXT,
      branch        TEXT,
      worktree      TEXT,
      log_path      TEXT,
      summary       TEXT,
      error         TEXT,
      review_reason TEXT,
      base_sha      TEXT,
      commit_sha    TEXT,
      diff_files    INTEGER,
      diff_lines    INTEGER,
      attempts      INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      started_at    TEXT,
      finished_at   TEXT,
      heartbeat_at  TEXT,
      attachments   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status_id ON jobs (status, id);
    CREATE INDEX IF NOT EXISTS idx_jobs_author ON jobs (author_id, created_at);

    CREATE TABLE IF NOT EXISTS plans (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id     TEXT NOT NULL,
      author_name   TEXT NOT NULL,
      title         TEXT NOT NULL,
      prompt        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','ready','approved','rejected','failed','cancelled')),
      channel_id    TEXT,
      message_id    TEXT,
      plan_md       TEXT,
      tasks_md      TEXT,
      error         TEXT,
      attachments   TEXT,
      worktree      TEXT,
      created_at    TEXT NOT NULL,
      started_at    TEXT,
      finished_at   TEXT,
      reviewed_by   TEXT,
      reviewed_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_plans_status_id ON plans (status, id);
    CREATE INDEX IF NOT EXISTS idx_plans_author ON plans (author_id, created_at);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('queue_paused', '0');

  // A flag `queue_paused` existia mas não era lida até a v1; bancos antigos
  // guardam '1' (pausada) sem que ninguém tenha pausado. Normaliza uma vez só.
  const pauseMigrated = db
    .prepare("SELECT value FROM settings WHERE key = 'queue_paused_v2'")
    .get() as { value: string } | undefined;
  if (!pauseMigrated) {
    db.prepare("UPDATE settings SET value = '0' WHERE key = 'queue_paused'").run();
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('queue_paused_v2', '1')").run();
  }

  // Migração para bancos criados antes do suporte a imagens/planos.
  const columns = db.prepare('PRAGMA table_info(jobs)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'attachments')) {
    try {
      db.exec('ALTER TABLE jobs ADD COLUMN attachments TEXT');
    } catch (error) {
      // Bot e worker podem migrar ao mesmo tempo; a segunda alteração é inofensiva.
      if (!String(error).includes('duplicate column name')) throw error;
    }
  }
  if (!columns.some((column) => column.name === 'plan_id')) {
    try {
      db.exec('ALTER TABLE jobs ADD COLUMN plan_id INTEGER');
    } catch (error) {
      if (!String(error).includes('duplicate column name')) throw error;
    }
  }
}

export function parseAttachments(value: string | null): JobAttachment[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is JobAttachment =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as JobAttachment).file === 'string' &&
        typeof (item as JobAttachment).name === 'string',
    );
  } catch {
    return [];
  }
}

export function jobAttachments(job: Job): JobAttachment[] {
  return parseAttachments(job.attachments);
}

export function planAttachments(plan: Plan): JobAttachment[] {
  return parseAttachments(plan.attachments);
}

export function attachmentKind(attachment: JobAttachment): 'image' | 'audio' {
  if (attachment.kind === 'image' || attachment.kind === 'audio') {
    return attachment.kind;
  }
  return (attachment.contentType ?? '').startsWith('audio/') ? 'audio' : 'image';
}

export function getDb(): Database.Database {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(paths.db), { recursive: true });
  const db = new Database(paths.db);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  instance = db;
  return db;
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

export function isQueuePaused(): boolean {
  return getSetting('queue_paused') !== '0';
}

export function setQueuePaused(paused: boolean): void {
  setSetting('queue_paused', paused ? '1' : '0');
}

export function getJob(id: number): Job | undefined {
  return getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Job | undefined;
}

export function requireJob(id: number): Job {
  const job = getJob(id);
  if (!job) throw new Error(`Job #${id} não encontrado.`);
  return job;
}

export function createJob(input: NewJob): Job {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO jobs (author_id, author_name, title, prompt, plan_id, attachments, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.authorId,
      input.authorName,
      input.title,
      input.prompt,
      input.planId ?? null,
      input.attachments && input.attachments.length > 0
        ? JSON.stringify(input.attachments)
        : null,
      now,
    );

  return requireJob(Number(result.lastInsertRowid));
}

const JOB_COLUMNS = new Set([
  'kind',
  'author_id',
  'author_name',
  'title',
  'prompt',
  'plan_id',
  'status',
  'channel_id',
  'message_id',
  'thread_id',
  'branch',
  'worktree',
  'log_path',
  'summary',
  'error',
  'review_reason',
  'base_sha',
  'commit_sha',
  'diff_files',
  'diff_lines',
  'attempts',
  'created_at',
  'started_at',
  'finished_at',
  'heartbeat_at',
  'attachments',
]);

export function updateJob(id: number, patch: Partial<Job>): Job {
  const entries = Object.entries(patch).filter(
    ([key, value]) => JOB_COLUMNS.has(key) && value !== undefined,
  ) as [string, string | number | null][];

  if (entries.length > 0) {
    const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
    getDb()
      .prepare(`UPDATE jobs SET ${assignments} WHERE id = ?`)
      .run(...entries.map(([, value]) => value), id);
  }

  return requireJob(id);
}

export function claimNextJob(): Job | undefined {
  const now = new Date().toISOString();
  return getDb()
    .prepare(
      `UPDATE jobs
          SET status = 'running',
              started_at = ?,
              heartbeat_at = ?,
              finished_at = NULL,
              error = NULL,
              attempts = attempts + 1
        WHERE id = (
          SELECT id FROM jobs
           WHERE status = 'queued'
           ORDER BY id ASC
           LIMIT 1
        )
          AND status = 'queued'
      RETURNING *`,
    )
    .get(now, now) as Job | undefined;
}

export function heartbeatJob(id: number): void {
  getDb()
    .prepare('UPDATE jobs SET heartbeat_at = ? WHERE id = ?')
    .run(new Date().toISOString(), id);
}

/**
 * No boot, todo job `running` é órfão: o lock do worker garante que nenhum
 * outro processo está executando a fila (um worker novo só sobe quando o
 * anterior morreu, e um lock de pid morto é assumido).
 */
export function recoverRunningJobs(): Job[] {
  const db = getDb();
  const running = db.prepare("SELECT * FROM jobs WHERE status = 'running'").all() as Job[];
  if (running.length > 0) {
    db.prepare(
      `UPDATE jobs
          SET status = 'interrupted',
              finished_at = ?,
              error = 'Worker reiniciado durante a execução.'
        WHERE status = 'running'`,
    ).run(new Date().toISOString());
  }
  return running;
}

function since24h(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function quotaCutoff(): string {
  const since = since24h();
  const reset = getSetting('quota_reset_at');
  return reset && reset > since ? reset : since;
}

export function resetQuota(): string {
  const now = new Date().toISOString();
  setSetting('quota_reset_at', now);
  return now;
}

export function countActiveByAuthor(authorId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS total FROM jobs
        WHERE author_id = ? AND status IN ('queued','running')`,
    )
    .get(authorId) as { total: number };
  return row.total;
}

export function countTodayByAuthor(authorId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS total FROM jobs WHERE author_id = ? AND created_at >= ?')
    .get(authorId, quotaCutoff()) as { total: number };
  return row.total;
}

export function countTodayGlobal(): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS total FROM jobs WHERE created_at >= ?')
    .get(quotaCutoff()) as { total: number };
  return row.total;
}

export function countQueued(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total FROM jobs WHERE status = 'queued'")
    .get() as { total: number };
  return row.total;
}

export function getQueuePosition(id: number): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total FROM jobs WHERE status = 'queued' AND id <= ?")
    .get(id) as { total: number };
  return row.total;
}

export function getRunningJob(): Job | undefined {
  return getDb()
    .prepare("SELECT * FROM jobs WHERE status = 'running' ORDER BY id LIMIT 1")
    .get() as Job | undefined;
}

export function listQueued(limit = 5): Job[] {
  return getDb()
    .prepare("SELECT * FROM jobs WHERE status = 'queued' ORDER BY id LIMIT ?")
    .all(limit) as Job[];
}

export function listByAuthor(authorId: string, limit = 10): Job[] {
  return getDb()
    .prepare('SELECT * FROM jobs WHERE author_id = ? ORDER BY id DESC LIMIT ?')
    .all(authorId, limit) as Job[];
}

export function listRecent(limit = 10): Job[] {
  return getDb().prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT ?').all(limit) as Job[];
}

export function requeueJob(id: number): Job {
  const job = requireJob(id);
  const patch: Partial<Job> = {
    status: 'queued',
    error: null,
    review_reason: null,
    started_at: null,
    finished_at: null,
    heartbeat_at: null,
    worktree: null,
  };

  if (job.kind === 'rollback') {
    patch.kind = 'rollback';
    patch.summary = null;
  } else {
    patch.kind = 'execute';
    patch.base_sha = null;
    patch.commit_sha = null;
    patch.diff_files = null;
    patch.diff_lines = null;
    patch.branch = null;
    patch.summary = null;
  }

  return updateJob(id, patch);
}

export function markCancelled(
  id: number,
  allowedStatuses: JobStatus[],
  clearReviewReason = false,
): boolean {
  if (allowedStatuses.length === 0) return false;
  const placeholders = allowedStatuses.map(() => '?').join(', ');
  const review = clearReviewReason ? ', review_reason = NULL' : '';
  const result = getDb()
    .prepare(
      `UPDATE jobs
          SET status = 'cancelled',
              finished_at = ?${review}
        WHERE id = ?
          AND status IN (${placeholders})`,
    )
    .run(new Date().toISOString(), id, ...allowedStatuses);
  return result.changes > 0;
}

export function queueLimits(): {
  maxActivePerUser: number;
  dailyUserLimit: number;
  dailyGlobalLimit: number;
  queueLimit: number;
} {
  return {
    maxActivePerUser: queueConfig.maxActivePerUser,
    dailyUserLimit: queueConfig.dailyUserLimit,
    dailyGlobalLimit: queueConfig.dailyGlobalLimit,
    queueLimit: queueConfig.queueLimit,
  };
}

export function getPlan(id: number): Plan | undefined {
  return getDb().prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
}

export function requirePlan(id: number): Plan {
  const plan = getPlan(id);
  if (!plan) throw new Error(`Plano #${id} não encontrado.`);
  return plan;
}

export function getApprovedPlansForUser(
  authorId: string,
  canManage: boolean,
  limit = 25,
): Plan[] {
  const db = getDb();
  if (canManage) {
    return db
      .prepare(
        "SELECT * FROM plans WHERE status = 'approved' ORDER BY id DESC LIMIT ?",
      )
      .all(limit) as Plan[];
  }

  return db
    .prepare(
      "SELECT * FROM plans WHERE status = 'approved' AND author_id = ? ORDER BY id DESC LIMIT ?",
    )
    .all(authorId, limit) as Plan[];
}

export function createPlan(input: NewPlan): Plan {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO plans (author_id, author_name, title, prompt, attachments, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.authorId,
      input.authorName,
      input.title,
      input.prompt,
      input.attachments && input.attachments.length > 0
        ? JSON.stringify(input.attachments)
        : null,
      now,
    );

  return requirePlan(Number(result.lastInsertRowid));
}

const PLAN_COLUMNS = new Set([
  'author_id',
  'author_name',
  'title',
  'prompt',
  'status',
  'channel_id',
  'message_id',
  'plan_md',
  'tasks_md',
  'error',
  'attachments',
  'worktree',
  'created_at',
  'started_at',
  'finished_at',
  'reviewed_by',
  'reviewed_at',
]);

export function updatePlan(id: number, patch: Partial<Plan>): Plan {
  const entries = Object.entries(patch).filter(
    ([key, value]) => PLAN_COLUMNS.has(key) && value !== undefined,
  ) as [string, string | number | null][];

  if (entries.length > 0) {
    const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
    getDb()
      .prepare(`UPDATE plans SET ${assignments} WHERE id = ?`)
      .run(...entries.map(([, value]) => value), id);
  }

  return requirePlan(id);
}

export function claimNextPlan(): Plan | undefined {
  const now = new Date().toISOString();
  return getDb()
    .prepare(
      `UPDATE plans
          SET status = 'running',
              started_at = ?,
              finished_at = NULL,
              error = NULL,
              worktree = NULL
        WHERE id = (
          SELECT id FROM plans
           WHERE status = 'queued'
           ORDER BY id ASC
           LIMIT 1
        )
          AND status = 'queued'
      RETURNING *`,
    )
    .get(now) as Plan | undefined;
}

export function countQueuedPlans(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total FROM plans WHERE status = 'queued'")
    .get() as { total: number };
  return row.total;
}

export function getPlanQueuePosition(id: number): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total FROM plans WHERE status = 'queued' AND id <= ?")
    .get(id) as { total: number };
  return row.total;
}

export function countActivePlansByAuthor(authorId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS total FROM plans
        WHERE author_id = ? AND status IN ('queued','running')`,
    )
    .get(authorId) as { total: number };
  return row.total;
}

export function countTodayPlansByAuthor(authorId: string): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS total FROM plans WHERE author_id = ? AND created_at >= ?')
    .get(authorId, quotaCutoff()) as { total: number };
  return row.total;
}

export function recoverRunningPlans(): Plan[] {
  const db = getDb();
  const running = db.prepare("SELECT * FROM plans WHERE status = 'running'").all() as Plan[];
  if (running.length > 0) {
    db.prepare(
      `UPDATE plans
          SET status = 'failed',
              finished_at = ?,
              error = 'Worker reiniciado durante o planejamento.'
        WHERE status = 'running'`,
    ).run(new Date().toISOString());
  }
  return running;
}
