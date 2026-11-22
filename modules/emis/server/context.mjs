import {createHash,createHmac} from 'node:crypto';
import {one,many,educational,learningRole,fail,json,currentEnrollment} from '../../../lib/campus-data.mjs';
export const cookieName='tejasvi_campus_session';
export function credentials(cookie,org){const raw=(cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!raw||!/^[a-f0-9]{64}$/.test(raw))throw fail('Sign in to Tejasvi to continue.',401);return {hash:createHash('sha256').update(raw).digest('hex'),csrf:createHmac('sha256',raw).update('emis:'+org).digest('hex')};}
export async function actor(c,org,auth){
 const session=await one(c,'SELECT u.id,u.email,u.name,u.platform_admin,u.must_change_password FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3)',[auth.hash]);if(!session)throw fail('Your session has ended. Sign in again.',401);return member(c,org,session,auth.csrf);
}
/** EMIS actor for a user already authenticated by another channel (the mobile API). */
export async function actorForUser(c,org,userId){
 const session=await one(c,'SELECT id,email,name,platform_admin,must_change_password FROM users WHERE id=?',[userId]);if(!session)throw fail('Your session has ended. Sign in again.',401);return member(c,org,session,'');
}
async function member(c,org,session,csrf){
 if(session.must_change_password)throw fail('Change your temporary password before accessing your workspace.',428);
 const r=await one(c,'SELECT o.kind,m.role learning_role,m.display_name,r.* FROM organizations o JOIN institution_memberships m ON m.org_id=o.id JOIN emis_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id WHERE o.id=? AND m.user_id=? AND m.active=1',[org,session.id]);
 if(!r||!educational(r.kind)||learningRole(r.role)!==r.learning_role)throw fail('EMIS is available only to authorized members of this school or college.',403);
 const studentId=r.student_id?await currentEnrollment(c,org,r.student_id):null;if(r.role==='Student'||r.role==='Faculty'){const anchor=await one(c,'SELECT data,archived FROM emis_records WHERE org_id=? AND id=? AND entity=?',[org,studentId||r.faculty_id,r.role==='Student'?'students':'faculty']);if(!anchor||anchor.archived||json(anchor.data).status!=='Active')throw fail('An active institution directory record is required.',403);}
 const childPersonIds=r.role==='Parent'?(await many(c,'SELECT student_person_id p FROM emis_guardians WHERE org_id=? AND user_id=?',[org,session.id])).map(x=>x.p):undefined;if(r.role==='Parent'&&(r.kind!=='school'||!childPersonIds.length))throw fail('Parent access is not linked to any student. Contact the school office.',403);
 return {id:session.id,name:r.display_name||session.name,email:session.email,role:r.role,childPersonIds,studentId,facultyId:r.faculty_id,programId:r.program_id,active:true,platformAdmin:!!session.platform_admin,learningRole:r.learning_role,csrf};
}
