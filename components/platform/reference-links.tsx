'use client';
import {useEffect,useState} from 'react';
export function ReferenceLinks({courseId,editable=false}:{courseId:string;editable?:boolean}){
 const [links,setLinks]=useState<{id:string;title:string;url:string}[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const r=await fetch('/api/reference-links?course='+courseId),d=await r.json();if(!r.ok)throw Error(d.error);setLinks(d.links)}
 useEffect(()=>{load().catch(e=>setError(e.message))},[courseId]);
 async function write(method:string,body:Record<string,unknown>){setBusy(true);setError('');try{const r=await fetch('/api/reference-links',{method,headers:{'content-type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);await load();return true}catch(e){setError((e as Error).message);return false}finally{setBusy(false)}}
 if(!editable&&!links.length&&!error)return null;
 return <section className="editor-section"><h2>Reference links</h2>{error&&<p role="alert" className="status-message error-message">{error}</p>}{links.map(l=><div className="assignment-row" key={l.id}><a href={l.url} target="_blank" rel="noopener noreferrer" className="quiet-link">{l.title} ↗</a>{editable&&<button className="quiet-link" disabled={busy} onClick={()=>write('DELETE',{id:l.id})}>Remove</button>}</div>)}{editable&&<form onSubmit={async e=>{e.preventDefault();const f=e.currentTarget;if(await write('POST',{courseId,...Object.fromEntries(new FormData(f))}))f.reset()}}><div className="form-grid"><label className="field">Reference title<input name="title" required maxLength={160}/></label><label className="field">HTTPS URL<input name="url" type="url" pattern="https://.*" required maxLength={2000}/></label></div><button className="button button-outline" disabled={busy}>Add reference</button></form>}</section>
}
