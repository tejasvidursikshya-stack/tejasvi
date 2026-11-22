'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,ChevronDown,Pause,Play,ShieldCheck,WifiOff,BellRing} from 'lucide-react';
import {slides} from './content';
import {Photo,HomeImage,type Asset} from './media';
import type {Audience} from './operations-data';

const holdMs=6500;

/* 1 · Full-bleed hero: editions crossfade, slow zoom, progress bars */
export function LaunchHero({asset,onTour,onRequest}:{asset:Asset;onTour:(a:Audience)=>void;onRequest:(a:Audience)=>void}){
 const [idx,setIdx]=useState(0),[auto,setAuto]=useState(true),[visible,setVisible]=useState(true),[inView,setInView]=useState(true),[focus,setFocus]=useState(false),ref=useRef<HTMLElement>(null);
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');const motion=()=>{if(mq.matches)setAuto(false);};motion();mq.addEventListener('change',motion);
 const vis=()=>setVisible(!document.hidden);vis();document.addEventListener('visibilitychange',vis);
 let io:IntersectionObserver|undefined;if(ref.current&&'IntersectionObserver' in window){io=new IntersectionObserver(([e])=>setInView(e.isIntersecting));io.observe(ref.current);}
 return()=>{document.removeEventListener('visibilitychange',vis);mq.removeEventListener('change',motion);io?.disconnect();};},[]);
 const running=auto&&visible&&inView&&!focus;
 useEffect(()=>{if(!running)return;const t=window.setTimeout(()=>setIdx(i=>(i+1)%slides.length),holdMs);return()=>clearTimeout(t);},[idx,running]);
 const s=slides[idx];
 const context={college:{detail:'Campus operations & higher learning',features:['Programs & semesters','Fees & records','Teaching & learning']},school:{detail:'School administration & classroom learning',features:['Student records','A connected school office','Classroom learning']},corporate:{detail:'Employee learning & development',features:['Training cohorts','Practical assessments','Course certificates']}};
 function choose(i:number){setAuto(false);setIdx(i);}
 return <section ref={ref} className="tl-hero nh-hero" aria-roledescription="carousel" aria-label="Tejasvi Campus editions" style={{'--hold':holdMs+'ms'} as CSSProperties} onFocusCapture={()=>setFocus(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setFocus(false);}}>
 <div className="tl-hero-media" aria-hidden="true">{slides.map((v,i)=><div key={v.key} className={'tl-hero-layer'+(i===idx?' on':'')}><Photo name={v.image} alt="" asset={asset} priority={i===0}/></div>)}</div><div className="nh-hero-shade" aria-hidden="true"/><div className="nh-hero-inner"><div className="nh-hero-copy"><span className="nh-hero-eyebrow"><i/> Learning. Operations. Possibilities.</span><div className="tl-hero-stack" aria-live={running?'off':'polite'}>{slides.map((v,i)=>{const on=i===idx,Title=on?'h1':'p';return <div key={v.key} className={'tl-hero-text'+(on?' on':'')} aria-hidden={!on}><span className="nh-edition-label">{v.caption}</span><Title className="tl-hero-title">{v.title[0]}<br/><em>{v.title[1]}</em></Title><p className="tl-hero-lead">{v.description}</p></div>;})}</div><div className="tl-hero-actions"><a className="tl-cta" href="#demo" onClick={()=>onTour(s.key)}>Explore the demo <ArrowRight size={18}/></a><button type="button" className="tl-ghost" onClick={()=>{setAuto(false);onRequest(s.key);}}>Book a walkthrough <ArrowRight size={16}/></button></div><ul className="nh-hero-features">{context[s.key].features.map(text=><li key={text}><span/> {text}</li>)}</ul></div></div>
 <div className="nh-hero-dock"><div className="nh-dock-label"><span>CHOOSE YOUR WORLD</span><b>Built around you.</b><button type="button" className="nh-play" onClick={()=>setAuto(v=>!v)} aria-label={auto?'Pause hero slideshow':'Play hero slideshow'}>{auto?<Pause size={13}/>:<Play size={13}/>} {auto?'Pause':'Play'}</button></div><div className="nh-editions" role="group" aria-label="Choose an edition">{slides.map((v,i)=><button type="button" key={v.key} aria-pressed={idx===i} onClick={()=>choose(i)}><span className="nh-edition-thumb"><Photo name={v.image} asset={asset} alt=""/></span><span className="nh-edition-info"><small>0{i+1} / {v.key==='corporate'?'LMS':'EMIS + LMS'}</small><b>{v.label}</b><span>{context[v.key].detail}</span></span><ArrowRight size={18} className="nh-edition-arrow"/><span className="nh-edition-progress" aria-hidden="true"><i key={idx+'-'+running} className={i===idx?(running?'running':'selected'):''}/></span></button>)}</div></div>
 </section>;
}

