import {AppError} from './errors';
import {isResourceId,liveAvatarSettings} from './liveavatar-config.mjs';
import {providerRequest,readResource,readAvatar,resolveVoice} from './liveavatar-resources.mjs';
function verifiedSettings(){
 const s=liveAvatarSettings();const fix=' Run Configure-AI.command in the installed Tejasvi folder, then restart Tejasvi.';
 if(!s.modeValid)throw new AppError('LiveAvatar mode is invalid; choose Sandbox or Live in the setup helper.'+fix,409);
 if(!s.key)throw new AppError('The LiveAvatar API key is missing.'+fix,409);
 for(const [name,v] of [['avatar',s.avatar],...(s.context?[['context',s.context]]:[])])if(!isResourceId(v))throw new AppError('The LiveAvatar '+name+' ID must be a UUID from LiveAvatar, not a name, URL or API key.'+fix,409);
 if(!s.validLimit)throw new AppError('LIVEAVATAR_MAX_SECONDS must be a whole number from 30 to 300, or be left unset. Restart after correcting it.',409);
 return s;
}
async function presenter(s:ReturnType<typeof verifiedSettings>){
 const av=await readAvatar(s);
 const [voice,context]=await Promise.all([resolveVoice(s,av),s.context?readResource(s.key,'contexts',s.context,'the configured context'):Promise.resolve(null)]);
 if(Array.isArray(context?.required_dynamic_variables)&&context.required_dynamic_variables.length)throw new AppError('This LiveAvatar context requires dynamic variables. Select a context that can start without them, then restart Tejasvi.',409);
 return voice;
}
export async function checkLiveAvatar(){
 const s=verifiedSettings(),voice=await presenter(s);
 let billing=s.sandbox?'Sandbox uses Wayne and does not consume live credits.':'Live credits were not verified.';
 if(!s.sandbox){
  let balance:unknown;try{balance=(await providerRequest(s.key,'users/credits','the live credit balance')).credits_left;}catch{/* Asset checks remain useful if this key cannot read billing. */}
  if((typeof balance==='number'||typeof balance==='string'&&balance.trim()!=='')&&Number.isFinite(Number(balance))){
   if(Number(balance)<=0)throw new AppError('Avatar and voice are accessible, but LiveAvatar reports no remaining live credits. Check provider billing or choose Sandbox for a test.',409);
   billing='The provider reports available live credit.';
  }
 }
 return {message:'The LiveAvatar key can read the selected avatar, voice'+(s.context?' and context':'')+'. '+voice.note+' '+billing+' No session was started. Playback is checked when you start a session.'};
}
export async function mintLiveAvatar(language:'English'|'Nepali'){
 const s=verifiedSettings(),voice=await presenter(s);
 const d=await providerRequest(s.key,'sessions/token','this session',{mode:'FULL',avatar_id:s.avatar,is_sandbox:s.sandbox,interactivity_type:'PUSH_TO_TALK',
  ...(!s.sandbox&&s.explicitLimit?{max_session_duration:s.seconds}:{}),avatar_persona:{voice_id:voice.id,...(s.context?{context_id:s.context}:{}),language:language==='Nepali'?'ne':'en'}});
 if(typeof d.session_token!=='string'||!d.session_token.trim())throw new AppError('LiveAvatar did not return a session token. Check the presenter connection and try again.',502);
 return {token:d.session_token,maxSeconds:s.seconds};
}
