export const attendanceStates=['present','absent','late','excused','unmarked'] as const;
export function attendanceSummary(records:{status:string}[]){
 const count=(s:string)=>records.filter(r=>r.status===s).length;
 const present=count('present'),late=count('late'),absent=count('absent'),excused=count('excused'),total=present+late+absent;
 return {present,late,absent,excused,unmarked:count('unmarked'),total,percentage:total?Math.round(100*(present+late)/total):null};
}
