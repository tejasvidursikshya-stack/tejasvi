import { brandCookie,publicBrand } from './branding';
import { roles,type RoleKey } from './platform-types';
import { cookies,headers } from 'next/headers';
import {mobileUser} from './mobile-sessions';
import { redirect } from 'next/navigation';
import { randomBytes, createHash } from 'node:crypto';
import { one, run, type DB } from './db';
import { AppError } from './errors';
export const cookieName='tejasvi_campus_session';
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export type User={userId:string;email:string;displayName:string;platformAdmin:boolean;mustChangePassword:boolean};
export async function getUser():Promise<User|null>{const authorization=(await headers()).get('authorization');if(authorization)return mobileUser(authorization);const token=(await cookies()).get(cookieName)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;const u=await one('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3)',[digest(token)]);return u?{userId:u.id,email:u.email,displayName:u.name,platformAdmin:!!u.platform_admin,mustChangePassword:!!u.must_change_password}:null}
export async function identity(allowPasswordChange=false){const user=await getUser();if(!user)throw new AppError('Please sign in to continue.',401);if(user.mustChangePassword&&!allowPasswordChange)throw new AppError('Change your temporary password before opening your workspace.',428);return user}
export async function requireUser(role:string){const user=await getUser();if(!user){const selected=(await cookies()).get(brandCookie)?.value,brand=selected?await publicBrand(selected):null;const kind=roles[role as RoleKey]?.kind;redirect(`/login${brand&&brand.kind===kind?'?org='+brand.id:''}`)}if(user.mustChangePassword)redirect('/change-password');return user}
export async function issueSession(userId:string,connection?:DB){const token=randomBytes(32).toString('hex');const days=Math.min(30,Math.max(1,Number(process.env.SESSION_DAYS)||7));const expires=new Date(Date.now()+days*86400000);await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[digest(token),userId,expires],connection);return {token,expires}}
export async function setSession(session:{token:string;expires:Date}){(await cookies()).set(cookieName,session.token,{httpOnly:true,secure:(process.env.APP_URL||'').startsWith('https://'),sameSite:'lax',path:'/',expires:session.expires})}
export async function signOut(){const jar=await cookies(),token=jar.get(cookieName)?.value;if(token)await run('DELETE FROM sessions WHERE token_hash=?',[digest(token)]);jar.delete(cookieName)}
export async function throttle(key:string,max=10){const bucket=digest(key),now=Date.now(),until=now+15*60*1000;await run('INSERT INTO rate_limits(bucket,attempts,reset_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE attempts=CASE WHEN reset_at<? THEN 1 ELSE attempts+1 END,reset_at=CASE WHEN reset_at<? THEN ? ELSE reset_at END',[bucket,until,now,now,until]);const row=await one('SELECT attempts FROM rate_limits WHERE bucket=?',[bucket]);if(row&&row.attempts>max)throw new AppError('Too many attempts. Please wait 15 minutes before trying again.',429)}
