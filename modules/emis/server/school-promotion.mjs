// End-of-year promotion for schools: next year's classes, subjects and class fee heads are
// prepared, every active student moves up one class (or repeats, if chosen), Grade 12 graduates.
// Past years are never changed except for marking Grade 12 students Graduated.
import { randomUUID } from 'node:crypto';
import { CLASS_NAMES } from '../shared/schema.mjs';
import { canManageInstitution } from '../shared/access.mjs';
import { validAcademicYear } from './progression.mjs';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const key = (c) => `${c.name}|${c.section || ''}|${c.stream || ''}`;
const nextName = (name) => { const i = CLASS_NAMES.indexOf(name); return i < 0 || name === 'Grade 12' ? null : CLASS_NAMES[i + 1]; };

export async function previewPromotion(store, user, b) {
  if (!canManageInstitution(user.role)) throw fail('Only administrators promote students.', 403);
  if ((await store.meta('profile'))?.kind !== 'school') throw fail('Promotion is for school workspaces.', 403);
  const from = b.sourceYear, to = b.targetYear;
  if (!validAcademicYear(from) || !validAcademicYear(to) || to <= from) throw fail('Choose a later academic year to promote into.');
  const all = await store.all(), repeat = new Set(Array.isArray(b.repeat) ? b.repeat : []);
  const srcClasses = all.classes.filter((c) => c.year === from && c.status !== 'Closed');
  const targetClasses = all.classes.filter((c) => c.year === to);
  const enrolledNext = new Set(all.students.filter((s) => s.year === to).map((s) => s.personId || s.id));
  const plannedClasses = new Map(targetClasses.map((c) => [key(c), { ...c, exists: true }]));
  const want = (name, c) => { const k = key({ name, section: c.section, stream: name === 'Grade 11' || name === 'Grade 12' ? c.stream : '' }); if (!plannedClasses.has(k)) plannedClasses.set(k, { name, section: c.section, stream: name === 'Grade 11' || name === 'Grade 12' ? c.stream : undefined, room: c.room, capacity: c.capacity, exists: false }); return k; };
  const moves = [], graduates = [], skipped = [];
  for (const c of srcClasses) {
    for (const s of all.students.filter((x) => x.classId === c.id && x.year === from && x.status === 'Active')) {
      if (enrolledNext.has(s.personId || s.id)) { skipped.push({ id: s.id, name: s.name, reason: `Already enrolled in ${to}` }); continue; }
      const stays = repeat.has(s.id), name = stays ? c.name : nextName(c.name);
      if (!name) { graduates.push({ id: s.id, name: s.name, from: `${c.name} ${c.section}` }); continue; }
      moves.push({ id: s.id, name: s.name, studentNo: s.studentNo, from: `${c.name} ${c.section}`, to: `${name} ${c.section}`, targetKey: want(name, c), repeat: stays });
    }
  }
  const classesToCreate = [...plannedClasses.values()].filter((c) => !c.exists);
  // Subjects and class fee heads for a new class come from the same class in the source year.
  const copySubjects = [], copyHeads = [];
  for (const c of classesToCreate) {
    const model = srcClasses.find((x) => x.name === c.name && x.section === c.section) || srcClasses.find((x) => x.name === c.name);
    if (!model) continue;
    for (const sub of all.subjects.filter((x) => x.classId === model.id)) copySubjects.push({ targetKey: key(c), sub });
    for (const h of all.feeHeads.filter((x) => x.classId === model.id && x.year === from)) copyHeads.push({ targetKey: key(c), head: h });
  }
  const globalHeads = all.feeHeads.some((h) => h.year === to && !h.classId) ? [] : all.feeHeads.filter((h) => h.year === from && !h.classId);
  return {
    sourceYear: from, targetYear: to, moves, graduates, skipped,
    classesToCreate: classesToCreate.map((c) => ({ name: c.name, section: c.section, stream: c.stream || '', subjects: copySubjects.filter((x) => x.targetKey === key(c)).length })),
    feeHeadsToCopy: copyHeads.length + globalHeads.length,
    plan: { classesToCreate, copySubjects, copyHeads, globalHeads },
  };
}

export async function applyPromotion(store, user, b) {
  return store.tx(async () => {
    const p = await previewPromotion(store, user, b), to = p.targetYear, ids = new Map();
    const all = await store.all();
    for (const c of all.classes.filter((x) => x.year === to)) ids.set(key(c), c.id);
    for (const c of p.plan.classesToCreate) {
      const model = all.classes.find((x) => x.year === p.sourceYear && x.name === c.name && x.section === c.section);
      const made = await store.save(user, 'classes', { year: to, name: c.name, section: c.section, stream: c.stream, room: c.room, capacity: c.capacity, classTeacherId: model?.classTeacherId, status: 'Active' });
      ids.set(key(c), made.id);
    }
    for (const { targetKey, sub } of p.plan.copySubjects) {
      const { id, version, year, createdAt, updatedAt, sample, entity, classId, ...rest } = sub;
      await store.save(user, 'subjects', { ...rest, year: to, classId: ids.get(targetKey) });
    }
    for (const { targetKey, head } of p.plan.copyHeads) {
      const { id, version, year, createdAt, updatedAt, sample, entity, classId, ...rest } = head;
      await store.save(user, 'feeHeads', { ...rest, year: to, classId: ids.get(targetKey) });
    }
    for (const head of p.plan.globalHeads) {
      const { id, version, year, createdAt, updatedAt, sample, entity, ...rest } = head;
      await store.save(user, 'feeHeads', { ...rest, year: to });
    }
    let promoted = 0, repeated = 0;
    for (const m of p.moves) {
      const source = await store.get(m.id);
      const { entity, createdAt, updatedAt, version, ...data } = source;
      const value = await store.validate('students', { ...data, year: to, classId: ids.get(m.targetKey), rollNo: m.repeat ? undefined : data.rollNo, status: 'Active' }, null, user);
      const created = await store.insertRaw('students', value, randomUUID(), source.sample);
      await store.db.prepare('UPDATE emis_student_links SET person_id=?,previous_id=? WHERE org_id=:org AND student_id=?').run(source.personId || source.id, source.id, created.id);
      await store.log(user, m.repeat ? 'kept student in class for new year' : 'promoted student', 'students', created.id, source, created);
      if (m.repeat) repeated++; else promoted++;
    }
    for (const g of p.graduates) { const s = await store.get(g.id); await store.save(user, 'students', { ...s, status: 'Graduated' }, s.id, true); }
    const profile = await store.meta('profile');
    await store.setMeta('profile', { ...profile, years: [...new Set([...(profile.years || []), p.sourceYear, to])], ...(b.setDefaultYear ? { year: to } : {}) });
    await store.log(user, 'promoted students to new academic year', 'academic-years', null, null, { from: p.sourceYear, to, promoted, repeated, graduated: p.graduates.length, classes: p.plan.classesToCreate.length });
    return { promoted, repeated, graduated: p.graduates.length, classesCreated: p.plan.classesToCreate.length, subjectsCopied: p.plan.copySubjects.length, feeHeadsCopied: p.plan.copyHeads.length + p.plan.globalHeads.length, targetYear: to };
  });
}
