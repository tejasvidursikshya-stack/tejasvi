import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {rows,one,run,transaction} from '@/lib/db';
import {identity,requireAdmin,readJson,respond,failure,AppError,jsonValue} from '@/lib/platform-server';
import {provider,providerBatch,providerRoster} from '@/lib/edtech-server';
import {examComponents,validScores} from '@/lib/edtech-policy';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=z.string().uuid(),txt=(max=120)=>z.string().trim().min(1).max(max);
export async function GET(request:Request){try{
 const user=await identity(),q=new URL(request.url).searchParams,org=uuid.parse(q.get('org')),m=await provider(org,user.userId),examId=q.get('exam');
 if(examId){const exam=await one('SELECT * FROM edtech_exams WHERE id=? AND org_id=?',[uuid.parse(examId),org]);if(!exam)throw new AppError('Exam not found.',404);await providerBatch(org,exam.batch_id,user.userId);
 if(m.role==='student'&&exam.status!=='published')throw new AppError('Results are not published.',403);
 const results=await rows(`SELECT * FROM edtech_results WHERE exam_id=?${m.role==='student'?' AND user_id=?':''}`,[exam.id,...(m.role==='student'?[user.userId]:[])]);
 return respond({exam:{...exam,components:jsonValue(exam.components),header_snapshot:exam.header_snapshot?jsonValue(exam.header_snapshot):null},results:results.map(r=>({...r,scores:jsonValue(r.scores)})),roster:m.role==='student'?[]:await providerRoster(org,exam.batch_id)});
 }
 const batches=await rows(`SELECT b.id,b.name,e.delivery,e.academic_year,e.grade_label,e.partner_id,p.name partner_name FROM edtech_batches e JOIN batches b ON b.id=e.batch_id LEFT JOIN edtech_partners p ON p.id=e.partner_id WHERE e.org_id=?${m.role==='admin'?'':` AND EXISTS(SELECT 1 FROM ${m.role==='teacher'?'edtech_teachers':'batch_members'} a WHERE a.batch_id=b.id AND a.user_id=?)`} ORDER BY p.name,e.academic_year DESC,CAST(REGEXP_SUBSTR(e.grade_label,'[0-9]+') AS UNSIGNED),b.name`,[org,...(m.role==='admin'?[]:[user.userId])]);
 const ids=batches.map(b=>b.id),marks=ids.map(()=>'?').join(',');
 return respond({role:m.role,batches,partners:m.role==='admin'?await rows('SELECT id,name,address,contact_name,contact_email,(logo_data IS NOT NULL) has_logo FROM edtech_partners WHERE org_id=? ORDER BY name',[org]):[],teachers:m.role==='admin'?await rows("SELECT u.id,u.name,u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.role='teacher' ORDER BY u.name",[org]):[],students:m.role==='admin'?await rows("SELECT u.id,COALESCE(NULLIF(m.display_name,''),u.name) name,u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.role='student' ORDER BY name",[org]):[],assignments:ids.length?await rows(`SELECT et.batch_id,et.user_id,u.name FROM edtech_teachers et JOIN users u ON u.id=et.user_id WHERE et.batch_id IN (${marks})`,ids):[],enrolments:m.role==='admin'&&ids.length?await rows(`SELECT batch_id,user_id FROM batch_members WHERE batch_id IN (${marks})`,ids):[],courseLinks:ids.length?await rows(`SELECT cb.course_id,cb.batch_id FROM course_batches cb WHERE cb.batch_id IN (${marks})`,ids):[],exams:ids.length?await rows(`SELECT id,batch_id,title,quarter,status,version,published_at FROM edtech_exams WHERE org_id=? AND batch_id IN (${marks})${m.role==='student'?" AND status='published'":''} ORDER BY created_at DESC`,[org,...ids]):[]});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),d=await readJson(request),org=uuid.parse(d.orgId),m=await provider(org,user.userId),action=z.enum(['partner','batch','teacher','enrol','link','exam','marks','publish','unpublish']).parse(d.action);
 if(['partner','batch','teacher','enrol','link'].includes(action))requireAdmin(m);
 if(action==='partner'){const p=z.object({name:txt(),address:z.string().trim().max(500),contactName:z.string().trim().max(120),contactEmail:z.union([z.string().email().max(254),z.literal('')])}).parse(d),id=d.id?uuid.parse(d.id):randomUUID();if(d.id){const r=await run('UPDATE edtech_partners SET name=?,address=?,contact_name=?,contact_email=? WHERE id=? AND org_id=?',[p.name,p.address,p.contactName,p.contactEmail,id,org]);if(!r.affectedRows)throw new AppError('Partner not found.',404)}else await run('INSERT INTO edtech_partners(id,org_id,name,address,contact_name,contact_email) VALUES(?,?,?,?,?,?)',[id,org,p.name,p.address,p.contactName,p.contactEmail]);return respond({id},201)}
 if(action==='batch'){const b=z.object({name:txt(),delivery:z.enum(['b2b','b2c']),partnerId:z.union([uuid,z.literal('')]),year:txt(40),grade:z.string().trim().max(80)}).parse(d);if(b.delivery==='b2b'&&!await one('SELECT id FROM edtech_partners WHERE id=? AND org_id=?',[b.partnerId,org]))throw new AppError('Choose a partner school in this provider.',403);if(b.delivery==='b2c'&&b.partnerId)throw new AppError('Individual learner batches do not have a school.');const id=randomUUID();await transaction(async db=>{await run('INSERT INTO batches(id,org_id,name) VALUES(?,?,?)',[id,org,b.name],db);await run('INSERT INTO edtech_batches(batch_id,org_id,partner_id,delivery,academic_year,grade_label) VALUES(?,?,?,?,?,?)',[id,org,b.partnerId||null,b.delivery,b.year,b.grade],db)});return respond({id},201)}
 if(['teacher','enrol','link','exam'].includes(action)){
 const batch=uuid.parse(d.batchId);await providerBatch(org,batch,user.userId,true);
 if(action==='teacher'||action==='enrol'){
 const ids=[...new Set(z.array(uuid).min(1).max(500).parse(d.userIds))],role=action==='teacher'?'teacher':'student',remove=z.boolean().default(false).parse(d.remove);
 await transaction(async db=>{await one('SELECT id FROM organizations WHERE id=? FOR UPDATE',[org],db);for(const id of ids){if(!await one('SELECT user_id FROM memberships WHERE org_id=? AND user_id=? AND role=?',[org,id,role],db))throw new AppError('Select existing '+role+' accounts in this provider.',403);const table=action==='teacher'?'edtech_teachers':'batch_members';await run(remove?`DELETE FROM ${table} WHERE batch_id=? AND user_id=?`:`INSERT IGNORE INTO ${table}(batch_id,user_id) VALUES(?,?)`,[batch,id],db)}});return respond({ok:true})}
 if(action==='link'){const cid=uuid.parse(d.courseId),remove=z.boolean().default(false).parse(d.remove);if(!await one("SELECT id FROM courses WHERE id=? AND org_id=? AND access_mode='assigned' AND subject_id IS NULL",[cid,org]))throw new AppError('Choose a provider program with assigned visibility.',403);await run(remove?'DELETE FROM course_batches WHERE batch_id=? AND course_id=?':'INSERT IGNORE INTO course_batches(batch_id,course_id) VALUES(?,?)',[batch,cid]);return respond({ok:true})}
 const e=z.object({title:txt(160),quarter:z.number().int().min(1).max(4),components:examComponents}).parse(d),id=randomUUID();await run('INSERT INTO edtech_exams(id,org_id,batch_id,title,quarter,components,created_by) VALUES(?,?,?,?,?,?,?)',[id,org,batch,e.title,e.quarter,JSON.stringify(e.components),user.userId]);return respond({id},201);
 }
 const eid=uuid.parse(d.examId);
 await transaction(async db=>{
 await one('SELECT id FROM organizations WHERE id=? FOR UPDATE',[org],db);
 const e=await one('SELECT * FROM edtech_exams WHERE id=? AND org_id=? FOR UPDATE',[eid,org],db);if(!e)throw new AppError('Exam not found.',404);const {b}=await providerBatch(org,e.batch_id,user.userId,true,db),components=jsonValue(e.components);
 if(action==='marks'){
 if(e.status!=='draft')throw new AppError('Return the results to draft before editing marks.',409);
 const mark=z.object({userId:uuid,scores:z.array(z.number()).max(10),absent:z.boolean(),feedback:z.string().trim().max(2000),version:z.number().int().min(0)}).parse(d);
 const roster=await providerRoster(org,e.batch_id,db),student=roster.find(s=>s.id===mark.userId);if(!student)throw new AppError('This student is not enrolled in this batch.',403);if(!validScores(components,mark.scores,mark.absent))throw new AppError('Enter a valid mark for each component, or mark absent.');
 const old=await one('SELECT version FROM edtech_results WHERE exam_id=? AND user_id=?',[eid,mark.userId],db);if((old?.version||0)!==mark.version)throw new AppError('These marks changed. Reload before saving.',409);
 await run('INSERT INTO edtech_results(exam_id,user_id,scores,absent,feedback,learner_name,reference_number,graded_by) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE scores=VALUES(scores),absent=VALUES(absent),feedback=VALUES(feedback),learner_name=VALUES(learner_name),reference_number=VALUES(reference_number),graded_by=VALUES(graded_by),version=version+1',[eid,mark.userId,JSON.stringify(mark.scores),mark.absent,mark.feedback,student.name,student.reference_number,user.userId],db);await run('UPDATE edtech_exams SET version=version+1 WHERE id=?',[eid],db);
 }else{
 if(e.version!==z.number().int().min(1).parse(d.version))throw new AppError('Exam changed. Reload before publishing.',409);
 if(action==='unpublish'){await run("UPDATE edtech_exams SET status='draft',version=version+1,published_at=NULL WHERE id=?",[eid],db);await run('INSERT INTO learning_audit(org_id,actor_id,action,target_id) VALUES(?,?,?,?)',[org,user.userId,'edtech-unpublish',eid],db);return}
 if(e.status!=='draft')throw new AppError('Already published.',409);
 const roster=await providerRoster(org,e.batch_id,db),results=await rows('SELECT * FROM edtech_results WHERE exam_id=?',[eid],db);
 if(!roster.length||roster.some(s=>!results.some(r=>r.user_id===s.id&&validScores(components,jsonValue(r.scores),!!r.absent))))throw new AppError('Enter marks or mark absent for every enrolled student before publishing.');
 const brand=await one('SELECT name,logo_data FROM organizations WHERE id=?',[org],db),partner=b.partner_id?await one('SELECT name,logo_data FROM edtech_partners WHERE id=? AND org_id=?',[b.partner_id,org],db):null;
 if(!brand?.logo_data||b.delivery==='b2b'&&!partner?.logo_data)throw new AppError('Upload the provider logo and, for B2B, the partner-school logo before publishing.');
 const image=(v:Buffer)=>'data:image/webp;base64,'+v.toString('base64');const header={provider:brand.name,providerLogo:image(brand.logo_data),partner:partner?.name||'',partnerLogo:partner?.logo_data?image(partner.logo_data):'',batch:b.name,year:b.academic_year,grade:b.grade_label,delivery:b.delivery};
 await run("UPDATE edtech_exams SET status='published',header_snapshot=?,published_at=UTC_TIMESTAMP(3),version=version+1 WHERE id=?",[JSON.stringify(header),eid],db);
 }
 await run('INSERT INTO learning_audit(org_id,actor_id,action,target_id) VALUES(?,?,?,?)',[org,user.userId,'edtech-'+action,eid],db);
 });return respond({ok:true});
}catch(e){return failure(e)}}
