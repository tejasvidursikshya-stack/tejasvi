import {teacherResultClause} from '@/lib/course-policy';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {rows,one,run,transaction,type DB} from '@/lib/db';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {coursePermission} from '@/lib/course-access';
import {unitPermission} from '@/lib/unit-access';
import {throttle} from '@/lib/auth';
import {validateQuiz,validateSettings,isSimpleQuiz,normalizeQuestion,buildSession,learnerQuestion,scoreAttempt,review,quizRules,canStart,deadlineFor,answersVisible,unitLock,GRACE_MS,DEFAULT_SETTINGS} from '@/lib/quiz-engine.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
type R=Record<string,any>;
const uuid=z.string().uuid();
const schema=z.object({id:uuid.optional(),version:z.number().int().min(0),courseId:uuid,title:z.string().trim().min(1).max(160),position:z.number().int().min(1).max(1000),objectives:z.string().trim().max(5000),content:z.string().trim().max(20000),lessonPlan:z.string().trim().max(20000),duration:z.number().int().min(5).max(600),status:z.enum(['draft','published']),quiz:z.array(z.any()).max(50),quizSettings:z.any().optional(),releaseAt:z.string().max(40).nullable().optional(),prerequisiteUnitId:uuid.nullable().optional(),prerequisiteScore:z.number().int().min(1).max(100).nullable().optional()});
const parsed=(value:any)=>typeof value==='string'?JSON.parse(value):value;
const iso=(v:any)=>v?new Date(String(v).replace(' ','T')+(String(v).endsWith('Z')?'':'Z')).toISOString():null;
const settingsOf=(u:R)=>({...DEFAULT_SETTINGS,...(parsed(u.quiz_settings)||{})});
const quizOf=(u:R)=>(parsed(u.quiz)||[]).map(normalizeQuestion);
const lockShape=(u:R)=>({releaseAt:iso(u.release_at),prerequisiteUnitId:u.prerequisite_unit_id||null,prerequisiteScore:u.prerequisite_score??null});
async function learnerState(courseId:string,userId:string,db?:DB){
 const done=new Set((await rows('SELECT uc.unit_id FROM unit_completions uc JOIN course_units cu ON cu.id=uc.unit_id WHERE cu.course_id=? AND uc.user_id=?',[courseId,userId],db)).map(r=>r.unit_id));
 const best=new Map<string,number>();
 for(const a of await rows('SELECT a.unit_id,MAX(a.score) best,COUNT(*) n FROM unit_quiz_attempts a JOIN course_units cu ON cu.id=a.unit_id WHERE cu.course_id=? AND a.user_id=? GROUP BY a.unit_id',[courseId,userId],db)){best.set(a.unit_id,Number(a.best));done.add(a.unit_id);}
 return {done,best};
}
async function lockFor(unit:R,userId:string,db?:DB){
 const state=await learnerState(unit.course_id,userId,db),titles=new Map((await rows('SELECT id,title FROM course_units WHERE course_id=?',[unit.course_id],db)).map(r=>[r.id,r.title]));
 return unitLock(lockShape(unit),{...state,titles});
}
async function extensionFor(unitId:string,userId:string,db?:DB){
 const e=await one('SELECT extra_minutes,extra_attempts,closes_at FROM quiz_extensions WHERE unit_id=? AND user_id=?',[unitId,userId],db);
 return e?{extraMinutes:Number(e.extra_minutes),extraAttempts:Number(e.extra_attempts),closesAt:iso(e.closes_at)}:null;
}
/** Hands in an attempt whose time ran out, using the answers saved while it was open. */
async function finishSession(session:R,db:DB){
 const served=parsed(session.served),answers=parsed(session.answers)||{},result=scoreAttempt(served,answers),attemptId=randomUUID();
 await run('INSERT INTO unit_quiz_attempts(id,unit_id,user_id,quiz_revision,score,answers) VALUES(?,?,?,?,?,?)',[attemptId,session.unit_id,session.user_id,session.quiz_revision,result.score,JSON.stringify({session:session.id,answers,results:result.results,earned:result.earned,max:result.max})],db);
 await run('UPDATE quiz_sessions SET submitted_at=UTC_TIMESTAMP(3),attempt_id=? WHERE id=?',[attemptId,session.id],db);
 return {attemptId,...result};
}
const expired=(s:R,now=Date.now())=>s.deadline_at&&now>Date.parse(iso(s.deadline_at)!)+GRACE_MS;

