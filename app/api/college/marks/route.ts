import {teacherRosterClause} from '@/lib/college-policy';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {rows,run} from '@/lib/db';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {coursePermission,learnerClause} from '@/lib/course-access';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=z.string().uuid();
async function roster(courseId:string,only?:string,teacherId?:string){
 // Correlated learner access follows the same enrolment rule as content downloads.
 return rows(`SELECT u.id,u.name,u.email FROM users u JOIN memberships m ON m.user_id=u.id JOIN courses c ON c.org_id=m.org_id WHERE c.id=? AND m.role='student' AND ${learnerClause().replaceAll('?', 'u.id')}${only?' AND u.id=?':''}${teacherId?' AND '+teacherRosterClause():''} ORDER BY u.name`,[courseId,...(only?[only]:[]),...(teacherId?[teacherId]:[])]);
}
export async function GET(request:Request){try{
 const user=await identity(),courseId=uuid.parse(new URL(request.url).searchParams.get('course')),course=await coursePermission(courseId,user.userId),m=await membership(course.org_id,user.userId);if(m.kind!=='college')throw new AppError('Open a college subject.',403);
 const staff=['admin','teacher'].includes(m.role),students=await roster(courseId,staff?undefined:user.userId,m.role==='teacher'?user.userId:undefined),ids=students.map(s=>s.id),placeholders=ids.map(()=>'?').join(',');
 const lessons=await rows('SELECT id,duration_minutes FROM lessons WHERE course_id=?',[courseId]),units=await rows("SELECT id,duration_minutes FROM course_units WHERE course_id=? AND status='published'",[courseId]);
 const completions=ids.length?await rows(`SELECT lc.user_id,l.duration_minutes FROM lesson_completions lc JOIN lessons l ON l.id=lc.lesson_id WHERE l.course_id=? AND lc.user_id IN (${placeholders}) UNION ALL SELECT uc.user_id,u.duration_minutes FROM unit_completions uc JOIN course_units u ON u.id=uc.unit_id WHERE u.course_id=? AND u.status='published' AND uc.user_id IN (${placeholders})`,[courseId,...ids,courseId,...ids]):[];
 const visible=" AND a.status='published' AND (a.unit_id IS NULL OR EXISTS(SELECT 1 FROM course_units cu WHERE cu.id=a.unit_id AND cu.status='published'))";
 const assignments=await rows(`SELECT a.id,a.title,a.max_score,a.due_at,a.due_date FROM assessments a WHERE a.course_id=?${visible}`,[courseId]);
 const submissions=ids.length?await rows(`SELECT s.user_id,s.assessment_id,s.score,s.feedback,s.submitted_at FROM submissions s JOIN assessments a ON a.id=s.assessment_id WHERE a.course_id=?${visible} AND s.user_id IN (${placeholders})`,[courseId,...ids]):[];
 const marks=ids.length?await rows(`SELECT * FROM college_marks WHERE course_id=? AND user_id IN (${placeholders}) ORDER BY label`,[courseId,...ids]):[];
 const quizzes=ids.length?await rows(`SELECT q.user_id,q.score,q.submitted_at,z.title,z.id quiz_id FROM quiz_attempts q JOIN quizzes z ON z.id=q.quiz_id JOIN courses c ON c.id=q.course_id AND c.quiz_id=z.id WHERE c.id=? AND q.quiz_revision=z.revision AND q.user_id IN (${placeholders}) UNION ALL SELECT q.user_id,q.score,q.submitted_at,u.title,u.id quiz_id FROM unit_quiz_attempts q JOIN course_units u ON u.id=q.unit_id WHERE u.course_id=? AND u.status='published' AND q.quiz_revision=u.quiz_revision AND q.user_id IN (${placeholders}) ORDER BY submitted_at DESC`,[courseId,...ids,courseId,...ids]):[];
 const latest=quizzes.filter((q,i)=>quizzes.findIndex(x=>x.user_id===q.user_id&&x.quiz_id===q.quiz_id)===i);
 return respond({staff,students:students.map(s=>({...s,completedMinutes:completions.filter(c=>c.user_id===s.id).reduce((sum,c)=>sum+Number(c.duration_minutes),0)})),plannedMinutes:[...lessons,...units].reduce((sum,l)=>sum+Number(l.duration_minutes),0),assignments,submissions,marks,quizzes:latest});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),b=await readJson(request),d=z.object({courseId:uuid,userId:uuid,label:z.string().trim().min(1).max(120),score:z.number().min(0).max(10000),maxScore:z.number().positive().max(10000),feedback:z.string().trim().max(6000)}).refine(d=>d.score<=d.maxScore,{message:'Marks cannot exceed the maximum.'}).parse(b),course=await coursePermission(d.courseId,user.userId,true),m=await membership(course.org_id,user.userId);
 if(m.kind!=='college')throw new AppError('Open a college subject.',403);
 if(!(await roster(d.courseId,d.userId,m.role==='teacher'?user.userId:undefined)).length)throw new AppError('Choose a student enrolled in this subject.',403);
 await run('INSERT INTO college_marks(id,course_id,user_id,label,score,max_score,feedback,graded_by) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE score=VALUES(score),max_score=VALUES(max_score),feedback=VALUES(feedback),graded_by=VALUES(graded_by),updated_at=UTC_TIMESTAMP(3)',[randomUUID(),d.courseId,d.userId,d.label,d.score,d.maxScore,d.feedback,user.userId]);return respond({ok:true});
}catch(e){return failure(e)}}
