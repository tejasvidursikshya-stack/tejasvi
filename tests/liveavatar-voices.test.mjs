// Isolated tests: these run without provider keys, billing or a MySQL server.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {parse} from 'dotenv';
import {liveAvatarSettings,sandboxAvatarId} from '../lib/liveavatar-config.mjs';
import {resolveVoice,voicePage,readAvatar} from '../lib/liveavatar-resources.mjs';
import {chooseVoice,saveValues} from '../scripts/configure-ai.mjs';
const stale='c124030a-5c85-4d7a-8618-a4615f788ac9',good='11111111-2222-4333-8444-555555555555',custom='87654321-2222-4833-8412-552515523525';
const av={id:sandboxAvatarId,default_voice:{id:good,name:'Provider default'}},settings={key:'test-only',sandbox:true,voice:stale,avatar:sandboxAvatarId};
const ok=data=>Response.json({code:1000,data});
function setup(t,route){
 const requests=[];t.mock.method(globalThis,'fetch',async (raw,init)=>{
  const u=new URL(raw);assert.equal(u.origin,'https://api.liveavatar.com');assert.equal(init.method,'GET');assert.equal(init.headers['X-API-KEY'],'test-only');assert.equal(init.redirect,'error');
  requests.push(u.pathname+u.search);return route(u);
 });return requests;
}
test('missing legacy Sandbox voice uses the same key to verify the actual avatar default',async t=>{
 const calls=setup(t,u=>u.pathname==='/v1/voices/'+stale?Response.json({code:404},{status:200}):u.pathname==='/v1/avatars/'+sandboxAvatarId?ok(av):ok({id:good,name:'Amber'}));
 const choice=await resolveVoice(settings,await readAvatar(settings));assert.equal(choice.id,good);assert.match(choice.note,/Wayne’s default voice: Amber/);
 assert.deepEqual(calls,['/v1/avatars/'+sandboxAvatarId,'/v1/voices/'+stale,'/v1/voices/'+good]);
});
test('explicit Live voice is never silently replaced and lookup rejects a mismatched ID',async t=>{
 const calls=setup(t,u=>u.pathname.endsWith(stale)?Response.json({},{status:404}):ok({id:good}));
 await assert.rejects(resolveVoice({...settings,sandbox:false},av),/saved live voice is unavailable/);
 await assert.rejects(resolveVoice({...settings,voice:custom},av),/did not confirm the requested ID/);assert.equal(calls.length,2);
});
test('automatic voice selection works with an empty setting; unusable defaults explain the next step',async t=>{
 const calls=setup(t,u=>u.pathname.endsWith(stale)?Response.json({},{status:404}):ok({id:good}));
 assert.equal((await resolveVoice({...settings,voice:''},av)).id,good);
 const missing={default_voice:null};await assert.rejects(resolveVoice({...settings,voice:'auto'},missing),/Choose from my voices/);
 await assert.rejects(resolveVoice(settings,{default_voice:{id:stale}}),/Choose from my voices/);assert.equal(calls.length,2);
});
test('auth, rate and service failures do not trigger fallback, guess a voice, or expose response data',async t=>{
 const statuses=[401,403,429,500,200,0],calls=setup(t,()=>{const status=statuses.shift();if(!status)throw Error('sensitive transport detail');return status===200?Response.json({code:777,message:'do not print'}):Response.json({message:'do not print'},{status})});
 for(let i=0;i<6;i++)await assert.rejects(resolveVoice(settings,av),e=>!e.message.includes('do not print')&&!e.message.includes('sensitive transport'));
 assert(calls.every(u=>u.endsWith(stale)));assert.equal(calls.length,6);
});
test('Mac picker browses both catalogs by page, verifies its selection, and preserves Live settings',async t=>{
 const calls=setup(t,u=>{
  if(u.pathname==='/v1/voices/'+custom)return ok({id:custom,name:'Samira'});
  assert.equal(u.pathname,'/v1/voices');assert.equal(u.searchParams.get('page_size'),'20');
  if(u.searchParams.get('voice_type')==='private')return ok({results:[{id:custom,name:'Samira',language:'ne'}],next:null});
  return ok({results:[],next:u.searchParams.get('page')==='1'?'https://untrusted.invalid/next':null});
 });
 const answers=['2','n','t','1'],notes=[];const chosen=await chooseVoice({ask:async()=>{assert(answers.length);return answers.shift();}},{...settings,saved:stale},s=>notes.push(s));
 assert.equal(chosen,custom);assert(notes.some(s=>s.includes('Samira · ne')));assert(!notes.join('').includes('test-only'));
 assert.deepEqual(calls,['/v1/voices?page=1&page_size=20&voice_type=public','/v1/voices?page=2&page_size=20&voice_type=public','/v1/voices?page=1&page_size=20&voice_type=private','/v1/voices/'+custom]);
 const dir=mkdtempSync(join(tmpdir(),'tejasvi-voice-'));try{
  const file=join(dir,'.env'),raw='LIVEAVATAR_VOICE_ID='+stale+'\nLIVEAVATAR_API_KEY=test-only\nDB_NAME=keep_this\n';writeFileSync(file,raw,{mode:0o600});
  saveValues(file,{LIVEAVATAR_SANDBOX_VOICE_ID:chosen},raw);const local=parse(readFileSync(file));
  assert.equal(liveAvatarSettings({...local,LIVEAVATAR_SANDBOX:'true'}).voice,custom);
  assert.equal(liveAvatarSettings({...local,LIVEAVATAR_SANDBOX:'false'}).voice,stale);assert.equal(local.DB_NAME,'keep_this');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('unlisted or missing default offers the picker; cancellation makes no provider change',async t=>{
 const calls=setup(t,u=>u.pathname.includes('avatars/')?ok({...av,default_voice:null}):ok({results:[],next:null}));
 const answers=['1','2','q'],say=[];await assert.rejects(chooseVoice({ask:async()=>{assert(answers.length);return answers.shift();}},{...settings,saved:stale},v=>say.push(v)),/cancelled/);assert.equal(calls.length,2);
 assert(say.some(x=>x.includes('no usable default')));assert(say.some(x=>x.includes('No selectable voices')));
});
test('voice inventory rejects malformed responses and invalid catalog parameters',async t=>{
 const calls=setup(t,()=>ok({results:{invalid:true}}));await assert.rejects(voicePage(settings.key),/did not return a voice list/);await assert.rejects(voicePage(settings.key,-1));await assert.rejects(voicePage(settings.key,1,'wrong'));assert.equal(calls.length,1);
});
