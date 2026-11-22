import { one } from './db';
import { roles, type RoleKey } from './platform-types';
import { AppError } from './errors';
export { AppError, respond, failure, readJson, checkWrite, boundedBody } from './errors';
export { identity } from './auth';
export async function membership(orgId:string,userId:string){const row=await one<{id:string;name:string;kind:string;role:string}>('SELECT o.id,o.name,o.kind,m.role FROM organizations o JOIN memberships m ON o.id=m.org_id WHERE o.id=? AND m.user_id=?',[orgId,userId]);if(row?.role==='parent')throw new AppError('This role is no longer available. Contact your administrator.',403);if(!row)throw new AppError('You do not have access to this organization.',403);return row}
export function canEdit(m:{kind:string;role:string}){if(m.role!=='admin'&&!(['school','college','edtech'].includes(m.kind)&&m.role==='teacher'))throw new AppError('Only administrators and teachers can change learning content.',403)}
export function requireAdmin(m:{role:string}){if(m.role!=='admin')throw new AppError('Administrator access is required.',403)}
export function checkRole(value:string):RoleKey{if(!Object.hasOwn(roles,value))throw new AppError('Choose a valid workspace.');return value as RoleKey}
export function jsonValue(value:unknown){return typeof value==='string'?JSON.parse(value):value}
