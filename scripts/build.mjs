import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {cpSync,rmSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const [program,args] of [['vite/bin/vite.js',['build','--config','modules/emis/vite.config.mjs']],['next/dist/bin/next',['build','--webpack']]]){
 if(program==='next/dist/bin/next'){const out=join(root,'public/campus-ui/assets');rmSync(out,{recursive:true,force:true});cpSync(join(root,'build/emis/assets'),out,{recursive:true});} // EMIS assets as static files for serverless hosts
 const p=spawnSync(process.execPath,[join(root,'node_modules',program),...args],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit'});if(p.status!==0)process.exit(p.status||1);
}
