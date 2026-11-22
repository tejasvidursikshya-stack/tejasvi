import { schoolRoute } from './school.mjs';
import { esewaReturn, esewaConfig } from './school-family.mjs';
import {learningOverview,publishSubject} from './learning.mjs';
import {MySQLDatabase} from './database.mjs';
import {many,one} from '../../../lib/campus-data.mjs';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, statSync, lstatSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { cleanLetterhead } from '../shared/letterhead.mjs';
import { normalizeLogo } from '../../../lib/logo.ts';
import { modules, ROLES, YEARS, can, scopeRecord, calculateIndicators } from '../shared/schema.mjs';
import { validAcademicYear } from './progression.mjs';
import { importRecords } from './imports.mjs';
import { previewRollover, applyRollover, rolloverHistory } from './progression.mjs';
import { listAccounts, createAccount, updateAccount, accountSummary, permissionCatalog } from './accounts.mjs';
import { previewStudentBulk, applyStudentBulk } from './student-bulk.mjs';
import { isSuperAdmin, canManageInstitution, canViewInstitution } from '../shared/access.mjs';
import { financeDocument } from './finance-documents.mjs';
import { maskRecord } from './mobile.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hashToken = t => createHash('sha256').update(t).digest('hex');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const passwordValid = p => typeof p === 'string' && p.length >= 12 && p.length <= 200;
export function createEmis({pool,org,auth,user,dataDir}) {
    const db=new MySQLDatabase(pool,org,auth,user),store=new Store(db),uploads=join(dataDir,org,'uploads');mkdirSync(uploads,{recursive:true,mode:0o700});
    const orgLogo=async()=>{const r=await db.prepare('SELECT branding_version v,(logo_data IS NOT NULL) has FROM organizations WHERE id=:org').get();return {hasLogo:!!r?.has,logoVersion:Number(r?.v||0)};};
    const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    const body = async (req, limit = 15 * 1024 * 1024) => { let n = 0; const chunks = []; for await (const chunk of req) {
        n += chunk.length;
        if (n > limit)
            throw fail('Request is too large.', 413);
        chunks.push(chunk);
    } try {
        return JSON.parse(Buffer.concat(chunks).toString() || '{}');
    }
    catch {
        throw fail('Invalid JSON request.');
    } };
    const admin = user => { if (!isSuperAdmin(user.role))
        throw fail('Super Admin access is required.', 403); };
    const mask = maskRecord;
    const handle = async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://rc-epay.esewa.com.np https://epay.esewa.com.np");
        try {
            const url = new URL(req.url, 'http://localhost'), path = url.pathname, method = req.method || 'GET';
            if(path==='/api/auth/status'&&method==='GET')return json(res,{suite:true,needsSetup:false,user:{...user,csrf:undefined},csrf:user.csrf});
            if (path.startsWith('/api/') && method !== 'GET') {
                const origin = req.headers.origin, host = req.headers.host;
                if (origin) {
                    try {
                        if (new URL(origin).host !== host)
                            throw Error();
                    }
                    catch {
                        throw fail('Request origin is not allowed.', 403);
                    }
                }
                if (req.headers['sec-fetch-site'] === 'cross-site')
                    throw fail('Cross-site request denied.', 403);
                if (!String(req.headers['content-type'] || '').startsWith('application/json'))
                    throw fail('JSON requests are required.', 415);
            }
            if(path.startsWith('/api/')){
                if(method!=='GET' && (req.headers.origin!==process.env.APP_URL||req.headers['x-csrf-token']!==user.csrf))throw fail('Refresh the workspace and try again.',403);
                const currentProfile=await store.meta('profile');if(!currentProfile)throw fail('This organization has no EMIS workspace.',403);
                if(path==='/api/learning/overview'&&method==='GET')return json(res,await learningOverview(store,user,url.searchParams.get('year')||currentProfile.year));
                if(path==='/api/learning/subjects'&&method==='POST')return json(res,await publishSubject(store,user,(await body(req,1000)).recordId));
                if (path === '/api/bootstrap' && method === 'GET') {
                    const all = (await store.all()), records = {};
                    for (const entity of Object.keys(modules)) {
                        if (can(user.role, entity))
                            records[entity] = all[entity].filter(r => scopeRecord(user, entity, r, all)).map(r => mask(user, entity, r));
                    }
                    const ids = new Set(Object.values(records).flat().map(r => r.id));
                    const files = (await db.prepare('SELECT id,record_id AS recordId,name,mime,size,created_at AS createdAt FROM emis_files WHERE org_id=:org ORDER BY created_at DESC').all()).filter(f => ids.has(f.recordId));
                    const audit = (await db.prepare('SELECT id,actor,action,entity,record_id AS recordId,created_at AS createdAt FROM emis_audit WHERE org_id=:org ORDER BY id DESC LIMIT 100').all()).filter(a => canViewInstitution(user.role) || (a.recordId && ids.has(a.recordId))).slice(0, 20);
                    return json(res, { user: { ...user, session: undefined, csrf: undefined }, csrf: user.csrf, suite: true, onlinePayment: currentProfile.kind === 'school' && esewaConfig() ? { provider: 'eSewa', test: esewaConfig().mode === 'test' } : null, learning: user.learningRole!=='ops', demo: null, branding: {id:org,name:currentProfile.name,primaryColor:currentProfile.theme,...(await orgLogo())}, accounts: await accountSummary(store, user), profile: currentProfile, records, files, audit, database: await db.health(), sampleLoaded: false, years: [...new Set([...(await store.meta('profile')).years, ...Object.values(records).flat().map(r => r.year)])].sort().reverse() });
                }
                if (path === '/api/academic-years/preview' && method === 'POST')
                    return json(res, (await previewRollover(store, user, await body(req, 100000))));
                if (path === '/api/academic-years/rollover' && method === 'POST')
                    return json(res, (await applyRollover(store, user, await body(req, 100000))), 201);
                if (path === '/api/academic-years/history' && method === 'GET')
                    return json(res, (await rolloverHistory(store, user)));
                const documentMatch = path.match(/^\/api\/finance\/documents\/(invoice|receipt)\/([a-zA-Z0-9-]+)$/);
                if (documentMatch && method === 'GET')
                    return json(res, (await financeDocument(store, user, documentMatch[1], documentMatch[2])));
                if (path === '/api/pay/esewa/return' && method === 'GET') {
                    let result; try { result = await esewaReturn(store, user, url); } catch (e) { result = { ok: false, message: e.message }; }
                    res.writeHead(303, { Location: `/erp/${encodeURIComponent(org)}/?payment=${result.ok ? 'ok' : 'failed'}&message=${encodeURIComponent(result.message)}#overview`, 'Cache-Control': 'no-store' });
                    return res.end();
                }
                const schoolResult = await schoolRoute(store, user, path, method, () => body(req, 200000), { origin: process.env.APP_URL || '', base: '/erp/' + encodeURIComponent(org) });
                if (schoolResult !== undefined)
                    return json(res, schoolResult, path.endsWith('/apply') ? 201 : 200);
                const match = path.match(/^\/api\/records\/([a-zA-Z]+)(?:\/([a-zA-Z0-9-]+))?$/);
                if (match) {
                    const [, entity, id] = match;
                    if (!Object.hasOwn(modules, entity))
                        throw fail('Module not found.', 404);
                    if (!can(user.role, entity, method === 'GET' ? 'read' : 'write'))
                        throw fail('You do not have permission for this module.', 403);
                    if (method === 'POST' && !id) {
                        const b = await body(req);
                        return json(res, (await store.tx(async () => (await store.save(user, entity, b)))), 201);
                    }
                    if (method === 'PUT' && id) {
                        const b = await body(req);
                        return json(res, (await store.tx(async () => (await store.save(user, entity, b, id)))));
                    }
                    if (method === 'DELETE' && id) {
                        const b = await body(req);
                        (await store.tx(async () => (await store.archive(user, entity, id, b.version))));
                        return json(res, { ok: true });
                    }
                }
                if (path === '/api/import' && method === 'POST') {
                    const b = await body(req);
                    if (!modules[b.entity] || !can(user.role, b.entity, 'write') || ['Student', 'Faculty'].includes(user.role))
                        throw fail('Import is not permitted.', 403);
                    const result = await importRecords(store, user, b.entity, b.rows, !!b.preview);
                    return json(res, result, b.preview ? 200 : 201);
                }
                if (path === '/api/attendance/bulk' && method === 'POST') {
                    if (!can(user.role, 'attendance', 'write'))
                        throw fail('Attendance access is required.', 403);
                    const b = await body(req);
                    if (!Array.isArray(b.rows) || b.rows.length < 1 || b.rows.length > 300)
                        throw fail('Select 1–300 students.');
                    const seen = new Set();
                    (await store.tx(async () => { for (const r of b.rows) {
                        if (seen.has(r.studentId))
                            throw fail('Duplicate student in attendance.');
                        seen.add(r.studentId);
                        const existing = (await store.all()).attendance.find(a => a.studentId === r.studentId && a.courseId === b.courseId && a.date === b.date && a.year === b.year);
                        (await store.save(user, 'attendance', { year: b.year, studentId: r.studentId, courseId: b.courseId, date: b.date, status: r.status, version: r.version }, existing?.id));
                    } }));
                    return json(res, { count: b.rows.length });
                }
                if (path === '/api/admissions/enroll' && method === 'POST') {
                    if (!can(user.role, 'students', 'write') || !can(user.role, 'admissions', 'write'))
                        throw fail('Admissions access is required.', 403);
                    const b = await body(req);
                    const result = (await store.tx(async () => {
                        const a = (await store.get(b.id));
                        if (!a || a.entity !== 'admissions' || a.status !== 'Accepted')
                            throw fail('Only accepted applications can be enrolled.');
                        if (a.version !== Number(b.version))
                            throw fail('Application changed. Refresh first.', 409);
                        const r = (await store.save(user, 'students', { ...a, studentNo: b.studentNo, batch: b.batch, semester: 1, classId: b.classId, rollNo: b.rollNo, status: 'Active', admissionDate: new Date().toISOString().slice(0, 10), nationality: 'Nepali' }));
                        (await store.save(user, 'admissions', { ...a, status: 'Enrolled' }, a.id, true));
                        const raw = (await db.prepare('SELECT data FROM emis_records WHERE org_id=:org AND id=?').get(a.id));
                        (await db.prepare('UPDATE emis_records SET data=? WHERE org_id=:org AND id=?').run(JSON.stringify({ ...JSON.parse(raw.data), enrolledStudentId: r.id }), a.id));
                        (await store.log(user, 'enrolled student', 'admissions', a.id, null, { studentId: r.id }));
                        return r;
                    }));
                    return json(res, result, 201);
                }
                if (path === '/api/profile' && method === 'PUT') {
                    if (!canManageInstitution(user.role))
                        throw fail('Institution settings access is required.', 403);
                    const b = await body(req, 60000);
                    const result = await store.tx(async () => {
                    const old = await store.meta('profile'), next = { ...old };
                    const allowed = ['smsAbsence', 'smsMessages', 'libraryFinePerDay', 'lateFineFlat', 'lateFineGraceDays', 'siblingDiscount', 'staffChildDiscount', 'name', 'code', 'address', 'university', 'affiliationDate', 'established', 'type', 'ownership', 'principal', 'chairperson', 'phone', 'email', 'website', 'vision', 'mission', 'values', 'history', 'milestones', 'priorAccreditation', 'currentStatus', 'logoUrl', 'theme', 'year', 'attendanceThreshold', 'registrationNumber', 'panNumber', 'province', 'district', 'municipality', 'ward', 'postalCode', 'letterhead'];
                    for (const k of allowed) {
                        if (b[k] !== undefined) {
                            if (k === 'smsAbsence' || k === 'smsMessages') { if (!['Yes', 'No'].includes(b[k])) throw fail('Choose whether to send SMS.'); next[k] = b[k]; }
                            else if (['lateFineFlat', 'lateFineGraceDays', 'siblingDiscount', 'staffChildDiscount'].includes(k)) { const n = Number(b[k]), max = { lateFineFlat: 100000, lateFineGraceDays: 90, siblingDiscount: 100, staffChildDiscount: 100 }[k]; if (!Number.isFinite(n) || n < 0 || n > max) throw fail('Fee settings must be numbers from 0 to ' + max + '.'); next[k] = n; }
                            else if (k === 'libraryFinePerDay') { const n = Number(b[k]); if (!Number.isFinite(n) || n < 0 || n > 500) throw fail('Library fine must be NPR 0–500 a day.'); next[k] = n; }
                            else if (k === 'letterhead') next[k] = cleanLetterhead(b[k]);
                            else if (k === 'attendanceThreshold') {
                                if (!Number.isFinite(Number(b[k])) || Number(b[k]) < 1 || Number(b[k]) > 100)
                                    throw fail('Attendance threshold must be 1–100%.');
                                next[k] = Number(b[k]);
                            }
                            else {
                                if (typeof b[k] !== 'string' || b[k].length > 12000)
                                    throw fail('Invalid institution profile.');
                                next[k] = b[k].trim();
                            }
                        }
                    }
                    if (!next.name || !validAcademicYear(next.year) || !/^#[0-9a-fA-F]{6}$/.test(next.theme))
                        throw fail('Enter a college name, academic year and valid theme color.');
                    if (next.logoUrl && !/^https?:\/\//.test(next.logoUrl))
                        throw fail('Logo URL must be http or https.');
                    next.years = [...new Set([...(old.years || []), next.year])];
                    (await store.tx(async () => { (await store.setMeta('profile', next)); (await store.log(user, 'updated institution profile', 'institution', null, old, next)); }));
                    return next;
                    });
                    return json(res, result);
                }
                if (path === '/api/letterhead/logo' && method === 'POST') {
                    if (!canManageInstitution(user.role)) throw fail('Institution settings access is required.', 403);
                    const b = await body(req, 3_000_000);
                    let logo = null;
                    if (b.remove !== true) {
                        const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ''));
                        if (!m) throw fail('Choose a PNG, JPEG or WebP logo.');
                        try { logo = await normalizeLogo(Buffer.from(m[2], 'base64')); } catch { throw fail('Choose a valid PNG, JPEG or WebP logo under 2 MB.'); }
                    }
                    await db.prepare('UPDATE organizations SET logo_data=?,branding_version=branding_version+1 WHERE id=:org').run(logo);
                    await store.log(user, logo ? 'updated letterhead logo' : 'removed letterhead logo', 'institution', null, null, null);
                    return json(res, await orgLogo());
                }
                if (path === '/api/roles' && method === 'GET') return json(res, permissionCatalog(user, (await store.meta('profile'))?.kind));
                if (path === '/api/users' && method === 'GET') return json(res, await listAccounts(store, user));
                if (path === '/api/users' && method === 'POST') return json(res, await createAccount(store, user, await body(req, 20000)), 201);
                const accountMatch = path.match(/^\/api\/users\/([a-zA-Z0-9-]+)$/);
                if (accountMatch && method === 'PUT') return json(res, await updateAccount(store, user, accountMatch[1], await body(req, 20000)));
                if (path === '/api/students/bulk/preview' && method === 'POST') return json(res, await previewStudentBulk(store, user, await body(req, 100000)));
                if (path === '/api/students/bulk/apply' && method === 'POST') return json(res, await applyStudentBulk(store, user, await body(req, 100000)));
                if (path === '/api/audit' && method === 'GET') {
                    if (!canViewInstitution(user.role))
                        throw fail('Audit access is required.', 403);
                    return json(res, (await db.prepare('SELECT id,actor,action,entity,record_id AS recordId,before_data AS beforeData,after_data AS afterData,created_at AS createdAt FROM emis_audit WHERE org_id=:org ORDER BY id DESC LIMIT 1000').all()));
                }
                if (path === '/api/export' && method === 'GET') {
                    admin(user);
                    return json(res, { format: 'emis-export-v1', exportedAt: new Date().toISOString(), profile: (await store.meta('profile')), records: (await store.all()), note: 'Data export only. Use npm run backup for a complete database and attachments backup.' });
                }
                if (path === '/api/files' && method === 'POST') {
                    const b = await body(req);
                    const result = await store.tx(async () => {
                    const r = await store.get(b.recordId);
                    if (!r || !scopeRecord(user, r.entity, r, (await store.all()), true))
                        throw fail('You cannot attach a file to this record.', 403);
                    if (typeof b.name !== 'string' || typeof b.data !== 'string')
                        throw fail('Choose a file.');
                    const name = b.name.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 180);
                    const ext = extname(name).toLowerCase();
                    if (!['.pdf', '.docx', '.xlsx', '.csv', '.txt', '.png', '.jpg', '.jpeg'].includes(ext))
                        throw fail('Use PDF, DOCX, XLSX, CSV, TXT, PNG or JPG.');
                    const bytes = Buffer.from(b.data, 'base64');
                    if (!bytes.length || bytes.length > 10 * 1024 * 1024)
                        throw fail('File must be between 1 byte and 10 MB.');
                    const id = randomUUID(), filePath = join(uploads, id);
                    writeFileSync(filePath, bytes, { mode: 0o600 });
                    try {
                    (await db.prepare('INSERT INTO emis_files(org_id,id,record_id,name,mime,size,path,created_at) VALUES(:org,?,?,?,?,?,?,?)').run(id, r.id, name, 'application/octet-stream', bytes.length, id, new Date().toISOString()));
                    (await store.log(user, 'attached evidence', r.entity, r.id, null, { file: name, size: bytes.length }));
                    return { id, name };
                    } catch (error) { try { unlinkSync(filePath); } catch {} throw error; }
                    });
                    return json(res, result, 201);
                }
                if (path.match(/^\/api\/files\/[a-zA-Z0-9-]+$/) && method === 'GET') {
                    const f = (await db.prepare('SELECT * FROM emis_files WHERE org_id=:org AND id=?').get(path.split('/').pop())), r = f ? (await store.get(f.record_id)) : null;
                    if (!r || !scopeRecord(user, r.entity, r, (await store.all())))
                        throw fail('File not found.', 404);
                    if (typeof f.path!=='string'||!f.path||/[\\/:\x00-\x1f]/.test(f.path)||['.','..'].includes(f.path)) throw fail('File unavailable.',404);
                    let bytes;try { const path=join(uploads,f.path),stat=lstatSync(path);if(!stat.isFile()||stat.size!==Number(f.size))throw Error();bytes=readFileSync(path); } catch { throw fail('Attachment not restored in this copy. Ask your administrator to restore the file from a backup.',404); }
                    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="'+f.name.replace(/[^a-zA-Z0-9._() -]/g,'_')+'"', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
                    return res.end(bytes);
                }
                throw fail('Endpoint not found.', 404);
            }
            if (method !== 'GET' && method !== 'HEAD')
                throw fail('Method not allowed.', 405);
            throw fail('Not found.',404);
        }
        catch (e) {
            if (res.headersSent) {
                res.end();
                return;
            }
            const isDatabaseError = !!e.sqlState || ['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','PROTOCOL_CONNECTION_LOST'].includes(e.code);
            // Programming faults (TypeError and friends) are not validation messages: never echo them to the client.
            const isFault = !e.status && (e instanceof TypeError || e instanceof ReferenceError || e instanceof RangeError);
            const status = e.status || (isDatabaseError ? 503 : isFault ? 500 : 400);
            json(res, { error: isDatabaseError ? (e.code==='ER_DUP_ENTRY'?'A conflicting record already exists in this institution.':'The database could not complete this request.') : status >= 500 && !e.publicMessage ? 'An internal error occurred. Check the server console.' : e.message }, status);
            if (status >= 500)
                console.error('EMIS request failed:', e.code || e.name);
        }
    };
    return {handle,store};
}
