'use client';
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {ChevronDown,CornerDownLeft,Search,X,type LucideIcon} from 'lucide-react';
import {useSidebar} from '@/components/ui/sidebar';
export type TaskLink={id:string;label:string;icon:LucideIcon;run?:()=>void;href?:string};
type Props={links:TaskLink[];active:string;scope:string;learner:boolean;onNavigate:()=>void};
// Sections in the order people use them. Every link lands in exactly one section.
const groups=[
 {id:'start',title:'Home',ids:['desk','home','overview','notifications','features','studio']},
 {id:'learning',title:'Teaching & content',learner:'My learning',ids:['courses','programs','units','non-credit','plans','quizzes','tools','tutoring']},
 {id:'schedule',title:'Classes & schedule',learner:'My classes',ids:['calendar','live','attendance','academics','batches']},
 {id:'review',title:'Assessment & progress',learner:'My results',ids:['assessments','gradebook','exams','progress','certificates']},
 {id:'people',title:'People & organization',ids:['students','teacher-assignments','people','partners','settings','new-org']},
 {id:'account',title:'Account',ids:['all-workspaces','password']},
];
// Everyday words people type, so "marks" finds the gradebook and "timetable" finds the calendar.
const words:Record<string,string>={
 desk:'home start dashboard',home:'start dashboard',overview:'home dashboard summary',notifications:'announcement news update notice message',features:'help guide feature',studio:'ai assistant lesson plan generate quiz notes',
 courses:'subject course lesson content module',programs:'program',units:'unit chapter module assessment',plans:'lesson plan teaching plan upload',quizzes:'quiz test mcq question',tools:'whiteboard calculator tool',tutoring:'tutoring card flashcard revision','non-credit':'extra course club skill',
 calendar:'timetable routine schedule date holiday',live:'online class zoom meet video live',attendance:'present absent hajiri',academics:'class section batch enrolment enrollment',batches:'batch group',
 assessments:'assignment homework submission grading grade',gradebook:'marks grades result score',exams:'exam test',progress:'report progress completion analytics',certificates:'certificate',
 students:'student learner directory login',"teacher-assignments":'teacher subject allocation assign',people:'users accounts staff employees login password',partners:'partner school',settings:'organization school details logo brand',"new-org":'create organization school college',
 "all-workspaces":'switch workspace organization emis',password:'change password security',
};
export function TaskNav({links,active,scope,learner,onNavigate}:Props){
 const prefix=useId(),visible=groups.map(g=>({...g,items:g.ids.flatMap(id=>links.filter(i=>i.id===id))})).filter(g=>g.items.length);
 // Links not placed in a section still appear, under Home.
 const placed=new Set(groups.flatMap(g=>g.ids)),loose=links.filter(l=>!placed.has(l.id));if(loose.length){const home=visible.find(g=>g.id==='start');if(home)home.items=[...home.items,...loose];else visible.unshift({...groups[0],items:loose});}
 const current=visible.find(g=>g.items.some(i=>i.id===active))?.id;
 // Sections are open unless the person closed them.
 const [closed,setClosed]=useState<Record<string,boolean>>({}),loaded=useRef('');
 useEffect(()=>{let saved:Record<string,boolean>={};try{const s=JSON.parse(localStorage.getItem(scope+':closed')||'null');if(s&&typeof s==='object')for(const g of groups)if(s[g.id]===true)saved[g.id]=true;}catch{}if(current)delete saved[current];setClosed(saved);loaded.current=scope;},[scope]);
 useEffect(()=>{if(current)setClosed(v=>v[current]?{...v,[current]:false}:v);},[current]);
 function toggle(id:string){const next={...closed,[id]:!closed[id]};setClosed(next);if(loaded.current===scope)try{localStorage.setItem(scope+':closed',JSON.stringify(next));}catch{}}
 const [query,setQuery]=useState(''),[cursor,setCursor]=useState(0),input=useRef<HTMLInputElement>(null);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{const t=e.target as HTMLElement|null;if(e.key!=='/'||e.ctrlKey||e.metaKey||e.altKey||/input|textarea|select/i.test(t?.tagName||'')||t?.isContentEditable)return;e.preventDefault();input.current?.focus();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
 const terms=query.toLowerCase().split(/\s+/).filter(Boolean);
 const results=useMemo(()=>!terms.length?[]:visible.flatMap(g=>g.items.map(i=>({...i,group:learner&&g.learner?g.learner:g.title}))).filter(i=>{const hay=`${i.label} ${words[i.id]||''} ${i.group}`.toLowerCase();return terms.every(t=>hay.includes(t));}).sort((a,b)=>Number(!a.label.toLowerCase().startsWith(terms[0]))-Number(!b.label.toLowerCase().startsWith(terms[0]))).slice(0,10),[query,links]);
 useEffect(()=>setCursor(0),[query]);
 function go(i:TaskLink){setQuery('');onNavigate();if(i.href)window.location.assign(i.href);else i.run?.();}
 function onKey(e:React.KeyboardEvent){if(e.key==='ArrowDown'){e.preventDefault();setCursor(c=>Math.min(c+1,results.length-1));}else if(e.key==='ArrowUp'){e.preventDefault();setCursor(c=>Math.max(c-1,0));}else if(e.key==='Enter'&&results[cursor]){e.preventDefault();go(results[cursor]);}else if(e.key==='Escape')setQuery('');}
 const link=(i:TaskLink)=>{const Icon=i.icon,parts=<><Icon size={17} strokeWidth={1.75} aria-hidden="true"/><span>{i.label}</span></>;return i.href?<a className="tj-nav-link" href={i.href} aria-current={active===i.id?'page':undefined} onClick={onNavigate}>{parts}</a>:<button type="button" className="tj-nav-link" aria-current={active===i.id?'page':undefined} onClick={()=>{onNavigate();i.run?.();}}>{parts}</button>;};
 return <nav className="tj-tasknav" aria-label="Learning workspace navigation">
 <div className="tj-nav-search"><Search size={16} aria-hidden="true"/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onKey} aria-label="Search the menu" aria-controls={prefix+'results'} placeholder="Search menu…"/>{query?<button type="button" aria-label="Clear search" onClick={()=>{setQuery('');input.current?.focus();}}><X size={14}/></button>:<kbd title="Press / to search">/</kbd>}</div>
 {terms.length?<div className="tj-nav-results"><p role="status">{results.length?`${results.length} match${results.length===1?'':'es'} · Enter to open`:'No menu matches. Try another word, such as quiz, marks or live.'}</p><ul id={prefix+'results'} role="listbox">{results.map((r,i)=>{const Icon=r.icon;return <li key={r.id}><button type="button" role="option" aria-selected={i===cursor} className={'tj-nav-link tj-nav-result'+(i===cursor?' active':'')} onMouseEnter={()=>setCursor(i)} onClick={()=>go(r)}><Icon size={17} strokeWidth={1.75} aria-hidden="true"/><span><b>{r.label}</b><small>{r.group}</small></span>{i===cursor&&<CornerDownLeft size={14} aria-hidden="true"/>}</button></li>;})}</ul></div>
 :visible.map(g=><div className={'tj-nav-group'+(current===g.id?' has-active':'')} key={g.id}>
 <button type="button" className="tj-nav-heading" aria-expanded={!closed[g.id]} aria-controls={prefix+g.id} onClick={()=>toggle(g.id)}><span>{learner&&g.learner?g.learner:g.title}</span><ChevronDown size={15} aria-hidden="true"/></button>
 <ul id={prefix+g.id} hidden={!!closed[g.id]}>{g.items.map(i=><li key={i.id}>{link(i)}</li>)}</ul></div>)}</nav>;
}
export function CampusTaskNav(props:Omit<Props,'onNavigate'>){const {isMobile,setOpenMobile}=useSidebar();return <TaskNav {...props} onNavigate={()=>{if(isMobile)setOpenMobile(false);}}/>;}
