'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import type {JourneyData} from '@/lib/learning-journey-types';
export function useJourney(org:string,course?:string){
 const [data,setData]=useState<JourneyData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),serial=useRef(0);
 const load=useCallback(async()=>{const n=++serial.current;setLoading(true);try{const r=await fetch('/api/learning-journey?org='+encodeURIComponent(org)+(course?'&course='+encodeURIComponent(course):''),{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not load learning records.');if(n===serial.current){setData(d);setError('');}}catch(e){if(n===serial.current)setError((e as Error).message);}finally{if(n===serial.current)setLoading(false);}},[org,course]);
 useEffect(()=>{setData(null);load();const visible=()=>{if(!document.hidden)load();};window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);return()=>{serial.current++;window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};},[load]);
 return {data,error,loading,load};
}
export function journeyDate(v?:string|null,short=false){if(!v)return 'No deadline';const normalized=/Z$|[+-]\d\d:\d\d$/.test(v)?v:v.replace(' ','T')+'Z';const d=new Date(normalized);return Number.isNaN(d.getTime())?'Date unavailable':d.toLocaleString(undefined,{month:'short',day:'numeric',...(short?{year:'numeric'}:{hour:'2-digit',minute:'2-digit'})});}
export function exportCSV(filename:string,rows:(string|number|null)[][]){const cell=(v:string|number|null)=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function journeySave(body:Record<string,unknown>){const r=await fetch('/api/learning-journey',{method:'POST',headers:{'content-type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not save this result.');return d;}
export const stateLabel:Record<string,string>={not_started:'To do',overdue:'Overdue',returned:'Revise & resubmit',submitted:'Awaiting review',graded:'Graded',not_taken:'Not taken'};
