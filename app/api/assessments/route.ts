import {canSubmit} from '@/lib/assessment-policy';
import {learnerClause} from '@/lib/course-policy';
import {teacherRosterClause} from '@/lib/college-policy';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { one,rows,run,transaction } from '@/lib/db';
import { identity,membership,readJson,respond,failure,AppError } from '@/lib/platform-server';
import { coursePermission } from '@/lib/course-access';
import { unitPermission } from '@/lib/unit-access';
export const runtime='nodejs';export const dynamic='force-dynamic';
const id=z.string().uuid(),date=z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),z.literal('')]);
export async function GET(request:Request){try{
 const user=await identity(),q=new URL(request.url).searchParams,courseId=id.parse(q.get('course')),course=await coursePermission(courseId,user.userId),m=await membership(course.org_id,user.userId),staff=['admin','teacher'].includes(m.role),unit=q.get('unit');
 if(unit){const u=await unitPermission(id.parse(unit),user.userId);if(u.unit.course_id!==courseId)throw new AppError('Unit does not belong to this course.',403)}
 const values=unit?[courseId,unit]:[courseId],filter=unit?' AND a.unit_id=?':q.get('all')==='1'?'':' AND a.unit_id IS NULL';
 const assessments=await rows(`SELECT a.*,(SELECT cu.title FROM course_units cu WHERE cu.id=a.unit_id) AS unit_title FROM assessments a WHERE a.course_id=?${filter}${staff?'':" AND a.status='published' AND (a.unit_id IS NULL OR EXISTS(SELECT 1 FROM course_units cu WHERE cu.id=a.unit_id AND cu.status='published'))"} ORDER BY a.created_at DESC`,values);
 const teacherScope=m.role==='teacher'&&(m.kind==='edtech'||m.kind==='college'&&course.subject_id)?` AND EXISTS(SELECT 1 FROM courses c WHERE c.id=a.course_id AND ${teacherRosterClause()})`:'';
 const submissions=await rows(`SELECT s.*,u.name,u.email,sf.name AS file_name,sf.kind AS file_kind FROM submissions s LEFT JOIN submission_files sf ON sf.id=s.file_id JOIN assessments a ON a.id=s.assessment_id JOIN users u ON u.id=s.user_id WHERE a.course_id=?${filter}${staff?'':" AND s.user_id=? AND a.status='published' AND (a.unit_id IS NULL OR EXISTS(SELECT 1 FROM course_units cu WHERE cu.id=a.unit_id AND cu.status='published'))"}${teacherScope}`,[...(staff?values:[...values,user.userId]),...(teacherScope?[user.userId]:[])]);
 const roster=staff?await rows(`SELECT DISTINCT u.id,u.name,u.email FROM users u JOIN memberships mm ON mm.user_id=u.id JOIN courses c ON c.org_id=mm.org_id WHERE c.id=? AND mm.role IN ('student','employee') AND ${learnerClause().replaceAll("?","u.id")}${teacherScope?` AND ${teacherRosterClause()}`:''} ORDER BY u.name`,[courseId,...(teacherScope?[user.userId]:[])]):[];
 const events=await rows(`SELECT e.id,e.submission_id,e.event,e.created_at,JSON_UNQUOTE(JSON_EXTRACT(e.snapshot,'$.feedback')) AS feedback,JSON_EXTRACT(e.snapshot,'$.score') AS score FROM submission_events e JOIN submissions s ON s.id=e.submission_id JOIN assessments a ON a.id=s.assessment_id JOIN users u ON u.id=s.user_id WHERE a.course_id=?${filter}${staff?'':" AND s.user_id=? AND a.status='published' AND (a.unit_id IS NULL OR EXISTS(SELECT 1 FROM course_units cu WHERE cu.id=a.unit_id AND cu.status='published'))"}${teacherScope} ORDER BY e.created_at DESC`,[...(staff?values:[...values,user.userId]),...(teacherScope?[user.userId]:[])]);
 return respond({staff,kind:m.kind,assessments,submissions,roster,events});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),body=await readJson(request),action=z.enum(['create','publish','submit','grade','return','settings']).parse(body.action);
 if(action==='create'){
  const courseId=id.parse(body.courseId);await coursePermission(courseId,user.userId,true);
  const d=z.object({unitId:id.optional(),title:z.string().trim().min(1).max(160),kind:z.enum(['project','assignment','worksheet','case_study','activity']),instructions:z.string().trim().min(1).max(15000),dueDate:date.default(''),dueAt:z.union([z.string().datetime(),z.literal('')]).default(''),questionMaterialId:z.union([id,z.literal('')]).default(''),maxScore:z.number().int().min(1).max(1000),status:z.enum(['draft','published']),allowLate:z.boolean().default(false),caseContext:z.string().trim().max(6000).default(''),deliverables:z.string().trim().max(6000).default(''),rubric:z.string().trim().max(6000).default('')}).parse(body),aid=randomUUID();
  if(d.unitId){const u=await unitPermission(d.unitId,user.userId,true);if(u.unit.course_id!==courseId)throw new AppError('Choose a unit in this course.',403)}
  if(d.questionMaterialId){const material=await one('SELECT * FROM course_materials WHERE id=? AND course_id=?',[d.questionMaterialId,courseId]);if(!material||material.visibility!=='learners'||(material.unit_id||null)!==(d.unitId||null)||material.lesson_id)throw new AppError('Choose a learner-visible question file in this assessment’s unit.',403);}
  if(d.kind==='case_study'&&(!d.caseContext||!d.deliverables||!d.rubric))throw new AppError('A case study needs a real-world problem, deliverables and marking criteria.');
  await run('INSERT INTO assessments(id,course_id,author_id,title,kind,instructions,due_date,max_score,status,unit_id,case_context,deliverables,rubric,due_at,question_material_id,allow_late) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[aid,courseId,user.userId,d.title,d.kind,d.instructions,d.dueDate||null,d.maxScore,d.status,d.unitId||null,d.caseContext,d.deliverables,d.rubric,d.dueAt?new Date(d.dueAt):null,d.questionMaterialId||null,d.allowLate]);return respond({id:aid},201);
 }
 const aid=id.parse(body.assessmentId),a=await one('SELECT * FROM assessments WHERE id=?',[aid]);if(!a)throw new AppError('Assessment not found.',404);
 const course=await coursePermission(a.course_id,user.userId,action!=='submit');if(a.unit_id)await unitPermission(a.unit_id,user.userId,action!=='submit');
 if(action==='publish'){const status=z.enum(['draft','published']).parse(body.status);await run('UPDATE assessments SET status=? WHERE id=?',[status,aid]);return respond({ok:true})}
 if(action==='settings'){
  const d=z.object({allowLate:z.boolean(),dueAt:z.union([z.string().datetime(),z.literal('')])}).parse(body);
  await run('UPDATE assessments SET allow_late=?,due_at=?,due_date=NULL WHERE id=?',[d.allowLate,d.dueAt?new Date(d.dueAt):null,aid]);return respond({ok:true});
 }
 if(action==='grade'||action==='return'){
  const member=await membership(course.org_id,user.userId),sid=id.parse(body.submissionId);
  if(member.role==='teacher'&&(member.kind==='edtech'||member.kind==='college'&&course.subject_id)){const target=await one('SELECT user_id FROM submissions WHERE id=? AND assessment_id=?',[sid,aid]);if(!target||!await one(`SELECT c.id FROM courses c JOIN users u ON u.id=? WHERE c.id=? AND ${teacherRosterClause()}`,[target.user_id,a.course_id,user.userId]))throw new AppError('This student is not in your assigned subject intake.',403);}
  const feedback=z.string().trim().max(10000).parse(body.feedback),version=z.number().int().min(1).parse(body.version);
  const score=action==='grade'?z.number().int().min(0).max(a.max_score).parse(body.score):null;
  const until=action==='return'?z.string().datetime().parse(body.returnedUntil):null;
  if(action==='return'&&(!feedback||Date.parse(until!)<=Date.now()))throw new AppError('Add feedback and a future resubmission deadline.');
  await transaction(async c=>{
   await one('SELECT id FROM assessments WHERE id=? FOR UPDATE',[aid],c);
   const prior=await one('SELECT * FROM submissions WHERE id=? AND assessment_id=? FOR UPDATE',[sid,aid],c);if(!prior)throw new AppError('Submission not found.',404);
   if(prior.version!==version)throw new AppError('This submission changed. Refresh before reviewing it.',409);
   if(prior.returned_until&&action==='grade')throw new AppError('Wait for the learner to resubmit before grading.');
   await run('INSERT INTO submission_events(id,submission_id,actor_id,event,snapshot) VALUES(?,?,?,?,?)',[randomUUID(),sid,user.userId,action,JSON.stringify({...prior,score,feedback,previousScore:prior.score,previousFeedback:prior.feedback})],c);
   await run('UPDATE submissions SET score=?,feedback=?,graded_by=?,graded_at=?,returned_until=?,version=version+1 WHERE id=?',[score,feedback,user.userId,action==='grade'?new Date():null,until?new Date(until):null,sid],c);
  });return respond({ok:true});
 }
 const m=await membership(course.org_id,user.userId);if(!['student','employee'].includes(m.role))throw new AppError('Use a learner account to submit work.',403);
 const d=z.object({body:z.string().trim().min(1).max(20000),link:z.union([z.string().url().max(2000).refine(v=>v.startsWith('https://')),z.literal('')]),fileId:z.union([id,z.literal('')]).optional(),version:z.number().int().min(0).optional()}).parse(body);
 await transaction(async c=>{
  const current=await one('SELECT * FROM assessments WHERE id=? FOR UPDATE',[aid],c);if(current!.status!=='published')throw new AppError('Assessment is not published.',403);
  const prior=await one('SELECT * FROM submissions WHERE assessment_id=? AND user_id=? FOR UPDATE',[aid,user.userId],c);if(!canSubmit(current!,prior))throw new AppError('This submission is closed. Ask your teacher to return it for revision.');
  if(d.version!==undefined&&d.version!==(prior?.version||0))throw new AppError('Your submission changed. Refresh and try again.',409);
  const fileId=d.fileId===undefined?(prior?.file_id||null):(d.fileId||null);
  if(fileId&&!await one('SELECT id FROM submission_files WHERE id=? AND assessment_id=? AND user_id=?',[fileId,aid,user.userId],c))throw new AppError('Attachment does not belong to this submission.',403);
  if(prior){
   await run('INSERT INTO submission_events(id,submission_id,actor_id,event,snapshot) VALUES(?,?,?,?,?)',[randomUUID(),prior.id,user.userId,'revision',JSON.stringify(prior)],c);
   await run('UPDATE submissions SET body=?,link=?,file_id=?,submitted_at=UTC_TIMESTAMP(3),returned_until=NULL,version=version+1 WHERE id=?',[d.body,d.link,fileId,prior.id],c);
  }else await run('INSERT INTO submissions(id,assessment_id,user_id,body,link,file_id) VALUES(?,?,?,?,?,?)',[randomUUID(),aid,user.userId,d.body,d.link,fileId],c);
 });return respond({ok:true});
}catch(e){return failure(e)}}
