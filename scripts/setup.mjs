import {randomBytes} from 'node:crypto';
import {existsSync,writeFileSync,readdirSync,unlinkSync,linkSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mysql,root,envFile,kind,label,port,learning,explain} from './common.mjs';
import {migrate} from './migrate.mjs';
import {prompts} from './prompts.mjs';
// Fresh installation on PostgreSQL (Supabase). The database must be empty: an existing database is never changed.
function assertEmptyFolder(){
 if(existsSync(envFile))throw Error('This folder already has database settings. Open its Start launcher to use it. For another blank installation, unzip into a new folder.');
 if(readdirSync(root).some(n=>/^\.env\./.test(n)&&!n.endsWith('.example')))throw Error('This folder contains settings from another installation. Extract the clean ZIP into a new folder.');
 for(const n of ['storage','data']){const p=resolve(root,n);if(existsSync(p)&&readdirSync(p).length)throw Error('This folder already contains application storage. Extract the clean ZIP into a new folder.');}
}
export async function provision(url){
 assertEmptyFolder();
 const probe=await mysql.createConnection({url});let tmp,published=false;
 try{
  const [[v]]=await probe.query("SELECT current_setting('server_version_num')::int AS version,(SELECT count(*) FROM pg_tables WHERE schemaname='public') AS tables");
  if(v.version<150000)throw Error('Use PostgreSQL 15 or newer (Supabase projects already are).');
  if(Number(v.tables)>0)throw Error('That database already has tables. Use a new, empty Supabase project. Nothing was changed.');
 }finally{await probe.end();}
 await migrate({url});
 const instance=randomBytes(16).toString('hex'),c=await mysql.createConnection({url});
 try{
  await c.execute('INSERT INTO tejasvi_clean_install (id,product,instance_id,owner_claimed) VALUES(1,?,?,0)',[kind,instance]);
  const env={TEJASVI_EDITION:'campus-v1',TEJASVI_STANDALONE:kind,STANDALONE_ID:instance,APP_URL:'http://localhost:'+port,DATABASE_URL:url,...(learning?{UPLOAD_DIR:'./storage/uploads',INDEX_PUBLIC_SITE:'false',SESSION_DAYS:7}:{EMIS_DATA_DIR:'./data',EMIS_SECURE_COOKIES:0})};
  tmp=resolve(root,'.settings-'+instance+'.tmp');writeFileSync(tmp,Object.entries(env).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600,flag:'wx'});linkSync(tmp,envFile);published=true;
 }finally{
  if(tmp&&existsSync(tmp))unlinkSync(tmp);
  if(!published)await c.execute('DELETE FROM tejasvi_clean_install WHERE id=1 AND instance_id=?',[instance]).catch(()=>{});
  await c.end();
 }
}
export async function setup(){
 assertEmptyFolder();const p=prompts();try{
  console.log('\n'+label+' • Fresh installation\nThis sets up an EMPTY Supabase (PostgreSQL) database for this app. Create your Super Admin first. Add a school, college, or company in the browser when ready.');
  console.log('In Supabase: Connect > Direct connection (or Session pooler). Write @ in the password as %40.');
  const url=(await p.secret('Supabase connection string (hidden)')).trim();
  if(!/^postgres(ql)?:\/\//.test(url))throw Error('Paste a connection string that starts with postgresql://');
  await provision(url);console.log('Created the empty Tejasvi schema. No account or college has been created.');
 }finally{p.close();}
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){try{await setup();}catch(e){console.error(explain(e));process.exitCode=1;}}
