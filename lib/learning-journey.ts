import {createHash} from 'node:crypto';
import {rows,one,type DB} from './db';
import {learnerClause,teacherClause,teacherResultClause} from './course-policy';
import {utcMillis,submissionState} from './assessment-policy';
import {AppError} from './errors';
import type {GradeItem,JourneyRow,JourneyData} from './learning-journey-types';
import {weightedGrade,DEFAULT_POLICY} from './quiz-engine.mjs';
type R=Record<string,any>;
const json=(v:any)=>typeof v==='string'?JSON.parse(v):v;
const round=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
export function gradeDigest(courseId:string,userId:string,items:GradeItem[]){return createHash('sha256').update(JSON.stringify([courseId,userId,[...items].sort((a,b)=>a.key.localeCompare(b.key)).map(i=>[i.key,i.title,i.score,i.max,i.state,i.stamp])])).digest('hex');}
export function selectedResult(row:JourneyRow,keys:string[]){
 if(!keys.length||new Set(keys).size!==keys.length)throw new AppError('Choose at least one distinct graded item.');
 const items=keys.map(k=>row.items.find(i=>i.key===k));
 if(items.some(i=>!i))throw new AppError('The gradebook changed. Refresh before approving.',409);
 if(items.some(i=>i!.score===null||i!.state!=='graded'))throw new AppError('Every selected item needs a released mark. Missing work is not counted as zero.');
 const selected=items as GradeItem[],score=round(selected.reduce((n,i)=>n+Number(i.score),0)),max=round(selected.reduce((n,i)=>n+i.max,0));
 if(!(max>0&&score>=0&&score<=max))throw new AppError('Check the marks and maximum for the selected items.');
 return {items:selected,score,max,digest:gradeDigest(row.courseId,row.userId,selected)};
}
// Uses the same course and individual learner permissions as content and grading.
// Start from the authorized roster, so learners with no activity are included.
export async function learningJourney(org:string,uid:string,db:DB,courseId?:string):Promise<JourneyData>{
 const member=await one('SELECT o.kind,m.role FROM organizations o JOIN memberships m ON m.org_id=o.id WHERE o.id=? AND m.user_id=?',[org,uid],db);
 if(!member||!['admin','teacher','student','employee'].includes(member.role))throw new AppError('This learning workspace is not available to your account.',403);
 const learner=['student','employee'].includes(member.role),teacher=member.role==='teacher';
 const scope=learner?` AND c.status='published' AND ${learnerClause()}`:teacher?` AND ${teacherClause()}`:'';
 const courses=await rows(`SELECT c.id,c.title,c.status,c.subject_id AS subjectId,c.grading_policy AS gradingPolicy,c.quiz_id,q.title quizTitle,q.revision quizRevision,(SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id=q.id) quizCount FROM courses c LEFT JOIN quizzes q ON q.id=c.quiz_id AND q.org_id=c.org_id WHERE c.org_id=?${scope}${courseId?' AND c.id=?':''} ORDER BY c.title,c.id`,[org,...(learner||teacher?[uid,uid]:[]),...(courseId?[courseId]:[])],db);
 if(courseId&&!courses.length)throw new AppError('This course is not available in your workspace.',403);
 const active=courses.filter(c=>c.status==='published'),ids=active.map(c=>c.id);
 const empty={role:member.role,kind:member.kind,org,generatedAt:new Date().toISOString(),courses:courses.map(c=>({id:c.id,title:c.title,status:c.status,subjectId:c.subjectId,gradingPolicy:json(c.gradingPolicy)||DEFAULT_POLICY})),rows:[],exams:[],schoolTerms:[],schoolSubjects:[]};
 if(!ids.length)return empty;
 const placeholders=ids.map(()=>'?').join(',');
 const roster=await rows<Pick<JourneyRow,'courseId'|'userId'|'name'|'email'|'reference'>>(`SELECT c.id courseId,u.id userId,COALESCE(NULLIF(m.display_name,''),u.name) name,u.email,m.reference_number reference FROM courses c JOIN memberships m ON m.org_id=c.org_id AND m.role IN ('student','employee') JOIN users u ON u.id=m.user_id WHERE c.id IN (${placeholders}) AND ${learnerClause().replaceAll('?','u.id')}${learner?' AND u.id=?':teacher?' AND '+teacherResultClause('c.id','u.id'):''} ORDER BY name,u.id`,[...ids,...(learner?[uid]:teacher?[uid,uid]:[])],db);
 // Bind learner scope into every fact query, never expose a neighbouring intake.
 const fact=(course:string,user:string)=>` AND EXISTS(SELECT 1 FROM courses fc JOIN memberships fm ON fm.org_id=fc.org_id AND fm.user_id=${user} AND fm.role IN ('student','employee') WHERE fc.id=${course} AND ${learnerClause('fc').replaceAll('?',user)})${learner?` AND ${user}=?`:teacher?' AND '+teacherResultClause(course,user):''}`;
 const factArgs=learner?[uid]:teacher?[uid,uid]:[];
 const lessons=await rows(`SELECT id,course_id FROM lessons WHERE course_id IN (${placeholders})`,ids,db);
 const units=await rows(`SELECT id,course_id,title,quiz_revision,(JSON_LENGTH(quiz)+COALESCE(CAST(JSON_EXTRACT(quiz_settings,'$.draw.count') AS UNSIGNED),0)) quiz_count FROM course_units WHERE course_id IN (${placeholders}) AND status='published'`,ids,db);
 const assessments=await rows(`SELECT a.id,a.course_id,a.title,a.max_score,a.due_at,a.due_date,a.allow_late FROM assessments a WHERE a.course_id IN (${placeholders}) AND a.status='published' AND (a.unit_id IS NULL OR EXISTS(SELECT 1 FROM course_units cu WHERE cu.id=a.unit_id AND cu.status='published')) ORDER BY a.created_at,a.id`,ids,db);
 const submissions=await rows(`SELECT s.id,s.assessment_id,s.user_id,s.score,s.feedback,s.version,s.returned_until,s.submitted_at,s.graded_at FROM submissions s JOIN assessments a ON a.id=s.assessment_id WHERE a.course_id IN (${placeholders})${fact('a.course_id','s.user_id')}`,[...ids,...factArgs],db);
 const completions=await rows(`SELECT l.course_id,lc.user_id,lc.completed_at FROM lesson_completions lc JOIN lessons l ON l.id=lc.lesson_id WHERE l.course_id IN (${placeholders})${fact('l.course_id','lc.user_id')} UNION ALL SELECT cu.course_id,uc.user_id,uc.completed_at FROM unit_completions uc JOIN course_units cu ON cu.id=uc.unit_id WHERE cu.course_id IN (${placeholders}) AND cu.status='published'${fact('cu.course_id','uc.user_id')}`,[...ids,...factArgs,...ids,...factArgs],db);
 const attempts=await rows(`SELECT a.id,a.course_id,a.user_id,a.quiz_id item_id,a.score,a.submitted_at,a.quiz_revision revision FROM quiz_attempts a JOIN courses c ON c.id=a.course_id AND c.quiz_id=a.quiz_id JOIN quizzes q ON q.id=a.quiz_id AND q.revision=a.quiz_revision WHERE c.id IN (${placeholders})${fact('c.id','a.user_id')} UNION ALL SELECT a.id,cu.course_id,a.user_id,cu.id item_id,a.score,a.submitted_at,a.quiz_revision revision FROM unit_quiz_attempts a JOIN course_units cu ON cu.id=a.unit_id AND cu.quiz_revision=a.quiz_revision WHERE cu.course_id IN (${placeholders}) AND cu.status='published'${fact('cu.course_id','a.user_id')} ORDER BY submitted_at DESC,id DESC`,[...ids,...factArgs,...ids,...factArgs],db);
 const manual=await rows(`SELECT cm.* FROM college_marks cm WHERE cm.course_id IN (${placeholders})${fact('cm.course_id','cm.user_id')} ORDER BY label,id`,[...ids,...factArgs],db);
 const approvals=await rows(`SELECT lr.*,ex.record_id,ex.exam_id,er.year export_year,er.data->>'$.status' export_status FROM learning_results lr LEFT JOIN learning_result_exports ex ON ex.result_id=lr.id LEFT JOIN emis_records er ON er.org_id=ex.org_id AND er.id=ex.record_id WHERE lr.course_id IN (${placeholders})${fact('lr.course_id','lr.user_id')} ORDER BY lr.revision DESC`,[...ids,...factArgs],db);
 const report:JourneyRow[]=roster.map(r=>{
  const course=active.find(c=>c.id===r.courseId)!,cu=units.filter(x=>x.course_id===r.courseId),as=assessments.filter(x=>x.course_id===r.courseId),readings=completions.filter(x=>x.course_id===r.courseId&&x.user_id===r.userId);
  const items:GradeItem[]=as.map(a=>{const s=submissions.find(x=>x.assessment_id===a.id&&x.user_id===r.userId);return {key:'a:'+a.id,title:a.title,kind:'assignment',score:s?.score==null?null:Number(s.score),max:Number(a.max_score),state:submissionState(a,s),stamp:s?`${s.id}:${s.version}:${s.graded_at||''}`:'none',feedback:s?.feedback||'',dueAt:s?.returned_until||a.due_at||(a.due_date?a.due_date+' 23:59:59.999':null),assessmentId:a.id,submittedAt:s?.submitted_at||null,gradedAt:s?.graded_at||null};});
  const quizzes=[...(course.quiz_id&&Number(course.quizCount)>0?[{id:course.quiz_id,title:course.quizTitle,revision:course.quizRevision}]:[]),...cu.filter(u=>Number(u.quiz_count)>0).map(u=>({id:u.id,title:u.title+' · quiz',revision:u.quiz_revision}))];
  for(const q of quizzes){const a=attempts.find(x=>x.course_id===r.courseId&&x.user_id===r.userId&&x.item_id===q.id);items.push({key:'q:'+q.id,title:q.title,kind:'quiz',score:a?Number(a.score):null,max:100,state:a?'graded':'not_taken',stamp:q.revision+':'+(a?.id||'none'),feedback:'',dueAt:null,submittedAt:a?.submitted_at||null,gradedAt:a?.submitted_at||null});}
  for(const m of manual.filter(x=>x.course_id===r.courseId&&x.user_id===r.userId))items.push({key:'m:'+m.id,title:m.label,kind:'manual',score:Number(m.score),max:Number(m.max_score),state:'graded',stamp:m.updated_at,feedback:m.feedback||'',dueAt:null,gradedAt:m.updated_at});
  const graded=items.filter(i=>i.score!==null&&i.state==='graded'),readTotal=lessons.filter(l=>l.course_id===r.courseId).length+cu.length,quizItems=items.filter(i=>i.kind==='quiz'),now=Date.now();
  const overdue=items.filter(i=>['overdue','returned','not_started'].includes(i.state)&&i.dueAt&&utcMillis(i.dueAt)<now).length,returned=items.filter(i=>i.state==='returned').length,review=items.filter(i=>i.state==='submitted').length,lowQuiz=quizItems.filter(i=>i.score!==null&&i.score<70).length;
  const activity=[...readings.map(x=>x.completed_at),...items.flatMap(i=>i.submittedAt?[i.submittedAt]:[])].sort().at(-1)||null;
  const reasons=[...(overdue?[`${overdue} overdue task${overdue===1?'':'s'}`]:[]),...(returned?[`${returned} revision${returned===1?'':'s'} requested`]:[]),...(lowQuiz?[`${lowQuiz} quiz${lowQuiz===1?'':'zes'} below 70%`]:[])];
  const result=approvals.find(a=>a.course_id===r.courseId&&a.user_id===r.userId),snapshot=result?json(result.snapshot):null,selected=snapshot?items.filter(i=>snapshot.keys.includes(i.key)):[];
  const weighted=weightedGrade(items,json(course.gradingPolicy)||DEFAULT_POLICY) as JourneyRow['weighted'];
  return {...r,weighted,courseTitle:course.title,read:readings.length,readTotal,percent:readTotal?Math.round(readings.length/readTotal*100):null,quizPassed:quizItems.filter(i=>i.score!==null&&i.score>=70).length,quizTotal:quizItems.length,graded:graded.length,itemTotal:items.length,provisional:graded.length?round(100*graded.reduce((n,i)=>n+Number(i.score),0)/graded.reduce((n,i)=>n+i.max,0)):null,lastActivity:activity,overdue,returned,review,lowQuiz,started:!!activity,complete:readTotal>0&&readings.length===readTotal&&quizItems.every(i=>i.score!==null&&i.score>=70)&&items.filter(i=>i.kind==='assignment').every(i=>i.state==='graded'),reasons,items,fingerprint:gradeDigest(r.courseId,r.userId,items),result:result?{id:result.id,revision:result.revision,label:result.label,score:Number(result.score),max:Number(result.max_score),approvedAt:result.approved_at,changed:selected.length!==snapshot.keys.length||gradeDigest(r.courseId,r.userId,selected)!==result.source_digest,items:snapshot.items,exported:result.record_id?{recordId:result.record_id,examId:result.exam_id,year:result.export_year,status:result.export_status}:null}:null};
 });
 const exams=member.role==='admin'&&['school','college'].includes(member.kind)?await rows(`SELECT e.id,e.version,e.data->>'$.name' name,c.id courseId,e.year,CAST(e.data->>'$.maxMarks' AS DECIMAL(8,2)) max FROM emis_records e JOIN emis_records ec ON ec.org_id=e.org_id AND ec.id=e.data->>'$.courseId' AND ec.entity='courses' AND ec.archived=0 JOIN emis_subject_links sl ON sl.org_id=ec.org_id AND sl.record_id=ec.id JOIN courses c ON c.org_id=sl.org_id AND c.subject_id=sl.subject_id WHERE e.org_id=? AND e.entity='exams' AND e.archived=0 AND c.id IN (${placeholders}) ORDER BY e.year DESC,name`,[org,...ids],db):[];
 // School administrators can send weighted course grades to EMIS as internal (practical) marks.
 const school=member.role==='admin'&&member.kind==='school';
 const schoolTerms=school?await rows("SELECT id,year,data->>'$.name' name,data->>'$.status' status FROM emis_records WHERE org_id=? AND entity='terms' AND archived=0 ORDER BY year DESC,name",[org],db):[];
 const schoolSubjects=school?await rows("SELECT s.id,s.year,s.data->>'$.name' name,CAST(s.data->>'$.practicalFull' AS DECIMAL(8,2)) practicalFull,CONCAT(c.data->>'$.name',CASE WHEN c.data->>'$.section' IS NULL OR c.data->>'$.section'='' THEN '' ELSE CONCAT(' · ',c.data->>'$.section') END) className FROM emis_records s JOIN emis_records c ON c.org_id=s.org_id AND c.id=s.data->>'$.classId' WHERE s.org_id=? AND s.entity='subjects' AND s.archived=0 AND CAST(s.data->>'$.practicalFull' AS DECIMAL(8,2))>0 ORDER BY s.year DESC,className,name",[org],db):[];
 return {...empty,rows:report,exams:exams.map(e=>({...e,max:Number(e.max)})) as JourneyData['exams'],schoolTerms:schoolTerms as JourneyData['schoolTerms'],schoolSubjects:schoolSubjects.map(x=>({...x,practicalFull:Number(x.practicalFull)})) as JourneyData['schoolSubjects']};
}
