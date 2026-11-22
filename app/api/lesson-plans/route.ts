import { z } from 'zod';
import { validateLessonFile } from '@/lib/document-file';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { one, run } from '@/lib/db';
import { AppError, identity, membership, canEdit, respond, failure, checkWrite, boundedBody } from '@/lib/platform-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
function uploadDir(){return path.resolve(process.env.UPLOAD_DIR||'./storage/uploads')}
export async function POST(request:Request){let savedPath:string|null=null;try{
 checkWrite(request);const user=await identity(),bytes=await boundedBody(request,11*1024*1024),form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')||''}}).formData();
 const orgId=z.string().uuid().parse(form.get('orgId')),member=await membership(orgId,user.userId);canEdit(member);if(!['school','college'].includes(member.kind))throw new AppError('Lesson plans belong to a school workspace.',403);
 const data=z.object({title:z.string().trim().min(1).max(160),subject:z.string().trim().min(1).max(100),grade:z.string().trim().min(1).max(100),lessonDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),objectives:z.string().trim().min(1).max(5000)}).parse(Object.fromEntries(form));
 const file=form.get('file');if(!(file instanceof File)||!file.size)throw new AppError('Select a lesson plan file.');if(file.size>10*1024*1024)throw new AppError('Choose a file smaller than 10 MB.',413);const content=new Uint8Array(await file.arrayBuffer());let ext:string;try{ext=await validateLessonFile(content,file.name)}catch(e){throw new AppError((e as Error).message)};
 const id=randomUUID(),key=id+'.'+ext,name=file.name.replace(/[^a-zA-Z0-9._() -]/g,'_').slice(0,180);await mkdir(uploadDir(),{recursive:true,mode:0o700});savedPath=path.join(uploadDir(),key);await writeFile(savedPath,content,{flag:'wx',mode:0o600});
 await run('INSERT INTO lesson_plans(id,org_id,author_id,title,subject,grade,lesson_date,objectives,file_key,file_name,file_size) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,orgId,user.userId,data.title,data.subject,data.grade,data.lessonDate,data.objectives,key,name,file.size]);savedPath=null;return respond({id},201);
}catch(e){if(savedPath)await unlink(savedPath).catch(()=>{});return failure(e)}}
export async function GET(request:Request){try{const user=await identity(),id=new URL(request.url).searchParams.get('id'),plan=await one('SELECT * FROM lesson_plans WHERE id=?',[id||'']);if(!plan)throw new AppError('Lesson plan not found.',404);const member=await membership(plan.org_id,user.userId);canEdit(member);if(member.role!=='admin'&&plan.author_id!==user.userId)throw new AppError('You do not have access to this file.',403);if(path.basename(plan.file_key)!==plan.file_key)throw new AppError('Invalid file.',400);let file:Buffer;try{file=await readFile(path.join(uploadDir(),plan.file_key))}catch{throw new AppError('File not found. Restore the uploads folder from your backup.',404)}return new Response(new Uint8Array(file),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${plan.file_name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}catch(e){return failure(e)}}
