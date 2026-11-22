// Server and local setup only. Resource checks never request a session.
import {isResourceId} from './liveavatar-config.mjs';
const api='https://api.liveavatar.com/v1/';
const chooseVoice='Open Configure-AI.command → 2 — LiveAvatar → Choose from my voices, select a voice by name, then restart Tejasvi.';
export class LiveAvatarError extends Error{
 constructor(message,status=502,providerStatus=0){super(message);this.name='LiveAvatarError';this.status=status;this.providerStatus=providerStatus;this.campusPublic=true;}
}
function rejection(status,label,reason){
 if(status===401)return 'LiveAvatar rejected the server API key. Re-enter the LiveAvatar key in Configure-AI.command and restart Tejasvi.';
 if(status===403)return 'This LiveAvatar key does not have permission for '+label+'. Check the provider account and its resources.';
 if(status===402||/insufficient.*credit|not enough credit|out of credit/i.test(reason))return 'LiveAvatar reports insufficient credit for this request. Check provider billing or use Sandbox.';
 if(status===429||/concurrent|concurrency/i.test(reason))return 'LiveAvatar reached a rate or session limit. End any other presenter session and retry later.';
 if(status===404)return 'LiveAvatar could not find '+label+' for this key.'+(label==='the selected voice'?'':' Check the selected resource in Configure-AI.command.');
 if(/duration/i.test(reason))return 'LiveAvatar rejected the duration. Lower LIVEAVATAR_MAX_SECONDS or leave it unset, then restart.';
 if(/language/i.test(reason))return 'LiveAvatar rejected this language for the selected voice. Try a supported language or select a compatible voice.';
 if(label==='this session'&&/voice/i.test(reason))return 'LiveAvatar rejected the voice when preparing the session. '+chooseVoice;
 if(label==='this session'&&(status===400||status===422))return 'LiveAvatar rejected the token settings. Open Tejasvi AI → Connections → Check LiveAvatar setup.';
 return 'LiveAvatar could not verify '+label+' (HTTP '+status+'). Try again after checking the provider settings.';
}
/** @param {string} key @param {string} path @param {string} label @param {Record<string,unknown>} [body] */
export async function providerRequest(key,path,label,body){
 let r;try{r=await fetch(api+path,{method:body?'POST':'GET',headers:{'X-API-KEY':key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(body?20000:8000),cache:'no-store',redirect:'error'});}
 catch{throw new LiveAvatarError('Could not reach LiveAvatar to check '+label+'. Check the server’s internet connection and retry.');}
 const b=await r.json().catch(()=>null),reason=typeof b?.message==='string'?b.message:'';
 if(!r.ok)throw new LiveAvatarError(rejection(r.status,label,reason),502,r.status);
 if(b?.code!=null&&b.code!==100&&b.code!==1000){const n=Number(b.code);if([400,401,402,403,404,422,429].includes(n))throw new LiveAvatarError(rejection(n,label,reason),502,n);throw new LiveAvatarError('LiveAvatar did not confirm '+label+'. Try the provider check again.');}
 if(!b?.data||typeof b.data!=='object')throw new LiveAvatarError('LiveAvatar returned an incomplete response for '+label+'. Try the provider check again.');
 return b.data;
}
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
// Only a short display name or language is ever shown from a provider response.
export function displayText(value){return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,72):'';}
export async function readResource(key,kind,id,label){
 if(!['avatars','voices','contexts'].includes(kind)||!isResourceId(id))throw new LiveAvatarError('The '+label+' must have a UUID from LiveAvatar. Check Configure-AI.command.',409);
 const item=await providerRequest(key,kind+'/'+encodeURIComponent(id),label);
 if(!same(item.id,id))throw new LiveAvatarError('LiveAvatar did not confirm the requested ID for '+label+'. Run the setup check again.');
 return item;
}
export async function readAvatar(s){
 const av=await readResource(s.key,'avatars',s.avatar,s.sandbox?'the Wayne sandbox avatar':'the configured avatar');
 if(av.is_expired===true)throw new LiveAvatarError('The configured LiveAvatar has expired. Choose an active avatar in your provider account.',409);
 return av;
}
export async function readVoice(key,id){return readResource(key,'voices',id,'the selected voice');}
const notFound=e=>e instanceof LiveAvatarError&&e.providerStatus===404;
export async function resolveVoice(s,av){
 const automatic=!s.voice||s.voice.toLowerCase()==='auto';let fallback=false;
 if(!automatic){
  if(!isResourceId(s.voice))throw new LiveAvatarError('The saved voice is not a LiveAvatar voice ID. '+chooseVoice,409);
  try{const voice=await readVoice(s.key,s.voice);return {id:voice.id,note:'Verified voice: '+(displayText(voice.name)||'your selected voice')+'.'};}
  catch(e){if(!notFound(e))throw e;if(!s.sandbox)throw new LiveAvatarError('The saved live voice is unavailable to this key. '+chooseVoice,409);fallback=true;}
 }
 const id=av.default_voice?.id;
 if(!isResourceId(id)||(fallback&&same(id,s.voice)))throw new LiveAvatarError((fallback?'The saved Sandbox voice is unavailable and Wayne has no other verified default.':'This avatar has no usable default voice for this key.')+' '+chooseVoice,409);
 let voice;try{voice=await readVoice(s.key,id);}catch(e){if(!notFound(e))throw e;throw new LiveAvatarError('The avatar’s default voice is unavailable to this key. '+chooseVoice,409);}
 const name=displayText(voice.name)||displayText(av.default_voice?.name)||'the provider default';
 return {id:voice.id,note:(fallback?'The saved voice is unavailable. Sandbox will use Wayne’s default voice: ':'Using the avatar’s default voice: ')+name+'.'};
}
// Use our fixed origin even when the API returns absolute pagination links.
export async function voicePage(key,page=1,type='public'){
 if(!['public','private'].includes(type)||!Number.isSafeInteger(page)||page<1)throw new LiveAvatarError('Choose a valid voice page.',400);
 const d=await providerRequest(key,'voices?page='+page+'&page_size=20&voice_type='+type,'the voice library');
 if(!Array.isArray(d.results))throw new LiveAvatarError('LiveAvatar did not return a voice list. No settings were changed.');
 const voices=d.results.filter(v=>isResourceId(v?.id)).map(v=>({id:v.id,name:displayText(v.name)||'Unnamed voice',language:displayText(v.language)}));
 return {voices,hasNext:typeof d.next==='string'&&!!d.next.trim()};
}
