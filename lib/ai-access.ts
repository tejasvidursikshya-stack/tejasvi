import {liveAvatarSettings} from './liveavatar-config.mjs';
import {one} from './db';
import {AppError} from './errors';
export type AIPolicy={staff:boolean;learners:boolean;narration:boolean;avatar:boolean;gamma:boolean;gammaTheme:string};
export const audioModel=()=>process.env.OPENAI_AUDIO_MODEL?.trim()||'gpt-audio-1.5';
export function wiring(){const av=liveAvatarSettings();return {gammaKey:!!process.env.GAMMA_API_KEY?.trim(),key:!!process.env.OPENAI_API_KEY?.trim(),textModel:process.env.OPENAI_MODEL?.trim()||'',audioModel:audioModel(),avatar:av.hasFields,avatarMode:av.sandbox?'sandbox' as const:'live' as const};}
export async function aiAccess(org:string,role:string){
 const row=await one('SELECT staff_enabled,learner_enabled,narration_enabled,avatar_enabled,gamma_enabled,gamma_theme_id FROM ai_workspace_settings WHERE org_id=?',[org]);
 const listed=(key:string)=>(process.env[key]||'').split(',').map(v=>v.trim()).includes(org);
 const policy:AIPolicy=row?{staff:!!row.staff_enabled,learners:!!row.learner_enabled,narration:!!row.narration_enabled,avatar:!!row.avatar_enabled,gamma:!!row.gamma_enabled,gammaTheme:row.gamma_theme_id||''}:{staff:listed('AI_ALLOWED_ORG_IDS'),learners:listed('AI_LEARNER_ORG_IDS'),narration:false,avatar:listed('LIVEAVATAR_ALLOWED_ORG_IDS'),gamma:false,gammaTheme:''};
 const config=wiring(),staff=['admin','teacher'].includes(role),learner=['student','employee'].includes(role);
 const allowed=policy.staff&&(staff||(learner&&policy.learners));
 return {policy,config,access:{gamma:!!(policy.staff&&policy.gamma&&staff&&config.gammaKey),text:!!(allowed&&config.key&&config.textModel),narration:!!(allowed&&staff&&policy.narration&&config.key),avatar:!!(allowed&&policy.avatar&&config.avatar&&config.key&&config.textModel)}};
}
export function providerFailure(status:number,name='OpenAI'){return new AppError(status===401?name+' rejected its API key. Ask the server owner to check the connection.':status===403||status===404?'The provider account cannot access the selected model or resource. Check the model and project permissions.':status===402||status===429?'The provider limit was reached. Check API credits and rate limits, then try again.':'The provider could not complete the request. Try again later.',502);}
