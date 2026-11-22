import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {identity,membership,requireAdmin,AppError,readJson,respond,failure} from '@/lib/platform-server';
import {one,rows,run,transaction,type DB} from '@/lib/db';
import {syncMember} from '@/lib/campus-data.mjs';
import {supportedCampus} from '@/lib/shared-student-directory';
import {hashPassword} from '@/lib/password';
export const runtime='nodejs';
const uuid=z.string().uuid(),record=z.string().min(1).max(64),base={orgId:uuid};
const cmd=z.discriminatedUnion('action',[
 z.object({...base,action:z.literal('activate'),recordId:record,version:z.number().int().positive(),email:z.string().trim().email().max(200).transform(v=>v.toLowerCase()),useExisting:z.boolean()}),
 z.object({...base,action:z.literal('place'),userId:uuid,batchId:uuid,subjectIds:z.array(uuid).max(100)})
]);
async function log(c:DB,org:string,actor:{userId:string;displayName:string},action:string,rec:string,info:object){await run('INSERT INTO emis_audit(org_id,actor,actor_id,action,entity,record_id,after_data,created_at) VALUES(?,?,?,?,?,?,?,?)',[org,actor.displayName,actor.userId,action,'students',rec,JSON.stringify(info),new Date().toISOString()],c);}
export async function POST(req:Request){try{
 const actor=await identity(),body=cmd.parse(await readJson(req,16000)),org=body.orgId,m=await membership(org,actor.userId);requireAdmin(m);if(!supportedCampus(m.kind))throw new AppError('Open a school or college workspace.',403);
 const result=await transaction(async c=>{
  await one('SELECT id FROM organizations WHERE id=? FOR UPDATE',[org],c);
  if(!await one("SELECT user_id FROM institution_memberships WHERE org_id=? AND user_id=? AND active=1 AND role='admin' FOR UPDATE",[org,actor.userId],c))throw new AppError('Institution administrator access is required.',403);
  if(body.action==='place'){
   const learner=await one("SELECT m.user_id,er.student_person_id FROM institution_memberships m LEFT JOIN emis_roles er ON er.org_id=m.org_id AND er.user_id=m.user_id WHERE m.org_id=? AND m.user_id=? AND m.role='student' AND m.active=1 FOR UPDATE",[org,body.userId],c);
   if(!learner)throw new AppError('Choose an active student login from this institution.',403);
   if(learner.student_person_id&&!await one("SELECT r.id FROM emis_student_links sl JOIN emis_records r ON r.org_id=sl.org_id AND r.id=sl.student_id JOIN emis_campuses ec ON ec.org_id=r.org_id WHERE sl.org_id=? AND sl.person_id=? AND r.entity='students' AND r.archived=0 AND r.year=ec.profile->>'$.year' AND r.data->>'$.status'='Active' FOR UPDATE",[org,learner.student_person_id],c))throw new AppError('An active enrollment for the current academic year is required.',409);
   const batch=await one('SELECT id,grade_id FROM batches WHERE org_id=? AND id=? FOR UPDATE',[org,body.batchId],c);if(!batch)throw new AppError('Choose a class or intake in this institution.',403);
   const choices=new Set((await rows('SELECT bs.subject_id id FROM batch_subjects bs JOIN subjects s ON s.id=bs.subject_id AND s.org_id=? WHERE bs.batch_id=? AND (s.college_semester_id IS NULL OR s.college_semester_id=?) FOR UPDATE',[org,batch.id,batch.grade_id],c)).map(v=>v.id));
   const selected=[...new Set(body.subjectIds)];if(selected.some(s=>!choices.has(s)))throw new AppError('Each chosen subject must be offered in this class or intake.',400);
   await run('INSERT IGNORE INTO batch_members(batch_id,user_id) VALUES(?,?)',[batch.id,body.userId],c);for(const s of selected)await run('INSERT IGNORE INTO student_subjects(batch_id,subject_id,user_id) VALUES(?,?,?)',[batch.id,s,body.userId],c);
   await log(c,org,actor,'assigned Learning class',body.userId,{batchId:batch.id,subjects:selected});return {ok:true};
  }
  const r=await one("SELECT r.id,r.data,r.version,r.year,sl.person_id,ec.profile->>'$.year' currentYear FROM emis_records r JOIN emis_campuses ec ON ec.org_id=r.org_id LEFT JOIN emis_student_links sl ON sl.org_id=r.org_id AND sl.student_id=r.id WHERE r.org_id=? AND r.id=? AND r.entity='students' AND r.archived=0 FOR UPDATE",[org,body.recordId],c);
  if(!r)throw new AppError('Enrollment not found in this institution.',404);
  const v=typeof r.data==='string'?JSON.parse(r.data):r.data;
  if(r.year!==r.currentYear||v.status!=='Active')throw new AppError('Only an active enrollment in the current EMIS academic year can be activated.',409);
  const personId=r.person_id||r.id;
  // Older independent rows can acquire their own stable ID. Never infer history by name/email.
  if(!r.person_id&&await one("SELECT prev.id FROM emis_records prev WHERE prev.org_id=? AND prev.entity='students' AND prev.id<>? AND prev.year<>? AND (LOWER(TRIM(prev.data->>'$.email'))=? OR (?<>'' AND prev.data->>'$.studentNo'=?)) LIMIT 1",[org,r.id,r.year,body.email,v.studentNo||'',v.studentNo||''],c))throw new AppError('This older record may have an enrollment history. Review its identity in EMIS before linking a login.',409);
  if(v.email&&String(v.email).trim().toLowerCase()!==body.email)throw new AppError('Use the email recorded in EMIS, or correct the EMIS student record first.',409);
  const linked=await one("SELECT er.user_id,m.active,m.role,u.email FROM emis_roles er JOIN institution_memberships m ON m.org_id=er.org_id AND m.user_id=er.user_id JOIN users u ON u.id=m.user_id WHERE er.org_id=? AND (er.student_person_id=? OR er.student_id=?) FOR UPDATE",[org,personId,r.id],c);
  if(linked){if(!linked.active||linked.role!=='student')throw new AppError('This student’s access is paused or has changed. Review Users & access in EMIS.',409);if(String(linked.email).toLowerCase()!==body.email)throw new AppError('This enrollment already has a different shared login.',409);return {ok:true,state:'already-linked',userId:linked.user_id};}
  if(r.version!==body.version)throw new AppError('The enrollment changed. Refresh the directory and review it before continuing.',409);
  const duplicate=await one("SELECT other.id FROM emis_records other LEFT JOIN emis_student_links sl ON sl.org_id=other.org_id AND sl.student_id=other.id WHERE other.org_id=? AND other.entity='students' AND other.year=? AND other.archived=0 AND COALESCE(sl.person_id,other.id)<>? AND (LOWER(TRIM(other.data->>'$.email'))=? OR (?<>'' AND other.data->>'$.studentNo'=?)) LIMIT 1",[org,r.year,personId,body.email,v.studentNo||'',v.studentNo||''],c);
  if(duplicate)throw new AppError('Another enrollment has the same email or student ID. Resolve the duplicate in EMIS before granting access.',409);
  let account=await one('SELECT id,platform_admin FROM users WHERE email=? FOR UPDATE',[body.email],c),temporaryPassword:string|undefined;
  if(account&&!body.useExisting)return {ok:false,requiresExisting:true};
  if(!account&&body.useExisting)throw new AppError('No login exists for this address. Choose Create student login.',409);
  if(account?.platform_admin)throw new AppError('A platform owner cannot be linked as a student.',403);
  if(account){const old=await one("SELECT m.role,m.active,er.student_person_id,er.student_id,er.role AS emisRole FROM institution_memberships m LEFT JOIN emis_roles er ON er.org_id=m.org_id AND er.user_id=m.user_id WHERE m.org_id=? AND m.user_id=? FOR UPDATE",[org,account.id],c);
    if(old&&(!old.active||old.role!=='student'||(old.emisRole&&old.emisRole!=='Student')||old.student_person_id||old.student_id))throw new AppError('This login already has other or paused access here. Review it in EMIS Users & access before linking.',409);
    const sp=old?await one('SELECT admission_number FROM student_profiles WHERE org_id=? AND user_id=? FOR UPDATE',[org,account.id],c):null;
    if(sp?.admission_number&&v.studentNo&&String(sp.admission_number).trim().toLowerCase()!==String(v.studentNo).trim().toLowerCase())throw new AppError('The admission numbers on this login and EMIS enrollment differ. Review both records before linking.',409);
    if(!old)await run("INSERT INTO institution_memberships(org_id,user_id,role,display_name) VALUES(?,?,'student',?)",[org,account.id,v.name],c);
  }else{
   temporaryPassword='Ts-'+randomBytes(18).toString('base64url');account={id:randomUUID()};
   await run('INSERT INTO users(id,email,name,password_hash,must_change_password) VALUES(?,?,?,?,1)',[account.id,body.email,v.name,await hashPassword(temporaryPassword)],c);
   await run("INSERT INTO institution_memberships(org_id,user_id,role,display_name) VALUES(?,?,'student',?)",[org,account.id,v.name],c);
  }
  if(!r.person_id)await run('INSERT INTO emis_student_links(org_id,student_id,person_id) VALUES(?,?,?)',[org,r.id,personId],c);
  if(!v.email)await run("UPDATE emis_records SET data=JSON_SET(data,'$.email',?),version=version+1,updated_at=? WHERE org_id=? AND id=?",[body.email,new Date().toISOString(),org,r.id],c);
  await syncMember(c,org,account.id,{role:'Student',recordId:r.id,fromDirectory:true});await log(c,org,actor,'linked shared student login',r.id,{userId:account.id});
  return {ok:true,state:temporaryPassword?'created':'linked',userId:account.id,...(temporaryPassword?{email:body.email,temporaryPassword}:{})};
 });return respond(result,'requiresExisting' in result?409:200);
}catch(e){return failure(e)}}
