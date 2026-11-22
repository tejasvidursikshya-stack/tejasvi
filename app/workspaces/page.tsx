import {studioIntent} from '@/lib/studio-intent';
import {redirect} from 'next/navigation';
import {Building2,BookOpen,GraduationCap,ArrowUpRight,Plus} from 'lucide-react';
import {getUser} from '@/lib/auth';
import {rows} from '@/lib/db';
import './workspaces.css';
import Signout from './signout';
export const dynamic='force-dynamic';
export const metadata={title:'My workspaces | Tejasvi'};
export default async function Workspaces({searchParams}:{searchParams:Promise<{studio?:string;output?:string}>}){const q=await searchParams,intent=studioIntent(q.studio,q.output),suffix=intent?.query||'';const u=await getUser();if(!u)redirect('/login'+suffix);if(u.mustChangePassword)redirect('/change-password'+suffix);
 const orgs=await rows("SELECT o.id,o.name,o.kind,m.role,r.role AS emisRole FROM institution_memberships m JOIN organizations o ON o.id=m.org_id LEFT JOIN emis_roles r ON r.org_id=m.org_id AND r.user_id=m.user_id WHERE m.user_id=? AND m.active=1 AND m.role<>'parent' ORDER BY o.name",[u.userId]);
 return <main className="campus-hub"><header><a href="/"><img src="/assets/tejasvi-campus-logo.svg" alt="Tejasvi home" width="140"/></a><div className="hub-account"><span>{u.displayName}</span><Signout/></div></header><div className="hub-intro"><div><p className="hub-kicker">TEJASVI · YOUR ACCOUNT</p><h1>My workspaces</h1><p>{intent?'Choose an organization to open Creator Studio. Authoring requires an administrator or teaching role.':'Choose an organization and the work you want to do.'}</p></div>{u.platformAdmin&&<div className="hub-owner-tools"><a className="hub-leads" href="/workspace/demo-requests">Demo requests</a><a href="/workspace/start?create=1" className="hub-create"><Plus size={17}/> Create organization</a></div>}</div>
 {!orgs.length&&<section className="hub-card"><h2>No organizations yet</h2><p>{u.platformAdmin?'Create a school, college or company when you are ready.':'Ask your administrator to assign you to an organization.'}</p></section>}
 <div className="hub-list">{orgs.map(o=>{const edu=['school','college'].includes(o.kind),canLearn=['admin','student','teacher','employee'].includes(o.role);return <section key={o.id} className="hub-card"><p className="hub-kicker">{o.kind==='edtech'?'EDTECH PROVIDER':o.kind.toUpperCase()}</p><h2>{o.name}</h2><p className="hub-role">{o.emisRole&&edu?o.emisRole:o.role==='admin'?'Administrator':o.role==='employee'?'Employee':o.role}</p><div className="hub-tools">
 {canLearn&&<a href={'/enter/'+o.id+(['admin','teacher'].includes(o.role)?suffix:'')}><BookOpen/><span><b>{intent&&['admin','teacher'].includes(o.role)?'Open Creator Studio':'Open Learning'}</b><small>{o.kind==='corporate'?'Employee training, assessments and progress':'Courses, lessons and assessments'}</small></span><ArrowUpRight size={17}/></a>}
 {edu&&o.emisRole&&<a href={'/erp/'+o.id+'/'}><Building2/><span><b>Open EMIS</b><small>{o.role==='student'?'My enrollment, results, attendance and fees':'Institution records and operations'}</small></span><ArrowUpRight size={17}/></a>}</div></section>;})}</div></main>;}
