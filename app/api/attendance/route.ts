import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {one,rows,run,transaction,type DB} from '@/lib/db';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {attendanceStates,attendanceSummary} from '@/lib/attendance-policy';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=z.string().uuid(),date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
async function access(batchId:string,subjectId:string,userId:string,edit=false,db?:DB){
 const batch=await one('SELECT * FROM batches WHERE id=?',[batchId],db);if(!batch)throw new AppError('Batch not found.',404);
 const m=await membership(batch.org_id,userId);if(m.kind==='corporate')throw new AppError('Attendance is available for schools and colleges.',403);
 if(!await one('SELECT 1 FROM batch_subjects WHERE batch_id=? AND subject_id=?',[batchId,subjectId],db))throw new AppError('Choose a subject offered in this batch.',403);
 if(m.role==='admin')return {batch,m,staff:true};
 if(m.role==='teacher'){
  if(!await one('SELECT 1 FROM teacher_assignments WHERE batch_id=? AND subject_id=? AND user_id=?',[batchId,subjectId,userId],db))throw new AppError('You are not assigned to this batch and subject.',403);
  return {batch,m,staff:true};
 }
 if(edit||m.role!=='student'||!await one('SELECT 1 FROM student_subjects WHERE batch_id=? AND subject_id=? AND user_id=?',[batchId,subjectId,userId],db))throw new AppError('You do not have access to this attendance register.',403);
 return {batch,m,staff:false};
}
export async function GET(request:Request){try{
 const user=await identity(),q=new URL(request.url).searchParams,bid=uuid.parse(q.get('batch')),sid=uuid.parse(q.get('subject')),{staff}=await access(bid,sid,user.userId);
 const day=date.parse(q.get('date')),period=z.coerce.number().int().min(1).max(20).parse(q.get('period')||1);
 const session=await one('SELECT * FROM attendance_sessions WHERE batch_id=? AND subject_id=? AND session_date=? AND period=?',[bid,sid,day,period]);
 const roster=staff?await rows("SELECT u.id,COALESCE(NULLIF(m.display_name,''),u.name) AS name,m.reference_number,p.admission_number FROM student_subjects ss JOIN batches b ON b.id=ss.batch_id JOIN memberships m ON m.org_id=b.org_id AND m.user_id=ss.user_id AND m.role='student' JOIN users u ON u.id=ss.user_id LEFT JOIN student_profiles p ON p.org_id=b.org_id AND p.user_id=u.id WHERE ss.batch_id=? AND ss.subject_id=? ORDER BY name,u.id",[bid,sid]):[];
 const records=session?await rows(`SELECT user_id,status,remark FROM attendance_records WHERE session_id=?${staff?'':' AND user_id=?'}`,staff?[session.id]:[session.id,user.userId]):[];
 const history=await rows(`SELECT s.session_date,s.period,s.topic,r.user_id,r.status,r.remark FROM attendance_sessions s JOIN attendance_records r ON r.session_id=s.id WHERE s.batch_id=? AND s.subject_id=?${staff?'':' AND r.user_id=?'} ORDER BY s.session_date DESC,s.period DESC,r.user_id LIMIT 10000`,staff?[bid,sid]:[bid,sid,user.userId]);
 return respond({staff,session,roster,records,history,summary:attendanceSummary(history.map(r=>({status:String(r.status)}))),historyLimit:10000});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),d=z.object({batchId:uuid,subjectId:uuid,date,period:z.number().int().min(1).max(20),version:z.number().int().min(0),topic:z.string().trim().max(200),records:z.array(z.object({userId:uuid,status:z.enum(attendanceStates),remark:z.string().trim().max(300)})).min(1).max(1000)}).parse(await readJson(request));
 await access(d.batchId,d.subjectId,user.userId,true);
 await transaction(async db=>{
  await one('SELECT id FROM batches WHERE id=? FOR UPDATE',[d.batchId],db);await access(d.batchId,d.subjectId,user.userId,true,db);
  const current=await one('SELECT * FROM attendance_sessions WHERE batch_id=? AND subject_id=? AND session_date=? AND period=? FOR UPDATE',[d.batchId,d.subjectId,d.date,d.period],db);
  if((current?.version||0)!==d.version)throw new AppError('This register changed. Reload before saving.',409);
  const roster=await rows("SELECT ss.user_id FROM student_subjects ss JOIN batches b ON b.id=ss.batch_id JOIN memberships m ON m.org_id=b.org_id AND m.user_id=ss.user_id AND m.role='student' WHERE ss.batch_id=? AND ss.subject_id=?",[d.batchId,d.subjectId],db),allowed=new Set(roster.map(r=>r.user_id));
  if(new Set(d.records.map(r=>r.userId)).size!==d.records.length||d.records.length!==allowed.size||d.records.some(r=>!allowed.has(r.userId)))throw new AppError('The student roster changed or contains invalid students. Reload the register.',409);
  const id=current?.id||randomUUID();
  if(current)await run('UPDATE attendance_sessions SET topic=?,version=version+1,updated_by=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',[d.topic,user.userId,id],db);
  else await run('INSERT INTO attendance_sessions(id,batch_id,subject_id,session_date,period,topic,updated_by) VALUES(?,?,?,?,?,?,?)',[id,d.batchId,d.subjectId,d.date,d.period,d.topic,user.userId],db);
  for(const r of d.records)await run('INSERT INTO attendance_records(session_id,user_id,status,remark) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),remark=VALUES(remark)',[id,r.userId,r.status,r.remark],db);
 });return respond({ok:true});
}catch(e){return failure(e)}}
