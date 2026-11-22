'use client';
import {useEffect,useState} from 'react';
import {BookOpen,ClipboardList,HelpCircle,ArrowRight,CheckCircle2} from 'lucide-react';
import {Materials} from './materials';
import {useLearnerRefresh} from './use-learner-refresh';
type Row=Record<string,any>;
export function StudentUnitOverview({courseId,unit,onOpen}:{courseId:string;unit:Row;onOpen:(tab:string,assessmentId?:string)=>void}){
 const [assignments,setAssignments]=useState<Row[]>([]),[error,setError]=useState('');
 async function load(){const r=await fetch('/api/assessments?course='+courseId+'&unit='+unit.id),d=await r.json();if(!r.ok)throw Error(d.error);setAssignments(d.assessments)}
 useEffect(()=>{setAssignments([]);setError('');load().catch(e=>setError(e.message))},[courseId,unit.id]);useLearnerRefresh(true,load);
 return <div className="student-unit-overview"><div className="learning-intro"><span className="resource-eyebrow">YOUR LEARNING PATH</span><h3>Everything for this unit</h3><p>Read the lesson, explore the materials, then practise what you have learned.</p></div>{unit.content&&<button className="learning-path-row" onClick={()=>onOpen('learn')}><span className="resource-symbol"><BookOpen size={23}/></span><span className="resource-copy"><span className="resource-eyebrow">LESSON · {unit.duration} MIN</span><strong>Read the lesson</strong><span>{unit.completed?'You have marked this lesson as read.':'Start with the key ideas and learning objectives.'}</span></span><span className="path-status">{unit.completed?<CheckCircle2 size={19}/>:<ArrowRight size={19}/>}</span></button>}
 <Materials key={unit.id} courseId={courseId} unitId={unit.id}/>
 {unit.quiz?.length>0&&<button className="learning-path-row" onClick={()=>onOpen('quiz')}><span className="resource-symbol resource-symbol-quiz"><HelpCircle size={23}/></span><span className="resource-copy"><span className="resource-eyebrow">KNOWLEDGE CHECK</span><strong>Unit quiz</strong><span>{unit.quiz.length} questions · Check your understanding</span></span><ArrowRight size={19}/></button>}
 {error&&<p role="alert">{error}</p>}{assignments.map(a=><button key={a.id} className="learning-path-row" onClick={()=>onOpen('assessments',a.id)}><span className="resource-symbol resource-symbol-work"><ClipboardList size={23}/></span><span className="resource-copy"><span className="resource-eyebrow">{String(a.kind).replaceAll('_',' ')} · {a.max_score} MARKS</span><strong>{a.title}</strong><span>View questions and submit your work{a.due_at?' · Deadline: '+new Date(a.due_at.replace(' ','T')+'Z').toLocaleString():''}</span></span><ArrowRight size={19}/></button>)}
 </div>
}
