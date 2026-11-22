import { feeSummary } from './dashboard-model.mjs';
const cents = rows => rows.reduce((total,row)=>total+Math.round((Number(row.amount)||0)*100),0);
export function collegeMetrics(ctx) {
  const students=ctx.rows('students'),courses=ctx.rows('courses'),faculty=ctx.rows('faculty'),staff=ctx.rows('staff'),payments=ctx.rows('payments'),transactions=ctx.rows('transactions');
  const feeCents=cents(payments),otherCents=cents(transactions.filter(r=>r.type==='Income')),expenseCents=cents(transactions.filter(r=>r.type==='Expenditure'));
  const start=Number(ctx.year.slice(0,4)), previousYear=`${start-1}/${String(start%100).padStart(2,'0')}`;
  const previous=entity=>(ctx.records[entity]||[]).filter(r=>r.year===previousYear);
  const comparison=(current,entity,value=rows=>rows.length)=>{const priorRows=previous(entity),prior=value(priorRows);return priorRows.length&&prior>0?{value:(current-prior)/prior*100,year:previousYear}:null;};
  return {
    students:students.length,activeStudents:students.filter(s=>s.status==='Active').length,staff:faculty.length+staff.length,faculty:faculty.length,nonTeaching:staff.length,courses:courses.length,activeCourses:courses.filter(c=>c.status==='Active').length,
    fees:feeCents/100,otherIncome:otherCents/100,income:(feeCents+otherCents)/100,expenses:expenseCents/100,outstanding:feeSummary(ctx).balance,
    growth:{students:comparison(students.length,'students'),courses:comparison(courses.length,'courses'),fees:comparison(feeCents/100,'payments',rows=>cents(rows)/100)},
    methods:['Cash','Bank transfer','Cheque','Online'].map(method=>({method,amount:cents(payments.filter(p=>p.method===method))/100,count:payments.filter(p=>p.method===method).length}))
  };
}
