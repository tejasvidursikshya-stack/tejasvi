'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Building2,GraduationCap} from 'lucide-react';
import {OrganizationSetup} from '@/components/platform/organization-setup';
export default function OwnerHome({name,creating=false}:{name:string;creating?:boolean}){
 const [stage,setStage]=useState<'empty'|'college'|'other'>(creating?'other':'empty'),[error,setError]=useState(''),[accountError,setAccountError]=useState(''),[busy,setBusy]=useState(false);
 const headers={'Content-Type':'application/json','x-tejasvi-request':'1'};
 async function create(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;const fields=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);setError('');try{const r=await fetch('/api/platform',{method:'POST',headers,body:JSON.stringify({action:'organization',...fields})});const b=await r.json();if(!r.ok)throw Error(b.error||'The workspace could not be created.');location.replace(b.redirect);}catch(e){setError((e as Error).message);setBusy(false);}}
 async function leave(){setAccountError('');try{const r=await fetch('/api/auth/logout',{method:'POST',headers,body:'{}'});if(!r.ok)throw Error();location.replace('/login');}catch{setAccountError('Could not sign out. Try again.');}}
 return <main className="clean-owner-home"><header><a href="/" aria-label="Tejasvi home"><img src="/assets/tejasvi-campus-logo.svg" width="132" alt="Tejasvi"/></a><nav aria-label="Owner account"><a href="/workspace/demo-requests">Demo requests</a> <button type="button" onClick={leave}>Sign out</button></nav></header>
 {accountError&&<p role="alert" className="clean-error">{accountError}</p>}
 {stage==='empty'?<section className="clean-welcome"><span className="clean-icon"><GraduationCap size={34}/></span><p className="clean-kicker">TEJASVI · SUPER ADMIN</p><h1>No organizations yet</h1><p>Welcome, {name}. Schools and colleges have Learning and EMIS. Companies have Learning for employee training. Your first organization will start empty.</p><div><button className="clean-primary" onClick={()=>setStage('college')}>Create a college <ArrowRight size={17}/></button><button onClick={()=>setStage('other')}>Create a school or company</button></div></section>:
 <section className="clean-org-editor"><button type="button" onClick={()=>{if(creating){location.assign('/workspaces');return;}setStage('empty');setError('');}} disabled={busy}><ArrowLeft size={15}/> {creating?'My workspaces':'Back to overview'}</button><OrganizationSetup initialKind={stage==='college'?'college':''} busy={busy} error={error} onSubmit={create}/></section>}</main>;
}
