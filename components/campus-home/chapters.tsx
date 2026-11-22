'use client';
import {useEffect,useRef,useState} from 'react';
import {UserPlus,CalendarClock,Wallet,LifeBuoy,Bus,FileChartColumn,Plus,Minus,Sparkles,CalendarDays,Bell,Clock3,Check,Signal,Wifi,BatteryFull,type LucideIcon} from 'lucide-react';
import {operations,audiences,type Audience} from './operations-data';
import {examples,draftKinds} from './content';
import {Photo,HomeImage,type Asset} from './media';

const artIcons:LucideIcon[]=[UserPlus,CalendarClock,Wallet,LifeBuoy,Bus,FileChartColumn];
const tones=['blue','teal','orange','purple','sky','rose'];

/* EMIS & operations: pinned "wheel" of cards, after the Chery Q "enjoy every journey" block */
const photos=['home-hd/campus-community.webp','joy/teacher.webp','joy/learning-together.webp','joy/school.webp','joy/next-chapter.webp','joy/corporate.webp'];
const photoAlt=['A campus community gathered outside a college building','A teacher guiding a student at a desk','Students learning together around a laptop','School students working on a tablet with their teacher','College students walking across a sunlit campus','Colleagues in a training session around a table'];
export function EmisChapter({area,select,asset}:{area:Audience;select:(a:Audience)=>void;asset:Asset}){
 const inv=operations[area],sec=useRef<HTMLElement>(null),stage=useRef<HTMLDivElement>(null),[active,setActive]=useState(0);
 const cards=inv.cards.flatMap((c,i)=>[{kind:'photo' as const,i,src:photos[(i+(area==='school'?3:area==='corporate'?5:0))%photos.length],alt:photoAlt[(i+(area==='school'?3:area==='corporate'?5:0))%photos.length]},{kind:'text' as const,i,card:c}]);
 const n=cards.length;
 useEffect(()=>{let raf=0;const tick=()=>{raf=0;const el=sec.current,st=stage.current;if(!el||!st)return;const r=el.getBoundingClientRect(),span=Math.max(1,r.height-innerHeight),p=Math.min(1,Math.max(0,-r.top/span));st.style.setProperty('--p',p.toFixed(4));const centre=(p*((n-1)*15+84)-42)/15,at=Math.min(inv.cards.length-1,Math.max(0,Math.round((centre-1)/2)));setActive(v=>v===at?v:at);};
  const on=()=>{if(!raf)raf=requestAnimationFrame(tick);};tick();addEventListener('scroll',on,{passive:true});addEventListener('resize',on);return()=>{removeEventListener('scroll',on);removeEventListener('resize',on);cancelAnimationFrame(raf);};},[n,inv.cards.length]);
 return <section id="emis" ref={sec} data-tc-chapter className="tl-spin" aria-labelledby="emis-h" style={{'--n':n} as React.CSSProperties}>
  <div className="tl-spin-stage" ref={stage}>
   <span className="tl-spin-glow" aria-hidden="true"/>
   <span className="tl-sphere s1" aria-hidden="true"/><span className="tl-sphere s2" aria-hidden="true"/><span className="tl-sphere s3" aria-hidden="true"/><span className="tl-sphere s4" aria-hidden="true"/>
   <h2 id="emis-h" className="tl-spin-title"><span>From the admissions desk</span><span>to the annual report.</span></h2>
   <div className="tl-spin-top">
    <div><span className="tl-kick warm">01 · EMIS &amp; operations</span><p>{inv.description}</p></div>
    <div className="tl-pills" role="group" aria-label="Choose an edition">{audiences.map(a=><button type="button" key={a} aria-pressed={a===area} onClick={()=>select(a)}>{operations[a].label}</button>)}</div>
   </div>
   <div className="tl-wheel" key={area} aria-label={inv.system+' areas'} role="list">
    {cards.map((c,k)=><div key={k} role="listitem" className="tl-wheel-slot" style={{'--k':k} as React.CSSProperties}>{c.kind==='photo'
     ?<div className="tl-wcard photo"><HomeImage name={c.src} asset={asset} sizes="(max-width: 720px) 70vw, 400px" alt={c.alt} loading="lazy" decoding="async"/></div>
     :(()=>{const Icon=artIcons[c.card.art]||FileChartColumn;return <article className={'tl-wcard text tone-'+tones[c.card.art%tones.length]}>
      <span className="tl-wcard-n">{String(c.i+1).padStart(2,'0')}</span>
      <h3>{c.card.title}</h3>
      <span className="tl-wcard-ic" aria-hidden="true"><Icon size={40} strokeWidth={1.6}/></span>
      <p>{c.card.body}</p>
      <ul>{c.card.entries.map(e=><li key={e}>{e}</li>)}</ul>
     </article>;})()}</div>)}
   </div>
   <div className="tl-spin-foot" aria-live="polite"><span>{inv.system}</span><span className="tl-spin-bar" aria-hidden="true"><i/></span><b>{String(active+1).padStart(2,'0')} / {String(inv.cards.length).padStart(2,'0')} · {inv.cards[active]?.title}</b></div>
  </div>
 </section>;
}

