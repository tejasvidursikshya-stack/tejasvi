import { roles, type RoleKey } from './platform-types';
// Resolve only the role stored in the database, never a client-supplied role.
export function loginDestination(member:{kind:string;role:string}|null,platformAdmin:boolean):string|null {
 if(member){const entry=Object.entries(roles).find(([,r])=>r.kind===member.kind&&r.role===member.role);if(entry)return `/workspace/${entry[0] as RoleKey}`;return null;}
 return platformAdmin?'/workspace/start':null;
}
