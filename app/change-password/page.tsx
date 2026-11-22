import { memberBrand } from '@/lib/branding';
import { BrandTheme,BrandMark } from '@/components/branding/theme';
import { getUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PasswordForm } from '@/components/auth/password-form';
export const metadata={title:'Account settings',description:'Your account',icons:{icon:'/school-icon.svg'}};
export const dynamic='force-dynamic';
export default async function ChangePassword(){const user=await getUser();if(!user)redirect('/login');const brand=await memberBrand(user.userId);return <main className="container"><BrandTheme brand={brand as any}/><div className="login-card"><BrandMark brand={brand as any} href={brand?`/school/${brand.id}`:'/login'}/><h2>{user.mustChangePassword?'Make this account yours.':'Change your password.'}</h2><p style={{marginBottom:25}}>{user.mustChangePassword?'Replace your temporary password before you continue.':'Changing your password signs out your other sessions.'}</p><PasswordForm/></div></main>}
