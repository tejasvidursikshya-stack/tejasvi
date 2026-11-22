// Sandbox constraints: https://docs.liveavatar.com/docs/sandbox-mode
export const sandboxAvatarId = 'dd73ea75-1218-4ef3-92ce-606d5f7fbc0a';
export const isResourceId = (/** @type {string} */ value) => typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function liveAvatarSettings(env = process.env){
 const read=(/** @type {string} */ k)=>(env[k]||'').trim();
 const flag=read('LIVEAVATAR_SANDBOX').toLowerCase(),sandbox=flag==='true',modeValid=flag===''||flag==='true'||flag==='false';
 const key=read('LIVEAVATAR_API_KEY'),avatar=sandbox?sandboxAvatarId:read('LIVEAVATAR_AVATAR_ID'),voice=(sandbox&&read('LIVEAVATAR_SANDBOX_VOICE_ID'))||read('LIVEAVATAR_VOICE_ID'),context=read('LIVEAVATAR_CONTEXT_ID');
 const limit=read('LIVEAVATAR_MAX_SECONDS'),seconds=Number(limit),validLimit=!limit||(/^\d+$/.test(limit)&&Number.isInteger(seconds)&&seconds>=30&&seconds<=300);
 return {sandbox,key,avatar,voice,context,modeValid,validLimit,hasFields:!!(key&&avatar),explicitLimit:!!limit,seconds:sandbox?Math.min(60,validLimit&&limit?seconds:60):validLimit&&limit?seconds:120};
}
