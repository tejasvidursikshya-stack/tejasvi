'use client';
import {useRef,useState,type KeyboardEvent} from 'react';
import {Minus,Plus} from 'lucide-react';
import {Photo,type Asset} from './media';

const chapters=[
 {tab:'Lesson library',title:'A place for every resource.',desc:'Put slides, readings, video and worksheets beside the unit they belong to. Learners open the right material without searching through messages.',tag:'01 / MATERIALS',art:'college',alt:'A small group of students reading together at a laptop.'},
 {tab:'Live classrooms',title:'Meet at the right time.',desc:'Attach a meeting link to a scheduled class. The teacher and their enrolled learners can open the session from their own workspace.',tag:'02 / LIVE TEACHING',art:'teacher',alt:'An instructor explaining a concept to a classroom.'},
 {tab:'Assessment & feedback',title:'Show what you know.',desc:'Submit an assignment or take a quiz. Teachers review the work, return marks and add feedback learners can revisit.',tag:'03 / ASSESSMENT',art:'beyond-classroom',alt:'College students testing electronics during a practical assignment.'}
] as const;
export function Learning({asset}:{asset:Asset}){
 const [at,setAt]=useState(0),group=useRef<HTMLDivElement>(null);
 function arrows(e:KeyboardEvent<HTMLButtonElement>,i:number){let j:number;if(['ArrowRight','ArrowDown'].includes(e.key))j=(i+1)%3;else if(['ArrowLeft','ArrowUp'].includes(e.key))j=(i+2)%3;else if(e.key==='Home')j=0;else if(e.key==='End')j=2;else return;e.preventDefault();setAt(j);group.current?.querySelectorAll<HTMLButtonElement>('button')[j]?.focus();}
 return <section id="learning" data-tc-chapter className="tm-learning tm-chapter" aria-labelledby="tm-lms-title"><div className="tc-bound"><div className="tm-section-head"><div><p className="tm-eyebrow"><span>02</span> / Learning management system</p><h2 id="tm-lms-title">From lesson to feedback.</h2></div><p>Explore the three parts of a class. Open a panel to see what teachers and learners can do there.</p></div>
 <div className="tm-accordion" ref={group} role="group" aria-label="LMS features">{chapters.map((v,i)=><article key={v.tab} className={'tm-leaf'+(i===at?' expanded':'')}
   onPointerEnter={e=>{if(e.pointerType==='mouse'&&matchMedia('(hover:hover) and (pointer:fine)').matches&&!(group.current?.contains(document.activeElement)&&document.activeElement?.matches(':focus-visible')))setAt(i);}}>
  <Photo name={v.art} alt={v.alt} asset={asset} className="tm-leaf-photo"/><div className="tm-leaf-shade"/>
  <button type="button" className="tm-leaf-trigger" aria-expanded={at===i} aria-controls={'tm-leaf-'+i} aria-label={v.tab} onClick={()=>setAt(i)} onKeyDown={e=>arrows(e,i)}><span className="tm-leaf-name">{v.tab}</span><span className="tm-leaf-toggle">{at===i?<Minus size={17}/>:<Plus size={17}/>}</span></button>
  <div id={'tm-leaf-'+i} className="tm-leaf-caption" aria-hidden={at!==i}><small>{v.tag}</small><h3>{v.title}</h3><p>{v.desc}</p></div>
 </article>)}</div></div></section>;
}
