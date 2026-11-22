import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {one,rows,run,transaction} from '@/lib/db';
import {identity,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {learningJourney,selectedResult} from '@/lib/learning-journey';
import {credentials,actor} from '@/modules/emis/server/context.mjs';
import {Store} from '@/modules/emis/server/store.mjs';
import {MySQLDatabase} from '@/modules/emis/server/database.mjs';
import {validatePolicy} from '@/lib/quiz-engine.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';
const id=z.string().uuid();
export async function GET(request:Request){try{
 const user=await identity(),q=new URL(request.url).searchParams,org=id.parse(q.get('org')),course=q.get('course')?id.parse(q.get('course')):undefined;
 return respond(await transaction(c=>learningJourney(org,user.userId,c,course)));
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),b=await readJson(request),base=z.object({org:id,courseId:id,action:z.enum(['approve','export','policy','school-internal'])}).parse(b);
 const answer=await transaction(async c=>{
  await one('SELECT id FROM organizations WHERE id=? FOR UPDATE',[base.org],c);
  await one('SELECT id FROM courses WHERE id=? AND org_id=? FOR UPDATE',[base.courseId,base.org],c);
  const report=await learningJourney(base.org,user.userId,c,base.courseId);
  if(!['admin','teacher'].includes(report.role))throw new AppError('Teaching access is required.',403);
  if(base.action==='policy'){
   let policy;try{policy=validatePolicy(b.policy);}catch(e){throw new AppError((e as Error).message)}
   await run('UPDATE courses SET grading_policy=? WHERE id=? AND org_id=?',[JSON.stringify(policy),base.courseId,base.org],c);
   await run('INSERT INTO learning_audit(org_id,actor_id,action,target_id) VALUES(?,?,?,?)',[base.org,user.userId,'grading-policy-updated',base.courseId],c);
   return {policy};
  }
  if(base.action==='school-internal'){
   // Weighted course grades become draft internal (practical) marks in EMIS. Published marks are never changed.
   if(report.role!=='admin'||report.kind!=='school')throw new AppError('A school administrator must send marks to EMIS.',403);
   const d=z.object({termId:z.string().min(1).max(64),subjectId:z.string().min(1).max(64)}).parse(b);
   const actual=await actor(c,base.org,credentials(request.headers.get('cookie'),base.org));
   if(!['Admin','Super Admin','Exam Coordinator'].includes(actual.role))throw new AppError('EMIS administrator or exam coordinator access is required.',403);
   const store=new Store(new MySQLDatabase(c,base.org,null,null)),term=await store.get(d.termId),subject=await store.get(d.subjectId);
   if(!term||term.entity!=='terms')throw new AppError('Choose an EMIS examination.',404);
   if(!subject||subject.entity!=='subjects'||!(Number(subject.practicalFull)>0))throw new AppError('Choose an EMIS subject that has internal (practical) marks.',404);
   if(subject.year!==term.year)throw new AppError('The subject and examination must be in the same academic year.');
   const course=report.courses.find(x=>x.id===base.courseId),sent:string[]=[],skipped:{name:string;reason:string}[]=[];
   for(const row of report.rows){
    if(row.weighted.percent===null){skipped.push({name:row.name,reason:'No released marks yet'});continue;}
    const enr=await rows("SELECT st.id,st.data FROM emis_roles er JOIN emis_student_links sl ON sl.org_id=er.org_id AND sl.person_id=er.student_person_id JOIN emis_records st ON st.org_id=sl.org_id AND st.id=sl.student_id WHERE er.org_id=? AND er.user_id=? AND st.entity='students' AND st.year=? AND st.archived=0",[base.org,row.userId,term.year],c);
    if(enr.length!==1){skipped.push({name:row.name,reason:enr.length?'More than one EMIS enrolment this year':'No linked EMIS student record'});continue;}
    const st=typeof enr[0].data==='string'?JSON.parse(enr[0].data):enr[0].data;
    if(st.classId!==subject.classId){skipped.push({name:row.name,reason:'Not in the class for this subject'});continue;}
    const practical=Math.min(Number(subject.practicalFull),Math.round(row.weighted.percent/100*Number(subject.practicalFull)*2)/2);
    const ex=await one("SELECT id FROM emis_records WHERE org_id=? AND entity='marks' AND archived=0 AND data->>'$.studentId'=? AND data->>'$.termId'=? AND data->>'$.subjectId'=?",[base.org,enr[0].id,d.termId,d.subjectId],c);
    const note=`Internal marks from Learning: ${course?.title||'course'} weighted grade ${row.weighted.percent}% → ${practical}/${subject.practicalFull}.`;
    try{
     if(ex){const old=await store.get(ex.id);if(old.status==='Published'){skipped.push({name:row.name,reason:'EMIS marks already published'});continue;}if(old.practical===practical){skipped.push({name:row.name,reason:'Already up to date'});continue;}await store.save(actual,'marks',{...old,practical,notes:note,status:'Draft'},old.id);}
     else await store.save(actual,'marks',{year:term.year,studentId:enr[0].id,termId:d.termId,subjectId:d.subjectId,practical,absent:'No',status:'Draft',notes:note});
     sent.push(row.name);
    }catch(e){skipped.push({name:row.name,reason:(e as Error).message});}
   }
   await run('INSERT INTO learning_audit(org_id,actor_id,action,target_id) VALUES(?,?,?,?)',[base.org,user.userId,'internal-marks-sent',base.courseId],c);
   return {sent:sent.length,skipped};
  }
  if(base.action==='approve'){
   const d=z.object({userId:id,label:z.string().trim().min(1).max(120),keys:z.array(z.string().min(1).max(100)).min(1).max(500),fingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).parse(b);
   const row=report.rows.find(r=>r.userId===d.userId);if(!row)throw new AppError('This learner is not in your current course roster.',403);
   if(row.fingerprint!==d.fingerprint)throw new AppError('Marks or submissions changed. Refresh the gradebook and review the new marks.',409);
   const result=selectedResult(row,d.keys),prior=await one('SELECT id,revision,label,source_digest FROM learning_results WHERE course_id=? AND user_id=? ORDER BY revision DESC LIMIT 1',[base.courseId,d.userId],c);
   if(prior?.source_digest===result.digest&&prior.label===d.label)return {id:prior.id,revision:prior.revision,existing:true};
   const resultId=randomUUID(),revision=Number(prior?.revision||0)+1;
   await run('INSERT INTO learning_results(id,course_id,user_id,revision,label,score,max_score,source_digest,snapshot,approved_by) VALUES(?,?,?,?,?,?,?,?,?,?)',[resultId,base.courseId,d.userId,revision,d.label,result.score,result.max,result.digest,JSON.stringify({keys:d.keys,items:result.items}),user.userId],c);
   await run('INSERT INTO learning_audit(org_id,actor_id,action,target_id) VALUES(?,?,?,?)',[base.org,user.userId,'learning-result-approved',resultId],c);
   return {id:resultId,revision};
  }
  if(report.role!=='admin'||!['school','college'].includes(report.kind))throw new AppError('An institution administrator must transfer results to EMIS.',403);
  const d=z.object({resultId:id,examId:z.string().min(1).max(64),expectedExamVersion:z.number().int().positive()}).parse(b);
  const row=report.rows.find(r=>r.result?.id===d.resultId);if(!row?.result)throw new AppError('Choose the latest approved result for a current learner.',409);
  const result=row.result;
  if(result.exported){if(result.exported.examId!==d.examId)throw new AppError('This result was already sent to another examination.',409);return {recordId:result.exported.recordId,year:result.exported.year,existing:true};}
  if(result.changed)throw new AppError('The selected source marks changed. Review and approve a new result before transferring.',409);
  const actual=await actor(c,base.org,credentials(request.headers.get('cookie'),base.org));
  if(!['Admin','Super Admin'].includes(actual.role))throw new AppError('EMIS administrator access is required.',403);
  const store=new Store(new MySQLDatabase(c,base.org,null,null)),exam=await store.get(d.examId);
  if(!exam||exam.entity!=='exams')throw new AppError('Choose an existing EMIS examination.',404);
  if(d.expectedExamVersion&&exam.version!==d.expectedExamVersion)throw new AppError('The examination changed. Refresh first.',409);
  const mapped=await one('SELECT sl.record_id FROM emis_subject_links sl JOIN courses lc ON lc.org_id=sl.org_id AND lc.subject_id=sl.subject_id WHERE sl.org_id=? AND sl.record_id=? AND lc.id=?',[base.org,exam.courseId,base.courseId],c);
  if(!mapped)throw new AppError('This examination is not linked to the same Learning subject. Publish the EMIS course to Learning first.');
  const enrollments=await rows("SELECT st.id,st.data FROM emis_roles er JOIN emis_student_links sl ON sl.org_id=er.org_id AND sl.person_id=er.student_person_id JOIN emis_records st ON st.org_id=sl.org_id AND st.id=sl.student_id WHERE er.org_id=? AND er.user_id=? AND st.entity='students' AND st.year=? AND st.archived=0",[base.org,row.userId,exam.year],c);
  if(!enrollments.length)throw new AppError('This learner needs a linked EMIS enrollment in the examination’s academic year.');
  if(enrollments.length!==1)throw new AppError('More than one EMIS enrollment is linked in this academic year. Resolve the duplicate enrollment in EMIS before transferring marks.',409);
  const enrollment=enrollments[0];
  const student=typeof enrollment.data==='string'?JSON.parse(enrollment.data):enrollment.data,course=await store.get(exam.courseId);
  if(student.status!=='Active'||student.programId!==course?.programId||Number(student.semester)!==Number(course?.semester))throw new AppError('The student must be active in the same EMIS program and semester as the examination.');
  const existing=await one("SELECT id FROM emis_records WHERE org_id=? AND entity='results' AND archived=0 AND data->>'$.studentId'=? AND data->>'$.examId'=?",[base.org,enrollment.id,d.examId],c);
  if(existing)throw new AppError('EMIS already has a result for this student and examination. Review it in Results & assessment; existing marks will not be overwritten.',409);
  const marks=Math.round(result.score/result.max*Number(exam.maxMarks)*100)/100;
  const value={studentId:enrollment.id,examId:d.examId,marks,standing:'Regular',status:'Draft',year:exam.year,notes:`Transferred from Learning: ${row.courseTitle}. ${result.label}, revision ${result.revision}: ${result.score}/${result.max}; scaled to ${exam.maxMarks}. Approval ${result.id}. Review before publishing.`};
  let clean;try{clean=await store.validate('results',value,null,actual);}catch(e){if((e as any).code)throw e;throw new AppError((e as Error).message,Number((e as any).status)||400);}
  const saved=await store.insertRaw('results',clean);
  await store.log(actual,'transferred approved Learning result','results',saved.id,null,saved);
  await run('INSERT INTO learning_result_exports(result_id,org_id,exam_id,student_id,record_id,exported_by) VALUES(?,?,?,?,?,?)',[result.id,base.org,d.examId,enrollment.id,saved.id,user.userId],c);
  return {recordId:saved.id,year:exam.year};
 });return respond(answer);
}catch(e){return failure(e)}}
