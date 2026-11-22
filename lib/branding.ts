import { cookies } from 'next/headers';
import { one } from './db';
import { roles, type RoleKey } from './platform-types';
export const brandCookie='tejasvi_campus_organization';
export const brandColumns="o.platform_name AS platformName,o.primary_color AS primaryColor,o.accent_color AS accentColor,o.welcome_text AS welcomeText,(o.logo_data IS NOT NULL) AS hasLogo,o.branding_version AS brandingVersion";
export async function publicBrand(id:string){if(!/^[a-f0-9-]{36}$/i.test(id))return null;return one(`SELECT o.id,o.name,o.kind,${brandColumns} FROM organizations o WHERE o.id=?`,[id])}
export async function memberBrand(userId:string,role?:RoleKey){const selected=(await cookies()).get(brandCookie)?.value||'';const r=role?roles[role]:null;return one(`SELECT o.id,o.name,o.kind,m.role,${brandColumns} FROM organizations o JOIN memberships m ON m.org_id=o.id WHERE m.user_id=? AND m.role<>'parent'${r?' AND o.kind=? AND (m.role=? OR m.role=?)':''} ORDER BY (o.id=?) DESC,o.created_at LIMIT 1`,[userId,...(r?[r.kind,r.role,'admin']:[]),selected])}
export async function selectBrand(id:string){(await cookies()).set(brandCookie,id,{httpOnly:true,sameSite:'lax',secure:(process.env.APP_URL||'').startsWith('https://'),path:'/',maxAge:30*86400})}
