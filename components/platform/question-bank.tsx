'use client';
import {useEffect,useState} from 'react';
import {Library,Plus,Pencil,Trash2,Search} from 'lucide-react';
import {QUESTION_TYPES,DIFFICULTY} from '@/lib/quiz-engine.mjs';
import {QuestionEditor,newQuestion} from './quiz-builder';
import './quiz.css';
type Row=Record<string,any>;
const types=QUESTION_TYPES as Record<string,string>;
const call=async(body:Row)=>{const r=await fetch('/api/question-bank',{method:'POST',headers:{'content-type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);return d;};
/** A shared, tagged bank of questions. Quizzes can draw random questions from it. */
export function QuestionBank({org,courses}:{org:string;courses:{id:string;title:string}[]}){
 const [items,setItems]=useState<Row[]|null>(null),[me,setMe]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [query,setQuery]=useState(''),[tag,setTag]=useState(''),[level,setLevel]=useState(''),[kind,setKind]=useState(''),[edit,setEdit]=useState<Row|null>(null);
 async function load(){try{const r=await fetch('/api/question-bank?org='+org),d=await r.json();if(!r.ok)throw Error(d.error);setItems(d.items);setMe(d.me)}catch(e){setError((e as Error).message)}}
 useEffect(()=>{load()},[org]);
 const tags=[...new Set((items||[]).flatMap(i=>i.tags))].sort();
 const shown=(items||[]).filter(i=>(!tag||i.tags.includes(tag))&&(!level||i.difficulty===level)&&(!kind||i.question.type===kind)&&`${i.question.prompt} ${i.courseTitle||''}`.toLowerCase().includes(query.toLowerCase()));
 async function save(e:React.FormEvent){e.preventDefault();if(!edit)return;setBusy(true);setError('');try{await call({org,action:'save',id:edit.id,courseId:edit.courseId||null,tags:edit.tags,difficulty:edit.difficulty,question:edit.question});setEdit(null);setNotice('Question saved to the bank.');await load()}catch(err){setError((err as Error).message)}finally{setBusy(false)}}
 return <section className="work-panel qbank">
  <div className="unit-heading"><div><h2><Library size={20}/> Question bank</h2><p>Keep good questions in one place, tag them by topic and difficulty, and let unit quizzes draw a different random set for each learner.</p></div><button className="button button-orange" onClick={()=>setEdit({question:newQuestion('single'),tags:'',difficulty:'medium',courseId:''})}><Plus size={16}/> New question</button></div>
  {error&&<p role="alert" className="status-message error-message">{error}</p>}{notice&&<p role="status" className="status-message">{notice}</p>}
  {edit&&<form className="editor-section" onSubmit={save}><h3>{edit.id?'Edit question':'New question'}</h3>
   <div className="form-grid qb-three"><label className="field">Tags (comma separated)<input value={Array.isArray(edit.tags)?edit.tags.join(', '):edit.tags} placeholder="e.g. fractions, grade 6" onChange={e=>setEdit({...edit,tags:e.target.value})}/></label><label className="field">Difficulty<select value={edit.difficulty} onChange={e=>setEdit({...edit,difficulty:e.target.value})}>{(DIFFICULTY as string[]).map(d=><option key={d}>{d}</option>)}</select></label><label className="field">Course (optional)<select value={edit.courseId||''} onChange={e=>setEdit({...edit,courseId:e.target.value})}><option value="">Any course</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label></div>
   <QuestionEditor q={edit.question} n={1} total={1} onChange={question=>setEdit({...edit,question})}/>
   <div className="editor-actions"><button className="button button-orange" disabled={busy}>{busy?'Saving…':'Save question'}</button><button type="button" className="quiet-link" onClick={()=>setEdit(null)}>Cancel</button></div></form>}
  <div className="qbank-tools"><label className="search-input"><Search size={16}/><input aria-label="Search questions" placeholder="Search questions…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <label className="field">Tag<select value={tag} onChange={e=>setTag(e.target.value)}><option value="">All tags</option>{tags.map(t=><option key={t}>{t}</option>)}</select></label>
   <label className="field">Difficulty<select value={level} onChange={e=>setLevel(e.target.value)}><option value="">Any</option>{(DIFFICULTY as string[]).map(d=><option key={d}>{d}</option>)}</select></label>
   <label className="field">Type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">All types</option>{Object.entries(types).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>
  {!items?<p role="status">Loading…</p>:!shown.length?<p className="data-note">{items.length?'No questions match these filters.':'The bank is empty. Add a question here, or use “Save to question bank” while editing a unit quiz.'}</p>:
   <ul className="qbank-list">{shown.map(i=><li key={i.id}><div><b>{i.question.prompt}</b><small>{types[i.question.type]} · {i.difficulty} · {i.question.points||1} mark{(i.question.points||1)===1?'':'s'}{i.courseTitle?' · '+i.courseTitle:''} · by {i.author}</small><span>{i.tags.map((t:string)=><span key={t} className="qbank-tag">{t}</span>)}</span></div>
    <span className="qb-actions"><button className="quiet-link" onClick={()=>setEdit({id:i.id,question:i.question,tags:i.tags.join(', '),difficulty:i.difficulty,courseId:i.courseId||''})}><Pencil size={14}/> Edit</button><button className="quiet-link qb-danger" disabled={busy} onClick={async()=>{if(!window.confirm('Remove this question from the bank? Quizzes already taken keep their record.'))return;setBusy(true);try{await call({org,action:'delete',id:i.id});await load()}catch(err){setError((err as Error).message)}finally{setBusy(false)}}}><Trash2 size={14}/> Remove</button></span></li>)}</ul>}
  <p className="data-note">{shown.length} of {items?.length||0} questions shown. Only the author or an administrator can change a question.</p>
 </section>;
}
