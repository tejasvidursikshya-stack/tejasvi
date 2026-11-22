import {verified,mysql,learning,newPassword,verifier,explain} from './common.mjs';
import {adapter} from './adapter.mjs';
import {prompts} from './prompts.mjs';
const p=prompts();let c;
try{const cfg=await verified();console.log('Assign a password in '+cfg.db.database+' only. Enter the email of an account you created in this app.');const email=(await p.ask('Existing account email')).toLowerCase();const pwd=await newPassword(p);c=await mysql.createConnection(cfg.db);await c.beginTransaction();await adapter.password(c,email,verifier(pwd),learning);await c.commit();console.log('Password assigned in this app.'+(learning?' The user must change it on next sign-in.':''));}
catch(e){if(c)await c.rollback();console.error(explain(e));process.exitCode=1;}finally{await c?.end();p.close();}
