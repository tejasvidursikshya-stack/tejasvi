import {deadlinePassed} from './college-policy';
type Assessment={due_at?:string|null;due_date?:string|null;allow_late?:boolean|number;status?:string};
type Submission={score?:number|null;returned_until?:string|null;submitted_at?:string;version?:number};
export function utcMillis(value:string){return Date.parse(value.replace(' ','T').replace(/Z$/,'')+'Z')}
export function canSubmit(a:Assessment,s:Submission|null|undefined,now=Date.now()){
 if(a.status!=='published')return false;
 if(s?.score!==null&&s?.score!==undefined)return false;
 if(s?.returned_until)return now<=utcMillis(s.returned_until);
 return !!a.allow_late||!deadlinePassed(a,now);
}
export function submissionState(a:Assessment,s?:Submission|null,now=Date.now()){
 if(s?.score!==null&&s?.score!==undefined)return 'graded';
 if(s?.returned_until)return 'returned';
 if(s)return 'submitted';
 return deadlinePassed(a,now)?'overdue':'not_started';
}
export function isLate(a:Assessment,s:Submission){return !!s.submitted_at&&deadlinePassed(a,utcMillis(s.submitted_at))}
