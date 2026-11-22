'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,ArrowRight,Maximize2,Pause,Play,X} from 'lucide-react';
import {slides} from './content';
import {Photo,type Asset} from './media';
import {Handwriting} from './handwriting';
import type {Audience} from './operations-data';

const holdMs=6500;
type Props={asset:Asset;onTour:(a:Audience)=>void;onRequest:(a:Audience)=>void};
export function Hero({asset,onTour,onRequest}:Props){
 const [idx,setIdx]=useState(0),[playing,setPlaying]=useState(false),[still,setStill]=useState(false),[visible,setVisible]=useState(true),[onscreen,setOnscreen]=useState(true),[large,setLarge]=useState(false);
 const ref=useRef<HTMLElement>(null),dialog=useRef<HTMLDialogElement>(null),expand=useRef<HTMLButtonElement>(null),gesture=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');const pref=()=>{setPlaying(!mq.matches);setStill(mq.matches);};pref();mq.addEventListener('change',pref);
  const vis=()=>setVisible(!document.hidden);vis();document.addEventListener('visibilitychange',vis);
  let io:IntersectionObserver|undefined;if(ref.current&&'IntersectionObserver'in window){io=new IntersectionObserver(([entry])=>setOnscreen(entry.isIntersecting));io.observe(ref.current);}
  return()=>{mq.removeEventListener('change',pref);document.removeEventListener('visibilitychange',vis);io?.disconnect();};
 },[]);
 const running=playing&&visible&&onscreen&&!large;
 useEffect(()=>{if(!running)return;const t=window.setTimeout(()=>setIdx(i=>(i+1)%slides.length),holdMs);return()=>clearTimeout(t);},[idx,running]);
 const stop=()=>{setPlaying(false);setStill(true);},choose=(i:number)=>{setPlaying(false);setStill(false);setIdx((i+slides.length)%slides.length);};const s=slides[idx];
 function open(){stop();setLarge(true);dialog.current?.showModal();}
 return <section ref={ref} className={'th-hero th-'+s.key+(still?' th-still':'')} style={{'--hold':holdMs+'ms'} as CSSProperties} aria-label="Tejasvi Campus editions" aria-roledescription="carousel"
 onFocusCapture={e=>{if((e.target as HTMLElement).matches(':focus-visible')&&!(e.target as HTMLElement).closest('[data-rotation]'))stop();}}
 onTouchStart={e=>{if(!large&&!(e.target as HTMLElement).closest('button,a'))gesture.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}}
 onTouchEnd={e=>{const g=gesture.current;gesture.current=null;if(!g)return;const dx=e.changedTouches[0].clientX-g.x,dy=e.changedTouches[0].clientY-g.y;if(Math.abs(dx)>50&&Math.abs(dx)>1.6*Math.abs(dy))choose(idx+(dx<0?1:-1));}} onTouchCancel={()=>{gesture.current=null;}}>
  <div className="th-scenes" aria-hidden="true">{slides.map((v,i)=><div key={v.key} className={'th-scene scene-'+v.key+(i===idx?' current':'')}><Photo name={v.image} alt="" asset={asset} priority={i===0}/></div>)}</div><div className="th-scrim" aria-hidden="true"/>
  <div className="tc-bound th-layout"><div className="th-top"><span><i/> TEJASVI CAMPUS</span><button type="button" ref={expand} onClick={open} aria-label="View full photo"><Maximize2 size={15}/><span>Full photo</span></button></div>
  <div className="th-copy"><p className="th-edition">{s.caption}</p><div className="th-words" aria-live={playing?'off':'polite'} aria-atomic="true">{slides.map((v,i)=>{const active=i===idx,Title=active?'h1':'div';return <div key={v.key} className={'th-wordpage'+(active?' current':'')} aria-hidden={!active}><Title className="th-title"><span className="th-sr">{v.title.join(' ')}</span><span className="th-mainline" aria-hidden="true" style={{'--chars':v.title[0].length} as CSSProperties}>{v.title[0]}</span><Handwriting text={v.title[1]}/></Title><p>{v.description}</p></div>;})}</div>
  <div className="th-actions"><a className="th-primary" href="#demo" onClick={()=>onTour(s.key)}><Play size={15} fill="currentColor"/>Try the demo</a><button type="button" className="th-secondary" aria-label="Request a walkthrough" onClick={()=>{stop();onRequest(s.key);}}><span className="th-act-wide">Request a walkthrough</span><span className="th-act-tight">Request demo</span> <ArrowRight size={16}/></button></div></div>
  <div className="th-dock"><div className="th-segments" role="group" aria-label="Choose edition">{slides.map((v,i)=><button type="button" key={v.key} aria-label={'Show '+v.label+' slide'} aria-pressed={i===idx} onClick={()=>choose(i)}><span><small>{v.index}</small>{v.label}</span><i aria-hidden="true">{idx===i&&<b key={String(running)} className={running?'counting':''}/>}</i></button>)}</div><div className="th-control"><button type="button" aria-label="Previous slide" onClick={()=>choose(idx-1)}><ArrowLeft/></button><button type="button" data-rotation aria-label={playing?'Pause slideshow':'Play slideshow'} onClick={()=>{if(playing)stop();else{setStill(false);setPlaying(true);}}}>{playing?<Pause/>:<Play/>}</button><button type="button" aria-label="Next slide" onClick={()=>choose(idx+1)}><ArrowRight/></button></div></div>
  </div>
  <dialog ref={dialog} className="tm-lightbox" aria-label="Full campus photograph" onClose={()=>{setLarge(false);expand.current?.focus();}} onClick={e=>{if(e.target===dialog.current)dialog.current?.close();}}>{large&&<div className="tm-lightbox-body"><Photo name={s.image} alt={s.alt} asset={asset} priority fullResolution/><div><b>{s.caption}</b><button type="button" aria-label="Close full photo" autoFocus onClick={()=>dialog.current?.close()}><X size={18}/> Close</button></div></div>}</dialog>
 </section>;
}
