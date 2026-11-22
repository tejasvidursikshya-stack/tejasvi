import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {one,rows,run,transaction} from '@/lib/db';
import {identity,membership,requireAdmin,readJson,respond,failure,AppError} from '@/lib/platform-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=z.string().uuid(),name=z.string().trim().min(1).max(100);
export async function GET(request:Request){try{
 const user=await identity(),org=uuid.parse(new URL(request.url).searchParams.get('org')),m=await membership(org,user.userId);
 if(m.kind!=='college')throw new AppError('Open a college workspace.',403);
 const admin=m.role==='admin',teacher=m.role==='teacher';
 const batches=await rows(`SELECT b.id,b.name,b.academic_year,b.grade_id,sect.name section,g.name semester,p.name program,f.name faculty,f.id faculty_id FROM batches b JOIN grades g ON g.id=b.grade_id LEFT JOIN sections sect ON sect.id=b.section_id JOIN programs p ON p.id=g.program_id JOIN faculties f ON f.id=p.faculty_id WHERE b.org_id=?${admin?'':teacher?' AND EXISTS(SELECT 1 FROM teacher_assignments t WHERE t.batch_id=b.id AND t.user_id=?)':' AND EXISTS(SELECT 1 FROM batch_members bm WHERE bm.batch_id=b.id AND bm.user_id=?)'} ORDER BY f.name,g.name,b.academic_year`,admin?[org]:[org,user.userId]);
 const ids=batches.map(b=>b.id),marks=ids.map(()=>'?').join(',');
 const subjects=ids.length?await rows(`SELECT s.*,bs.batch_id FROM batch_subjects bs JOIN subjects s ON s.id=bs.subject_id WHERE bs.batch_id IN (${marks})${admin?'':` AND EXISTS(SELECT 1 FROM ${teacher?'teacher_assignments':'student_subjects'} a WHERE a.batch_id=bs.batch_id AND a.subject_id=s.id AND a.user_id=?)`} ORDER BY s.name`,[...ids,...(admin?[]:[user.userId])]):[];
 const teachers=ids.length?await rows(`SELECT t.*,u.name FROM teacher_assignments t JOIN users u ON u.id=t.user_id JOIN memberships m ON m.user_id=t.user_id AND m.org_id=? AND m.role='teacher' WHERE t.batch_id IN (${marks})`,[org,...ids]):[];
 const roster=admin&&ids.length?await rows(`SELECT bm.*,COALESCE(NULLIF(m.display_name,''),u.name) AS name,u.email FROM batch_members bm JOIN users u ON u.id=bm.user_id JOIN memberships m ON m.user_id=u.id AND m.org_id=? AND m.role='student' WHERE bm.batch_id IN (${marks})`,[org,...ids]):[];
 const enrolments=admin&&ids.length?await rows(`SELECT * FROM student_subjects WHERE batch_id IN (${marks})`,ids):[];
 return respond({role:m.role,batches,subjects,teachers,roster,enrolments,faculties:admin?await rows('SELECT * FROM faculties WHERE org_id=? ORDER BY name',[org]):[],programs:admin?await rows('SELECT * FROM programs WHERE org_id=? ORDER BY name',[org]):[],semesters:admin?await rows('SELECT * FROM grades WHERE org_id=? ORDER BY name',[org]):[],members:admin?await rows("SELECT u.id,COALESCE(NULLIF(m.display_name,''),u.name) AS name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.org_id=? AND m.role IN ('student','teacher') ORDER BY u.name",[org]):[]});
}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),b=await readJson(request),org=uuid.parse(b.orgId),m=await membership(org,user.userId);requireAdmin(m);if(m.kind!=='college')throw new AppError('Open a college workspace.',403);
 const action=z.enum(['faculty','semester','subject','library','enrol','teacher']).parse(b.action);
 if(action==='faculty'){const n=name.parse(b.name),id=randomUUID();await transaction(async db=>{await run('INSERT INTO faculties(id,org_id,name) VALUES(?,?,?)',[id,org,n],db);await run('INSERT INTO programs(id,org_id,faculty_id,name) VALUES(?,?,?,?)',[randomUUID(),org,id,n],db)});return respond({id},201)}
 if(action==='semester'){
  let program=b.programId?await one('SELECT p.*,f.name faculty FROM programs p JOIN faculties f ON f.id=p.faculty_id WHERE p.id=? AND p.org_id=?',[uuid.parse(b.programId),org]):null;let createProgram=false;if(!b.programId){const faculty=await one('SELECT * FROM faculties WHERE id=? AND org_id=?',[uuid.parse(b.facultyId),org]);if(faculty){program={id:randomUUID(),name:faculty.name,faculty:faculty.name,faculty_id:faculty.id};createProgram=true;}}if(!program)throw new AppError('Choose a faculty/program in this college.',403);const selectedProgram=program;
  const n=name.parse(b.name),year=z.string().trim().min(1).max(30).parse(b.year),sectionName=z.string().trim().min(1).max(30).parse(b.section||'Main'),batchName=z.string().max(120).parse(`${selectedProgram.faculty} · ${selectedProgram.name===selectedProgram.faculty?'':selectedProgram.name+' · '}${n} · ${year} · ${sectionName}`),batchId=randomUUID();
  await transaction(async db=>{
   if(createProgram){await run('INSERT INTO programs(id,org_id,faculty_id,name) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',[selectedProgram.id,org,selectedProgram.faculty_id,selectedProgram.name],db);const existing=await one('SELECT id FROM programs WHERE org_id=? AND faculty_id=? AND name=?',[org,selectedProgram.faculty_id,selectedProgram.name],db);selectedProgram.id=existing!.id;}
   // The unique keys serialize duplicate setup requests without creating parallel semesters.
   const gid=randomUUID();await run('INSERT INTO grades(id,org_id,program_id,name) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',[gid,org,selectedProgram.id,n],db);
   const grade=await one('SELECT id FROM grades WHERE org_id=? AND program_id=? AND name=?',[org,selectedProgram.id,n],db);
   await run('INSERT INTO sections(id,org_id,grade_id,name) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',[randomUUID(),org,grade!.id,sectionName],db);
   const section=await one('SELECT id FROM sections WHERE grade_id=? AND name=?',[grade!.id,sectionName],db);
   await run('INSERT INTO batches(id,org_id,name,grade_id,section_id,academic_year) VALUES(?,?,?,?,?,?)',[batchId,org,batchName,grade!.id,section!.id,year],db);
   await run('INSERT IGNORE INTO batch_subjects(batch_id,subject_id) SELECT ?,id FROM subjects WHERE org_id=? AND college_semester_id=?',[batchId,org,grade!.id],db);
   await run('INSERT IGNORE INTO course_batches(course_id,batch_id) SELECT c.id,? FROM courses c JOIN subjects s ON s.id=c.subject_id WHERE c.org_id=? AND s.college_semester_id=?',[batchId,org,grade!.id],db);
  });return respond({id:batchId},201);
 }
 const batch=await one('SELECT * FROM batches WHERE id=? AND org_id=? AND grade_id IS NOT NULL',[uuid.parse(b.batchId),org]);if(!batch)throw new AppError('Choose a semester intake in this college.',403);
 if(action==='library'){
  const subject=await one('SELECT s.* FROM subjects s JOIN batch_subjects bs ON bs.subject_id=s.id WHERE s.id=? AND s.org_id=? AND bs.batch_id=?',[uuid.parse(b.subjectId),org,batch.id]);if(!subject)throw new AppError('Choose a subject in this semester.',403);
  const cid=randomUUID();await transaction(async db=>{await run("INSERT INTO courses(id,org_id,author_id,title,description,audience,status,subject_id,access_mode) VALUES(?,?,?,?,?,?,'draft',?,'assigned')",[cid,org,user.userId,subject.name,'',batch.name.slice(0,100),subject.id],db);await run('INSERT INTO course_batches(course_id,batch_id) VALUES(?,?)',[cid,batch.id],db)});return respond({courseId:cid},201);
 }
 if(action==='subject'){
  const n=name.parse(b.name),sid=randomUUID(),cid=randomUUID(),code=z.string().trim().max(40).parse(b.code||'');
  await transaction(async db=>{
   await run('INSERT INTO subjects(id,org_id,name,code,college_semester_id) VALUES(?,?,?,?,?)',[sid,org,n,code,batch.grade_id],db);
   await run('INSERT INTO batch_subjects(batch_id,subject_id) SELECT id,? FROM batches WHERE org_id=? AND grade_id=?',[sid,org,batch.grade_id],db);
   await run("INSERT INTO courses(id,org_id,author_id,title,description,audience,status,subject_id,access_mode) VALUES(?,?,?,?,?,?,'draft',?,'assigned')",[cid,org,user.userId,n,'',batch.name.slice(0,100),sid],db);
   await run('INSERT INTO course_batches(course_id,batch_id) SELECT ?,id FROM batches WHERE org_id=? AND grade_id=?',[cid,org,batch.grade_id],db);
  });return respond({id:sid,courseId:cid},201);
 }
 const userIds=[...new Set(z.array(uuid).min(1).max(100).parse(b.userIds))],subjectIds=[...new Set(z.array(uuid).min(1).max(30).parse(b.subjectIds))];
 await transaction(async db=>{
  for(const sid of subjectIds){if(!await one('SELECT s.id FROM batch_subjects bs JOIN subjects s ON s.id=bs.subject_id WHERE bs.batch_id=? AND s.id=? AND s.org_id=? AND (s.college_semester_id IS NULL OR s.college_semester_id=?)',[batch.id,sid,org,batch.grade_id],db))throw new AppError('Select subjects offered in this semester.',403)}
  for(const uid of userIds){const member=await one('SELECT role FROM memberships WHERE org_id=? AND user_id=?',[org,uid],db);if(member?.role!==(action==='teacher'?'teacher':'student'))throw new AppError('Choose matching accounts in this college.',403);
   if(action==='enrol')await run('INSERT IGNORE INTO batch_members(batch_id,user_id) VALUES(?,?)',[batch.id,uid],db);
   for(const sid of subjectIds){const table=action==='teacher'?'teacher_assignments':'student_subjects';if(b.remove===true)await run(`DELETE FROM ${table} WHERE batch_id=? AND subject_id=? AND user_id=?`,[batch.id,sid,uid],db);else await run(`INSERT IGNORE INTO ${table}(batch_id,subject_id,user_id) VALUES(?,?,?)`,[batch.id,sid,uid],db)}
  }
 });return respond({ok:true});
}catch(e){return failure(e)}}
