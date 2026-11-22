'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,ShieldCheck} from 'lucide-react';
export function FirstOwnerForm(){
 const [token,setToken]=useState(''),[fromLink,setFromLink]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const t=new URLSearchParams(location.hash.slice(1)).get('setup');if(t&&/^[0-9a-f]{36}$/.test(t)){setToken(t);setFromLink(true);history.replaceState(null,'',location.pathname+location.search);}},[]);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget);
  if(f.get('password')!==f.get('confirm')){setError('The passwords do not match. Please enter them again.');return;}
  setBusy(true);setError('');try{const r=await fetch('/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify({name:f.get('name'),email:f.get('email'),password:f.get('password'),token:token.trim()})});const data=await r.json();if(!r.ok){if(r.status===403)setFromLink(false);throw Error(data.error||'Unable to create the account.');}location.replace(data.redirect);}catch(e){setError((e as Error).message);setBusy(false);}}
 return <form className="tj-login-form clean-owner-form" onSubmit={submit} aria-busy={busy}>
  {error&&<p className="tj-login-error" role="alert">{error}</p>}
  {fromLink?<p className="clean-key-note"><ShieldCheck size={17}/> Private setup link received</p>:<label>Your setup code<input aria-label="Your setup code" aria-describedby="first-key-help" value={token} onChange={e=>setToken(e.target.value)} required autoComplete="off" spellCheck={false}/><small id="first-key-help">Open the private link printed in Terminal, or paste the code after “#setup=”.</small></label>}
  <label>Your name<input name="name" required maxLength={120} autoComplete="name"/></label>
  <label>Email address<input name="email" required type="email" maxLength={200} autoComplete="username"/></label>
  <label>Password<input name="password" aria-label="Password" aria-describedby="first-pwd-help" required type="password" minLength={12} maxLength={128} autoComplete="new-password"/><small id="first-pwd-help">Use at least 12 characters.</small></label>
  <label>Confirm password<input name="confirm" required type="password" minLength={12} maxLength={128} autoComplete="new-password"/></label>
  <button className="tj-login-submit" disabled={busy}>{busy?'Creating account…':'Create Super Admin'}<ArrowRight size={17}/></button>
 </form>;
}
