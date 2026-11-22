import {one,rows,type DB} from './db';
import {membership,AppError} from './platform-server';
export async function provider(org:string,user:string){const m=await membership(org,user);if(m.kind!=='edtech'||!['admin','teacher','student'].includes(m.role))throw new AppError('Open an EdTech provider workspace.',403);return m}
export async function providerBatch(org:string,batch:string,user:string,edit=false,db?:DB){
 const m=await provider(org,user),b=await one('SELECT e.*,b.name FROM edtech_batches e JOIN batches b ON b.id=e.batch_id WHERE e.batch_id=? AND e.org_id=?',[batch,org],db);
 if(!b)throw new AppError('Batch not found in this provider.',404);
 if(m.role==='admin')return {b,m};
 const table=m.role==='teacher'?'edtech_teachers':'batch_members';
 if(edit&&m.role!=='teacher'||!await one(`SELECT user_id FROM ${table} WHERE batch_id=? AND user_id=?`,[batch,user],db))throw new AppError('This batch is not assigned to you.',403);
 return {b,m};
}
export async function providerRoster(org:string,batch:string,db?:DB){return rows("SELECT u.id,COALESCE(NULLIF(m.display_name,''),u.name) name,u.email,m.reference_number FROM batch_members bm JOIN memberships m ON m.user_id=bm.user_id AND m.org_id=? AND m.role='student' JOIN users u ON u.id=m.user_id WHERE bm.batch_id=? ORDER BY name,u.id",[org,batch],db)}
