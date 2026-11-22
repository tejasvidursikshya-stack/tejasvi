import {z} from 'zod';
import {identity,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {one,run} from '@/lib/db';
import {coursePermission} from '@/lib/course-access';
const uuid=z.string().uuid();
async function access(id:string,user:string){const l=await one('SELECT course_id FROM lessons WHERE id=?',[id]);if(!l)throw new AppError('Lesson unavailable.',404);await coursePermission(l.course_id,user);}
export async function GET(request:Request){try{const u=await identity(),id=uuid.parse(new URL(request.url).searchParams.get('lesson'));await access(id,u.userId);return respond({note:await one('SELECT body,video_seconds FROM lesson_notes WHERE lesson_id=? AND user_id=?',[id,u.userId])});}catch(e){return failure(e)}}
export async function POST(request:Request){try{const u=await identity(),d=z.object({lessonId:uuid,body:z.string().max(12000),seconds:z.number().int().min(0).max(864000)}).parse(await readJson(request));await access(d.lessonId,u.userId);await run('INSERT INTO lesson_notes(lesson_id,user_id,body,video_seconds) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE body=VALUES(body),video_seconds=VALUES(video_seconds),updated_at=UTC_TIMESTAMP(3)',[d.lessonId,u.userId,d.body,d.seconds]);return respond({ok:true});}catch(e){return failure(e)}}
