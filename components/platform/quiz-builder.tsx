'use client';
import {useEffect,useState} from 'react';
import {Plus,ArrowUp,ArrowDown,Trash2,Library,BookmarkPlus,X,Settings2,Shuffle} from 'lucide-react';
import {QUESTION_TYPES,SHOW_ANSWERS,DIFFICULTY,DEFAULT_SETTINGS} from '@/lib/quiz-engine.mjs';
import './quiz.css';
type Row=Record<string,any>;
const types=QUESTION_TYPES as Record<string,string>;
const local=(iso:string|null)=>{if(!iso)return '';const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const toIso=(v:string)=>v?new Date(v).toISOString():null;
/** A fresh question of a type, keeping the prompt and points when the type changes. */
export function newQuestion(type='single',from:Row={}):Row{
 const base={id:from.id||crypto.randomUUID(),type,prompt:from.prompt||'',points:from.points||1,hint:from.hint||'',explanation:from.explanation||''};
 if(type==='single')return {...base,options:from.options?.length>=2?from.options:['','','',''],correct:0};
 if(type==='multiple')return {...base,options:from.options?.length>=2?from.options:['','','',''],correct:[]};
 if(type==='truefalse')return {...base,correct:true};
 if(type==='text')return {...base,answers:[''],caseSensitive:false};
 if(type==='numeric')return {...base,answer:'',tolerance:0};
 if(type==='match')return {...base,pairs:[{left:'',right:''},{left:'',right:''},{left:'',right:''}]};
 return {...base,items:['','','']};
}
const asType=(q:Row)=>q.type?q:{...q,type:'single'};
function ListEditor({label,values,onChange,min,max,mark}:{label:string;values:string[];onChange:(v:string[])=>void;min:number;max:number;mark?:(i:number)=>React.ReactNode}){
 return <div className="qb-list"><span className="qb-label">{label}</span>{values.map((v,i)=><div className="qb-row" key={i}>{mark?.(i)}<input required maxLength={1000} value={v} placeholder={label.replace(/s$/,'')+' '+(i+1)} onChange={e=>onChange(values.map((x,k)=>k===i?e.target.value:x))}/><button type="button" className="qb-icon" aria-label="Remove" disabled={values.length<=min} onClick={()=>onChange(values.filter((_,k)=>k!==i))}><X size={14}/></button></div>)}{values.length<max&&<button type="button" className="quiet-link" onClick={()=>onChange([...values,''])}><Plus size={14}/> Add</button>}</div>;
}
export function QuestionEditor({q,n,onChange,onRemove,onMove,onBank,total}:{q:Row;n:number;total:number;onChange:(q:Row)=>void;onRemove?:()=>void;onMove?:(d:number)=>void;onBank?:()=>void}){
 const set=(patch:Row)=>onChange({...q,...patch});
 return <fieldset className="qb-question"><legend>Question {n}</legend>
  <div className="form-grid qb-top"><label className="field">Type<select value={q.type} onChange={e=>onChange(newQuestion(e.target.value,q))}>{Object.entries(types).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="field">Points<input type="number" min={0.5} max={20} step={0.5} value={q.points??1} onChange={e=>set({points:Number(e.target.value)})}/></label></div>
  <label className="field">Question<textarea required maxLength={2000} rows={2} value={q.prompt} onChange={e=>set({prompt:e.target.value})}/></label>
  {(q.type==='single'||q.type==='multiple')&&<ListEditor label="Options" values={q.options} min={2} max={8} onChange={options=>set({options,correct:q.type==='single'?Math.min(q.correct,options.length-1):(q.correct||[]).filter((i:number)=>i<options.length)})} mark={i=>q.type==='single'?<input type="radio" aria-label={'Option '+(i+1)+' is correct'} checked={q.correct===i} onChange={()=>set({correct:i})}/>:<input type="checkbox" aria-label={'Option '+(i+1)+' is correct'} checked={(q.correct||[]).includes(i)} onChange={e=>set({correct:e.target.checked?[...(q.correct||[]),i]:(q.correct||[]).filter((x:number)=>x!==i)})}/>}/>}
  {(q.type==='single'||q.type==='multiple')&&<small className="qb-help">{q.type==='single'?'Select the one correct option.':'Tick every correct option. Learners must choose exactly these to get the mark.'}</small>}
  {q.type==='truefalse'&&<div className="qb-tf"><span className="qb-label">Correct answer</span>{[true,false].map(v=><label key={String(v)}><input type="radio" checked={q.correct===v} onChange={()=>set({correct:v})}/> {v?'True':'False'}</label>)}</div>}
  {q.type==='text'&&<><ListEditor label="Accepted answers" values={q.answers} min={1} max={10} onChange={answers=>set({answers})}/><label className="qb-check"><input type="checkbox" checked={!!q.caseSensitive} onChange={e=>set({caseSensitive:e.target.checked})}/> Capital letters matter</label><small className="qb-help">Extra spaces are ignored. Add spellings you will accept, such as “Kathmandu” and “Kathmandu city”.</small></>}
  {q.type==='numeric'&&<div className="form-grid"><label className="field">Correct number<input required inputMode="decimal" value={q.answer} onChange={e=>set({answer:e.target.value})}/></label><label className="field">Accept within ±<input type="number" min={0} step="any" value={q.tolerance} onChange={e=>set({tolerance:e.target.value})}/></label></div>}
  {q.type==='match'&&<div className="qb-list"><span className="qb-label">Pairs (learners see the right side shuffled)</span>{q.pairs.map((p:Row,i:number)=><div className="qb-row" key={i}><input required maxLength={300} placeholder="Left" value={p.left} onChange={e=>set({pairs:q.pairs.map((x:Row,k:number)=>k===i?{...x,left:e.target.value}:x)})}/><span>→</span><input required maxLength={300} placeholder="Matches" value={p.right} onChange={e=>set({pairs:q.pairs.map((x:Row,k:number)=>k===i?{...x,right:e.target.value}:x)})}/><button type="button" className="qb-icon" aria-label="Remove pair" disabled={q.pairs.length<=2} onClick={()=>set({pairs:q.pairs.filter((_:Row,k:number)=>k!==i)})}><X size={14}/></button></div>)}{q.pairs.length<8&&<button type="button" className="quiet-link" onClick={()=>set({pairs:[...q.pairs,{left:'',right:''}]})}><Plus size={14}/> Add pair</button>}</div>}
  {q.type==='order'&&<><ListEditor label="Items in the correct order" values={q.items} min={2} max={8} onChange={items=>set({items})}/><small className="qb-help">Learners see the items shuffled and put them back in order. Each item in the right place earns part of the mark.</small></>}
  <div className="form-grid"><label className="field">Hint (optional)<input maxLength={1000} value={q.hint||''} onChange={e=>set({hint:e.target.value})}/></label><label className="field">Explanation after answering (optional)<input maxLength={2000} value={q.explanation||''} onChange={e=>set({explanation:e.target.value})}/></label></div>
  <div className="qb-actions">{onMove&&<><button type="button" className="qb-icon" aria-label="Move up" disabled={n===1} onClick={()=>onMove(-1)}><ArrowUp size={15}/></button><button type="button" className="qb-icon" aria-label="Move down" disabled={n===total} onClick={()=>onMove(1)}><ArrowDown size={15}/></button></>}{onBank&&<button type="button" className="quiet-link" onClick={onBank}><BookmarkPlus size={15}/> Save to question bank</button>}{onRemove&&<button type="button" className="quiet-link qb-danger" onClick={onRemove}><Trash2 size={15}/> Remove</button>}</div>
 </fieldset>;
}
function BankPicker({org,onPick,onClose}:{org:string;onPick:(qs:Row[])=>void;onClose:()=>void}){
 const [items,setItems]=useState<Row[]|null>(null),[error,setError]=useState(''),[query,setQuery]=useState(''),[chosen,setChosen]=useState<string[]>([]);
 useEffect(()=>{fetch('/api/question-bank?org='+org).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setItems(d.items)}).catch(e=>setError(e.message));},[org]);
 const shown=(items||[]).filter(i=>`${i.question.prompt} ${i.tags.join(' ')} ${i.courseTitle||''}`.toLowerCase().includes(query.toLowerCase()));
 return <div className="qb-modal" role="dialog" aria-modal="true" aria-label="Add questions from the bank"><div className="qb-modal-card"><header><h3><Library size={18}/> Question bank</h3><button type="button" className="qb-icon" aria-label="Close" onClick={onClose}><X size={16}/></button></header>
  <input className="qb-search" placeholder="Search questions or tags…" value={query} onChange={e=>setQuery(e.target.value)}/>{error&&<p className="status-message error-message">{error}</p>}
  <ul className="qb-bank-list">{!items?<li>Loading…</li>:!shown.length?<li className="data-note">No questions found. Save questions to the bank from a quiz, or add them under Quizzes → Question bank.</li>:shown.map(i=><li key={i.id}><label><input type="checkbox" checked={chosen.includes(i.id)} onChange={e=>setChosen(c=>e.target.checked?[...c,i.id]:c.filter(x=>x!==i.id))}/><span><b>{i.question.prompt}</b><small>{types[i.question.type]} · {i.difficulty}{i.tags.length?' · '+i.tags.join(', '):''}</small></span></label></li>)}</ul>
  <footer><span>{chosen.length} selected</span><button type="button" className="button button-orange" disabled={!chosen.length} onClick={()=>onPick((items||[]).filter(i=>chosen.includes(i.id)).map(i=>({...i.question,id:crypto.randomUUID()})))}>Add to quiz</button></footer></div></div>;
}
/** Quiz questions and exam rules for one unit. */
export function QuizBuilder({quiz,settings,onChange,org,courseId}:{quiz:Row[];settings:Row;onChange:(quiz:Row[],settings:Row)=>void;org?:string;courseId:string}){
 const s:Row={...DEFAULT_SETTINGS,...settings},qs=quiz.map(asType),[picking,setPicking]=useState(false),[note,setNote]=useState('');
 const setS=(patch:Row)=>onChange(qs,{...s,...patch}),setQ=(next:Row[])=>onChange(next,s);
 async function toBank(q:Row){setNote('');const r=await fetch('/api/question-bank',{method:'POST',headers:{'content-type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify({org,action:'save',courseId,difficulty:'medium',tags:'',question:{...q,id:crypto.randomUUID()}})}),d=await r.json();setNote(r.ok?'Saved to the question bank.':d.error)}
 const draws=s.draw?.count>0;
 return <details className="unit-quiz-builder qb" open={qs.length>0||draws}><summary>Unit quiz · {qs.length} question{qs.length===1?'':'s'}{draws?` + ${s.draw.count} from the bank`:''}{s.timeLimit?` · ${s.timeLimit} min`:''}</summary>
  <section className="qb-settings"><h4><Settings2 size={16}/> Quiz rules</h4>
   <div className="form-grid"><label className="field">Time limit (minutes, 0 = none)<input type="number" min={0} max={600} value={s.timeLimit} onChange={e=>setS({timeLimit:Number(e.target.value)})}/></label><label className="field">Attempts allowed (0 = unlimited)<input type="number" min={0} max={50} value={s.maxAttempts} onChange={e=>setS({maxAttempts:Number(e.target.value)})}/></label></div>
   <div className="form-grid"><label className="field">Opens (optional)<input type="datetime-local" value={local(s.opensAt)} onChange={e=>setS({opensAt:toIso(e.target.value)})}/></label><label className="field">Closes (optional)<input type="datetime-local" value={local(s.closesAt)} onChange={e=>setS({closesAt:toIso(e.target.value)})}/></label></div>
   <div className="form-grid"><label className="field">Show correct answers<select value={s.showAnswers} onChange={e=>setS({showAnswers:e.target.value})}>{Object.entries(SHOW_ANSWERS as Record<string,string>).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="field">Pass mark (%, 0 = none)<input type="number" min={0} max={100} value={s.passMark} onChange={e=>setS({passMark:Number(e.target.value)})}/></label></div>
   <div className="qb-checks"><label className="qb-check"><input type="checkbox" checked={s.shuffleQuestions} onChange={e=>setS({shuffleQuestions:e.target.checked})}/> <Shuffle size={14}/> Shuffle question order for each learner</label><label className="qb-check"><input type="checkbox" checked={s.shuffleOptions} onChange={e=>setS({shuffleOptions:e.target.checked})}/> Shuffle answer choices</label></div>
   <div className="qb-draw"><label className="qb-check"><input type="checkbox" checked={draws} onChange={e=>setS({draw:e.target.checked?{count:5,tags:[],difficulty:''}:null})}/> Also draw random questions from the question bank</label>
    {draws&&<div className="form-grid qb-three"><label className="field">How many<input type="number" min={1} max={50} value={s.draw.count} onChange={e=>setS({draw:{...s.draw,count:Number(e.target.value)}})}/></label><label className="field">With all these tags<input placeholder="e.g. fractions, grade 6" value={(s.draw.tags||[]).join(', ')} onChange={e=>setS({draw:{...s.draw,tags:e.target.value.split(',').map((t:string)=>t.trim().toLowerCase()).filter(Boolean)}})}/></label><label className="field">Difficulty<select value={s.draw.difficulty||''} onChange={e=>setS({draw:{...s.draw,difficulty:e.target.value}})}><option value="">Any</option>{(DIFFICULTY as string[]).map(d=><option key={d}>{d}</option>)}</select></label></div>}
    {draws&&<small className="qb-help">Each learner gets a different random set. Make sure the bank has enough matching questions.</small>}</div>
   {(s.timeLimit||s.maxAttempts||s.opensAt||s.closesAt||draws||s.shuffleQuestions||s.shuffleOptions||s.showAnswers!=='immediately'||qs.some(q=>q.type!=='single'||q.options?.length!==4))?<p className="data-note">This quiz uses exam rules or new question types, so learners take it on the website. The mobile app shows a link to open it.</p>:null}
  </section>
  {qs.map((q,i)=><QuestionEditor key={q.id} q={q} n={i+1} total={qs.length} onChange={nq=>setQ(qs.map(x=>x.id===q.id?nq:x))} onRemove={()=>setQ(qs.filter(x=>x.id!==q.id))} onMove={d=>{const a=[...qs],j=i+d;[a[i],a[j]]=[a[j],a[i]];setQ(a)}} onBank={org?()=>toBank(q):undefined}/>)}
  {note&&<p role="status" className="data-note">{note}</p>}
  <div className="editor-actions"><button className="button button-outline" type="button" disabled={qs.length>=50} onClick={()=>setQ([...qs,newQuestion('single')])}><Plus size={16}/> Add question</button>{org&&<button className="button button-outline" type="button" onClick={()=>setPicking(true)}><Library size={16}/> Add from question bank</button>}</div>
  {picking&&org&&<BankPicker org={org} onClose={()=>setPicking(false)} onPick={picked=>{setQ([...qs,...picked].slice(0,50));setPicking(false)}}/>}
 </details>;
}
