'use client';
import {useEffect,useRef,useState} from 'react';
import type {LiveAvatarSession} from '@heygen/liveavatar-web-sdk';

type State='idle'|'connecting'|'waiting'|'connected';
type Attempt={control:AbortController;live?:LiveAvatarSession;ticket?:string;starting?:boolean;started?:boolean;frame?:boolean;playing?:boolean;ready?:boolean;deadline?:ReturnType<typeof setTimeout>;expiry?:ReturnType<typeof setTimeout>;removeMedia?:()=>void};
function startupMessage(e:unknown){
 const code=Number((e as {status?:number})?.status),msg=e instanceof Error?e.message:'';
 if(code===402||/credit|billing/i.test(msg))return 'LiveAvatar could not start the video because of provider billing or credits. Ask the Super Admin to check the LiveAvatar account.';
 if(code===429||/concurren|rate limit/i.test(msg))return 'LiveAvatar has reached a session or rate limit. End any other session and try again.';
 if(code===401||code===403)return 'LiveAvatar denied the session. Ask the Super Admin to run Check LiveAvatar setup for this provider account.';
 if(code===400||code===404||code===422){
  if(/language/i.test(msg))return 'LiveAvatar rejected the language at session start. Try a language supported by this presenter voice.';
  if(/voice/i.test(msg))return 'LiveAvatar rejected the voice at session start. Ask your administrator to run Connections → Check LiveAvatar setup and choose an available voice.';
  return 'LiveAvatar rejected the request to start the room (HTTP '+code+'). Open Tejasvi AI → Connections → Check LiveAvatar setup. If it passes, check the selected language and presenter settings in LiveAvatar.';
 }
 return 'The browser could not connect to the LiveAvatar room. Check your network or VPN and allow the browser to finish any permission prompt, then try again.';
}
function stopSDK(live?:LiveAvatarSession){if(!live)return;try{live.voiceChat.stop();void live.stop().catch(()=>{});}catch{/* disposed */}}
export function useLiveAvatar(orgId:string,language:string){
 const video=useRef<HTMLVideoElement|null>(null),active=useRef<Attempt|null>(null);
 const [state,setState]=useState<State>('idle'),[error,setError]=useState(''),[speaking,setSpeaking]=useState(false),[audioBlocked,setAudioBlocked]=useState(false);
 function dispose(x:Attempt,cancelConnecting=false){
  if(active.current===x)active.current=null;
  clearTimeout(x.deadline);clearTimeout(x.expiry);x.control.abort();x.removeMedia?.();const el=video.current;
  if(el){el.pause();el.srcObject=null;el.muted=false;}
  stopSDK(x.live);
  // SDK stop() only acts on connected sessions. Explicitly release this attempt's
  // own ticket if a user leaves (or a timer fires) during a browser handshake.
  if(cancelConnecting&&x.starting&&!x.started&&x.ticket)void fetch('https://api.liveavatar.com/v1/sessions/stop',{method:'POST',headers:{Authorization:'Bearer '+x.ticket,'Content-Type':'application/json'},keepalive:true,redirect:'error'}).catch(()=>{});
 }
 function end(){const x=active.current;if(x)dispose(x,true);setState('idle');setSpeaking(false);setAudioBlocked(false);setError('');}
 useEffect(()=>()=>{if(active.current)dispose(active.current,true);},[orgId,language]);
 function finish(x:Attempt,message:string,cancelConnecting=false){if(active.current!==x)return;dispose(x,cancelConnecting);setState('idle');setSpeaking(false);setAudioBlocked(false);setError(message);}
 function interrupt(){if(active.current?.ready)try{active.current.live?.interrupt();}catch{}setSpeaking(false);}
 async function start(){
  if(active.current)return;const x:Attempt={control:new AbortController()};active.current=x;setAudioBlocked(false);setSpeaking(false);setError('');setState('connecting');
  const current=()=>active.current===x;const guard=(ms:number,msg:string)=>{clearTimeout(x.deadline);x.deadline=setTimeout(()=>finish(x,msg,true),ms);};
  guard(54000,'The Tejasvi server did not finish checking the voice and requesting a session token. Check Connections and retry.');
  let phase:'token'|'room'='token';
  try{
   const r=await fetch('/api/avatar',{method:'POST',headers:{'content-type':'application/json','x-tejasvi-request':'1'},body:JSON.stringify({orgId,language,confirm:true}),signal:x.control.signal}),d=await r.json();
   if(!current())return;if(!r.ok)throw Error(d.error||'Tejasvi could not create a LiveAvatar session token.');if(typeof d.token!=='string'||!d.token)throw Error('No LiveAvatar token was returned. Check the connection before retrying.');
   x.ticket=d.token;phase='room';guard(50000,'The LiveAvatar room did not finish connecting. Check the browser network and any microphone permission prompt; you can decline the microphone to type.');
   const {LiveAvatarSession,SessionEvent,AgentEventsEnum}=await import('@heygen/liveavatar-web-sdk');if(!current())return;
   const live=new LiveAvatarSession(d.token,{voiceChat:{defaultMuted:true},autoKeepAlive:true});x.live=live;
   const el=video.current;if(!el)throw Error('No video element.');
   const ready=()=>{if(!current()||x.ready||!x.started||!x.frame||!el.videoWidth||el.readyState<2)return;x.ready=true;clearTimeout(x.deadline);setState('connected');};
   for(const ev of ['playing','loadeddata','canplay','resize'])el.addEventListener(ev,ready);
   x.removeMedia=()=>{for(const ev of ['playing','loadeddata','canplay','resize'])el.removeEventListener(ev,ready);};
   async function attach(){if(!current()||!el)return;live.attach(el);if(!el.srcObject)return;x.frame=true;ready();if(x.playing)return;x.playing=true;
    try{await el.play();}catch{if(!current())return;setAudioBlocked(true);el.muted=true;try{await el.play();}catch{/* A user gesture can resume playback. */}}finally{x.playing=false;ready();}
   }
   live.on(SessionEvent.SESSION_STREAM_READY,()=>{void attach();});
   live.on(AgentEventsEnum.AVATAR_SPEAK_STARTED,()=>{if(current())setSpeaking(true);});live.on(AgentEventsEnum.AVATAR_SPEAK_ENDED,()=>{if(current())setSpeaking(false);});
   live.on(SessionEvent.SESSION_DISCONNECTED,(reason)=>{if(!current())return;
    // The SDK emits SESSION_START_FAILED immediately before rejecting start().
    // Preserve the more useful provider error from that rejection.
    if(!x.started&&String(reason)==='SESSION_START_FAILED')return;
    finish(x,x.ready?'The presenter session ended. You can start another session.':'The provider disconnected before the video was ready. Check LiveAvatar setup and retry.');
   });
   x.starting=true;await live.start();x.started=true;live.voiceChat.stop();
   if(!current()){stopSDK(live);return;}setState('waiting');guard(20000,'The room connected, but no presenter video arrived. Check that the browser/network allows WebRTC media and try again.');
   const limits=[Number(d.maxSeconds)||120,Number(live.maxSessionDuration)||300];x.expiry=setTimeout(()=>finish(x,'The presenter reached its session time limit. Start a new session to continue.'),Math.max(1,Math.min(...limits))*1000);
   await attach();ready();
  }catch(e){if(!current())return;finish(x,phase==='room'?startupMessage(e):e instanceof Error&&e.name!=='TypeError'&&e.name!=='SyntaxError'?e.message:'Could not reach the Tejasvi presenter service. Refresh and sign in again if needed.');}
 }
 function repeat(text:string){const x=active.current;if(!x?.ready||!x.live)throw Error('Wait until the presenter video is ready.');x.live.interrupt();x.live.repeat(text.slice(0,4000));}
 async function enableAudio(){const x=active.current,el=video.current;if(!x||!el)return;try{el.muted=false;await el.play();if(active.current===x){setAudioBlocked(false);setError('');}}catch{if(active.current===x){el.muted=true;setAudioBlocked(true);setError('Playback is blocked. Allow sound for this site and try again.');}}}
 return {video,state,error,speaking,audioBlocked,start,end,repeat,interrupt,enableAudio};
}
