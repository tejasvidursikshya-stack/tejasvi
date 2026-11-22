'use client';
import {useEffect,useState} from 'react';
import type {Course} from '@/lib/platform-types';
type F={id:string;title:string};
export function ShareFilm({org,courses,blob,title}:{org:string;courses:Course[];blob?:Blob;title:string}){
 const [cid,course]=useState(''),[films,setFilms]=useState<F[]>([]),[ok,consent]=useState(false),[busy,wait]=useState(false),[msg,note]=useState(''),[err,fail]=useState('');
 const path='/api/ai/films?org='+encodeURIComponent(org)+'&course='+encodeURIComponent(cid);
 useEffect(()=>{setFilms([]);note('');fail('');consent(false);if(!cid)return;const a=new AbortController();fetch(path,{signal:a.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setFilms(d.films);}).catch(e=>{if(!a.signal.aborted)fail(e.message);});return()=>a.abort();},[path,cid]);
 useEffect(()=>{consent(false);},[blob]);
 async function act(remove?:string){if(busy||(!remove&&(!ok||!blob)))return;wait(true);note('');fail('');try{
 const r=await fetch(path+(remove?'&film='+remove:'&reviewed=yes&title='+encodeURIComponent(title||'Lesson film')),{method:remove?'DELETE':'POST',headers:{'x-tejasvi-request':'1',...(!remove?{'content-type':blob!.type.split(';')[0]}:{})},body:remove?undefined:blob}),b=await r.json();if(!r.ok)throw Error(b.error||'Could not update the film.');consent(false);note(remove?'Film withdrawn.':b.message);const list=await fetch(path,{cache:'no-store'});if(list.ok)setFilms((await list.json()).films);
 }catch(e){fail((e as Error).message);}finally{wait(false);}}
 return <details className="aw-details"><summary>Share or withdraw a course film</summary><label className="aw-notes">Published course<select disabled={busy} value={cid} onChange={e=>course(e.target.value)}><option value="">Choose a course you teach</option>{courses.filter(c=>c.status==='published').map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
 {cid&&<>{films.map(f=><div className="aw-actions" key={f.id}><span>{f.title}</span><button className="aw-secondary" disabled={busy} onClick={()=>act(f.id)}>Withdraw film</button></div>)}{blob?<><label className="aw-check"><input type="checkbox" checked={ok} onChange={e=>consent(e.target.checked)}/>I have reviewed this film and want learners with access to this course to see it.</label><button className="aw-primary" disabled={!ok||busy||blob.size>12*1024*1024} onClick={()=>act()}>{busy?'Saving…':'Share reviewed film'}</button>{blob.size>12*1024*1024&&<p>Course films are limited to 12 MB. Split the lesson or use the download.</p>}</>:<p>Render a film above to share it here.</p>}</>}
 {msg&&<p className="aw-good" role="status">{msg}</p>}{err&&<p className="wk-alert" role="alert">{err}</p>}</details>;
}
