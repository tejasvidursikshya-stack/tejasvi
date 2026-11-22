import { canManageInstitution } from '../shared/access.mjs';
import { createHash, randomUUID } from 'node:crypto';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const canRollover = role => canManageInstitution(role);
export function validAcademicYear(value) {
    return typeof value === 'string' && /^\d{4}\/\d{2}$/.test(value) && Number(value.slice(5)) === (Number(value.slice(0, 4)) + 1) % 100;
}

function normalize(input) {
    const { sourceYear, targetYear, students } = input;
    if (!validAcademicYear(sourceYear) || !validAcademicYear(targetYear) || Number(targetYear.slice(0, 4)) !== Number(sourceYear.slice(0, 4)) + 1)
        throw fail('Choose consecutive academic years, for example 2026/27 → 2027/28.');
    if (!Array.isArray(students) || !students.length || students.length > 300)
        throw fail('Select between 1 and 300 students for each rollover.');
    const seen = new Set();
    const selected = students.map(s => {
        if (!s || typeof s.id !== 'string' || !s.id || seen.has(s.id)) throw fail('Select each student only once.');
        seen.add(s.id);
        if (!Number.isInteger(s.version) || s.version < 1 || !Number.isInteger(s.semester) || s.semester < 1 || s.semester > 12)
            throw fail('Each student needs a current version and a whole-number target semester/year from 1 to 12.');
        return { id: s.id, version: s.version, semester: s.semester };
    }).sort((a, b) => a.id.localeCompare(b.id));
    if (typeof input.copyCourses !== 'boolean' || typeof input.setDefaultYear !== 'boolean')
        throw fail('Choose whether to copy course definitions and set the default academic year.');
    return { sourceYear, targetYear, students: selected, copyCourses: input.copyCourses, setDefaultYear: input.setDefaultYear };
}

export async function previewRollover(store, user, input) {
    if (!canRollover(user.role)) throw fail('Only a Super Admin, Admin or EMIS Coordinator can roll over academic years.', 403);
    const selection = normalize(input), all = (await store.all()), conflicts = [], warnings = [], programIds = new Set();
    const students = [];
    for (const item of selection.students) {
        const s = all.students.find(x => x.id === item.id);
        if (!s) throw fail('A selected student no longer exists. Reload the student list.', 409);
        const program = all.programs.find(p => p.id === s.programId);
        const reasons = [];
        if (s.year !== selection.sourceYear) reasons.push('Not in the source academic year');
        if (s.version !== item.version) reasons.push('Student changed after selection; reload the list');
        if (!['Active', 'On leave'].includes(s.status)) reasons.push('Only active or on-leave students can continue');
        if (!program || program.status !== 'Active') reasons.push('Program is not active');
        const maxSemester = Math.min(12, Number(program?.duration || 0) * (program?.system === 'Annual' ? 1 : 2));
        if (item.semester > maxSemester || item.semester < Number(s.semester)) reasons.push('Target exceeds program duration or goes backwards');
        const successor = (await store.db.prepare('SELECT student_id FROM emis_student_links WHERE org_id=:org AND previous_id=?').get(s.id));
        if (successor) reasons.push('This enrollment has already been rolled forward');
        if (all.students.some(x => x.year === selection.targetYear && (x.personId === s.personId || x.studentNo === s.studentNo)))
            reasons.push('A linked enrollment or the same student ID already exists in the target year');
        programIds.add(s.programId);
        if (reasons.length) conflicts.push(`${s.studentNo}: ${reasons.join('; ')}.`);
        const expected = Number(s.semester) + (program?.system === 'Annual' ? 1 : 2);
        if (item.semester !== expected) warnings.push(`${s.studentNo}: custom progression ${s.semester} → ${item.semester}; confirm this matches the college decision.`);
        if (s.status === 'On leave') warnings.push(`${s.studentNo}: the new enrollment will remain On leave.`);
        students.push({ id: s.id, version: s.version, studentNo: s.studentNo, name: s.name, programId: s.programId, program: program?.name || 'Missing program', fromSemester: s.semester, semester: item.semester, status: s.status, sample: s.sample, reasons });
    }
    const courses = [];
    if (selection.copyCourses) {
        for (const c of all.courses.filter(c => c.year === selection.sourceYear && programIds.has(c.programId)).sort((a, b) => a.id.localeCompare(b.id))) {
            const existing = all.courses.find(x => x.year === selection.targetYear && x.code === c.code);
            let action = existing ? 'Keep existing' : 'Copy as planned';
            if (existing && (existing.programId !== c.programId || Number(existing.semester) !== Number(c.semester))) {
                action = 'Conflict';
                conflicts.push(`Course ${c.code}: target-year code belongs to a different program or semester.`);
            }
            courses.push({ id: c.id, version: c.version, code: c.code, name: c.name, programId: c.programId, semester: c.semester, facultyId: c.facultyId, targetId: existing?.id || null, targetVersion: existing?.version || null, action });
        }
    }
    for (const key of new Set(students.map(s => `${s.programId}:${s.semester}`))) {
        const [programId, semester] = key.split(':');
        const available = all.courses.some(c => c.year === selection.targetYear && c.programId === programId && Number(c.semester) === Number(semester)) || courses.some(c => c.programId === programId && Number(c.semester) === Number(semester) && c.action !== 'Conflict');
        if (!available) warnings.push(`${all.programs.find(p => p.id === programId)?.name}: add courses for semester/year ${semester} in ${selection.targetYear}.`);
    }
    const profile = (await store.meta('profile'));
    const fingerprint = { selection, students, courses, programs: all.programs.filter(p => programIds.has(p.id)).map(p => [p.id, p.version]).sort(), defaultYear: selection.setDefaultYear ? profile.year : null };
    return {
        ...selection, students, courses, conflicts, warnings,
        previewToken: hash(fingerprint),
        summary: { enrollments: students.length, coursesToCopy: courses.filter(c => c.action === 'Copy as planned').length, coursesToKeep: courses.filter(c => c.action === 'Keep existing').length, sampleEnrollments: students.filter(s => s.sample).length },
        canApply: conflicts.length === 0
    };
}