/* Learning: expanding photo panels */
const lessons=[
 {tab:'Lesson library',title:'A place for every resource.',desc:'Put slides, readings, video and worksheets beside the unit they belong to. Learners open the right material without searching through messages.',art:'college',alt:'A small group of students reading together at a laptop'},
 {tab:'Live classrooms',title:'Meet at the right time.',desc:'Attach a meeting link to a scheduled class. The teacher and their enrolled learners open the session from their own workspace.',art:'teacher',alt:'An instructor explaining a concept to a classroom'},
 {tab:'Assessment & feedback',title:'Show what you know.',desc:'Submit an assignment or take a quiz. Teachers review the work, return marks and add feedback learners can revisit.',art:'beyond-classroom',alt:'College students testing electronics during a practical assignment'},
] as const;
export function LearningChapter({asset}:{asset:Asset}){
 const [at,setAt]=useState(0);
 return <section id="learning" data-tc-chapter className="tl-learn" aria-labelledby="learn-h"><div className="tl-bound">
  <div className="tl-section-head"><div className="tl-rv"><span className="tl-kick">02 · Learning</span><h2 id="learn-h">From lesson<br/>to feedback.</h2></div><p className="tl-rv2">Three parts of every class, in one place for teachers and learners. Open a panel to see what happens there.</p></div>
  <div className="tl-panels tl-zoom">{lessons.map((v,i)=><article key={v.tab} className={'tl-panel'+(i===at?' open':'')} onMouseEnter={()=>{if(matchMedia('(hover:hover)').matches)setAt(i);}}>
   <Photo name={v.art} alt={v.alt} asset={asset}/><span className="tl-panel-shade" aria-hidden="true"/>
   <button type="button" className="tl-panel-head" aria-expanded={i===at} aria-controls={'tl-panel-'+i} onClick={()=>setAt(i)}><span className="tl-panel-n">{String(i+1).padStart(2,'0')}</span><span className="tl-panel-tab">{v.tab}</span>{i===at?<Minus size={18}/>:<Plus size={18}/>}</button>
   <div className="tl-panel-copy" id={'tl-panel-'+i} aria-hidden={i!==at}><h3>{v.title}</h3><p>{v.desc}</p></div>
  </article>)}</div>
 </div></section>;
}

