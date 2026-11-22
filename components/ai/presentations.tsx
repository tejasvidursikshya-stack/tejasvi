'use client';
import {useState,useRef,useEffect,useCallback} from 'react';
import {Presentation,BookOpen,Layers3,Plus,ChevronLeft,ChevronRight,ArrowUpRight,Download,Sparkles,FolderOpen} from 'lucide-react';
import {DocumentPreviewButton} from '../platform/document-preview';
import type {Course} from '@/lib/platform-types';
export type DeckSeed={title:string;audience:string;notes:string};
type Brief=DeckSeed&{cards:number;language:string;images:boolean};
type Deck={id:string;title:string;brief:Brief;state:'submitting'|'pending'|'ready'|'failed'|'uncertain';archived:boolean;revision:string|null;gammaUrl:string|null;size:number|null;credits:number|null;message:string|null;created:string;copies?:{courseId:string;materialId:string;title:string}[]};
const api='/api/ai/presentations',headers={'content-type':'application/json','x-tejasvi-request':'1'};
const blank:Brief={title:'',audience:'',notes:'',cards:8,language:'en',images:false};
const example:DeckSeed={title:'Java: classes and objects',audience:'BCA second semester',notes:'Introduce a class with a Student example. Create two objects with different names, trace what each one prints, and finish with a short practice question.'};
const stateLabel={submitting:'Submitting',pending:'Designing',ready:'Ready to review',failed:'Generation failed',uncertain:'Check Gamma'};
async function json(r:Response){const b=await r.json().catch(()=>({}));if(!r.ok)throw Error(b.error||'Tejasvi could not complete this request.');return b;}
export function PresentationStudio({org,courses,ready,visible,seed,connections}:{org:string;courses:Course[];ready:boolean;visible:boolean;seed?:DeckSeed;connections:()=>void}){
 const [mode,setMode]=useState<'write'|'library'>('write'),[form,set]=useState<Brief>({...blank,...seed}),[ok,agree]=useState(false),[busy,setBusy]=useState(false),[err,fail]=useState(''),[msg,note]=useState(''),[list,setList]=useState<Deck[]>([]),[page,setPage]=useState(0),[more,setMore]=useState(false),[loading,loadFlag]=useState(false),[active,select]=useState<Deck|null>(null),[review,confirm]=useState(false),[course,setCourse]=useState(''),[listRev,reload]=useState(0),[pollPaused,pause]=useState(false);
 const token=useRef(''),lock=useRef(false),current=useRef(''),alive=useRef(true);
 const endpoint=api+'?org='+encodeURIComponent(org);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!visible||mode!=='library')return;const a=new AbortController();loadFlag(true);fetch(endpoint+'&page='+page,{cache:'no-store',signal:a.signal}).then(json).then(d=>{if(!a.signal.aborted){setList(d.decks);setMore(d.more);}}).catch(e=>{if(!a.signal.aborted)fail(e.message);}).finally(()=>{if(!a.signal.aborted)loadFlag(false);});return()=>a.abort();},[endpoint,mode,visible,page,listRev]);
 const put=useCallback((d:Deck)=>{if(!alive.current)return;select(d);current.current=d.id;setList(old=>old.map(x=>x.id===d.id?d:x));},[]);
 const post=useCallback(async(body:Record<string,unknown>,signal?:AbortSignal)=>json(await fetch(api,{method:'POST',headers,signal,body:JSON.stringify({orgId:org,...body})})),[org]);
 useEffect(()=>{if(!visible||mode!=='library'||!ready||pollPaused||!active||!['submitting','pending'].includes(active.state))return;
  const id=active.id,a=new AbortController();let timer:ReturnType<typeof setTimeout>;async function tick(){if(a.signal.aborted)return;if(document.hidden||lock.current){timer=setTimeout(tick,8000);return;}
   try{const b=await post({action:'refresh',id},a.signal);if(a.signal.aborted||current.current!==id)return;put(b.deck);if(['submitting','pending'].includes(b.deck.state))timer=setTimeout(tick,8000);}
   catch(e){if(!a.signal.aborted&&current.current===id){fail((e as Error).message);pause(true);}}
  }timer=setTimeout(tick,6500);return()=>{a.abort();clearTimeout(timer);};
 },[active?.id,active?.state,mode,post,put,visible,ready,pollPaused]);
 function update(b:Partial<Brief>){set(v=>({...v,...b}));agree(false);token.current='';fail('');}
 function reset(){current.current='';select(null);set({...blank});agree(false);token.current='';setMode('write');note('');fail('');}
 function back(){current.current='';select(null);confirm(false);setCourse('');fail('');note('');}
 function openDeck(d:Deck){back();current.current=d.id;select(d);pause(false);fetch(endpoint+'&id='+d.id,{cache:'no-store'}).then(json).then(b=>{if(alive.current&&current.current===d.id)put(b.deck);}).catch(e=>{if(alive.current&&current.current===d.id)fail(e.message);});}
 async function act(fn:()=>Promise<any>,done:(b:any)=>void){if(lock.current)return;lock.current=true;setBusy(true);fail('');note('');try{const b=await fn();if(alive.current)done(b);}catch(e){if(alive.current)fail((e as Error).message);}finally{lock.current=false;if(alive.current)setBusy(false);}}
 function create(){if(!ok||!ready||lock.current)return;token.current||=crypto.randomUUID();void act(()=>post({action:'create',requestId:token.current,brief:form,confirm:true}),b=>{back();put(b.deck);pause(false);setMode('library');setPage(0);reload(v=>v+1);agree(false);});}
 function refresh(){if(!active)return;void act(()=>post({action:active.state==='ready'?'export':'refresh',id:active.id}),b=>{put(b.deck);pause(false);});}
 function upload(f?:File){if(!active||!f)return;if(!/\.pptx$/i.test(f.name)||f.size>20*1024*1024){fail('Choose a .pptx up to 20 MB.');return;}
  void act(async()=>json(await fetch(endpoint+'&id='+active.id,{method:'PUT',headers:{'x-tejasvi-request':'1','content-type':'application/octet-stream'},body:f})),b=>{put(b.deck);confirm(false);note('Reviewed file saved. Existing course copies change only when you update them.');});}
 function share(cid:string,remove=false){if(!active||(!remove&&!review))return;void act(()=>post({action:remove?'withdraw':'share',id:active.id,courseId:cid,reviewed:!remove&&review,revision:active.revision}),b=>{put(b.deck);confirm(false);note(remove?'Presentation withdrawn from this course.':'The reviewed PowerPoint is now in the course’s Resources.');});}
 const valid=form.title.trim().length>=3&&form.audience.trim().length>=2&&form.notes.trim().length>=10,editable=courses.filter(c=>c.status==='published');
 return <section className="gd-studio" aria-label="Gamma presentation studio">
 <header className="gd-hero"><div><span className="gd-label"><Presentation size={16}/> Presentation studio</span><h2>From lesson notes to slides.</h2><p>Design a PowerPoint with Gamma. Review it here before adding it to a course.</p></div><div className="gd-art" aria-hidden="true"><i/><i/><b><span>LESSON SERIES</span><em>Aa</em><small>01 / 08</small></b></div></header>
 <div className="gd-mode" role="group" aria-label="Presentation tasks"><button aria-pressed={mode==='write'} disabled={busy} onClick={()=>{setMode('write');fail('');note('');}}><Plus size={16}/>Compose</button><button aria-pressed={mode==='library'} disabled={busy} onClick={()=>{setMode('library');fail('');note('');}}><FolderOpen size={16}/>My presentations</button></div>
 {err&&<p className="wk-alert" role="alert">{err}</p>}{msg&&<p className="aw-good" role="status">{msg}</p>}
 {mode==='write'?<form className="aw-panel gd-form" onSubmit={e=>{e.preventDefault();create();}}><div className="gd-heading"><div><span className="aw-eyebrow">01 · Teaching brief</span><h3>What should learners understand?</h3></div><button type="button" className="aw-secondary" disabled={busy} onClick={()=>{update(example);}}>Use Java example</button></div>
 <fieldset disabled={busy} className="gd-inputs"><label>Presentation title<input value={form.title} required minLength={3} maxLength={160} placeholder="e.g. How a Java class becomes an object" onChange={e=>update({title:e.target.value})}/></label>
 <label>Audience<input value={form.audience} required minLength={2} maxLength={140} placeholder="e.g. BCA second semester" onChange={e=>update({audience:e.target.value})}/></label>
 <label className="gd-wide">Lesson brief or notes<textarea value={form.notes} required minLength={10} maxLength={12000} rows={5} placeholder="Include the learning objective, a worked example and the practice you want on the final slides." onChange={e=>update({notes:e.target.value})}/></label>
 <label>Number of slides<select value={form.cards} onChange={e=>update({cards:Number(e.target.value)})}>{[6,8,10,12].map(i=><option key={i} value={i}>{i} slides</option>)}</select></label>
 <label>Output language<select value={form.language} onChange={e=>update({language:e.target.value})}><option value="en">English</option><option value="hi">Hindi</option></select></label>
 <label className="gd-wide">Visuals<select value={form.images?'ai':'text'} onChange={e=>update({images:e.target.value==='ai'})}><option value="text">Text and layout · no generated images</option><option value="ai">Generate illustrations with Gamma · may use more credits</option></select></label></fieldset>
 {!ready&&<div className="aw-info"><span>Gamma generation is off for this workspace. You can still use the regular PowerPoint export in Create.</span><button type="button" onClick={connections}>View connections</button></div>}
 <label className="aw-check"><input type="checkbox" checked={ok} disabled={!ready||busy} onChange={e=>agree(e.target.checked)}/>Send this brief to Gamma and use the connected workspace’s credits. I have removed private learner information.</label>
 <button className="aw-primary" disabled={!ready||busy||!ok||!valid} type="submit"><Sparkles size={17}/>{busy?'Submitting…':'Generate presentation'}</button></form>:
 !active?<div className="aw-panel"><div className="gd-heading"><div><span className="aw-eyebrow">Teaching library</span><h3>My presentations</h3></div><button type="button" className="aw-secondary" onClick={reset}>New presentation</button></div>
 {loading?<p role="status">Loading your presentations…</p>:!list.length?<p className="gd-empty">Your generated presentations will appear here, ready to review and share.</p>:<ul className="gd-list">{list.map(d=><li key={d.id}><button onClick={()=>openDeck(d)}><Presentation size={21}/><span><strong>{d.title}</strong><small>{d.brief.cards} slides · {d.brief.audience}</small></span><b>{stateLabel[d.state]}</b><ChevronRight size={16}/></button></li>)}</ul>}
 {(page>0||more)&&<div className="aw-actions"><button className="aw-secondary" disabled={!page||loading} onClick={()=>setPage(v=>v-1)}>Previous</button><button className="aw-secondary" disabled={!more||loading} onClick={()=>setPage(v=>v+1)}>Next</button></div>}</div>:
 <article className="aw-panel gd-detail"><button type="button" className="aw-back" disabled={busy} onClick={()=>{back();reload(x=>x+1);}}><ChevronLeft size={16}/>My presentations</button>
 <div className="gd-heading"><div><span className="aw-eyebrow">{stateLabel[active.state]}</span><h3>{active.title}</h3><p>{active.brief.audience} · {active.brief.cards} requested slides{active.credits!==null?' · '+active.credits+' Gamma credits used':''}</p></div><Layers3 aria-hidden="true" size={27}/></div>
 {active.message&&<p role="status" className="gd-hint">{active.message}</p>}
 {['submitting','pending'].includes(active.state)&&<div className="gd-pending"><p role="status">Gamma is preparing your deck. You can leave and return to My presentations.</p><button className="aw-secondary" disabled={busy||!ready} onClick={refresh}>Check progress</button></div>}
 {['failed','uncertain'].includes(active.state)&&<><p>{active.state==='uncertain'?'Tejasvi will not automatically submit this brief again. Check your Gamma account first to avoid a second charge.':'You can edit the brief and submit a new generation.'}</p><button className="aw-secondary" onClick={()=>{const b=active.brief;reset();set(b);}}>Copy brief to a new presentation</button></>}
 {active.state==='ready'&&<><div className="aw-actions">{active.archived&&<><DocumentPreviewButton key={active.id+'-'+active.revision} id={active.id} source="gamma" org={org} name={active.title} label="Preview slide text" className="aw-secondary"/><a className="aw-primary" href={endpoint+'&id='+active.id+'&file=1'}><Download size={16}/>Download PowerPoint</a></>}
 {active.gammaUrl&&<a href={active.gammaUrl} target="_blank" rel="noopener noreferrer" className="aw-secondary">Open in Gamma <ArrowUpRight size={15}/></a>}
 {!active.archived&&<button className="aw-secondary" disabled={busy||!ready} onClick={refresh}>Refresh PowerPoint export</button>}</div>
 {active.gammaUrl&&<p className="gd-caption">The Gamma editor requires access to the connected Gamma account. Use the PowerPoint to review the full layout in Tejasvi’s course workflow.</p>}
 <details className="aw-details"><summary>{active.archived?'Upload an edited PowerPoint':'Upload an exported PowerPoint'}</summary><label className="aw-notes">Reviewed .pptx (up to 20 MB)<input type="file" accept=".pptx" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';upload(f);}}/></label></details>
 {active.archived&&<section className="gd-share"><span className="aw-eyebrow">Course resources</span><h4>Share a reviewed copy</h4><p>Only learners with access to the published course can open this copy. They don’t need a Gamma account.</p>
 <label className="aw-notes">Published course<select value={course} disabled={busy} onChange={e=>{setCourse(e.target.value);confirm(false);}}><option value="">{editable.length?'Select a course you teach':'No published course available'}</option>{editable.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
 <label className="aw-check"><input type="checkbox" checked={review} disabled={busy||!course} onChange={e=>confirm(e.target.checked)}/>I reviewed this PowerPoint and approve it for this course.</label>
 <button className="aw-primary" disabled={!review||!course||busy} onClick={()=>share(course)}><BookOpen size={16}/>{active.copies?.some(x=>x.courseId===course)?'Update course copy':'Share to course'}</button>
 {!!active.copies?.length&&<ul className="gd-copies">{active.copies.map(x=><li key={x.courseId}><span>{x.title}</span><button className="aw-secondary" disabled={busy} onClick={()=>share(x.courseId,true)}>Withdraw</button></li>)}</ul>}</section>}</>}
 </article>}</section>;
}
