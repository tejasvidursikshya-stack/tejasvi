import {z} from 'zod';
import {failure,readJson,respond} from '@/lib/errors';
import {statuses} from '@/lib/demo-options';
import {ownerOnly,setRequestStatus} from '@/lib/demo-requests';
export async function PATCH(request:Request){
 try{await ownerOnly();const b=z.object({id:z.string().uuid(),status:z.enum(statuses),previous:z.enum(statuses)}).strict().parse(await readJson(request,2048));await setRequestStatus(b.id,b.status,b.previous);return respond({ok:true});}catch(e){return failure(e);}
}
