// PostgreSQL (Supabase) adapter that keeps the mysql2/promise surface the app was written against:
//   pool.execute/query(sql, values) -> [rows] for SELECT, [{affectedRows,insertId:0,changedRows}] for writes
//   pool.getConnection() -> connection with beginTransaction/commit/rollback/release
// SQL keeps MySQL-style '?' placeholders. translate() rewrites the mechanical MySQL dialect
// (backticks, ?, INSERT IGNORE, INTERVAL n UNIT, <=>, =TRUE, LIKE, '$.path' JSON paths, mixed-case aliases).
// Semantic constructs (upserts, multi-table UPDATE/DELETE, IF(), SUM(boolean)) are written in Postgres syntax at the call site.
// MySQL helper functions (UTC_TIMESTAMP, JSON_EXTRACT, JSON_LENGTH, JSON_SET, ...) are defined in database/postgres/003_mysql_compat.sql.
import pg from 'pg';

const TS=1114,TSTZ=1184,DATE=1082,INT8=20,BOOL=16,JSON_OID=114,JSONB=3802;
const pad=(s)=>{const m=/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)(?:\.(\d+))?/.exec(s);return m?m[1]+'.'+(m[2]||'').padEnd(3,'0').slice(0,3):s;};
function typeParsers(jsonStrings){
 return {getTypeParser(oid,format){
  if(oid===TS||oid===TSTZ)return v=>pad(v);           // mysql2 dateStrings: 'YYYY-MM-DD HH:MM:SS.mmm' (UTC)
  if(oid===DATE)return v=>v;
  if(oid===INT8)return v=>{const n=Number(v);return Number.isSafeInteger(n)?n:v;};
  if(oid===BOOL)return v=>v==='t'?1:0;                 // MySQL returns 1/0 for boolean expressions
  if(oid===JSON_OID||oid===JSONB)return jsonStrings?v=>v:v=>JSON.parse(v);
  return pg.types.getTypeParser(oid,format);
 }};
}

