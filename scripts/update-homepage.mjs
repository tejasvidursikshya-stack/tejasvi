import {createHash,randomUUID} from 'node:crypto';
import {createConnection} from 'node:net';
import {existsSync,readFileSync,writeFileSync,realpathSync,lstatSync,mkdirSync,copyFileSync,chmodSync,renameSync,unlinkSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const allowed=new Set([
 "Build-Android.command",
 "README.md",
 "START-HERE.txt",
 "Test-Android-USB.command",
 "android/.gitignore",
 "android/README.md",
 "android/app/build.gradle.kts",
 "android/app/src/debug/res/xml/network_security_config.xml",
 "android/app/src/main/AndroidManifest.xml",
 "android/app/src/main/java/com/tejasvi/campus/ApiClient.kt",
 "android/app/src/main/java/com/tejasvi/campus/CampusViewModel.kt",
 "android/app/src/main/java/com/tejasvi/campus/MainActivity.kt",
 "android/app/src/main/java/com/tejasvi/campus/ServerAddress.kt",
 "android/app/src/main/java/com/tejasvi/campus/SessionStore.kt",
 "android/app/src/main/res/drawable/ic_tejasvi.xml",
 "android/app/src/main/res/values/styles.xml",
 "android/app/src/main/res/xml/backup_rules.xml",
 "android/app/src/main/res/xml/file_paths.xml",
 "android/app/src/main/res/xml/network_security_config.xml",
 "android/app/src/test/java/com/tejasvi/campus/ApiClientTest.kt",
 "android/app/src/test/java/com/tejasvi/campus/ServerAddressTest.kt",
 "android/build.gradle.kts",
 "android/gradle/wrapper/gradle-wrapper.jar",
 "android/gradle/wrapper/gradle-wrapper.properties",
 "android/gradle.properties",
 "android/gradlew",
 "android/gradlew.bat",
 "android/pilot/Tejasvi-Android-Pilot.apk",
 "android/settings.gradle.kts",
 "app/api/mobile/v1/[...path]/route.ts",
 "app/api/platform/route.ts",
 "database/migrations/025_mobile_sessions.sql",
 "docs/android-pilot.html",
 "docs/android-validation.md",
 "lib/auth.ts",
 "lib/mobile-sessions.ts",
 "package-lock.json",
 "package.json"
]);
const read=p=>JSON.parse(readFileSync(p,'utf8'));
function safePath(base,rel){let at=base;for(const part of rel.split('/')){if(!part||part==='.'||part==='..')throw Error('Invalid update path.');at=join(at,part);try{if(lstatSync(at).isSymbolicLink())throw Error('Refusing to update a linked path: '+rel);}catch(e){if(e.code!=='ENOENT')throw e;}}return at;}
function replace(p,buf,mode=0o644){mkdirSync(dirname(p),{recursive:true});const temp=p+'.homepage-'+randomUUID()+'.tmp';try{writeFileSync(temp,buf,{flag:'wx',mode});chmodSync(temp,mode);renameSync(temp,p);}finally{if(existsSync(temp))unlinkSync(temp);}}
const busy=()=>new Promise(ok=>{const s=createConnection({host:'127.0.0.1',port:3000});s.setTimeout(1000);let done=false;function finish(v){if(done)return;done=true;s.destroy();ok(v);}s.once('connect',()=>finish(true));s.once('error',e=>finish(e.code!=='ECONNREFUSED'));s.once('timeout',()=>finish(true));});
export async function update(path){
 if(!path)throw Error('Select the existing Tejasvi-Campus project folder.');const dir=realpathSync(resolve(path));if(dir===realpathSync(here))throw Error('This is the new download. Choose the original project you normally run.');
 const pj=safePath(dir,'package.json');if(!existsSync(pj))throw Error('This folder does not contain Tejasvi Campus.');const pkg=read(pj);
 if(pkg.name!=='tejasvi-campus'||!['3.9.0','3.10.0'].includes(pkg.version)||!existsSync(safePath(dir,'database/migrations/017_integrated_campus.sql')))throw Error('This updater accepts Tejasvi Campus 3.9.0 or 3.10.0. Choose that configured installation. Older versions need a separately verified upgrade; no files were changed.');
 if(!existsSync(safePath(dir,'.env')))throw Error('This folder has not been configured. Choose your installed Campus folder, or use Start-Tejasvi.command in the new download for a fresh installation.');
 const files=read(join(here,'scripts/homepage-update.json'));if(!Array.isArray(files)||files.length!==allowed.size||new Set(files.map(f=>f.path)).size!==allowed.size||files.some(f=>!allowed.has(f.path)))throw Error('Incomplete update bundle. Download it again.');
 const plan=[];for(const f of files){const src=safePath(here,f.path),dest=safePath(dir,f.path),bytes=readFileSync(src);if(hash(bytes)!==f.after)throw Error('The new source is different from the release: '+f.path);const present=existsSync(dest);if(present&&!lstatSync(dest).isFile())throw Error('Expected a file: '+f.path);const previous=present?readFileSync(dest):null,old=previous?hash(previous):null;if(old===f.after)continue;if(!f.before||!Object.hasOwn(f.before,pkg.version)||old!==f.before[pkg.version])throw Error('Local changes found in '+f.path+'. No files were changed. Keep that work and merge this file manually.');plan.push({path:f.path,dest,bytes,previous,mode:present?lstatSync(dest).mode&0o777:(f.path.endsWith('.command')||f.path==='android/gradlew')?0o755:0o644});}
 if(!plan.length)return {changed:false};if(await busy())throw Error('Port 3000 is in use. Stop the running app (Control+C), then run this update again.');
 const backup=safePath(dir,'.tejasvi-updates/campus-3.10.0-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));mkdirSync(backup,{recursive:true,mode:0o700});const done=[];
 const marker=safePath(dir,'.next/BUILD_ID'),markerBackup=join(backup,'previous-BUILD_ID');let moved=false;
 // The dependency graph has not changed. Refresh only a previously verified installer stamp.
 const lock=files.find(f=>f.path==='package-lock.json'),stamp=safePath(dir,'node_modules/.tejasvi-installed');
 if(plan.some(f=>f.path==='package-lock.json')&&existsSync(stamp)&&lstatSync(stamp).isFile()){const prev=readFileSync(stamp);if(hash(prev)===lock.before?.[pkg.version])plan.push({path:'node_modules/.tejasvi-installed',dest:stamp,bytes:readFileSync(join(here,'package-lock.json')),previous:prev,mode:lstatSync(stamp).mode&0o777});}
 try{
  for(const f of plan){if(f.previous){const path=join(backup,f.path);mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path,f.previous,{mode:f.mode,flag:'wx'});}}
  writeFileSync(join(backup,'update-log.json'),JSON.stringify({version:'3.10.0',files:plan.map(f=>({path:f.path,previouslyPresent:!!f.previous}))},null,2)+'\n',{mode:0o600});
  if(existsSync(marker)){if(!lstatSync(marker).isFile())throw Error('Unexpected build marker.');renameSync(marker,markerBackup);moved=true;}
  for(const f of plan){replace(f.dest,f.bytes,f.mode);done.push(f);}
 }catch(e){for(const f of done.reverse()){if(f.previous)replace(f.dest,f.previous,f.mode);else if(existsSync(f.dest))unlinkSync(f.dest);}if(moved)renameSync(markerBackup,marker);throw e;}
 return {changed:true,backup};
}
if(resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){try{const result=await update(process.argv[2]);console.log(result.changed?'Tejasvi Campus updated. Previous source files: '+result.backup:'This installation already has this update.');console.log('Open Start-Tejasvi.command in your existing folder. After the build, visit http://localhost:3000/');}catch(e){console.error('Tejasvi Campus update: '+(e.code==='ENOENT'?'That folder or a release file was not found.':e.message));process.exitCode=1;}}
