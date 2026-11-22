import {AsyncLocalStorage} from 'node:async_hooks';
import {actor} from './context.mjs';
export class MySQLDatabase{
 constructor(pool,org,auth,user){this.pool=pool;this.org=org;this.auth=auth;this.user=user;this.context=new AsyncLocalStorage();}
 connection(){return this.context.getStore()||this.pool;}
 prepare(sql){
  if(!sql.includes(':org'))throw Error('An EMIS query must explicitly specify its institution.');
  const execute=async(values)=>{let i=0;const params=[];const statement=sql.replace(/:org|\?/g,k=>{params.push(k===':org'?this.org:values[i++]);return '?';});if(i!==values.length)throw Error('Incorrect institution query arguments.');return (await this.connection().execute(statement,params))[0];};
  return {get:async(...v)=>(await execute(v))[0],all:async(...v)=>execute(v),run:async(...v)=>execute(v)};
 }
 async tx(fn){if(this.context.getStore())return fn();const c=await this.pool.getConnection();try{await c.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');await c.beginTransaction();await c.execute('SELECT id FROM organizations WHERE id=? FOR UPDATE',[this.org]);await c.execute('SELECT org_id FROM emis_campuses WHERE org_id=? FOR UPDATE',[this.org]);const current=await actor(c,this.org,this.auth);if(current.role!==this.user.role||current.studentId!==this.user.studentId||current.facultyId!==this.user.facultyId||current.programId!==this.user.programId)throw Object.assign(Error('Your role changed. Refresh the workspace.'),{status:403});const v=await this.context.run(c,fn);await c.commit();return v;}catch(e){await c.rollback();throw e;}finally{c.release();}}
 async health(){return {engine:'PostgreSQL',connected:true};}
}