export async function applyRollover(store, user, input) {
    if (!canRollover(user.role)) throw fail('Only a Super Admin, Admin or EMIS Coordinator can roll over academic years.', 403);
    if (typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId) || !/^[a-f0-9]{64}$/.test(input.previewToken || ''))
        throw fail('Review a fresh rollover preview before applying it.');
    const selection = normalize(input), digest = hash({ selection, previewToken: input.previewToken });
    return (await store.tx(async () => {
        const previous = (await store.db.prepare('SELECT * FROM emis_rollovers WHERE org_id=:org AND request_id=?').get(input.requestId));
        if (previous) {
            if (previous.user_id !== user.id || previous.request_digest !== digest) throw fail('This request ID was used for another rollover.', 409);
            return { ...JSON.parse(previous.data), replayed: true };
        }
        const preview = (await previewRollover(store, user, selection));
        if (!preview.canApply) throw fail(preview.conflicts.join('\n'), 409);
        if (preview.previewToken !== input.previewToken) throw fail('Data changed after the preview. Review the rollover again before saving.', 409);
        const enrollments = [];
        for (const item of selection.students) {
            const source = (await store.get(item.id));
            const value = (await store.validate('students', { ...source, year: selection.targetYear, semester: item.semester }, null, user));
            const created = (await store.insertRaw('students', value, randomUUID(), source.sample));
            (await store.db.prepare('UPDATE emis_student_links SET person_id=?,previous_id=? WHERE org_id=:org AND student_id=?').run(source.personId, source.id, created.id));
            const next = (await store.get(created.id));
            (await store.log(user, 'rolled forward enrollment', 'students', next.id, source, next));
            enrollments.push({ sourceId: source.id, id: next.id, studentNo: next.studentNo, name: next.name, fromSemester: source.semester, semester: next.semester });
        }
        const copiedCourses = [];
        for (const c of preview.courses.filter(c => c.action === 'Copy as planned')) {
            const source = (await store.get(c.id));
            const value = (await store.validate('courses', { ...source, year: selection.targetYear, status: 'Planned' }, null, user));
            const created = (await store.insertRaw('courses', value, randomUUID(), source.sample));
            (await store.log(user, 'copied course for academic year', 'courses', created.id, null, created));
            copiedCourses.push(created.id);
        }
        const profile = (await store.meta('profile'));
        (await store.setMeta('profile', { ...profile, years: [...new Set([...(profile.years || []), selection.sourceYear, selection.targetYear])], ...(selection.setDefaultYear ? { year: selection.targetYear } : {}) }));
        const result = { id: randomUUID(), sourceYear: selection.sourceYear, targetYear: selection.targetYear, actor: user.name, createdAt: new Date().toISOString(), enrollments, copiedCourses, summary: preview.summary, setDefaultYear: selection.setDefaultYear };
        (await store.db.prepare('INSERT INTO emis_rollovers(org_id,id,user_id,request_id,request_digest,data,created_at) VALUES(:org,?,?,?,?,?,?)').run(result.id, user.id, input.requestId, digest, JSON.stringify(result), result.createdAt));
        (await store.log(user, 'completed academic-year rollover', 'academic-years', result.id, null, result));
        return { ...result, replayed: false };
    }));
}

export async function rolloverHistory(store, user) {
    if (!canRollover(user.role)) throw fail('Academic-year management access is required.', 403);
    return (await store.db.prepare('SELECT data FROM emis_rollovers WHERE org_id=:org ORDER BY created_at DESC LIMIT 30').all()).map(row => JSON.parse(row.data));
}
