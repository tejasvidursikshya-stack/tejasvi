import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {one,run,transaction} from '@/lib/db';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {inbox,availableBatches} from '@/lib/notifications';
export const runtime='nodejs';export const dynamic='force-dynamic';
const id=z.string().uuid();
export async function GET(request:Request){try{const u=await identity(),org=id.parse(new URL(request.url).searchParams.get('org')),m=await membership(org,u.userId);const items=await inbox(org,u.userId,m);return respond({items,unread:items.filter(i=>!i.read).length,batches:await availableBatches(org,u.userId,m.role),staff:['admin','teacher'].includes(m.role),role:m.role,userId:u.userId,limits:'Latest 100 announcements, 150 assessments/submissions, 100 units, 100 lessons and 100 upcoming live classes and 100 timetable sessions.'})}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const u=await identity(),body=await readJson(request),org=id.parse(body.orgId),m=await membership(org,u.userId),action=z.enum(['read','announce','withdraw']).parse(body.action);
 if(action==='read'){
  const keys=z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(1200).parse(body.ids),allowed=new Set((await inbox(org,u.userId,m)).map(i=>i.id));
  if(keys.some(k=>!allowed.has(k)))throw new AppError('Some updates are no longer available. Refresh the inbox.',409);
  await transaction(async c=>{for(const key of new Set(keys))await run('INSERT IGNORE INTO notification_reads(org_id,user_id,item_key) VALUES(?,?,?)',[org,u.userId,key],c)});return respond({ok:true});
 }
 if(!['admin','teacher'].includes(m.role))throw new AppError('Teaching access is required.',403);
 if(action==='withdraw'){const a=await one('SELECT author_id FROM announcements WHERE id=? AND org_id=?',[id.parse(body.id),org]);if(!a||(m.role!=='admin'&&a.author_id!==u.userId))throw new AppError('Announcement unavailable.',403);await run('UPDATE announcements SET withdrawn=TRUE WHERE id=? AND org_id=?',[body.id,org]);return respond({ok:true})}
 const d=z.object({title:z.string().trim().min(1).max(160),body:z.string().trim().min(1).max(5000),batchIds:z.array(id).min(1).max(20)}).parse(body),allowed=new Set((await availableBatches(org,u.userId,m.role)).map(b=>b.id));
 if(d.batchIds.some(b=>!allowed.has(b)))throw new AppError('Choose only batches assigned to you in this organization.',403);
 const aid=randomUUID();await transaction(async c=>{await run('INSERT INTO announcements(id,org_id,author_id,title,body) VALUES(?,?,?,?,?)',[aid,org,u.userId,d.title,d.body],c);for(const batch of new Set(d.batchIds))await run('INSERT INTO announcement_batches(announcement_id,batch_id) VALUES(?,?)',[aid,batch],c)});return respond({ok:true},201);
}catch(e){return failure(e)}}
