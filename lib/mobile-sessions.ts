import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {one,run,transaction,type DB} from './db';
import {AppError} from './errors';
import type {User} from './auth';

const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const token=(kind:'a'|'r')=>'tjm_'+kind+'_'+randomBytes(32).toString('hex');
export const mobileAccessLifetime=15*60;
const refreshDays=30;
export function mobileUserDto(u:Record<string,any>):User{return {userId:u.id,email:u.email,displayName:u.name,platformAdmin:!!u.platform_admin,mustChangePassword:!!u.must_change_password};}

// A parent session ties mobile revocation to all existing password-reset paths.
// Only digests are stored; device tokens are never accepted as browser cookies.
export async function createMobileSession(userId:string,deviceName:string,db:DB){
 const id=randomUUID(),accessToken=token('a'),refreshToken=token('r'),parentHash=hash(randomBytes(32).toString('hex'));
 const accessExpiresAt=new Date(Date.now()+mobileAccessLifetime*1000),refreshExpiresAt=new Date(Date.now()+refreshDays*86400000);
 await run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[parentHash,userId,refreshExpiresAt],db);
 await run('INSERT INTO mobile_sessions(id,user_id,parent_hash,access_hash,refresh_hash,device_name,access_expires_at,refresh_expires_at) VALUES(?,?,?,?,?,?,?,?)',[id,userId,parentHash,hash(accessToken),hash(refreshToken),deviceName,accessExpiresAt,refreshExpiresAt],db);
 return {accessToken,refreshToken,expiresIn:mobileAccessLifetime,refreshExpiresAt:refreshExpiresAt.toISOString()};
}
export async function mobileUser(authorization:string|null):Promise<User|null>{
 if(!authorization?.match(/^Bearer tjm_a_[a-f0-9]{64}$/))return null;
 const row=await one('SELECT u.* FROM mobile_sessions m JOIN sessions s ON s.token_hash=m.parent_hash AND s.user_id=m.user_id JOIN users u ON u.id=m.user_id WHERE m.access_hash=? AND m.access_expires_at>UTC_TIMESTAMP(3) AND m.refresh_expires_at>UTC_TIMESTAMP(3) AND s.expires_at>UTC_TIMESTAMP(3)',[hash(authorization.slice(7))]);
 return row?mobileUserDto(row):null;
}
export async function refreshMobileSession(refreshToken:string){
 if(!/^tjm_r_[a-f0-9]{64}$/.test(refreshToken))throw new AppError('Please sign in again.',401);
 return transaction(async db=>{
  const current=await one('SELECT m.* FROM mobile_sessions m JOIN sessions s ON s.token_hash=m.parent_hash AND s.user_id=m.user_id WHERE m.refresh_hash=? AND m.refresh_expires_at>UTC_TIMESTAMP(3) AND s.expires_at>UTC_TIMESTAMP(3) FOR UPDATE',[hash(refreshToken)],db);
  if(!current)throw new AppError('Your device session expired or was revoked. Sign in again.',401);
  const accessToken=token('a'),nextRefresh=token('r');
  await run('UPDATE mobile_sessions SET access_hash=?,refresh_hash=?,access_expires_at=?,refreshed_at=UTC_TIMESTAMP(3) WHERE id=?',[hash(accessToken),hash(nextRefresh),new Date(Date.now()+mobileAccessLifetime*1000),current.id],db);
  const user=await one('SELECT * FROM users WHERE id=?',[current.user_id],db);
  return {accessToken,refreshToken:nextRefresh,expiresIn:mobileAccessLifetime,user:mobileUserDto(user!)};
 });
}
export async function revokeMobileSession(refreshToken:string){
 if(!/^tjm_r_[a-f0-9]{64}$/.test(refreshToken))throw new AppError('Invalid device session.',400);
 await transaction(async db=>{
  const current=await one('SELECT parent_hash FROM mobile_sessions WHERE refresh_hash=? FOR UPDATE',[hash(refreshToken)],db);
  if(current)await run('DELETE FROM sessions WHERE token_hash=?',[current.parent_hash],db);
 });
}
