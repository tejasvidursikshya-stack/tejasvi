'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,Building2,ChartNoAxesColumnIncreasing,ChevronDown,Compass,Files,RotateCw,Wallet} from 'lucide-react';
import {operations,audiences,type Audience} from './operations-data';
import type {Asset} from './media';
const icons=[Files,Compass,Wallet,BookOpen,Building2,ChartNoAxesColumnIncreasing];
const artLabels=['Admission folders','Drafting tools','A fee ledger and calculator','Library volumes','A campus model','An annual report'];
const folio=(n:number)=>String(n+1).padStart(2,'0');
function CardDeck({area,asset}:{area:Audience;asset:Asset}){
 const inv=operations[area],cards=inv.cards,n=cards.length;const [at,setAt]=useState(0),[back,setBack]=useState(true),[arrived,setArrived]=useState(true);
 const stage=useRef<HTMLDivElement>(null),touch=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{if(!stage.current||!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const el=stage.current;if(el.getBoundingClientRect().top>innerHeight*.9)setArrived(false);
  const io=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setArrived(true);io.disconnect();}},{threshold:.14});io.observe(el);return()=>io.disconnect();
 },[]);
 const pick=(i:number)=>{setAt((i+n)%n);setBack(true);};
 return <div className="tm-ops-exhibit" aria-label={inv.system+' feature cards'}>
  <div ref={stage} className={'tm-deck-stage '+(arrived?'arrived':'gathered')} style={{'--deck-n':n} as CSSProperties}
   onTouchStart={e=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchCancel={()=>{touch.current=null;}}
   onTouchEnd={e=>{const t=touch.current;touch.current=null;if(!t)return;const dx=e.changedTouches[0].clientX-t.x,dy=e.changedTouches[0].clientY-t.y;if(Math.abs(dx)>54&&Math.abs(dx)>1.6*Math.abs(dy)){pick(at+(dx<0?1:-1));}}}>
   <span className="tm-stage-word" aria-hidden="true">{inv.stamp}</span>
   {cards.map((c,i)=>{let pos=(i-at+n)%n;if(pos>Math.floor(n/2))pos-=n;const center=pos===0,near=Math.abs(pos)<=1,Icon=icons[c.art];const flipped=center&&back;
    return <div key={c.title} className="tm-card-slot" data-pos={pos<-1?'past':pos>1?'future':String(pos)} aria-hidden={!near}>
     <button className={'tm-field-card pigment-'+c.art} type="button" tabIndex={center?0:-1} disabled={!near} aria-label={center?(back?'Show cover for ':'Show details for ')+c.title:'Explore '+c.title} aria-pressed={center?back:undefined} onClick={()=>{if(center)setBack(!back);else pick(i);}}
      onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=(at+(e.key==='ArrowLeft'?-1:1)+n)%n;pick(next);stage.current?.querySelectorAll<HTMLButtonElement>('.tm-field-card')[next]?.focus({preventScroll:true});}}}>
      <span className={'tm-card-inner'+(flipped?' flipped':'')}>
       <span className="tm-card-face tm-card-cover" aria-hidden={flipped}><img src={asset('field-guide/plate-'+c.art+'.webp')} alt={artLabels[c.art]} width="480" height="480" loading="lazy"/><span className="tm-cover-shade"/><span className="tm-cover-top">{inv.system} <b>/{folio(i)}</b></span><span className="tm-cover-name">{c.title}<ArrowUpRight size={18}/></span></span>
       <span className="tm-card-face tm-card-detail" aria-hidden={!flipped}><span className="tm-card-brow">{inv.system}<i/>{folio(i)}</span><Icon aria-hidden="true"/><strong>{c.title}</strong><span className="tm-card-body">{c.body}</span><span className="tm-card-turn"><RotateCw size={14}/>Turn card</span></span>
      </span>
     </button></div>;
   })}
  </div>
  <div className="tm-deck-dock"><div className="tm-entry-list" aria-live="polite" aria-atomic="true"><span className="tm-smallcap">In this workflow</span><p><span className="tm-sr">{cards[at].title}. {cards[at].body} </span>{cards[at].entries.join(' · ')}</p></div>
   <div className="tm-deck-picker"><button type="button" className="tm-round" aria-label="Previous operations card" onClick={()=>pick(at-1)}><ArrowLeft size={18}/></button><label><span className="tm-sr">Jump to an operations card</span><select value={at} onChange={e=>pick(+e.target.value)}>{cards.map((c,i)=><option key={c.title} value={i}>{folio(i)} / {folio(n-1)} · {c.title}</option>)}</select><span aria-hidden="true">{folio(at)} / {folio(n-1)}<ChevronDown size={14}/></span></label><button type="button" className="tm-round" aria-label="Next operations card" onClick={()=>pick(at+1)}><ArrowRight size={18}/></button></div>
  </div></div>;
}
export function Operations({area,select,asset}:{area:Audience;select:(a:Audience)=>void;asset:Asset}){
 const inv=operations[area];
 return <section id="emis" data-tc-chapter className="tm-ops tm-chapter" aria-labelledby="tm-ops-title"><span id="features" className="tm-alias" aria-hidden="true"/><div className="tc-bound"><div className="tm-section-head"><div><p className="tm-eyebrow"><span>01</span> / {inv.system}</p><h2 id="tm-ops-title">{area==='corporate'?'Inside team training.':area==='school'?'Inside the school office.':'Inside the campus office.'}</h2></div><div className="tm-ops-intro"><p>{inv.description}</p><div className="tm-segmented" role="group" aria-label="Explore an organization">{audiences.map(a=><button type="button" key={a} aria-pressed={a===area} onClick={()=>select(a)}>{operations[a].label}</button>)}</div></div></div><CardDeck area={area} asset={asset} key={area}/></div></section>;
}
