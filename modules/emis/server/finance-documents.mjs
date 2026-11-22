import { scopeRecord, invoiceBalance } from '../shared/schema.mjs';
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

export async function financeDocument(store, user, type, id) {
    const all = (await store.all()), entity = type === 'receipt' ? 'payments' : 'fees';
    const record = all[entity].find(r => r.id === id);
    if (!record || !scopeRecord(user, entity, record, all))
        throw Object.assign(new Error('Document not found or access denied.'), { status: 404 });
    const invoice = type === 'receipt' ? all.fees.find(r => r.id === record.invoiceId) : record;
    if (!invoice || !scopeRecord(user, 'fees', invoice, all))
        throw Object.assign(new Error('Document not found or access denied.'), { status: 404 });
    const student = all.students.find(s => s.id === invoice.studentId);
    const payments = all.payments.filter(p => p.invoiceId === invoice.id).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const { paid, balance } = invoiceBalance(invoice, payments);
    return {
        type, generatedAt: new Date().toISOString(),
        institution: pick((await store.meta('profile')), ['name', 'code', 'address', 'phone', 'email', 'university']),
        student: { ...pick(student, ['name', 'studentNo', 'semester']), program: all.programs.find(p => p.id === student.programId)?.name || '' },
        invoice: pick(invoice, ['invoiceNo', 'year', 'category', 'amount', 'dueDate', 'notes', 'createdAt', 'sample']),
        receipt: type === 'receipt' ? pick(record, ['receiptNo', 'amount', 'date', 'method', 'reference', 'notes', 'sample']) : null,
        payments: payments.map(p => pick(p, ['receiptNo', 'amount', 'date', 'method', 'reference'])),
        paid, balance
    };
}
