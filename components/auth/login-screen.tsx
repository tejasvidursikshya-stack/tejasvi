import { ArrowLeft, BookOpen, PenLine, ShieldCheck } from 'lucide-react';
import { FirstOwnerForm } from './first-owner-form';
import '@/app/clean-start.css';
import { LoginForm } from './login-form';
import { BrandTheme, BrandMark } from '@/components/branding/theme';
import { brandName, type Brand } from '@/lib/brand-theme';
import '@/app/learning-login.css';

const points = [
 { icon: BookOpen, title: 'Learn at your own pace', text: 'Lessons, quizzes and feedback, on the web and the Tejasvi app.' },
 { icon: PenLine, title: 'Teach with less admin', text: 'Grade, give feedback and take attendance in a few clicks.' },
 { icon: ShieldCheck, title: 'Private by design', text: 'Everyone sees only what their role allows.' },
];

export function LoginScreen({brand=null,firstOwner=false}:{brand?:Brand|null;firstOwner?:boolean}) {
 const home=brand?`/school/${brand.id}`:'/',name=brand?brandName(brand):'Tejasvi';
 return <main className="tl-login">
  <BrandTheme brand={brand}/>
  <a className="skip-link" href="#signin-form">Skip to login</a>
  <section className="tl-login-story" aria-label={'About '+name}>
   <div className="tl-login-mark">{brand?<BrandMark brand={brand} href={home}/>:<a href="/" aria-label="Tejasvi home"><span className="tl-login-logo" aria-hidden="true">T<i>.</i></span><span>Tejasvi</span></a>}</div>
   <div className="tl-login-copy">
    <p className="tl-login-kicker">Learn · Teach · Grow</p>
    <h2>{brand?.welcomeText||'Everything your school runs on, in one calm place.'}</h2>
    <p>Lessons, assignments, attendance, results and records for students, teachers and administrators.</p>
    <ul>{points.map(p=><li key={p.title}><span aria-hidden="true"><p.icon size={20}/></span><div><strong>{p.title}</strong><p>{p.text}</p></div></li>)}</ul>
   </div>
   <p className="tl-login-foot">© {new Date().getFullYear()} {name} · Learn. Connect. Grow.</p>
  </section>
  <section className="tl-login-panel" aria-labelledby="signin-title">
   <div className="tl-login-content" id="signin-form">
    <a className="tl-login-back" href={home}><ArrowLeft size={16}/> Back to {brand?'your organization':'home'}</a>
    <div className="tl-login-head">
     <h1 id="signin-title">{firstOwner?'Create your Super Admin':'Welcome back'}</h1>
     <p>{firstOwner?'Start with your own account. You can create an organization later.':<>Log in with the account {brand?brandName(brand):'your institution'} gave you. We’ll take you straight to your workspace.</>}</p>
    </div>
    {firstOwner?<FirstOwnerForm/>:<LoginForm orgId={brand?.id}/>}
   </div>
  </section>
 </main>;
}
