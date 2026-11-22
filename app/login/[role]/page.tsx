import { redirect } from 'next/navigation';
export default async function LegacyLogin({searchParams}:{searchParams:Promise<{org?:string}>}){const {org}=await searchParams;redirect(org?`/login?org=${encodeURIComponent(org)}`:'/login')}
