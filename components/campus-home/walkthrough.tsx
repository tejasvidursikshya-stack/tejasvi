'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowRight,CalendarDays,Check,X} from 'lucide-react';
import {demoAudiences,type DemoAudience} from '../../lib/demo-options';
import {tourInfo} from './demo-content';

type Props={audience:DemoAudience;offline:boolean;onDismiss:()=>void;site:string};
export function Walkthrough({audience,offline,onDismiss,site}:Props){
 const dialog=useRef<HTMLDialogElement>(null),before=useRef<HTMLElement|null>(null),activeRequest=useRef<AbortController|null>(null),retry=useRef<{payload:string;id:string}|null>(null),confirmation=useRef<HTMLHeadingElement>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(''),[kind,setKind]=useState(audience);
 useEffect(()=>{const d=dialog.current;if(!d)return;before.current=document.activeElement as HTMLElement|null;d.showModal();
  return()=>{activeRequest.current?.abort();if(d.open)d.close();before.current?.focus({preventScroll:true});};},[]);
 useEffect(()=>{if(result)confirmation.current?.focus();},[result]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;
  const form=e.currentTarget;if(!form.reportValidity())return;setError('');const f=new FormData(form);const values={name:String(f.get('name')||'').trim(),email:String(f.get('email')||'').trim(),institution:String(f.get('institution')||'').trim(),audience:kind,interests:String(f.get('interests')||'').trim(),website:String(f.get('website')||''),consent:f.get('consent')==='yes'};
  if(!values.name||!values.institution){setError('Enter your name and organization.');return;}
  if(offline){setResult('preview');return;}
  const data=JSON.stringify(values);if(!retry.current||retry.current.payload!==data)retry.current={payload:data,id:crypto.randomUUID()};const id=retry.current.id;
  const controller=new AbortController();activeRequest.current=controller;const timer=window.setTimeout(()=>controller.abort(),15000);
  setBusy(true);try{const r=await fetch('/api/demo-requests',{method:'POST',headers:{'Content-Type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify({...values,requestId:id}),signal:controller.signal});const data=await r.json().catch(()=>null);if(!r.ok||!data?.reference)throw Error(data?.error||'We could not save your request. Your details are still here; please try again.');setResult(data.reference);}
  catch(e){setError((e as Error).name==='AbortError'?'The response timed out. Retry to check the same request.':(e as Error).message||'Could not reach Tejasvi. Please retry.');}
  finally{clearTimeout(timer);activeRequest.current=null;setBusy(false);}
 }
 return <dialog ref={dialog} aria-labelledby="td-form-title" className="td-dialog" onCancel={e=>{e.preventDefault();if(!busy)onDismiss();}} onClick={e=>{if(e.target===dialog.current&&!busy)onDismiss();}}>
 <div className="td-dialog-in"><div className="td-modal-top"><span><CalendarDays size={17}/> TEJASVI CAMPUS</span><button type="button" aria-label="Close walkthrough form" onClick={onDismiss} disabled={busy}><X size={18}/></button></div>
 {result?<div className="td-done"><span><Check size={27}/></span><h2 id="td-form-title" tabIndex={-1} ref={confirmation}>{offline?'Preview complete.':'Request received.'}</h2>{offline?<><p>No request was sent. In the running application this form goes to the Tejasvi Super Admin.</p><a href={site+'/?tour='+kind+'&request=demo#demo'}>Open the running app <ArrowRight size={15}/></a></>:<><p>Your reference is <strong>{result}</strong>. The team can use the email you provided to arrange a time. No meeting has been booked yet.</p></>}<button type="button" className="td-action" onClick={onDismiss}>Back to the page</button></div>:
 <><p className="td-modal-brow">{offline?'Offline preview':'Guided product demo'}</p><h2 id="td-form-title">Request a walkthrough.</h2><p className="td-modal-deck">{offline?'Try the form with the sample details below. Nothing is saved or sent from this preview.':'Tell us who the walkthrough is for and what you want to see. We’ll use your email to arrange a time.'}</p>
 <form onSubmit={submit}><div className="td-form-grid"><label>Your name<input name="name" autoComplete={offline?'off':'name'} required maxLength={100} defaultValue={offline?'Demo coordinator':''}/></label><label>Work email<input name="email" type="email" autoComplete={offline?'off':'email'} required maxLength={200} defaultValue={offline?'coordinator@example.org':''}/></label><label>Organization<input name="institution" autoComplete={offline?'off':'organization'} required maxLength={160} defaultValue={offline?'Sample organization':''}/></label><label>Organization type<select value={kind} onChange={e=>setKind(e.target.value as DemoAudience)}>{demoAudiences.map(a=><option value={a} key={a}>{tourInfo[a].label}</option>)}</select></label></div>
 <label>What would you like to see? <small>Optional</small><textarea name="interests" maxLength={600} rows={2} placeholder="For example, fees, class attendance or employee training"/></label>
 <label className="td-trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
 <label className="td-consent"><input type="checkbox" name="consent" value="yes" required defaultChecked={offline}/><span>It’s OK to email me about this walkthrough.</span></label>
 {error&&<p role="alert" className="td-error">{error}</p>}<button disabled={busy} className="td-action" type="submit">{busy?'Sending…':offline?'Preview confirmation':'Send request'} <ArrowRight size={16}/></button>
 </form></>}</div></dialog>;
}