export async function GET(request:Request){try{
 const user=await identity(),cid=uuid.parse(new URL(request.url).searchParams.get('course')),course=await coursePermission(cid,user.userId),member=await membership(course.org_id,user.userId),staff=['admin','teacher'].includes(member.role);
 const units=await rows(`SELECT * FROM course_units WHERE course_id=?${staff?'':" AND status='published'"} ORDER BY position,created_at,id`,[cid]);
 const attempts=await rows(`SELECT a.id,a.unit_id,a.user_id,a.quiz_revision,a.score,a.submitted_at,u.name FROM unit_quiz_attempts a JOIN course_units cu ON cu.id=a.unit_id JOIN users u ON u.id=a.user_id WHERE cu.course_id=?${!staff?" AND cu.status='published' AND a.user_id=?":member.role==='teacher'?` AND ${teacherResultClause('cu.course_id','a.user_id')}`:''} ORDER BY a.submitted_at DESC,a.id DESC LIMIT 1000`,!staff?[cid,user.userId]:member.role==='teacher'?[cid,user.userId,user.userId]:[cid]);
 const completed=await rows('SELECT uc.unit_id FROM unit_completions uc JOIN course_units cu ON cu.id=uc.unit_id WHERE cu.course_id=? AND uc.user_id=?',[cid,user.userId]);
 const titles=new Map(units.map(u=>[u.id,u.title]));
 if(staff){
  const extensions=await rows('SELECT e.unit_id,e.user_id,e.extra_minutes,e.extra_attempts,e.closes_at,e.reason,u.name FROM quiz_extensions e JOIN course_units cu ON cu.id=e.unit_id JOIN users u ON u.id=e.user_id WHERE cu.course_id=? ORDER BY u.name',[cid]);
  const learners=await rows("SELECT DISTINCT u.id,COALESCE(NULLIF(m.display_name,''),u.name) name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.role IN ('student','employee') ORDER BY name LIMIT 2000",[course.org_id]);
  return respond({staff,org:course.org_id,courseOrg:course.org_id,kind:member.kind,units:units.map(u=>({id:u.id,title:u.title,position:u.position,objectives:u.objectives,content:u.content,duration:u.duration_minutes,status:u.status,version:u.version,quizRevision:u.quiz_revision,lessonPlan:u.lesson_plan,quiz:quizOf(u),quizSettings:settingsOf(u),...lockShape(u),completed:completed.some(c=>c.unit_id===u.id)})),attempts,extensions:extensions.map(e=>({...e,closes_at:iso(e.closes_at)})),learners});
 }
 const state=await learnerState(cid,user.userId),sessions=await rows('SELECT s.id,s.unit_id,s.deadline_at FROM quiz_sessions s JOIN course_units cu ON cu.id=s.unit_id WHERE cu.course_id=? AND s.user_id=? AND s.submitted_at IS NULL',[cid,user.userId]);
 const exts=new Map((await rows('SELECT e.* FROM quiz_extensions e JOIN course_units cu ON cu.id=e.unit_id WHERE cu.course_id=? AND e.user_id=?',[cid,user.userId])).map(e=>[e.unit_id,{extraMinutes:Number(e.extra_minutes),extraAttempts:Number(e.extra_attempts),closesAt:iso(e.closes_at)}]));
 const out=units.map(u=>{
  const lock=unitLock(lockShape(u),{...state,titles}),base={id:u.id,title:u.title,position:u.position,duration:u.duration_minutes,status:u.status,version:u.version,completed:completed.some(c=>c.unit_id===u.id),...lockShape(u)};
  if(lock)return {...base,locked:lock,objectives:'',content:'',quiz:[],quizRevision:u.quiz_revision,quizMode:'none'};
  const quiz=quizOf(u),settings=settingsOf(u),simple=isSimpleQuiz(quiz,settings),rules=quizRules(settings,exts.get(u.id)),used=attempts.filter(a=>a.unit_id===u.id).length,active=sessions.find(s=>s.unit_id===u.id&&!expired(s));
  const count=quiz.length+(settings.draw?.count||0);
  return {...base,objectives:u.objectives,content:u.content,quizRevision:u.quiz_revision,quizMode:!count?'none':simple?'simple':'advanced',
   quiz:simple?quiz.map((q:R)=>({id:q.id,prompt:q.prompt,options:q.options})):[],
   quizInfo:count?{count,timeLimit:rules.minutes,maxAttempts:rules.maxAttempts,used,opensAt:rules.opensAt,closesAt:rules.closesAt,open:rules.open,blocked:canStart(rules,used),passMark:settings.passMark,showAnswers:settings.showAnswers,activeSession:active?{id:active.id,deadline:iso(active.deadline_at)}:null}:null};
 });
 return respond({staff,kind:member.kind,units:out,attempts});
}catch(e){return failure(e)}}

