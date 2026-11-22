'use client';
import {useCallback,useEffect,useState} from 'react';
import {AudioLines,FolderOpen,MessageCircle,PenLine,Plug,Sparkles,Presentation} from 'lucide-react';
import {AIStudio} from '../platform/ai-studio';
import {Assistant} from '../platform/assistant';
import {PresentationStudio,type DeckSeed} from './presentations';
import {Connections,type AIStatus} from './connections';
import {MediaDesk,type SceneInput} from './media';
import type {Output,StudioTool} from '@/lib/atelier';
import type {Course} from '@/lib/platform-types';
export type AIPage='create'|'drafts'|'ask'|'media'|'talk'|'connections'|'presentations';
export function AIWorkspace({orgId,orgName,role,page,onPage,initialTask,initialTool,initialOutput,courses,onChanged}:{orgId:string;orgName?:string;role:string;page:AIPage;onPage:(p:AIPage)=>void;initialTask?:'Course'|'Quiz';initialTool?:StudioTool;initialOutput?:Output;courses:Course[];onChanged:()=>Promise<unknown>}){
 const staff=['admin','teacher'].includes(role),here:AIPage=!staff&&['create','drafts','media','presentations'].includes(page)?'ask':page;
 const [status,setStatus]=useState<AIStatus|null>(null),[fail,error]=useState(''),[rev,refresh]=useState(0),[seed,setSeed]=useState<SceneInput[]>([]),[seq,serial]=useState(0);
 const [deckSeed,setDeckSeed]=useState<DeckSeed>(),[deckSeq,resetDeck]=useState(0);
 const [opened,setOpened]=useState<Set<string>>(()=>new Set([here]));useEffect(()=>{setOpened(v=>v.has(here)?v:new Set([...v,here]));},[here]);
 useEffect(()=>{const a=new AbortController();error('');fetch('/api/ai/connections?org='+orgId,{signal:a.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load AI access.');setStatus(d);}).catch(e=>{if(!a.signal.aborted){setStatus(null);error(e.message);}});return()=>a.abort();},[orgId,rev]);
 const after=useCallback(async()=>{await onChanged();},[onChanged]);
 const tabs=staff?([{id:'create',label:'Create',icon:PenLine},{id:'drafts',label:'Saved drafts',icon:FolderOpen},{id:'presentations',label:'Presentations',icon:Presentation},{id:'ask',label:'Ask',icon:MessageCircle},{id:'media',label:'Voice & video',icon:AudioLines}] as const):([{id:'ask',label:'Ask',icon:MessageCircle},{id:'talk',label:'Voice & video',icon:AudioLines}] as const);
 const studioVisible=here==='create'||here==='drafts',chatVisible=here==='ask'||here==='talk',mediaVisible=here==='media',mediaTab=here==='media'||here==='talk';
 return <div className="aw-workspace"><header className="aw-head"><div><span className="aw-eyebrow"><Sparkles size={15}/> Learning workspace</span><h1>Tejasvi AI</h1><p>{staff?'Prepare materials, work through a question or record a lesson.':'Ask questions about your learning, or talk them through.'}</p></div><button className="aw-head-link" aria-pressed={here==='connections'} onClick={()=>onPage('connections')}><Plug size={16}/>{role==='admin'?'Connections':'My access'}</button></header>
 <nav className="aw-tabs" aria-label="Tejasvi AI tasks">{tabs.map(t=><button key={t.id} aria-current={here===t.id||(t.id==='media'&&mediaTab)?'page':undefined} onClick={()=>onPage(t.id)}><t.icon size={17}/>{t.label}</button>)}</nav>
 {fail&&<div className="wk-alert" role="alert">{fail} <button type="button" onClick={()=>refresh(n=>n+1)}>Retry</button></div>}
 {staff&&(studioVisible||opened.has('create')||opened.has('drafts'))&&<div hidden={!studioVisible}><AIStudio orgId={orgId} courses={courses} onChanged={after} initialTask={initialTask} initialTool={initialTool} initialOutput={initialOutput} ready={status?.access.text} page={here==='drafts'?'drafts':'create'} onPage={onPage} onConnections={()=>onPage('connections')} onPresentation={seed=>{setDeckSeed(seed);resetDeck(n=>n+1);onPage('presentations');}} onMedia={scenes=>{setSeed(scenes);serial(v=>v+1);onPage('media');}}/></div>}
 {staff&&(here==='presentations'||opened.has('presentations'))&&<div hidden={here!=='presentations'}><PresentationStudio key={orgId+'-'+deckSeq} org={orgId} courses={courses} visible={here==='presentations'} seed={deckSeed} ready={!!status?.access.gamma} connections={()=>onPage('connections')}/></div>}
 {mediaTab&&staff&&<div className="aw-subnav" role="group" aria-label="Voice and video tasks"><button aria-pressed={mediaVisible} onClick={()=>onPage('media')}>Record a lesson</button><button aria-pressed={here==='talk'} onClick={()=>onPage('talk')}>Live conversation</button></div>}
 {staff&&(mediaVisible||opened.has('media'))&&<div hidden={!mediaVisible}><MediaDesk courses={courses} key={seq} visible={mediaVisible} orgId={orgId} ready={!!status?.access.narration} initial={seed} connections={()=>onPage('connections')}/></div>}
 {(chatVisible||opened.has('ask')||opened.has('talk'))&&<div hidden={!chatVisible}><Assistant orgId={orgId} active={chatVisible} mode={here==='talk'?'talk':'ask'} textReady={status?.access.text} avatarReady={!!status?.access.avatar} avatarMode={status?.avatarMode} connections={()=>onPage('connections')}/></div>}
 {here==='connections'&&(status?<Connections orgId={orgId} name={orgName||'this organization'} status={staff?status:{...status,role,canManage:false,policy:undefined,config:undefined}} onUpdate={setStatus} reload={()=>refresh(n=>n+1)}/>:!fail&&<p role="status">Checking connections…</p>)}</div>;
}