/* 2 + 3 · Statement and figure stage: each figure is shown by a visual that depicts it, four tabs beneath */
const figures=[
 {n:'3',label:'editions',text:'School, college and corporate, each with its own home.'},
 {n:'35',label:'EMIS modules',text:'Admissions to results, fees to grievances.'},
 {n:'1',label:'login for everyone',text:'The account decides the workspace. No role picking.'},
 {n:'3',label:'ways in',text:'The web, plus the Tejasvi app for iPhone and Android.'},
] as const;
const editionTiles=[['School','joy/school.webp'],['College','joy/college.webp'],['Corporate','joy/corporate.webp']] as const;
const emisModules=['Enquiries','Admissions','Student directory','Programs','Departments','Courses & teaching','Timetable','Attendance','Examinations','Results & assessment','Faculty','Non-teaching staff','Staff development','Student fees','Payments','Income & expenditure','Budgets','Scholarships','Library resources','Facilities & ICT','Vehicles & transport','Front-office visits','Governance','Research & innovation','Publications','Community outreach','Industry partnerships','Internships & placement','Graduates & alumni','Student support','Grievances','Feedback','QAA evidence','IQAC action plan','Strategic & annual plans'];
const loginRoutes=[['Registrar','EMIS office'],['Teacher','Classroom'],['Student','My lessons']] as const;
/* Decorative: the caption beside it carries the meaning, so the whole visual is hidden from assistive technology. */
function FigureVisual({i,asset}:{i:number;asset:Asset}){
 if(i===0)return <div className="tl-vis tl-vis-ed">{editionTiles.map(([name,src])=><figure key={name}><HomeImage name={src} asset={asset} alt="" sizes="(max-width: 720px) 90vw, 33vw"/><figcaption>{name}</figcaption></figure>)}</div>;
 if(i===1)return <div className="tl-vis tl-vis-mod">{emisModules.map(m=><span key={m}>{m}</span>)}</div>;
 if(i===2)return <div className="tl-vis tl-vis-login">
  <div className="tl-login-card"><span className="tl-login-brand">Tejasvi</span><span className="tl-login-field">name@campus.edu</span><span className="tl-login-field">••••••••••••</span><span className="tl-login-btn">Sign in</span></div>
  <ArrowRight size={28}/>
  <ul>{loginRoutes.map(([who,where])=><li key={who}><b>{who}</b><span>{where}</span></li>)}</ul>
 </div>;
 return <div className="tl-vis tl-vis-ways">
  <figure><div className="tl-dev-web"><i/><span/><span/><span/></div><figcaption>Web</figcaption></figure>
  <figure><div className="tl-dev-phone"><span/><span/><span/></div><figcaption>iPhone</figcaption></figure>
  <figure><div className="tl-dev-phone droid"><span/><span/><span/></div><figcaption>Android</figcaption></figure>
 </div>;
}
const figMs=5200;
export function Statement({asset}:{asset:Asset}){
 const [idx,setIdx]=useState(0),[auto,setAuto]=useState(true),[paused,setPaused]=useState(true),stage=useRef<HTMLDivElement>(null),tabs=useRef<(HTMLButtonElement|null)[]>([]);
 useEffect(()=>{/* On phones the visuals differ in height, so advancing on its own would shift the page. */
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||matchMedia('(max-width: 720px)').matches)setAuto(false);
  let inView=false;const sync=()=>setPaused(!inView||document.hidden);document.addEventListener('visibilitychange',sync);
  let io:IntersectionObserver|undefined;if(stage.current&&'IntersectionObserver' in window){io=new IntersectionObserver(([e])=>{inView=e.isIntersecting;sync();},{threshold:.35});io.observe(stage.current);}else{inView=true;sync();}
  return()=>{document.removeEventListener('visibilitychange',sync);io?.disconnect();};},[]);
 const running=auto&&!paused,f=figures[idx];
 useEffect(()=>{if(!running)return;const t=window.setTimeout(()=>setIdx(i=>(i+1)%figures.length),figMs);return()=>clearTimeout(t);},[idx,running]);
 function choose(i:number){setAuto(false);setIdx(i);}
 function key(e:React.KeyboardEvent,i:number){const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();const n=(i+d+figures.length)%figures.length;choose(n);tabs.current[n]?.focus();}
 return <><section id="statement" className="tl-statement">
  <span className="tl-kick tl-rv">One campus · one login</span>
  <h2 className="tl-rv2">Records, classrooms and lessons. Finally in the same place.</h2>
  <p className="tl-rv3">The registrar, the teacher and the student open one Tejasvi account and land in the workspace their role allows. Nothing to install, nothing to stitch together.</p>
 </section>
 <section className="tl-figures" aria-label="Tejasvi at a glance"><div className="tl-bound">
  <div ref={stage} className="tl-stage tl-rv" id="tl-fig-panel" role="tabpanel" aria-labelledby={'tl-fig-tab-'+idx}>
   <div className="tl-stage-vis" key={'v'+idx} aria-hidden="true"><FigureVisual i={idx} asset={asset}/></div>
   <span className="tl-stage-count" aria-hidden="true">{String(idx+1).padStart(2,'0')} / {String(figures.length).padStart(2,'0')}</span>
   <div className="tl-stage-copy" key={idx} aria-live={running?'off':'polite'}><strong>{f.n}</strong><b>{f.label}</b><p>{f.text}</p></div>
  </div>
  <div className="tl-stage-tabs" role="tablist" aria-label="Figures" style={{'--hold':figMs+'ms'} as CSSProperties}>{figures.map((x,i)=><button key={x.label} ref={el=>{tabs.current[i]=el;}} id={'tl-fig-tab-'+i} type="button" role="tab" aria-selected={i===idx} aria-controls="tl-fig-panel" tabIndex={i===idx?0:-1} onClick={()=>choose(i)} onKeyDown={e=>key(e,i)}>
   <span className="tl-st-n">{x.n}</span><span className="tl-st-l">{x.label}</span>
   <span className="tl-st-track" aria-hidden="true"><span key={i===idx?'on'+idx+String(running):'off'} className={i===idx?(running?'run':'full'):''}/></span>
  </button>)}</div>
 </div></section></>;
}

