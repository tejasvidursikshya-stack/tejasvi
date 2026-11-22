import {createPool} from './pg-compat.mjs';
// PostgreSQL (Supabase) via DATABASE_URL. SQL is written with MySQL-style '?' placeholders; see lib/pg-compat.mjs.
type Value=string|number|boolean|Date|Buffer|null;
export type ResultHeader={affectedRows:number;insertId:number;changedRows:number;warningStatus:number};
export interface Connection{
 execute(sql:string,values?:unknown[]):Promise<[any,unknown?]>;
 query(sql:string,values?:unknown[]):Promise<[any,unknown?]>;
}
export interface PoolConnection extends Connection{beginTransaction():Promise<void>;commit():Promise<void>;rollback():Promise<void>;release():void}
export interface Pool extends Connection{getConnection():Promise<PoolConnection>;end():Promise<void>}
const state=globalThis as unknown as {tejasviPool?:Pool};
export function pool():Pool{
 if(!state.tejasviPool)state.tejasviPool=createPool({connectionLimit:10}) as unknown as Pool;
 return state.tejasviPool;
}
export type DB=Pool|PoolConnection;
export async function rows<T=Record<string,any>>(sql:string,values:Value[]=[],connection:DB=pool()):Promise<T[]>{const [result]=await connection.execute(sql,values);return result as T[]}
export async function one<T=Record<string,any>>(sql:string,values:Value[]=[],connection:DB=pool()):Promise<T|null>{return (await rows<T>(sql,values,connection))[0]||null}
export async function run(sql:string,values:Value[]=[],connection:DB=pool()):Promise<ResultHeader>{const [result]=await connection.execute(sql,values);return result as ResultHeader}
export async function transaction<T>(fn:(connection:PoolConnection)=>Promise<T>):Promise<T>{const connection=await pool().getConnection();try{await connection.beginTransaction();const value=await fn(connection);await connection.commit();return value}catch(e){await connection.rollback();throw e}finally{connection.release()}}