// MySQL's ON DUPLICATE KEY UPDATE fires on any unique key; Postgres needs the key named.
// These are the keys each upsert in the app is written against (fresh UUID ids never collide).
export const UPSERT_KEYS={
 student_profiles:'org_id,user_id',ai_workspace_settings:'org_id',attendance_records:'session_id,user_id',
 certificate_templates:'course_id',college_marks:'course_id,user_id,label',programs:'faculty_id,name',
 grades:'org_id,program_scope,name',sections:'grade_id,name',edtech_results:'exam_id,user_id',
 course_offers:'course_id',lesson_notes:'lesson_id,user_id',tutoring_course_decks:'deck_id,course_id',
 quiz_extensions:'unit_id,user_id',rate_limits:'bucket',emis_roles:'org_id,user_id',
 emis_guardians:'org_id,user_id,student_person_id',
};
function splitTop(s){const parts=[];let depth=0,start=0;for(let i=0;i<s.length;i++){const c=s[i];if(c==='(')depth++;else if(c===')')depth--;else if(c===','&&depth===0){parts.push(s.slice(start,i));start=i+1;}}parts.push(s.slice(start));return parts;}
// INSERT INTO t(...) VALUES(...) ON DUPLICATE KEY UPDATE a=VALUES(a),n=n+1
//   -> ... ON CONFLICT (key) DO UPDATE SET a=EXCLUDED.a,n=t.n+1
function upsert(sql){
 const m=/\bON\s+DUPLICATE\s+KEY\s+UPDATE\b/i.exec(sql);if(!m)return sql;
 const table=(/^\s*INSERT\s+INTO\s+"?(\w+)"?/i.exec(sql)||[])[1],key=UPSERT_KEYS[table];
 if(!key)throw new Error(`pg-compat: add the conflict key for table "${table}" to UPSERT_KEYS`);
 const sets=splitTop(sql.slice(m.index+m[0].length)).map(a=>{
  const eq=a.indexOf('=');const lhs=a.slice(0,eq).trim(),rhs=a.slice(eq+1)
   .replace(/\bVALUES\(\s*(\w+)\s*\)/gi,'EXCLUDED.$1')
   .replace(/(?<![.\w$'"])([a-z_][a-z0-9_]*)\b(?!\s*\()/g,`${table}.$1`);
  return lhs+'='+rhs.trim();
 });
 return sql.slice(0,m.index)+`ON CONFLICT (${key}) DO UPDATE SET `+sets.join(',');
}

const UNITS='MICROSECOND|SECOND|MINUTE|HOUR|DAY|WEEK|MONTH|QUARTER|YEAR';
const cache=new Map();
export function translate(sql){
 let hit=cache.get(sql);if(hit)return hit;
 let out='',n=0,i=0,ignore=false;
 const normal=(s)=>{
  s=s.replace(/\bINSERT\s+IGNORE\s+INTO\b/gi,()=>{ignore=true;return 'INSERT INTO';})
   .replace(/<=>/g,' IS NOT DISTINCT FROM ')
   .replace(/\bJSON_OBJECT\(\s*\)/gi,"'{}'::jsonb")
   .replace(/\bTRUE\b/gi,'1').replace(/\bFALSE\b/gi,'0')            // MySQL booleans are 0/1 (columns are smallint)
   .replace(new RegExp(`\\bINTERVAL\\s+(\\d+)\\s+(${UNITS})\\b`,'gi'),"INTERVAL '$1 $2'")
   .replace(/\bAS\s+(UNSIGNED|SIGNED)(\s+INTEGER)?\b/gi,'AS bigint')
   .replace(/\b(NOT\s+)?LIKE\b/gi,(m,not)=>(not||'')+'ILIKE')      // MySQL utf8mb4_0900_ai_ci is case-insensitive
   .replace(/\b([a-z_][a-z0-9_]*[A-Z][A-Za-z0-9_]*)\b/g,'"$1"')     // keep camelCase aliases (Postgres folds to lower case)
   .replace(/\?/g,()=>'$'+(++n))
   .replace(/(\$\d+)(\s+IS\s+(?:NOT\s+)?NULL)\b/gi,'$1::text$2');  // untyped "? IS NULL" needs a type in Postgres
  return s;
 };
 let buf='';
 const flush=()=>{out+=normal(buf);buf='';};
 while(i<sql.length){
  const c=sql[i];
  if(c==="'"||c==='"'){ // MySQL string literal (either quote) -> Postgres single-quoted literal
   let j=i+1,v='',bs=false;
   while(j<sql.length){const d=sql[j];
    if(d==='\\'){const e=sql[j+1];v+=({n:'\n',r:'\r',t:'\t','0':'\0',b:'\b',Z:'\x1a'})[e]??e;bs=true;j+=2;continue;}
    if(d===c){if(sql[j+1]===c){v+=c;j+=2;continue;}break;}
    v+=d;j++;}
   flush();
   const jsonOp=/(->>|->)\s*$/.exec(out);
   if(jsonOp&&v.startsWith('$')){ // col->>'$.a.b'  ->  col#>>'{a,b}'
    const path=v.slice(1).match(/\.("([^"]*)"|[^.[]+)|\[(\d+)\]/g)||[];
    const keys=path.map(p=>p.startsWith('[')?p.slice(1,-1):p.slice(1).replace(/^"|"$/g,''));
    out=out.slice(0,jsonOp.index)+(jsonOp[1]==='->>'?'#>>':'#>')+"'{"+keys.map(k=>'"'+k.replace(/"/g,'\\"')+'"').join(',').replace(/'/g,"''")+"}'";
   }else out+=(bs&&/[\\]/.test(v)?'E':'')+"'"+(bs?v.replace(/\\/g,'\\\\'):v).replace(/'/g,"''")+"'";
   i=j+1;continue;
  }
  if(c==='`'){const j=sql.indexOf('`',i+1);flush();out+='"'+sql.slice(i+1,j)+'"';i=j+1;continue;}
  if(c==='-'&&sql[i+1]==='-'){const j=sql.indexOf('\n',i);flush();i=j<0?sql.length:j;continue;}
  buf+=c;i++;
 }
 flush();
 out=out.trim().replace(/;$/,'');
 if(ignore)out+=' ON CONFLICT DO NOTHING';
 out=upsert(out);
 if(cache.size>5000)cache.clear();
 cache.set(sql,out);return out;
}

const pad2=x=>String(x).padStart(2,'0');
function param(v){
 if(v===undefined)return null;
 if(typeof v==='boolean')return v?1:0;
 if(v instanceof Date)return `${v.getUTCFullYear()}-${pad2(v.getUTCMonth()+1)}-${pad2(v.getUTCDate())} ${pad2(v.getUTCHours())}:${pad2(v.getUTCMinutes())}:${pad2(v.getUTCSeconds())}.${String(v.getUTCMilliseconds()).padStart(3,'0')}`;
 return v;
}

const CODES={'23505':['ER_DUP_ENTRY',1062],'23503':['ER_NO_REFERENCED_ROW_2',1452],'23502':['ER_BAD_NULL_ERROR',1048],'23514':['ER_CHECK_CONSTRAINT_VIOLATED',3819],'22001':['ER_DATA_TOO_LONG',1406],'40P01':['ER_LOCK_DEADLOCK',1213],'55P03':['ER_LOCK_WAIT_TIMEOUT',1205],'40001':['ER_LOCK_DEADLOCK',1213]};
function mapError(e,sql){
 if(e&&typeof e.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)){
  const [code,errno]=CODES[e.code]||['ER_PG_'+e.code,0];
  e.sqlState=e.code;e.pgCode=e.code;e.code=code;e.errno=errno;e.sqlMessage=e.message;
  if(e.pgCode==='23503'&&/still referenced/.test(e.detail||''))e.code='ER_ROW_IS_REFERENCED_2';
  if(process.env.TEJASVI_SQL_DEBUG)console.error('[sql]',e.pgCode,e.message,'\n  ',sql);
 }
 return e;
}

const SET_TX=/^\s*SET\s+TRANSACTION\s+ISOLATION\s+LEVEL\s+([A-Z ]+?)\s*;?\s*$/i;
async function exec(client,sql,values=[],state){
 if(SET_TX.test(sql)){const level=SET_TX.exec(sql)[1];if(state&&!state.inTx){state.isolation=level;return [{affectedRows:0,insertId:0,changedRows:0}];}}
 const text=translate(sql);
 let r;
 try{r=await client.query({text,values:values.map(param)});}catch(e){throw mapError(e,text);}
 if(Array.isArray(r))r=r[r.length-1];
 if(r.command==='SELECT'||(r.fields&&r.fields.length))return [r.rows,r.fields];
 return [{affectedRows:r.rowCount??0,insertId:0,changedRows:r.rowCount??0,warningStatus:0}];
}

function wrapConnection(client){
 const state={inTx:false,isolation:null};
 return {
  execute:(sql,values)=>exec(client,sql,values,state),
  query:(sql,values)=>exec(client,sql,values,state),
  async beginTransaction(){await client.query(state.isolation?`BEGIN ISOLATION LEVEL ${state.isolation}`:'BEGIN');state.inTx=true;state.isolation=null;},
  async commit(){try{await client.query('COMMIT');}catch(e){throw mapError(e,'COMMIT');}finally{state.inTx=false;}},
  async rollback(){state.inTx=false;await client.query('ROLLBACK').catch(()=>{});},
  release(){if(state.inTx){state.inTx=false;client.query('ROLLBACK').catch(()=>{}).finally(()=>client.release());}else client.release();},
  async end(){client.release();},
  pg:client,
 };
}

export function connectionString(){
 const url=process.env.DATABASE_URL;
 if(!url)throw new Error('Database not configured. Set DATABASE_URL in .env to your Supabase connection string.');
 return url;
}
function sslFor(url){return /localhost|127\.0\.0\.1/.test(url)&&!/sslmode=require/.test(url)?false:{rejectUnauthorized:false};}

/** Creates a mysql2-compatible pool over Postgres. options: {connectionLimit, jsonStrings, url} */
export function createPool(options={}){
 const url=options.url||connectionString();
 const p=new pg.Pool({connectionString:url,ssl:sslFor(url),max:options.connectionLimit||10,idleTimeoutMillis:30000,connectionTimeoutMillis:15000,types:typeParsers(!!options.jsonStrings)});
 p.on('error',()=>{}); // idle client errors are surfaced on the next query
 p.on('connect',c=>{c.query("SET TIME ZONE 'UTC'").catch(()=>{});});
 return {
  execute:(sql,values)=>exec(p,sql,values,null),
  query:(sql,values)=>exec(p,sql,values,null),
  async getConnection(){return wrapConnection(await p.connect());},
  end:()=>p.end(),
  pg:p,
 };
}

/** Single connection (scripts). */
export async function createConnection(options={}){
 const url=options.url||connectionString();
 const c=new pg.Client({connectionString:url,ssl:sslFor(url),types:typeParsers(!!options.jsonStrings)});
 await c.connect();await c.query("SET TIME ZONE 'UTC'");
 const w=wrapConnection({query:(...a)=>c.query(...a),release(){}});
 return {...w,end:()=>c.end()};
}
