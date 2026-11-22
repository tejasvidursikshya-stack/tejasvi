// This module only reads the institution-, role- and year-scoped records supplied by EMIS.
import {can,modules} from '../shared/schema.mjs';
import {normalizeRole} from '../shared/access.mjs';
import {campusNow,learningRows,number,amount,upcomingClasses,cashSeries} from './dashboard-model.mjs';
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const uidate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:null;
const dateOf=s=>new Date(s+'T12:00:00Z');
const fmt=(s,options)=>dateOf(s).toLocaleDateString('en-GB',{...options,timeZone:'UTC'});
const month=s=>fmt(s,{month:'short'}),nice=s=>fmt(s,{month:'short',day:'numeric'});
const cents=rs=>rs.reduce((sum,r)=>sum+Math.round((+r.amount||0)*100),0);
function paidTotals(payments){const paid=new Map();for(const p of payments){paid.set(p.invoiceId,(paid.get(p.invoiceId)||0)+Math.round(Number(p.amount)*100));}return paid;}
function invoiceAmounts(invoice,paid){const cents=paid.get(invoice.id)||0;return {paid:cents/100,balance:(Math.round(Number(invoice.amount)*100)-cents)/100};}
const percent=v=>v==null?'—':number(Math.round(v))+'%';
const seen=a=>a.filter(r=>['Present','Absent','Late'].includes(r.status));
const present=a=>a.filter(r=>r.status==='Present'||r.status==='Late').length;
const rate=a=>a.length?present(a)/a.length*100:null;
function occurrences(rows,key='status'){const map=new Map();for(const r of rows){const v=r[key]||'Not specified';map.set(v,(map.get(v)||0)+1);}return [...map].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])));}
function lastDate(rows,field){return rows.reduce((s,r)=>uidate(r[field])&&r[field]>s?r[field]:s,'');}
function period(rows,field,daily,current,today){
 const anchor=current?today:lastDate(rows,field);if(!anchor)return {buckets:[],range:'No dated records'};
 const n=daily?7:6, buckets=Array.from({length:n},(_,i)=>{
  const d=dateOf(anchor);if(daily)d.setUTCDate(d.getUTCDate()-n+1+i);else{d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-n+1+i);}
  const full=d.toISOString().slice(0,10),key=full.slice(0,daily?10:7);
  return {key,label:daily?fmt(full,{weekday:'short'}):month(full),full:daily?nice(full):fmt(full,{month:'long',year:'numeric'}),rows:[]};
 });
 const lookup=new Map(buckets.map(b=>[b.key,b]));for(const r of rows){const d=uidate(r[field]);if(d&&(!current||d<=today))lookup.get(d.slice(0,daily?10:7))?.rows.push(r);}
 const first=buckets[0].key,last=buckets.at(-1).key;
 return {buckets,range:daily?nice(first)+' – '+nice(last):month(first+'-01')+' – '+fmt(last+'-01',{month:'short',year:'numeric'})};
}
function aggregateTile({entity,title,rows,field='date',metric='count',daily=false,open,sub},clock){
 const {buckets,range}=period(rows,field,daily,clock.current,clock.today),valid=metric==='attendance'?r=>seen(r):r=>r;
 const val=r=>metric==='attendance'?rate(r):metric==='money'?cents(r)/100:r.length,display=metric==='attendance'?percent:metric==='money'?amount:number;
 const all=valid(buckets.flatMap(b=>b.rows)),points=buckets.map(b=>({label:b.label,full:b.full,value:val(valid(b.rows)),observed:valid(b.rows).length>0}));
 return {entity,title,sub:sub||(daily?'Seven-day trend':'Six-month trend'),value:display(val(all)),points,display,range,open,any:all.length>0,zeroTo:metric==='attendance'?100:null};
}
function categoryTile(entity,title,rows,key,open){
 const groups=occurrences(rows,key);return {entity,title,value:number(rows.length),range:'Selected academic year',sub:'Records by '+(key==='status'?'status':key),open,any:rows.length>0,display:number,points:groups.slice(0,7).map(([full,value])=>({label:String(full),full,value,observed:true})),categorical:true};
}
const config={
 attendance:['Attendance','attendance','date','attendance',true,'Attendance register'],
 admissions:['Applications','admissions','applicationDate','count',false,'Admissions register'],
 payments:['Fee collections','payments','date','money',false,'Payment receipts'],
 transactions:['Expenditure','transactions','date','money',false,'Finance register'],
 fees:['Invoiced fees','fees','dueDate','money',false,'Fee invoices'],
 exams:['Exams scheduled','exams','date','count',false,'Examination register'],
 grievances:['Support requests','grievances','date','count',false,'Support register']
};
const plans={
 'Super Admin':['attendance','admissions','payments'],Admin:['attendance','admissions','payments'],'Principal':['attendance','admissions','results'],'Campus Chief':['attendance','admissions','payments'],'EMIS Coordinator':['attendance','admissions','payments'],'IQAC Head':['attendance','results','evidence'],
 Student:['attendance','timetable','results'],Faculty:['attendance','timetable','results'],'Finance Head':['payments','fees','transactions'],'Student Affairs':['admissions','enquiries','grievances'],'Exam Coordinator':['results','exams','attendance'],'Academic Coordinator':['attendance','timetable','results'],'Program Director':['attendance','admissions','results']};
