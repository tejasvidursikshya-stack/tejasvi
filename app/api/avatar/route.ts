import {z} from 'zod';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {aiAccess} from '@/lib/ai-access';
import {mintLiveAvatar} from '@/lib/liveavatar-provider';
import {throttle} from '@/lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await identity(),org=z.string().uuid().parse(new URL(request.url).searchParams.get('org')),m=await membership(org,user.userId);return respond({enabled:(await aiAccess(org,m.role)).access.avatar})}catch(e){return failure(e)}}
export async function POST(request:Request){try{
 const user=await identity(),d=z.object({orgId:z.string().uuid(),language:z.enum(['English','Nepali']),confirm:z.literal(true)}).parse(await readJson(request,2000)),m=await membership(d.orgId,user.userId);
 if(!(await aiAccess(d.orgId,m.role)).access.avatar)throw new AppError('Video avatar is not enabled for this school and role. Ask your administrator to check Tejasvi AI → Connections.',409);
 await throttle('avatar-user:'+user.userId,4);await throttle('avatar-org:'+d.orgId,12);await throttle('avatar-global',30);
 const ticket=await mintLiveAvatar(d.language);
 const current=await membership(d.orgId,user.userId);if(current.role!==m.role||!(await aiAccess(d.orgId,current.role)).access.avatar)throw new AppError('Your school access changed. Refresh and try again.',403);
 return respond(ticket);
}catch(e){if(e instanceof Error&&(e.name==='TimeoutError'||e.name==='TypeError'))return failure(new AppError('Unable to reach LiveAvatar. Check your internet connection and try again.',502));return failure(e)}}
