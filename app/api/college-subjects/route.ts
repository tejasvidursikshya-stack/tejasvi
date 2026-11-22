import {z} from 'zod';
import {one,rows,run,transaction} from '@/lib/db';
import {identity,membership,requireAdmin,readJson,respond,failure,AppError} from '@/lib/platform-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=z.string().uuid();
export async function DELETE(request:Request){try{
 const user=await identity(),d=z.object({orgId:uuid,batchId:uuid,subjectId:uuid,confirmName:z.string().min(1).max(100)}).parse(await readJson(request)),member=await membership(d.orgId,user.userId);requireAdmin(member);if(member.kind!=='college')throw new AppError('Open a college workspace.',403);
 await transaction(async db=>{
  const subject=await one('SELECT * FROM subjects WHERE id=? AND org_id=? FOR UPDATE',[d.subjectId,d.orgId],db);
  const batch=await one('SELECT * FROM batches WHERE id=? AND org_id=? FOR UPDATE',[d.batchId,d.orgId],db);
  if(!subject||!batch||!subject.college_semester_id||subject.college_semester_id!==batch.grade_id)throw new AppError('Choose a subject belonging to this college semester.',403);
  if(d.confirmName!==subject.name)throw new AppError('Type the exact subject name to confirm removal.');
  const libraries=await rows('SELECT id,status FROM courses WHERE subject_id=? FOR UPDATE',[subject.id],db);
  if(libraries.some(c=>c.status!=='draft'))throw new AppError('This subject has published learning. Hide its libraries first; subjects with content or learning records cannot be removed.',409);
  // Inspect every FK, including extensions, before deleting any draft library.
  const refs=await rows("SELECT cl.relname AS table_name,a.attname AS column_name,pc.relname AS parent_table FROM pg_constraint con JOIN pg_class cl ON cl.oid=con.conrelid JOIN pg_class pc ON pc.oid=con.confrelid JOIN pg_namespace n ON n.oid=cl.relnamespace JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=ANY(con.conkey) WHERE con.contype='f' AND n.nspname=current_schema() AND pc.relname IN ('courses','subjects')",[],db);
  for(const ref of refs){if(!/^[a-zA-Z0-9_]+$/.test(ref.table_name)||!/^[a-zA-Z0-9_]+$/.test(ref.column_name))throw new AppError('Unable to verify subject dependencies.',409);
   if(ref.parent_table==='courses'&&ref.table_name==='course_batches')continue;
   if(ref.parent_table==='subjects'&&['courses','batch_subjects','student_subjects','teacher_assignments'].includes(ref.table_name))continue;
   const ids=ref.parent_table==='courses'?libraries.map(c=>c.id):[subject.id];
   for(const id of ids)if(await one(`SELECT 1 FROM \`${ref.table_name}\` WHERE \`${ref.column_name}\`=? LIMIT 1 FOR UPDATE`,[id],db))throw new AppError('This subject has content or learning records. Removal is blocked to preserve lessons, marks, attendance and student work.',409);
  }
  for(const c of libraries){await run('DELETE FROM course_batches WHERE course_id=?',[c.id],db);await run('DELETE FROM courses WHERE id=?',[c.id],db)}
  await run('DELETE FROM student_subjects WHERE subject_id=?',[subject.id],db);
  await run('DELETE FROM teacher_assignments WHERE subject_id=?',[subject.id],db);
  await run('DELETE FROM batch_subjects WHERE subject_id=?',[subject.id],db);
  await run('DELETE FROM subjects WHERE id=? AND org_id=?',[subject.id,d.orgId],db);
 });return respond({ok:true});
}catch(e){return failure(e)}}
