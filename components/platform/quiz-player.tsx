'use client';
import {useEffect,useRef,useState} from 'react';
import {Timer,Lightbulb,ArrowUp,ArrowDown,CheckCircle2,XCircle,PlayCircle,Lock,CalendarClock,UserPlus,Trash2} from 'lucide-react';
import './quiz.css';
type Row=Record<string,any>;
const post=async(body:Row)=>{const r=await fetch('/api/units',{method:'POST',headers:{'content-type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error);return d;};
const when=(iso:string|null)=>iso?new Date(iso).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'';
const clock=(ms:number)=>{const s=Math.max(0,Math.floor(ms/1000));return `${Math.floor(s/3600)?Math.floor(s/3600)+':':''}${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
function Question({q,n,value,set,disabled}:{q:Row;n:number;value:any;set:(v:any)=>void;disabled?:boolean}){
 const [hint,setHint]=useState(false);
 const order:number[]=Array.isArray(value)&&q.type==='order'?value:(q.items||[]).map((_:string,i:number)=>i);
 return <fieldset className="qp-question" disabled={disabled}><legend><span className="qp-n">{n}</span>{q.prompt}<small>{q.points} mark{q.points===1?'':'s'}</small></legend>
  {q.type==='single'&&q.options.map((o:string,i:number)=><label key={i} className={'qp-choice'+(value===i?' on':'')}><input type="radio" name={q.id} checked={value===i} onChange={()=>set(i)}/><span>{o}</span></label>)}
  {q.type==='truefalse'&&[true,false].map(v=><label key={String(v)} className={'qp-choice'+(value===v?' on':'')}><input type="radio" name={q.id} checked={value===v} onChange={()=>set(v)}/><span>{v?'True':'False'}</span></label>)}
  {q.type==='multiple'&&<>{q.options.map((o:string,i:number)=>{const on=Array.isArray(value)&&value.includes(i);return <label key={i} className={'qp-choice'+(on?' on':'')}><input type="checkbox" checked={on} onChange={e=>set(e.target.checked?[...(value||[]),i]:(value||[]).filter((x:number)=>x!==i))}/><span>{o}</span></label>})}<small className="qp-help">Choose all that apply.</small></>}
  {q.type==='text'&&<input className="qp-input" aria-label={'Answer for question '+n} maxLength={300} value={value??''} onChange={e=>set(e.target.value)} placeholder="Type your answer"/>}
  {q.type==='numeric'&&<input className="qp-input" aria-label={'Answer for question '+n} inputMode="decimal" maxLength={40} value={value??''} onChange={e=>set(e.target.value)} placeholder="Enter a number"/>}
  {q.type==='match'&&<div className="qp-match">{q.lefts.map((l:string,i:number)=><label key={i}><span>{l}</span><select value={Array.isArray(value)&&Number.isInteger(value[i])?value[i]:''} onChange={e=>{const next=Array.isArray(value)?[...value]:Array(q.lefts.length).fill(null);next[i]=e.target.value===''?null:Number(e.target.value);set(next)}}><option value="">Choose…</option>{q.rights.map((r:string,j:number)=><option key={j} value={j}>{r}</option>)}</select></label>)}</div>}
  {q.type==='order'&&<ol className="qp-order">{order.map((d,pos)=><li key={d}><span>{q.items[d]}</span><button type="button" aria-label="Move up" disabled={pos===0} onClick={()=>{const a=[...order];[a[pos-1],a[pos]]=[a[pos],a[pos-1]];set(a)}}><ArrowUp size={15}/></button><button type="button" aria-label="Move down" disabled={pos===order.length-1} onClick={()=>{const a=[...order];[a[pos+1],a[pos]]=[a[pos],a[pos+1]];set(a)}}><ArrowDown size={15}/></button></li>)}</ol>}
  {q.hint&&<div className="qp-hint">{hint?<p><Lightbulb size={15}/> {q.hint}</p>:<button type="button" className="quiet-link" onClick={()=>setHint(true)}><Lightbulb size={15}/> Show hint</button>}</div>}
 </fieldset>;
}
const answered=(q:Row,v:any)=>v!==undefined&&v!==null&&v!==''&&!(Array.isArray(v)&&(!v.length||(q.type==='match'&&v.some((x:any)=>x===null||x===undefined))));
function Review({items}:{items:Row[]}){
 const shown=(q:Row)=>{const a=q.answer;if(a===null||a===undefined||a==='')return 'No answer';if(q.type==='single')return q.options[a];if(q.type==='truefalse')return a?'True':'False';if(q.type==='multiple')return (a as number[]).map(i=>q.options[i]).join(' · ');if(q.type==='match')return q.lefts.map((l:string,i:number)=>`${l} → ${a[i]===null||a[i]===undefined?'—':q.rights[a[i]]}`).join(' · ');if(q.type==='order')return (a as number[]).map(i=>q.items[i]).join(' → ');return String(a);};
 return <ol className="qp-review">{items.map((q,i)=><li key={q.id} className={q.fraction===1?'right':q.fraction>0?'part':'wrong'}><p className="qp-review-q">{q.fraction===1?<CheckCircle2 size={17}/>:<XCircle size={17}/>} <b>{i+1}. {q.prompt}</b>{q.fraction>0&&q.fraction<1&&<em> · part marks {Math.round(q.fraction*100)}%</em>}</p><p><span>Your answer:</span> {shown(q)}</p>{q.fraction<1&&<p><span>Correct answer:</span> {q.correctAnswer}</p>}{q.explanation&&<p className="qp-explain">{q.explanation}</p>}</li>)}</ol>;
}
/** A learner taking a unit quiz: start, timer, autosave, submit and review. */
export function QuizPlayer({unit,onDone}:{unit:Row;onDone:()=>Promise<any>|void}){
 const info=unit.quizInfo||{},[session,setSession]=useState<Row|null>(null),[answers,setAnswers]=useState<Row>({}),[result,setResult]=useState<Row|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());
 const dirty=useRef(false),submitting=useRef(false);
 const deadline=session?.deadline?Date.parse(session.deadline):null,left=deadline?deadline-now:null;
 useEffect(()=>{if(!deadline)return;const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[deadline]);
 // Save progress every few seconds, so time running out keeps what was answered.
 useEffect(()=>{if(!session)return;const t=setInterval(()=>{if(dirty.current){dirty.current=false;post({action:'quiz-save',unitId:unit.id,sessionId:session.sessionId,answers}).catch(()=>{dirty.current=true})}},4000);return()=>clearInterval(t)},[session,answers]);
 useEffect(()=>{if(left!==null&&left<=0&&session&&!submitting.current)submit(true)},[left]);
 async function start(){setBusy(true);setError('');try{const d=await post({action:'quiz-start',unitId:unit.id}),init:Row={...(d.answers||{})};for(const q of d.questions)if(q.type==='order'&&!Array.isArray(init[q.id]))init[q.id]=q.items.map((_:string,i:number)=>i);setSession(d);setAnswers(init);setResult(null);setNow(Date.now())}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function submit(auto=false){
  if(!session||submitting.current)return;
  const missing=session.questions.filter((q:Row)=>!answered(q,answers[q.id])).length;
  if(!auto&&missing&&!window.confirm(`${missing} question${missing===1?' is':'s are'} not answered. Hand in anyway?`))return;
  submitting.current=true;setBusy(true);setError('');
  try{const d=await post({action:'quiz-submit',unitId:unit.id,sessionId:session.sessionId,answers});setResult({...d,auto});setSession(null);await onDone()}catch(e){setError((e as Error).message)}finally{setBusy(false);submitting.current=false}
 }
 const set=(id:string,v:any)=>{dirty.current=true;setAnswers(a=>({...a,[id]:v}))};
 if(result)return <section className="qp-result"><div className={'qp-score'+(result.passed===false?' fail':'')}><strong>{result.score}%</strong><span>{result.earned} of {result.max} marks{result.passed===true?' · Passed':result.passed===false?' · Below the pass mark':''}</span></div>{result.auto&&<p className="data-note">Time ran out, so your saved answers were handed in.</p>}{result.late&&<p className="data-note">This attempt reached us after the time limit, so the answers saved before time ran out were marked.</p>}{result.attemptsLeft!==null&&<p className="data-note">{result.attemptsLeft} attempt{result.attemptsLeft===1?'':'s'} left.</p>}{result.review?<><h4>Review your answers</h4><Review items={result.review}/></>:<p className="data-note">Your teacher will show the correct answers later.</p>}<button className="button button-outline" onClick={()=>setResult(null)}>Back to the quiz</button></section>;
 if(session)return <form className="qp" onSubmit={e=>{e.preventDefault();submit()}}>
  <div className={'qp-bar'+(left!==null&&left<60000?' urgent':'')}><span>{session.questions.filter((q:Row)=>answered(q,answers[q.id])).length} of {session.questions.length} answered</span>{left!==null&&<span className="qp-timer" role="timer" aria-live={left<60000?'assertive':'off'}><Timer size={16}/> {clock(left)} left</span>}</div>
  {session.questions.map((q:Row,i:number)=><Question key={q.id} q={q} n={i+1} value={answers[q.id]} set={v=>set(q.id,v)}/>)}
  {error&&<p role="alert" className="status-message error-message">{error}</p>}
  <div className="qp-foot"><small>Your answers are saved as you go.</small><button disabled={busy} className="button button-orange">{busy?'Handing in…':'Hand in quiz'}</button></div>
 </form>;
 const blocked=info.blocked;
 return <section className="qp-intro">
  <ul className="qp-facts"><li><b>{info.count}</b> questions</li><li><b>{info.timeLimit?info.timeLimit+' min':'No'}</b> time limit</li><li><b>{info.maxAttempts?`${Math.max(0,info.maxAttempts-info.used)} of ${info.maxAttempts}`:'Unlimited'}</b> attempts left</li>{info.passMark>0&&<li><b>{info.passMark}%</b> to pass</li>}</ul>
  {(info.opensAt||info.closesAt)&&<p className="qp-window"><CalendarClock size={16}/> {info.opensAt?'Opens '+when(info.opensAt):''}{info.opensAt&&info.closesAt?' · ':''}{info.closesAt?'Closes '+when(info.closesAt):''}</p>}
  {info.timeLimit>0&&<p className="data-note">The timer starts when you press Start and keeps running if you leave the page. Your answers are saved as you go and handed in automatically when time runs out.</p>}
  {error&&<p role="alert" className="status-message error-message">{error}</p>}
  {blocked&&!info.activeSession?<p className="qp-blocked"><Lock size={16}/> {blocked}</p>:<button className="button button-orange" disabled={busy} onClick={start}><PlayCircle size={17}/> {info.activeSession?'Continue your attempt':info.used?'Start a new attempt':'Start quiz'}</button>}
 </section>;
}
/** Teacher view: attempts and individual extensions (extra time, attempts or a later close date). */
export function QuizStaffPanel({unit,attempts,extensions,learners,onChanged}:{unit:Row;attempts:Row[];extensions:Row[];learners:Row[];onChanged:()=>Promise<any>}){
 const [form,setForm]=useState({userId:'',extraMinutes:0,extraAttempts:0,closesAt:'',reason:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const mine=attempts.filter(a=>a.unit_id===unit.id),ext=extensions.filter(e=>e.unit_id===unit.id),s=unit.quizSettings||{};
 const best=new Map<string,Row>();for(const a of mine){const b=best.get(a.user_id);if(!b||a.score>b.score)best.set(a.user_id,{...a,count:(b?.count||0)+1});else best.set(a.user_id,{...b,count:b.count+1});}
 const avg=best.size?Math.round([...best.values()].reduce((n,a)=>n+Number(a.score),0)/best.size):null;
 async function grant(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await post({action:'extension',unitId:unit.id,userId:form.userId,extraMinutes:Number(form.extraMinutes),extraAttempts:Number(form.extraAttempts),closesAt:form.closesAt?new Date(form.closesAt).toISOString():null,reason:form.reason});setForm({userId:'',extraMinutes:0,extraAttempts:0,closesAt:'',reason:''});await onChanged()}catch(err){setError((err as Error).message)}finally{setBusy(false)}}
 return <div className="qs">
  <div className="qs-stats"><div><strong>{best.size}</strong><span>Learners attempted</span></div><div><strong>{avg===null?'—':avg+'%'}</strong><span>Average best score</span></div><div><strong>{s.timeLimit?s.timeLimit+' min':'—'}</strong><span>Time limit</span></div><div><strong>{s.maxAttempts||'∞'}</strong><span>Attempts allowed</span></div></div>
  <h4>Best score per learner</h4>
  {best.size?<table className="qs-table"><thead><tr><th>Learner</th><th>Best</th><th>Attempts</th><th>Last</th></tr></thead><tbody>{[...best.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(a=><tr key={a.user_id}><td>{a.name}</td><td><b>{a.score}%</b></td><td>{a.count}</td><td>{a.submitted_at} UTC</td></tr>)}</tbody></table>:<p className="data-note">No attempts yet.</p>}
  <h4>Extensions for individual learners</h4>
  <p className="data-note">Give one learner extra time, more attempts or a later closing date, for example for illness or a learning need.</p>
  <form className="qs-ext" onSubmit={grant}><label className="field">Learner<select required value={form.userId} onChange={e=>setForm({...form,userId:e.target.value})}><option value="">Choose a learner…</option>{learners.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label className="field">Extra minutes<input type="number" min={0} max={600} value={form.extraMinutes} onChange={e=>setForm({...form,extraMinutes:Number(e.target.value)})}/></label><label className="field">Extra attempts<input type="number" min={0} max={20} value={form.extraAttempts} onChange={e=>setForm({...form,extraAttempts:Number(e.target.value)})}/></label><label className="field">Closes later on<input type="datetime-local" value={form.closesAt} onChange={e=>setForm({...form,closesAt:e.target.value})}/></label><label className="field">Reason<input maxLength={300} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label><button className="button button-outline" disabled={busy||!form.userId}><UserPlus size={16}/> Give extension</button></form>
  {error&&<p role="alert" className="status-message error-message">{error}</p>}
  {ext.length>0&&<ul className="qs-ext-list">{ext.map(e=><li key={e.user_id}><span><b>{e.name}</b> · {e.extra_minutes?`+${e.extra_minutes} min`:''}{e.extra_attempts?` +${e.extra_attempts} attempt${e.extra_attempts===1?'':'s'}`:''}{e.closes_at?` · closes ${when(e.closes_at)}`:''}{e.reason?` · ${e.reason}`:''}</span><button className="quiet-link qb-danger" disabled={busy} onClick={async()=>{setBusy(true);try{await post({action:'extension-remove',unitId:unit.id,userId:e.user_id});await onChanged()}catch(err){setError((err as Error).message)}finally{setBusy(false)}}}><Trash2 size={14}/> Remove</button></li>)}</ul>}
 </div>;
}
