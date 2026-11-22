import '@/app/workshop-ui.css';
import '@/app/college-suite.css';
import '@/app/ai-workspace.css';
import { memberBrand } from '@/lib/branding';
import {loginDestination} from '@/lib/login-destination';
import { notFound,redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { roles, type RoleKey } from '@/lib/platform-types';
import {EdtechWorkspace} from '@/components/edtech/workspace';
import { Workspace } from '@/components/platform/workspace';
export const dynamic='force-dynamic';
export const metadata={title:'Learning workspace',description:'Your learning workspace',icons:{icon:'/school-icon.svg'}};
async function Protected({role}:{role:RoleKey}){
 const user=await requireUser(role),brand=await memberBrand(user.userId,role);
 if(!brand){
   const available=await memberBrand(user.userId);
   const actual=available?loginDestination({kind:available.kind,role:available.role},user.platformAdmin):null;
   if(actual)redirect(actual);
   redirect(user.platformAdmin?'/workspace/start':'/login');
 }
 return roles[role].kind==='edtech'?<EdtechWorkspace role={role} initialBrand={brand as any}/>:<Workspace role={role} initialBrand={brand as any}/>;
}
export default async function WorkspacePage({params}:{params:Promise<{role:string}>}){const {role}=await params;if(!Object.hasOwn(roles,role))notFound();return <Protected role={role as RoleKey}/>}
