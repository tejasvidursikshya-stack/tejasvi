import { normalizeLogo } from '@/lib/logo';
import { z } from 'zod';
import { one,run } from '@/lib/db';
import { identity,membership,requireAdmin,checkWrite,boundedBody,AppError,respond,failure } from '@/lib/platform-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const color=z.string().regex(/^#[0-9a-f]{6}$/i),schema=z.object({platformName:z.string().trim().max(120),primaryColor:color,accentColor:color,welcomeText:z.string().trim().max(240)});
export async function GET(_:Request,{params}:{params:Promise<{orgId:string}>}){try{const id=z.string().uuid().parse((await params).orgId),row=await one('SELECT logo_data FROM organizations WHERE id=?',[id]);if(!row?.logo_data)return new Response(null,{status:404});return new Response(new Uint8Array(row.logo_data),{headers:{'Content-Type':'image/webp','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}catch(e){return failure(e)}}
export async function POST(request:Request,{params}:{params:Promise<{orgId:string}>}){try{
 checkWrite(request);const user=await identity(),id=z.string().uuid().parse((await params).orgId);requireAdmin(await membership(id,user.userId));
 const bytes=await boundedBody(request,2300000);const form=await new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body:bytes as BodyInit}).formData();
 const data=schema.parse(Object.fromEntries(form)),file=form.get('logo');let logo:Buffer|null=null;
 if(file instanceof File&&file.size){if(file.size>2000000)throw new AppError('Logo must be under 2 MB.');try{logo=await normalizeLogo(Buffer.from(await file.arrayBuffer()))}catch{throw new AppError('Choose a valid PNG, JPEG or WebP logo, up to 16 megapixels.')}}
 const remove=form.get('removeLogo')==='true';await run(`UPDATE organizations SET platform_name=?,primary_color=?,accent_color=?,welcome_text=?,branding_version=branding_version+1${logo||remove?',logo_data=?':''} WHERE id=?`,[data.platformName,data.primaryColor,data.accentColor,data.welcomeText,...(logo||remove?[logo]:[]),id]);return respond({ok:true});
}catch(e){return failure(e)}}
