// The directory is a read model. Reading an EMIS enrollment never grants access.
import {one,rows,transaction,type DB} from './db';
import {AppError} from './errors';
import {jsonValue} from './platform-server';
export const supportedCampus=(kind:string)=>kind==='school'||kind==='college';
const profileFields:Record<string,string>={admissionNumber:'admission_number',birthDate:'birth_date',gender:'gender',phone:'phone',address:'address',guardianName:'guardian_name',guardianPhone:'guardian_phone',guardianEmail:'guardian_email',emergencyContact:'emergency_contact',admissionDate:'admission_date'};
const emisFields:Record<string,string>={fullName:'name',admissionNumber:'studentNo',birthDate:'dob',phone:'phone',address:'address',gender:'gender',guardianName:'guardian',guardianPhone:'guardianPhone',admissionDate:'admissionDate',nationality:'nationality',permanentAddress:'permanentAddress',province:'province',district:'district',section:'section',status:'status'};
const accountColumns="u.email AS loginEmail,u.name AS accountName,u.must_change_password,m.active AS memberActive,m.display_name,m.reference_number,m.class_name,p.admission_number,p.birth_date,p.gender,p.phone,p.address,p.guardian_name,p.guardian_phone,p.guardian_email,p.emergency_contact,p.admission_date,p.details,(p.photo_data IS NOT NULL) AS hasPhoto";
const enrollmentJoin=" FROM emis_records r LEFT JOIN emis_student_links sl ON sl.org_id=r.org_id AND sl.student_id=r.id LEFT JOIN emis_roles er ON er.org_id=r.org_id AND er.student_person_id=COALESCE(sl.person_id,r.id) AND er.role='Student' LEFT JOIN emis_roles legacy ON legacy.org_id=r.org_id AND legacy.student_id=r.id AND legacy.student_person_id IS NULL AND legacy.role='Student' AND er.user_id IS NULL LEFT JOIN institution_memberships m ON m.org_id=r.org_id AND m.user_id=COALESCE(er.user_id,legacy.user_id) AND m.role='student' ";
const currentWhere="r.org_id=? AND r.entity='students' AND r.archived=0 AND r.year=?";
const unbound="NOT EXISTS(SELECT 1 FROM emis_roles er WHERE er.org_id=m.org_id AND er.user_id=m.user_id AND er.role='Student' AND (er.student_person_id IS NOT NULL OR er.student_id IS NOT NULL))";
export async function directorySummary(org:string,db?:DB){
 const c=await one("SELECT profile->>'$.year' AS year FROM emis_campuses WHERE org_id=?",[org],db);if(!c)return null;
 const n=await one("SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN m.user_id IS NULL THEN 1 ELSE 0 END),0) AS pending"+enrollmentJoin+" WHERE "+currentWhere,[org,c.year],db);
 const orphan=await one("SELECT COUNT(*) AS n FROM institution_memberships m WHERE m.org_id=? AND m.role='student' AND "+unbound,[org],db);
 return {year:String(c.year),total:Number(n?.total||0)+Number(orphan?.n||0),pending:Number(n?.pending||0)};
}
function format(v:Record<string,any>){
 const e=v.recordData?jsonValue(v.recordData):null,details=v.details?jsonValue(v.details):{},profile:Record<string,string>={...details};
 for(const [key,col] of Object.entries(profileFields))profile[key]=String(v[col]??'');
 if(e)for(const [key,emis] of Object.entries(emisFields)){if(e[emis]!=null&&e[emis]!=='')profile[key]=String(e[emis]);}
 const name=String(e?.name||v.display_name||v.accountName||'Unnamed student'),email=String(v.loginEmail||e?.email||'');
 Object.assign(profile,{fullName:name,email,referenceNumber:v.reference_number||'',...(e?{academicYear:String(v.year)}:{})});
 return {key:v.recordId?'enrollment:'+v.recordId:'account:'+v.userId,id:v.userId||null,recordId:v.recordId||null,recordVersion:v.version||null,personId:v.personId||null,
  name,email,profile,hasPhoto:!!v.hasPhoto,reference_number:v.reference_number||'',class_name:v.class_name||'',year:v.year||'',program:v.program||'',semester:e?.semester?String(e.semester):'',intake:e?.batch||'',
  enrollmentStatus:e?.status||'',source:e?'EMIS':'LMS',loginState:v.userId?(v.memberActive?'active':'paused'):'pending',hasEmisEmail:!!e?.email};
}
export function getSharedDirectory(org:string,requested:string|null){return transaction(c=>readDirectory(org,requested,c));}
async function readDirectory(org:string,requested:string|null,db:DB){
 const ctx=await one('SELECT profile FROM emis_campuses WHERE org_id=?',[org],db);if(!ctx)throw new AppError('This institution does not have an EMIS workspace.',404);
 const p=jsonValue(ctx.profile),currentYear=String(p.year),years=[...new Set<string>([currentYear,...(p.years||[]),...(await rows("SELECT DISTINCT year FROM emis_records WHERE org_id=? AND entity='students' AND archived=0",[org],db)).map(r=>r.year)])].sort().reverse();
 const year=requested||currentYear;if(!years.includes(year))throw new AppError('Choose an academic year for this institution.');
 const regs=await rows("SELECT r.id recordId,r.version,r.year,r.data recordData,sl.person_id personId,m.user_id userId,prog.data->>'$.name' AS program,"+accountColumns+enrollmentJoin+
  " LEFT JOIN users u ON u.id=m.user_id LEFT JOIN student_profiles p ON p.org_id=m.org_id AND p.user_id=m.user_id LEFT JOIN emis_records prog ON prog.org_id=r.org_id AND prog.id=r.data->>'$.programId' AND prog.entity='programs' WHERE "+currentWhere,[org,year],db);
 const others=year===currentYear?await rows("SELECT m.user_id userId,"+accountColumns+" FROM institution_memberships m JOIN users u ON u.id=m.user_id LEFT JOIN student_profiles p ON p.org_id=m.org_id AND p.user_id=m.user_id WHERE m.org_id=? AND m.role='student' AND "+unbound,[org],db):[];
 const students=[...regs,...others].map(format).sort((a,b)=>a.name.localeCompare(b.name)||a.key.localeCompare(b.key));
 const batches=await rows('SELECT b.id,b.name,b.academic_year,g.name AS grade_name,s.name AS section_name,pr.name AS program FROM batches b LEFT JOIN grades g ON g.id=b.grade_id AND g.org_id=b.org_id LEFT JOIN programs pr ON pr.id=g.program_id AND pr.org_id=b.org_id LEFT JOIN sections s ON s.id=b.section_id AND s.org_id=b.org_id WHERE b.org_id=? ORDER BY b.name',[org],db);
 const roster=await rows("SELECT bm.batch_id,bm.user_id FROM batch_members bm JOIN batches b ON b.id=bm.batch_id JOIN institution_memberships m ON m.org_id=b.org_id AND m.user_id=bm.user_id AND m.role='student' WHERE b.org_id=?",[org],db);
 const subjects=await rows('SELECT bs.batch_id,s.id,s.name FROM batch_subjects bs JOIN batches b ON b.id=bs.batch_id JOIN subjects s ON s.id=bs.subject_id AND s.org_id=b.org_id WHERE b.org_id=? AND (s.college_semester_id IS NULL OR s.college_semester_id=b.grade_id) ORDER BY s.name',[org],db);
 return {students,years,year,currentYear,batches,roster,subjects};
}
