/** College-level access hierarchy. This does not grant access to another institution. */
export const roleDescriptions = {
  'Super Admin': 'Complete college EMIS oversight, administrator accounts, roles, exports and system controls.',
  'Admin': 'Daily college operations and lower-level staff/student accounts. Cannot manage Admin or Super Admin accounts.',
  'Principal': 'School only: leads the school. Sees every record; manages academics, routine, exams and results, notices, calendar, leave and staff attendance. Cannot manage user accounts or finance entries.',
  'Campus Chief': 'Institutional dashboard and reporting; governance, strategy and improvement plans.',
  'EMIS Coordinator': 'Institutional records, data quality, academic years and reporting.',
  'IQAC Head': 'Institutional reporting and quality review; QAA evidence, feedback and improvement plans.',
  'Program Director': 'Academic and student records for the explicitly assigned program.',
  'Academic Coordinator': 'Programs, teaching plans, courses, timetable, attendance and academic feedback.',
  'Exam Coordinator': 'Examination schedules, draft review and publication of results.',
  'HR/Admin': 'Faculty, non-teaching staff, departments, development, facilities and vehicles.',
  'Research Head': 'Research projects, publications, outreach and industry partnerships.',
  'Finance Head': 'Invoices, receipts, income, expenditure, budgets and scholarships.',
  'Library': 'Library resources and the student information needed for library work.',
  'Student Affairs': 'Enquiries, admissions, enrollments, front office and student support.',
  'Alumni Coordinator': 'Alumni, placements, partnerships and graduate feedback.',
  'IT Officer': 'Facilities and ICT resources; no authority to grant administrative accounts.',
  'Faculty': 'Assigned courses and their students; attendance and draft assessment marks.',
  'Student': 'Personal enrollment, published results, attendance, invoices, receipts and support requests.',
  'Parent': 'School only: their own children’s attendance, homework, published results, fees and notices; can send leave notes.'
};
export const ROLES = Object.keys(roleDescriptions);
// Existing installations retain their owner access without a destructive data migration.
export const normalizeRole = role => role === 'Administrator' ? 'Super Admin' : role;
export const isSuperAdmin = role => normalizeRole(role) === 'Super Admin';
export const canManageUsers = role => ['Super Admin', 'Admin'].includes(normalizeRole(role));
export const canManageInstitution = role => canManageUsers(role) || role === 'EMIS Coordinator';
export const canViewInstitution = role => canManageInstitution(role) || ['Principal', 'Campus Chief', 'IQAC Head'].includes(role);
/** Roles that exist only in one kind of workspace. */
export const SCHOOL_ONLY_ROLES = ['Principal'];
export const roleAvailable = (role, kind) => !SCHOOL_ONLY_ROLES.includes(normalizeRole(role)) || kind === 'school';
export const rolesForKind = (roles, kind) => roles.filter(r => roleAvailable(r, kind));
export const assignableRoles = role => isSuperAdmin(role) ? [...ROLES] : normalizeRole(role) === 'Admin' ? ROLES.filter(r => !['Super Admin', 'Admin'].includes(r)) : [];
export const canManageRole = (actorRole, targetRole) => assignableRoles(actorRole).includes(normalizeRole(targetRole));
export const roleLevel = role => isSuperAdmin(role) ? 1 : role === 'Admin' ? 2 : role === 'Faculty' ? 4 : role === 'Student' || role === 'Parent' ? 5 : 3;
export const roleScope = role => role === 'Parent' ? 'Their own children only' : role === 'Student' ? 'Own records only' : role === 'Faculty' ? 'Assigned courses and their students' : role === 'Program Director' ? 'Assigned program only' : 'Permitted college modules';
export const roleLink = role => ({ Student: ['studentId', 'students', 'Student profile'], Faculty: ['facultyId', 'faculty', 'Faculty profile'], 'Program Director': ['programId', 'programs', 'Assigned program'] })[normalizeRole(role)];
