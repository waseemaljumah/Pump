// ═══════════════════════════════════════
// reports.js — البلاغات (حفظ / تعديل / حذف)
// ═══════════════════════════════════════

import { Col, Doc, Add, Update, Delete, Listen, Q, OBy, Where, Batch } from './firebase.js';
import { state } from './state.js';
import { toast, getStatus, nowStamp, todayISO, setCI, getCI, renderItems, renderItemsReadonly, escHtml } from './utils.js';
import { getPumpPick, resetPumpPicker, setPumpPickFromReport } from './pumps.js';

// مؤقتات النموذج
let formFaults = [];
let formWorks  = [];
let editId     = null;
let editFaults = [];
let editWorks  = [];

// ─── بدء الاستماع للبلاغات ───
// admin = true  → كل البلاغات (بما فيها المخفية)
// admin = false → البلاغات غير المخفية فقط (تفرضها قواعد Firestore أيضاً)
export function initReports(onUpdate, admin = false) {
  const ref = admin
    ? Q(Col('reports'), OBy('createdAt', 'desc'))
    : Q(Col('reports'), Where('hidden', '==', false));

  return Listen(ref, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!admin) list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    state.reports = list;
    if (admin) migrateHiddenField(snap.docs);
    if (typeof onUpdate === 'function') onUpdate();
  }, err => {
    console.warn('reports listener:', err);
    state.reports = [];
    if (typeof onUpdate === 'function') onUpdate();
  });
}

// البلاغات القديمة بدون حقل hidden تُعتبر ظاهرة — نضيف الحقل لها مرة واحدة
let migrated = false;
async function migrateHiddenField(docs) {
  if (migrated) return;
  migrated = true;
  const missing = docs.filter(d => d.data().hidden === undefined);
  try {
    for (let i = 0; i < missing.length; i += 400) {
      const b = Batch();
      missing.slice(i, i + 400).forEach(d => b.update(d.ref, { hidden: false }));
      await b.commit();
    }
  } catch (e) { migrated = false; console.warn('hidden migration:', e); }
}

// إخفاء / إظهار بلاغ عن الزوار
export async function toggleHidden(id) {
  const r = state.reports.find(x => x.id === id);
  if (!r) return;
  try {
    await Update(Doc('reports', id), { hidden: !r.hidden });
    toast(r.hidden ? 'أصبح البلاغ ظاهراً للزوار' : 'تم إخفاء البلاغ عن الزوار', 'ok');
  } catch (e) { console.error(e); toast('تعذّر التنفيذ — صلاحيات الأدمن مطلوبة', 'err'); }
}

// ══════════════════════════════════════
// نموذج البلاغ الجديد
// ══════════════════════════════════════

export function initNewForm() {
  formFaults = [];
  formWorks  = [];
  resetPumpPicker('f');
  document.getElementById('f_date').value = todayISO();
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault', 'window.APP.checkFormFault');
  renderItems('worksList',  formWorks,  'window.APP.delFormWork',  'window.APP.editFormWork',  'window.APP.checkFormWork', 'window.APP.rejectFormWork');
}

export function addFaultToForm() {
  const v = document.getElementById('f_faultInput')?.value.trim();
  if (!v) return;
  formFaults.push({ text: v, date: nowStamp(), done: false });
  document.getElementById('f_faultInput').value = '';
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault', 'window.APP.checkFormFault');
}

export function delFormFault(i) {
  formFaults.splice(i, 1);
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault', 'window.APP.checkFormFault');
}

export function editFormFault(i, newText) {
  if (!newText?.trim()) return;
  formFaults[i].text = newText.trim();
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault', 'window.APP.checkFormFault');
}

export function checkFormFault(i) {
  formFaults[i].done = !formFaults[i].done;
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault', 'window.APP.checkFormFault');
}

export function addWorkToForm() {
  const v = document.getElementById('f_workInput')?.value.trim();
  if (!v) return;
  formWorks.push({ text: v, date: nowStamp(), done: false });
  document.getElementById('f_workInput').value = '';
  renderItems('worksList', formWorks, 'window.APP.delFormWork', 'window.APP.editFormWork', 'window.APP.checkFormWork', 'window.APP.rejectFormWork');
}

