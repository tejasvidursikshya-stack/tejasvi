import {z} from 'zod';
export const liveClassInput=z.object({id:z.string().uuid().optional(),version:z.number().int().positive().optional(),courseId:z.string().uuid(),title:z.string().trim().min(2).max(160),agenda:z.string().trim().max(3000),meetingUrl:z.string().url().max(2000).refine(s=>{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password},'Use an HTTPS meeting link.'),startsAt:z.string().datetime(),endsAt:z.string().datetime(),status:z.enum(['draft','published','cancelled'])}).refine(d=>Date.parse(d.endsAt)-Date.parse(d.startsAt)>=60000&&Date.parse(d.endsAt)-Date.parse(d.startsAt)<=24*60*60*1000,'A session must last between one minute and 24 hours.').refine(d=>!d.id||!!d.version,'Reload before updating.');
export function liveState(session:{status:string;startsAt:string;endsAt:string},now=Date.now()){
 if(session.status==='cancelled')return 'Cancelled';
 if(session.status==='draft')return 'Draft';
 if(now>=Date.parse(session.endsAt))return 'Ended';
 if(now>=Date.parse(session.startsAt))return 'In session';
 if(now>=Date.parse(session.startsAt)-15*60*1000)return 'Join now';
 return 'Upcoming';
}
