// Keep scope checks shared between the new college workspace and legacy tools.
export function matchingSemester(subjectSemester:string|null|undefined,batchSemester:string|null|undefined){return !subjectSemester||subjectSemester===batchSemester}
export function deadlinePassed(a:{due_at?:string|null;due_date?:string|null},now=Date.now()){
 const end=a.due_at?Date.parse(a.due_at.replace(' ','T').replace(/Z$/,'')+'Z'):a.due_date?Date.parse(a.due_date+'T23:59:59.999Z'):Infinity;
 return now>end;
}
export function referenceUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
export function learningHours(minutes:number){return Math.round(minutes/60*100)/100}
export function teacherRosterClause(){return "EXISTS(SELECT 1 FROM course_batches cb JOIN (SELECT batch_id,user_id,subject_id FROM teacher_assignments UNION ALL SELECT batch_id,user_id,NULL AS subject_id FROM edtech_teachers) ta ON ta.batch_id=cb.batch_id JOIN batch_members bm ON bm.batch_id=cb.batch_id AND bm.user_id=u.id WHERE cb.course_id=c.id AND ta.user_id=? AND (c.subject_id IS NULL OR (ta.subject_id=c.subject_id AND EXISTS(SELECT 1 FROM student_subjects ss WHERE ss.batch_id=cb.batch_id AND ss.user_id=u.id AND ss.subject_id=c.subject_id))))"}
