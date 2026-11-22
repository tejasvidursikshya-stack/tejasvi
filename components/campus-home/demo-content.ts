import type {Audience} from './operations-data';
export const tourEditions:Audience[]=['college','school','corporate'];
export const tourInfo={
 college:{label:'College',seat:'Finance desk',system:'College EMIS',module:'Fee ledger',subtitle:'Academic year · Semester II',task:'Post a fee payment.',help:'Select an invoice and record a sample payment. Watch the balance change, then open Activity to see the receipt.'},
 school:{label:'School',seat:'Class teacher',system:'School EMIS',module:'Class register',subtitle:'Grade 8 · Section A',task:'Take class attendance.',help:'Mark each learner present or absent, then save the register. Activity shows the recorded totals.'},
 corporate:{label:'Corporate',seat:'Training admin',system:'Corporate LMS',module:'Training batches',subtitle:'Employee learning · Onboarding',task:'Assign training to a team.',help:'Choose a batch and attach a course. Open Activity to see which employees now have access.'}
} as const;
export const invoices=[{id:'BCA-021',person:'Anika K.',initials:'AK',total:12500,paid:4500},{id:'BCA-022',person:'Ravi M.',initials:'RM',total:10000,paid:6000}] as const;
export const pupils=[{name:'Aarav T.',initials:'AT'},{name:'Diya R.',initials:'DR'},{name:'Samir B.',initials:'SB'}] as const;
export const groups=[{name:'New starters',members:4},{name:'Support team',members:6}] as const;
export const courses=['Customer handoffs','Information security basics','Workplace communication'] as const;
export const money=(v:number)=>'NPR '+new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(v);
