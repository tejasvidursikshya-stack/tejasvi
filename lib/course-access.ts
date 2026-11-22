import { one,type DB } from './db';
import { membership } from './platform-server';
import { AppError } from './errors';
// Shared by course reads, downloads, quiz submissions and project submissions.
import { learnerClause,teacherClause } from './course-policy';
export { learnerClause,teacherClause } from './course-policy';
export async function coursePermission(courseId:string,userId:string,edit=false,db?:DB){const course=await one('SELECT * FROM courses WHERE id=?',[courseId],db);if(!course)throw new AppError('Course not found.',404);const m=await membership(course.org_id,userId);if(m.role==='admin')return course;if(m.role==='teacher'){if(!await one(`SELECT c.id FROM courses c WHERE c.id=? AND ${teacherClause()}`,[courseId,userId,userId],db))throw new AppError('You are not assigned to this course.',403);return course}if(!['student','employee'].includes(m.role))throw new AppError('This role cannot access learning content.',403);if(edit)throw new AppError('Teaching access is required.',403);if(course.status!=='published'||!await one(`SELECT c.id FROM courses c WHERE c.id=? AND ${learnerClause()}`,[courseId,userId,userId],db))throw new AppError('This course is not assigned to you.',403);return course}
