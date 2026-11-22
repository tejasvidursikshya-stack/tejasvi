import { createHash } from 'node:crypto';
import { modules, can, scopeRecord } from '../shared/schema.mjs';
import { validAcademicYear } from './progression.mjs';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function normalize(input) {
  if (!validAcademicYear(input.year) || !Array.isArray(input.students) || input.students.length < 1 || input.students.length > 200) throw fail('Choose an academic year and 1–200 students.');
  const seen = new Set();
  const students = input.students.map(s => { if (!s || typeof s.id !== 'string' || !s.id || seen.has(s.id) || !Number.isInteger(s.version) || s.version < 1) throw fail('Select each student once with the current record version.'); seen.add(s.id); return { id: s.id, version: s.version }; }).sort((a, b) => a.id.localeCompare(b.id));
  if (!input.changes || typeof input.changes !== 'object' || Array.isArray(input.changes) || !Object.keys(input.changes).length || Object.keys(input.changes).some(k => !['semester', 'batch', 'status'].includes(k))) throw fail('Bulk changes are limited to semester, batch and enrollment status.');
  const changes = {};
  if (input.changes.semester !== undefined) { const value = Number(input.changes.semester); if (!Number.isInteger(value) || value < 1 || value > 12) throw fail('Semester must be a whole number from 1 to 12.'); changes.semester = value; }
  if (input.changes.batch !== undefined) { if (typeof input.changes.batch !== 'string' || !input.changes.batch.trim() || input.changes.batch.length > 600) throw fail('Provide a valid intake / batch.'); changes.batch = input.changes.batch.trim(); }
  if (input.changes.status !== undefined) { if (!modules.students.fields.find(f => f.key === 'status').options.includes(input.changes.status)) throw fail('Choose a valid enrollment status.'); changes.status = input.changes.status; }
  return { year: input.year, students, changes };
}
export async function previewStudentBulk(store, user, input) {
  if (!can(user.role, 'students', 'write')) throw fail('Student editing access is required.', 403);
  const selection = normalize(input), all = await store.all(), rows = [];
  for (const item of selection.students) {
    const old = all.students.find(s => s.id === item.id);
    if (!old || old.year !== selection.year || old.version !== item.version) throw fail('A selected student changed or belongs to another year. Refresh and select again.', 409);
    if (!scopeRecord(user, 'students', old, all, true)) throw fail('You cannot edit a selected student.', 403);
    const value = await store.validate('students', { ...old, ...selection.changes }, old.id, user);
    const program = all.programs.find(p => p.id === value.programId), max = Math.min(12, Number(program?.duration || 0) * (program?.system === 'Annual' ? 1 : 2));
    if (selection.changes.semester !== undefined && value.semester > max) throw fail(`${old.name}: semester exceeds the program duration.`);
    rows.push({ id: old.id, name: old.name, studentNo: old.studentNo, version: old.version, before: Object.fromEntries(Object.keys(selection.changes).map(k => [k, old[k]])), after: Object.fromEntries(Object.keys(selection.changes).map(k => [k, value[k]])) });
  }
  const previewToken = createHash('sha256').update(JSON.stringify({ actor: user.id, selection, rows })).digest('hex');
  return { selection, rows, count: rows.length, previewToken };
}
export async function applyStudentBulk(store, user, input) {
  if (!/^[a-f0-9]{64}$/.test(input.previewToken || '')) throw fail('Review the changes before confirming.');
  return store.tx(async () => {
    const preview = await previewStudentBulk(store, user, input);
    if (input.previewToken !== preview.previewToken) throw fail('The reviewed changes no longer match. Preview again.', 409);
    for (const item of preview.selection.students) { const old = await store.get(item.id); await store.save(user, 'students', { ...old, ...preview.selection.changes, version: item.version }, item.id); }
    await store.log(user, 'bulk updated student records', 'students', null, null, { year: preview.selection.year, count: preview.count, changes: preview.selection.changes, studentIds: preview.rows.map(r => r.id) });
    return { updated: preview.count };
  });
}
