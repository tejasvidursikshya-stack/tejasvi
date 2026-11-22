// Only the Tejasvi server and its local setup command import this module.
const base='https://public-api.gamma.app/v1.0/';
export const maxDeckBytes=20*1024*1024;
export const validTheme=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(id);
export const validJob=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(id);
const secret=key=>typeof key==='string'&&key.trim()!=='';
export class GammaError extends Error{
 constructor(text,status=502,ambiguous=false){super(text);this.status=status;this.ambiguous=ambiguous;this.campusPublic=true;}
}
function rejection(status,creating){
 if(status===401)return new GammaError('Gamma rejected its API key. Open Configure-AI.command → 4 — Gamma on the server, then restart Tejasvi.');
 if(status===403)return new GammaError('Gamma denied this request. Check that this Gamma workspace allows API access and the selected theme is available.');
 if(status===402)return new GammaError('Gamma has no credits available for this generation. Check credits in the connected Gamma workspace.');
 if(status===429)return new GammaError('Gamma reached a usage or rate limit. Check your Gamma workspace and try again later.',429);
 if(status===404)return new GammaError('Gamma could not find this resource for the current key. Check the connected Gamma workspace.');
 if(status===400||status===422)return new GammaError('Gamma rejected the presentation settings. Check the theme, then revise the brief before submitting again.');
 return new GammaError(creating?'Gamma did not confirm the submission. Check the connected Gamma account before creating another deck.':'Gamma is temporarily unavailable. Check this deck again later.',502,creating);
}
async function api(key,path,body){
 if(!secret(key))throw new GammaError('Gamma is not connected. Ask the platform Super Admin to configure a Gamma API key.',409);
 let r,b;try{r=await fetch(base+path,{method:body?'POST':'GET',headers:{'X-API-KEY':key.trim(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(body?20000:12000),cache:'no-store',redirect:'error'});}
 catch{throw new GammaError(body?'Gamma did not confirm the submission. Check Gamma before starting a new deck.':'Could not reach Gamma. Check the server connection and try again.',502,!!body);}
 if(!r.ok){if(r.status===403){const error=await r.json().catch(()=>null);if(/insufficient[_ ]credits|not enough credits/i.test([error?.code,error?.error?.code,error?.message].filter(x=>typeof x==='string').join(' ').slice(0,400)))throw rejection(402,!!body);}throw rejection(r.status,!!body);}
 try{b=await r.json();}catch{throw new GammaError('Gamma returned an incomplete response. Check the Gamma workspace before sending another request.',502,!!body);}
 return b;
}
export async function gammaThemes(key,custom=false){
 const b=await api(key,custom?'themes?limit=50&type=custom':'themes?limit=1');
 if(!Array.isArray(b?.data))throw new GammaError('Gamma did not confirm access to themes. Verify the connection again.');
 return {themes:b.data.filter(t=>validTheme(t?.id)&&typeof t.name==='string').map(t=>({id:t.id,name:t.name.slice(0,100)})),more:b.hasMore===true};
}
export function gammaURL(raw){
 if(typeof raw!=='string'||raw.length>8192)return '';try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='gamma.app'||u.hostname.endsWith('.gamma.app'))?u.href:'';}catch{return '';}
}
export async function submitGamma(key,brief,theme){
 const body={format:'presentation',textMode:'generate',inputText:'Presentation title: '+brief.title+'\nAudience: '+brief.audience+'\nTeaching brief:\n'+brief.notes,numCards:brief.cards,cardSplit:'auto',cardOptions:{dimensions:'16x9'},
  textOptions:{amount:'brief',audience:brief.audience,language:brief.language},imageOptions:{source:brief.images?'aiGenerated':'noImages'},exportAs:'pptx',
  additionalInstructions:'Make an instructor-led lesson. Start with an objective; explain key ideas with a concrete example, give learners a short practice task, and end with a recap. Do not invent sources or student records.',
  sharingOptions:{externalAccess:'noAccess',workspaceAccess:'noAccess'},...(theme?{themeId:theme}:{})};
 const b=await api(key,'generations',body);
 if(!validJob(b?.generationId))throw new GammaError('Gamma accepted the request but did not return a usable generation ID. Check Gamma before starting again.',502,true);
 return b.generationId;
}
export async function pollGamma(key,id){
 if(!validJob(id))throw new GammaError('This deck has no valid Gamma generation ID.',409);
 const b=await api(key,'generations/'+encodeURIComponent(id));
 if(b?.generationId!==id)throw new GammaError('Gamma did not confirm that this status belongs to the requested presentation. Check again later.');
 if(!['completed','failed','pending','processing','in_progress','queued'].includes(b?.status))throw new GammaError('Gamma returned an unfamiliar status. Check this same deck again without generating another.');
 const n=b.credits?.deducted;return {state:b.status==='completed'?'ready':b.status==='failed'?'failed':'pending',url:gammaURL(b.gammaUrl).slice(0,2048),exportURL:gammaURL(b.exportUrl),credits:Number.isInteger(n)&&n>=0&&n<=4294967295?n:null};
}
// Export reads use no API key, even when redirected. Unknown storage domains use the manual upload path.
function exportLink(raw){const url=gammaURL(raw);if(!url)return '';return ['gamma.app','www.gamma.app','exports.gamma.app','assets.api.gamma.app','assets.gamma.app','cdn.gamma.app'].includes(new URL(url).hostname)?url:'';}
export async function exportBytes(raw){
 let current=exportLink(raw);if(!current)throw new GammaError('No supported export link yet. Refresh the export or upload a reviewed PowerPoint from Gamma.');
 const signal=AbortSignal.timeout(20000);
 for(let i=0;i<=3;i++){
  const r=await fetch(current,{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',signal});
  if([301,302,303,307,308].includes(r.status)){const next=r.headers.get('location');await r.body?.cancel();current=next?exportLink(new URL(next,current).href):'';if(!current)break;continue;}
  if(!r.ok||!r.body||Number(r.headers.get('content-length'))>maxDeckBytes){await r.body?.cancel();break;}
  const reader=r.body.getReader(),parts=[];let total=0;for(;;){const x=await reader.read();if(x.done)break;total+=x.value.length;if(total>maxDeckBytes){await reader.cancel();throw new Error('File too large');}parts.push(x.value);}
  if(!total)break;return Buffer.concat(parts,total);
 }
 throw new GammaError('The PowerPoint could not be saved from Gamma. Export a .pptx from Gamma and upload it here (up to 20 MB).');
}
