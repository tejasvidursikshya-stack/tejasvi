import {z} from 'zod';
import {identity,membership,readJson,respond,failure,AppError} from '@/lib/platform-server';
import {aiAccess,providerFailure} from '@/lib/ai-access';
import {transaction,run} from '@/lib/db';
import {gammaThemes,validTheme} from '@/lib/gamma-client.mjs';
import {checkLiveAvatar} from '@/lib/liveavatar-provider';
import {throttle} from '@/lib/auth';
export const runtime='nodejs';export const dynamic='force-dynamic';
const uuid=z.string().uuid();
async function status(org:string,user:Awaited<ReturnType<typeof identity>>){
 const m=await membership(org,user.userId),s=await aiAccess(org,m.role),admin=m.role==='admin',canManage=admin&&user.platformAdmin;
 return {role:m.role,canManage,access:s.access,avatarMode:s.config.avatarMode,...(admin?{policy:s.policy,config:s.config}:{})};
}
export async function GET(req:Request){try{const u=await identity(),org=uuid.parse(new URL(req.url).searchParams.get('org'));return respond(await status(org,u));}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const u=await identity(),b=await readJson(req,2500),org=uuid.parse(b.orgId),before=await status(org,u);
 if(!before.canManage)throw new AppError('Only the platform Super Admin for this workspace can manage its AI access.',403);
 if(b.action==='check'){
  if(b.service==='gamma'){await throttle('gamma-check:'+u.userId,10);const result=await gammaThemes(process.env.GAMMA_API_KEY,true);return respond({...result,message:'Gamma accepted the key. No presentation was generated and no generation credits were used.'});}
  if(b.service==='avatar'){
   await throttle('avatar-check:'+u.userId,10);
   return respond(await checkLiveAvatar());
  }
  const kind=z.enum(['text','audio']).parse(b.service),c=before.config!,model=kind==='text'?c.textModel:c.audioModel;
  if(!c.key||!model)throw new AppError('Open Configure-AI.command on the server and restart Tejasvi first.',409);
  await throttle('ai-connection:'+u.userId,12);
  let r;try{r=await fetch('https://api.openai.com/v1/models/'+encodeURIComponent(model),{headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},signal:AbortSignal.timeout(12000),cache:'no-store'});}catch{throw new AppError('Could not reach OpenAI. Check the internet connection and try again.',502);}
  if(!r.ok)throw providerFailure(r.status);const result=await r.json();if(result.id!==model)throw new AppError('The provider did not confirm this model.',502);
  return respond({message:'The key can access '+model+'. This check did not generate content or check your remaining credit.'});
 }
 const d=z.object({action:z.literal('save'),staff:z.boolean(),learners:z.boolean(),narration:z.boolean(),avatar:z.boolean(),gamma:z.boolean().optional(),gammaTheme:z.string().max(160).optional()}).parse(b);
 if(d.gammaTheme&&!validTheme(d.gammaTheme))throw new AppError('Choose a valid Gamma theme ID or leave it blank.');
 await transaction(async c=>{await run('INSERT INTO ai_workspace_settings(org_id,staff_enabled,learner_enabled,narration_enabled,avatar_enabled,updated_by,gamma_enabled,gamma_theme_id) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE staff_enabled=?,learner_enabled=?,narration_enabled=?,avatar_enabled=?,updated_by=?,gamma_enabled=COALESCE(?,gamma_enabled),gamma_theme_id=CASE WHEN ? THEN ? ELSE gamma_theme_id END',[org,d.staff,d.learners,d.narration,d.avatar,u.userId,d.gamma||false,d.gammaTheme||null,d.staff,d.learners,d.narration,d.avatar,u.userId,d.gamma??null,d.gammaTheme!==undefined,d.gammaTheme||null],c);await run("INSERT INTO learning_audit(org_id,actor_id,action) VALUES(?,?,'ai-workspace-settings')",[org,u.userId],c);});
 return respond(await status(org,u));
}catch(e){return failure(e);}}