export function delFormWork(i) {
  formWorks.splice(i, 1);
  renderItems('worksList', formWorks, 'window.APP.delFormWork', 'window.APP.editFormWork', 'window.APP.checkFormWork', 'window.APP.rejectFormWork');
}

export function editFormWork(i, newText) {
  if (!newText?.trim()) return;
  formWorks[i].text = newText.trim();
  renderItems('worksList', formWorks, 'window.APP.delFormWork', 'window.APP.editFormWork', 'window.APP.checkFormWork', 'window.APP.rejectFormWork');
}

export function checkFormWork(i) {
  formWorks[i].done = !formWorks[i].done;
  renderItems('worksList', formWorks, 'window.APP.delFormWork', 'window.APP.editFormWork', 'window.APP.checkFormWork', 'window.APP.rejectFormWork');
}

export function rejectFormWork(i, reason) {
  formWorks[i].rejected = true;
  formWorks[i].rejectionReason = reason;
  formWorks[i].rejectedAt = nowStamp();
  formWorks[i].done = false;
  renderItems('worksList', formWorks, 'window.APP.delFormWork', 'window.APP.editFormWork', 'window.APP.checkFormWork', 'window.APP.rejectFormWork');
}

export async function saveReport() {
  const pick = getPumpPick('f');
  const date = document.getElementById('f_date')?.value;

  if (!pick?.id) { toast('اكتب رقم المضخة واختر من الاقتراحات', 'warn'); return; }
  if (!date)     { toast('حدد تاريخ البلاغ', 'warn'); return; }
  if (!formFaults.length)        { toast('أضف عطل واحد على الأقل', 'warn'); return; }

  await Add(Col('reports'), {
    num:       document.getElementById('f_num')?.value.trim() || '',
    city: pick.city, pumpId: pick.id, pumpNum: pick.num, date,
    faults:    formFaults,
    orderDate: document.getElementById('f_orderDate')?.value || '',
    works:     formWorks,
    notes:     document.getElementById('f_notes')?.value.trim() || '',
    registered: getCI('ci_reg'),
    approved:   getCI('ci_app'),
    worked:     getCI('ci_worked'),
    hidden:     false,
    createdAt:  Date.now()
  });

  clearNewForm();
  toast('✅ تم حفظ البلاغ بنجاح!', 'ok');
}

