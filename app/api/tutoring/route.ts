import {z} from 'zod';
import {identity,membership,AppError,respond,failure,readJson} from '@/lib/platform-server';
import {coursePermission,teacherClause} from '@/lib/course-access';
import {one,rows,run,transaction,type DB} from '@/lib/db';
import {cardLimit,type TeacherCard} from '@/lib/tutoring';
const uuid=z.string().uuid(),rev=z.number().int().positive(),kind=z.enum(['cue','flash']),theme=z.enum(['ocean','amber','iris']);
const card=z.object({front:z.string().trim().min(1).max(800),back:z.string().trim().min(1).max(1800),note:z.string().trim().max(800).default('')}).strict();
const base={org:uuid,id:uuid};
const mutation=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('save'),revision:z.number().int().min(0),kind,theme,title:z.string().trim().min(1).max(140),cards:z.array(card).min(1).max(cardLimit)}),
 z.object({...base,action:z.literal('share'),revision:rev,course:uuid}),
 z.object({...base,action:z.literal('withdraw'),revision:rev,course:uuid}),z.object({...base,action:z.literal('remove'),revision:rev})]);
const parse=<T,>(v:unknown):T=>typeof v==='string'?JSON.parse(v):v as T;
async function staff(org:string,uid:string){
 const m=await membership(org,uid);if(m.role!=='admin'&&m.role!=='teacher')throw new AppError('Teaching access is required.',403);return m;
}
async function mine(org:string,id:string,uid:string,db?:DB,lock=false) {
 const d=await one('SELECT id,title,kind,theme,revision,cards_json FROM tutoring_decks WHERE id=? AND org_id=? AND author_id=?'+(lock?' FOR UPDATE':''),[id,org,uid],db);
 if(!d)throw new AppError('This tutoring deck is not available in your library.',404);return d;
}
const conflict=()=>new AppError('This deck changed in another window. Reopen the saved deck before updating it.',409);
export async function GET(req:Request){try{
 const {userId}=await identity(),q=new URL(req.url).searchParams;
 // A separate publication contains only the two learner-facing fields.
 if(q.has('course')){
  const course=uuid.parse(q.get('course')),id=uuid.parse(q.get('deck')),c=await coursePermission(course,userId);
  if(c.status!=='published')throw new AppError('This course is not published.',404);
  const d=await one('SELECT title,theme,cards_json FROM tutoring_course_decks WHERE deck_id=? AND course_id=?',[id,course]);
  if(!d)throw new AppError('This flashcard set is no longer shared with this course.',404);
  return respond({title:d.title,theme:d.theme,cards:parse<TeacherCard[]>(d.cards_json).map(({front,back})=>({front,back}))});
 }
 const org=uuid.parse(q.get('org')),m=await staff(org,userId);
 if(q.has('deck')){
  const id=uuid.parse(q.get('deck')),d=await mine(org,id,userId);
  const shares=await rows('SELECT c.id,c.title,s.revision FROM tutoring_course_decks s JOIN courses c ON c.id=s.course_id WHERE s.deck_id=? AND c.org_id=? ORDER BY c.title',[id,org]);
  return respond({deck:{id:d.id,title:d.title,kind:d.kind,theme:d.theme,revision:d.revision,cards:parse(d.cards_json)},shares});
 }
 const decks=await rows('SELECT d.id,d.title,d.kind,d.theme,d.revision,JSON_LENGTH(d.cards_json) AS size,(SELECT COUNT(*) FROM tutoring_course_decks s WHERE s.deck_id=d.id) AS shared FROM tutoring_decks d WHERE d.org_id=? AND d.author_id=? ORDER BY d.updated_at DESC,d.id',[org,userId]);
 const courses=await rows('SELECT c.id,c.title FROM courses c WHERE c.org_id=? AND c.status=\'published\''+(m.role==='admin'?'':' AND '+teacherClause())+' ORDER BY c.title,c.id',m.role==='admin'?[org]:[org,userId,userId]);
 return respond({decks,courses});
}catch(e){return failure(e)}}
export async function POST(req:Request){try{
 const {userId}=await identity(),v=mutation.parse(await readJson(req,650000));await staff(v.org,userId);
 const result=await transaction(async db=>{
  if(v.action==='save'&&v.revision===0){
   await run('INSERT INTO tutoring_decks(id,org_id,author_id,kind,title,theme,cards_json) VALUES(?,?,?,?,?,?,?)',[v.id,v.org,userId,v.kind,v.title,v.theme,JSON.stringify(v.cards)],db);return {revision:1};
  }
  const d=await mine(v.org,v.id,userId,db,true);if(d.revision!==v.revision)throw conflict();
  if(v.action==='save'){
   if(d.kind!==v.kind)throw new AppError('Create a new deck to change the card type.');
   await run('UPDATE tutoring_decks SET title=?,theme=?,cards_json=?,revision=revision+1 WHERE id=?',[v.title,v.theme,JSON.stringify(v.cards),v.id],db);return {revision:v.revision+1};
  }
  if(v.action==='remove'){
   if(await one('SELECT deck_id FROM tutoring_course_decks WHERE deck_id=? LIMIT 1',[v.id],db))throw new AppError('Withdraw course copies before deleting this deck.',409);
   await run('DELETE FROM tutoring_decks WHERE id=?',[v.id],db);return {removed:true};
  }
  if(v.action==='withdraw'){await run('DELETE FROM tutoring_course_decks WHERE deck_id=? AND course_id=?',[v.id,v.course],db);return {withdrawn:true};}
  if(d.kind!=='flash')throw new AppError('Cue cards are private to the presenter.',403);
  const c=await coursePermission(v.course,userId,true,db);
  if(c.org_id!==v.org||c.status!=='published')throw new AppError('Choose a published course you teach in this workspace.',403);
  const clean=parse<TeacherCard[]>(d.cards_json).map(({front,back})=>({front,back})),values=[d.title,d.theme,JSON.stringify(clean),d.revision];
  await run('INSERT INTO tutoring_course_decks(deck_id,course_id,title,theme,cards_json,revision) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE title=?,theme=?,cards_json=?,revision=?,shared_at=CURRENT_TIMESTAMP(3)',[v.id,v.course,...values,...values],db);return {shared:true};
 });return respond(result);
}catch(e){return failure(e)}}
