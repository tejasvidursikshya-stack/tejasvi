import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {rows,run} from '@/lib/db';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {coursePermission,learnerClause,teacherClause} from '@/lib/course-access';
import {liveClassInput} from '@/lib/live-class-policy';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await identity(),org=z.string().uuid().parse(new URL(request.url).searchParams.get('org')),m=await membership(org,user.userId),staff=['admin','teacher'].includes(m.role);
 if(!staff&&!['student','employee'].includes(m.role))throw new AppError('Learning access required.',403);
 const clause=m.role==='admin'?'1=1':m.role==='teacher'?teacherClause():`c.status='published' AND ${learnerClause()}`;
 const result=await rows(`SELECT l.*,c.title AS course_title FROM live_classes l JOIN courses c ON c.id=l.course_id WHERE c.org_id=? AND ${clause} ${staff?'':"AND l.status<>'draft'"} ORDER BY l.starts_at DESC LIMIT 500`,m.role==='admin'?[org]:[org,user.userId,user.userId]);
 return respond({sessions:result.map(r=>({id:r.id,courseId:r.course_id,courseTitle:r.course_title,title:r.title,agenda:r.agenda,meetingUrl:!staff&&r.status==='cancelled'?'':r.meeting_url,startsAt:new Date(r.starts_at.replace(' ','T')+'Z').toISOString(),endsAt:new Date(r.ends_at.replace(' ','T')+'Z').toISOString(),status:r.status,version:r.version})),limit:500});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),d=liveClassInput.parse(await readJson(request));await coursePermission(d.courseId,user.userId,true);
 const start=new Date(d.startsAt),end=new Date(d.endsAt);
 if(d.id){const result=await run('UPDATE live_classes SET title=?,agenda=?,meeting_url=?,starts_at=?,ends_at=?,status=?,version=version+1,updated_at=UTC_TIMESTAMP(3) WHERE id=? AND course_id=? AND version=?',[d.title,d.agenda,d.meetingUrl,start,end,d.status,d.id,d.courseId,d.version!]);if(!result.affectedRows)throw new AppError('Session changed or is unavailable. Refresh before editing.',409)}
 else await run('INSERT INTO live_classes(id,course_id,title,agenda,meeting_url,starts_at,ends_at,status,created_by) VALUES(?,?,?,?,?,?,?,?,?)',[randomUUID(),d.courseId,d.title,d.agenda,d.meetingUrl,start,end,d.status,user.userId]);
 return respond({ok:true});
}catch(e){return failure(e)}}
