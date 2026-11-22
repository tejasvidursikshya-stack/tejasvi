// Local lesson-film renderer. Audio is mixed from reviewed recordings only; no microphone capture.
export type MovieScene={title:string;body:string;audio?:string};
export function movieSupport(){return typeof window!=='undefined'&&typeof MediaRecorder!=='undefined'&&typeof HTMLCanvasElement.prototype.captureStream==='function';}
export async function makeLessonMovie(scenes:MovieScene[],narrated:boolean,signal:AbortSignal,progress:(p:number)=>void){
 if(!movieSupport()||!scenes.length)throw Error('Video export needs a browser with canvas recording, such as desktop Chrome.');signal.throwIfAborted();
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;const pen=canvas.getContext('2d');if(!pen)throw Error('Canvas is unavailable.');const c=pen;
 let ac:AudioContext|undefined,stream:MediaStream|undefined,dest:MediaStreamAudioDestinationNode|undefined,rec:MediaRecorder|undefined,timer=0;const sources:AudioBufferSourceNode[]=[];
 const buffers:AudioBuffer[]=[];const duration:number[]=[];const starts:number[]=[];let total=0;
 function lines(text:string,max:number,font:string){c.font=font;const out:string[]=[];let line='';for(const word of text.trim().split(/\s+/u)){if(line&&c.measureText(line+' '+word).width>max){out.push(line);line='';}if(c.measureText(word).width>max){for(const ch of Array.from(word)){if(line&&c.measureText(line+ch).width>max){out.push(line);line='';}line+=ch;}}else line+=(line?' ':'')+word;}if(line)out.push(line);return out;}
 try{
  if(narrated){if(typeof AudioContext==='undefined')throw Error('This browser cannot mix audio into a video. Download the WAV or use desktop Chrome.');ac=new AudioContext();await ac.resume();if(ac.state!=='running')throw Error('Allow audio playback here, then try again.');dest=ac.createMediaStreamDestination();}
  for(const s of scenes){signal.throwIfAborted();let sec=0;if(ac){if(!s.audio)throw Error('Generate or select a recording for every scene.');const r=await fetch(s.audio,{signal,cache:'no-store'});if(!r.ok)throw Error('Could not open a recording. Sign in again or choose another clip.');const b=await ac.decodeAudioData(await r.arrayBuffer());signal.throwIfAborted();buffers.push(b);sec=b.duration+.16;}else sec=Math.max(3.5,Math.min(38,s.body.trim().split(/\s+/u).length/2.8));starts.push(total);duration.push(sec);total+=sec;}
  const pages=scenes.map(s=>({heads:lines(s.title,1050,'bold 45px sans-serif').slice(0,3),lines:lines(s.body,1050,'32px sans-serif')}));
  function paint(sec:number){let index=starts.findLastIndex(v=>v<=sec);if(index<0)index=0;const part=pages[index],f=Math.min(.99999,Math.max(0,(sec-starts[index])/duration[index])),page=Math.floor(f*Math.max(1,Math.ceil(part.lines.length/5)));
   const g=c.createLinearGradient(0,0,1280,720);g.addColorStop(0,'#071e38');g.addColorStop(1,['#234d76','#3c436d','#234e66'][index%3]);c.fillStyle=g;c.fillRect(0,0,1280,720);
   c.strokeStyle='#bed9ff2b';c.lineWidth=2;for(let k=0;k<5;k++){c.beginPath();c.ellipse(1225+f*12,90,135+k*39,100+k*40,-.45,0,Math.PI*2);c.stroke();}
   c.fillStyle='#ffb67a';c.fillRect(72,82,42,4);c.font='bold 19px sans-serif';c.fillText('TEJASVI  /  LESSON FILM',131,91);c.fillStyle='white';c.font='bold 45px sans-serif';part.heads.forEach((v,k)=>c.fillText(v,72,174+55*k));c.fillStyle='#ecf3ff';c.font='32px sans-serif';part.lines.slice(page*5,page*5+5).forEach((v,k)=>c.fillText(v,72,Math.max(269,210+55*part.heads.length)+k*46));
   c.fillStyle='#ffd4a8';c.font='20px sans-serif';c.fillText('SCENE '+String(index+1).padStart(2,'0')+' / '+String(scenes.length).padStart(2,'0')+(narrated?'     ·     AI-GENERATED VOICE':''),72,657);c.fillRect(0,710,1280*Math.min(1,sec/total),10);}
  paint(0);stream=canvas.captureStream(24);if(dest)stream.addTrack(dest.stream.getAudioTracks()[0]);
  const formats=narrated?['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4','video/webm']:['video/webm;codecs=vp9','video/webm;codecs=vp8','video/mp4','video/webm'];
  const mime=formats.find(m=>MediaRecorder.isTypeSupported(m));if(!mime)throw Error('No compatible encoder. Try another browser.');
  rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1600000,...(narrated?{audioBitsPerSecond:96000}:{})});const chunks:Blob[]=[];
  return await new Promise<{blob:Blob;ext:string}>((resolve,reject)=>{const recorder=rec!;let failed:Error|undefined;const stop=(why?:Error)=>{if(why)failed=why;if(recorder.state!=='inactive')recorder.stop();};
   const abort=()=>stop(new Error('Rendering cancelled. Your recordings are still saved.'));const visibility=()=>{if(document.hidden)stop(new Error('Rendering paused because the browser tab was hidden. Keep it visible and render again.'));};
   signal.addEventListener('abort',abort,{once:true});document.addEventListener('visibilitychange',visibility);
   const clear=()=>{clearInterval(timer);signal.removeEventListener('abort',abort);document.removeEventListener('visibilitychange',visibility);};
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=()=>stop(new Error('The browser encoder failed. Try a shorter lesson.'));
   recorder.onstop=()=>{clear();if(failed||!chunks.length)return reject(failed||Error('No video was recorded.'));progress(100);resolve({blob:new Blob(chunks,{type:recorder.mimeType||mime}),ext:mime.includes('mp4')?'mp4':'webm'});};
   try{signal.throwIfAborted();if(document.hidden)throw Error('Keep this browser tab visible while rendering.');recorder.start(200);const lead=.14,clock=()=>ac?ac.currentTime:performance.now()/1000,start=clock()+lead;
    if(ac&&dest)buffers.forEach((b,i)=>{const src=ac!.createBufferSource();src.buffer=b;src.connect(dest!);src.start(start+starts[i]);sources.push(src);});
    paint(0);progress(0);timer=window.setInterval(()=>{const t=Math.max(0,clock()-start);paint(Math.min(total-.001,t));progress(Math.min(99,Math.floor(t/total*100)));if(t>=total)stop();},1000/24);
   }catch(e){clear();if(recorder.state!=='inactive')recorder.stop();reject(e);}
  });
 }finally{clearInterval(timer);if(rec?.state==='recording')rec.stop();for(const s of sources){try{s.stop();s.disconnect();}catch{}}stream?.getTracks().forEach(t=>t.stop());dest?.stream.getTracks().forEach(t=>t.stop());if(ac&&ac.state!=='closed')await ac.close().catch(()=>{});}
}
