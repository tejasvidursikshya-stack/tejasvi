import {failure,readJson,respond} from '@/lib/errors';
import {saveRequest} from '@/lib/demo-requests';
export async function POST(request:Request){
 try{return respond(await saveRequest(await readJson(request,8192),request),201);}catch(e){return failure(e);}
}