/* 4 · Inside Tejasvi: tabbed product showcase */
const products=[
 {id:'emis',label:'EMIS',image:'home-hd/campus-community.webp',alt:'A campus community gathered outside a college building',caption:'EMIS · institution home',title:'The whole office, on one screen.',text:'Admissions, attendance, fees, exams and results, with a home that tells each staff member what needs them today.',points:[['Role homes','Admin, finance, exams and student affairs each see their own priorities.'],['Fees and results','Overdue invoices and draft results surface before they become problems.'],['Accreditation evidence','Missing evidence and overdue actions, tracked in one place.']]},
 {id:'learning',label:'Learning',image:'joy/learning-together.webp',alt:'Students learning together around a laptop',caption:'Learning · course page',title:'Lessons, assignments and feedback.',text:'Courses with a clear learning path, a review queue for teachers and progress everyone can understand.',points:[['Continue where you left off','The next lesson is always one click away.'],['Feedback that lands','Teachers grade oldest-first and comments reach students right away.'],['Live classes','Scheduled sessions sit beside the course they belong to.']]},
 {id:'creator',label:'AI Creator',image:'home-hd/creator-assessment.webp',alt:'A Nepali educator reviewing an assessment on a tablet',caption:'AI Creator Studio · assessment preparation',title:'A first draft in minutes.',text:'Describe the class and Tejasvi drafts the lesson plan, quiz, assignment or course outline for the teacher to review.',points:[['Lesson plans','Timed steps from a one-line prompt.'],['Quizzes and rubrics','Questions with the reason each answer is right.'],['Always reviewed','Nothing is published until a teacher approves it.']]},
 {id:'mobile',label:'Mobile',image:'joy/school.webp',alt:'School students using a tablet with their teacher',caption:'Tejasvi app · iPhone and Android',title:'The campus in your pocket.',text:'The Tejasvi app brings learning, EMIS records and announcements to every phone, even without a signal.',points:[['Offline lessons','Saved courses stay encrypted on the device.'],['Reminders','A nudge the day before something is due.'],['Read-only EMIS','Records and balances, safely in view.']]},
] as const;
export function Inside({asset}:{asset:Asset}){
 const [tab,setTab]=useState(0),p=products[tab],tabs=useRef<(HTMLButtonElement|null)[]>([]);
 function key(e:React.KeyboardEvent,i:number){const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();const n=(i+d+products.length)%products.length;setTab(n);tabs.current[n]?.focus();}
 return <section id="inside" data-tc-chapter className="tl-inside" aria-labelledby="inside-h"><div className="tl-bound">
  <div className="tl-inside-head tl-rv"><div><span className="tl-kick">Inside Tejasvi</span><h2 id="inside-h">Four products.<br/>One calm system.</h2></div>
   <div className="tl-tabs" role="tablist" aria-label="Products">{products.map((x,i)=><button key={x.id} ref={el=>{tabs.current[i]=el;}} id={'tl-tab-'+x.id} type="button" role="tab" aria-selected={i===tab} aria-controls="tl-panel" tabIndex={i===tab?0:-1} onClick={()=>setTab(i)} onKeyDown={e=>key(e,i)}>{x.label}</button>)}</div></div>
  <div className="tl-inside-body" id="tl-panel" role="tabpanel" aria-labelledby={'tl-tab-'+p.id}>
   <div className="tl-inside-media tl-zoom">{products.map((x,i)=><HomeImage key={x.id} name={x.image} asset={asset} sizes="(max-width: 960px) 100vw, 60vw" alt={i===tab?x.alt:''} aria-hidden={i!==tab} className={i===tab?'on':undefined} loading="lazy" decoding="async"/>)}<span>{p.caption}</span></div>
   <div className="tl-inside-copy" key={p.id}><h3>{p.title}</h3><p>{p.text}</p><ol>{p.points.map(([h,t],i)=><li key={h}><span>{String(i+1).padStart(2,'0')}</span><div><b>{h}</b><span>{t}</span></div></li>)}</ol><a className="tl-more" href={'#'+p.id}>Explore {p.label} <ArrowRight size={17} aria-hidden="true"/></a></div>
  </div>
 </div></section>;
}

