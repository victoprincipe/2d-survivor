import { paths } from '../config';
import { getDb } from '../db';

const db = getDb();

console.log(`Banco: ${paths.db}`);

const counts = db
  .prepare('SELECT status, COUNT(*) AS total FROM jobs GROUP BY status ORDER BY status')
  .all() as Array<{ status: string; total: number }>;
console.table(counts);

const jobs = db
  .prepare(
    `SELECT id, status, kind, author_name, title, created_at
       FROM jobs
      ORDER BY id DESC
      LIMIT 20`,
  )
  .all();
console.table(jobs);
