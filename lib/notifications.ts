import {createHash} from 'node:crypto';
import {rows} from './db';
import {learnerClause,teacherClause} from './course-policy';
import {teacherRosterClause} from './college-policy';
export type InboxItem={id:string;kind:string;title:string;body:string;at:string;courseId?:string;target:'assessments'|'learn'|'live'|'announcement'|'calendar';read:boolean;announcementId?:string;authorId?:string;scheduledAt?:string};
export function itemKey(...parts:unknown[]){return createHash('sha256').update(JSON.stringify(parts)).digest('hex')}
export function utc(value:string){return /Z$|[+-]\d\d:\d\d$/.test(value)?value:value.replace(' ','T')+'Z'}
export function deadlineKind(value:string,now=Date.now()){const delta=Date.parse(utc(value))-now;return delta<0?'overdue':delta<=48*3600000?'due-soon':null}
export async function availableBatches(org:string,user:string,role:string){return rows(`SELECT b.id,b.name FROM batches b WHERE b.org_id=?${role==='admin'?'':role==='teacher'?' AND EXISTS(SELECT 1 FROM (SELECT batch_id,user_id,subject_id FROM teacher_assignments UNION ALL SELECT batch_id,user_id,NULL AS subject_id FROM edtech_teachers) ta WHERE ta.batch_id=b.id AND ta.user_id=?)':' AND EXISTS(SELECT 1 FROM batch_members bm WHERE bm.batch_id=b.id AND bm.user_id=?)'} ORDER BY b.name`,role==='admin'?[org]:[org,user])}
export async function inbox(org:string,user:string,m:{role:string;kind:string}){
 const staff=['admin','teacher'].includes(m.role),clause=m.role==='admin'?'1=1':m.role==='teacher'?teacherClause():`c.status='published' AND ${learnerClause()}`,scope=m.role==='admin'?[org]:[org,user,user],items:InboxItem[]=[];
 const add=(key:unknown[],kind:string,title:string,body:string,at:string,target:InboxItem['target'],courseId?:string,announcementId?:string)=>items.push({id:itemKey(...key),kind,title,body,at:utc(at),target,courseId,announcementId,read:false});
 const batchScope=m.role==='admin'?'1=1':m.role==='teacher'?'EXISTS(SELECT 1 FROM (SELECT batch_id,user_id,subject_id FROM teacher_assignments UNION ALL SELECT batch_id,user_id,NULL AS subject_id FROM edtech_teachers) ta WHERE ta.batch_id=ab.batch_id AND ta.user_id=?)':'EXISTS(SELECT 1 FROM batch_members bm WHERE bm.batch_id=ab.batch_id AND bm.user_id=?)';
 const announcements=await rows(`SELECT a.*,u.name AS author FROM announcements a JOIN users u ON u.id=a.author_id WHERE a.org_id=? AND a.withdrawn=FALSE AND EXISTS(SELECT 1 FROM announcement_batches ab WHERE ab.announcement_id=a.id AND ${batchScope}) ORDER BY a.created_at DESC LIMIT 100`,m.role==='admin'?[org]:[org,user]);
 for(const a of announcements){add(['announcement',a.id],'announcement',a.title,a.body,a.created_at,'announcement',undefined,a.id);items[items.length-1].authorId=a.author_id;}
 if(!staff){
  const assessments=await rows(`SELECT a.*,c.title AS course_title,s.id AS submission_id,s.score,s.feedback,s.graded_at,s.returned_until,s.version AS submission_version,(SELECT MAX(e.created_at) FROM submission_events e WHERE e.submission_id=s.id) AS review_at FROM assessments a JOIN courses c ON c.id=a.course_id LEFT JOIN submissions s ON s.assessment_id=a.id AND s.user_id=? WHERE c.org_id=? AND ${clause} AND a.status='published' AND (a.unit_id IS NULL OR EXISTS(SELECT 1 FROM course_units cu WHERE cu.id=a.unit_id AND cu.status='published')) ORDER BY a.created_at DESC LIMIT 150`,[user,...scope]);
  for(const a of assessments){
   add(['assessment',a.id],'assignment',a.title,`${a.course_title} · Questions and submission details are ready.`,a.created_at,'assessments',a.course_id);
   if(a.returned_until)add(['return',a.id,a.submission_version],'feedback','Revision requested: '+a.title,`${a.feedback||'Review your feedback.'}\nResubmit by ${utc(a.returned_until)}.`,a.review_at||a.graded_at||a.created_at,'assessments',a.course_id);
   else if(a.score!==null&&a.score!==undefined)add(['grade',a.id,a.submission_version],'feedback','Graded: '+a.title,`${a.score} / ${a.max_score} · ${a.feedback||'Your result is ready.'}`,a.review_at||a.graded_at||a.created_at,'assessments',a.course_id);
   const due=a.returned_until||a.due_at||(a.due_date?a.due_date+' 23:59:59':null);
   if(due&&(!a.submission_id||a.returned_until)){const kind=deadlineKind(due);if(kind)add([kind,a.id,due,a.returned_until?a.submission_version:0],kind,(kind==='overdue'?'Past deadline: ':'Due soon: ')+a.title,`${a.course_title} · Deadline ${utc(due)}. Open the assessment to check submission availability.`,due,'assessments',a.course_id)}
  }
  const units=await rows(`SELECT cu.id,cu.title,cu.course_id,cu.created_at,c.title AS course_title FROM course_units cu JOIN courses c ON c.id=cu.course_id WHERE c.org_id=? AND ${clause} AND cu.status='published' ORDER BY cu.created_at DESC LIMIT 100`,scope);
  for(const u of units)add(['unit',u.id],'learning','Learning ready: '+u.title,u.course_title,u.created_at,'learn',u.course_id);
  const lessons=await rows(`SELECT l.id,l.title,l.course_id,c.updated_at,c.title AS course_title FROM lessons l JOIN courses c ON c.id=l.course_id WHERE c.org_id=? AND ${clause} ORDER BY c.updated_at DESC LIMIT 100`,scope);
  for(const l of lessons)add(['lesson',l.id],'learning','Lesson ready: '+l.title,l.course_title,l.updated_at,'learn',l.course_id);
 }else{
  const roster=m.role==='teacher'&&['college','edtech'].includes(m.kind)?` AND ${m.kind==='edtech'?teacherRosterClause():`(c.subject_id IS NULL OR ${teacherRosterClause()})`}`:'';
  const submissions=await rows(`SELECT s.*,a.title,c.id AS course_id,u.name FROM submissions s JOIN assessments a ON a.id=s.assessment_id JOIN courses c ON c.id=a.course_id JOIN users u ON u.id=s.user_id WHERE c.org_id=? AND ${clause}${roster} AND s.score IS NULL AND s.returned_until IS NULL ORDER BY s.submitted_at DESC LIMIT 150`,[...scope,...(roster?[user]:[])]);
  for(const s of submissions)add(['submission',s.id,s.version],'submission','Ready to review: '+s.title,s.name+' submitted work.',s.submitted_at,'assessments',s.course_id);
 }
 const live=await rows(`SELECT l.*,c.title AS course_title FROM live_classes l JOIN courses c ON c.id=l.course_id WHERE c.org_id=? AND ${clause} AND l.status<>'draft' AND l.ends_at>=UTC_TIMESTAMP(3) ORDER BY l.starts_at LIMIT 100`,scope);
 for(const l of live)add(['live',l.id,l.version],'live',`${l.status==='cancelled'?'Cancelled: ':'Live class: '}${l.title}`,`${l.course_title} · ${utc(l.starts_at)}`,l.updated_at,'live',l.course_id);
 const tscope=m.role==='admin'?'1=1':m.role==='teacher'?"EXISTS(SELECT 1 FROM (SELECT batch_id,user_id,subject_id FROM teacher_assignments UNION ALL SELECT batch_id,user_id,NULL AS subject_id FROM edtech_teachers) ta WHERE ta.batch_id=t.batch_id AND ta.user_id=? AND (c.subject_id IS NULL OR ta.subject_id=c.subject_id))":"EXISTS(SELECT 1 FROM batch_members bm WHERE bm.batch_id=t.batch_id AND bm.user_id=? AND (c.subject_id IS NULL OR EXISTS(SELECT 1 FROM student_subjects ss WHERE ss.batch_id=bm.batch_id AND ss.user_id=bm.user_id AND ss.subject_id=c.subject_id)))";
 const timetable=await rows(`SELECT t.*,c.title AS course_title FROM timetable_sessions t JOIN courses c ON c.id=t.course_id WHERE c.org_id=? AND ${clause} AND ${tscope} AND t.status<>'draft' AND t.ends_at>=UTC_TIMESTAMP(3) ORDER BY t.starts_at LIMIT 100`,[...scope,...(m.role==='admin'?[]:[user])]);
 for(const t of timetable){add(['timetable',t.id,t.version],'timetable',(t.status==='cancelled'?'Cancelled: ':'Scheduled: ')+t.title,`${t.course_title} · ${utc(t.starts_at)}`,t.updated_at,'calendar',t.course_id);items[items.length-1].scheduledAt=utc(t.starts_at);}
 const reads=new Set((await rows('SELECT item_key FROM notification_reads WHERE org_id=? AND user_id=?',[org,user])).map(r=>r.item_key));
 return items.map(i=>({...i,read:reads.has(i.id)})).sort((a,b)=>Number(a.read)-Number(b.read)||Date.parse(b.at)-Date.parse(a.at));
}
