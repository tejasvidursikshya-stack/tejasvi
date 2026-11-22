import {mkdirSync,writeFileSync,existsSync,cpSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import pg from 'pg';
import {verified,root,label,explain} from './common.mjs';
// PostgreSQL (Supabase) backup: one consistent snapshot (REPEATABLE READ) exported as JSON Lines per table,
// plus the storage directory. Supabase also keeps its own daily backups (Dashboard > Database > Backups).
process.umask(0o077);
let c,target;
try{
 const {db}=await verified();
 c=new pg.Client({connectionString:db.url,ssl:{rejectUnauthorized:false}});await c.connect();
 await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const {rows:tables}=await c.query("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
 target=join(root,'backups',new Date().toISOString().replace(/[:.]/g,'-'));const partial=target+'.partial';mkdirSync(join(partial,'tables'),{recursive:true,mode:0o700});
 const counts={};
 for(const {name} of tables){
  if(!/^[a-z0-9_]+$/.test(name))continue;
  if(['sessions','rate_limits'].includes(name)){counts[name]=0;continue}
  // Raw text for every type so values round-trip exactly.
  const {rows}=await c.query({text:`SELECT * FROM "${name}"`,rowMode:'array',types:{getTypeParser:()=>v=>v}});
  const {rows:[cols]}=await c.query({text:`SELECT array_agg(column_name::text ORDER BY ordinal_position) AS c FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,values:[name]});
  writeFileSync(join(partial,'tables',name+'.jsonl'),JSON.stringify({columns:cols.c})+'\n'+rows.map(r=>JSON.stringify(r)).join('\n')+(rows.length?'\n':''),{mode:0o600});
  counts[name]=rows.length;
 }
 await c.query('COMMIT');
 const storage=join(root,'storage');if(existsSync(storage))cpSync(storage,join(partial,'storage'),{recursive:true});
 writeFileSync(join(partial,'manifest.json'),JSON.stringify({product:label,database:db.host,createdAt:new Date().toISOString(),format:'jsonl-text-v1',rows:counts},null,1),{mode:0o600});
 writeFileSync(join(partial,'RESTORE.txt'),'This is a private backup of the '+label+' PostgreSQL (Supabase) database. Each file in tables/ holds one table: the first line lists the columns, then one JSON array of text values per row. Session and rate-limit rows are not included. Restore into an empty database that has the schema from database/postgres, then restore the storage directory. Supabase daily backups (Dashboard > Database > Backups) are the first option for disaster recovery.\n',{mode:0o600});
 renameSync(partial,target);console.log('Backup complete: '+target);
}catch(e){await c?.query('ROLLBACK').catch(()=>{});console.error(explain(e));process.exitCode=1;}finally{await c?.end().catch(()=>{});}
