import {studioIntent} from '@/lib/studio-intent';
import {NextResponse} from 'next/server';
import {getUser} from '@/lib/auth';
import {one} from '@/lib/db';
import {selectBrand} from '@/lib/branding';
import {loginDestination} from '@/lib/login-destination';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{org:string}>}){
 const url=new URL(process.env.APP_URL||'http://localhost:3000'),go=(p:string)=>NextResponse.redirect(new URL(p,url),{status:303,headers:{'Cache-Control':'private, no-store'}});
 const user=await getUser();if(!user)return go('/login');if(user.mustChangePassword)return go('/change-password');const {org}=await params;
 const m=await one('SELECT o.id,o.kind,m.role,r.role erpRole FROM organizations o JOIN institution_memberships m ON m.org_id=o.id LEFT JOIN emis_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id WHERE o.id=? AND m.user_id=? AND m.active=1',[org,user.userId]);if(!m)return new Response('Workspace access denied.',{status:403});
 const dest=m.role==='ops'&&m.erpRole&&['school','college'].includes(m.kind)?'/erp/'+m.id+'/':loginDestination({kind:m.kind,role:m.role},false);if(!dest)return go('/workspaces');await selectBrand(m.id);const q=new URL(req.url).searchParams,intent=studioIntent(q.get('studio'),q.get('output'));if(q.get('view')==='students'&&m.role==='admin'&&['school','college'].includes(m.kind)){const out=new URLSearchParams({view:'students'}),year=q.get('year'),record=q.get('record');if(year&&/^\d{4}\/\d{2}$/.test(year))out.set('year',year);if(record&&/^[A-Za-z0-9-]{1,64}$/.test(record))out.set('record',record);return go(dest+'?'+out.toString());}return go(dest+(intent&&['teacher','admin'].includes(m.role)?intent.query:q.get('ai')==='ask'&&['admin','teacher','student','employee'].includes(m.role)?'?ai=ask':''));
}
