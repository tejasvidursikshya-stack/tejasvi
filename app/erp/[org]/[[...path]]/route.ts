import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createPool} from '@/lib/pg-compat.mjs';
import {credentials,actor} from '@/modules/emis/server/context.mjs';
import {createEmis} from '@/modules/emis/server/index.mjs';
// Serves the EMIS workspace (/erp/<org>/ and /erp/<org>/api/*) inside Next.js, so it also works on
// serverless hosts such as Vercel where scripts/server.mjs does not run. Mirrors that server's /erp branch.
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const sec={'Cache-Control':'private, no-store','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const indexCsp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
// EMIS expects JSON columns as raw strings, so it needs its own pool (scripts/server.mjs uses the same option).
const state=globalThis as unknown as {tejasviEmisPool?:unknown};
const emisPool=()=>state.tejasviEmisPool??=createPool({connectionLimit:5,jsonStrings:true});
// Serverless filesystems are read-only except the temp directory; attachments stored there are not durable.
const dataDir=process.env.EMIS_DATA_DIR||(process.env.VERCEL?resolve(tmpdir(),'tejasvi-emis'):resolve(process.cwd(),'storage/emis'));
let indexHtml:Promise<string>|undefined;
function deny(status:number,msg:string,asJson:boolean){return new Response(asJson?JSON.stringify({error:msg}):'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Workspace access · Tejasvi</title><main style="font:18px/1.55 system-ui;color:#12395c;max-width:36em;margin:12vh auto;padding:1rem"><h1>Workspace access</h1><p>This EMIS workspace is available to authorized members of its school or college.</p><p><a href="/workspaces">Go to my workspaces</a></p></main></html>',{status,headers:{...sec,'Content-Type':asJson?'application/json; charset=utf-8':'text/html; charset=utf-8'}});}
/** Runs the Node-style EMIS handler against a Fetch Request and collects its response. */
async function runEmis(handler:(req:any,res:any)=>Promise<void>,request:Request,url:string){
 const body=['GET','HEAD'].includes(request.method)?Buffer.alloc(0):Buffer.from(await request.arrayBuffer());
 const req=Object.assign(Readable.from(body.length?[body]:[]),{method:request.method,url,headers:Object.fromEntries(request.headers)});
 let status=200,headers:Record<string,string>={},chunks:Buffer[]=[],sent=false;
 const add=(h:Record<string,unknown>={})=>{for(const [k,v] of Object.entries(h))if(v!==undefined)headers[k.toLowerCase()]=String(v);};
 const res={get headersSent(){return sent},setHeader(k:string,v:unknown){add({[k]:v})},getHeader(k:string){return headers[k.toLowerCase()]},
  writeHead(s:number,h?:Record<string,unknown>){status=s;add(h);sent=true;return res},
  write(c:string|Buffer){sent=true;chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));return true},
  end(c?:string|Buffer){sent=true;if(c!==undefined)chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));return res}};
 await handler(req,res);
 return new Response(request.method==='HEAD'||[204,304].includes(status)?null:Buffer.concat(chunks),{status,headers});
}
async function serve(request:Request,{params}:{params:Promise<{org:string,path?:string[]}>}){
 const {org:raw,path=[]}=await params,u=new URL(request.url),isApi=path[0]==='api';
 try{
  if(!uuid.test(raw)||(!isApi&&path.length))return deny(404,'Unknown workspace route.',isApi);
  const org=raw.toLowerCase(),auth=credentials(request.headers.get('cookie')||'',org),pool=emisPool(),user=await actor(pool,org,auth);
  if(!isApi){
   if(!['GET','HEAD'].includes(request.method))return deny(405,'Method not allowed.',false);
   if(!u.pathname.endsWith('/'))return new Response(null,{status:302,headers:{...sec,Location:'/erp/'+org+'/'}});
   const html=await (indexHtml??=readFile(resolve(process.cwd(),'build/emis/index.html'),'utf8'));
   return new Response(request.method==='HEAD'?null:html,{headers:{...sec,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':indexCsp}});
  }
  const sub='/'+path.map(encodeURIComponent).join('/')+(u.pathname.endsWith('/')&&path.length>1?'/':'');
  return await runEmis(createEmis({pool,org,auth,user,dataDir}).handle,request,sub+u.search);
 }catch(e){
  const err=e as {status?:number,campusPublic?:boolean,message?:string,code?:string};
  if(!isApi&&(err.status===401||err.status===428))return new Response(null,{status:302,headers:{...sec,Location:err.status===401?'/login':'/change-password'}});
  if(!err.status)console.error('EMIS route failed:',err.code||err.message);
  return deny(err.status||500,err.campusPublic&&err.message?err.message:'The request could not be completed.',isApi);
 }
}
export {serve as GET,serve as HEAD,serve as POST,serve as PUT,serve as PATCH,serve as DELETE};
