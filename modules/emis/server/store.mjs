import {profile as readProfile,saveProfile,recordChanged,json as recordJson} from '../../../lib/campus-data.mjs';
import { MySQLDatabase } from './database.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { modules, globalModules, cleanRecord, scopeRecord, invoiceBalance } from '../shared/schema.mjs';
import { validateSchool } from './school.mjs';
export class Store {
    constructor(db){this.db=db;this.org=db.org;}
    async meta(key,fallback=null){return key==='profile'?await readProfile(this.db.connection(),this.org):fallback;}
    async setMeta(key,value){if(key==='profile')return saveProfile(this.db.connection(),this.org,value);throw Error('Unknown institution setting.');}
    async all() { const result = Object.fromEntries(Object.keys(modules).map(k => [k, []])); for (const r of (await this.db.prepare('SELECT r.*,l.person_id,l.previous_id FROM emis_records r LEFT JOIN emis_student_links l ON l.org_id=r.org_id AND l.student_id=r.id WHERE r.org_id=:org AND r.archived=0 ORDER BY r.created_at DESC,r.id').all())) {
        if (result[r.entity])
            result[r.entity].push({ ...recordJson(r.data), id: r.id, year: r.year, version: r.version, sample: !!r.sample, createdAt: r.created_at, updatedAt: r.updated_at, ...(r.entity === 'students' ? { personId: r.person_id || r.id, previousEnrollmentId: r.previous_id || null } : {}) });
    } return result; }
    async get(id) { if (typeof id !== 'string' || !id) return null; const r = (await this.db.prepare('SELECT r.*,l.person_id,l.previous_id FROM emis_records r LEFT JOIN emis_student_links l ON l.org_id=r.org_id AND l.student_id=r.id WHERE r.org_id=:org AND r.id=? AND r.archived=0').get(id)); return r ? { ...recordJson(r.data), id: r.id, entity: r.entity, year: r.year, version: r.version, sample: !!r.sample, createdAt: r.created_at, updatedAt: r.updated_at, ...(r.entity === 'students' ? { personId: r.person_id || r.id, previousEnrollmentId: r.previous_id || null } : {}) } : null; }
    /** @param {any} user @param {string} action @param {string|null} entity @param {string|null} id @param {any} before @param {any} after */
    async log(user, action, entity = null, id = null, before = null, after = null) { (await this.db.prepare('INSERT INTO emis_audit(org_id,actor,actor_id,action,entity,record_id,before_data,after_data,created_at) VALUES(:org,?,?,?,?,?,?,?,?)').run(user?.name || 'System', user?.id || null, action, entity, id, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, new Date().toISOString())); }
    tx(fn) { return this.db.tx(fn); }
    async insertRaw(entity, value, id = randomUUID(), sample = false) { const time = new Date().toISOString(); (await this.db.prepare('INSERT INTO emis_records(org_id,id,entity,year,data,sample,created_at,updated_at) VALUES(:org,?,?,?,?,?,?,?)').run(id, entity, value.year, JSON.stringify(value), sample ? 1 : 0, time, time)); if (entity === 'students') (await this.db.prepare('INSERT INTO emis_student_links(org_id,student_id,person_id) VALUES(:org,?,?)').run(id, id)); return (await this.get(id)); }
    async validate(entity, value, id, user, internal = false) {
        const kind = (await this.meta('profile'))?.kind, r = cleanRecord(entity, value, kind), all = (await this.all());
        const byId = new Map(Object.entries(all).flatMap(([entity, rows]) => rows.map(row => [row.id, { ...row, entity }])));
        const find = id => byId.get(id);
        for (const field of modules[entity].fields.filter(f => f.type === 'relation')) {
            if (!r[field.key])
                continue;
            const linked = find(r[field.key]);
            if (!linked || linked.entity !== field.entity)
                throw new Error(`${field.label} no longer exists.`);
            if (!globalModules.includes(field.entity) && linked.year !== r.year)
                throw new Error(`${field.label} must belong to the same academic year.`);
        }
        if (!scopeRecord(user, entity, { ...r, id: id || '' }, all, true))
            throw Object.assign(new Error('You do not have access to change this record.'), { status: 403 });
        const dup = (keys, sameYear = true) => all[entity].some(x => x.id !== id && (!sameYear || x.year === r.year) && keys.every(k => x[k] === r[k]));
        const unique = { vehicles: 'registrationNo', students: 'studentNo', admissions: 'applicationNo', programs: 'code', departments: 'code', faculty: 'employeeNo', staff: 'employeeNo', courses: 'code', fees: 'invoiceNo', payments: 'receiptNo', transactions: 'reference', facilities: 'assetNo', library: 'accessionNo' }[entity];
        if (unique && dup([unique], !globalModules.includes(entity)))
            throw new Error(`${modules[entity].fields.find(f => f.key === unique).label} already exists.`);
        if (entity === 'attendance' && dup(['studentId', 'courseId', 'date']))
            throw new Error('Attendance is already recorded for this student, course and date.');
        if (entity === 'results' && dup(['studentId', 'examId']))
            throw new Error('This student already has a result for this examination.');
        if (entity === 'results' || entity === 'attendance') {
            const st = find(r.studentId), exam = entity === 'results' ? find(r.examId) : null, course = find(exam ? exam.courseId : r.courseId);
            if (st.programId !== course.programId)
                throw new Error('Student and course must belong to the same program.');
            if (entity === 'attendance' && Number(st.semester) !== Number(course.semester))
                throw new Error('Student and course must belong to the same semester.');
            if (exam && r.marks > exam.maxMarks)
                throw new Error(`Marks cannot exceed ${exam.maxMarks}.`);
            if (user.role === 'Faculty' && r.status === 'Published')
                throw new Error('Faculty may save draft marks. The Exam Coordinator publishes results.');
            if (user.role === 'Faculty' && id && find(id)?.status === 'Published')
                throw new Error('Published results can only be revised by the examination team.');
        }
        if (kind === 'school')
            validateSchool(entity, r, id, all, find, user);
        if (entity === 'payments') {
            const inv = find(r.invoiceId);
            const { balance } = invoiceBalance(inv, all.payments.filter(p => p.id !== id));
            if (Math.round(r.amount * 100) > Math.round(balance * 100))
                throw new Error(`Payment exceeds the outstanding balance of NPR ${balance.toLocaleString()}.`);
        }
        if (id) {
            const old = find(id);
            if (entity === 'students' && (await this.db.prepare('SELECT student_id FROM emis_student_links WHERE org_id=:org AND previous_id=?').get(id)) && ['studentNo', 'programId', 'semester'].some(k => old[k] !== r[k]))
                throw new Error('This enrollment has been rolled forward. Preserve its student ID, program and semester; edit the new enrollment instead.');
            if (entity === 'fees' && old.studentId !== r.studentId && all.payments.some(x => x.invoiceId === id))
                throw new Error('A paid invoice cannot be reassigned to another student.');
            if (entity === 'students' && old.programId !== r.programId && [...all.attendance, ...all.results, ...all.fees].some(x => x.studentId === id))
                throw new Error('This student has academic or fee records. Keep the existing program for this enrollment and create a new enrollment for a transfer.');
            if (entity === 'courses' && (old.programId !== r.programId || old.year !== r.year) && [...all.attendance, ...all.exams, ...all.timetable].some(x => x.courseId === id))
                throw new Error('A course with attendance, exams or timetable entries cannot be moved to a different program or year.');
            if (entity === 'exams' && (old.courseId !== r.courseId || old.year !== r.year) && all.results.some(x => x.examId === id))
                throw new Error('An examination with results cannot be reassigned to another course or year.');
            if (old.year !== r.year)
                throw new Error('Academic years are preserved. Create a new record for a different year.');
        }
        if (entity === 'fees' && id) {
            const { paid } = invoiceBalance({ ...r, id }, all.payments);
            if (Math.round(r.amount * 100) < Math.round(paid * 100))
                throw new Error('Invoice amount cannot be less than payments received.');
        }
        if (entity === 'exams' && id && all.results.some(x => x.examId === id && x.marks > r.maxMarks))
            throw new Error('Existing marks exceed the new examination maximum.');
        if (entity === 'admissions' && !internal) {
            if (r.status === 'Enrolled' && find(id)?.status !== 'Enrolled')
                throw new Error('Use Enroll student to create a linked student record.');
            if (id && find(id)?.status === 'Enrolled')
                throw new Error('An enrolled application is locked. Update the linked student profile.');
        }
        if (entity === 'grievances' && user.role === 'Student') {
            if (r.status !== 'Open' || r.responsible || r.resolution)
                throw new Error('Students may submit open grievances; only Student Affairs can resolve them.');
            if (id)
                throw new Error('Submitted grievances cannot be changed by the student.');
        }
        if (entity === 'timetable') {
            const course = find(r.courseId);
            const conflict = all.timetable.some(x => x.id !== id && x.year === r.year && x.day === r.day && r.startTime < x.endTime && x.startTime < r.endTime && (x.room === r.room || find(x.courseId)?.facultyId === course.facultyId || x.courseId === r.courseId));
            if (conflict)
                throw new Error('This time overlaps another class for the room, course or assigned faculty.');
        }
        return r;
    }
    async save(user, entity, input, id = null, internal = false) {
        const old = id ? (await this.get(id)) : null;
        if (id && (!old || old.entity !== entity))
            throw Object.assign(new Error('Record not found.'), { status: 404 });
        if (old && !scopeRecord(user, entity, old, (await this.all()), true))
            throw Object.assign(new Error('Permission denied.'), { status: 403 });
        if (old && Number(input.version) !== old.version)
            throw Object.assign(new Error('This record changed since you opened it. Refresh and try again.'), { status: 409 });
        const value = (await this.validate(entity, input, id, user, internal));
        let result;
        if (old) {
            const data = { ...value };
            if (old.enrolledStudentId)
                data.enrolledStudentId = old.enrolledStudentId;
            (await this.db.prepare('UPDATE emis_records SET year=?,data=?,version=version+1,updated_at=? WHERE org_id=:org AND id=?').run(value.year, JSON.stringify(data), new Date().toISOString(), id));
            result = (await this.get(id));
        }
        else
            result = (await this.insertRaw(entity, value));
        (await this.log(user, old ? 'updated' : 'created', entity, result.id, old, result));
        await recordChanged(this.db.connection(),this.org,entity,result);
        return result;
    }
    async archive(user, entity, id, version) {
        const r = (await this.get(id));
        if (!r || r.entity !== entity)
            throw Object.assign(new Error('Record not found.'), { status: 404 });
        if (!scopeRecord(user, entity, r, (await this.all()), true) || ['Student', 'Faculty'].includes(user.role))
            throw Object.assign(new Error('Permission denied.'), { status: 403 });
        if (Number(version) !== r.version)
            throw Object.assign(new Error('Record changed. Refresh first.'), { status: 409 });
        if (entity === 'admissions' && r.status === 'Enrolled')
            throw new Error('Enrolled applications are retained for the admission audit trail.');
        if (entity === 'students' && (await this.db.prepare('SELECT student_id FROM emis_student_links WHERE org_id=:org AND previous_id=?').get(id)))
            throw new Error('This enrollment is linked to a later academic year and must be retained.');
        const all = (await this.all());
        for (const [key, spec] of Object.entries(modules)) {
            for (const field of spec.fields.filter(f => f.entity === entity)) {
                if (all[key].some(x => x[field.key] === id))
                    throw new Error(`This record is referenced in ${spec.title}. Update those records first, or change its status instead.`);
            }
        }
        const assigned = (await this.db.prepare('SELECT user_id AS id FROM emis_roles WHERE org_id=:org AND (student_id=? OR faculty_id=? OR program_id=?)').get(id, id, id));
        if (assigned)
            throw new Error('A login account is linked to this record. Update the account first.');
        (await this.db.prepare('UPDATE emis_records SET archived=1,version=version+1,updated_at=? WHERE org_id=:org AND id=?').run(new Date().toISOString(), id));
        (await this.log(user, 'archived', entity, id, r, null));
    }
}
