'use client';
import {useEffect,useRef} from 'react';
// Keep open learner screens current without interrupting answer fields.
export function useLearnerRefresh(enabled:boolean,refresh:()=>Promise<unknown>){
 const latest=useRef(refresh);latest.current=refresh;
 useEffect(()=>{if(!enabled)return;let active=true,running=false;const update=async()=>{if(!active||running||document.visibilityState==='hidden')return;running=true;try{await latest.current()}catch{/* Existing screens handle explicit request errors. */}finally{running=false}};const timer=window.setInterval(update,30000);window.addEventListener('focus',update);return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',update)}},[enabled]);
}