export async function POST(request:Request){try{
 const user=await identity(),body=await readJson(request),action=z.enum(['save','quiz','complete','quiz-start','quiz-save','quiz-submit','extension','extension-remove']).parse(body.action);
 if(action==='save'){
  const d=schema.parse(body);await coursePermission(d.courseId,user.userId,true);
  let quiz,settings;try{quiz=validateQuiz(d.quiz);settings=validateSettings(d.quizSettings||{});}catch(e){throw new AppError((e as Error).message)}
  const releaseAt=d.releaseAt?new Date(d.releaseAt):null;if(releaseAt&&!Number.isFinite(releaseAt.getTime()))throw new AppError('Choose a valid release date.');
  if(d.status==='published'&&!d.content&&!quiz.length&&!settings.draw&&(!d.id||(!await one("SELECT id FROM course_materials WHERE course_id=? AND unit_id=? AND visibility='learners' LIMIT 1",[d.courseId,d.id])&&!await one('SELECT id FROM assessments WHERE course_id=? AND unit_id=? LIMIT 1',[d.courseId,d.id]))))throw new AppError('Add learning content, a resource, quiz or assignment before publishing.');
  const id=d.id||randomUUID();await transaction(async db=>{
   const old=d.id?await one('SELECT * FROM course_units WHERE id=? AND course_id=? FOR UPDATE',[id,d.courseId],db):null;
   if(d.id&&!old)throw new AppError('Unit not found.',404);
   if(old&&old.version!==d.version)throw new AppError('This unit changed in another window. Reload before saving.',409);
   const prereq=d.prerequisiteUnitId||null;
   if(prereq){
    if(prereq===id)throw new AppError('A unit cannot be its own prerequisite.');
    const all=new Map((await rows('SELECT id,prerequisite_unit_id p FROM course_units WHERE course_id=?',[d.courseId],db)).map(r=>[r.id,r.p]));
    if(!all.has(prereq))throw new AppError('Choose a prerequisite unit from this course.');
    for(let cur:any=prereq,i=0;cur&&i<1000;cur=all.get(cur),i++)if(cur===id)throw new AppError('These prerequisites would lock each other. Choose a different unit.');
   }
   const quizJson=JSON.stringify(quiz),settingsJson=JSON.stringify(settings);
   const revision=old&&JSON.stringify(parsed(old.quiz))===quizJson&&JSON.stringify(parsed(old.quiz_settings)||null)===settingsJson?old.quiz_revision:randomUUID();
   const values=[d.title,d.position,d.objectives,d.content,d.lessonPlan,d.duration,d.status,quizJson,revision,settingsJson,releaseAt,prereq,prereq?d.prerequisiteScore??null:null];
   if(old)await run('UPDATE course_units SET title=?,position=?,objectives=?,content=?,lesson_plan=?,duration_minutes=?,status=?,quiz=?,quiz_revision=?,quiz_settings=?,release_at=?,prerequisite_unit_id=?,prerequisite_score=?,version=version+1 WHERE id=?',[...values,id],db);
   else await run('INSERT INTO course_units(title,position,objectives,content,lesson_plan,duration_minutes,status,quiz,quiz_revision,quiz_settings,release_at,prerequisite_unit_id,prerequisite_score,id,course_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[...values,id,d.courseId],db);
  });return respond({id},201);
 }
 const id=uuid.parse(body.unitId),{unit,course,member,staff}=await unitPermission(id,user.userId,['extension','extension-remove'].includes(action));
 if(action==='extension'||action==='extension-remove'){
  if(!staff)throw new AppError('Teaching access is required.',403);
  const target=uuid.parse(body.userId),learner=await one("SELECT user_id FROM memberships WHERE org_id=? AND user_id=? AND role IN ('student','employee')",[course.org_id,target]);
  if(!learner)throw new AppError('Choose a learner in this organization.');
  if(action==='extension-remove'){await run('DELETE FROM quiz_extensions WHERE unit_id=? AND user_id=?',[id,target]);return respond({ok:true});}
  const d=z.object({extraMinutes:z.number().int().min(0).max(600),extraAttempts:z.number().int().min(0).max(20),closesAt:z.string().max(40).nullable(),reason:z.string().trim().max(300)}).parse(body);
  const closes=d.closesAt?new Date(d.closesAt):null;if(closes&&!Number.isFinite(closes.getTime()))throw new AppError('Choose a valid closing date.');
  await run('INSERT INTO quiz_extensions(unit_id,user_id,extra_minutes,extra_attempts,closes_at,reason,granted_by) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE extra_minutes=VALUES(extra_minutes),extra_attempts=VALUES(extra_attempts),closes_at=VALUES(closes_at),reason=VALUES(reason),granted_by=VALUES(granted_by)',[id,target,d.extraMinutes,d.extraAttempts,closes,d.reason,user.userId]);
  await run('INSERT INTO learning_audit(org_id,actor_id,action,target_id) VALUES(?,?,?,?)',[course.org_id,user.userId,'quiz-extension',id]);
  return respond({ok:true});
 }
 if(!['student','employee'].includes(member.role))throw new AppError('Use a learner account for this action.',403);
 const lock=await lockFor(unit,user.userId);if(lock)throw new AppError(lock.reason+'.',403);
 if(action==='complete'){await run('INSERT IGNORE INTO enrollments(course_id,user_id) VALUES(?,?)',[course.id,user.userId]);await run('INSERT IGNORE INTO unit_completions(unit_id,user_id) VALUES(?,?)',[id,user.userId]);return respond({ok:true})}
 if(action==='quiz'){
  // The original flow, still used by the mobile app for simple quizzes.
  await throttle('unit-quiz:'+user.userId,20);
  const answers=z.array(z.number().int().min(0).max(3)).max(30).parse(body.answers),revision=uuid.parse(body.quizRevision);
  const result=await transaction(async db=>{
   const current=await one('SELECT * FROM course_units WHERE id=? FOR UPDATE',[unit.id],db);
   if(!current||current.status!=='published')throw new AppError('This unit is no longer published.',403);
   if(current.quiz_revision!==revision)throw new AppError('The quiz changed. Reload it before submitting.',409);
   const qs=quizOf(current);if(!isSimpleQuiz(qs,settingsOf(current)))throw new AppError('This quiz has exam rules or new question types. Open it on the Tejasvi website.',409);
   if(!qs.length||answers.length!==qs.length)throw new AppError('Answer every question.');
   const score=Math.round(100*qs.filter((q:R,i:number)=>q.correct===answers[i]).length/qs.length);
   await run('INSERT IGNORE INTO enrollments(course_id,user_id) VALUES(?,?)',[course.id,user.userId],db);
   await run('INSERT INTO unit_quiz_attempts(id,unit_id,user_id,quiz_revision,score,answers) VALUES(?,?,?,?,?,?)',[randomUUID(),unit.id,user.userId,revision,score,JSON.stringify(answers)],db);return {score};
  });return respond(result);
 }
 if(action==='quiz-start'){
  await throttle('unit-quiz-start:'+user.userId,30);
  const result=await transaction(async db=>{
   const current=await one('SELECT * FROM course_units WHERE id=? FOR UPDATE',[unit.id],db);
   if(!current||current.status!=='published')throw new AppError('This unit is no longer published.',403);
   const settings=settingsOf(current),rules=quizRules(settings,await extensionFor(id,user.userId,db));
   for(const s of await rows('SELECT * FROM quiz_sessions WHERE unit_id=? AND user_id=? AND submitted_at IS NULL FOR UPDATE',[id,user.userId],db)){
    if(!expired(s))return {sessionId:s.id,deadline:iso(s.deadline_at),questions:parsed(s.served).map(learnerQuestion),answers:parsed(s.answers)||{},resumed:true};
    await finishSession(s,db);
   }
   const used=Number((await one('SELECT COUNT(*) n FROM unit_quiz_attempts WHERE unit_id=? AND user_id=?',[id,user.userId],db))!.n),blocked=canStart(rules,used);
   if(blocked)throw new AppError(blocked,403);
   const bank=settings.draw?(await rows('SELECT id,tags,difficulty,question FROM question_bank WHERE org_id=? AND archived=0 AND (course_id IS NULL OR course_id=?)',[course.org_id,course.id],db)).map(b=>({...b,tags:String(b.tags||'').split(',').filter(Boolean),question:parsed(b.question)})):[];
   let served;try{served=buildSession(quizOf(current),settings,bank,randomUUID());}catch(e){throw new AppError((e as Error).message,409)}
   const sessionId=randomUUID(),now=new Date(),deadline=deadlineFor(rules,now.toISOString());
   await run('INSERT IGNORE INTO enrollments(course_id,user_id) VALUES(?,?)',[course.id,user.userId],db);
   await run('INSERT INTO quiz_sessions(id,unit_id,user_id,quiz_revision,served,started_at,deadline_at) VALUES(?,?,?,?,?,?,?)',[sessionId,id,user.userId,current.quiz_revision,JSON.stringify(served),now,deadline?new Date(deadline):null],db);
   return {sessionId,deadline,questions:(served as any[]).map(learnerQuestion),answers:{}};
  });return respond(result,201);
 }
 const sessionId=uuid.parse(body.sessionId),answers=z.record(z.string().max(64),z.any()).refine(a=>Object.keys(a).length<=60&&JSON.stringify(a).length<=40000,'Too many answers.').parse(body.answers||{});
 if(action==='quiz-save'){
  await throttle('unit-quiz-save:'+user.userId,240);
  const r=await run('UPDATE quiz_sessions SET answers=? WHERE id=? AND unit_id=? AND user_id=? AND submitted_at IS NULL',[JSON.stringify(answers),sessionId,id,user.userId]);
  return respond({saved:r.affectedRows===1});
 }
 // quiz-submit
 await throttle('unit-quiz:'+user.userId,20);
 const result=await transaction(async db=>{
  const s=await one('SELECT * FROM quiz_sessions WHERE id=? AND unit_id=? AND user_id=? FOR UPDATE',[sessionId,id,user.userId],db);
  if(!s)throw new AppError('This attempt was not found. Start the quiz again.',404);
  if(s.submitted_at)throw new AppError('This attempt was already handed in.',409);
  const current=await one('SELECT * FROM course_units WHERE id=?',[id],db),settings=settingsOf(current!),rules=quizRules(settings,await extensionFor(id,user.userId,db));
  const late=expired(s);
  if(!late)await run('UPDATE quiz_sessions SET answers=? WHERE id=?',[JSON.stringify(answers),s.id],db);
  const done=await finishSession(late?s:{...s,answers},db),served=parsed(s.served),given=late?parsed(s.answers)||{}:answers;
  const used=Number((await one('SELECT COUNT(*) n FROM unit_quiz_attempts WHERE unit_id=? AND user_id=?',[id,user.userId],db))!.n);
  return {score:done.score,earned:done.earned,max:done.max,late,passed:settings.passMark?done.score>=settings.passMark:null,attemptsLeft:rules.maxAttempts?Math.max(0,rules.maxAttempts-used):null,review:answersVisible(settings,rules)?review(served,given,done.results):null};
 });return respond(result);
}catch(e){return failure(e)}}
