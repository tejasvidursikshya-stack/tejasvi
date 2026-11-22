import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,unlink,copyFile,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {membership,AppError} from './platform-server';
import {aiAccess} from './ai-access';
import {throttle} from './auth';
import {one,rows,run,transaction} from './db';
import {coursePermission} from './course-access';
import {portablePowerPoint} from './presentation-file';
import {exportBytes,GammaError,pollGamma,submitGamma} from './gamma-client.mjs';
export const uuid=z.string().uuid();
export const briefSchema=z.object({title:z.string().trim().min(3).max(160),audience:z.string().trim().min(2).max(140),notes:z.string().trim().min(10).max(12000),cards:z.union([z.literal(6),z.literal(8),z.literal(10),z.literal(12)]),language:z.enum(['en','hi']),images:z.boolean()});
export type Brief=z.infer<typeof briefSchema>;
const folder=(where:string)=>path.resolve(process.env.UPLOAD_DIR||'./storage/uploads',where);
const filePath=(where:string,k:string)=>{if(!(where==='presentations'?/^[a-f0-9-]{36}\.(pptx|pdf)$/:/^[a-f0-9-]{36}\.pptx$/).test(k))throw new AppError('Invalid presentation file.',409);return path.join(folder(where),k);};
const remove=(where:string,k?:string|null)=>k?unlink(filePath(where,k)).catch(()=>{}):Promise.resolve();
const fix='Download from Gamma, then upload your reviewed PowerPoint here (up to 20 MB).';
const cols='id,title,brief,state,gamma_url,file_key,file_bytes,credits,message,created_at,updated_at,provider_id,request_id,input_hash';
export async function author(org:string,uid:string){const m=await membership(org,uid);if(!['teacher','admin'].includes(m.role))throw new AppError('Teaching access is required for presentation authoring.',403);return m;}
const revision=(key:string|null)=>key?createHash('sha256').update(key).digest('hex'):null;
function publicRow(j:Record<string,any>){return {id:j.id,title:j.title,brief:typeof j.brief==='string'?JSON.parse(j.brief):j.brief,state:j.state,gammaUrl:j.gamma_url||null,archived:!!j.file_key,revision:revision(j.file_key),size:j.file_bytes,credits:j.credits,message:j.message,created:j.created_at};}
async function raw(org:string,user:string,id:string){const j=await one('SELECT '+cols+' FROM gamma_presentations WHERE id=? AND org_id=? AND author_id=?',[id,org,user]);if(!j)throw new AppError('Presentation not found in your library.',404);return j;}
async function details(org:string,uid:string,id:string){const j=await raw(org,uid,id);return {...publicRow(j),copies:await rows('SELECT s.course_id AS courseId,s.material_id AS materialId,c.title FROM gamma_course_copies s JOIN courses c ON c.id=s.course_id WHERE s.deck_id=? AND c.org_id=?',[id,org])};}
export async function inspect(org:string,uid:string,id:string){await author(org,uid);await recover(org,uid);return details(org,uid,id);}
async function recover(org:string,uid:string){await run("UPDATE gamma_presentations SET state='uncertain',message='Tejasvi did not receive a generation ID. Check Gamma before starting another deck.' WHERE org_id=? AND author_id=? AND state='submitting' AND created_at<UTC_TIMESTAMP(3)-INTERVAL 2 MINUTE",[org,uid]);}
export async function library(org:string,uid:string,offset:number){await author(org,uid);await recover(org,uid);const list=await rows('SELECT '+cols+' FROM gamma_presentations WHERE org_id=? AND author_id=? ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET '+offset,[org,uid]);return {decks:list.slice(0,20).map(publicRow),more:list.length>20};}
export async function createDeck(org:string,uid:string,requestId:string,b:Brief){
 const m=await author(org,uid),access=await aiAccess(org,m.role),hash=createHash('sha256').update(JSON.stringify(b)).digest('hex');
 async function replay(){const old=await one('SELECT id,input_hash FROM gamma_presentations WHERE org_id=? AND author_id=? AND request_id=?',[org,uid,requestId]);if(!old)return null;if(old.input_hash!==hash)throw new AppError('That submission already belongs to another brief. Start a new presentation.',409);return details(org,uid,old.id);}
 const prior=await replay();if(prior)return prior;
 if(!access.access.gamma)throw new AppError('Gamma presentations are not enabled for this institution. Open Tejasvi AI → Connections.',409);
 await throttle('gamma-create-user:'+uid,5);await throttle('gamma-create-org:'+org,20);await throttle('gamma-create-global',60);
 const id=randomUUID();try{await run('INSERT INTO gamma_presentations(id,org_id,author_id,request_id,input_hash,title,brief) VALUES(?,?,?,?,?,?,?)',[id,org,uid,requestId,hash,b.title,JSON.stringify(b)]);}catch(e){if((e as {code?:string}).code==='ER_DUP_ENTRY'){const other=await replay();if(other)return other;}throw e;}
 let pid:string;try{pid=await submitGamma(process.env.GAMMA_API_KEY,b,access.policy.gammaTheme||'');}catch(e){
  const known=e instanceof GammaError;await run('UPDATE gamma_presentations SET state=?,message=? WHERE id=?',[known&&!e.ambiguous?'failed':'uncertain',known?e.message:'Gamma did not confirm the request. Check your Gamma account before starting again.',id]);await author(org,uid);return details(org,uid,id);}
 await run("UPDATE gamma_presentations SET provider_id=?,state='pending' WHERE id=?",[pid,id]);await author(org,uid);return details(org,uid,id);
}
async function archive(b:Uint8Array){try{b=portablePowerPoint(b);}catch{throw new AppError('Choose a valid .pptx up to 20 MB, without macros or embedded executables.',415);}const k=randomUUID()+'.pptx';await mkdir(folder('gamma-presentations'),{recursive:true,mode:0o700});await writeFile(filePath('gamma-presentations',k),b,{mode:0o600,flag:'wx'});return {key:k,size:b.length};}
export async function refreshDeck(org:string,uid:string,id:string,fetchExport=false){
 const m=await author(org,uid),j=await raw(org,uid,id);if(j.state==='submitting'){await recover(org,uid);return details(org,uid,id);}
 if(!(j.state==='pending'||(fetchExport&&j.state==='ready'&&!j.file_key))||!j.provider_id)return details(org,uid,id);
 if(!(await aiAccess(org,m.role)).access.gamma)throw new AppError('Gamma is disabled for this workspace. Your saved PowerPoints remain available.',409);
 const claim=await run("UPDATE gamma_presentations SET lease_until=UTC_TIMESTAMP(3)+INTERVAL 55 SECOND WHERE id=? AND (lease_until IS NULL OR lease_until<=UTC_TIMESTAMP(3)) AND (state='pending' OR (state='ready' AND file_key IS NULL))",[id]);if(!claim.affectedRows)return details(org,uid,id);
 let archived='';try{
  const g=await pollGamma(process.env.GAMMA_API_KEY,j.provider_id);let msg:string|null=null,n:number|null=null;
  if(g.state==='ready'){
   if(g.exportURL){try{const b=await exportBytes(g.exportURL);const f=await archive(b);archived=f.key;n=f.size;}catch{msg='The deck is ready but Tejasvi could not keep the export. '+fix;}}else msg='The deck is ready but its PowerPoint export is not available. Refresh the export or upload a reviewed copy.';
   if(!g.url&&!archived)msg='Gamma reported completion without a usable deck link. Check the connected Gamma account or upload a reviewed PowerPoint.';
  }else if(g.state==='failed')msg='Gamma could not generate this deck. Check the brief and your Gamma workspace before starting another.';
  // A teacher can upload a reviewed file while this provider read is in flight. Never replace that revision.
  await transaction(async db=>{const locked=await one('SELECT file_key FROM gamma_presentations WHERE id=? FOR UPDATE',[id],db);
   const accept=!!archived&&!locked?.file_key;
   await run("UPDATE gamma_presentations SET state=?,gamma_url=COALESCE(?,gamma_url),file_key=COALESCE(file_key,?),file_bytes=COALESCE(file_bytes,?),credits=COALESCE(?,credits),message=?,lease_until=UTC_TIMESTAMP(3)+INTERVAL 6 SECOND WHERE id=?",[g.state,g.url||null,accept?archived:null,accept?n:null,g.credits,locked?.file_key?null:msg,id],db);if(!accept&&archived){await remove('gamma-presentations',archived);archived='';}
  });
 }catch(e){await remove('gamma-presentations',archived);const msg=e instanceof GammaError?e.message:'Could not refresh Gamma. Try checking this deck again.';await run('UPDATE gamma_presentations SET message=?,lease_until=UTC_TIMESTAMP(3)+INTERVAL 10 SECOND WHERE id=?',[msg,id]);throw new AppError(msg,e instanceof GammaError?e.status:502);}
 await author(org,uid);return details(org,uid,id);
}
export async function uploadReview(org:string,uid:string,id:string,b:Uint8Array){
 await author(org,uid);const j=await raw(org,uid,id);if(j.state!=='ready')throw new AppError('Wait for this deck to finish before uploading a reviewed version.',409);
 const {key:k,size}=await archive(b);let prev='';try{await transaction(async db=>{const old=await one('SELECT file_key FROM gamma_presentations WHERE id=? AND org_id=? AND author_id=? FOR UPDATE',[id,org,uid],db);if(!old)throw new AppError('Presentation not found.',404);prev=old.file_key||'';await run('UPDATE gamma_presentations SET file_key=?,file_bytes=?,message=NULL WHERE id=?',[k,size,id],db);});}catch(e){await remove('gamma-presentations',k);throw e;}await remove('gamma-presentations',prev);return details(org,uid,id);
}
export async function deckFile(org:string,uid:string,id:string){await author(org,uid);const j=await raw(org,uid,id);if(!j.file_key)throw new AppError('No PowerPoint has been saved yet.',404);let b;try{b=await readFile(filePath('gamma-presentations',j.file_key));}catch{throw new AppError('This file is missing. Upload a reviewed PowerPoint or restore the uploads backup.',404);}
 return new Response(new Uint8Array(b),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.presentationml.presentation','Content-Disposition':"attachment; filename=\"presentation.pptx\"; filename*=UTF-8''"+encodeURIComponent(j.title+'.pptx').replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16)),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
export async function publishCopy(org:string,uid:string,id:string,course:string,withdraw=false,approvedRevision?:string){
 await author(org,uid);await raw(org,uid,id);let written='',obsolete='';
 try{await transaction(async db=>{const c=await coursePermission(course,uid,true,db);if(c.org_id!==org||(!withdraw&&c.status!=='published'))throw new AppError('Choose a published course you can edit in this institution.',403);
  const d=await one('SELECT title,state,file_key,file_bytes FROM gamma_presentations WHERE id=? AND org_id=? AND author_id=? FOR UPDATE',[id,org,uid],db);if(!d)throw new AppError('Presentation not found.',404);
  const existing=await one('SELECT s.material_id,m.file_key FROM gamma_course_copies s JOIN course_materials m ON m.id=s.material_id WHERE s.course_id=? AND s.deck_id=? FOR UPDATE',[course,id],db);
  if(existing)obsolete=existing.file_key;
  if(withdraw){if(existing)await run('DELETE FROM course_materials WHERE id=? AND course_id=?',[existing.material_id,course],db);return;}
  if(d.state!=='ready'||!d.file_key)throw new AppError('Save and review the PowerPoint before sharing.',409);
  if(revision(d.file_key)!==approvedRevision)throw new AppError('The PowerPoint has changed. Reopen this presentation and review the current file before sharing.',409);
  const k=randomUUID()+'.pptx';await mkdir(folder('presentations'),{recursive:true,mode:0o700});await copyFile(filePath('gamma-presentations',d.file_key),filePath('presentations',k),constants.COPYFILE_EXCL);written=k;
  const name=d.title.replace(/[^\p{L}\p{N} ._-]/gu,' ').trim()+'.pptx';
  const safeName=name;const mid=existing?.material_id||randomUUID();
  if(existing)await run("UPDATE course_materials SET kind='pptx',file_key=?,file_size=?,name=? WHERE id=? AND course_id=?",[k,d.file_bytes,safeName,mid,course],db);
  else{await run("INSERT INTO course_materials(id,course_id,name,kind,file_key,file_size,resource_type,visibility) VALUES(?,?,?,'pptx',?,?,'presentation','learners')",[mid,course,safeName,k,d.file_bytes],db);await run('INSERT INTO gamma_course_copies(deck_id,course_id,material_id) VALUES(?,?,?)',[id,course,mid],db);}
 });}catch(e){await remove('presentations',written);throw e;}
 await remove('presentations',obsolete);return details(org,uid,id);
}
