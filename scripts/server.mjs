import http from 'node:http';
import {createReadStream,existsSync,realpathSync,statSync} from 'node:fs';
import {resolve,relative,sep,extname,isAbsolute} from 'node:path';
import {pipeline} from 'node:stream/promises';
import next from 'next';
import {createPool} from '../lib/pg-compat.mjs';
import {verified,root} from './common.mjs';
import {credentials,actor} from '../modules/emis/server/context.mjs';
import {createEmis} from '../modules/emis/server/index.mjs';
process.env.NODE_ENV='production';const config=await verified(),site=new URL(config.origin);const port=Number(site.port||80),host='127.0.0.1';
const app=next({dev:false,dir:root,hostname:host,port});await app.prepare();const handle=app.getRequestHandler();
const pool=createPool({url:config.db.url,connectionLimit:10,jsonStrings:true});
const dist=realpathSync(resolve(root,'build/emis')),sec={'Cache-Control':'private, no-store','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
function deny(res,status,msg,asJson){res.writeHead(status,{...sec,'Content-Type':asJson?'application/json; charset=utf-8':'text/html; charset=utf-8'});res.end(asJson?JSON.stringify({error:msg}):'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Workspace access · Tejasvi</title><main style="font:18px/1.55 system-ui;color:#12395c;max-width:36em;margin:12vh auto;padding:1rem"><h1>Workspace access</h1><p>This EMIS workspace is available to authorized members of its school or college.</p><p><a href="/workspaces">Go to my workspaces</a></p></main></html>');}
const types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html; charset=utf-8','.ttf':'font/ttf','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'};
async function file(req,res,p,index=false){if(!['HEAD','GET'].includes(req.method))return deny(res,405,'Method not allowed.',true);if(!existsSync(p))return deny(res,404,'Not found.',true);p=realpathSync(p);const rel=relative(dist,p);if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||!statSync(p).isFile())return deny(res,404,'Not found.',true);res.writeHead(200,{...sec,'Content-Type':types[extname(p)]||'application/octet-stream','Cache-Control':index?'private, no-store':'public, max-age=31536000, immutable',...(index?{'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"}:{})});if(req.method==='HEAD')return res.end();await pipeline(createReadStream(p),res);}
const server=http.createServer(async(req,res)=>{let isApi=false;try{
 if(req.headers.host!==site.host)return deny(res,421,'Open '+site.origin,true);
 const u=new URL(req.url,site),path=u.pathname;
 if(path.startsWith('/campus-ui/')){const match=path.match(/^\/campus-ui\/assets\/([A-Za-z0-9_.-]+)$/);return match?await file(req,res,resolve(dist,'assets',match[1])):deny(res,404,'Not found.',true);}
 if(/^\/(erp|emis)\/?$/.test(path)){res.writeHead(302,{...sec,Location:'/workspaces'});return res.end();}
 if(path.startsWith('/erp/')){
  const m=path.match(/^\/erp\/([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})(\/api(?:\/.*)?|\/?)$/i);isApi=/\/api(?:\/|$)/.test(path);if(!m)return deny(res,404,'Unknown workspace route.',isApi);
  const org=m[1].toLowerCase(),a=credentials(req.headers.cookie,org),user=await actor(pool,org,a);
  if(!isApi){if(m[2]===''){res.writeHead(302,{...sec,Location:'/erp/'+org+'/'});return res.end();}return await file(req,res,resolve(dist,'index.html'),true);}
  req.url=m[2]+u.search;return await createEmis({pool,org,auth:a,user,dataDir:resolve(root,'storage/emis')}).handle(req,res);
 }
 return await handle(req,res);
 }catch(e){if(res.headersSent){res.end();return;}if(!isApi&&(e.status===401||e.status===428)){res.writeHead(302,{...sec,Location:e.status===401?'/login':'/change-password'});res.end();return;}deny(res,e.status||500,e.campusPublic?e.message:'The request could not be completed.',isApi);}});
server.requestTimeout=60000;server.on('error',async e=>{console.error('Tejasvi could not listen: '+(e.code||e.name));await app.close();await pool.end();process.exitCode=1;});
server.listen(port,host,()=>console.log('Tejasvi is ready: '+site.origin));let stopped=false;for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{if(stopped)return;stopped=true;server.close(async()=>{await app.close();await pool.end();process.exit(0);});server.closeIdleConnections();});
