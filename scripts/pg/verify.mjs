// Compares row counts in DATABASE_URL with an expected JSON {table: count}.
import pg from 'pg';import dotenv from 'dotenv';import {readFileSync} from 'node:fs';
dotenv.config({quiet:true});
const exp=JSON.parse(readFileSync(process.argv[2],'utf8'));
const c=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});await c.connect();
let bad=0,total=0;
for(const [t,n] of Object.entries(exp)){const {rows:[r]}=await c.query(`SELECT count(*)::int n FROM "${t}"`);total+=r.n;if(r.n!==n){bad++;console.log('MISMATCH',t,'expected',n,'got',r.n);}}
const {rows:[x]}=await c.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity");
console.log(`Tables checked: ${Object.keys(exp).length}, rows: ${total}, mismatches: ${bad}, tables without RLS: ${x.n}`);
await c.end();
