import {z} from 'zod';
import {identity,readJson,checkWrite,boundedBody,respond,failure,AppError} from '@/lib/platform-server';
import {uuid,briefSchema,author,library,inspect,createDeck,refreshDeck,deckFile,uploadReview,publishCopy} from '@/lib/gamma-decks';
import {throttle} from '@/lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){try{const u=await identity(),q=new URL(req.url).searchParams,org=uuid.parse(q.get('org')),id=q.get('id');if(id){uuid.parse(id);return q.get('file')==='1'?await deckFile(org,u.userId,id):respond({deck:await inspect(org,u.userId,id)});}const page=z.coerce.number().int().min(0).max(10000).parse(q.get('page')||0);return respond(await library(org,u.userId,page*20));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const u=await identity(),b=await readJson(req,65000),org=uuid.parse(b.orgId);
 if(b.action==='create'){if(b.confirm!==true)throw new AppError('Confirm sending this brief to Gamma and using its credits.');return respond({deck:await createDeck(org,u.userId,uuid.parse(b.requestId),briefSchema.parse(b.brief))},201);}
 const id=uuid.parse(b.id);if(b.action==='refresh'||b.action==='export')return respond({deck:await refreshDeck(org,u.userId,id,b.action==='export')});
 if(b.action==='share'||b.action==='withdraw'){if(b.action==='share'&&b.reviewed!==true)throw new AppError('Review the PowerPoint and confirm before publishing.');return respond({deck:await publishCopy(org,u.userId,id,uuid.parse(b.courseId),b.action==='withdraw',b.action==='share'?z.string().regex(/^[0-9a-f]{64}$/).parse(b.revision):undefined)});}
 throw new AppError('Unknown presentation action.');
 }catch(e){return failure(e);}}
export async function PUT(req:Request){try{checkWrite(req);const u=await identity(),q=new URL(req.url).searchParams,org=uuid.parse(q.get('org')),id=uuid.parse(q.get('id'));await author(org,u.userId);const d=await inspect(org,u.userId,id);if(d.state!=='ready')throw new AppError('Wait for the generated deck to finish.',409);await throttle('gamma-upload:'+u.userId,20);return respond({deck:await uploadReview(org,u.userId,id,await boundedBody(req,20*1024*1024))});}catch(e){return failure(e);}}
