export const YEARS = ['2026/27', '2025/26', '2024/25', '2023/24'];
import { normalizeRole } from './access.mjs';
export { ROLES } from './access.mjs';
export const CLASS_NAMES = ['Nursery', 'LKG', 'UKG', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
const f = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const req = (key, label, type = 'text', extra = {}) => f(key, label, type, { required: true, ...extra });
const sel = (key, label, options, required = false) => f(key, label, 'select', { options, required });
const ref = (key, label, entity, required = false) => f(key, label, 'relation', { entity, required });
const stat = (options) => sel('status', 'Status', options, true);
const num = (key, label, extra = {}) => f(key, label, 'number', { min: 0, ...extra });
const note = f('notes', 'Notes', 'textarea');
const name = req('name', 'Name');
const prog = ref('programId', 'Program', 'programs', true);
const stu = ref('studentId', 'Student', 'students', true);
const gender = sel('gender', 'Gender', ['Female', 'Male', 'Other', 'Not disclosed'], true);
const contact = [f('email', 'Email', 'email'), f('phone', 'Phone'), f('address', 'Address')];
const module = (title, singular, group, icon, description, fields, columns, extra = {}) => ({ title, singular, group, icon, description, fields, columns, ...extra });
export const modules = {
    vehicles: module('Vehicles & transport', 'Vehicle', 'Campus', 'bus', 'Maintain your college vehicle, driver, route and service register.', [req('registrationNo', 'Registration number'), name, sel('type', 'Vehicle type', ['Bus', 'Van', 'Car', 'Motorcycle', 'Other'], true), num('capacity', 'Seating capacity', { required: true, min: 1, max: 100 }), f('driver', 'Driver name'), f('driverPhone', 'Driver contact'), f('route', 'Route / assignment'), f('insuranceDue', 'Insurance renewal date', 'date'), f('serviceDue', 'Next service date', 'date'), stat(['Active', 'Maintenance', 'Inactive']), note], ['registrationNo', 'name', 'driver', 'route', 'capacity', 'status']),
    visitors: module('Front-office visits', 'Visit', 'Campus', 'contact', 'Record visitors, appointments and college reception follow-up.', [name, f('phone', 'Contact number'), req('date', 'Visit date', 'date'), f('arrivalTime', 'Arrival time', 'time'), f('departureTime', 'Departure time', 'time'), req('purpose', 'Purpose of visit'), f('host', 'Staff member / department to meet'), stat(['Expected', 'Checked in', 'Completed', 'Cancelled']), note], ['name', 'date', 'arrivalTime', 'purpose', 'host', 'status']),

    departments: module('Departments', 'Department', 'Institution', 'building', 'Manage the academic and administrative units of your college.', [name, req('code', 'Department code'), f('head', 'Head of department'), sel('type', 'Unit type', ['Academic', 'Administrative', 'Support'], true), num('approvedPositions', 'Approved positions'), note], ['name', 'code', 'head', 'type']),
    programs: module('Programs', 'Program', 'Institution', 'graduation', 'A single source for your academic programs, capacity and affiliations.', [name, req('code', 'Program code'), sel('level', 'Education level', ['Primary', 'Lower Secondary', 'Secondary', 'Higher Secondary', 'Certificate', 'Bachelor', 'Master', 'MPhil', 'PhD'], true), ref('departmentId', 'Department', 'departments', true), f('university', 'Affiliating university'), f('approvalDate', 'Approval date', 'date'), num('duration', 'Duration (years)', { required: true, min: 1, max: 10 }), num('seats', 'Annual intake seats', { required: true, min: 1 }), num('credits', 'Total credits'), sel('system', 'Academic system', ['Semester', 'Annual'], true), f('coordinator', 'Program coordinator'), f('curriculum', 'Curriculum and outcomes', 'textarea'), stat(['Active', 'Paused', 'Closed'])], ['name', 'level', 'seats', 'coordinator', 'status'], { only: 'college' }),
    governance: module('Governance', 'Committee', 'Institution', 'landmark', 'Committees, responsibilities, decisions and institutional follow-up.', [name, sel('type', 'Committee type', ['Governing body', 'Academic', 'IQAC', 'Research', 'Examination', 'Student affairs', 'Finance', 'Other'], true), f('chair', 'Chairperson'), f('members', 'Members', 'textarea'), f('meetingDate', 'Last meeting', 'date'), f('decisions', 'Decisions and follow-up', 'textarea'), f('nextMeeting', 'Next meeting', 'date'), note], ['name', 'type', 'chair', 'meetingDate']),
    enquiries: module('Enquiries', 'Enquiry', 'Students', 'messages', 'Track interest from the first conversation to a formal application.', [name, ...contact, { ...ref('programId', 'Interested program', 'programs', true), only: 'college' }, { ...sel('classApplied', 'Class applied for', CLASS_NAMES, true), only: 'school' },, sel('source', 'Source', ['Walk-in', 'Website', 'Referral', 'School visit', 'Social media', 'Phone'], true), f('followUp', 'Next follow-up', 'date'), f('counselor', 'Counselor'), stat(['New', 'Contacted', 'Interested', 'Applied', 'Closed']), note], ['name', 'programId', 'source', 'followUp', 'status']),
    admissions: module('Admissions', 'Application', 'Students', 'clipboard', 'Review applications, record entrance results and enroll accepted students.', [name, req('applicationNo', 'Application number'), { ...prog, only: 'college' }, { ...sel('classApplied', 'Class applied for', CLASS_NAMES, true), only: 'school' }, ...contact, gender, f('dob', 'Date of birth', 'date'), f('guardian', 'Guardian name'), f('previousInstitution', 'Previous institution'), f('qualification', 'Previous qualification'), num('entranceScore', 'Entrance score (%)', { max: 100 }), sel('category', 'Admission category', ['Regular', 'Merit', 'Quota', 'Transfer'], true), sel('scholarshipCategory', 'Scholarship category', ['None', 'Merit', 'Need-based', 'UGC', 'Disability', 'Other']), f('applicationDate', 'Application date', 'date'), stat(['Applied', 'Under review', 'Accepted', 'Waitlisted', 'Rejected', 'Enrolled']), ref('enquiryId', 'Source enquiry', 'enquiries'), note], ['applicationNo', 'name', 'programId', 'entranceScore', 'status'], { schoolColumns: ['applicationNo', 'name', 'classApplied', 'entranceScore', 'status'] }),
    students: module('Student directory', 'Student', 'Students', 'users', 'Student records connected to their complete academic journey.', [req('studentNo', 'Student ID'), name, { ...prog, only: 'college' }, num('semester', 'Semester / year', { required: true, min: 1, max: 12, only: 'college' }), req('batch', 'Intake / batch', 'text', { only: 'college' }), f('section', 'Section', 'text', { only: 'college' }), { ...ref('classId', 'Class & section', 'classes', true), only: 'school' }, num('rollNo', 'Roll number', { min: 1, max: 999, only: 'school' }), gender, f('dob', 'Date of birth', 'date'), f('dobBs', 'Date of birth (BS, YYYY-MM-DD)', 'text', { only: 'school' }), f('birthRegNo', 'Birth registration number', 'text', { only: 'school' }), ...contact, f('permanentAddress', 'Permanent address'), sel('province', 'Province', ['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpashchim', 'International']), f('district', 'District'), f('fatherName', 'Father’s name', 'text', { only: 'school' }), f('fatherPhone', 'Father’s phone', 'text', { only: 'school' }), f('motherName', 'Mother’s name', 'text', { only: 'school' }), f('motherPhone', 'Mother’s phone', 'text', { only: 'school' }), f('guardian', 'Guardian name'), f('guardianPhone', 'Guardian phone'), sel('guardianRelation', 'Guardian relation', ['Father', 'Mother', 'Grandparent', 'Sibling', 'Relative', 'Local guardian', 'Other']), f('previousSchool', 'Previous school', 'text', { only: 'school' }), { ...sel('transport', 'Transport', ['Own arrangement', 'School bus', 'Walk']), only: 'school' }, { ...ref('routeId', 'Bus route', 'routes'), only: 'school' }, f('busRoute', 'Bus stop', 'text', { only: 'school' }), { ...sel('bloodGroup', 'Blood group', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known']), only: 'school' }, { ...sel('lunch', 'School lunch', ['Yes', 'No']), only: 'school' }, { ...sel('hostel', 'Hostel', ['Yes', 'No']), only: 'school' }, { ...sel('staffChild', 'Child of school staff', ['No', 'Yes']), only: 'school' }, f('nationality', 'Nationality'), sel('ethnicity', 'Caste / ethnicity', ['Not disclosed', 'Dalit', 'Janajati', 'Madhesi', 'Muslim', 'Brahmin / Chhetri', 'Other']), sel('disability', 'Disability status', ['Not disclosed', 'None', 'Physical', 'Visual', 'Hearing', 'Other']), sel('economicStatus', 'Economic category', ['Not disclosed', 'General', 'Disadvantaged']), sel('firstGeneration', 'First-generation learner', ['Not disclosed', 'Yes', 'No']), sel('rural', 'Rural / remote background', ['Not disclosed', 'Yes', 'No']), f('admissionDate', 'Admission date', 'date'), stat(['Active', 'Graduated', 'Withdrawn', 'Dropped out', 'Transferred', 'Suspended', 'On leave']), note], ['studentNo', 'name', 'programId', 'semester', 'gender', 'status'], { schoolColumns: ['studentNo', 'name', 'classId', 'rollNo', 'guardianPhone', 'status'] }),
    courses: module('Courses & teaching', 'Course', 'Academics', 'book', 'Course allocation, credits, learning outcomes and teaching plans.', [name, req('code', 'Course code'), prog, num('semester', 'Semester / year', { required: true, min: 1, max: 12 }), num('credits', 'Credits', { required: true, min: 1, max: 30 }), ref('facultyId', 'Assigned faculty', 'faculty', true), sel('method', 'Teaching method', ['Lecture', 'Case study', 'Project-based', 'Experiential', 'Problem-based', 'ICT-based']), f('outcomes', 'Course outcomes', 'textarea'), f('plan', 'Teaching and lesson plan', 'textarea'), stat(['Active', 'Completed', 'Planned'])], ['code', 'name', 'programId', 'facultyId', 'credits', 'status'], { only: 'college' }),
    timetable: module('Timetable', 'Class schedule', 'Academics', 'calendar', 'Coordinate classes, faculty and learning spaces.', [ref('courseId', 'Course', 'courses', true), sel('day', 'Day', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], true), req('startTime', 'Start time', 'time'), req('endTime', 'End time', 'time'), req('room', 'Room / lab'), sel('mode', 'Mode', ['In-person', 'Online', 'Hybrid'], true), f('link', 'Online class URL', 'url'), note], ['courseId', 'day', 'startTime', 'endTime', 'room'], { only: 'college' }),
    attendance: module('Attendance', 'Attendance entry', 'Academics', 'check', 'Record course attendance and follow up on attendance shortages.', [stu, ref('courseId', 'Course', 'courses', true), req('date', 'Date', 'date'), stat(['Present', 'Absent', 'Late', 'Excused']), note], ['studentId', 'courseId', 'date', 'status'], { only: 'college' }),
    exams: module('Examinations', 'Examination', 'Academics', 'filecheck', 'Schedule internal, university, practical and project examinations.', [name, ref('courseId', 'Course', 'courses', true), sel('type', 'Examination type', ['Internal', 'Pre-board', 'Re-examination', 'University', 'Practical', 'Project / viva'], true), req('date', 'Exam date', 'date'), f('time', 'Start time', 'time'), num('maxMarks', 'Maximum marks', { required: true, min: 1, max: 1000 }), num('passMarks', 'Pass marks', { required: true, min: 0, max: 1000 }), num('credits', 'Credit weight', { min: 0, max: 30 }), f('room', 'Room'), stat(['Scheduled', 'In progress', 'Completed', 'Published'])], ['name', 'courseId', 'type', 'date', 'status'], { only: 'college' }),
    results: module('Results & assessment', 'Result', 'Academics', 'award', 'Capture marks and publish assessed results with a traceable record.', [stu, ref('examId', 'Examination', 'exams', true), num('marks', 'Marks obtained', { required: true, min: 0 }), num('gradePoint', 'Grade point (optional)', { max: 4 }), sel('standing', 'Academic standing', ['Regular', 'Back paper', 'Re-examination']), stat(['Draft', 'Published']), note], ['studentId', 'examId', 'marks', 'gradePoint', 'status'], { only: 'college' }),
    faculty: module('Faculty', 'Faculty member', 'People', 'contact', 'Qualifications, employment status and faculty responsibilities.', [req('employeeNo', 'Employee ID'), name, gender, ...contact, ref('departmentId', 'Department', 'departments', true), sel('designation', 'Designation', ['Teacher', 'Head Teacher', 'Principal', 'Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer', 'Teaching Assistant', 'Visiting faculty'], true), req('qualification', 'Highest qualification'), f('specialization', 'Specialization'), sel('employment', 'Employment type', ['Full-time', 'Part-time', 'Visiting'], true), f('appointmentDate', 'Appointment date', 'date'), num('weeklyHours', 'Teaching hours per week'), f('responsibilities', 'Research, supervision and administrative duties', 'textarea'), sel('otherFullTime', 'Full-time employed elsewhere', ['No', 'Yes', 'Not declared']), stat(['Active', 'On leave', 'Resigned'])], ['employeeNo', 'name', 'departmentId', 'designation', 'employment', 'status']),
    staff: module('Non-teaching staff', 'Staff member', 'People', 'briefcase', 'Administrative and student-support staffing.', [req('employeeNo', 'Employee ID'), name, gender, ...contact, ref('departmentId', 'Department', 'departments', true), req('designation', 'Designation'), f('qualification', 'Qualification'), sel('employment', 'Employment type', ['Full-time', 'Part-time', 'Contract'], true), f('appointmentDate', 'Appointment date', 'date'), stat(['Active', 'On leave', 'Resigned']), note], ['employeeNo', 'name', 'departmentId', 'designation', 'employment', 'status']),
    development: module('Staff development', 'Development activity', 'People', 'sparkles', 'Training, professional development and teaching evaluation.', [name, ref('facultyId', 'Faculty member', 'faculty'), ref('staffId', 'Staff member', 'staff'), sel('type', 'Activity type', ['Training', 'Workshop', 'Seminar', 'Conference', 'FDP', 'Certification', 'Higher education', 'Performance evaluation'], true), req('date', 'Activity date', 'date'), f('provider', 'Provider'), num('hours', 'Hours'), num('evaluation', 'Evaluation score (%)', { max: 100 }), f('outcomes', 'Outcomes', 'textarea')], ['name', 'facultyId', 'type', 'date', 'hours']),
    fees: module('Student fees', 'Fee invoice', 'Finance', 'wallet', 'Issue fees, record payments and follow up on outstanding balances.', [req('invoiceNo', 'Invoice number'), stu, sel('category', 'Fee category', ['Tuition', 'Admission', 'Examination', 'Library', 'Monthly bill', 'Transport', 'Lunch', 'Hostel', 'Late fine', 'Other'], true), f('billingPeriod', 'Billing period', 'text', { only: 'school' }), { ...sel('lateFined', 'Late fine charged', ['No', 'Yes']), only: 'school' }, num('amount', 'Invoice amount (NPR)', { required: true, min: 1 }), req('dueDate', 'Due date', 'date'), note], ['invoiceNo', 'studentId', 'category', 'amount', 'dueDate']),
    payments: module('Payments', 'Payment', 'Finance', 'receipt', 'Record verified student payments against their invoices.', [req('receiptNo', 'Receipt number'), ref('invoiceId', 'Invoice', 'fees', true), num('amount', 'Amount received (NPR)', { required: true, min: 0.01 }), req('date', 'Payment date', 'date'), sel('method', 'Payment method', ['Cash', 'Bank transfer', 'Cheque', 'Online', 'eSewa', 'Khalti', 'Fonepay', 'Advance'], true), f('reference', 'Bank / transaction reference'), note], ['receiptNo', 'invoiceId', 'amount', 'date', 'method']),
    transactions: module('Income & expenditure', 'Transaction', 'Finance', 'banknote', 'Track other income and operating expenditure in NPR.', [req('reference', 'Voucher number'), name, sel('type', 'Transaction type', ['Income', 'Expenditure'], true), sel('category', 'Category', ['Grant', 'Donation', 'Research', 'Salary', 'Academic activities', 'Infrastructure', 'Library', 'ICT', 'Student welfare', 'Scholarships', 'Administration', 'Other'], true), num('amount', 'Amount (NPR)', { required: true, min: 0.01 }), req('date', 'Transaction date', 'date'), ref('departmentId', 'Department', 'departments'), note], ['reference', 'name', 'type', 'category', 'amount', 'date']),
    budgets: module('Budgets', 'Budget allocation', 'Finance', 'chart', 'Compare departmental allocations with recorded expenditure.', [name, ref('departmentId', 'Department', 'departments', true), num('amount', 'Allocated budget (NPR)', { required: true, min: 1 }), f('approvedBy', 'Approved by'), f('approvalDate', 'Approval date', 'date'), note], ['name', 'departmentId', 'amount', 'approvedBy']),
    scholarships: module('Scholarships', 'Scholarship award', 'Finance', 'heart', 'Merit, need-based and inclusion support, with renewal tracking.', [stu, sel('category', 'Scholarship category', ['UGC', 'University', 'College', 'Merit', 'Need-based', 'Dalit', 'Disability', 'Other'], true), num('amount', 'Award amount (NPR)', { required: true, min: 1 }), num('percentage', 'Fee waiver (%)', { max: 100 }), f('startDate', 'Start date', 'date'), f('endDate', 'End date', 'date'), f('duration', 'Duration'), stat(['Approved', 'Disbursed', 'Renewal due', 'Expired']), note], ['studentId', 'category', 'amount', 'duration', 'status']),
    research: module('Research & innovation', 'Research project', 'Development', 'flask', 'Projects, innovation, grants and research outcomes in one place.', [name, ref('facultyId', 'Principal investigator', 'faculty', true), sel('type', 'Project type', ['Research', 'Student innovation', 'Startup', 'Patent', 'Incubation', 'Competition'], true), f('specialization', 'Research specialization'), f('funder', 'Funding source'), num('funding', 'Funding (NPR)'), f('startDate', 'Start date', 'date'), f('endDate', 'End date', 'date'), f('outputs', 'Outputs and impact', 'textarea'), stat(['Proposed', 'Approved', 'In progress', 'Completed'])], ['name', 'facultyId', 'type', 'funding', 'status'], { only: 'college' }),
    publications: module('Publications', 'Publication', 'Development', 'library', 'Journal articles, books, conference papers and research reports.', [name, ref('facultyId', 'Author', 'faculty', true), sel('type', 'Publication type', ['Journal article', 'Book', 'Book chapter', 'Conference paper', 'Research report'], true), f('publisher', 'Journal / publisher'), f('date', 'Publication date', 'date'), f('doi', 'DOI / URL', 'url'), ref('projectId', 'Related project', 'research'), note], ['name', 'facultyId', 'type', 'publisher', 'date'], { only: 'college' }),
    outreach: module('Community outreach', 'Outreach activity', 'Development', 'globe', 'Extension activities, beneficiaries and community impact.', [name, sel('type', 'Activity type', ['Training', 'Consultancy', 'Skill development', 'School outreach', 'Community service', 'Awareness', 'Disaster response'], true), req('date', 'Date', 'date'), f('location', 'Location'), num('beneficiaries', 'Beneficiaries'), f('lead', 'Responsible person'), f('outcomes', 'Outcomes and community feedback', 'textarea'), stat(['Planned', 'In progress', 'Completed'])], ['name', 'type', 'date', 'beneficiaries', 'status']),
    partnerships: module('Industry partnerships', 'Partnership', 'Development', 'handshake', 'Industry relationships, MoUs and opportunities for students.', [name, f('sector', 'Industry sector'), f('contactPerson', 'Contact person'), ...contact, f('mouDate', 'MoU date', 'date'), f('expiryDate', 'Expiry date', 'date'), f('scope', 'Areas of collaboration', 'textarea'), stat(['Active', 'Under discussion', 'Expired'])], ['name', 'sector', 'contactPerson', 'mouDate', 'status'], { only: 'college' }),
    placements: module('Internships & placement', 'Placement', 'Development', 'briefcase', 'Track workplace learning and graduate employment.', [stu, ref('partnerId', 'Partner organization', 'partnerships', true), sel('type', 'Opportunity type', ['Internship', 'Placement', 'Entrepreneurship'], true), f('position', 'Position'), f('supervisor', 'Supervisor'), f('startDate', 'Start date', 'date'), f('endDate', 'End date', 'date'), num('salary', 'Monthly salary / stipend (NPR)'), num('evaluation', 'Supervisor evaluation (%)', { max: 100 }), stat(['Applied', 'Offered', 'In progress', 'Completed', 'Declined']), note], ['studentId', 'partnerId', 'type', 'position', 'status'], { only: 'college' }),
    alumni: module('Graduates & alumni', 'Graduate record', 'Development', 'graduation', 'Graduate profiles, tracer studies and alumni engagement.', [name, ref('studentId', 'Linked student', 'students'), prog, req('graduationYear', 'Graduation year'), num('completionYears', 'Time to completion (years)'), ...contact, sel('employment', 'Employment status', ['Employed', 'Self-employed', 'Further study', 'Unemployed', 'Unknown'], true), f('organization', 'Organization / university'), f('position', 'Position'), f('salaryRange', 'Salary range'), num('satisfaction', 'Graduate satisfaction (1–5)', { min: 1, max: 5 }), f('engagement', 'Mentoring, talks and contributions', 'textarea'), f('recommendations', 'Tracer recommendations', 'textarea')], ['name', 'programId', 'graduationYear', 'employment', 'organization']),
    facilities: module('Facilities & ICT', 'Facility / asset', 'Campus', 'building', 'Buildings, classrooms, equipment and digital infrastructure.', [name, req('assetNo', 'Asset / facility code'), sel('type', 'Facility type', ['Building', 'Classroom', 'Laboratory', 'Computer', 'Network / server', 'Smart board', 'Auditorium', 'Sports', 'Sanitation', 'Accessibility', 'Other'], true), f('location', 'Location'), num('capacity', 'Capacity / quantity'), f('features', 'Facilities and equipment', 'textarea'), num('utilization', 'Utilization (%)', { max: 100 }), f('maintenanceDate', 'Next maintenance', 'date'), stat(['Available', 'In use', 'Maintenance', 'Retired'])], ['assetNo', 'name', 'type', 'capacity', 'status']),
    library: module('Library resources', 'Library resource', 'Campus', 'library', 'Books, journals, e-resources and library utilization.', [name, req('accessionNo', 'Accession / resource number'), sel('type', 'Resource type', ['Book', 'Journal', 'E-resource', 'Digital library', 'Reading space'], true), f('author', 'Author / provider'), num('copies', 'Copies / seats'), num('usage', 'Uses this academic year'), f('url', 'Resource URL', 'url'), stat(['Available', 'On loan', 'Unavailable']), note], ['accessionNo', 'name', 'type', 'copies', 'usage', 'status']),
    services: module('Student support', 'Support activity', 'Campus', 'heart', 'Advising, wellbeing, clubs and student development.', [name, ref('studentId', 'Student (if individual)', 'students'), sel('type', 'Service type', ['Counseling', 'Career guidance', 'Academic advising', 'Mentoring', 'Health', 'Club', 'Sports', 'Cultural', 'Leadership', 'Competition'], true), req('date', 'Date', 'date'), f('responsible', 'Responsible person'), num('participants', 'Participants'), f('outcomes', 'Outcomes', 'textarea'), stat(['Planned', 'In progress', 'Completed'])], ['name', 'type', 'date', 'responsible', 'status']),
    grievances: module('Grievances', 'Grievance', 'Campus', 'messages', 'Confidential case tracking from submission through resolution.', [stu, req('name', 'Subject'), sel('category', 'Category', ['Academic', 'Fees', 'Facilities', 'Conduct', 'Other'], true), req('date', 'Submitted on', 'date'), req('description', 'Description', 'textarea'), f('responsible', 'Assigned to'), f('resolution', 'Resolution', 'textarea'), stat(['Open', 'Under review', 'Resolved', 'Closed'])], ['name', 'studentId', 'category', 'date', 'status']),
    evidence: module('QAA evidence', 'Evidence record', 'Quality', 'shield', 'Map institutional evidence to your QAA and SSR requirements.', [name, req('criterion', 'Criterion / standard'), req('indicator', 'Indicator / requirement'), sel('unit', 'Responsible unit', ['Academic', 'Examination', 'HR', 'Finance', 'Research', 'IQAC', 'Alumni', 'Administration'], true), sel('source', 'Source module', ['Students', 'Results', 'Faculty', 'Finance', 'Research', 'Feedback', 'Alumni', 'Institution'], true), f('owner', 'Responsible person'), f('dueDate', 'Review due', 'date'), f('url', 'External evidence URL', 'url'), stat(['Missing', 'In progress', 'Ready for review', 'Verified']), note], ['name', 'criterion', 'unit', 'dueDate', 'status'], { only: 'college' }),
    feedback: module('Feedback', 'Feedback response', 'Quality', 'messages', 'Structured feedback from students, faculty and the college community.', [req('name', 'Survey / feedback title'), sel('respondent', 'Respondent group', ['Student', 'Faculty', 'Alumni', 'Employer', 'Parent / community'], true), ref('programId', 'Program', 'programs'), req('date', 'Response date', 'date'), num('rating', 'Satisfaction (1–5)', { required: true, min: 1, max: 5 }), f('comments', 'Comments and recommendations', 'textarea'), f('followUp', 'Follow-up action', 'textarea')], ['name', 'respondent', 'programId', 'rating', 'date']),
    actions: module('IQAC action plan', 'Improvement action', 'Quality', 'target', 'Turn quality findings into accountable, evidenced improvements.', [name, req('gap', 'Identified gap', 'textarea'), req('action', 'Corrective action', 'textarea'), req('owner', 'Responsible person / unit'), req('deadline', 'Deadline', 'date'), ref('evidenceId', 'Supporting evidence', 'evidence'), sel('priority', 'Priority', ['High', 'Medium', 'Low'], true), stat(['Not started', 'In progress', 'Completed', 'On hold']), note], ['name', 'owner', 'priority', 'deadline', 'status'], { only: 'college' }),
    strategy: module('Strategic & annual plans', 'Strategic target', 'Quality', 'compass', 'Connect institutional objectives, annual activities and measurable results.', [name, req('objective', 'Strategic objective', 'textarea'), req('kpi', 'KPI / measure'), num('target', 'Target', { required: true, min: 0.01 }), num('achieved', 'Achievement', { required: true }), req('unit', 'Unit of measure'), f('owner', 'Responsible unit'), num('budget', 'Budget (NPR)'), f('deadline', 'Deadline', 'date'), f('correctiveAction', 'Gap and corrective action', 'textarea'), stat(['Planned', 'On track', 'At risk', 'Completed'])], ['name', 'kpi', 'target', 'achieved', 'owner', 'status']),
    classes: module('Classes & sections', 'Class', 'Academics', 'graduation', 'Classes from Nursery to Grade 12, their sections, class teachers and rooms.', [sel('name', 'Class', CLASS_NAMES, true), req('section', 'Section'), sel('stream', 'Stream (Grade 11–12)', ['Science', 'Management', 'Humanities', 'Education', 'Law', 'Technical']), ref('classTeacherId', 'Class teacher', 'faculty'), f('room', 'Classroom'), num('capacity', 'Capacity', { max: 200 }), stat(['Active', 'Closed']), note], ['name', 'section', 'classTeacherId', 'room', 'status'], { only: 'school' }),
    subjects: module('Subjects', 'Subject', 'Academics', 'book', 'Subjects for each class with credit hours, full marks and the teacher who teaches them.', [ref('classId', 'Class & section', 'classes', true), name, f('code', 'Subject code'), sel('type', 'Subject type', ['Compulsory', 'Optional', 'Additional'], true), num('creditHours', 'Credit hours', { required: true, min: 0.5, max: 10 }), num('theoryFull', 'Theory full marks', { required: true, min: 1, max: 200 }), num('practicalFull', 'Practical / internal full marks', { max: 200 }), ref('teacherId', 'Subject teacher', 'faculty'), note], ['classId', 'name', 'type', 'creditHours', 'theoryFull', 'practicalFull', 'teacherId'], { only: 'school' }),
    schoolAttendance: module('Daily attendance', 'Attendance entry', 'Academics', 'check', 'Whole-day class attendance, taken once each school day.', [stu, ref('classId', 'Class & section', 'classes', true), req('date', 'Date', 'date'), sel('status', 'Status', ['Present', 'Absent', 'Late', 'Leave'], true), note], ['studentId', 'classId', 'date', 'status'], { only: 'school' }),
    terms: module('Terminal examinations', 'Examination', 'Academics', 'calendar', 'First, second and third terminal and final examinations, with their weight in the final result.', [sel('name', 'Examination', ['First Terminal', 'Second Terminal', 'Third Terminal', 'Pre-board', 'Final', 'Unit test'], true), f('startDate', 'Start date', 'date'), f('resultDate', 'Result date', 'date'), num('weight', 'Weight in final result (%)', { max: 100 }), stat(['Planned', 'Marks entry', 'Published']), note], ['name', 'startDate', 'resultDate', 'weight', 'status'], { only: 'school' }),
    marks: module('Marks', 'Mark entry', 'Academics', 'clipboard', 'Theory and practical marks per student, subject and examination.', [stu, ref('termId', 'Examination', 'terms', true), ref('subjectId', 'Subject', 'subjects', true), num('theory', 'Theory marks', { max: 200 }), num('practical', 'Practical / internal marks', { max: 200 }), sel('absent', 'Absent in exam', ['No', 'Yes']), stat(['Draft', 'Published']), note], ['studentId', 'termId', 'subjectId', 'theory', 'practical', 'status'], { only: 'school' }),
    feeHeads: module('Fee structure', 'Fee head', 'Finance', 'wallet', 'What each class pays: tuition, transport, lunch and other charges, and how often.', [ref('classId', 'Class & section (blank = every class)', 'classes'), sel('head', 'Fee head', ['Tuition', 'Admission', 'Examination', 'Computer', 'Library', 'Transport', 'Lunch', 'Hostel', 'Sports & activities', 'Annual charge', 'Other'], true), num('amount', 'Amount (NPR)', { required: true, min: 1 }), sel('frequency', 'Charged', ['Monthly', 'Each terminal', 'Annual', 'One-time'], true), sel('appliesTo', 'Applies to', ['All students', 'School bus users', 'Lunch users', 'Hostel students'], true), note], ['classId', 'head', 'amount', 'frequency', 'appliesTo'], { only: 'school' }),
    leaveRequests: module('Student leave notes', 'Leave note', 'Students', 'calendar', 'Leave requests sent by parents, approved by the class teacher.', [stu, req('fromDate', 'From', 'date'), req('toDate', 'To', 'date'), req('reason', 'Reason', 'textarea'), stat(['Pending', 'Approved', 'Rejected']), f('response', 'Response from school', 'textarea')], ['studentId', 'fromDate', 'toDate', 'status'], { only: 'school' }),
    notices: module('Notices', 'Notice', 'Campus', 'messages', 'Announcements for parents, students, staff or one class.', [req('name', 'Title'), req('body', 'Message', 'textarea'), sel('audience', 'Audience', ['Everyone', 'Parents', 'Students', 'Staff', 'One class'], true), ref('classId', 'Class (for one class)', 'classes'), req('publishDate', 'Publish date', 'date'), f('expiresDate', 'Show until', 'date'), sel('priority', 'Priority', ['Normal', 'Important', 'Urgent'], true), sel('sms', 'Also send as SMS', ['No', 'Yes']), stat(['Draft', 'Published'])], ['name', 'audience', 'publishDate', 'priority', 'status'], { only: 'school' }),
    homework: module('Homework & classwork', 'Assignment', 'Academics', 'book', 'Homework, classwork and projects set for a class and subject.', [ref('classId', 'Class & section', 'classes', true), ref('subjectId', 'Subject', 'subjects', true), req('name', 'Title'), f('details', 'Instructions', 'textarea'), sel('type', 'Type', ['Homework', 'Classwork', 'Project'], true), req('assignedDate', 'Assigned on', 'date'), f('dueDate', 'Due on', 'date'), stat(['Assigned', 'Closed'])], ['name', 'classId', 'subjectId', 'type', 'dueDate', 'status'], { only: 'school' }),
    homeworkChecks: module('Homework checking', 'Homework check', 'Academics', 'check', 'Whether each student completed an assignment.', [ref('homeworkId', 'Assignment', 'homework', true), stu, sel('status', 'Status', ['Done', 'Incomplete', 'Not submitted'], true), f('remark', 'Teacher remark')], ['homeworkId', 'studentId', 'status'], { only: 'school' }),
    diary: module('Teacher daily diary', 'Diary entry', 'Academics', 'clipboard', 'What each teacher covered in class each day.', [ref('facultyId', 'Teacher', 'faculty', true), req('date', 'Date', 'date'), ref('classId', 'Class & section', 'classes', true), ref('subjectId', 'Subject', 'subjects'), req('topic', 'Topic / lesson covered'), f('activities', 'Activities', 'textarea'), f('homeworkGiven', 'Homework given'), note], ['date', 'facultyId', 'classId', 'subjectId', 'topic'], { only: 'school' }),
    routes: module('Bus routes', 'Route', 'Campus', 'bus', 'School bus routes, stops, timings and the vehicle that runs them.', [name, ref('vehicleId', 'Vehicle', 'vehicles'), f('stops', 'Stops in order (one per line)', 'textarea'), f('pickupTime', 'Morning pickup starts', 'time'), f('dropTime', 'Afternoon drop starts', 'time'), num('monthlyFare', 'Monthly fare (NPR)'), stat(['Active', 'Suspended'])], ['name', 'vehicleId', 'pickupTime', 'dropTime', 'status'], { only: 'school' }),
    busAttendance: module('Bus attendance', 'Bus attendance entry', 'Campus', 'bus', 'Who boarded the school bus on each trip.', [stu, ref('routeId', 'Route', 'routes', true), req('date', 'Date', 'date'), sel('trip', 'Trip', ['Morning pickup', 'Afternoon drop'], true), sel('status', 'Status', ['Boarded', 'Absent'], true)], ['studentId', 'routeId', 'date', 'trip', 'status'], { only: 'school' }),
    certificates: module('Certificates', 'Certificate', 'Students', 'award', 'Character, transfer and other certificates issued to students.', [stu, sel('type', 'Certificate', ['Character certificate', 'Transfer certificate', 'Bonafide certificate'], true), req('certificateNo', 'Certificate number'), req('issueDate', 'Issue date', 'date'), sel('conduct', 'Conduct', ['Excellent', 'Very good', 'Good', 'Satisfactory']), f('lastClass', 'Last class studied'), f('reason', 'Reason for leaving'), f('remarks', 'Remarks', 'textarea'), stat(['Issued', 'Cancelled'])], ['certificateNo', 'studentId', 'type', 'issueDate', 'status'], { only: 'school' }),
    loans: module('Library loans', 'Loan', 'Campus', 'library', 'Books issued to students and staff, with returns and fines.', [ref('resourceId', 'Book / resource', 'library', true), ref('studentId', 'Student', 'students'), ref('facultyId', 'Teacher', 'faculty'), req('issueDate', 'Issued on', 'date'), req('dueDate', 'Due on', 'date'), f('returnDate', 'Returned on', 'date'), num('fine', 'Fine (NPR)'), stat(['Issued', 'Returned', 'Lost'])], ['resourceId', 'studentId', 'issueDate', 'dueDate', 'status'], { only: 'school' }),
    leaves: module('Staff leave', 'Leave request', 'People', 'calendar', 'Leave requested by teachers and staff, and its approval.', [ref('facultyId', 'Teacher', 'faculty'), ref('staffId', 'Staff member', 'staff'), sel('type', 'Leave type', ['Casual', 'Sick', 'Annual / home', 'Maternity', 'Paternity', 'Mourning', 'Unpaid', 'Other'], true), req('fromDate', 'From', 'date'), req('toDate', 'To', 'date'), num('days', 'Days', { required: true, min: 0.5, max: 120 }), req('reason', 'Reason', 'textarea'), stat(['Requested', 'Approved', 'Rejected']), f('approver', 'Approved / reviewed by')], ['facultyId', 'staffId', 'type', 'fromDate', 'days', 'status'], { only: 'school' }),
    salaryStructures: module('Salary structure', 'Salary structure', 'People', 'wallet', 'Monthly pay, allowances and deductions for each teacher and staff member.', [ref('facultyId', 'Teacher', 'faculty'), ref('staffId', 'Staff member', 'staff'), num('basic', 'Basic salary (NPR)', { required: true, min: 1 }), num('allowances', 'Allowances (NPR)'), sel('ssf', 'Social Security Fund (SSF)', ['Yes', 'No'], true), num('cit', 'CIT contribution (NPR)'), num('tds', 'Income tax deducted (NPR)'), num('otherDeductions', 'Other deductions (NPR)'), f('bankAccount', 'Bank account'), stat(['Active', 'Stopped'])], ['facultyId', 'staffId', 'basic', 'allowances', 'status'], { only: 'school' }),
    payslips: module('Payslips', 'Payslip', 'Finance', 'receipt', 'Monthly payslips generated from the salary structure.', [ref('facultyId', 'Teacher', 'faculty'), ref('staffId', 'Staff member', 'staff'), req('month', 'Month (BS)'), num('basic', 'Basic (NPR)', { required: true }), num('allowances', 'Allowances (NPR)'), num('ssfEmployee', 'SSF employee 11% (NPR)'), num('ssfEmployer', 'SSF employer 20% (NPR)'), num('cit', 'CIT (NPR)'), num('tds', 'Income tax (NPR)'), num('otherDeductions', 'Other deductions (NPR)'), num('unpaidDays', 'Unpaid days'), num('absenceDeduction', 'Absence deduction (NPR)'), num('net', 'Net pay (NPR)', { required: true }), stat(['Draft', 'Paid']), f('paidDate', 'Paid on', 'date')], ['month', 'facultyId', 'staffId', 'net', 'status'], { only: 'school' }),
    routine: module('Class routine', 'Routine period', 'Academics', 'calendar', 'The weekly period routine for each class and section, with subject, teacher and room.', [ref('classId', 'Class & section', 'classes', true), sel('day', 'Day', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], true), num('period', 'Period', { required: true, min: 1, max: 12 }), req('startTime', 'Starts', 'time'), req('endTime', 'Ends', 'time'), ref('subjectId', 'Subject', 'subjects'), ref('facultyId', 'Teacher', 'faculty'), f('room', 'Room')], ['classId', 'day', 'period', 'startTime', 'subjectId', 'facultyId'], { only: 'school' }),
    substitutions: module('Substitutions', 'Substitution', 'Academics', 'users', 'Who covers a period when its teacher is away.', [req('date', 'Date', 'date'), ref('routineId', 'Period', 'routine', true), ref('absentFacultyId', 'Teacher away', 'faculty'), ref('substituteId', 'Substitute teacher', 'faculty', true), f('reason', 'Reason'), stat(['Planned', 'Done', 'Cancelled'])], ['date', 'routineId', 'absentFacultyId', 'substituteId', 'status'], { only: 'school' }),
    staffAttendance: module('Staff attendance', 'Staff attendance entry', 'People', 'check', 'Daily attendance of teachers and staff, used for payroll.', [req('date', 'Date', 'date'), ref('facultyId', 'Teacher', 'faculty'), ref('staffId', 'Staff member', 'staff'), sel('status', 'Status', ['Present', 'Absent', 'Late', 'Half day', 'On leave'], true), f('checkIn', 'Check-in', 'time'), f('checkOut', 'Check-out', 'time'), note], ['date', 'facultyId', 'staffId', 'status', 'checkIn'], { only: 'school' }),
    examSchedule: module('Exam routine', 'Exam paper', 'Academics', 'calendar', 'Date, time and room of each paper in an examination.', [ref('termId', 'Examination', 'terms', true), ref('classId', 'Class & section', 'classes', true), ref('subjectId', 'Subject', 'subjects', true), req('date', 'Date', 'date'), req('startTime', 'Starts', 'time'), req('endTime', 'Ends', 'time'), f('room', 'Room'), note], ['termId', 'classId', 'subjectId', 'date', 'startTime'], { only: 'school' }),
    cas: module('Continuous assessment', 'Assessment score', 'Academics', 'clipboard', 'Continuous assessment (CAS) scores for each student, subject and area.', [stu, ref('subjectId', 'Subject', 'subjects', true), ref('termId', 'Examination', 'terms', true), sel('area', 'Area', ['Participation', 'Project & practical work', 'Classwork & homework', 'Unit tests', 'Creativity & conduct'], true), num('score', 'Score', { required: true, max: 100 }), num('outOf', 'Full marks', { required: true, min: 1, max: 100 }), f('remark', 'Remark')], ['studentId', 'subjectId', 'termId', 'area', 'score'], { only: 'school' }),
    reportRemarks: module('Report card remarks', 'Remark', 'Academics', 'messages', 'Class teacher remarks and conduct printed on the grade sheet.', [stu, ref('termId', 'Examination', 'terms', true), req('remark', 'Remark', 'textarea'), sel('conduct', 'Conduct', ['Excellent', 'Very good', 'Good', 'Satisfactory', 'Needs improvement'])], ['studentId', 'termId', 'conduct'], { only: 'school' }),
    advances: module('Advance payments', 'Advance', 'Finance', 'wallet', 'Money paid ahead of billing, adjusted automatically against the next bills.', [req('receiptNo', 'Receipt number'), stu, num('amount', 'Amount (NPR)', { required: true, min: 1 }), req('date', 'Received on', 'date'), sel('method', 'Method', ['Cash', 'Bank transfer', 'Cheque', 'Online', 'eSewa', 'Khalti', 'Fonepay'], true), f('reference', 'Reference'), num('used', 'Adjusted so far (NPR)'), stat(['Available', 'Used']), note], ['receiptNo', 'studentId', 'amount', 'date', 'status'], { only: 'school' }),
    ledgerAccounts: module('Chart of accounts', 'Account', 'Finance', 'banknote', 'Your own ledger accounts, added to the standard school accounts.', [req('code', 'Account code'), name, sel('type', 'Type', ['Asset', 'Liability', 'Equity', 'Income', 'Expense'], true), num('openingBalance', 'Opening balance (NPR)'), note], ['code', 'name', 'type', 'openingBalance'], { only: 'school' }),
    journals: module('Journal vouchers', 'Journal voucher', 'Finance', 'receipt', 'Manual entries: one debit and one credit account.', [req('voucherNo', 'Voucher number'), req('date', 'Date', 'date'), req('debitAccount', 'Debit account code'), req('creditAccount', 'Credit account code'), num('amount', 'Amount (NPR)', { required: true, min: 0.01 }), req('narration', 'Narration', 'textarea')], ['voucherNo', 'date', 'debitAccount', 'creditAccount', 'amount'], { only: 'school' }),
    events: module('School calendar', 'Calendar event', 'Campus', 'calendar', 'Holidays, events, exams and meetings, shown in Bikram Sambat.', [req('name', 'Title'), req('date', 'Date', 'date'), f('endDate', 'Until', 'date'), sel('type', 'Type', ['Public holiday', 'School holiday', 'Event', 'Examination', 'Parent–teacher meeting', 'Other'], true), sel('audience', 'Shown to', ['Everyone', 'Staff', 'Parents & students'], true), ref('classId', 'Only for class'), note], ['name', 'date', 'endDate', 'type', 'audience'], { only: 'school' }),
    messages: module('Messages', 'Message', 'Students', 'messages', 'Conversations between parents and the school about a student.', [stu, req('body', 'Message', 'textarea'), sel('fromSide', 'From', ['Family', 'School'], true), f('author', 'Written by'), sel('readByFamily', 'Read by family', ['No', 'Yes']), sel('readBySchool', 'Read by school', ['No', 'Yes'])], ['studentId', 'fromSide', 'author', 'readBySchool'], { only: 'school' }),
};


export const groupOrder = ['Institution', 'Students', 'Academics', 'People', 'Finance', 'Development', 'Campus', 'Quality'];
export const globalModules = ['departments', 'programs', 'governance', 'faculty', 'staff', 'partnerships', 'facilities', 'library', 'vehicles'];
export const roleRules = {
    'Super Admin': { read: ['*'], write: ['*'], admin: true },
    'Admin': { read: ['*'], write: ['*'] },
    'EMIS Coordinator': { read: ['*'], write: ['*'] },
    'Principal': { read: ['*'], write: ['governance', 'strategy', 'actions', 'notices', 'events', 'messages', 'classes', 'subjects', 'routine', 'substitutions', 'staffAttendance', 'leaves', 'leaveRequests', 'homework', 'homeworkChecks', 'diary', 'schoolAttendance', 'examSchedule', 'terms', 'marks', 'cas', 'reportRemarks', 'certificates', 'admissions', 'enquiries', 'students', 'faculty', 'staff', 'development', 'grievances', 'services', 'feedback'] },
    'Campus Chief': { read: ['*'], write: ['governance', 'strategy', 'actions'] },
    'IQAC Head': { read: ['*'], write: ['evidence', 'feedback', 'actions', 'strategy', 'governance'] },
    'Program Director': { read: ['programs', 'departments', 'students', 'admissions', 'courses', 'timetable', 'attendance', 'exams', 'results', 'faculty', 'feedback', 'placements', 'alumni'], write: ['courses', 'timetable', 'attendance', 'exams', 'results', 'feedback'] },
    'Academic Coordinator': { read: ['routine', 'substitutions', 'examSchedule', 'cas', 'reportRemarks', 'events', 'messages', 'staffAttendance', 'notices', 'homework', 'homeworkChecks', 'diary', 'leaveRequests', 'classes', 'subjects', 'schoolAttendance', 'terms', 'marks', 'programs', 'departments', 'students', 'admissions', 'courses', 'timetable', 'attendance', 'exams', 'results', 'faculty', 'feedback', 'governance'], write: ['routine', 'substitutions', 'examSchedule', 'cas', 'reportRemarks', 'events', 'messages', 'notices', 'homework', 'diary', 'leaveRequests', 'classes', 'subjects', 'schoolAttendance', 'terms', 'programs', 'courses', 'timetable', 'attendance', 'feedback'] },
    'Exam Coordinator': { read: ['routine', 'examSchedule', 'cas', 'reportRemarks', 'events', 'notices', 'classes', 'subjects', 'schoolAttendance', 'terms', 'marks', 'programs', 'students', 'courses', 'exams', 'results', 'attendance', 'faculty'], write: ['examSchedule', 'cas', 'reportRemarks', 'terms', 'marks', 'exams', 'results'] },
    'HR/Admin': { read: ['staffAttendance', 'routine', 'substitutions', 'events', 'leaves', 'salaryStructures', 'payslips', 'routes', 'busAttendance', 'notices', 'departments', 'faculty', 'staff', 'development', 'facilities', 'governance', 'vehicles'], write: ['staffAttendance', 'substitutions', 'leaves', 'salaryStructures', 'routes', 'busAttendance', 'departments', 'faculty', 'staff', 'development', 'facilities', 'governance', 'vehicles'] },
    'Research Head': { read: ['faculty', 'programs', 'research', 'publications', 'outreach', 'partnerships'], write: ['research', 'publications', 'outreach', 'partnerships'] },
    'Finance Head': { read: ['advances', 'ledgerAccounts', 'journals', 'events', 'staffAttendance', 'salaryStructures', 'payslips', 'notices', 'faculty', 'staff', 'classes', 'feeHeads', 'students', 'programs', 'departments', 'fees', 'payments', 'transactions', 'budgets', 'scholarships'], write: ['advances', 'ledgerAccounts', 'journals', 'payslips', 'feeHeads', 'fees', 'payments', 'transactions', 'budgets', 'scholarships'] },
    'Library': { read: ['events', 'loans', 'faculty', 'notices', 'library', 'students', 'programs'], write: ['loans', 'library'] },
    'Student Affairs': { read: ['messages', 'events', 'routine', 'certificates', 'notices', 'leaveRequests', 'classes', 'classes', 'visitors', 'students', 'programs', 'enquiries', 'admissions', 'services', 'grievances', 'scholarships', 'placements', 'partnerships'], write: ['messages', 'events', 'certificates', 'notices', 'leaveRequests', 'visitors', 'enquiries', 'admissions', 'students', 'services', 'grievances'] },
    'Alumni Coordinator': { read: ['alumni', 'placements', 'partnerships', 'students', 'programs', 'feedback'], write: ['alumni', 'placements', 'partnerships', 'feedback'] },
    'IT Officer': { read: ['facilities', 'library'], write: ['facilities'] },
    'Faculty': { read: ['routine', 'substitutions', 'staffAttendance', 'examSchedule', 'cas', 'reportRemarks', 'events', 'messages', 'notices', 'homework', 'homeworkChecks', 'diary', 'leaveRequests', 'leaves', 'payslips', 'salaryStructures', 'classes', 'subjects', 'schoolAttendance', 'terms', 'marks', 'faculty', 'programs', 'courses', 'students', 'timetable', 'attendance', 'exams', 'results'], write: ['cas', 'reportRemarks', 'messages', 'homework', 'homeworkChecks', 'diary', 'leaveRequests', 'leaves', 'schoolAttendance', 'marks', 'attendance', 'results'] },
    'Parent': { read: ['routine', 'examSchedule', 'events', 'messages', 'advances', 'reportRemarks', 'students', 'classes', 'subjects', 'schoolAttendance', 'terms', 'marks', 'feeHeads', 'fees', 'payments', 'scholarships', 'notices', 'homework', 'homeworkChecks', 'leaveRequests', 'routes', 'busAttendance', 'certificates', 'loans'], write: ['messages', 'leaveRequests'] },
    'Student': { read: ['routine', 'examSchedule', 'events', 'reportRemarks', 'notices', 'homework', 'homeworkChecks', 'leaveRequests', 'routes', 'busAttendance', 'certificates', 'loans', 'classes', 'subjects', 'schoolAttendance', 'terms', 'marks', 'feeHeads', 'programs', 'courses', 'students', 'timetable', 'attendance', 'exams', 'results', 'fees', 'payments', 'scholarships', 'grievances', 'placements', 'partnerships'], write: ['grievances'] }
};
/** School and college workspaces share one schema; fields and modules marked `only` belong to one kind. */
const fullSpecs = Object.fromEntries(Object.entries(modules).map(([k, m]) => [k, { fields: m.fields, columns: m.columns }]));
export const kindOf = (kind) => (kind === 'school' ? 'school' : 'college');
export const forKind = (item, kind) => !item?.only || item.only === kindOf(kind);
export function specFor(entity, kind) {
    const m = modules[entity], base = fullSpecs[entity];
    if (!m || !base) return m;
    const k = kindOf(kind), fields = base.fields.filter(x => forKind(x, k));
    const keys = new Set(fields.map(x => x.key));
    const columns = (k === 'school' && m.schoolColumns) ? m.schoolColumns : base.columns.filter(c => keys.has(c));
    return { ...m, fields, columns };
}
let activeKind = null;
/** Browser only: shape the shared module definitions for the signed-in institution. */
export function applyKind(kind) {
    activeKind = kindOf(kind);
    for (const k of Object.keys(modules)) { const spec = specFor(k, activeKind); modules[k].fields = spec.fields; modules[k].columns = spec.columns; }
}
export const moduleAvailable = (entity, kind = activeKind) => !kind || forKind(modules[entity], kind);
export const can = (role, entity, operation = 'read') => { if (!moduleAvailable(entity)) return false; const rules = roleRules[normalizeRole(role)]?.[operation] || []; return rules.includes('*') || rules.includes(entity); };
export const titleOf = (r) => r?.name || r?.studentNo || r?.invoiceNo || r?.receiptNo || r?.voucherNo || r?.reference || r?.code || (r?.day && r?.period ? `${r.day} · period ${r.period} (${r.startTime}–${r.endTime})` : null) || (r?.body ? String(r.body).slice(0, 60) : null) || r?.area || r?.id || '—';
export function cleanRecord(entity, input, kind = null) {
    const spec = kind ? specFor(entity, kind) : modules[entity];
    if (!spec)
        throw new Error('Unknown module.');
    if (kind && !forKind(modules[entity], kind))
        throw new Error(kindOf(kind) === 'school' ? 'This register is used by colleges, not schools.' : 'This register is used by schools, not colleges.');
    const value = {};
    if (typeof input.year !== 'string' || !/^\d{4}\/\d{2}$/.test(input.year))
        throw new Error('Choose a valid academic year (YYYY/YY).');
    value.year = input.year;
    for (const field of spec.fields) {
        let v = input[field.key];
        if (v === undefined || v === null || v === '') {
            if (field.required)
                throw new Error(`${field.label} is required.`);
            continue;
        }
        if (field.type === 'number') {
            v = Number(v);
            if (!Number.isFinite(v) || (field.min !== undefined && v < field.min) || (field.max !== undefined && v > field.max))
                throw new Error(`${field.label} must be between ${field.min ?? 0} and ${field.max ?? 'a valid positive number'}.`);
        }
        else {
            if (typeof v !== 'string')
                throw new Error(`${field.label} must be text.`);
            v = v.trim();
            if (field.required && !v)
                throw new Error(`${field.label} is required.`);
            if (v.length > (field.type === 'textarea' ? 12000 : 600))
                throw new Error(`${field.label} is too long.`);
            if (field.type === 'select' && !field.options.includes(v))
                throw new Error(`Invalid ${field.label.toLowerCase()}.`);
            if (field.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
                throw new Error('Enter a valid email address.');
            if (field.type === 'date' && v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v))
                throw new Error(`Invalid ${field.label.toLowerCase()}.`);
            if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
                throw new Error('Enter a valid time.');
            if (field.type === 'url' && v) {
                try {
                    const u = new URL(v);
                    if (!['https:', 'http:'].includes(u.protocol))
                        throw new Error();
                }
                catch {
                    throw new Error('Use a complete http or https URL.');
                }
            }
        }
        if (['amount', 'funding', 'salary', 'budget'].includes(field.key) && typeof v === 'number' && Math.abs(v * 100 - Math.round(v * 100)) > 0.00001)
            throw new Error(`${field.label} supports at most two decimal places.`);
        value[field.key] = v;
    }
    if (entity === 'exams' && value.passMarks > value.maxMarks)
        throw new Error('Pass marks cannot exceed maximum marks.');
    if (entity === 'visitors' && value.arrivalTime && value.departureTime && value.departureTime < value.arrivalTime) throw new Error('Departure time must be after arrival time.');
    if (entity === 'timetable' && value.endTime <= value.startTime)
        throw new Error('End time must be after start time.');
    if (value.startDate && value.endDate && value.endDate < value.startDate)
        throw new Error('End date must be after start date.');
    return value;
}
export function resolveProgram(entity, row, records) {
    if (entity === 'programs')
        return row.id;
    if (row.programId)
        return row.programId;
    if (row.studentId)
        return records.students?.find(x => x.id === row.studentId)?.programId;
    if (row.courseId)
        return records.courses?.find(x => x.id === row.courseId)?.programId;
    if (row.examId) {
        const ex = records.exams?.find(x => x.id === row.examId);
        return ex && resolveProgram('exams', ex, records);
    }
    if (row.invoiceId) {
        const inv = records.fees?.find(x => x.id === row.invoiceId);
        return inv && resolveProgram('fees', inv, records);
    }
    return undefined;
}
const todayIso = () => new Date().toISOString().slice(0, 10);
export function studentEnrollments(user, records) {
    if (user.role === 'Parent') {
        const people = new Set(user.childPersonIds || []);
        return (records.students || []).filter(s => people.has(s.personId || s.id));
    }
    const anchor = records.students?.find(s => s.id === user.studentId);
    if (!anchor) return [];
    const personId = anchor.personId || anchor.id;
    return records.students.filter(s => (s.personId || s.id) === personId);
}
/** Classes a teacher looks after: as class teacher (homeroom) or through a subject they teach. */
export function schoolClassesFor(facultyId, records) {
    const homeroom = new Set((records.classes || []).filter(c => facultyId && c.classTeacherId === facultyId).map(c => c.id));
    const all = new Set([...homeroom, ...(records.subjects || []).filter(x => facultyId && x.teacherId === facultyId).map(x => x.classId)]);
    return { homeroom, all };
}
export function scopeRecord(user, entity, row, records, write = false) {
    if (!can(user.role, entity, write ? 'write' : 'read'))
        return false;
    if (user.role === 'Student' || user.role === 'Parent') {
        const enrollments = studentEnrollments(user, records);
        const ownIds = new Set(enrollments.map(s => s.id));
        if (entity === 'students')
            return ownIds.has(row.id) && !write;
        const ownClasses = new Set(enrollments.map(x => x.classId).filter(Boolean));
        if (entity === 'notices') {
            if (row.status !== 'Published' || (row.publishDate && row.publishDate > todayIso()) || (row.expiresDate && row.expiresDate < todayIso())) return false;
            return row.audience === 'Everyone' || (row.audience === 'Parents' && user.role === 'Parent') || (row.audience === 'Students' && user.role === 'Student') || (row.audience === 'One class' && ownClasses.has(row.classId));
        }
        if (entity === 'homework')
            return ownClasses.has(row.classId) && (!write);
        if (entity === 'routes')
            return enrollments.some(x => x.routeId === row.id);
        if (entity === 'leaveRequests')
            return ownIds.has(row.studentId) && (!write || (user.role === 'Parent' && row.status === 'Pending'));
        if (entity === 'classes')
            return ownClasses.has(row.id);
        if (entity === 'subjects')
            return ownClasses.has(row.classId);
        if (entity === 'terms')
            return ownClasses.size > 0;
        if (entity === 'feeHeads')
            return ownClasses.size > 0 && (!row.classId || ownClasses.has(row.classId));
        if (entity === 'routine' || entity === 'examSchedule')
            return ownClasses.has(row.classId) && !write;
        if (entity === 'events')
            return row.audience !== 'Staff' && (!row.classId || ownClasses.has(row.classId)) && !write;
        if (entity === 'reportRemarks')
            return ownIds.has(row.studentId) && !write && records.terms?.find(t => t.id === row.termId)?.status === 'Published';
        if (row.studentId)
            return ownIds.has(row.studentId) && (!['results', 'marks'].includes(entity) || row.status === 'Published');
        if (entity === 'payments') {
            const inv = records.fees?.find(x => x.id === row.invoiceId);
            return !!inv && ownIds.has(inv.studentId);
        }
        if (entity === 'partnerships')
            return records.placements?.some(x => ownIds.has(x.studentId) && x.partnerId === row.id);
        const programId = resolveProgram(entity, row, records);
        return !!programId && enrollments.some(s => !!s.programId && s.programId === programId && (globalModules.includes(entity) || s.year === row.year));
    }
    if (user.role === 'Faculty') {
        if (entity === 'faculty')
            return row.id === user.facultyId;
        if (['diary', 'leaves', 'payslips', 'salaryStructures'].includes(entity))
            return row.facultyId === user.facultyId && (entity !== 'payslips' && entity !== 'salaryStructures' || !write);
        if (entity === 'notices') {
            if (row.status !== 'Published') return false;
            return ['Everyone', 'Staff'].includes(row.audience) || (row.audience === 'One class' && schoolClassesFor(user.facultyId, records).all.has(row.classId));
        }
        if (['routine', 'substitutions', 'examSchedule', 'events'].includes(entity))
            return !write;
        if (entity === 'staffAttendance')
            return row.facultyId === user.facultyId && !write;
        if (entity === 'reportRemarks' || entity === 'messages') {
            const taught = schoolClassesFor(user.facultyId, records), st = records.students?.find(x => x.id === row.studentId);
            return !!st && (entity === 'reportRemarks' && write ? taught.homeroom.has(st.classId) : taught.all.has(st.classId));
        }
        if (['homework', 'leaveRequests', 'homeworkChecks'].includes(entity)) {
            const taught = schoolClassesFor(user.facultyId, records);
            if (entity === 'homework') return taught.all.has(row.classId);
            if (entity === 'homeworkChecks') { const hw = records.homework?.find(x => x.id === row.homeworkId); return !!hw && taught.all.has(hw.classId); }
            const st = records.students?.find(x => x.id === row.studentId);
            return !!st && (write ? taught.homeroom.has(st.classId) : taught.all.has(st.classId));
        }
        if (['classes', 'subjects', 'terms', 'schoolAttendance', 'marks', 'cas'].includes(entity) || (entity === 'students' && row.classId)) {
            const taught = schoolClassesFor(user.facultyId, records);
            if (entity === 'terms') return taught.all.size > 0;
            if (entity === 'classes') return taught.all.has(row.id);
            if (entity === 'subjects') return taught.all.has(row.classId);
            if (entity === 'students') return taught.all.has(row.classId);
            if (entity === 'schoolAttendance') return taught.all.has(row.classId);
            const subject = records.subjects?.find(x => x.id === row.subjectId);
            return !!subject && (subject.teacherId === user.facultyId || taught.homeroom.has(subject.classId));
        }
        const courses = records.courses?.filter(x => x.facultyId === user.facultyId) || [];
        if (entity === 'courses')
            return courses.some(x => x.id === row.id);
        if (row.courseId)
            return courses.some(x => x.id === row.courseId);
        if (row.examId) {
            const e = records.exams?.find(x => x.id === row.examId);
            return !!e && courses.some(x => x.id === e.courseId);
        }
        const programId = resolveProgram(entity, row, records);
        return !!programId && courses.some(x => x.programId === programId);
    }
    if (user.role === 'Program Director') {
        if (entity === 'faculty')
            return records.courses?.some(x => x.programId === user.programId && x.facultyId === row.id);
        if (entity === 'departments')
            return records.programs?.some(x => x.id === user.programId && x.departmentId === row.id);
        return resolveProgram(entity, row, records) === user.programId;
    }
    return true;
}
export function csvCell(value) { const s = String(value ?? ''); return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"'; }
export const asCSV = (rows, keys) => [keys.map(csvCell).join(','), ...rows.map(r => keys.map(k => csvCell(r[k])).join(','))].join('\r\n');
export function invoiceBalance(invoice, payments) {
    const invoiced = Math.round(invoice.amount * 100);
    const paid = payments.filter(p => p.invoiceId === invoice.id).reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
    return { paid: paid / 100, balance: (invoiced - paid) / 100, settled: paid >= invoiced };
}
export function calculateIndicators(records, year) {
    const rows = k => (records[k] || []).filter(r => globalModules.includes(k) || r.year === year);
    const students = rows('students'), active = students.filter(s => s.status === 'Active'), female = students.filter(s => s.gender === 'Female').length, male = students.filter(s => s.gender === 'Male').length;
    const faculty = rows('faculty').filter(f => f.status === 'Active'), results = rows('results').filter(r => r.status === 'Published');
    const exams = Object.fromEntries(rows('exams').map(r => [r.id, r]));
    const assessed = results.filter(r => exams[r.examId]), passed = assessed.filter(r => r.marks >= exams[r.examId].passMarks);
    const payments = rows('payments').reduce((s, r) => s + r.amount, 0), invoices = rows('fees').reduce((s, r) => s + r.amount, 0), income = rows('transactions').filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0) + payments, expense = rows('transactions').filter(t => t.type === 'Expenditure').reduce((s, t) => s + t.amount, 0);
    const attendance = rows('attendance').filter(r => r.status !== 'Excused'), attended = attendance.filter(r => ['Present', 'Late'].includes(r.status));
    const evidence = rows('evidence'), verified = evidence.filter(r => r.status === 'Verified');
    return { students: students.length, active: active.length, female, male, other: students.filter(r => r.gender === 'Other').length, undisclosed: students.filter(r => r.gender === 'Not disclosed').length, faculty: faculty.length, fullTime: faculty.filter(r => r.employment === 'Full-time').length, ratio: faculty.length ? active.length / faculty.length : null, gpi: male ? female / male : null, passRate: assessed.length ? passed.length / assessed.length * 100 : null, assessed: assessed.length, passed: passed.length, attendance: attendance.length ? attended.length / attendance.length * 100 : null, income, expense, payments, invoices, outstanding: invoices - payments, evidence: evidence.length, verified: verified.length, readiness: evidence.length ? verified.length / evidence.length * 100 : null, graduates: students.filter(r => r.status === 'Graduated').length, dropouts: students.filter(r => r.status === 'Dropped out').length, scholarships: rows('scholarships').reduce((s, r) => s + r.amount, 0), research: rows('research').length, publications: rows('publications').length, year };
}
