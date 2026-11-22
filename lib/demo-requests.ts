import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {identity,throttle} from './auth';
import {one,rows,run} from './db';
import {AppError} from './errors';
import {demoAudiences,reference,type DemoAudience,type RequestStatus} from './demo-options';
import {loginSource} from './login-source';

const line=(max:number)=>z.string().trim().min(1).max(max).refine(v=>!/[\u0000-\u001f\u007f]/u.test(v));
export const intake=z.object({
 requestId:z.string().uuid(),name:line(100),email:z.string().trim().email().max(200).transform(v=>v.toLowerCase()),
 institution:line(160),audience:z.enum(demoAudiences),interests:z.string().trim().max(600).default(''),
 consent:z.literal(true),website:z.literal('').optional()
}).strict();
type Prior={id:string;payload_hash:string};
export async function saveRequest(body:unknown,req:Request){
 const b=intake.parse(body),fingerprint=createHash('sha256').update(JSON.stringify([b.name,b.email,b.institution,b.audience,b.interests])).digest('hex');
 const find=()=>one<Prior>('SELECT id,payload_hash FROM demo_requests WHERE request_key=?',[b.requestId]);
 const receipt=(row:Prior)=>{if(row.payload_hash!==fingerprint)throw new AppError('This submission changed. Reopen the form to start a new request.',409);return {reference:reference(row.id)};};
 // A valid retry returns the same receipt even if the first response was lost.
 const previous=await find();if(previous)return receipt(previous);
 const source=loginSource(req);if(source)await throttle('demo-source:'+source,12);
 await throttle('demo-intake-total',160);await throttle('demo-email:'+b.email,5);
 const id=randomUUID();
 try{await run('INSERT INTO demo_requests (id,request_key,payload_hash,contact_name,contact_email,organization_name,audience,interests,consent_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))',[id,b.requestId,fingerprint,b.name,b.email,b.institution,b.audience,b.interests]);}catch(e){if((e as {code?:string}).code==='ER_DUP_ENTRY'){const prior=await find();if(prior)return receipt(prior);}throw e;}
 return {reference:reference(id)};
}
export async function ownerOnly(){const u=await identity();if(!u.platformAdmin)throw new AppError('This inbox is available to the platform Super Admin only.',403);return u;}
export type InboxEntry={id:string;contact_name:string;contact_email:string;organization_name:string;audience:DemoAudience;interests:string;status:RequestStatus;created_at:string};
export async function inbox(status:RequestStatus|'all',page:number){
 const take=20,offset=(page-1)*take;
 if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw new AppError('Invalid inbox page.');
 const data=await rows<InboxEntry>('SELECT id,contact_name,contact_email,organization_name,audience,interests,status,created_at FROM demo_requests '+(status==='all'?'':'WHERE status=? ')+'ORDER BY created_at DESC,id DESC LIMIT 21 OFFSET '+offset,status==='all'?[]:[status]);
 return {entries:data.slice(0,take),more:data.length>take};
}
export async function setRequestStatus(id:string,status:RequestStatus,previous:RequestStatus){
 const result=await run('UPDATE demo_requests SET status=?,updated_at=UTC_TIMESTAMP(3) WHERE id=? AND status=?',[status,id,previous]);
 if(!result.affectedRows){const row=await one<{status:RequestStatus}>('SELECT status FROM demo_requests WHERE id=?',[id]);if(!row)throw new AppError('Demo request not found.',404);if(row.status!==status)throw new AppError('Another administrator updated this request. Refresh the inbox.',409);}
}
