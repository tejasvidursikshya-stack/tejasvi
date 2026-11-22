'use client';
import {useEffect,useId,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,ArrowUpRight,ChevronDown} from 'lucide-react';
import type {Output,StudioTool} from '../../lib/atelier';
import type {Asset} from './media';
import {publicBriefs} from './workshop-samples';

type Format='slides'|'modules'|'video'|'quiz'|'worksheet'|'flashcards';
type Tile={key:Format;title:string;tool:StudioTool;notes:readonly [string,string,string]};
const tiles:readonly Tile[]=[
 {key:'slides',title:'Presentation slides',tool:'create',notes:['Walk through a first Java program, one idea at a time.','Show how sand, salt and water can be separated.','Demonstrate what belongs in a useful handoff.']},
 {key:'modules',title:'Course modules',tool:'build',notes:['Sequence the first coding lesson.','Build the experiment in stages.','Teach the handoff step by step.']},
 {key:'video',title:'Lesson video',tool:'create',notes:['Follow a greeting from code to console.','Watch the mixture change in each scene.','Follow a support case between shifts.']},
 {key:'quiz',title:'Practice quiz',tool:'create',notes:['Predict the output.','Test the method.','Check the next action.']},
 {key:'worksheet',title:'Worksheet',tool:'create',notes:['Trace and debug a line.','Label the filter setup.','Rewrite a vague note.']},
 {key:'flashcards',title:'Flashcards',tool:'assist',notes:['Recall the key terms.','Review each technique.','Recall the handoff essentials.']}
];

export function TeachingGallery({asset,site,offline,sample,onSample,show,tool,format}:{asset:Asset;site:string;offline:boolean;sample:number;onSample:(s:number)=>void;show:(t:StudioTool,f:Output,trigger?:HTMLElement)=>void;tool:StudioTool;format:Output}){
 const id=useId(),grid=useRef<HTMLDivElement>(null),[entered,reveal]=useState(false);
 const topic=Math.max(0,Math.min(sample,publicBriefs.length-1)),brief=publicBriefs[topic];
 useEffect(()=>{const el=grid.current;if(!el||!('IntersectionObserver'in window))return;
  const io=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){reveal(true);io.disconnect();}},{threshold:.06});io.observe(el);return()=>io.disconnect();},[]);
 return <section id="ai-workflow" className="tg-formats" aria-labelledby={id+'-title'}>
 <div className="tc-bound tg-wrap">
 <header className="tg-head"><div className="tg-intro"><p className="tg-eyebrow"><i aria-hidden="true"/>AI teaching materials</p>
 <h2 id={id+'-title'}>One lesson.<br/><em>Six ways to teach it.</em></h2><p className="tg-description">Choose a sample lesson, then open a format to explore it.</p></div>
 <div className="tg-picker"><label htmlFor={id+'-brief'}>Sample lesson</label><div className="tg-select-wrap"><select id={id+'-brief'} aria-describedby={id+'-audience'} value={topic} onChange={e=>onSample(Number(e.target.value))}>{publicBriefs.map((b,i)=><option key={b.topic} value={i}>{b.topic}</option>)}</select><ChevronDown size={16} aria-hidden="true"/></div><span id={id+'-audience'}>{brief.audience}</span></div></header>
 <div className="tg-grid" ref={grid} data-entered={entered?'yes':undefined} role="group" aria-label="Teaching formats">
 {tiles.map((tile,i)=><button key={tile.key} type="button" className={'tg-tile tg-'+tile.key} style={{'--tg-i':i} as CSSProperties}
  data-format={tile.key} aria-haspopup="dialog" aria-label={'Open '+tile.title.toLowerCase()+' example: '+brief.topic} onClick={e=>show(tile.tool,tile.key,e.currentTarget)}>
  <picture><source media="(max-width: 680px)" srcSet={asset('teaching-gallery/'+tile.key+'-small.webp')}/><img src={asset('teaching-gallery/'+tile.key+'.webp')} alt={tile.key==='video'?'An instructor teaches four students in a live online class.':''} width={i===0?880:840} height={i===0?1100:560} loading="lazy" decoding="async"/></picture>
  <span aria-hidden="true" className="tg-shade"/>
  <span className="tg-caption"><span className="tg-title">{tile.title}</span><span className="tg-note" key={topic}>{tile.notes[topic]||'Open the worked example.'}</span></span><span aria-hidden="true" className="tg-arrow"><ArrowUpRight size={18}/></span>
 </button>)}</div>
 <div className="tg-foot"><p>{offline?'Explore the examples offline. Sign in to create your own.':'These are worked examples. Sign in to create materials for your learners.'}</p><a href={site+'/workspaces?studio='+tool+'&output='+format}>Open Creator Studio <ArrowRight size={17} aria-hidden="true"/></a></div>
 </div></section>;
}
