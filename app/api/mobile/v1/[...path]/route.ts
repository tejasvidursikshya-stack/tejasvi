import {z} from 'zod';
import {one,pool,rows,run,transaction} from '@/lib/db';
import {mobileEmis} from '@/modules/emis/server/mobile.mjs';
import {AppError,boundedBody,failure,respond} from '@/lib/errors';
import {digest,throttle} from '@/lib/auth';
import {loginSource} from '@/lib/login-source';
import {hashPassword,verifyPassword} from '@/lib/password';
import {createMobileSession,mobileUser,mobileUserDto,refreshMobileSession,revokeMobileSession} from '@/lib/mobile-sessions';
import {roles} from '@/lib/platform-types';
import * as platform from '@/app/api/platform/route';
import * as units from '@/app/api/units/route';
import * as assessments from '@/app/api/assessments/route';
import * as materials from '@/app/api/materials/route';
import * as submissionFiles from '@/app/api/submission-files/route';
import * as journey from '@/app/api/learning-journey/route';
import * as notifications from '@/app/api/notifications/route';
import {pushEnabled,registerPushToken,unregisterPushToken} from '@/lib/mobile-push';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
const origin=()=>new URL(process.env.APP_URL||'http://localhost:3000').origin;
async function json(request:Request,limit=4096){
 const from=request.headers.get('origin');if(from&&from!==origin())throw new AppError('This origin is not allowed.',403);
 if(!request.headers.get('content-type')?.includes('application/json'))throw new AppError('Expected JSON.');
 try{return JSON.parse(new TextDecoder().decode(await boundedBody(request,limit)))}catch(e){if(e instanceof AppError)throw e;throw new AppError('Invalid JSON.');}
}
async function memberships(uid:string){return rows("SELECT o.id,o.name,o.kind,m.role FROM organizations o JOIN memberships m ON m.org_id=o.id WHERE m.user_id=? AND m.role IN ('admin','teacher','student','employee') ORDER BY o.name,o.id",[uid]);}
// Only an authenticated mobile request reaches this adapter. Reuse the web
// business rules without weakening browser origin/CSRF checks or trusting roles.
async function forward(request:Request,path:string,body?:unknown){
 const url=new URL('/api/'+path,origin());url.search=new URL(request.url).search;
 const headers=new Headers({'authorization':request.headers.get('authorization')!,'origin':origin(),'x-tejasvi-request':'1'});
 let bytes:Uint8Array|undefined;
 if(request.method==='POST'){
  if(body!==undefined){headers.set('content-type','application/json');bytes=new TextEncoder().encode(JSON.stringify(body));}
  else{headers.set('content-type',request.headers.get('content-type')||'');bytes=await boundedBody(request,6*1024*1024);}
 }
 return new Request(url,{method:request.method,headers,body:bytes?Buffer.from(bytes):undefined});
}
export async function GET(request:Request,ctx:Context){try{
 const path=(await ctx.params).path.join('/');
 if(path==='status')return respond({product:'Tejasvi Campus',version:'3.10.0',mobileApi:1});
 const user=await mobileUser(request.headers.get('authorization'));if(!user)throw new AppError('Please sign in to continue.',401);
 if(path==='bootstrap')return respond({user,organizations:await memberships(user.userId)});
 if(user.mustChangePassword)throw new AppError('Change your temporary password before opening your workspace.',428);
 if(path==='workspace'){
  const selected=new URL(request.url).searchParams.get('org');const member=(await memberships(user.userId)).find(m=>m.id===selected);
  if(!member)throw new AppError('This workspace is not available to your account.',403);
  const role=Object.entries(roles).find(([,v])=>v.kind===member.kind&&v.role===member.role)?.[0];
  if(!role)throw new AppError('This role does not have a learning workspace.',403);
  const req=await forward(request,'platform'),url=new URL(req.url);url.searchParams.set('role',role);
  const response=await platform.GET(new Request(url,req));if(!response.ok)return response;
  const data=await response.json();return respond({user:data.user,organization:data.organization,courses:data.courses,quizzes:data.quizzes,progress:data.progress});
 }
 if(path==='emis'){
  const params=new URL(request.url).searchParams,selected=params.get('org'),year=params.get('year');
  const member=(await memberships(user.userId)).find(m=>m.id===selected);
  if(!member)throw new AppError('This workspace is not available to your account.',403);
  if(member.kind!=='school'&&member.kind!=='college')throw new AppError('EMIS is available for schools and colleges.',404);
  if(year!==null&&!/^\d{4}\/\d{2}$/.test(year))throw new AppError('Choose a valid academic year.');
  return respond(await mobileEmis(pool(),member.id,user.userId,year));
 }
 if(path==='inbox'){
  const response=await notifications.GET(await forward(request,'notifications'));if(!response.ok)return response;
  const data=await response.json();return respond({items:data.items,unread:data.unread,push:pushEnabled()});
 }
 const routes:Record<string,{path:string;get:(r:Request)=>Promise<Response>}>= {
  units:{path:'units',get:units.GET},assessments:{path:'assessments',get:assessments.GET},resources:{path:'materials',get:materials.GET},
  material:{path:'materials',get:materials.GET},'submission-file':{path:'submission-files',get:submissionFiles.GET},progress:{path:'learning-journey',get:journey.GET}
 };
 const route=routes[path];if(!route)throw new AppError('Not found.',404);return route.get(await forward(request,route.path));
}catch(e){return failure(e)}}
export async function POST(request:Request,ctx:Context){try{
 const path=(await ctx.params).path.join('/');
 if(path==='auth/login'){
  const data=z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(128),deviceName:z.string().trim().min(1).max(100).default('Android')}).parse(await json(request)),email=data.email.toLowerCase();
  const source=loginSource(request);if(source)await throttle('login-source:'+source,100);await throttle('login:'+email,10);
  const account=await one('SELECT * FROM users WHERE email=?',[email]);
  const valid=await verifyPassword(data.password,account?.password_hash||'scrypt:00000000000000000000000000000000:'+'0'.repeat(128));
  if(!account||!valid)throw new AppError('Email or password is incorrect.',401);
  if(!(await memberships(account.id)).length&&!account.platform_admin)throw new AppError('Your account has no active learning workspace. Contact your administrator.',403);
  const session=await transaction(async db=>{
   const current=await one('SELECT password_hash FROM users WHERE id=? FOR UPDATE',[account.id],db);
   if(current?.password_hash!==account.password_hash)throw new AppError('Your password changed. Please sign in again.',401);
   return createMobileSession(account.id,data.deviceName,db);
  });
  await run('DELETE FROM rate_limits WHERE bucket=?',[digest('login:'+email)]);
  return respond({...session,user:mobileUserDto(account)});
 }
 if(path==='auth/refresh')return respond(await refreshMobileSession(z.string().max(100).parse((await json(request)).refreshToken)));
 if(path==='auth/logout'){await revokeMobileSession(z.string().max(100).parse((await json(request)).refreshToken));return respond({ok:true});}
 const user=await mobileUser(request.headers.get('authorization'));if(!user)throw new AppError('Please sign in to continue.',401);
 if(path==='auth/change-password'){
  const data=z.object({currentPassword:z.string().max(128),newPassword:z.string().min(12).max(128),deviceName:z.string().trim().max(100).default('Android')}).parse(await json(request));
  await throttle('password:'+user.userId,10);const account=await one('SELECT * FROM users WHERE id=?',[user.userId]);
  if(!account||!await verifyPassword(data.currentPassword,account.password_hash))throw new AppError('Your current password is incorrect.');
  if(data.currentPassword===data.newPassword)throw new AppError('Choose a different password.');
  const hashed=await hashPassword(data.newPassword),session=await transaction(async db=>{
   const current=await one('SELECT password_hash FROM users WHERE id=? FOR UPDATE',[user.userId],db);
   if(current?.password_hash!==account.password_hash)throw new AppError('Your password changed. Please sign in again.',401);
   await run('UPDATE users SET password_hash=?,must_change_password=FALSE WHERE id=?',[hashed,user.userId],db);
   await run('DELETE FROM sessions WHERE user_id=?',[user.userId],db);return createMobileSession(user.userId,data.deviceName,db);
  });return respond({...session,user:{...user,mustChangePassword:false}});
 }
 if(user.mustChangePassword)throw new AppError('Change your temporary password before opening your workspace.',428);
 if(path==='submission-file')return submissionFiles.POST(await forward(request,'submission-files'));
 const body=await json(request,500000);
 if(path==='learning'&&['complete-lesson','submit-quiz'].includes(body.action)){
  if(body.action==='submit-quiz')z.string().uuid().parse(body.quizRevision);
  return platform.POST(await forward(request,'platform',body));
 }
 if(path==='units'&&['complete','quiz'].includes(body.action))return units.POST(await forward(request,'units',body));
 if(path==='assessments'&&['submit','grade','return'].includes(body.action)){
  z.number().int().min(0).parse(body.version);return assessments.POST(await forward(request,'assessments',body));
 }
 if(path==='push/register'){const d=z.object({token:z.string().max(255),platform:z.enum(['ios','android'])}).parse(body);return respond(await registerPushToken(request.headers.get('authorization')!,user.userId,d.token,d.platform));}
 if(path==='push/unregister'){await unregisterPushToken(user.userId,z.string().max(255).parse(body.token));return respond({ok:true});}
 if(path==='inbox/read')return notifications.POST(await forward(request,'notifications',{action:'read',orgId:z.string().uuid().parse(body.orgId),ids:z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(200).parse(body.ids)}));
 throw new AppError('This action is not available in the mobile pilot.',404);
}catch(e){return failure(e)}}
