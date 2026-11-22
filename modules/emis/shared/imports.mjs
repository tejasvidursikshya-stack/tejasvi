import { modules } from './schema.mjs';
export const referenceCodes = {
    departmentId: { column: 'departmentCode', key: 'code' },
    programId: { column: 'programCode', key: 'code' },
    studentId: { column: 'studentNo', key: 'studentNo' },
    facultyId: { column: 'facultyEmployeeNo', key: 'employeeNo' },
    staffId: { column: 'staffEmployeeNo', key: 'employeeNo' },
    courseId: { column: 'courseCode', key: 'code' },
    invoiceId: { column: 'invoiceNo', key: 'invoiceNo' },
    // School registers: a class is named the way people write it, e.g. "Grade 6 A" or "Grade 6 · A".
    classId: { column: 'class', key: 'name', match: (r, v) => classKey(`${r.name} ${r.section || ''}`) === classKey(v) },
    routeId: { column: 'routeName', key: 'name' },
    teacherId: { column: 'teacherEmployeeNo', key: 'employeeNo' },
    classTeacherId: { column: 'classTeacherEmployeeNo', key: 'employeeNo' },
    vehicleId: { column: 'vehicleRegistrationNo', key: 'registrationNo' },
    termId: { column: 'examination', key: 'name' },
    resourceId: { column: 'accessionNo', key: 'accessionNo' }
};
const classKey = v => String(v || '').toLowerCase().replace(/[·,\-–]/g, ' ').replace(/\bsection\b/g, ' ').replace(/\s+/g, ' ').trim();
export function importColumns(entity, useCodes = true) {
    return ['year', ...modules[entity].fields.map(f => useCodes && f.type === 'relation' && referenceCodes[f.key] ? referenceCodes[f.key].column : f.key)];
}
export function allowedImportColumns(entity) {
    return [...new Set([...importColumns(entity), ...importColumns(entity, false)])];
}
