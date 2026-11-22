import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const [program,args] of [['vite/bin/vite.js',['build','--config','modules/emis/vite.config.mjs']],['next/dist/bin/next',['build','--webpack']]]){
 const p=spawnSync(process.execPath,[join(root,'node_modules',program),...args],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:'inherit'});if(p.status!==0)process.exit(p.status||1);
}
