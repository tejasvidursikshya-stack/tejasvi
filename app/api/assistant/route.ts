import {z} from 'zod';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {rows,run} from '@/lib/db';
import {aiAccess,providerFailure} from '@/lib/ai-access';
import {throttle} from '@/lib/auth';
import {coursePermission,learnerClause,teacherClause} from '@/lib/course-access';
import {assistantInstructions,tasksFor,responseText} from '@/lib/assistant';
export const runtime='nodejs';export const dynamic='force-dynamic';
const id=z.string().uuid();
async function courses(org:string,user:string,role:string){if(role==='parent')return [];const clause=role==='admin'?'':role==='teacher'?` AND ${teacherClause()}`:` AND c.status='published' AND ${learnerClause()}`;return rows(`SELECT c.id,c.title FROM courses c WHERE c.org_id=?${clause} ORDER BY c.title LIMIT 100`,[org,...(role==='admin'?[]:[user,user])]);}
export async function GET(request:Request){try{const user=await identity(),org=id.parse(new URL(request.url).searchParams.get('org')),m=await membership(org,user.userId);return respond({role:m.role,enabled:(await aiAccess(org,m.role)).access.text,tasks:tasksFor(m.role),courses:await courses(org,user.userId,m.role),orgId:org})}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),d=z.object({orgId:id,courseId:id.optional(),task:z.string().max(80),language:z.enum(['English','Nepali']),audience:z.string().trim().max(100),message:z.string().trim().min(1).max(4000),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(24000)})).max(12),confirm:z.literal(true)}).parse(await readJson(request,180000));
 const m=await membership(d.orgId,user.userId);if(!tasksFor(m.role).includes(d.task))throw new AppError('This task is not available for your account.',403);if(!(await aiAccess(d.orgId,m.role)).access.text)throw new AppError('Your administrator has not enabled AI for this workspace and role.',409);
 await throttle('assistant-user:'+user.userId,15);await throttle('assistant-org:'+d.orgId,60);await throttle('assistant-global',200);
 let context='',sources:{title:string}[]=[];
 if(d.courseId){const course=await coursePermission(d.courseId,user.userId);if(course.org_id!==d.orgId)throw new AppError('Course does not belong to this workspace.',403);const lessons=await rows('SELECT title,content FROM lessons WHERE course_id=? ORDER BY position,id LIMIT 12',[d.courseId]);sources=lessons.map(l=>({title:l.title}));context=JSON.stringify({course:course.title,description:course.description,lessons}).slice(0,16000);}
 let result;try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL,store:false,max_output_tokens:3500,instructions:assistantInstructions(m.role),input:JSON.stringify({task:d.task,language:d.language,audience:d.audience,courseExcerpts:context||'No course provided.',conversation:d.history.slice(-8),question:d.message})}),signal:AbortSignal.timeout(60000)});if(!response.ok)throw providerFailure(response.status);result=responseText(await response.json())}catch(e){throw new AppError(e instanceof Error&&e.name!=='TimeoutError'?e.message:'AI service timed out. Please try a shorter request.',502)}
 const current=await membership(d.orgId,user.userId);if(current.role!==m.role||!(await aiAccess(d.orgId,current.role)).access.text)throw new AppError('Your access changed. Reload the assistant.',403);if(d.courseId)await coursePermission(d.courseId,user.userId);
 await run('INSERT INTO learning_audit(org_id,actor_id,action) VALUES(?,?,?)',[d.orgId,user.userId,'ai-assistant']);return respond({answer:result,sources});
}catch(e){return failure(e)}}
