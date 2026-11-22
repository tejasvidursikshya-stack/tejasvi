import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {memberBrand} from '@/lib/branding';
import {loginDestination} from '@/lib/login-destination';
import OwnerHome from './owner-home';
import '@/app/clean-start.css';
export const dynamic='force-dynamic';
export const metadata={title:'Your organizations | Tejasvi LMS'};
export default async function Page({searchParams}:{searchParams:Promise<{create?:string}>}){const user=await requireUser('school-admin'),opts=await searchParams;if(!user.platformAdmin)redirect('/workspaces');const brand=await memberBrand(user.userId);if(brand&&opts.create!=='1')redirect('/workspaces');return <OwnerHome name={user.displayName} creating={opts.create==='1'}/>;}
