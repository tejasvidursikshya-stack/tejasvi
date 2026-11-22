// Read-only EMIS view for the Tejasvi mobile app. The caller is already
// authenticated by a mobile access token; access is resolved here with the same
// membership, role, scope and masking rules as the web EMIS bootstrap.
import {actorForUser} from './context.mjs';
import {MySQLDatabase} from './database.mjs';
import {Store} from './store.mjs';
import {modules,globalModules,groupOrder,can,scopeRecord,calculateIndicators,invoiceBalance,specFor,forKind} from '../shared/schema.mjs';
import {canViewInstitution,roleScope} from '../shared/access.mjs';
import {fail} from '../../../lib/campus-data.mjs';

const maskedRoles=['Faculty','Library','Finance Head','Research Head','Alumni Coordinator'];
const maskedKeys=['id','personId','year','version','sample','studentNo','name','programId','semester','batch','status','email','classId','rollNo','transport','lunch','hostel','routeId'];
/** Staff outside student services see only the directory fields they need. */
export function maskRecord(user,entity,row){
 if(entity==='students'&&maskedRoles.includes(user.role))return Object.fromEntries(maskedKeys.filter(k=>row[k]!==undefined).map(k=>[k,row[k]]));
 return row;
}
const MAX_ROWS=500;
const publicField=f=>({key:f.key,label:f.label,type:f.type,...(f.entity?{entity:f.entity}:{})});

export async function mobileEmis(pool,org,userId,requestedYear){
 const user=await actorForUser(pool,org,userId);
 const store=new Store(new MySQLDatabase(pool,org,null,user));
 const profile=await store.meta('profile');if(!profile)throw fail('This organization has no EMIS workspace.',403);
 const all=await store.all();
 const visible={};
 for(const entity of Object.keys(modules))if(can(user.role,entity)&&forKind(modules[entity],profile.kind))visible[entity]=all[entity].filter(r=>scopeRecord(user,entity,r,all)).map(r=>maskRecord(user,entity,r));
 const years=[...new Set([...(profile.years||[]),profile.year,...Object.values(visible).flat().map(r=>r.year)].filter(Boolean))].sort().reverse();
 const year=requestedYear&&years.includes(requestedYear)?requestedYear:profile.year||years[0];
 const records={},counts={},truncated=[];
 for(const [entity,rows] of Object.entries(visible)){
  const inYear=globalModules.includes(entity)?rows:rows.filter(r=>r.year===year);
  counts[entity]=inYear.length;records[entity]=inYear.slice(0,MAX_ROWS);if(inYear.length>MAX_ROWS)truncated.push(entity);
 }
 const balances=Object.fromEntries((records.fees||[]).map(i=>[i.id,invoiceBalance(i,visible.payments||[])]));
 const catalogue=Object.entries(modules).filter(([k])=>visible[k]).sort(([,a],[,b])=>groupOrder.indexOf(a.group)-groupOrder.indexOf(b.group))
  .map(([key])=>{const m=specFor(key,profile.kind);return {key,title:m.title,singular:m.singular,group:m.group,icon:m.icon,description:m.description,columns:m.columns,fields:m.fields.map(publicField),global:globalModules.includes(key)};});
 return {
  user:{name:user.name,email:user.email,role:user.role,scope:roleScope(user.role),studentId:user.studentId,facultyId:user.facultyId},
  institution:{name:profile.name,kind:profile.kind,year:profile.year,theme:profile.theme||null},
  year,years,modules:catalogue,records,counts,truncated,balances,
  indicators:canViewInstitution(user.role)?calculateIndicators(all,year):null,
 };
}
