import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {rows,one,run,transaction} from '@/lib/db';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {coursePermission} from '@/lib/course-access';
import {validateQuestion,DIFFICULTY} from '@/lib/quiz-engine.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=z.string().uuid();
const parsed=(v:any)=>typeof v==='string'?JSON.parse(v):v;
const tagList=(v:unknown)=>[...new Set((Array.isArray(v)?v:String(v||'').split(',')).map(t=>String(t).trim().toLowerCase().replace(/[^a-z0-9ऀ-ॿ ._-]/g,'')).filter(Boolean))].slice(0,12);
async function staff(org:string,userId:string){const m=await membership(org,userId);if(!['admin','teacher'].includes(m.role))throw new AppError('Teaching access is required.',403);return m;}
export async function GET(request:Request){try{
 const user=await identity(),q=new URL(request.url).searchParams,org=uuid.parse(q.get('org'));await staff(org,user.userId);
 const items=await rows("SELECT b.id,b.course_id courseId,b.tags,b.difficulty,b.question,b.created_by createdBy,b.updated_at updatedAt,u.name author,c.title courseTitle FROM question_bank b JOIN users u ON u.id=b.created_by LEFT JOIN courses c ON c.id=b.course_id WHERE b.org_id=? AND b.archived=0 ORDER BY b.updated_at DESC LIMIT 2000",[org]);
 return respond({items:items.map(i=>({...i,tags:String(i.tags||'').split(',').filter(Boolean),question:parsed(i.question)})),me:user.userId});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),b=await readJson(request),base=z.object({org:uuid,action:z.enum(['save','delete','import'])}).parse(b),m=await staff(base.org,user.userId);
 const meta=z.object({courseId:uuid.nullable().optional(),tags:z.any().optional(),difficulty:z.enum(DIFFICULTY as [string,...string[]]).default('medium')}).parse(b);
 if(meta.courseId){const c=await coursePermission(meta.courseId,user.userId);if(c.org_id!==base.org)throw new AppError('Choose a course in this organization.');}
 const tags=tagList(meta.tags).join(','),clean=(q:unknown,n=1)=>{try{return validateQuestion(q,n)}catch(e){throw new AppError((e as Error).message)}};
 if(base.action==='import'){
  const list=z.array(z.any()).min(1).max(50).parse(b.questions);let added=0;
  await transaction(async db=>{for(const [i,q] of list.entries()){const question={...clean(q,i+1),id:randomUUID()};await run('INSERT INTO question_bank(id,org_id,course_id,tags,difficulty,question,created_by) VALUES(?,?,?,?,?,?,?)',[question.id,base.org,meta.courseId||null,tags,meta.difficulty,JSON.stringify(question),user.userId],db);added++;}});
  return respond({added},201);
 }
 const id=b.id?uuid.parse(b.id):null,old=id?await one('SELECT created_by FROM question_bank WHERE id=? AND org_id=? AND archived=0',[id,base.org]):null;
 if(id&&!old)throw new AppError('Question not found.',404);
 if(old&&m.role!=='admin'&&old.created_by!==user.userId)throw new AppError('Only the author or an administrator can change this question.',403);
 if(base.action==='delete'){await run('UPDATE question_bank SET archived=1 WHERE id=?',[id]);return respond({ok:true});}
 const question=clean(b.question),qid=id||question.id||randomUUID(),value={...question,id:qid};
 if(id)await run('UPDATE question_bank SET course_id=?,tags=?,difficulty=?,question=? WHERE id=?',[meta.courseId||null,tags,meta.difficulty,JSON.stringify(value),id]);
 else{if(await one('SELECT id FROM question_bank WHERE id=?',[qid]))throw new AppError('This question is already in the bank.',409);await run('INSERT INTO question_bank(id,org_id,course_id,tags,difficulty,question,created_by) VALUES(?,?,?,?,?,?,?)',[qid,base.org,meta.courseId||null,tags,meta.difficulty,JSON.stringify(value),user.userId]);}
 return respond({id:qid},id?200:201);
}catch(e){return failure(e)}}
