import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import {z} from 'zod';
import {identity,membership,checkWrite,boundedBody,respond,failure,AppError} from '@/lib/platform-server';
import {one,run} from '@/lib/db';
import {coursePermission} from '@/lib/course-access';
import {unitPermission} from '@/lib/unit-access';
import {teacherRosterClause} from '@/lib/college-policy';
import {canSubmit} from '@/lib/assessment-policy';
import {validatePDF,validateOffice} from '@/lib/document-file';
export const runtime='nodejs';export const dynamic='force-dynamic';
const folder=()=>path.resolve(process.env.UPLOAD_DIR||'./storage/uploads','submissions');
export async function POST(request:Request){let saved='';try{
 checkWrite(request);const user=await identity(),bytes=await boundedBody(request,6*1024*1024),f=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')||''}}).formData();
 const aid=z.string().uuid().parse(f.get('assessmentId')),a=await one('SELECT * FROM assessments WHERE id=?',[aid]);if(!a)throw new AppError('Assessment not found.',404);
 const course=await coursePermission(a.course_id,user.userId),m=await membership(course.org_id,user.userId);if(a.unit_id)await unitPermission(a.unit_id,user.userId);
 if(!['student','employee'].includes(m.role))throw new AppError('Only learners can upload a submission.',403);
 const prior=await one('SELECT * FROM submissions WHERE assessment_id=? AND user_id=?',[aid,user.userId]);if(!canSubmit(a,prior))throw new AppError('This submission is closed.');
 const count=await one('SELECT COUNT(*) AS n FROM submission_files WHERE user_id=? AND created_at>UTC_TIMESTAMP()-INTERVAL 1 HOUR',[user.userId]);if(Number(count?.n)>=20)throw new AppError('Upload limit reached. Try again later.',429);
 const file=f.get('file');if(!(file instanceof File)||!file.size||file.size>5*1024*1024)throw new AppError('Choose a PDF, DOCX or PPTX up to 5 MB.');
 const kind=file.name.toLowerCase().split('.').pop(),content=new Uint8Array(await file.arrayBuffer());
 try{if(kind==='pdf')await validatePDF(content);else if(kind==='docx'||kind==='pptx')validateOffice(content,kind);else throw Error('Choose a PDF, DOCX or PPTX.');}catch(e){throw new AppError((e as Error).message)}
 const id=randomUUID(),key=id+'.'+kind,name=file.name.replace(/[^a-zA-Z0-9._() -]/g,'_').slice(0,180);
 await mkdir(folder(),{recursive:true,mode:0o700});saved=path.join(folder(),key);await writeFile(saved,content,{flag:'wx',mode:0o600});
 await run('INSERT INTO submission_files(id,assessment_id,user_id,name,kind,file_key,file_size) VALUES(?,?,?,?,?,?,?)',[id,aid,user.userId,name,kind!,key,file.size]);saved='';return respond({id,name},201);
}catch(e){if(saved)await unlink(saved).catch(()=>{});return failure(e)}}
export async function GET(request:Request){try{
 const user=await identity(),id=z.string().uuid().parse(new URL(request.url).searchParams.get('id')),f=await one('SELECT * FROM submission_files WHERE id=?',[id]);if(!f)throw new AppError('File not found.',404);
 const a=await one('SELECT * FROM assessments WHERE id=?',[f.assessment_id]);if(!a)throw new AppError('Assessment not found.',404);
 const course=await coursePermission(a.course_id,user.userId),m=await membership(course.org_id,user.userId);if(a.unit_id)await unitPermission(a.unit_id,user.userId);
 if(!['admin','teacher'].includes(m.role)){if(f.user_id!==user.userId||a.status!=='published')throw new AppError('Access denied.',403);}
 else{
  if(!await one('SELECT id FROM submissions WHERE assessment_id=? AND user_id=? AND file_id=?',[a.id,f.user_id,id]))throw new AppError('This attachment has not been submitted.',403);
  if(m.role==='teacher'&&(m.kind==='edtech'||m.kind==='college'&&course.subject_id)&&!await one(`SELECT c.id FROM courses c JOIN users u ON u.id=? WHERE c.id=? AND ${teacherRosterClause()}`,[f.user_id,a.course_id,user.userId]))throw new AppError('This learner is outside your assigned intake.',403);
 }
 if(path.basename(f.file_key)!==f.file_key)throw new AppError('Invalid file.');
 let content;try{content=await readFile(path.join(folder(),f.file_key))}catch{throw new AppError('File unavailable. Ask the learner to upload it again.',404)}
 return new Response(new Uint8Array(content),{headers:{'Content-Type':f.kind==='pdf'?'application/pdf':f.kind==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/vnd.openxmlformats-officedocument.presentationml.presentation','Content-Disposition':`attachment; filename="${f.name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return failure(e)}}