export function clearNewForm() {
  formFaults = []; formWorks = [];
  ['f_num','f_orderDate','f_notes','f_faultInput','f_workInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  resetPumpPicker('f');
  document.getElementById('f_date').value = todayISO();
  setCI('ci_reg','cb_reg', false);
  setCI('ci_app','cb_app', false);
  setCI('ci_worked','cb_worked', false);
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault', 'window.APP.checkFormFault');
  renderItems('worksList',  formWorks,  'window.APP.delFormWork',  'window.APP.editFormWork',  'window.APP.checkFormWork', 'window.APP.rejectFormWork');
}

// ══════════════════════════════════════
// نافذة التعديل
// ══════════════════════════════════════

export async function openEdit(id) {
  const r = state.reports.find(x => x.id === id);
  if (!r) return;
  editId     = id;
  editFaults = JSON.parse(JSON.stringify(r.faults || []));
  editWorks  = JSON.parse(JSON.stringify(r.works  || []));

  document.getElementById('editLabel').textContent =
    r.num ? 'بلاغ رقم ' + r.num : r.pumpNum || '';

  document.getElementById('e_num').value       = r.num       || '';
  document.getElementById('e_date').value      = r.date      || '';
  document.getElementById('e_orderDate').value = r.orderDate || '';
  document.getElementById('e_notes').value     = r.notes     || '';

  // مضخة + بلدية (تلقائية)
  setPumpPickFromReport('e', r);

  setCI('e_ci_reg','e_cb_reg', r.registered);
  setCI('e_ci_app','e_cb_app', r.approved);
  setCI('e_ci_worked','e_cb_worked', r.worked);

  renderItems('e_faultsList', editFaults, 'window.APP.delEditFault', 'window.APP.editEditFault', 'window.APP.checkEditFault');
  renderItems('e_worksList',  editWorks,  'window.APP.delEditWork',  'window.APP.editEditWork',  'window.APP.checkEditWork', 'window.APP.rejectEditWork');

  // شريط التقدم
  const steps   = ['البلاغ','أمر العمل','تم العمل','التسجيل','الاعتماد'];
  const stepIdx = { 'no-order':0, worked:1, noreg:2, wait:3, done:4 }[getStatus(r).code] ?? 4;
  const progEl  = document.getElementById('editProg');
  if (progEl) {
    progEl.innerHTML = steps.map((s,i) =>
      `<div class="ps ${i < stepIdx ? 'done' : i === stepIdx ? 'cur' : ''}">
        ${i < stepIdx ? '✓ ' : ''}${s}
      </div>`).join('');
  }

  document.getElementById('editOverlay').classList.add('open');
}

// ─── عرض تفاصيل بلاغ (للقراءة فقط — متاح للزائر والأدمن) ───
export function viewReport(id) {
  const r = state.reports.find(x => x.id === id);
  if (!r) return;

  document.getElementById('viewLabel').textContent = r.num ? 'بلاغ رقم ' + r.num : (r.pumpNum || '');

  const steps   = ['البلاغ','أمر العمل','تم العمل','التسجيل','الاعتماد'];
  const stepIdx = { 'no-order':0, worked:1, noreg:2, wait:3, done:4 }[getStatus(r).code] ?? 4;
  const prog = steps.map((s,i) =>
    `<div class="ps ${i < stepIdx ? 'done' : i === stepIdx ? 'cur' : ''}">${i < stepIdx ? '✓ ' : ''}${s}</div>`).join('');

  const field = (label, val) =>
    `<div class="f"><label>${label}</label><div class="vfield">${escHtml(val) || '—'}</div></div>`;
  const chk = (on, label) =>
    `<div class="ci ${on ? 'on' : ''}" style="cursor:default"><div class="cb">${on ? '✓' : ''}</div>${label}</div>`;

  document.getElementById('viewBody').innerHTML = `
    <div class="prog">${prog}</div>
    <div class="fg">
      ${field('رقم البلاغ', r.num)}
      ${field('رقم المضخة', r.pumpNum)}
      ${field('البلدية', r.city)}
      ${field('تاريخ البلاغ', r.date)}
      ${field('تاريخ أمر العمل', r.orderDate)}
    </div>
    <div class="sep"></div>
    <div class="view-h">🔴 الأعطال</div>
    <div class="fault-list">${renderItemsReadonly(r.faults)}</div>
    <div class="view-h" style="margin-top:14px">🔧 الأعمال التي تمت</div>
    <div class="fault-list">${renderItemsReadonly(r.works)}</div>
    <div class="sep"></div>
    <div class="fg"><div class="f full"><label>ملاحظات</label><div class="vfield" style="white-space:pre-wrap">${escHtml(r.notes) || '—'}</div></div></div>
    <div class="check-row">
      ${chk(r.worked, 'تم العمل عليها 🔧')}
      ${chk(r.registered, 'تم تسجيل الأعمال بالنظام')}
      ${chk(r.approved, 'تم اعتماد الأعمال من المشرف')}
    </div>`;

  document.getElementById('viewOverlay').classList.add('open');
}

export function closeView() {
  document.getElementById('viewOverlay').classList.remove('open');
}

export function closeEdit() {
  document.getElementById('editOverlay').classList.remove('open');
  editId = null;
}

export function addFaultToEdit() {
  const v = document.getElementById('e_faultInput')?.value.trim();
  if (!v) return;
  editFaults.push({ text: v, date: nowStamp(), done: false });
  document.getElementById('e_faultInput').value = '';
  renderItems('e_faultsList', editFaults, 'window.APP.delEditFault', 'window.APP.editEditFault', 'window.APP.checkEditFault');
}
export function delEditFault(i) {
  editFaults.splice(i, 1);
  renderItems('e_faultsList', editFaults, 'window.APP.delEditFault', 'window.APP.editEditFault', 'window.APP.checkEditFault');
}
export function editEditFault(i, newText) {
  if (!newText?.trim()) return;
  editFaults[i].text = newText.trim();
  renderItems('e_faultsList', editFaults, 'window.APP.delEditFault', 'window.APP.editEditFault', 'window.APP.checkEditFault');
}
export function checkEditFault(i) {
  editFaults[i].done = !editFaults[i].done;
  renderItems('e_faultsList', editFaults, 'window.APP.delEditFault', 'window.APP.editEditFault', 'window.APP.checkEditFault');
}

export function addWorkToEdit() {
  const v = document.getElementById('e_workInput')?.value.trim();
  if (!v) return;
  editWorks.push({ text: v, date: nowStamp(), done: false });
  document.getElementById('e_workInput').value = '';
  renderItems('e_worksList', editWorks, 'window.APP.delEditWork', 'window.APP.editEditWork', 'window.APP.checkEditWork', 'window.APP.rejectEditWork');
}
export function delEditWork(i) {
  editWorks.splice(i, 1);
  renderItems('e_worksList', editWorks, 'window.APP.delEditWork', 'window.APP.editEditWork', 'window.APP.checkEditWork', 'window.APP.rejectEditWork');
}
export function editEditWork(i, newText) {
  if (!newText?.trim()) return;
  editWorks[i].text = newText.trim();
  renderItems('e_worksList', editWorks, 'window.APP.delEditWork', 'window.APP.editEditWork', 'window.APP.checkEditWork', 'window.APP.rejectEditWork');
}
export function checkEditWork(i) {
  editWorks[i].done = !editWorks[i].done;
  renderItems('e_worksList', editWorks, 'window.APP.delEditWork', 'window.APP.editEditWork', 'window.APP.checkEditWork', 'window.APP.rejectEditWork');
}

export function rejectEditWork(i, reason) {
  editWorks[i].rejected = true;
  editWorks[i].rejectionReason = reason;
  editWorks[i].rejectedAt = nowStamp();
  editWorks[i].done = false;
  renderItems('e_worksList', editWorks, 'window.APP.delEditWork', 'window.APP.editEditWork', 'window.APP.checkEditWork', 'window.APP.rejectEditWork');
}

export async function saveEdit() {
  if (!editId) return;
  const pick = getPumpPick('e');
  if (!pick?.id) { toast('اكتب رقم المضخة واختر من الاقتراحات', 'warn'); return; }

  await Update(Doc('reports', editId), {
    num:        document.getElementById('e_num').value.trim(),
    city:       pick.city,
    pumpId:     pick.id,
    pumpNum:    pick.num,
    date:       document.getElementById('e_date').value,
    faults:     editFaults,
    orderDate:  document.getElementById('e_orderDate').value,
    works:      editWorks,
    notes:      document.getElementById('e_notes').value.trim(),
    registered: getCI('e_ci_reg'),
    approved:   getCI('e_ci_app'),
    worked:     getCI('e_ci_worked'),
    updatedAt:  Date.now()
  });

  closeEdit();
  toast('✅ تم حفظ التعديلات', 'ok');
}

export async function deleteReport(id) {
  if (!confirm('حذف هذا البلاغ؟')) return;
  await Delete(Doc('reports', id));
  toast('🗑️ تم الحذف', 'warn');
}

// ══════════════════════════════════════
// الأرشفة
// ══════════════════════════════════════
export async function archiveReport(id) {
  if (!confirm('هل تريد أرشفة هذا البلاغ؟')) return;
  await Update(Doc('reports', id), {
    archived: true,
    archivedAt: Date.now()
  });
  toast('📦 تم أرشفة البلاغ', 'ok');
}

export async function unarchiveReport(id) {
  if (!confirm('هل تريد إلغاء أرشفة هذا البلاغ؟')) return;
  await Update(Doc('reports', id), {
    archived: false,
    archivedAt: null
  });
  toast('📤 تم إلغاء الأرشفة', 'ok');
}
