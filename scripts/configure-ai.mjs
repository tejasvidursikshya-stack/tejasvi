// LiveAvatar choices use read-only lookups. No provider session is started.
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync,lstatSync,chmodSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'dotenv';
import {gammaThemes} from '../lib/gamma-client.mjs';
import {prompts} from './prompts.mjs';
import {isResourceId,sandboxAvatarId} from '../lib/liveavatar-config.mjs';
import {LiveAvatarError,voicePage,readVoice,readAvatar,resolveVoice,displayText} from '../lib/liveavatar-resources.mjs';
const keys=new Set(['GAMMA_API_KEY','OPENAI_API_KEY','OPENAI_MODEL','OPENAI_AUDIO_MODEL','LIVEAVATAR_API_KEY','LIVEAVATAR_AVATAR_ID','LIVEAVATAR_VOICE_ID','LIVEAVATAR_SANDBOX_VOICE_ID','LIVEAVATAR_CONTEXT_ID','LIVEAVATAR_SANDBOX']);
export function saveValues(file,patch,original){
 if(!lstatSync(file).isFile()||lstatSync(file).isSymbolicLink())throw Error('The settings file must be a regular file.');
 if(readFileSync(file,'utf8')!==original)throw Error('Your settings changed while this helper was open. Run it again.');
 for(const [k,v] of Object.entries(patch))if(!keys.has(k)||typeof v!=='string'||v.length>512||(!(k==='LIVEAVATAR_CONTEXT_ID'&&v==='')&&!/^[A-Za-z0-9_./:=+-]+$/.test(v)))throw Error('Unexpected characters or length in '+k+'. No settings were changed.');
 // Match dotenv's assignment forms, replacing every occurrence for keys touched.
 const pending={...patch};const lines=original.split(/\r?\n/).flatMap(l=>{const m=l.match(/^\s*(?:export\s+)?([\w]+)\s*(?:=|:\s)/);if(!m||!(m[1] in patch))return [l];if(!(m[1] in pending))return [];const k=m[1];delete pending[k];return [k+'='+patch[k]];});
 const text=lines.join('\n').replace(/\n*$/,'\n')+Object.entries(pending).map(([k,v])=>k+'='+v+'\n').join('');
 const before=parse(original),after=parse(text);
 for(const k of new Set([...Object.keys(before),...Object.keys(after)]))if(k in patch?after[k]!==patch[k]:after[k]!==before[k])throw Error('Settings use a format this helper cannot update safely. No settings were changed.');
 const temp=file+'.ai-'+randomUUID()+'.tmp';try{writeFileSync(temp,text,{flag:'wx',mode:0o600});chmodSync(temp,0o600);renameSync(temp,file);}finally{if(existsSync(temp))unlinkSync(temp);}
}
export async function chooseVoice(p,{key,avatar,sandbox,saved},say=console.log){
 const owner=sandbox?'Wayne':'the avatar',explicit=isResourceId(saved);
 const stop=()=>{throw Error('Setup cancelled. No settings were changed.');};
 for(;;){
  say('\nPresenter voice · read-only check with your LiveAvatar key; no video or credit is used.');
  say('1  Use '+owner+'’s default voice\n2  Choose from my voices'+(explicit?'\n3  Keep my saved voice':'')+'\n4  Enter a LiveAvatar voice ID\nQ  Cancel without saving');
  const choice=(await p.ask('Choose a voice option',explicit&&!sandbox?'3':'1')).toLowerCase();
  if(choice==='q')stop();
  try{
   if(choice==='1'){
    const s={key,avatar,sandbox,voice:'auto'};let av;try{av=await readAvatar(s);}catch(e){throw Error(e.message);}
    const result=await resolveVoice(s,av);
    say(result.note);return 'auto';
   }
   if(choice==='3'&&explicit){const v=await readVoice(key,saved);say('Verified: '+(displayText(v.name)||'saved voice')+'.');return v.id;}
   if(choice==='4'){const id=await p.ask('LiveAvatar voice UUID (Return to go back)');if(!id)continue;if(!isResourceId(id)){say('A LiveAvatar voice UUID has 36 characters including dashes. You can also choose a voice by name.');continue;}const v=await readVoice(key,id);say('Verified: '+(displayText(v.name)||'selected voice')+'.');return v.id;}
   if(choice!=='2'){say('Choose one of the options shown.');continue;}
   let page=1,type='public';
   for(;;){
    const {voices,hasNext}=await voicePage(key,page,type);
    say('\nLiveAvatar '+type+' voices · page '+page);
    if(!voices.length)say('No selectable voices on this page. If the library is empty, add or bind a voice in this LiveAvatar account and try again.');
    voices.forEach((v,i)=>say((i+1)+'. '+v.name+(v.language?' · '+v.language:'')));
    const nav=(hasNext?'N next · ':'')+(page>1?'P previous · ':'')+'T show '+(type==='public'?'private':'public')+' voices · B back · Q cancel';
    const value=(await p.ask('Voice number, or '+nav)).toLowerCase();
    if(value==='q')stop();if(value==='b')break;
    if(value==='t'){type=type==='public'?'private':'public';page=1;continue;}
    if(value==='n'&&hasNext){page++;continue;}if(value==='p'&&page>1){page--;continue;}
    if(!/^[1-9][0-9]*$/.test(value)||Number(value)>voices.length){say('Choose a number or an available page option.');continue;}
    const selected=voices[Number(value)-1],voice=await readVoice(key,selected.id);
    say('Verified: '+(displayText(voice.name)||selected.name)+'.');return voice.id;
   }
  }catch(e){
   if(!(e instanceof LiveAvatarError))throw e;
   // Do not hide authorization, provider outages or rate limits by trying another voice.
   if(e.providerStatus!==404&&e.status!==409)throw e;
   say(e.providerStatus===404?'That voice is no longer available for this key. Choose from my voices.':e.message.split(' Open Configure-AI.command')[0]+' Choose from my voices.');
  }
 }
}
async function main(){
 if(Number(process.versions.node.split('.')[0])<24)throw Error('Open this command with Node 24 or newer.');
 const file=fileURLToPath(new URL('../.env',import.meta.url));if(!existsSync(file))throw Error('Open this command in the Tejasvi folder you actually run, after the first installation. Install an update using Update-Tejasvi.command first.');
 const raw=readFileSync(file,'utf8'),old=parse(raw);if(old.TEJASVI_EDITION!=='campus-v1')throw Error('Choose a configured Tejasvi Campus folder.');
 const p=prompts(),patch={};try{
 console.log('\nTejasvi AI · provider setup\nKeys are stored on this Mac and sent only to their provider. Never paste keys into chat.\n1  OpenAI: content, chat and narrated lessons\n2  LiveAvatar: optional interactive presenter\n3  OpenAI and LiveAvatar\n4  Gamma: AI presentations\n');
 const choice=await p.ask('Choose 1, 2, 3 or 4','1');if(!['1','2','3','4'].includes(choice))throw Error('Choose 1, 2, 3 or 4.');
 async function secret(k,label){const val=(await p.secret(label+(old[k]?' (Return to keep)':' (hidden)'))).trim();if(val)patch[k]=val;else if(!old[k])throw Error(label+' is required. No settings were saved.');}
 if(choice==='4'){
  console.log('In Gamma, open Settings and members → API keys. Copy your Gamma key and paste it at the hidden prompt. This check reads themes; it does not generate slides.');
  await secret('GAMMA_API_KEY','Gamma API key');const key=patch.GAMMA_API_KEY||old.GAMMA_API_KEY;
  if(key===old.OPENAI_API_KEY||key===old.LIVEAVATAR_API_KEY||/^sk-(proj-|svcacct-)/i.test(key))throw Error('This key belongs to a different provider. No settings were saved.');
  await gammaThemes(key);console.log('Gamma accepted the key.');
 }
 if(choice==='1'||choice==='3'){await secret('OPENAI_API_KEY','OpenAI project API key');patch.OPENAI_MODEL=await p.ask('Text model (Responses API)',old.OPENAI_MODEL||'gpt-4.1-mini');patch.OPENAI_AUDIO_MODEL=await p.ask('Audio model (Chat Completions audio)',old.OPENAI_AUDIO_MODEL||'gpt-audio-1.5');}
 if(choice==='2'||choice==='3'){
  await secret('LIVEAVATAR_API_KEY','LiveAvatar API key');
  const mode=(await p.ask('Use Sandbox (Wayne, up to one minute, no live credits)? yes/no',old.LIVEAVATAR_SANDBOX==='false'||(!old.LIVEAVATAR_SANDBOX&&old.LIVEAVATAR_AVATAR_ID)?'no':'yes')).toLowerCase();
  if(!['yes','no'].includes(mode))throw Error('Choose yes or no.');patch.LIVEAVATAR_SANDBOX=String(mode==='yes');
  if(mode==='yes')console.log('Sandbox will use Wayne ('+sandboxAvatarId+'). Any saved live avatar ID is kept.');
  const sandbox=mode==='yes',key=patch.LIVEAVATAR_API_KEY||old.LIVEAVATAR_API_KEY;
  let avatar=sandboxAvatarId;if(!sandbox){avatar=await p.ask('Live avatar UUID',old.LIVEAVATAR_AVATAR_ID||'');if(!isResourceId(avatar))throw Error('Enter a LiveAvatar avatar UUID. No settings were saved.');patch.LIVEAVATAR_AVATAR_ID=avatar;}
  const voiceKey=sandbox?'LIVEAVATAR_SANDBOX_VOICE_ID':'LIVEAVATAR_VOICE_ID';
  patch[voiceKey]=await chooseVoice(p,{key,avatar,sandbox,saved:old[voiceKey]||old.LIVEAVATAR_VOICE_ID||''});
  const context=await p.ask('Context UUID (optional; enter - to clear)',old.LIVEAVATAR_CONTEXT_ID||'');
  if(context==='-'||!context){if(old.LIVEAVATAR_CONTEXT_ID)patch.LIVEAVATAR_CONTEXT_ID='';}
  else{if(!isResourceId(context))throw Error('Enter a LiveAvatar context UUID or - to clear it. No settings were saved.');patch.LIVEAVATAR_CONTEXT_ID=context;}
 }
 saveValues(file,patch,raw);console.log('\nSaved. Restart Start-Tejasvi.command in this folder. Open Learning → Tejasvi AI → Connections as the platform Super Admin. Choose access for this organization and save.');}finally{p.close();}
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
