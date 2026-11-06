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

export interface Job {
  id: number;
  kind: JobKind;
  author_id: string;
  author_name: string;
  title: string;
  prompt: string;
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
}

export interface NewJob {
  authorId: string;
  authorName: string;
  title: string;
  prompt: string;
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
      heartbeat_at  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status_id ON jobs (status, id);
    CREATE INDEX IF NOT EXISTS idx_jobs_author ON jobs (author_id, created_at);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('queue_paused', '1');
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
      `INSERT INTO jobs (author_id, author_name, title, prompt, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.authorId, input.authorName, input.title, input.prompt, now);

  return requireJob(Number(result.lastInsertRowid));
}

const JOB_COLUMNS = new Set([
  'kind',
  'author_id',
  'author_name',
  'title',
  'prompt',
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
    .get(authorId, since24h()) as { total: number };
  return row.total;
}

export function countTodayGlobal(): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS total FROM jobs WHERE created_at >= ?')
    .get(since24h()) as { total: number };
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
