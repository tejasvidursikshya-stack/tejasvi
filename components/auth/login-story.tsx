'use client';
import {useState} from 'react';
import {ArrowUpRight, Sparkles, BookOpen, GraduationCap, BriefcaseBusiness} from 'lucide-react';
const scenes=[
 {id:'school',label:'Discover',title:'Big ideas.\nBright beginnings.',note:'Make room for curious minds.',alt:'Illustrative teacher and school students exploring a tablet together',icon:BookOpen},
 {id:'college',label:'Explore',title:'Your next chapter.\nA little more joy.',note:'Good things happen when we learn together.',alt:'Illustrative college students collaborating with a laptop',icon:GraduationCap},
 {id:'corporate',label:'Grow',title:'Fresh skills.\nNew possibilities.',note:'Keep growing. One idea at a time.',alt:'Illustrative colleagues collaborating in a workplace training session',icon:BriefcaseBusiness},
];
export function LoginStory({kind,welcome,name}:{kind?:string;welcome?:string;name?:string}){
 const initial=kind?.toLowerCase().includes('school')?0:kind?.toLowerCase().includes('corporate')?2:1;
 const [selected,setSelected]=useState(initial),[still,setStill]=useState(false);const scene=scenes[selected];
 return <section className={'tj-joy-story '+(still?'is-still':'')} aria-label="Learning inspiration">
  <img key={scene.id} className="tj-joy-photo" src={'/assets/joy/'+scene.id+'.webp'} srcSet={'/assets/joy/'+scene.id+'-small.webp 720w, /assets/joy/'+scene.id+'.webp 1600w'} sizes="(max-width:760px) 100vw, 55vw" alt={scene.alt} width={1600} height={1067} fetchPriority="high"/>
  <div className="tj-joy-shade"/>
  <div className="tj-joy-top"><span><Sparkles size={17}/> A LITTLE MORE POSSIBILITY</span><button type="button" onClick={()=>setStill(!still)} aria-pressed={still}>{still?'Motion off':'Reduce motion'}</button></div>
  <div className="tj-joy-copy" aria-live="polite" aria-atomic="true"><p>{name||'YOUR WORLD OF LEARNING'}</p><h2>{scene.title.split('\n').map(line=><span key={line}>{line}</span>)}</h2><p>{welcome||scene.note}</p></div>
  <span className="tj-joy-sticker" aria-hidden="true"><Sparkles size={20}/> Stay curious.</span>
  <div className="tj-joy-bottom"><div className="tj-joy-caption"><span>Find your next possibility.</span><ArrowUpRight size={23}/></div><div className="tj-joy-scenes" role="group" aria-label="Choose an inspirational scene">{scenes.map((s,i)=><button type="button" key={s.id} aria-pressed={selected===i} onClick={()=>setSelected(i)}><s.icon size={17}/>{s.label}</button>)}</div><small>Illustrative AI-generated imagery · Scene choice does not change your login.</small></div>
 </section>;
}
