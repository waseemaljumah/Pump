// ═══════════════════════════════════════
// db.js — نسخ من addDoc / setDoc / updateDoc / deleteDoc تكتب سجل التعديلات
// ═══════════════════════════════════════
//
// نفس طريقة الاستدعاء بالضبط: Add(colRef, data) · Set(docRef, data, opts)
//                              Update(docRef, data) · Delete(docRef)
// الخطوات: قراءة البيانات قبل (الكاش أولاً ثم السيرفر) ← الحفظ ← المقارنة ← كتابة السجل.
// فشل السجل لا يوقف الحفظ الأصلي أبداً.

import {
  Add as rawAdd, Set as rawSet, Update as rawUpdate, Delete as rawDelete,
  Col, Get, GetCached
} from './firebase.js';
import { state, isOwner, displayName } from './state.js';

// ══════════════════════════════════════
// الإعدادات: أسماء الأقسام والخانات
// ══════════════════════════════════════

export const LOG_SECTIONS = {
  reports:  'البلاغات',
  pumps:    'المضخات',
  users:    'المستخدمين',
  settings: 'الإعدادات',
};

const FIELD_LABELS = {
  reports: {
    num: 'رقم البلاغ', city: 'البلدية', pumpNum: 'المضخة', date: 'تاريخ البلاغ',
    orderDate: 'تاريخ أمر العمل', faults: 'الأعطال', works: 'الأعمال', notes: 'ملاحظات',
    worked: 'تم العمل عليها', registered: 'تم تسجيل الأعمال', approved: 'تم الاعتماد',
    hidden: 'مخفي عن الزوار', archived: 'مؤرشف', photos: 'الصور', images: 'الصور',
  },
  pumps: { num: 'رقم المضخة', city: 'البلدية', desc: 'الوصف' },
  users: {
    name: 'الاسم', email: 'البريد', disabled: 'الحساب موقوف', perms: 'الصلاحيات',
    'perms.dashboard': 'صلاحية: لوحة التحكم', 'perms.reports': 'صلاحية: البلاغات',
    'perms.pumps': 'صلاحية: المضخات', 'perms.export': 'صلاحية: التصدير',
  },
  settings: {
    publicList: 'إظهار القائمة للزوار', publicDashboard: 'إظهار لوحة التحكم للزوار',
    publicExport: 'إظهار التصدير للزوار', enabled: 'تشغيل السجل',
    ownerName: 'اسم المالك', adminUids: 'حسابات المالك',
  },
};

// خانات داخل الصفوف (الأعطال / الأعمال)
const ROW_LABELS = {
  text: 'النص', done: 'منجز', rejected: 'مرفوض', rejectionReason: 'سبب الرفض', date: 'التاريخ',
};
// اسم الصف حسب القائمة
const ROW_PREFIX = { faults: 'عطل', works: 'عمل' };

// قيم خاصة (مثل الصلاحيات)
const VALUE_LABELS = { hidden: 'مخفي', view: 'مشاهدة', edit: 'تعديل' };

// خانات تتغير لحالها أو داخلية → تُتجاهل
const IGNORE = new Set([
  'id', 'createdAt', 'updatedAt', 'archivedAt', 'rejectedAt', 'ts',
  'order', 'sort', 'sortOrder', 'position', 'pumpId',
]);

const MAX_TEXT    = 160;
const MAX_CHANGES = 300;   // حماية من تجاوز حجم المستند

// ══════════════════════════════════════
// النسخ المسجَّلة
// ══════════════════════════════════════

export async function Add(colRef, data) {
  const ref = await rawAdd(colRef, data);
  if (logOn()) safe(() => writeLog('create', colRef.id, ref.id, null, data));
  return ref;
}

// (اسمه الداخلي SetDoc حتى لا يغطي على Set المدمج في JavaScript)
async function SetDoc(docRef, data, opts) {
  const before = logOn() ? await readBefore(docRef) : null;
  await rawSet(docRef, data, opts);
  if (logOn()) {
    const after = opts?.merge ? applyPatch(before || {}, data) : data;
    safe(() => writeLog(before ? 'update' : 'create', docRef.parent.id, docRef.id, before, after));
  }
}

