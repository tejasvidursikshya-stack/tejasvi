// Mobile push notifications. Opt-in per server: set MOBILE_PUSH=expo in .env
// to send through Expo's push service (it forwards to Apple and Google).
// Every minute the dispatcher compares each signed-in device's notification
// inbox (the same items, permissions and read state as the website) with what
// it already pushed, and sends only new items. Tokens belong to a mobile
// session, so signing out or changing the password removes them.
import {createHash} from 'node:crypto';
import {one,rows,run} from './db';
import {inbox} from './notifications';
import {chunks,deadTokens,EXPO_PUSH_URL,freshItems,messagesFor,tokenPattern} from './mobile-push-rules.mjs';
import {AppError} from './errors';

export const pushEnabled=()=>process.env.MOBILE_PUSH==='expo';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
type Member={id:string;name:string;kind:string;role:string};

async function memberships(userId:string):Promise<Member[]>{
 return rows<Member>("SELECT o.id,o.name,o.kind,m.role FROM organizations o JOIN memberships m ON m.org_id=o.id WHERE m.user_id=? AND m.role IN ('admin','teacher','student','employee')",[userId]);
}

/** Marks everything currently in the user's inboxes as already pushed, so a new device is not flooded. */
async function baseline(userId:string){
 for(const m of await memberships(userId)){
  const items=await inbox(m.id,userId,{role:m.role,kind:m.kind});
  for(const part of chunks(items.map(i=>i.id),200)){
   if(!part.length)continue;
   await run(`INSERT IGNORE INTO mobile_push_sent(user_id,org_id,item_key) VALUES ${part.map(()=>'(?,?,?)').join(',')}`,part.flatMap((k:string)=>[userId,m.id,k]));
  }
 }
}

/** Saves this device's push token for the signed-in mobile session. */
export async function registerPushToken(authorization:string,userId:string,token:string,platform:string){
 if(!tokenPattern.test(token))throw new AppError('This device did not provide a valid notification token.');
 if(!['ios','android'].includes(platform))throw new AppError('Unsupported device platform.');
 const session=await one<{id:string}>('SELECT id FROM mobile_sessions WHERE access_hash=? AND user_id=?',[hash(authorization.replace(/^Bearer /,'')),userId]);
 if(!session)throw new AppError('Please sign in to continue.',401);
 await run('DELETE FROM mobile_push_tokens WHERE token=? OR mobile_session_id=?',[token,session.id]);
 await run('INSERT INTO mobile_push_tokens(token,mobile_session_id,user_id,platform) VALUES(?,?,?,?)',[token,session.id,userId,platform]);
 await baseline(userId);
 return {enabled:pushEnabled()};
}

export async function unregisterPushToken(userId:string,token:string){
 await run('DELETE FROM mobile_push_tokens WHERE token=? AND user_id=?',[token,userId]);
}

async function send(messages:Record<string,unknown>[]){
 for(const batch of chunks(messages,100)){
  try{
   const response=await fetch(EXPO_PUSH_URL,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json',...(process.env.EXPO_ACCESS_TOKEN?{Authorization:'Bearer '+process.env.EXPO_ACCESS_TOKEN}:{})},body:JSON.stringify(batch),redirect:'error',signal:AbortSignal.timeout(20000)});
   if(!response.ok){console.error('Tejasvi push: Expo returned',response.status);continue;}
   const tickets=((await response.json()) as {data?:unknown[]}).data||[];
   for(const token of deadTokens(batch,tickets))await run('DELETE FROM mobile_push_tokens WHERE token=?',[token]);
  }catch{console.error('Tejasvi push: Expo could not be reached');}
 }
}

/** One pass: push new inbox items to every device with a live session. */
export async function dispatchPush(now=Date.now()){
 const devices=await rows<{user_id:string;token:string}>(`SELECT t.user_id,t.token FROM mobile_push_tokens t JOIN mobile_sessions m ON m.id=t.mobile_session_id JOIN sessions s ON s.token_hash=m.parent_hash WHERE m.refresh_expires_at>UTC_TIMESTAMP(3) AND s.expires_at>UTC_TIMESTAMP(3)`);
 const byUser=new Map<string,string[]>();for(const d of devices)byUser.set(d.user_id,[...(byUser.get(d.user_id)||[]),d.token]);
 const messages:Record<string,unknown>[]=[];
 for(const [userId,tokens] of byUser){
  for(const m of await memberships(userId)){
   const items=await inbox(m.id,userId,{role:m.role,kind:m.kind});
   const sent=new Set((await rows<{item_key:string}>('SELECT item_key FROM mobile_push_sent WHERE user_id=? AND org_id=?',[userId,m.id])).map(r=>r.item_key));
   // Newest few only; the rest are still in the app's inbox.
   const fresh=freshItems(items,sent,now).slice(0,5);
   for(const item of fresh){
    // Record first: a push is sent at most once even if sending fails.
    await run('INSERT IGNORE INTO mobile_push_sent(user_id,org_id,item_key) VALUES(?,?,?)',[userId,m.id,item.id]);
    messages.push(...messagesFor(item,m.id,m.name,tokens));
   }
  }
 }
 await run('DELETE FROM mobile_push_sent WHERE sent_at<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 90 DAY)');
 if(messages.length)await send(messages);
 return messages.length;
}

const state=globalThis as unknown as {tejasviPushTimer?:NodeJS.Timeout};
/** Starts the once-a-minute dispatcher (server start only, and only when enabled). */
export function startPushDispatcher(){
 if(!pushEnabled()||state.tejasviPushTimer)return;
 let running=false;
 state.tejasviPushTimer=setInterval(async()=>{
  if(running)return;running=true;
  try{await dispatchPush()}catch(e){console.error('Tejasvi push: dispatch failed',(e as {code?:string})?.code||'')}
  finally{running=false}
 },60000);
 state.tejasviPushTimer.unref?.();
 console.log('Tejasvi push notifications: on (Expo)');
}
