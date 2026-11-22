'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Check,Layers,RotateCcw} from 'lucide-react';
import {type CardTheme,type CardKind,type PracticeCard,type TeacherCard} from '@/lib/tutoring';
import './tutoring.css';
export type CourseSet={id:string;title:string;size:number};
export function CardPractice({cards,title,theme,kind='flash',presenter=false,onClose}:{cards:(PracticeCard|TeacherCard)[];title:string;theme:CardTheme;kind?:CardKind;presenter?:boolean;onClose:()=>void}){
 const [order,setOrder]=useState(()=>cards.map((_,i)=>i)),[pos,setPos]=useState(0),[back,setBack]=useState(false),[again,setAgain]=useState<number[]>([]),[note,setNote]=useState(false),[large,setLarge]=useState(false);
 const cue=kind==='cue',done=pos>=order.length,card=cards[order[pos]],caption=cue?'Talking points':'Answer';
 function reset(items:number[]){setOrder(items);setAgain([]);move(0);}
 function move(n:number){setPos(n);setBack(false);setNote(false);}
 function next(retry:boolean){setAgain(a=>retry?[...new Set([...a,order[pos]])]:a.filter(i=>i!==order[pos]));move(pos+1);}
 return <section className="tutor-practice" aria-label={presenter?'Deck rehearsal':'Flashcard practice'}><div className="tutor-row"><div><span className="tutor-eyebrow">{cue?'Presenter rehearsal':presenter?'Flashcard rehearsal':'Student practice'}</span><h3>{title}</h3></div><div className="tutor-actions"><button className="tutor-btn" aria-pressed={large} onClick={()=>setLarge(!large)}>Large text</button><button className="tutor-btn" onClick={onClose}>Close {presenter?'rehearsal':'practice'}</button></div></div>
 {done?<div className="tutor-complete" role="status"><Check size={26}/><h3>{cue?'Rehearsal complete':'Round complete'}</h3><p>{cue?'You reached the last cue.':again.length?again.length+' '+(again.length===1?'card marked':'cards marked')+' for another try.':'You marked every card as learned.'}</p><div className="tutor-actions">{!!again.length&&<button className="tutor-btn primary" onClick={()=>reset(again)}>Practice marked cards</button>}<button className="tutor-btn" onClick={()=>reset(cards.map((_,i)=>i))}><RotateCcw size={16}/>Start over</button></div></div>:
 <><div className="tutor-progress" aria-live="polite">Card {pos+1} of {order.length}<progress max={order.length} value={pos+1} aria-label="Practice progress"/></div><div className={'tutor-face tutor-'+theme+(large?' tutor-large':'')} aria-live="polite"><span className="tutor-eyebrow">{back?caption:cue?'Speaking cue':'Question'}</span><p>{back?card.back:card.front}</p></div>
 <div className="tutor-actions">{presenter&&pos>0&&<button className="tutor-btn" onClick={()=>move(pos-1)}><ArrowLeft size={16}/>Previous</button>}<button className={'tutor-btn '+(!back?'primary':'')} onClick={()=>setBack(!back)}>{back?(cue?'Show cue':'Show question'):cue?'Reveal talking points':'Reveal answer'}</button>
 {cue?<button className="tutor-btn primary" onClick={()=>next(false)}>{pos===order.length-1?'Finish rehearsal':'Next card'}<ArrowRight size={16}/></button>:back&&<><button className="tutor-btn" onClick={()=>next(true)}><RotateCcw size={15}/>Practice again</button><button className="tutor-btn primary" onClick={()=>next(false)}><Check size={16}/>Got it</button></>}</div>
 {presenter&&'note' in card&&card.note&&<div className="tutor-private"><button className="tutor-link" aria-expanded={note} onClick={()=>setNote(!note)}>{note?'Hide private note':'Show private teacher note'}</button>{note&&<p>{card.note}</p>}</div>}</>}</section>;
}
export function CourseFlashcards({courseId,sets}:{courseId:string;sets:CourseSet[]}){
 const [active,setActive]=useState<{id:string;title:string;theme:CardTheme;cards:PracticeCard[]}|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
 async function open(id:string){setBusy(id);setError('');try{const r=await fetch('/api/tutoring?'+new URLSearchParams({course:courseId,deck:id}),{cache:'no-store'}),v=await r.json();if(!r.ok)throw Error(v.error||'Could not open these flashcards.');setActive({...v,id});}catch(e){setError((e as Error).message)}finally{setBusy('')}}
 if(!sets.length)return null;
 return <section className="tutor-cards-ui tutor-course" aria-label="Course flashcards"><span className="tutor-eyebrow"><Layers size={15}/> Study tools</span><h2>Practice flashcards</h2><p>Try each question before revealing the answer. Mark tricky cards for another round.</p>{active?<CardPractice key={active.id} {...active} onClose={()=>setActive(null)}/>:sets.map(d=><div key={d.id} className="tutor-set"><div><strong>{d.title}</strong><small>{d.size} {Number(d.size)===1?'card':'cards'}</small></div><button className="tutor-btn" disabled={!!busy} onClick={()=>open(d.id)}>{busy===d.id?'Opening…':'Practice'}<ArrowRight size={16}/></button></div>)}{error&&<p role="alert" className="tutor-error">{error}</p>}</section>;
}
