// Shared by Next Learning and the EMIS request handlers. All writes are on the caller's transaction.
import {randomUUID} from 'node:crypto';
import {normalizeAcademicYear,adYearOfBs,currentBsYear} from '../modules/emis/shared/bs.mjs';
export const educational=k=>k==='school'||k==='college';
export const json=v=>typeof v==='string'?JSON.parse(v):v;
export const one=async(c,q,v=[])=> (await c.execute(q,v))[0][0]||null;
export const many=async(c,q,v=[])=> (await c.execute(q,v))[0];
export const fail=(message,status=400)=>Object.assign(new Error(message),{status,campusPublic:true});
export const learningRole=r=>['Super Admin','Admin','Administrator'].includes(r)?'admin':r==='Student'?'student':r==='Faculty'?'teacher':'ops';
const date=()=>new Date().toISOString(),basicYear=()=>adYearOfBs(currentBsYear());
export async function createCampus(c,org,kind,academicYear){
 if(!educational(kind))return;
 const year=academicYear?normalizeAcademicYear(academicYear):basicYear();if(!year)throw fail('Enter the academic year in Bikram Sambat, for example 2083, or in AD as 2026/27.');
 await c.execute('INSERT INTO emis_campuses(org_id,profile) VALUES(?,?)',[org,JSON.stringify({year,years:[year],code:'',university:'',type:'',principal:'',currency:'NPR',attendanceThreshold:75})]);
}
export async function profile(c,org){const row=await one(c,'SELECT o.*,e.profile extra FROM emis_campuses e JOIN organizations o ON o.id=e.org_id WHERE e.org_id=?',[org]);if(!row||!educational(row.kind))return null;
 return {...json(row.extra),name:row.name,address:row.address,email:row.contact_email,phone:row.phone,registrationNumber:row.registration_number,theme:row.primary_color,kind:row.kind};}