export async function Update(docRef, data) {
  const before = logOn() ? await readBefore(docRef) : null;
  await rawUpdate(docRef, data);
  if (logOn()) safe(() => writeLog('update', docRef.parent.id, docRef.id, before || {}, applyPatch(before || {}, data)));
}

export async function Delete(docRef) {
  const before = logOn() ? await readBefore(docRef) : null;
  await rawDelete(docRef);
  if (logOn()) safe(() => writeLog('delete', docRef.parent.id, docRef.id, before || {}, null));
}

export { SetDoc as Set };

// سجل جاهز (للعمليات الجماعية مثل writeBatch)
export function logEntry(op, coll, docId, record, changes) {
  if (!logOn() || !changes?.length) return;
  safe(() => pushLog({ op, coll, docId, record, changes }));
}

// ══════════════════════════════════════
// داخلي
// ══════════════════════════════════════

const logOn = () => !!state.user && state.auditEnabled !== false;

function safe(fn) {
  try { Promise.resolve(fn()).catch(e => console.warn('audit log:', e)); }
  catch (e) { console.warn('audit log:', e); }
}

async function readBefore(ref) {
  try {
    const snap = await GetCached(ref);
    if (snap.exists()) return snap.data();
  } catch (_) { /* غير موجود بالكاش */ }
  try {
    const snap = await Get(ref);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('audit read-before:', e);
    return null;
  }
}

// تطبيق تعديل على نسخة (يدعم المسارات المنقّطة a.b)
function applyPatch(base, patch) {
  const out = JSON.parse(JSON.stringify(base || {}));
  for (const [k, v] of Object.entries(patch || {})) {
    if (!k.includes('.')) { out[k] = v; continue; }
    const parts = k.split('.');
    let o = out;
    parts.slice(0, -1).forEach(p => { if (typeof o[p] !== 'object' || o[p] === null) o[p] = {}; o = o[p]; });
    o[parts.at(-1)] = v;
  }
  return out;
}

async function writeLog(op, coll, docId, before, after) {
  const data = after || before || {};
  const record = recordName(coll, docId, data);
  let changes;

  if (op === 'create') {
    const rows = countRows(after);
    changes = [{ row: '—', field: 'إنشاء', before: '', after: record + (rows ? ` — ${rows} صف` : '') }];
  } else if (op === 'delete') {
    const rows = countRows(before);
    changes = [{ row: '—', field: 'حذف', before: record + (rows ? ` — ${rows} صف` : ''), after: '' }];
  } else {
    changes = diff(before || {}, after || {}, coll);
    if (!changes.length) return; // لا تغيير فعلي
  }
  await pushLog({ op, coll, docId, record, changes });
}

async function pushLog({ op, coll, docId, record, changes }) {
  const u = state.user;
  if (!u) return;
  const list = changes.slice(0, MAX_CHANGES);
  await rawAdd(Col('auditLog'), {
    ts:      Date.now(),
    uid:     u.uid,
    name:    displayName(),
    email:   u.email || '',
    owner:   isOwner(),
    section: LOG_SECTIONS[coll] || coll,
    coll, docId, op,
    record:  record || docId,
    changes: list,
    count:   changes.length,
  });
}

// ─── اسم السجل ───
function recordName(coll, id, d) {
  if (coll === 'reports')  return `مضخة ${d.pumpNum || '—'} · ${d.date || ''}`.trim();
  if (coll === 'pumps')    return `مضخة ${d.num || '—'}${d.city ? ' (' + d.city + ')' : ''}`;
  if (coll === 'users')    return d.name || d.email || id;
  if (coll === 'settings') return ({ app: 'إعدادات الظهور', admin: 'إعدادات المالك', audit: 'إعدادات السجل' })[id] || id;
  return id;
}

function countRows(d) {
  if (!d) return 0;
  return Object.entries(d).reduce((n, [k, v]) =>
    n + (!IGNORE.has(k) && Array.isArray(v) && v.length && isObj(v[0]) ? v.length : 0), 0);
}

// ══════════════════════════════════════
// المقارنة
// ══════════════════════════════════════

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function isImage(v) {
  return typeof v === 'string' &&
    (v.startsWith('data:image') || /^https?:\/\/.+\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(v));
}
const isImageList = v => Array.isArray(v) && v.length > 0 && v.every(isImage);

