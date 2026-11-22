import { modules, globalModules, scopeRecord } from '../shared/schema.mjs';
import { referenceCodes, allowedImportColumns } from '../shared/imports.mjs';
const fail = message => Object.assign(new Error(message), { status: 400 });
export function resolveImportRow(entity, input, all, user) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('Each row must be an object.');
    const allowed = allowedImportColumns(entity), unknown = Object.keys(input).filter(k => !allowed.includes(k));
    if (unknown.length) throw fail('Unknown columns: ' + unknown.join(', '));
    const row = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
    for (const field of modules[entity].fields.filter(f => f.type === 'relation')) {
        const ref = referenceCodes[field.key];
        if (!ref || !row[ref.column]) continue;
        const matches = all[field.entity].filter(r => (globalModules.includes(field.entity) || r.year === row.year) && (ref.match ? ref.match(r, row[ref.column]) : r[ref.key] === row[ref.column]) && scopeRecord(user, field.entity, r, all));
        if (matches.length !== 1) throw fail(`${ref.column} “${row[ref.column]}” must match exactly one accessible ${field.label.toLowerCase()}${globalModules.includes(field.entity) ? '' : ' in ' + row.year}. Add that record first, then check its code.`);
        if (row[field.key] && row[field.key] !== matches[0].id) throw fail(`${field.key} and ${ref.column} refer to different records.`);
        row[field.key] = matches[0].id;
        delete row[ref.column];
    }
    return row;
}
export async function importRecords(store, user, entity, rows, preview = false) {
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) throw fail('Import between 1 and 500 rows at a time.');
    const rollbackPreview = Symbol('preview');
    let result;
    try {
        return await store.tx(async () => {
            const review = [];
            for (let i = 0; i < rows.length; i++) {
                try {
                    const row = resolveImportRow(entity, rows[i], await store.all(), user);
                    const saved = await store.save(user, entity, row);
                    review.push({ row: i + 2, year: saved.year, label: saved.name || saved.studentNo || saved.invoiceNo || saved.receiptNo || saved.code || saved.id });
                } catch (error) {
                    if (error.sqlState || error.code) throw error;
                    throw fail(`Row ${i + 2}: ${error.message}`);
                }
            }
            result = { count: rows.length, preview, rows: review };
            if (preview) throw rollbackPreview;
            await store.log(user, 'imported CSV records', entity, null, null, { count: rows.length });
            return result;
        });
    } catch (error) {
        if (error === rollbackPreview) return result;
        throw error;
    }
}
