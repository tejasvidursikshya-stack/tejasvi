'use client';
import {BookOpen,ArrowRight,ClipboardCheck,CheckCircle2,Clock3,RefreshCw,MessageSquare,Users,ArrowUpRight,PenLine,ChartNoAxesColumn,Sparkles,CircleAlert,Building2,type LucideIcon} from 'lucide-react';
import type {PlatformData} from '@/lib/platform-types';
import type {JourneyRow} from '@/lib/learning-journey-types';
import {useJourney,journeyDate,stateLabel} from './journey-common';
import {LiveClasses} from './live-classes';
import './learning-journey.css';
import './learning-home.css';
type Dest='courses'|'non-credit'|'assessments'|'progress'|'gradebook'|'live'|'students'|'overview'|'studio';
type Tone='blue'|'orange'|'rose'|'teal'|'purple'|'sky';
type Tile={icon:LucideIcon;value:string|number;label:string;note:string;tone:Tone;go:()=>void};

const COURSE_TONES:Tone[]=['blue','purple','teal','orange','sky','rose'];
const plural=(n:number,word:string)=>`${n} ${word}${n===1?'':/(s|sh|ch|x)$/.test(word)?'es':'s'}`;
function greeting(d=new Date()){const h=d.getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'?';}
function avatarTone(id:string){let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return COURSE_TONES[h%COURSE_TONES.length];}
function waited(v?:string|null){if(!v)return '';const t=new Date(/Z$|[+-]\d\d:\d\d$/.test(v)?v:v.replace(' ','T')+'Z').getTime();if(Number.isNaN(t))return '';const days=Math.floor((Date.now()-t)/864e5);return days<=0?'today':days===1?'1 day ago':days+' days ago';}

function Ring({value}:{value:number}){const r=34,c=2*Math.PI*r;return <svg className="tlh-ring" viewBox="0 0 84 84" role="img" aria-label={value+'% complete'}><circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="8"/><circle cx="42" cy="42" r={r} fill="none" stroke="#FF7800" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-value/100)} transform="rotate(-90 42 42)"/><text x="42" y="47" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="800">{value}%</text></svg>;}
function Card({title,action,children,id}:{title:string;action?:React.ReactNode;children:React.ReactNode;id:string}){return <section className="tlh-card" aria-labelledby={id}><div className="tlh-card-head"><h2 id={id}>{title}</h2>{action}</div>{children}</section>;}
function Empty({icon:Icon=CheckCircle2,title,text}:{icon?:LucideIcon;title:string;text:string}){return <div className="tlh-empty"><span><Icon size={22}/></span><strong>{title}</strong><p>{text}</p></div>;}

function courseHealth(rows:JourneyRow[]){
 const map=new Map<string,{id:string;title:string;learners:number;read:number;readTotal:number;review:number;help:number;done:number}>();
 for(const r of rows){const c=map.get(r.courseId)||{id:r.courseId,title:r.courseTitle,learners:0,read:0,readTotal:0,review:0,help:0,done:0};c.learners++;c.read+=r.read;c.readTotal+=r.readTotal;c.review+=r.review;c.help+=r.reasons.length?1:0;c.done+=r.complete?1:0;map.set(r.courseId,c);}
 return [...map.values()].sort((a,b)=>b.review+b.help-(a.review+a.help)||a.title.localeCompare(b.title));
}

