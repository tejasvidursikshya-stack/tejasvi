// Loads the converted schema (and optionally data) into the Postgres database in DATABASE_URL.
// Usage: node scripts/pg/load.mjs [--check] [path/to/postgres-data.sql]
// Refuses to run when the public schema already has tables.
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
dotenv.config({path:resolve(root,'.env'),quiet:true});
if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL in .env');
const args=process.argv.slice(2),check=args.includes('--check'),dataFile=args.find(a=>!a.startsWith('--'));
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await client.connect();
try{
 const {rows:[v]}=await client.query("SELECT version() v, current_user u, (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') n");
 console.log('Connected:',v.v.split(' on ')[0],'as',v.u,'- public tables:',v.n);
 if(check)process.exit(0);
 if(v.n>0)throw Error('The public schema already has tables. Nothing was changed.');
 const files=[resolve(root,'database/postgres/001_schema.sql'),...(dataFile?[resolve(dataFile)]:[]),resolve(root,'database/postgres/002_constraints.sql')];
 await client.query('BEGIN');
 for(const f of files){await client.query(readFileSync(f,'utf8').replace(/^BEGIN;|^COMMIT;|^SET LOCAL session_replication_role = replica;/gm,''));console.log('Applied',f.replace(root,'.'));}
 await client.query('COMMIT');
 const {rows}=await client.query("SELECT relname t, n_live_tup n FROM pg_stat_user_tables ORDER BY relname");
 console.log('Done. Tables:',rows.length);
}catch(e){await client.query('ROLLBACK').catch(()=>{});console.error('Failed (rolled back):',e.message);process.exitCode=1;}
finally{await client.end();}
