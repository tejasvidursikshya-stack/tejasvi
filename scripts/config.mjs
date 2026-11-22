import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root=fileURLToPath(new URL('../',import.meta.url));
dotenv.config({path:path.join(root,'.env.local'),quiet:true});
dotenv.config({path:path.join(root,'.env'),quiet:true});
// PostgreSQL (Supabase) connection from DATABASE_URL.
export function databaseConfig(){if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL in .env to your Supabase connection string.');const u=new URL(process.env.DATABASE_URL);return {url:process.env.DATABASE_URL,host:u.hostname,database:decodeURIComponent(u.pathname.slice(1))||'postgres'}}
