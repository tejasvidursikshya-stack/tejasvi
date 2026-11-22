import { notFound } from 'next/navigation';
import { publicBrand } from '@/lib/branding';
import { brandName } from '@/lib/brand-theme';
import { LoginScreen } from '@/components/auth/login-screen';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{orgId:string}>}){const b=await publicBrand((await params).orgId);return {manifest:b?`/api/mobile-manifest?org=${b.id}`:"/api/mobile-manifest",title:b?brandName(b as any):'School login',description:'Your learning community',icons:{icon:b?.hasLogo?`/api/branding/${b.id}`:'/school-icon.svg'}}}
export default async function SchoolLogin({params}:{params:Promise<{orgId:string}>}){const brand=await publicBrand((await params).orgId);if(!brand)notFound();return <LoginScreen brand={brand as any}/>}
