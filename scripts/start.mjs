import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,envFile,port,label,learning,kind,verified,explain} from './common.mjs';
import {setup} from './setup.mjs';
import {migrate} from './migrate.mjs';
const npm=process.platform==='win32'?'npm.cmd':'npm';
function task(program,args,env){return new Promise((done,fail)=>{const child=spawn(program,args,{cwd:root,stdio:'inherit',env,shell:process.platform==='win32'&&program===npm});const stop=()=>child.kill('SIGTERM');process.on('SIGTERM',stop);process.on('SIGINT',stop);child.once('error',fail);child.once('exit',(code,signal)=>{process.off('SIGINT',stop);process.off('SIGTERM',stop);if(code===0||signal==='SIGTERM'||signal==='SIGINT')done();else fail(Error(label+' exited with status '+code+'. See the error above.'));});});}
async function free(){const test=createServer();await new Promise((ok,no)=>{test.once('error',no);test.listen(port,'127.0.0.1',()=>test.close(ok));});}
try{
 if(Number(process.versions.node.split('.')[0])<24)throw Error('Install Node.js 24 (or newer), then run the launcher again.');
 const check=process.argv.includes('--check');if(!check)await free();
 if(!existsSync(envFile)){if(check)throw Error('Open the launcher to run first-time setup.');await setup();}
 const config=await verified(),env={...process.env,...config.env,NEXT_TELEMETRY_DISABLED:'1'};if(check){console.log(label+' is connected to '+config.db.database+'. Open '+config.origin+' when the launcher is running.');}else{
  await migrate(config.db,{quiet:true});
  const output=resolve(root,learning?'.next/BUILD_ID':'dist/index.html');
  if(!existsSync(output)||!existsSync(resolve(root,'build/emis/index.html'))){console.log('Preparing the app for this Mac. The first build can take a few minutes.');await task(npm,['run','build'],env);}
  const address=config.origin+(learning?'/login':'/');
  delete env.TEJASVI_FIRST_OWNER_KEY;
  if(config.firstOwner){
   env.TEJASVI_FIRST_OWNER_KEY=randomBytes(18).toString('hex');
   console.log('\nCreate your first Tejasvi Super Admin: '+address+'#setup='+env.TEJASVI_FIRST_OWNER_KEY+'\nOpen this private link on this Mac. It is valid until you create the account or stop the app.');
  }
  console.log('Open the Tejasvi homepage: '+config.origin+'/');
  console.log('Keep this window open. Press Control+C to stop this app.\n');
  await task(process.execPath,[resolve(root,'scripts/server.mjs')],env);
 }
}catch(e){console.error(explain(e));process.exitCode=1;}
