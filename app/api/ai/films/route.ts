import {z} from 'zod';
import {randomUUID,createHash} from 'node:crypto';
import {identity,checkWrite,boundedBody,respond,failure,AppError} from '@/lib/platform-server';
import {coursePermission} from '@/lib/course-access';
import {one,rows,run} from '@/lib/db';
import {throttle} from '@/lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=z.string().uuid(),maxBytes=12*1024*1024;
async function context(req:Request,edit=false){const u=await identity(),q=new URL(req.url).searchParams,id=uuid.parse(q.get('course')),c=await coursePermission(id,u.userId,edit);if(c.org_id!==uuid.parse(q.get('org')))throw new AppError('Course not available in this workspace.',403);return {u,q,id,c};}
export async function GET(req:Request){try{const {id,c,q}=await context(req),film=q.get('film');
 if(c.status!=='published')throw new AppError('This course is not published.',403);
 if(!film)return respond({films:await rows('SELECT id,title FROM ai_course_films WHERE org_id=? AND course_id=? ORDER BY created_at DESC',[c.org_id,id])});
 const args=[uuid.parse(film),id,c.org_id],f=await one('SELECT mime,OCTET_LENGTH(movie) AS n FROM ai_course_films WHERE id=? AND course_id=? AND org_id=?',args);if(!f)throw new AppError('Film is no longer available.',404);
 const n=Number(f.n),range=req.headers.get('range');let lo=0,hi=n-1,status=200;
 const headers:Record<string,string>={'Content-Type':f.mime,'Cache-Control':'private, no-store','Accept-Ranges':'bytes','Content-Disposition':'inline','X-Content-Type-Options':'nosniff'};
 if(range){const m=range.match(/^bytes=(\d*)-(\d*)$/);if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+n}});if(m[1]){lo=Number(m[1]);hi=m[2]?Math.min(hi,Number(m[2])):hi;}else lo=Math.max(0,n-Number(m[2]));
 if(!Number.isSafeInteger(lo)||!Number.isSafeInteger(hi)||lo>hi||lo>=n)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+n}});status=206;headers['Content-Range']='bytes '+lo+'-'+hi+'/'+n;}
 const part=await one('SELECT SUBSTRING(movie,?,?) AS b FROM ai_course_films WHERE id=? AND course_id=? AND org_id=?',[lo+1,hi-lo+1,...args]);if(!part)throw new AppError('Film is no longer available.',404);headers['Content-Length']=String(part.b.length);return new Response(new Uint8Array(part.b),{status,headers});
 }catch(e){return failure(e);}}
export async function POST(req:Request){try{checkWrite(req);const {u,q,id,c}=await context(req,true);if(c.status!=='published'||q.get('reviewed')!=='yes')throw new AppError('Choose a published course and confirm your review.',400);
 const title=z.string().trim().min(1).max(140).parse(q.get('title')),type=req.headers.get('content-type')?.split(';')[0];if(type!=='video/webm'&&type!=='video/mp4')throw new AppError('Use a WebM or MP4 video.',415);
 await throttle('ai-film-share:'+u.userId,15);const b=Buffer.from(await boundedBody(req,maxBytes));if(b.length<24||(type==='video/webm'?b.readUInt32BE(0)!==0x1a45dfa3:b.toString('ascii',4,8)!=='ftyp'))throw new AppError('The video format could not be read.',415);
 const current=await coursePermission(id,u.userId,true);if(current.org_id!==c.org_id||current.status!=='published')throw new AppError('Course access changed.',403);
 const sha=createHash('sha256').update(b).digest('hex'),fid=randomUUID();
 try{await run('INSERT INTO ai_course_films(id,org_id,course_id,author_id,title,mime,fingerprint,movie) VALUES(?,?,?,?,?,?,?,?)',[fid,c.org_id,id,u.userId,title,type,sha,b]);}
 catch(e){if((e as {code?:string}).code!=='ER_DUP_ENTRY')throw e;return respond({message:'This film is already shared with this course.'});}
 return respond({message:'Reviewed film shared with this course.'},201);
 }catch(e){return failure(e);}}
export async function DELETE(req:Request){try{checkWrite(req);const {id,c,q}=await context(req,true);const result=await run('DELETE FROM ai_course_films WHERE id=? AND course_id=? AND org_id=?',[uuid.parse(q.get('film')),id,c.org_id]);if(!result.affectedRows)throw new AppError('Film not found.',404);return respond({ok:true});}catch(e){return failure(e);}}
