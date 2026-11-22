import {redirect} from 'next/navigation';
import {getUser} from '@/lib/auth';
import {memberBrand} from '@/lib/branding';
export const dynamic='force-dynamic';
// Preserve existing assistant bookmarks. The canonical entry route verifies membership
// and selects the requested organization before sending the user to its LMS.
export default async function AssistantPage({searchParams}:{searchParams:Promise<{org?:string}>}){
 const user=await getUser();if(!user)redirect('/login');if(user.mustChangePassword)redirect('/change-password');
 const {org}=await searchParams,selected=org||(await memberBrand(user.userId))?.id;
 if(typeof selected!=='string'||!/^[a-f0-9-]{36}$/i.test(selected))redirect('/workspaces');
 redirect('/enter/'+selected+'?ai=ask');
}