const courseScopes=new Set(['courses','timetable','exams']);
const shortLabels={enquiries:'Enquiries',library:'Library resources',facilities:'Facilities',faculty:'Faculty',staff:'Staff',evidence:'Quality evidence',actions:'Improvement actions',development:'Staff development',placements:'Placements',research:'Research projects',publications:'Publications',partnerships:'Partnerships',students:'Students',programs:'Academic programs'};
const source=(ctx,k)=>!can(ctx.user.role,k)?[]:ctx.user.role==='Student'&&courseScopes.has(k)?learningRows(ctx,k):ctx.rows(k);
const initials=s=>(s||'—').split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase();
const txt=(main,sub)=>({main:String(main??'—'),sub});
const met=(v)=>({main:percent(v),meter:v});
const publicName=(ctx,entity,id)=>id?ctx.label(entity,id):'';
function tableFor(ctx,r,role){
 const from=(entity,mode,title,desc,columns,all,link)=>({entity,mode,title,desc,columns,all,link});
 if(role==='Finance Head'){
  const pay=paidTotals(r('payments'));return from('fees','fees','Fee register','Invoices and payments for the selected year.',['Invoice','Due date','Balance','Paid'],
   r('fees').map(v=>{const f=invoiceAmounts(v,pay);return {id:v.id,record:v,name:v.invoiceNo||v.category||'Invoice',code:v.category,rank:f.balance,cells:[txt(v.dueDate||'—'),txt(amount(f.balance)),met(+v.amount?100*f.paid/v.amount:null)]};}),'All invoices');
 }
 if(role==='Student'||role==='Faculty'){
  const att=seen(r('attendance')),t=r('timetable');return from('courses','courses',role==='Faculty'?'Teaching assignments':'My courses','Courses visible to you in this academic year.',['Course','Semester','Weekly classes','Attendance'],
   r('courses').map(c=>({id:c.id,record:c,name:c.name,code:c.code,rank:0,cells:[txt(c.semester||'—'),txt(number(t.filter(x=>x.courseId===c.id).length)),met(rate(att.filter(x=>x.courseId===c.id)))]})),'All courses');
 }
 if(can(ctx.user.role,'programs')&&can(ctx.user.role,'courses')&&can(ctx.user.role,'students')){
  const students=r('students'),courses=r('courses'),att=seen(r('attendance')),byCourse=new Map(courses.map(c=>[c.id,c.programId])),byProgram=new Map();
  for(const a of att){const k=byCourse.get(a.courseId);if(!k)continue;if(!byProgram.has(k))byProgram.set(k,[]);byProgram.get(k).push(a);}
  const enrolled=new Map(),teaching=new Map();for(const s of students)enrolled.set(s.programId,(enrolled.get(s.programId)||0)+1);for(const c of courses)teaching.set(c.programId,(teaching.get(c.programId)||0)+1);
  return from('programs','programs','Program overview',number(students.length)+' students · '+number(courses.length)+' courses in the selected year.',['Program','Students','Courses','Attendance'],
   r('programs').map(p=>{const n=enrolled.get(p.id)||0;return {id:p.id,record:p,name:p.name,badge:p.code,code:[p.code,p.level].filter(Boolean).join(' · '),rank:n,cells:[txt(number(n)),txt(number(teaching.get(p.id)||0)),met(rate(byProgram.get(p.id)||[]))]};}),'All programs');
 }
 const keys=Object.keys(modules).filter(k=>can(ctx.user.role,k,'write'));return from(null,'registers','My registers','Open a register to review or update its records.',['Register','Area','Records','Access'],
  keys.map(k=>({id:k,entity:k,name:shortLabels[k]||modules[k].title,code:null,rank:r(k).length,cells:[txt(modules[k].group||'Institution'),txt(number(r(k).length)),txt('Can edit')]})),null);
}
function followups(ctx,r,role,clock){
 if(role==='Student'||role==='Faculty'){
  const upcoming=upcomingClasses(r('timetable'),clock.current,clock.now);
  return {title:clock.current?'Next classes':'Class schedule',icon:'schedule',items:upcoming.slice(0,2).map(t=>({entity:'timetable',record:t,title:publicName(ctx,'courses',t.courseId)||'Scheduled class',note:[t.when,t.startTime,t.room].filter(Boolean).join(' · ')})),footer:'Open timetable',link:'timetable',empty:clock.current?'No classes scheduled.':'No timetable entries this year.'};
 }
 const items=[];
 const add=(entity,n,title,note,icon)=>{if(can(ctx.user.role,entity)&&n)items.push({entity,title:n+' '+title(n),note,icon});};
 add('admissions',r('admissions').filter(x=>['Applied','Under review'].includes(x.status)).length,n=>n===1?'application':'applications','Awaiting review','application');
 if(clock.current&&can(ctx.user.role,'fees')){const pay=paidTotals(r('payments'));add('fees',r('fees').filter(f=>f.dueDate&&f.dueDate<clock.today&&invoiceAmounts(f,pay).balance>0).length,n=>n===1?'overdue invoice':'overdue invoices','Payment follow-up','invoice');}
 add('results',can(ctx.user.role,'results','write')?r('results').filter(x=>x.status==='Draft').length:0,n=>n===1?'draft result':'draft results','Awaiting publication','result');
 add('actions',r('actions').filter(x=>x.status!=='Completed').length,n=>n===1?'open action':'open actions','Quality and planning','action');
 add('grievances',r('grievances').filter(x=>!['Resolved','Closed'].includes(x.status)).length,n=>n===1?'support request':'support requests','Awaiting resolution','action');
 return {title:'Needs attention',icon:'action',items,footer:items.length?'View all follow-ups':null,empty:'No pending items in these registers.'};
}
function breakdown(type,title,description,entity,rows,field='status'){
 const groups=occurrences(rows,field);return {type,title,description,entity,groups,metric:'Records',total:rows.length};
}
export function dashboardModel(ctx,now=new Date()){
 const role=normalizeRole(ctx.user.role),clock={current:ctx.year===ctx.profile.year,today:campusNow(now).date,now},cache=new Map(),r=k=>{if(!cache.has(k))cache.set(k,source(ctx,k));return cache.get(k);};
 const keys=[...new Set([...(plans[role]||[]),...Object.keys(modules).filter(k=>can(ctx.user.role,k,'write'))])].filter(k=>can(ctx.user.role,k)).slice(0,3);
 const tiles=keys.map(k=>{
  if(k==='timetable'){const rows=r(k);return {entity:k,title:'Weekly classes',value:number(rows.length),sub:'Recurring timetable',range:'Monday – Sunday',open:'Class timetable',any:rows.length>0,display:number,points:weekdays.map(w=>({label:w.slice(0,3),full:w,value:rows.filter(t=>t.day===w).length,observed:rows.some(t=>t.day===w)}))};}
  if(k==='results'){const exams=new Map((can(ctx.user.role,'exams')?ctx.rows('exams'):[]).map(e=>[e.id,e.date]));return aggregateTile({title:'Published results',entity:k,rows:r(k).filter(v=>v.status==='Published').map(v=>({...v,date:exams.get(v.examId)})),open:'Results register',sub:'By examination month'},clock);}
  if(config[k]){const [title,entity,field,metric,daily,open]=config[k];return aggregateTile({title,entity,field,metric,daily,open,sub:k==='fees'?'By invoice due date':undefined,rows:k==='transactions'?r(k).filter(x=>x.type==='Expenditure'):r(k)},clock);}
  const rows=r(k),key=modules[k].fields.find(f=>f.key==='status')?.key||modules[k].fields.find(f=>f.type==='select')?.key;
  if(key)return categoryTile(k,shortLabels[k]||modules[k].title,rows,key,'Open register');
  const date=modules[k].fields.find(f=>f.type==='date'&&f.key!=='dob')?.key;
  return date?aggregateTile({entity:k,title:shortLabels[k]||modules[k].title,field:date,rows,open:'Open register'},clock):
   {entity:k,title:shortLabels[k]||modules[k].title,value:number(rows.length),sub:'Register total',range:'Visible records',open:'Open register',any:!!rows.length,points:[],display:number};
 });
 const panels=[];
 if(can(ctx.user.role,'payments')&&can(ctx.user.role,'transactions')){
  const pay=r('payments'),txn=r('transactions'),anchor=clock.current?clock.today:lastDate([...pay,...txn],'date');
  const points=anchor?cashSeries(pay.filter(x=>x.date<=anchor),txn.filter(x=>x.date<=anchor),6,dateOf(anchor)):[];
  panels.push({type:'lines',title:'Income & expenditure',description:'Six-month comparison · NPR',entity:'transactions',points,any:points.some(p=>p.count)});
 }
 if(can(ctx.user.role,'admissions'))panels.push(breakdown('bars','Admission stages','Applications by current status.','admissions',r('admissions')));
 if(can(ctx.user.role,'attendance'))panels.push(breakdown('ring',role==='Student'?'My attendance record':'Attendance record','All attendance marks in the selected year.','attendance',r('attendance')));
 if(can(ctx.user.role,'results'))panels.push(breakdown('bars',role==='Student'?'My assessment outcomes':'Assessment outcomes','Published results by academic standing.','results',r('results').filter(x=>x.status==='Published'),'standing'));
 if(!panels.length){for(const k of keys.slice(0,2)){const field=modules[k].fields.find(f=>f.key==='status')||modules[k].fields.find(f=>f.type==='select');if(field)panels.push(breakdown('bars',shortLabels[k]||modules[k].title,'Distribution by '+field.label.toLowerCase()+'.',k,r(k),field.key));}}
 return {role,tiles,table:tableFor(ctx,r,role),attention:followups(ctx,r,role,clock),panels};
}
export const markInitials=initials;
