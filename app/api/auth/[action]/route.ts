import {randomUUID,timingSafeEqual} from 'node:crypto';
import {loginSource} from '@/lib/login-source';
import { selectBrand,memberBrand,brandCookie } from '@/lib/branding';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { one, run, transaction } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { cookieName, digest, getUser, identity, issueSession, setSession, signOut, throttle } from '@/lib/auth';
import { AppError, readJson, respond, failure } from '@/lib/errors';
import { loginDestination } from '@/lib/login-destination';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const password=z.string().min(12).max(128);
export async function GET(_request:Request,{params}:{params:Promise<{action:string}>}){try{if((await params).action!=='me')throw new AppError('Not found.',404);const user=await getUser();return respond({user})}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:{params:Promise<{action:string}>}){try{
 const {action}=await params,body=await readJson(request,4096);
 if(action==='setup'){
  const state=await one('SELECT owner_claimed FROM tejasvi_clean_install WHERE id=1');
  if(!state||state.owner_claimed)throw new AppError('The Super Admin has already been created. Sign in instead.',409);
  const data=z.object({token:z.string().max(100),name:z.string().trim().min(1).max(120),email:z.string().trim().email().max(200),password}).strict().parse(body);
  const key=process.env.TEJASVI_FIRST_OWNER_KEY,token=Buffer.from(data.token);if(!key||!(/^[0-9a-f]{36}$/.test(key))||token.length!==Buffer.byteLength(key)||!timingSafeEqual(token,Buffer.from(key)))throw new AppError('Use the private setup link printed in this app’s Terminal window.',403);
  const hash=await hashPassword(data.password),id=randomUUID();
  const session=await transaction(async c=>{const locked=await one('SELECT owner_claimed FROM tejasvi_clean_install WHERE id=1 FOR UPDATE',[],c);if(!locked||locked.owner_claimed||await one('SELECT id FROM users LIMIT 1',[],c))throw new AppError('The Super Admin has already been created. Sign in instead.',409);
    await run('INSERT INTO users(id,name,email,password_hash,platform_admin) VALUES(?,?,?,?,1)',[id,data.name,data.email.toLowerCase(),hash],c);await run('UPDATE tejasvi_clean_install SET owner_claimed=1 WHERE id=1',[],c);return issueSession(id,c);});
  await setSession(session);return respond({redirect:'/workspace/start'},201);
 }
 if(action==='login'){
  const data=z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(128),orgId:z.string().uuid().optional()}).parse(body),email=data.email.toLowerCase();
  const source=loginSource(request);if(source)await throttle('login-source:'+source,100);
  await throttle('login:'+email,10);
  const row=await one('SELECT * FROM users WHERE email=?',[email]);
  if(!row){await verifyPassword(data.password,'scrypt:00000000000000000000000000000000:'+ '0'.repeat(128));throw new AppError('Email or password is incorrect.',401)}
  if(!await verifyPassword(data.password,row.password_hash))throw new AppError('Email or password is incorrect.',401);
  const member=data.orgId?await one('SELECT o.id,o.kind,m.role FROM memberships m JOIN organizations o ON o.id=m.org_id WHERE m.user_id=? AND o.id=?',[row.id,data.orgId]):await memberBrand(row.id);
  const ops=await one("SELECT m.org_id id FROM institution_memberships m JOIN organizations o ON o.id=m.org_id JOIN emis_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id WHERE m.active=1 AND m.role='ops' AND o.kind IN('school','college') AND m.user_id=? AND (?='' OR m.org_id=?) ORDER BY o.name LIMIT 1",[row.id,data.orgId||'',data.orgId||'']);
  if(data.orgId&&!member&&!ops)throw new AppError('This account does not have access to this organization.',403);
  const destination=member?'/workspaces':ops?'/erp/'+ops.id+'/':loginDestination(null,!!row.platform_admin);
  if(!destination)throw new AppError('Your account has no active workspace. Contact your administrator.',403);
  if(member)await selectBrand(member.id);else (await cookies()).delete(brandCookie);
  const old=(await cookies()).get(cookieName)?.value;if(old)await run('DELETE FROM sessions WHERE token_hash=?',[digest(old)]);
  await setSession(await issueSession(row.id));await run('DELETE FROM rate_limits WHERE bucket=?',[digest('login:'+email)]);
  return respond({redirect:row.must_change_password?'/change-password':destination});
 }
 if(action==='logout'){await signOut();return respond({redirect:'/login'})}
 if(action==='change-password'){
  const user=await identity(true),data=z.object({currentPassword:z.string().max(128),newPassword:password}).parse(body);await throttle('password:'+user.userId,10);
  const account=await one('SELECT password_hash FROM users WHERE id=?',[user.userId]);if(!account||!await verifyPassword(data.currentPassword,account.password_hash))throw new AppError('Your current password is incorrect.',400);
  if(data.currentPassword===data.newPassword)throw new AppError('Choose a different password.');
  const hashed=await hashPassword(data.newPassword);const session=await transaction(async c=>{await run('UPDATE users SET password_hash=?,must_change_password=FALSE WHERE id=?',[hashed,user.userId],c);await run('DELETE FROM sessions WHERE user_id=?',[user.userId],c);return issueSession(user.userId,c)});await setSession(session);const brand=await memberBrand(user.userId);return respond({redirect:loginDestination(brand as {kind:string;role:string}|null,user.platformAdmin)||'/workspaces'});
 }
 throw new AppError('Not found.',404);
}catch(e){return failure(e)}}
