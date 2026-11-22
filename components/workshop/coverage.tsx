'use client';
import {useState} from 'react';
import {ChartNoAxesCombined,ChevronDown} from 'lucide-react';
export type Edition='school'|'college'|'corporate';
export const editionLabels:Record<Edition,string>={school:'School',college:'College',corporate:'Corporate'};
const all:Edition[]=['school','college','corporate'],edu:Edition[]=['school','college'];
type Load=[string,Edition[]];
const teaching:Load[]=[['Course modules',all],['Quizzes and assignments',all],['Live-class links',all],['Grade and section teaching',['school']],['Semester subject delivery',['college']],['Employee training batches',['corporate']],['Non-credit academic courses',edu]];
const operations:Load[]=[['Admissions and student records',edu],['Official class attendance',edu],['Fee invoices and receipts',edu],['Campus asset registers',edu],['School annual overview',['school']],['College quality evidence',['college']],['College research and publications',['college']]];
const count=(a:Load[],e:Edition)=>a.filter(([,k])=>k.includes(e)).length;
const colors={school:'#5372a5',college:'#a25730',corporate:'#725395'};
export function Coverage({edition,choose}:{edition:Edition;choose?:(a:Edition)=>void}){
 const [local,set]=useState<Edition>(edition),current=choose?edition:local;function select(e:Edition){if(choose)choose(e);else set(e);}
 const x=(n:number)=>45+n*29,y=(n:number)=>172-n*20;
 return <aside className="ax-map"><div className="ax-map-band"><ChartNoAxesCombined size={16}/> Edition comparison</div><div className="ax-map-inner"><p className="ax-overline">Learning × operations</p><h3>Which workspace fits?</h3><p>Compare the teaching and administrative jobs included in each Tejasvi edition.</p>
 <div className="ax-toggles" role="group" aria-label="Compare workspace coverage">{(['school','college','corporate'] as const).map(e=><button type="button" key={e} aria-pressed={e===current} onClick={()=>select(e)}><i style={{background:colors[e]}}/>{editionLabels[e]}</button>)}</div>
 <svg className="ax-chart" viewBox="0 0 288 215" role="group" aria-label={editionLabels[current]+': '+count(teaching,current)+' of seven teaching jobs, '+count(operations,current)+' of seven operations jobs.'}><rect x="45" y="32" width="203" height="140" fill="#f3f5f8"/><rect x="146.5" y="32" width="101.5" height="70" fill="#fbefe2"/>
 {[0,2,4,7].map(n=><g key={n}><path d={'M45 '+y(n)+'H248 M'+x(n)+' 32V172'} stroke="#d7dfe2" strokeWidth=".8"/><text x="37" y={y(n)+3} textAnchor="end">{n}</text><text x={x(n)} y="186" textAnchor="middle">{n}</text></g>)}<text x="145" y="207" textAnchor="middle">Teaching workflows →</text><text transform="translate(13 104) rotate(-90)" textAnchor="middle">Operations workflows →</text>
 {all.map((e,i)=>{const cx=x(count(teaching,e)),cy=y(count(operations,e)),right=e!=='school';return <g key={e} role="button" tabIndex={0} aria-label={'Plot: '+editionLabels[e]} aria-pressed={current===e} onClick={()=>select(e)} onKeyDown={v=>{if(v.key==='Enter'||v.key===' '){v.preventDefault();select(e);}}} opacity={current===e?1:.72}><circle cx={cx} cy={cy} r="10" fill="transparent"/><path d={'M'+cx+' '+cy+'l'+(right?9:-9)+' '+(i===1?-8:6)} stroke={colors[e]} fill="none"/>{current===e&&<circle cx={cx} cy={cy} r="8" fill="none" stroke={colors[e]} strokeWidth="1.3"/>}<circle cx={cx} cy={cy} r="4.4" fill={colors[e]}/><text x={cx+(right?12:-12)} y={cy+(i===1?-8:9)} textAnchor={right?'start':'end'}>{editionLabels[e]}</text></g>})}</svg>
 <div className="ax-map-read" aria-live="polite"><b>{editionLabels[current]}</b><span>{count(teaching,current)} teaching · {count(operations,current)} operations</span></div>
 <details><summary>See the 14-workflow checklist <ChevronDown size={14}/></summary><p>Each dot counts the listed jobs. This compares editions, not vendors or performance.</p>{[['Teaching',teaching],['Operations',operations]].map(([k,items])=><div key={k as string}><strong>{k as string}</strong><ul>{(items as Load[]).map(([name,eds])=><li key={name}><span>{name}</span><b>{eds.includes(current)?'Included':'—'}</b></li>)}</ul></div>)}</details>
 </div></aside>;
}
