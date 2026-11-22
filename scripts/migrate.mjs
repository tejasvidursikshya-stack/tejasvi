import pg from 'pg';
import { readdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { root,databaseConfig } from './config.mjs';
// PostgreSQL migrations live in database/postgres (the MySQL history in database/migrations is kept for reference).
// 001_schema.sql and 002_constraints.sql are the baseline converted from MySQL. A database that was loaded with
// scripts/pg/load.mjs already has them; they are recorded as applied instead of being re-run.
// Each migration runs in its own transaction (Postgres DDL is transactional).
const BASELINE=['001_schema.sql','002_constraints.sql'];
export async function migrate(config=databaseConfig(),{quiet=false}={}){
 const url=config.url||process.env.DATABASE_URL;
 const c=new pg.Client({connectionString:url,ssl:/localhost|127\.0\.0\.1/.test(url)?false:{rejectUnauthorized:false}});await c.connect();
 const lockKey=4242001;let locked=false;
 try{
  const {rows:[l]}=await c.query('SELECT pg_try_advisory_lock($1) AS acquired',[lockKey]);if(!l.acquired)throw new Error('Another migration is running. Try again shortly.');locked=true;
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(150) PRIMARY KEY, checksum CHAR(64) NOT NULL, status VARCHAR(20) NOT NULL, applied_at TIMESTAMP(3) NULL)');
  await c.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY');
  const directory=path.join(root,'database/postgres'),files=(await readdir(directory)).filter(f=>/^\d+_.+\.sql$/.test(f)).sort();
  const sum=s=>createHash('sha256').update(s).digest('hex');
  const {rows:[existing]}=await c.query("SELECT to_regclass('public.users') IS NOT NULL AS loaded");
  for(const file of files){
   const sql=await readFile(path.join(directory,file),'utf8'),checksum=sum(sql);
   const {rows:previous}=await c.query('SELECT * FROM schema_migrations WHERE name=$1',[file]);
   if(previous.length){if(previous[0].status!=='applied')throw new Error(`${file} did not finish. Inspect the schema before repairing schema_migrations.`);if(previous[0].checksum!==checksum)throw new Error(`Applied migration ${file} has changed. Restore it; add a new migration for changes.`);if(!quiet)console.log('Already applied:',file);continue}
   if(existing.loaded&&BASELINE.includes(file)){await c.query("INSERT INTO schema_migrations(name,checksum,status,applied_at) VALUES($1,$2,'applied',now() AT TIME ZONE 'UTC')",[file,checksum]);if(!quiet)console.log('Recorded existing baseline:',file);continue}
   await c.query('BEGIN');
   try{await c.query(sql);await c.query("INSERT INTO schema_migrations(name,checksum,status,applied_at) VALUES($1,$2,'applied',now() AT TIME ZONE 'UTC')",[file,checksum]);await c.query('COMMIT');}
   catch(e){await c.query('ROLLBACK');throw new Error(`${file} failed and was rolled back: ${e.message}`)}
   console.log('Applied:',file);
  }
  await c.query("DELETE FROM sessions WHERE expires_at<(now() AT TIME ZONE 'UTC')");await c.query('DELETE FROM rate_limits WHERE reset_at<$1',[Date.now()]);
 }finally{if(locked)await c.query('SELECT pg_advisory_unlock($1)',[lockKey]).catch(()=>{});await c.end()}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{await migrate();console.log('Database is ready.')}catch(e){console.error('Migration failed:',e.message);process.exitCode=1}}