/* 5 · Every role, a better morning */
const stories=[
 {role:'Administrators',image:'home-hd/campus-community.webp',alt:'A campus community gathered outside a college building',title:'Know what needs you before 9 am.',text:'Fees, admissions and results waiting for action, in one list.',href:'#inside'},
 {role:'Teachers',image:'joy/teacher.webp',alt:'A teacher guiding a student at a desk',title:'Grade, give feedback, take attendance.',text:'A review queue, oldest first, and the students who need a check-in.',href:'#inside'},
 {role:'Students',image:'joy/learning-together.webp',alt:'Students learning together around a laptop',title:'Pick up exactly where you stopped.',text:'Next lesson, what’s due and the latest feedback, also offline on the app.',href:'#inside'},
 {role:'Teams',image:'joy/corporate.webp',alt:'Colleagues in a training session around a table',title:'Training people actually finish.',text:'Courses, progress and certificates for every employee.',href:'#demo'},
];
export function Stories({asset}:{asset:Asset}){
 return <section id="stories" data-tc-chapter className="tl-stories" aria-labelledby="stories-h"><div className="tl-bound">
  <div className="tl-section-head"><div className="tl-rv"><span className="tl-kick warm">Made for every day</span><h2 id="stories-h">Every role,<br/>a better morning.</h2></div><p className="tl-rv2">Each person opens Tejasvi to a home built around what they need to do today.</p></div>
  <div className="tl-story-grid">{stories.map((s,i)=><a key={s.role} href={s.href} className={'tl-story tl-rv'+(i?String(i+1):'')}><HomeImage name={s.image} asset={asset} sizes="(max-width: 720px) 100vw, 50vw" alt={s.alt} loading="lazy" decoding="async"/><span className="tl-story-shade" aria-hidden="true"/><span className="tl-story-copy"><span className="tl-kick">{s.role}</span><b>{s.title}</b><span>{s.text}</span></span></a>)}</div>
 </div></section>;
}

/* 6 · Trust */
export function Trust(){
 const cards=[[ShieldCheck,'Role-based access','Every person sees only what their role allows, on the web and in the app.',''],[WifiOff,'Lessons offline','Save courses to the phone, encrypted, and keep learning without a connection.',''],[BellRing,'Timely reminders','Deadlines and announcements reach the app the day before and two hours before.','warm']] as const;
 return <section id="trust" data-tc-chapter className="tl-trust" aria-labelledby="trust-h"><div className="tl-bound tl-trust-grid">
  <div className="tl-rv"><span className="tl-kick warm">Built to be trusted</span><h2 id="trust-h">Private by design. Ready when the network isn’t.</h2></div>
  <div className="tl-trust-cards">{cards.map(([Icon,h,t,tone],i)=><div key={h} className={'tl-trust-card tl-rv'+(i?String(i+1):'')}><span className={'tl-trust-ic '+tone}><Icon size={26} aria-hidden="true"/></span><b>{h}</b><span>{t}</span></div>)}</div>
 </div></section>;
}

/* 7 · Closing call to action */
export function Closing({asset,onRequest,area}:{asset:Asset;onRequest:(a:Audience)=>void;area:Audience}){
 return <section className="tl-closing" aria-labelledby="closing-h">
  <HomeImage className="tl-par" name="joy/beyond-classroom.webp" asset={asset} alt="" loading="lazy" decoding="async"/>
  <div className="tl-closing-shade" aria-hidden="true"/>
  <div className="tl-bound"><div className="tl-closing-copy tl-rv">
   <span className="tl-kick">See it on your campus</span>
   <h2 id="closing-h">Start the year on Tejasvi.</h2>
   <p>Try a school, college or corporate demo in your browser, or book a guided walkthrough with our team.</p>
   <div className="tl-hero-actions"><a className="tl-cta" href="#demo">Try the demo <ArrowRight size={18} aria-hidden="true"/></a><button type="button" className="tl-ghost" onClick={()=>onRequest(area)}>Request a walkthrough</button></div>
  </div></div>
 </section>;
}
