import {z} from 'zod';
import {one,rows,run,transaction} from '@/lib/db';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {coursePermission} from '@/lib/course-access';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=z.string().uuid();
export async function GET(request:Request){try{const user=await identity(),q=new URL(request.url).searchParams,cid=uuid.parse(q.get('course')),course=await coursePermission(cid,user.userId,true),m=await membership(course.org_id,user.userId);return respond({title:course.title,status:course.status,audience:course.audience,role:m.role,accessMode:course.access_mode,units:await rows('SELECT id,title,status,position,CHAR_LENGTH(content)>0 AS has_content,JSON_LENGTH(quiz) AS quiz_count FROM course_units WHERE course_id=? ORDER BY position,created_at',[cid])})}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),d=z.object({courseId:uuid,unitId:z.union([uuid,z.literal('')]).default(''),action:z.enum(['publish','unpublish'])}).parse(await readJson(request));await coursePermission(d.courseId,user.userId,true);
 await transaction(async db=>{
  const course=await one('SELECT * FROM courses WHERE id=? FOR UPDATE',[d.courseId],db);if(!course)throw new AppError('Course not found.',404);
  const unit=d.unitId?await one('SELECT * FROM course_units WHERE id=? AND course_id=? FOR UPDATE',[d.unitId,d.courseId],db):null;if(d.unitId&&!unit)throw new AppError('Choose a unit in this course.',403);
  if(d.action==='unpublish'){if(unit)await run("UPDATE course_units SET status='draft',version=version+1 WHERE id=?",[unit.id],db);else await run("UPDATE courses SET status='draft',updated_at=UTC_TIMESTAMP(3) WHERE id=?",[d.courseId],db);return;}
  const values=d.unitId?[d.courseId,d.unitId]:[d.courseId],scope=d.unitId?'unit_id=?':'unit_id IS NULL';
  const files=await rows(`SELECT id FROM course_materials WHERE course_id=? AND ${scope} AND visibility='learners' AND assessment_only=FALSE`,values,db),assessments=await rows(`SELECT id FROM assessments WHERE course_id=? AND ${scope} FOR UPDATE`,values,db);
  const text=unit?.content?.trim(),quiz=unit?(typeof unit.quiz==='string'?JSON.parse(unit.quiz):unit.quiz):[];
  const existing=!unit?await one("SELECT id FROM course_units WHERE course_id=? AND status='published' LIMIT 1",[d.courseId],db):null;
  const lessons=!unit?await rows('SELECT id,content,video_url FROM lessons WHERE course_id=?',[d.courseId],db):[];
  if(!text&&!quiz?.length&&!files.length&&!assessments.length&&!existing&&!lessons.some(l=>l.content?.trim()||l.video_url))throw new AppError('Add a presentation, learning material, lesson, quiz or assignment before publishing.');
  if(unit)await run("UPDATE course_units SET status='published',version=version+1 WHERE id=?",[unit.id],db);
  await run(`UPDATE assessments SET status='published' WHERE course_id=? AND ${scope}`,values,db);
  await run("UPDATE courses SET status='published',updated_at=UTC_TIMESTAMP(3) WHERE id=?",[d.courseId],db);
 });return respond({ok:true});
}catch(e){return failure(e)}}