/* AI Creator Studio: prompt → draft */
export function CreatorChapter(){
 const [ex,setEx]=useState(0),[kind,setKind]=useState(0),e=examples[ex];
 return <section id="creator-preview" className="tl-creator" aria-labelledby="creator-h"><div className="tl-bound tl-creator-grid">
  <div className="tl-creator-copy tl-rv">
   <span className="tl-kick warm">AI Creator Studio</span>
   <h2 id="creator-h">Describe the class.<br/>Get a first draft.</h2>
   <p>Tejasvi drafts a lesson plan, quiz, assignment or course outline from a single prompt. Teachers review and edit before anything reaches learners.</p>
   <div className="tl-pills light" role="group" aria-label="Choose an example">{examples.map((x,i)=><button type="button" key={x.label} aria-pressed={i===ex} onClick={()=>setEx(i)}>{x.label}</button>)}</div>
   <div className="tl-prompt" key={'p'+ex}><span><Sparkles size={18} aria-hidden="true"/> {e.audience} · {e.subject}</span><p>{e.prompt}<i aria-hidden="true"/></p></div>
  </div>
  <div className="tl-draft tl-rv2">
   <div className="tl-draft-tabs" role="tablist" aria-label="Draft type">{draftKinds.map((k,i)=><button type="button" role="tab" key={k} aria-selected={i===kind} onClick={()=>setKind(i)}>{k}</button>)}</div>
   <div className="tl-draft-body" key={ex+'-'+kind} role="tabpanel">
    <span className="tl-draft-badge">Draft · ready for review</span>
    {kind===0&&<><h3>{e.goal}</h3><ol className="tl-steps">{e.lesson.map(([t,s],i)=><li key={s} style={{animationDelay:i*90+'ms'}}><b>{t}</b><span>{s}</span></li>)}</ol></>}
    {kind===1&&<><h3>{e.question}</h3><ul className="tl-options">{e.options.map((o,i)=><li key={o} className={i===e.correct?'right':undefined} style={{animationDelay:i*90+'ms'}}><span>{String.fromCharCode(65+i)}</span><code>{o}</code>{i===e.correct&&<Check size={18} aria-label="Correct answer"/>}</li>)}</ul><p className="tl-why">{e.why}</p></>}
    {kind===2&&<><h3>Assignment</h3><p className="tl-assign">{e.assignment}</p><strong className="tl-rubric-h">Rubric</strong><ul className="tl-rubric">{e.rubric.map((r,i)=><li key={r} style={{animationDelay:i*90+'ms'}}><Check size={16} aria-hidden="true"/>{r}</li>)}</ul></>}
    {kind===3&&<><h3>{e.subject}</h3><ol className="tl-steps">{e.outline.map((o,i)=><li key={o} style={{animationDelay:i*90+'ms'}}><b>Unit {i+1}</b><span>{o}</span></li>)}</ol></>}
   </div>
  </div>
 </div></section>;
}

/* Mobile: floating phone */
const views=[
 {name:'Calendar',icon:CalendarDays,title:'My calendar',date:'Wednesday · 16 September',rows:[['09:00','Science lab','Scheduled class'],['11:30','Project consultation','Calendar event'],['15:00','Lab reflection due','Assignment deadline']]},
 {name:'Notices',icon:Bell,title:'My notices',date:'From your institution',rows:[['01','Library hours','Campus announcement'],['02','Room change','Class update'],['03','Project showcase','Institution notice']]},
] as const;
export function MobileChapter2(){
 const [at,setAt]=useState(0),v=views[at];
 return <section id="mobile" data-tc-chapter className="tl-mobile" aria-labelledby="mobile-h"><div className="tl-bound tl-mobile-grid">
  <div className="tl-mobile-copy tl-rv">
   <span className="tl-kick">04 · On your phone</span>
   <h2 id="mobile-h">What’s on today?</h2>
   <p>Check the calendar before class or catch an announcement on the way in. The Tejasvi app for iPhone and Android keeps lessons available offline and reminds you before work is due.</p>
   <div className="tl-pills" role="group" aria-label="Phone preview">{views.map((x,i)=><button type="button" key={x.name} aria-pressed={i===at} onClick={()=>setAt(i)}><x.icon size={16} aria-hidden="true"/> {x.name}</button>)}</div>
  </div>
  <div className="tl-phone-scene tl-zoom">
   <span className="tl-phone-glow" aria-hidden="true"/>
   <div className="tl-phone" role="img" aria-label={'Illustrative Tejasvi app '+v.name.toLowerCase()+' screen'}>
    <div className="tl-phone-status" aria-hidden="true"><b>09:41</b><span><Signal size={12}/><Wifi size={12}/><BatteryFull size={16}/></span></div>
    <div className="tl-phone-screen" aria-hidden="true">
     <div className="tl-phone-hero"><span className="tl-mark sm">T<i>.</i></span><small>Tejasvi</small><b>{v.title}</b><span>{v.date}</span></div>
     <div className="tl-phone-rows" key={at}>{v.rows.map(([t,h,s],i)=><div key={h} style={{animationDelay:i*110+'ms'}}><small>{t}</small><span><b>{h}</b><em>{s}</em></span>{at===0?<Clock3 size={14}/>:<Check size={14}/>}</div>)}</div>
    </div>
   </div>
  </div>
 </div></section>;
}
