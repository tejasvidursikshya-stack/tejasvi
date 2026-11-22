'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,ArrowUpRight,Check,Pause,Play,Sparkles,X} from 'lucide-react';
import {toolsList,toolsInfo,defaultOutput,outputNames,type StudioTool,type Output} from '../../lib/atelier';
import {OutputSelect} from '../workshop/catalogue';
import {TeachingGallery} from './teaching-gallery';
import {Reader} from '../workshop/reader';
import {publicBriefs} from './workshop-samples';
import type {Asset} from './media';
const objet={create:'An open art book unfolds into a brass and lapis solar system.',build:'A miniature staircase of paper chapters rises from an open atlas.',assist:'A midnight-blue broadcast microphone surrounded by floating note cards.',plan:'A glass hourglass, brass pencil and folded paper timeline.'};
export function Studio({asset,site='',offline=false}:{asset:Asset;site?:string;offline?:boolean}){
 const [tool,choose]=useState<StudioTool>('create'),[sample,setSample]=useState(0),[format,setFormat]=useState<Output>('slides'),[cycle,setCycle]=useState(false),[seen,setSeen]=useState(false),[visible,setVisible]=useState(true),[open,setOpen]=useState(false),[edits,setEdits]=useState<Record<number,string>>({}),[edit,setEdit]=useState(false);
 const stage=useRef<HTMLDivElement>(null),modal=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null),closer=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const d=modal.current;if(open&&d){if(!d.open)d.showModal();d.scrollTop=0;closer.current?.focus({preventScroll:true});}},[open]);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),motion=()=>setCycle(!m.matches);motion();m.addEventListener('change',motion);
 const visibility=()=>setVisible(!document.hidden);visibility();document.addEventListener('visibilitychange',visibility);let watch:IntersectionObserver|undefined;if(stage.current&&'IntersectionObserver'in window){watch=new IntersectionObserver(([e])=>setSeen(e.isIntersecting),{threshold:.28});watch.observe(stage.current);}else setSeen(true);
 return()=>{watch?.disconnect();m.removeEventListener('change',motion);document.removeEventListener('visibilitychange',visibility);};},[]);
 useEffect(()=>{if(!cycle||!seen||!visible||open)return;const id=setTimeout(()=>{const n=toolsList[(toolsList.indexOf(tool)+1)%4];choose(n);setFormat(defaultOutput[n]);},8500);return()=>clearTimeout(id);},[tool,cycle,seen,visible,open]);
 const info=toolsInfo[tool],brief=publicBriefs[sample],doc=brief.payload,title=edits[sample]||doc.title,idx=toolsList.indexOf(tool);
 function select(t:StudioTool){setCycle(false);choose(t);setFormat(defaultOutput[t]);}
 function show(t:StudioTool,f:Output,trigger?:HTMLElement){choose(t);setCycle(false);setFormat(f);setEdit(false);opener.current=trigger||(document.activeElement as HTMLElement);setOpen(true);}
 function close(){modal.current?.close();setOpen(false);opener.current?.focus({preventScroll:true});}
 const switchSample=(v:number)=>{setSample(v);setEdit(false);setCycle(false);};
 const pickBrief=<label className="wk-topic">Teaching brief<select aria-label="Teaching brief" value={sample} onChange={e=>switchSample(+e.target.value)}>{publicBriefs.map((b,i)=><option key={b.topic} value={i}>{b.topic}</option>)}</select><small>{brief.audience}</small></label>;
 return <section id="creator" data-tc-chapter className="ax-creator" aria-label="AI Creator Studio">
 <div className={'ax-show ax-show-'+tool} ref={stage} style={{'--tone':info.color} as CSSProperties} onFocusCapture={e=>{if((e.target as HTMLElement).matches(':focus-visible')&&!(e.target as HTMLElement).closest('[data-tour-play]'))setCycle(false);}}>
 <div className="ax-horizon" aria-hidden="true"><img src={asset('workshop/horizon.webp')} alt="" loading="lazy"/></div><div className="ax-atmos" aria-hidden="true"/><div className="tc-bound ax-show-inner">
 <div className="ax-show-head"><span><i/> TEJASVI / CREATOR STUDIO</span><span>THE TOOL COLLECTION</span></div>
 <div className="ax-show-pair"><div className="ax-show-card"><p className="ax-show-ed">{info.subtitle}</p><div key={tool} className="ax-show-copy"><h2>{info.words[0]}<br/><em>{info.words[1]}</em></h2><p>{info.copy}</p></div><button type="button" className="ax-sample-link" onClick={e=>show(tool,defaultOutput[tool],e.currentTarget)}>Open a sample <ArrowUpRight size={16}/></button>
 <div className="ax-swatches" role="group" aria-label="Creator collection">{toolsList.map(k=><button type="button" key={k} aria-pressed={tool===k} onClick={()=>select(k)} title={toolsInfo[k].name}><i style={{background:toolsInfo[k].color}}>{tool===k&&<Check size={13}/>}</i><span>{toolsInfo[k].short}</span></button>)}</div></div>
 <figure className="ax-object"><div className="ax-floor" aria-hidden="true"/><div key={tool} className="ax-landing"><img src={asset('workshop/'+tool+'.webp')} alt={objet[tool]} width="970" height="700" loading="lazy"/></div></figure></div>
 <div className="ax-show-foot"><span>PLATE 0{idx+1} <i/> {info.name}</span><button type="button" data-tour-play aria-label={cycle?'Pause collection':'Play collection'} onClick={()=>setCycle(v=>!v)}>{cycle?<Pause size={14}/>:<Play size={14}/>} {cycle?'Pause':'Play'} collection</button></div></div></div>
 <TeachingGallery asset={asset} site={site} offline={offline} sample={sample} onSample={switchSample} show={show} tool={tool} format={format}/>
 <dialog className="ax-sample-modal" aria-label="Studio sample" ref={modal} onCancel={e=>{e.preventDefault();close();}} onClose={e=>{if(e.currentTarget.open)return;setOpen(false);opener.current?.focus({preventScroll:true});}} onClick={e=>{if(e.target===modal.current)close();}}>{open&&<div className="ax-modal-sheet"><div className="ax-modal-top"><span><Sparkles size={16}/> {info.name} / SAMPLE</span><button type="button" ref={closer} onClick={close} aria-label="Close Studio sample"><X size={18}/></button></div><div className="ax-modal-filters">{pickBrief}<OutputSelect format={format} onChange={setFormat}/></div><p className="ax-overline">{outputNames[format]}</p><h2>{title}</h2>
 <Reader key={sample+'-'+format} format={format} title={title} kit={doc.kit} modules={doc.modules} templateURL={asset('workshop/slide-template.pptx')}/><footer><button type="button" onClick={()=>setEdit(!edit)}>{edit?'Finish editing':'Edit sample title'}</button>{edits[sample]&&<button type="button" onClick={()=>{setEdits(v=>{const r={...v};delete r[sample];return r;});setEdit(false);}}>Reset sample</button>}<a href={site+'/workspaces?studio='+tool+'&output='+format}>Use this tool in my LMS <ArrowRight size={13}/></a><small>Example only · changes stay on this page.</small></footer>{edit&&<label className="wk-topic">Sample title<input value={edits[sample]??doc.title} maxLength={160} onChange={e=>setEdits({...edits,[sample]:e.target.value})}/></label>}</div>}</dialog></section>;
}
