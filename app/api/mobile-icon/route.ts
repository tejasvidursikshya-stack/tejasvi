import {one} from '@/lib/db';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){const u=new URL(request.url),org=u.searchParams.get('org'),size=u.searchParams.get('size')==='512'?512:192;if(!org||!/^[a-f0-9-]{36}$/i.test(org))return new Response('Not found',{status:404});const b=await one('SELECT logo_data FROM organizations WHERE id=?',[org]);if(!b)return new Response('Not found',{status:404});const fallback=()=>readFile(path.join(process.cwd(),'public',`mobile-${size}.png`));const bytes=b.logo_data?await sharp(b.logo_data,{limitInputPixels:16000000}).resize(size,size,{fit:'contain',background:'#ffffff'}).png().toBuffer().catch(fallback):await fallback();return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/png','Cache-Control':'no-store'}})}
