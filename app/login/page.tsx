import { one } from '@/lib/db';
import { notFound } from 'next/navigation';
import { publicBrand } from '@/lib/branding';
import { brandName } from '@/lib/brand-theme';
import { LoginScreen } from '@/components/auth/login-screen';
export const dynamic='force-dynamic';
type Props={searchParams:Promise<{org?:string}>};
export async function generateMetadata({searchParams}:Props){const {org}=await searchParams,b=org?await publicBrand(org):null;return {title:`Log in | ${b?brandName(b as any):'Tejasvi'}`,icons:{icon:b?.hasLogo?`/api/branding/${b.id}`:'/favicon.svg'}}}
export default async function Login({searchParams}:Props){const {org}=await searchParams,brand=org?await publicBrand(org):null;if(org&&!brand)notFound();const state=await one("SELECT owner_claimed FROM tejasvi_clean_install WHERE id=1");return <LoginScreen firstOwner={!!state && !state.owner_claimed} brand={brand as any}/>}
