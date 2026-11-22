import {one} from './db';
import {coursePermission} from './course-access';
import {membership,AppError} from './platform-server';
export async function unitPermission(id:string,userId:string,edit=false){
 const unit=await one('SELECT * FROM course_units WHERE id=?',[id]);
 if(!unit)throw new AppError('Unit not found.',404);
 const course=await coursePermission(unit.course_id,userId,edit),member=await membership(course.org_id,userId);
 const staff=['admin','teacher'].includes(member.role);
 if(!staff&&unit.status!=='published')throw new AppError('This unit is not published.',403);
 return {unit,course,member,staff};
}
