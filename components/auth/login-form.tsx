'use client';
import {studioAfterLogin} from '@/lib/studio-intent';
import { useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Mail, LockKeyhole, LoaderCircle, CircleAlert, ChevronDown, Info } from 'lucide-react';

export function LoginForm({orgId}:{orgId?:string}) {
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[visible,setVisible]=useState(false),[capsLock,setCapsLock]=useState(false),help=useRef<HTMLDetailsElement>(null);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;
  const fields=new FormData(e.currentTarget);setBusy(true);setError('');
  try{
   const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify({orgId,email:fields.get('email'),password:fields.get('password')})});
   const result=await r.json();
   if(!r.ok)throw new Error(result.error||'Unable to sign in. Please try again.');
   window.location.assign(studioAfterLogin(result.redirect,window.location.search));
  }catch(e){setError((e as Error).message);setBusy(false)}
 }
 return <form className="tj-login-form" onSubmit={submit} aria-busy={busy}>
  {error&&<div className="tj-login-error" role="alert"><CircleAlert size={18}/><span>{error}</span></div>}
  <div className="tj-login-field"><label htmlFor="login-email">Email address</label><div className="tj-input-wrap"><Mail size={18} aria-hidden="true"/><input id="login-email" type="email" name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="you@example.com" disabled={busy}/></div></div>
  <div className="tj-login-field"><div className="tl-label-row"><label htmlFor="login-password">Password</label><button type="button" className="tl-forgot" onClick={()=>{const d=help.current;if(d){d.open=true;d.scrollIntoView({block:'nearest',behavior:'smooth'})}}}>Forgot password?</button></div><div className="tj-input-wrap tj-password-wrap"><LockKeyhole size={18} aria-hidden="true"/><input id="login-password" name="password" type={visible?'text':'password'} autoComplete="current-password" required maxLength={200} placeholder="Enter your password" disabled={busy} onKeyUp={e=>setCapsLock(e.getModifierState('CapsLock'))} onKeyDown={e=>setCapsLock(e.getModifierState('CapsLock'))} onBlur={()=>setCapsLock(false)} aria-describedby={capsLock?'login-caps-lock':undefined}/><button type="button" className="tj-password-toggle" aria-label={visible?'Hide password':'Show password'} aria-controls="login-password" aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>{capsLock&&<p id="login-caps-lock" className="tj-caps-note" role="status">Caps Lock is on.</p>}</div>
  <button type="submit" className="tj-login-submit" disabled={busy}>{busy?<><LoaderCircle className="tj-login-spinner" size={18}/> Signing in…</>:<>Log in <ArrowRight size={18}/></>}</button>
  <span className="tj-sr-only" role="status">{busy?'Signing in. Please wait.':''}</span>
  <details className="tj-login-help" ref={help}><summary>Need help signing in? <ChevronDown size={15}/></summary><div><strong>Forgot your password?</strong><p>Ask your organization administrator to reset it. Use the email address registered for your account.</p><strong>Wrong email?</strong><p>Use the email address your institution registered for you. It is often your school or college email.</p></div></details>
  <div className="tl-login-note"><Info size={20} aria-hidden="true"/><p><strong>New here?</strong> Your school or college creates your account. Ask your administrator for your login details or a password reset.</p></div>
 </form>;
}