export function LearningJourneyHome({data:platform,ai=false,onGo,onOpen,onAssess,onGrades}:{data:PlatformData;ai?:boolean;onGo:(v:Dest)=>void;onOpen:(id:string)=>void;onAssess:(course:string,assessment?:string,user?:string)=>void;onGrades:(course:string,user?:string)=>void}){
 const org=platform.organization!,{data,error,loading,load}=useJourney(org.id),learner=['student','employee'].includes(org.role),admin=org.role==='admin',rows=data?.rows||[],first=platform.user.displayName.split(' ')[0],unique=new Set(rows.map(r=>r.userId)).size;
 const next=[...rows].filter(r=>!r.complete).sort((a,b)=>(b.lastActivity||'').localeCompare(a.lastActivity||''))[0]||rows[0];
 const work=rows.flatMap(r=>r.items.filter(i=>learner?(i.kind==='assignment'&&['not_started','overdue','returned'].includes(i.state)||i.kind==='quiz'&&(i.score===null||i.score<70)):i.kind==='assignment'&&i.state==='submitted').map(i=>({r,i}))).sort((a,b)=>learner?(a.i.dueAt||'9999').localeCompare(b.i.dueAt||'9999'):(a.i.submittedAt||'9999').localeCompare(b.i.submittedAt||'9999'));
 const feedback=rows.flatMap(r=>r.items.filter(i=>i.feedback&&i.kind!=='quiz').map(i=>({r,i}))).sort((a,b)=>(b.i.gradedAt||b.i.submittedAt||'').localeCompare(a.i.gradedAt||a.i.submittedAt||''));
 const follow=rows.filter(r=>r.reasons.length),followPeople=new Set(follow.map(r=>r.userId)).size,completed=rows.filter(r=>r.complete).length,overdue=work.filter(w=>w.i.state==='overdue').length;
 const published=data?.courses.filter(c=>c.status==='published').length||0,drafts=(data?.courses.length||0)-published;
 // Schools and colleges teach curriculum subjects; courses without a subject link are optional non-credit learning.
 const institution=['school','college'].includes(org.kind),academicIds=new Set((data?.courses||[]).filter(c=>c.subjectId).map(c=>c.id)),mySubjects=rows.filter(r=>academicIds.has(r.courseId)).length,myOptional=rows.length-mySubjects,pubSubjects=data?.courses.filter(c=>c.status==='published'&&c.subjectId).length||0,pubOptional=published-pubSubjects;
 const readTotal=rows.reduce((s,r)=>s+r.readTotal,0),avgRead=readTotal?Math.round(rows.reduce((s,r)=>s+r.read,0)/readTotal*100):null;
 const oldest=!learner&&work[0]?waited(work[0].i.submittedAt):'';
 const today=new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});

 const summary=learner
  ?work.length?<>You have {plural(work.length,'task')} to finish{overdue?<>, and <b>{overdue} {overdue===1?'is':'are'} overdue</b></>:null}.</>:next?<>You’re up to date. Pick up <b>{next.courseTitle}</b> where you left off.</>:institution?'Your subjects and non-credit courses will appear here once your institution assigns them.':'Your courses will appear here once your institution assigns them.'
  :work.length?<>{plural(work.length,'submission')} {work.length===1?'is':'are'} waiting for feedback{oldest?<>. The oldest arrived {oldest}</>:null}.</>:followPeople?<>The review queue is clear. {plural(followPeople,'learner')} could use a check-in.</>:'The review queue is clear and no learners need follow-up.';

 const tiles:Tile[]=learner?[
  institution?{icon:BookOpen,value:mySubjects,label:'My subjects',note:myOptional?`+ ${plural(myOptional,'non-credit course')}`:completed?`${completed} completed`:'Open any time',tone:'blue',go:()=>onGo('courses')}:{icon:BookOpen,value:rows.length,label:'My courses',note:completed?`${completed} completed`:'Open any time',tone:'blue',go:()=>onGo('courses')},
  {icon:Clock3,value:work.length,label:'Tasks to complete',note:overdue?`${overdue} overdue`:work.length?'Nothing overdue':'All done',tone:overdue?'rose':'orange',go:()=>onGo('assessments')},
  {icon:MessageSquare,value:feedback.length,label:'Feedback received',note:'From your teachers',tone:'purple',go:()=>onGo('gradebook')},
  {icon:CheckCircle2,value:avgRead===null?'—':avgRead+'%',label:'Lessons read',note:institution?'Across subjects and courses':'Across all courses',tone:'teal',go:()=>onGo('progress')},
 ]:[
  {icon:ClipboardCheck,value:work.length,label:'Submissions to review',note:oldest?`Oldest: ${oldest}`:'Queue is clear',tone:'orange',go:()=>work[0]?onAssess(work[0].r.courseId,work[0].i.assessmentId,work[0].r.userId):onGo('assessments')},
  {icon:CircleAlert,value:followPeople,label:'Learners need attention',note:'Overdue work or low scores',tone:'rose',go:()=>onGo('progress')},
  {icon:Users,value:unique,label:org.kind==='corporate'?'Active learners':'Learners',note:avgRead===null?'No reading yet':`${avgRead}% average reading`,tone:'teal',go:()=>onGo(admin&&platform.sharedStudents?'students':'progress')},
  institution?{icon:BookOpen,value:pubSubjects,label:'Published subjects',note:[pubOptional?plural(pubOptional,'non-credit course'):'',drafts>0?plural(drafts,'draft'):''].filter(Boolean).join(' · ')||'No drafts',tone:'purple',go:()=>onGo('courses')}:{icon:BookOpen,value:published,label:'Published courses',note:drafts>0?plural(drafts,'draft'):'No drafts',tone:'purple',go:()=>onGo('courses')},
 ];
 const health=courseHealth(rows);

 return <div className="tlh">
  <section className="tlh-hero">
   <div className="tlh-hero-copy">
    <p className="tlh-kicker">{today} · {org.name}</p>
    <h1>{greeting()}, {first}</h1>
    <p className="tlh-lead">{data?summary:'Loading your learning records…'}</p>
    <div className="tlh-actions">
     {learner?<>
      {next&&<button className="tlh-qa tlh-qa-primary" onClick={()=>onOpen(next.courseId)}><ArrowRight size={18}/>{next.started?`Continue: ${next.courseTitle}`:`Start ${next.courseTitle}`}</button>}
      <button className="tlh-qa" onClick={()=>onGo('gradebook')}><ClipboardCheck size={18}/>My grades</button>
      {ai&&<button className="tlh-qa" onClick={()=>onGo('studio')}><Sparkles size={18}/>Ask Tejasvi AI</button>}
     </>:<>
      <button className="tlh-qa tlh-qa-primary" onClick={()=>work[0]?onAssess(work[0].r.courseId,work[0].i.assessmentId,work[0].r.userId):onGo('assessments')}><PenLine size={18}/>{work.length?`Grade ${plural(work.length,'submission')}`:'Open assessments'}</button>
      <button className="tlh-qa" onClick={()=>onGo('courses')}><BookOpen size={18}/>{institution?(admin?'Subjects':'My subjects'):admin?'Courses':'My courses'}</button>
      {ai&&<button className="tlh-qa" onClick={()=>onGo('studio')}><Sparkles size={18}/>Create with Tejasvi AI</button>}
     </>}
    </div>
   </div>
   {learner&&next&&next.percent!==null&&<div className="tlh-hero-side"><Ring value={next.percent}/><div><strong>{next.courseTitle}</strong><span>{next.read} of {plural(next.readTotal,'lesson')} read</span></div></div>}
   <button className="tlh-refresh" onClick={load} disabled={loading} aria-label="Refresh"><RefreshCw size={16} className={loading?'tlh-spin':undefined}/><span>{loading?'Refreshing…':'Refresh'}</span></button>
  </section>

  {error&&<p role="alert" className="tlh-error"><CircleAlert size={18}/>{error}<button onClick={load}>Try again</button></p>}
  {!data&&loading?<div className="tlh-tiles" aria-hidden="true">{[0,1,2,3].map(i=><div key={i} className="tlh-tile tlh-skeleton"/>)}</div>:data&&<>
  <section className="tlh-tiles" aria-label="At a glance">{tiles.map(t=><button key={t.label} className={'tlh-tile tone-'+t.tone} onClick={t.go}><span className="tlh-tile-ic"><t.icon size={20}/></span><strong>{t.value}</strong><span className="tlh-tile-label">{t.label}</span><span className="tlh-tile-note">{t.note}</span></button>)}</section>

  <div className="tlh-grid">
   <Card id="tlh-q" title={learner?'Due soon':'Review queue'} action={<span className="tlh-muted">{learner?'Earliest first':'Oldest first'}</span>}>
    {work.length?<ul className="tlh-list">{work.slice(0,4).map(({r,i})=><li key={r.userId+r.courseId+i.key}>
     {learner?<span className={'tlh-icon '+(i.state==='overdue'?'tone-rose':'tone-orange')}><ClipboardCheck size={20}/></span>:<span className={'tlh-avatar tone-'+avatarTone(r.userId)} aria-hidden="true">{initials(r.name)}</span>}
     <div className="tlh-row-text"><strong>{learner?i.title:r.name}</strong><span>{learner?`${r.courseTitle} · ${i.dueAt?'Due '+journeyDate(i.dueAt):'No deadline'}`:`${i.title} · ${waited(i.submittedAt)||r.courseTitle}`}</span></div>
     {learner?<button className={'tlh-pill '+(['overdue','returned'].includes(i.state)?'tone-rose':'tone-amber')} onClick={()=>i.assessmentId?onAssess(r.courseId,i.assessmentId):onOpen(r.courseId)}>{i.kind==='quiz'&&i.score!==null?'Practise again':stateLabel[i.state]}</button>
      :<button className="tlh-btn tlh-btn-go" onClick={()=>onAssess(r.courseId,i.assessmentId,r.userId)}>Grade</button>}
    </li>)}</ul>:<Empty title={learner?'You’re up to date':'The review queue is clear'} text={learner?'No assignments or quizzes are waiting in your courses.':'New submissions appear here when learners send their work.'}/>}
    {work.length>4&&<button className="tlh-btn tlh-btn-wide" onClick={()=>onGo('assessments')}>See all {work.length}</button>}
   </Card>

   {learner?<Card id="tlh-f" title="Latest feedback" action={<button className="tlh-btn" onClick={()=>onGo('gradebook')}>My grades</button>}>
    {feedback.length?<ul className="tlh-list">{feedback.slice(0,3).map(({r,i})=><li key={r.courseId+i.key} className="tlh-feedback">
     <span className="tlh-icon tone-purple"><MessageSquare size={20}/></span>
     <button className="tlh-row-text" onClick={()=>i.assessmentId?onAssess(r.courseId,i.assessmentId):onGrades(r.courseId,r.userId)}><strong>{i.title}</strong><span>{r.courseTitle}</span><q>{i.feedback}</q></button>
     {i.score!==null&&<span className="tlh-pill tone-green">{i.score}/{i.max}</span>}
    </li>)}</ul>:<Empty icon={MessageSquare} title="No feedback yet" text="When your teacher returns marked work, their comments appear here."/>}
   </Card>:<Card id="tlh-n" title="Needs attention" action={<button className="tlh-btn" onClick={()=>onGo('progress')}>Learning progress</button>}>
    {follow.length?<ul className="tlh-list">{follow.slice(0,4).map(r=><li key={r.courseId+r.userId}>
     <span className={'tlh-avatar tone-'+avatarTone(r.userId)} aria-hidden="true">{initials(r.name)}</span>
     <div className="tlh-row-text"><strong>{r.name}</strong><span>{r.courseTitle} · {r.reasons.join(' · ')}</span></div>
     <button className="tlh-btn" onClick={()=>onGrades(r.courseId,r.userId)}>Open</button>
    </li>)}</ul>:<Empty title="Everyone is on track" text="No overdue work, requested revisions or quiz scores below 70%."/>}
   </Card>}
  </div>

  <section aria-labelledby="tlh-c" className="tlh-section">
   <div className="tlh-card-head"><h2 id="tlh-c">{institution?(learner?'My subjects & courses':'Subject & course health'):learner?'My courses':'Course health'}</h2><span className="tlh-pills"><button className="tlh-btn" onClick={()=>onGo('courses')}>{institution?'All subjects':'All courses'}</button>{institution&&<button className="tlh-btn" onClick={()=>onGo('non-credit')}>Non-credit courses</button>}</span></div>
   {learner?(rows.length?<div className="tlh-courses">{rows.slice(0,6).map((r,n)=><button key={r.courseId} className="tlh-course" onClick={()=>onOpen(r.courseId)}>
     <span className={'tlh-course-badge tone-'+COURSE_TONES[n%COURSE_TONES.length]} aria-hidden="true">{initials(r.courseTitle)}</span>
     <strong>{r.courseTitle}</strong>
     <span className="tlh-course-meta"><span>{r.percent===null?'Materials ready':`${r.read} of ${plural(r.readTotal,'lesson')}`}</span><b>{r.percent===null?'':r.percent+'%'}</b></span>
     <span className="tlh-bar"><span className={'tone-'+COURSE_TONES[n%COURSE_TONES.length]} style={{width:(r.percent||0)+'%'}}/></span>
     <span className="tlh-pills">{institution&&<span className="tlh-pill tone-grey">{academicIds.has(r.courseId)?'Subject':'Non-credit'}</span>}<span className={'tlh-pill '+(r.complete?'tone-green':r.started?'tone-blue':'tone-grey')}>{r.complete?'Completed':r.started?'In progress':'Ready to start'}</span></span>
    </button>)}</div>:<div className="tlh-card"><Empty icon={BookOpen} title={institution?'Your subjects are on their way':'Your courses are on their way'} text="Your administrator assigns your subjects. They will appear here."/></div>)
   :(health.length?<div className="tlh-courses">{health.slice(0,6).map((c,n)=>{const pct=c.readTotal?Math.round(c.read/c.readTotal*100):0;return <button key={c.id} className="tlh-course" onClick={()=>onGrades(c.id)}>
     <span className="tlh-course-top"><span className={'tlh-course-badge tone-'+COURSE_TONES[n%COURSE_TONES.length]} aria-hidden="true">{initials(c.title)}</span><span><strong>{c.title}</strong><span className="tlh-muted">{plural(c.learners,'learner')}</span></span></span>
     <span className="tlh-course-meta"><span>Reading progress</span><b>{pct}%</b></span>
     <span className="tlh-bar"><span className={'tone-'+COURSE_TONES[n%COURSE_TONES.length]} style={{width:pct+'%'}}/></span>
     <span className="tlh-pills">{institution&&<span className="tlh-pill tone-grey">{academicIds.has(c.id)?'Subject':'Non-credit'}</span>}{c.review>0&&<span className="tlh-pill tone-amber">{c.review} to review</span>}{c.help>0&&<span className="tlh-pill tone-rose">{c.help} need help</span>}{c.done>0&&<span className="tlh-pill tone-green">{c.done} completed</span>}{!c.review&&!c.help&&!c.done&&<span className="tlh-pill tone-grey">On track</span>}</span>
    </button>;})}</div>:<div className="tlh-card"><Empty icon={BookOpen} title="No learner activity yet" text="Once learners open a published course, its progress appears here."/></div>)}
  </section>

  {!learner&&<div className="tlh-grid">
   <Card id="tlh-qa" title="Quick access">
    <ul className="tlh-links">{([[BookOpen,institution?(admin?'Subjects & content':'My teaching subjects'):admin?'Courses & content':'Teaching content',institution?'Curriculum subjects and their lessons':'Create and publish lessons','courses'],...(institution?[[BookOpen,'Non-credit courses','Optional learning outside the curriculum','non-credit']]:[]),[ClipboardCheck,'Gradebook','Marks, feedback and approved results','gradebook'],[ChartNoAxesColumn,'Learning progress','Reading, quizzes and follow-up','progress']] as [LucideIcon,string,string,Dest][]).map(([Icon,label,text,dest])=><li key={dest}><button onClick={()=>onGo(dest)}><span className="tlh-icon tone-blue"><Icon size={20}/></span><span className="tlh-row-text"><strong>{label}</strong><span>{text}</span></span><ArrowRight size={18}/></button></li>)}</ul>
   </Card>
   {admin&&platform.sharedStudents?<Card id="tlh-dir" title="Student directory" action={<span className="tlh-muted">{platform.sharedStudents.year}</span>}>
    <div className="tlh-directory"><span className="tlh-icon tone-teal"><Building2 size={20}/></span><div><strong>{platform.sharedStudents.total}</strong><span>students in EMIS & Learning</span></div>{platform.sharedStudents.pending>0&&<span className="tlh-pill tone-amber">{platform.sharedStudents.pending} need a login</span>}</div>
    <button className="tlh-btn tlh-btn-wide" onClick={()=>onGo('students')}>Open student directory <ArrowUpRight size={16}/></button>
   </Card>:<Card id="tlh-done" title="Completion">
    <div className="tlh-directory"><span className="tlh-icon tone-green"><CheckCircle2 size={20}/></span><div><strong>{completed}</strong><span>of {plural(rows.length,'enrolment')} completed</span></div></div>
    <span className="tlh-bar"><span className="tone-teal" style={{width:(rows.length?Math.round(completed/rows.length*100):0)+'%'}}/></span>
   </Card>}
  </div>}

  <div className="tlh-live"><LiveClasses orgId={org.id} courses={platform.courses} staff={!learner} compact onAll={()=>onGo('live')}/></div>
  <p className="tlh-footnote">Updated {journeyDate(data.generatedAt)}. Lesson reading, quiz results and assessment marks are shown separately.</p>
  </>}
 </div>;
}