export async function saveProfile(c,org,p){
 if(!p.name?.trim()||p.name.length>120||(p.email||'').length>254||(p.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))||(p.phone||'').length>40||(p.registrationNumber||'').length>100||(p.address||'').length>500)throw fail('Check the institution name, contact email, phone, registration number and address.');
 const extra={...p};for(const k of ['name','address','email','phone','registrationNumber','theme','kind'])delete extra[k];
 await c.execute('UPDATE organizations SET name=?,address=?,contact_email=?,phone=?,registration_number=?,primary_color=? WHERE id=?',[p.name,p.address||'',p.email||'',p.phone||'',p.registrationNumber||'',p.theme||'#063868',org]);
 await c.execute('UPDATE emis_campuses SET profile=? WHERE org_id=?',[JSON.stringify(extra),org]);
}
const dataJoin="SELECT m.*,u.name account_name,u.email,u.platform_admin,o.kind FROM institution_memberships m JOIN users u ON u.id=m.user_id JOIN organizations o ON o.id=m.org_id WHERE m.org_id=? AND m.user_id=?";
export async function currentEnrollment(c,org,id){
 const r=await one(c,"SELECT b.student_id FROM emis_student_links a JOIN emis_student_links b ON b.org_id=a.org_id AND b.person_id=a.person_id JOIN emis_records r ON r.org_id=b.org_id AND r.id=b.student_id JOIN emis_campuses e ON e.org_id=r.org_id WHERE a.org_id=? AND a.student_id=? AND r.year=e.profile->>'$.year' AND r.archived=0 ORDER BY r.created_at DESC,r.id LIMIT 1",[org,id]);return r?.student_id||id;
}
export async function syncMember(c,org,uid,options={}){
 const m=await one(c,dataJoin,[org,uid]);if(!m||!educational(m.kind)||m.role==='parent')return;
 const campus=await profile(c,org);if(!campus)throw fail('The institution workspace is not initialized.',409);
 const old=await one(c,'SELECT * FROM emis_roles WHERE org_id=? AND user_id=?',[org,uid]);
 const role=options.role||(old&&learningRole(old.role)===m.role?old.role:({admin:m.platform_admin?'Super Admin':'Admin',teacher:'Faculty',student:'Student'}[m.role]));
 if(!role||learningRole(role)!==m.role)throw fail('Choose an EMIS role compatible with this membership.');
 let student=null,person=null,faculty=null,program=null;const entity=role==='Student'?'students':role==='Faculty'?'faculty':null;
 if(role==='Program Director'){program=options.programId||old?.program_id;if(!program||!await one(c,"SELECT id FROM emis_records WHERE org_id=? AND id=? AND entity='programs' AND archived=0",[org,program]))throw fail('Choose a program in this institution.');}
 if(entity){
  const col=entity==='students'?'student_id':'faculty_id',key=entity==='students'?'studentNo':'employeeNo',sp=entity==='students'?(await one(c,'SELECT * FROM student_profiles WHERE org_id=? AND user_id=?',[org,uid])||{}):{};
  let id=options.recordId||old?.[col];const num=sp.admission_number||m.reference_number||'',name=m.display_name||m.account_name;
  if(!id){
   const candidates=await many(c,"SELECT id,data FROM emis_records WHERE org_id=? AND entity=? AND archived=0 AND (entity<>'students' OR year=?) AND (LOWER(data->>'$.email')=? OR (?<>'' AND JSON_UNQUOTE(JSON_EXTRACT(data,?))=?))",[org,entity,campus.year,m.email.toLowerCase(),num,'$.'+key,num]);
   if(candidates.length){const r=candidates[0],v=json(r.data);if(candidates.length!==1||!num||v[key]!==num||String(v.email||'').toLowerCase()!==m.email.toLowerCase())throw fail('A directory record already matches this person. In EMIS → Users & access, choose that record and assign its login.',409);id=r.id;}
  }
  if(id&&entity==='students')id=await currentEnrollment(c,org,id);
  let row=id?await one(c,'SELECT id,entity,year,data,archived FROM emis_records WHERE org_id=? AND id=?',[org,id]):null;
  if(id&&(!row||row.archived||row.entity!==entity))throw fail('Choose an active directory record from this institution.');
  if(row&&json(row.data).email&&String(json(row.data).email).toLowerCase()!==m.email.toLowerCase())throw fail('The shared account email must match the linked directory record.');
  if(row&&options.recordId&&json(row.data).status&&json(row.data).status!=='Active')throw fail('Choose a currently active directory record.');
  if(id&&await one(c,'SELECT user_id FROM emis_roles WHERE org_id=? AND '+col+'=? AND user_id<>?',[org,id,uid]))throw fail('This record already belongs to another account.',409);
  if(!row){
   id=randomUUID();const entry={name,email:m.email,[key]:num,status:'Active',year:campus.year};const now=date();
   await c.execute('INSERT INTO emis_records(org_id,id,entity,year,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',[org,id,entity,campus.year,JSON.stringify(entry),now,now]);
   if(entity==='students')await c.execute('INSERT INTO emis_student_links(org_id,student_id,person_id) VALUES(?,?,?)',[org,id,id]);
   row={data:entry};
  }
  if(entity==='students'){student=id;person=(await one(c,'SELECT person_id FROM emis_student_links WHERE org_id=? AND student_id=?',[org,id]))?.person_id;if(!person)throw fail('An enrollment identity is required.',409);if(await one(c,'SELECT user_id FROM emis_roles WHERE org_id=? AND student_person_id=? AND user_id<>?',[org,person,uid]))throw fail('This person already has a login in this institution.',409);}else faculty=id;
  if(options.fromDirectory)await writeLearningProfile(c,org,uid,entity,json(row.data));
  else{
   const v=json(row.data),next={...v,name,email:m.email};if(num)next[key]=num;
   if(sp.user_id)for(const [erp,lms] of Object.entries(fields)){if(sp[lms]!==null&&sp[lms]!==undefined)next[erp]=sp[lms] instanceof Date?sp[lms].toISOString().slice(0,10):sp[lms];}
   if(sp.user_id){const d=json(sp.details)||{};for(const k of extraProfileKeys)if(Object.hasOwn(d,k)){if(d[k])next[k]=d[k];else delete next[k];}}
   if(m.class_name&&!next.batch)next.batch=m.class_name;
   if(JSON.stringify(v)!==JSON.stringify(next))await c.execute('UPDATE emis_records SET data=?,version=version+1,updated_at=? WHERE org_id=? AND id=?',[JSON.stringify(next),date(),org,id]);
  }
 }
 await c.execute('INSERT INTO emis_roles(org_id,user_id,role,student_id,student_person_id,faculty_id,program_id) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role),student_id=VALUES(student_id),student_person_id=VALUES(student_person_id),faculty_id=VALUES(faculty_id),program_id=VALUES(program_id)',[org,uid,role,student,person,faculty,program]);
}
const extraProfileKeys=['nationality','permanentAddress','province','district'];
const fields={phone:'phone',address:'address',guardian:'guardian_name',guardianPhone:'guardian_phone',dob:'birth_date',admissionDate:'admission_date',gender:'gender'};
export async function writeLearningProfile(c,org,uid,entity,v){
 const [m]=await many(c,dataJoin,[org,uid]);if(!m)return;
 if(v.email&&String(v.email).toLowerCase()!==m.email.toLowerCase())throw fail('This is a shared login. Keep the linked account email unchanged.');
 if((v.name||'').length>120||(v.studentNo||v.employeeNo||'').length>100)throw fail('Use a name up to 120 and an institution ID up to 100 characters.');
 const previous=entity==='students'?await one(c,'SELECT admission_number FROM student_profiles WHERE org_id=? AND user_id=?',[org,uid]):null;
 const reference=entity==='students'&&m.reference_number&&m.reference_number!==previous?.admission_number?m.reference_number:v.studentNo||v.employeeNo||m.reference_number||'';
 await c.execute('UPDATE institution_memberships SET display_name=?,reference_number=? WHERE org_id=? AND user_id=?',[v.name||m.account_name,reference,org,uid]);
 if(entity==='students'){
  const vals=Object.entries(fields).map(([k])=>(k==='dob'||k==='admissionDate')?(v[k]||null):v[k]||'');const cols=Object.values(fields);
  const admission=v.studentNo||'';if(admission.length>60)throw fail('Linked admission numbers must be 60 characters or fewer.');
  const prior=await one(c,'SELECT user_id FROM student_profiles WHERE org_id=? AND admission_number=? AND user_id<>? AND admission_number<>\'\'',[org,admission,uid]);if(prior)throw fail('That admission number is already assigned in Learning.',409);
  await c.execute('INSERT INTO student_profiles(org_id,user_id,admission_number,'+cols.join(',')+') VALUES('+[org,uid,admission,...vals].map(()=>'?').join(',')+') ON DUPLICATE KEY UPDATE admission_number=VALUES(admission_number),'+cols.map(k=>k+'=VALUES('+k+')').join(','),[org,uid,admission,...vals]);
  await c.execute("UPDATE student_profiles SET details=JSON_SET(COALESCE(details,JSON_OBJECT()),"+extraProfileKeys.map(k=>"'$."+k+"',?").join(',')+") WHERE org_id=? AND user_id=?",[...extraProfileKeys.map(k=>v[k]||''),org,uid]);
  if(v.batch)await c.execute('UPDATE institution_memberships SET class_name=? WHERE org_id=? AND user_id=?',[v.batch,org,uid]);
 }
}
export async function recordChanged(c,org,entity,r){
 if(!['students','faculty'].includes(entity))return;
 let binding;if(entity==='students'){binding=await one(c,'SELECT e.user_id,e.student_id FROM emis_roles e JOIN emis_student_links sl ON sl.org_id=e.org_id AND sl.person_id=e.student_person_id JOIN emis_campuses ec ON ec.org_id=sl.org_id JOIN emis_records rec ON rec.org_id=sl.org_id AND rec.id=sl.student_id AND rec.year=ec.profile->>\'$.year\' WHERE sl.org_id=? AND sl.student_id=?',[org,r.id]);if(binding&&await currentEnrollment(c,org,binding.student_id)!==r.id)return;}else binding=await one(c,'SELECT user_id FROM emis_roles WHERE org_id=? AND faculty_id=?',[org,r.id]);if(!binding)return;
 await writeLearningProfile(c,org,binding.user_id,entity,r);
 if(r.status&&r.status!=='Active')await c.execute('UPDATE institution_memberships SET active=0 WHERE org_id=? AND user_id=?',[org,binding.user_id]);
}
