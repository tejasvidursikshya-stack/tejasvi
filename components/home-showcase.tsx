'use client';
import {useState} from 'react';
import {ArrowUpRight,BookOpen,CalendarDays,Check,ClipboardCheck,Play,Pause,Sparkles,Wifi,BatteryFull} from 'lucide-react';
import '@/app/home-showcase.css';
import {MotionSection} from './home-motion';
import {LearningAtmosphere} from './home-learning-gallery';

const views=[
 {id:'learning',name:'My learning',icon:BookOpen,title:'Browse your subjects on a smaller screen.',text:'The learner layout adapts its navigation and resource cards to the available space.'},
 {id:'assignments',name:'Assignments',icon:ClipboardCheck,title:'Read the task before you upload.',text:'Assignment instructions, due dates and feedback stay readable in the mobile layout.'},
 {id:'timetable',name:'My timetable',icon:CalendarDays,title:'Check your day at a glance.',text:'A compact agenda presents the time, subject and class location in order.'},
] as const;
type View=typeof views[number]['id'];
function Screen({view,phone=false}:{view:View;phone?:boolean}){
 return <div className={'hs-screen '+(phone?'hs-screen-phone':'')}>
  <div className="hs-screen-top"><span><i/> Tejasvi</span><span className="hs-avatar">A</span></div>
  <div className="hs-screen-layout">{!phone&&<aside className="hs-screen-sidebar"><small>YOUR SPACE</small>{views.map(v=><span key={v.id} className={view===v.id?'active':''}><v.icon size={15}/>{v.name}</span>)}<div className="hs-sidebar-bottom"><Sparkles size={20}/><span>Stay curious.<br/>Keep growing.</span></div></aside>}
  <div className="hs-screen-body"><p className="hs-mini-eyebrow">BCA · SEMESTER 2</p><h3>{view==='learning'?'A good day to learn.':view==='assignments'?'One step at a time.':'Make space for learning.'}</h3><p className="hs-screen-subtitle">{view==='learning'?'Welcome back, Aarav.':view==='assignments'?'Your work, deadlines and feedback.':'Your upcoming classes and tasks.'}</p>
   {view==='learning'?<><div className="hs-course-banner"><span><small>CONTINUE LEARNING</small><strong>Java Programming</strong><span>Unit 01 · Classes and objects</span></span><span className="hs-code" aria-hidden="true">{'{ }'}</span></div><div className="hs-lesson-row"><span className="hs-play"><Play size={14}/></span><div><small>YOUR NEXT LESSON</small><strong>Think in objects.</strong></div><ArrowUpRight size={17}/></div><div className="hs-resource-grid"><span><BookOpen size={17}/>Lecture slides<small>Read & explore</small></span><span><ClipboardCheck size={17}/>Practice worksheet<small>Put ideas to work</small></span></div></>:view==='assignments'?<><div className="hs-assignment"><span className="hs-status">TO DO</span><h4>Build a student profile</h4><p>Create a Java class with fields and a constructor.</p><div><span>Java · Unit 01</span><span>Friday · 4 PM</span></div></div><div className="hs-feedback"><Check size={19}/><div><strong>Worksheet reviewed</strong><p>“Good start. Try explaining your approach.”</p><small>Sample teacher feedback</small></div></div></>:<div className="hs-agenda">{[['09:00','Java Programming','Classes and objects','Classroom 02'],['11:00','Mathematics','Practice & discussion','Classroom 04'],['16:00','Assignment deadline','Student profile project','Submit in your workspace']].map(([time,title,desc,place],i)=><div key={time}><time>{time}</time><span className={'hs-agenda-item hs-agenda-'+i}><strong>{title}</strong><span>{desc}</span><small>{place}</small></span></div>)}</div>}
   <p className="hs-screen-sample">Illustrative preview · Sample content</p>
  </div></div>{phone&&<div className="hs-phone-nav" aria-hidden="true">{views.map(v=><span key={v.id} className={view===v.id?'active':''}><v.icon size={16}/>{v.name.replace('My ','')}</span>)}</div>}
 </div>
}
export function DeviceShowcase(){
 const [view,setView]=useState<View>('learning');const current=views.find(v=>v.id===view)!;
 return <section className="hs-devices" id="on-your-screen" aria-labelledby="hs-device-title"><header className="hs-heading"><p>RESPONSIVE WEB ACCESS</p><h2 id="hs-device-title">Open your browser.<br/><em>Bring your learning.</em></h2><span>Use the same account on your laptop, tablet or phone. No app installation is needed for web access.</span></header>
 <div className="hs-device-stage"><span className="hs-orbit" aria-hidden="true"/><div className="hs-tablet" aria-label="Tablet layout preview"><span className="hs-camera" aria-hidden="true"/><Screen view={view}/></div><div className="hs-phone" aria-label="Mobile layout preview"><div className="hs-statusbar" aria-hidden="true"><span>9:41</span><span className="hs-notch"/><span><Wifi size={12}/><BatteryFull size={14}/></span></div><Screen view={view} phone/><span className="hs-home-bar" aria-hidden="true"/></div></div>
 <div className="hs-controls" role="group" aria-label="Choose the preview on both devices">{views.map(v=><button key={v.id} aria-pressed={view===v.id} aria-controls="hs-preview-description" onClick={()=>setView(v.id)}><v.icon size={18}/>{v.name}</button>)}</div><div className="hs-caption" id="hs-preview-description" aria-live="polite"><h3>{current.title}</h3><p>{current.text}</p></div><p className="hs-preview-note">Illustrative web layouts with sample content. Internet access is required; document viewing depends on the file format and browser.</p></section>
}
export function ProviderPrograms({quiet, reduced, onToggleMotion}: {quiet: boolean; reduced: boolean; onToggleMotion: () => void}) {
 return <section className="hc-providers" id="beyond-the-classroom" aria-labelledby="hs-life-title">
  <MotionSection quiet={quiet} className="hs-lifestyle">
   <img className="hs-life-image" src="/assets/joy/beyond-classroom.webp" srcSet="/assets/joy/beyond-classroom-small.webp 720w, /assets/joy/beyond-classroom.webp 1600w" sizes="100vw" width={1600} height={900} loading="lazy" decoding="async" alt="Illustrative learners building a robotics project with guidance and digital materials"/>
   <div className="hs-lifestyle-shade"/>
   <LearningAtmosphere dark/>
   <div className="hs-life-top"><span>FOR EDTECH PROVIDERS</span><button className="hs-life-motion" onClick={onToggleMotion} disabled={reduced} aria-pressed={quiet} aria-label={reduced?'Animation is off in your device settings':quiet?'Play decorative animations':'Pause decorative animations'}>{quiet?<Play size={13}/>:<Pause size={13}/>} {reduced?'Motion off':quiet?'Play animation':'Pause animation'}</button></div>
   <div className="hs-life-copy"><p>CODING · ROBOTICS · AI</p><h2 id="hs-life-title">Your program.<br/><em>More classrooms.</em></h2><p>Coordinate the teachers, partner schools and learners behind your hands-on programs.</p><a href="#provider-delivery">Compare delivery models <ArrowUpRight size={20}/></a></div>
   <div className="hs-life-foot"><span>From code to working projects.</span><span>Partner schools + direct learners</span></div>
  </MotionSection>
  <div className="jy-wrap hc-provider-models" id="provider-delivery">
   <article><span className="hc-model-tag">B2B · PARTNER SCHOOLS</span><h3>Your teachers.<br/>Their school.</h3><p>Assign your instructors to partner-school batches. Share teaching material for each program and record quarterly assessment marks.</p><ul><li>Partner school and batch allocation</li><li>Provider-managed teaching content</li><li>Marksheets with school and provider logos</li></ul></article>
   <article><span className="hc-model-tag">B2C · DIRECT LEARNERS</span><h3>Your program.<br/>Their next skill.</h3><p>Group individual learners into program batches, assign an instructor and give them access to the relevant coding, robotics or AI material.</p><ul><li>Direct learner enrolment</li><li>Program and batch-based delivery</li><li>Practice, assessments and learner progress</li></ul></article>
  </div>
 </section>;
}