// قيمة فاضية = غير موجود / null / '' / false / []
function empty(v) {
  return v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length);
}

function same(a, b) {
  if (empty(a) && empty(b)) return true;
  return stable(a) === stable(b);
}
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().map(k => k + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

export function fmt(v) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا';
  if (isImage(v)) return '1 صورة';
  if (isImageList(v)) return `${v.length} صورة`;
  if (typeof v === 'string') return VALUE_LABELS[v] || cut(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    if (v.every(x => typeof x !== 'object')) return cut(v.join('، '));
    return `${v.length} صف`;
  }
  return cut(JSON.stringify(v));
}
const cut = s => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + '…' : s);

function label(coll, key) {
  return FIELD_LABELS[coll]?.[key] || key;
}

export function diff(before, after, coll) {
  const out = [];
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];

  for (const k of keys) {
    if (IGNORE.has(k)) continue;
    const a = before?.[k], b = after?.[k];
    if (same(a, b)) continue;

    // قائمة صفوف (array فيها كائنات)
    const rowsA = Array.isArray(a) && a.some(isObj);
    const rowsB = Array.isArray(b) && b.some(isObj);
    if ((rowsA || rowsB) && !isImageList(a) && !isImageList(b)) {
      out.push(...diffRows(a || [], b || [], k, coll));
      continue;
    }

    // كائن (مثل الصلاحيات) → مقارنة خانة خانة
    if ((isObj(a) || isObj(b)) && !isImage(a) && !isImage(b)) {
      const sub = [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
      for (const s of sub) {
        if (IGNORE.has(s) || same(a?.[s], b?.[s])) continue;
        const field = FIELD_LABELS[coll]?.[`${k}.${s}`] || `${label(coll, k)}: ${s}`;
        out.push({ row: '—', field, before: fmt(a?.[s]), after: fmt(b?.[s]) });
      }
      continue;
    }

    out.push({ row: '—', field: label(coll, k), before: fmt(a), after: fmt(b) });
  }
  return out;
}

// مقارنة الصفوف: بالـ id إن وُجد في كل الصفوف، وإلا بالترتيب (بيانات قديمة)
function diffRows(A, B, key, coll) {
  const out = [];
  const prefix = ROW_PREFIX[key] || label(coll, key);
  const byId = [...A, ...B].every(r => isObj(r) && r.id);
  const rowName = (r, i) => {
    const t = r?.text ? ` (${String(r.text).slice(0, 30)}${String(r.text).length > 30 ? '…' : ''})` : '';
    return `${prefix} ${i + 1}${t}`;
  };
  const summary = r => fmt(r?.text ?? r?.name ?? r?.title ?? r);

  if (byId) {
    const mapA = new Map(A.map((r, i) => [r.id, { r, i }]));
    const mapB = new Map(B.map((r, i) => [r.id, { r, i }]));
    for (const [id, { r, i }] of mapB) {
      if (!mapA.has(id)) out.push({ row: rowName(r, i), field: 'صف جديد', before: '', after: summary(r) });
      else out.push(...diffRowFields(mapA.get(id).r, r, rowName(r, i)));
    }
    for (const [id, { r, i }] of mapA) {
      if (!mapB.has(id)) out.push({ row: rowName(r, i), field: 'حذف الصف', before: summary(r), after: '' });
    }
  } else {
    const n = Math.max(A.length, B.length);
    for (let i = 0; i < n; i++) {
      const a = A[i], b = B[i];
      if (a === undefined) out.push({ row: rowName(b, i), field: 'صف جديد', before: '', after: summary(b) });
      else if (b === undefined) out.push({ row: rowName(a, i), field: 'حذف الصف', before: summary(a), after: '' });
      else out.push(...diffRowFields(a, b, rowName(b, i)));
    }
  }
  return out;
}

function diffRowFields(a, b, rowName) {
  if (!isObj(a) || !isObj(b)) {
    return same(a, b) ? [] : [{ row: rowName, field: 'القيمة', before: fmt(a), after: fmt(b) }];
  }
  const out = [];
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  for (const k of keys) {
    if (IGNORE.has(k) || same(a[k], b[k])) continue;
    out.push({ row: rowName, field: ROW_LABELS[k] || k, before: fmt(a[k]), after: fmt(b[k]) });
  }
  return out;
}
