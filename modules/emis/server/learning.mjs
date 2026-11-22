import {learnerClause,teacherClause} from '../../../lib/course-policy.ts';
import {randomUUID} from 'node:crypto';
import {one,many,fail} from '../../../lib/campus-data.mjs';
export async function learningOverview(store,u,year){const c=store.db.connection(),org=store.org;if(!['admin','student','teacher'].includes(u.learningRole))throw fail('A Learning role is required.',403);
 const student=u.learningRole==='student',teacher=u.learningRole==='teacher';
 const extra=student?" AND c.status='published' AND "+learnerClause():teacher?' AND '+teacherClause():'',args=student||teacher?[org,u.id,u.id]:[org];
 const metrics=await one(c,'SELECT COUNT(*) courses,COALESCE(SUM(CASE WHEN c.status=\'published\' THEN 1 ELSE 0 END),0) published FROM courses c WHERE c.org_id=?'+extra,args);let subjects=[];
 if(u.learningRole==='admin')subjects=await many(c,"SELECT r.id,r.data->>'$.code' code,r.data->>'$.name' name,r.data->>'$.semester' semester,p.data->>'$.name' program,l.subject_id subjectId FROM emis_records r LEFT JOIN emis_records p ON p.org_id=r.org_id AND p.id=r.data->>'$.programId' LEFT JOIN emis_subject_links l ON l.org_id=r.org_id AND l.record_id=r.id WHERE r.org_id=? AND r.entity='courses' AND r.archived=0 AND r.year=? ORDER BY name",[org,year]);
 return {courses:Number(metrics.courses),published:Number(metrics.published),subjects,role:u.learningRole};
}
export async function publishSubject(s,u,recordId){if(u.learningRole!=='admin'||!['Admin','Super Admin'].includes(u.role))throw fail('An institutional administrator is required.',403);
 return s.tx(async()=>{const c=s.db.connection(),org=s.org,course=await s.get(recordId);if(!course||course.entity!=='courses')throw fail('Teaching allocation not found.',404);
 const prior=await one(c,'SELECT subject_id FROM emis_subject_links WHERE org_id=? AND record_id=?',[org,recordId]);if(prior)return {subjectId:prior.subject_id,created:false};
 if(!course.name?.trim()||course.name.length>120||String(course.code||'').length>40)throw fail('Use a subject name of up to 120 characters and a code of up to 40.');
 const profile=await s.meta('profile');let sem=null;if(profile.kind==='college'){
  const p=await s.get(course.programId),d=p&&await s.get(p.departmentId);if(!p||p.entity!=='programs'||!d||d.entity!=='departments'||p.name.length>120||d.name.length>120||!Number.isInteger(Number(course.semester))||course.semester<1||course.semester>12)throw fail('Complete the department, program and semester for this course first.');
  let f=await one(c,'SELECT id FROM faculties WHERE org_id=? AND name=?',[org,d.name]);if(!f){f={id:randomUUID()};await c.execute('INSERT INTO faculties(id,org_id,name) VALUES(?,?,?)',[f.id,org,d.name]);}
  let prog=await one(c,'SELECT id FROM programs WHERE org_id=? AND faculty_id=? AND name=?',[org,f.id,p.name]);if(!prog){prog={id:randomUUID()};await c.execute('INSERT INTO programs(id,org_id,faculty_id,name) VALUES(?,?,?,?)',[prog.id,org,f.id,p.name]);}
  const term='Semester '+Number(course.semester);let g=await one(c,'SELECT id FROM grades WHERE org_id=? AND program_id=? AND name=?',[org,prog.id,term]);if(!g){g={id:randomUUID()};await c.execute('INSERT INTO grades(id,org_id,program_id,name) VALUES(?,?,?,?)',[g.id,org,prog.id,term]);}sem=g.id;
 }
 let subject=await one(c,'SELECT id,code FROM subjects WHERE org_id=? AND college_semester_id <=> ? AND name=?',[org,sem,course.name]);
 if(subject&&String(subject.code||'')!==String(course.code||''))throw fail('A Learning subject with this name has another code. Review the two entries before publishing.',409);
 if(!subject){subject={id:randomUUID()};await c.execute('INSERT INTO subjects(id,org_id,name,code,college_semester_id) VALUES(?,?,?,?,?)',[subject.id,org,course.name,course.code||'',sem]);}
 await c.execute('INSERT INTO emis_subject_links(org_id,record_id,subject_id) VALUES(?,?,?)',[org,recordId,subject.id]);await s.log(u,'published subject to Learning','courses',recordId,null,{subjectId:subject.id});return {subjectId:subject.id,created:true};});
}
