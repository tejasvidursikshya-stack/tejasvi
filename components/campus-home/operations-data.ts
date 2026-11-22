export type Audience='college'|'school'|'corporate';
export type Card={title:string; body:string; entries:readonly string[]; art:number};
type Inventory={label:string;system:string; description:string; stamp:string;cards:readonly Card[]};
export const audiences:Audience[]=['college','school','corporate'];
export const operations:Record<Audience,Inventory>={
 college:{label:'College',system:'College EMIS',stamp:'Campus',description:'Follow the work of a college, from the admissions desk to the annual report.',cards:[
  {title:'Admissions',art:0,body:'Move an applicant from enquiry to enrollment and keep their academic year and program with the student record.',entries:['Enquiries','Applications','Student directory']},
  {title:'Academic office',art:1,body:'Allocate faculty to courses, arrange the timetable and publish examination results for the right academic year.',entries:['Course allocations','Timetables','Exams & results']},
  {title:'Finance & aid',art:2,body:'Trace a fee from invoice to receipt. Record scholarship awards and plan operating budgets by department.',entries:['Fees & receipts','Scholarships','Budgets']},
  {title:'Student services',art:3,body:'Keep library resources, student support requests and grievances visible to the staff who handle them.',entries:['Library register','Support requests','Grievances']},
  {title:'Campus resources',art:4,body:'Maintain your facilities and vehicle registers, alongside the people who keep the college running.',entries:['Facilities & ICT','Transport','Staff directory']},
  {title:'Quality & reporting',art:5,body:'Bring research, publications and quality evidence together for review and annual college reporting.',entries:['QAA evidence','Research & publications','Annual report']}]},
 school:{label:'School',system:'School EMIS',stamp:'School',description:'See how the school office organizes the year, from first admission to published results.',cards:[
  {title:'Student intake',art:0,body:'Review applications, record guardian contacts and keep each enrolled learner with the correct class and section.',entries:['Applications','Guardian contacts','Student directory']},
  {title:'The school day',art:1,body:'See who is teaching each class and record attendance against the school timetable.',entries:['Subject allocation','Class timetable','Attendance']},
  {title:'School fees',art:2,body:'Record a learner’s fees, issue payment receipts and see which balances still need following up.',entries:['Student invoices','Payments','Outstanding balances']},
  {title:'Library & support',art:3,body:'Keep a register of library materials and follow individual service requests through the school office.',entries:['Library resources','Student support','Feedback']},
  {title:'People & transport',art:4,body:'Keep staff contacts, driver details, assigned routes and vehicle service dates in the institution’s registers.',entries:['Staff directory','Vehicle register','Routes & service dates']},
  {title:'Year-end review',art:5,body:'Publish exam results and prepare a school annual overview of enrollment, teaching staff and attendance.',entries:['Examinations','Published results','School annual overview']}]},
 corporate:{label:'Corporate',system:'Corporate LMS',stamp:'Teams',description:'Manage the training side of a company in Learning. Corporate workspaces do not include EMIS.',cards:[
  {title:'Employee groups',art:0,body:'Build a training batch, add employees to its roster and give the group a start and end date.',entries:['Employee roster','Training batches','Batch dates']},
  {title:'Course access',art:3,body:'Link a course to one or more batches or assign it directly to employees who need that training.',entries:['Course visibility','Batch assignments','Direct assignments']},
  {title:'Training progress',art:5,body:'Follow which employees have started learning and which courses they have already completed.',entries:['Employee activity','In-progress courses','Completions']},
  {title:'Certificates',art:1,body:'Issue course certificates and let employees open and verify a credential from their learning workspace.',entries:['Course completion','Issued certificates','Verification page']}]}
};
