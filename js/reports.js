// ═══════════════════════════════════════
// reports.js — البلاغات (حفظ / تعديل / حذف)
// ═══════════════════════════════════════

import { Col, Doc, Add, Update, Delete, Listen, Q, OBy } from './firebase.js';
import { state } from './state.js';
import { toast, getStatus, nowStamp, todayISO, setCI, getCI, renderItems } from './utils.js';
import { loadPumpsForCity } from './pumps.js';

// مؤقتات النموذج
let formFaults = [];
let formWorks  = [];
let editId     = null;
let editFaults = [];
let editWorks  = [];

// ─── بدء الاستماع للبلاغات ───
export function initReports(onUpdate) {
  Listen(Q(Col('reports'), OBy('createdAt', 'desc')), snap => {
    state.reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (typeof onUpdate === 'function') onUpdate();
  });
}

// ══════════════════════════════════════
// نموذج البلاغ الجديد
// ══════════════════════════════════════

export function initNewForm() {
  formFaults = [];
  formWorks  = [];
  document.getElementById('f_date').value = todayISO();
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault');
  renderItems('worksList',  formWorks,  'window.APP.delFormWork',  'window.APP.editFormWork');
}

export function addFaultToForm() {
  const v = document.getElementById('f_faultInput')?.value.trim();
  if (!v) return;
  formFaults.push({ text: v, date: nowStamp() });
  document.getElementById('f_faultInput').value = '';
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault');
}

export function delFormFault(i) {
  formFaults.splice(i, 1);
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault');
}

export function editFormFault(i, newText) {
  if (!newText?.trim()) return;
  formFaults[i].text = newText.trim();
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault');
}

export function addWorkToForm() {
  const v = document.getElementById('f_workInput')?.value.trim();
  if (!v) return;
  formWorks.push({ text: v, date: nowStamp() });
  document.getElementById('f_workInput').value = '';
  renderItems('worksList', formWorks, 'window.APP.delFormWork', 'window.APP.editFormWork');
}

export function delFormWork(i) {
  formWorks.splice(i, 1);
  renderItems('worksList', formWorks, 'window.APP.delFormWork', 'window.APP.editFormWork');
}

export function editFormWork(i, newText) {
  if (!newText?.trim()) return;
  formWorks[i].text = newText.trim();
  renderItems('worksList', formWorks, 'window.APP.delFormWork', 'window.APP.editFormWork');
}

export async function saveReport() {
  const city    = document.getElementById('f_city')?.value;
  const pumpSel = document.getElementById('f_pump');
  const pumpId  = pumpSel?.value;
  const pumpNum = pumpSel?.options[pumpSel.selectedIndex]?.text || '';
  const date    = document.getElementById('f_date')?.value;

  if (!city || !pumpId || !date) { toast('اختر البلدية والمضخة والتاريخ', 'warn'); return; }
  if (!formFaults.length)        { toast('أضف عطل واحد على الأقل', 'warn'); return; }

  await Add(Col('reports'), {
    num:       document.getElementById('f_num')?.value.trim() || '',
    city, pumpId, pumpNum, date,
    faults:    formFaults,
    orderDate: document.getElementById('f_orderDate')?.value || '',
    works:     formWorks,
    notes:     document.getElementById('f_notes')?.value.trim() || '',
    registered: getCI('ci_reg'),
    approved:   getCI('ci_app'),
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
  const fc = document.getElementById('f_city');
  if (fc) fc.value = '';
  const fp = document.getElementById('f_pump');
  if (fp) fp.innerHTML = '<option value="">اختر البلدية أولاً</option>';
  document.getElementById('f_date').value = todayISO();
  setCI('ci_reg','cb_reg', false);
  setCI('ci_app','cb_app', false);
  renderItems('faultsList', formFaults, 'window.APP.delFormFault', 'window.APP.editFormFault');
  renderItems('worksList',  formWorks,  'window.APP.delFormWork',  'window.APP.editFormWork');
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

  // بلدية + مضخة
  const eCityEl = document.getElementById('e_city');
  if (eCityEl) eCityEl.value = r.city;
  await loadPumpsForCity('e_city', 'e_pump');
  const ePumpEl = document.getElementById('e_pump');
  if (ePumpEl) ePumpEl.value = r.pumpId || '';

  setCI('e_ci_reg','e_cb_reg', r.registered);
  setCI('e_ci_app','e_cb_app', r.approved);

  renderItems('e_faultsList', editFaults, 'window.APP.delEditFault', 'window.APP.editEditFault');
  renderItems('e_worksList',  editWorks,  'window.APP.delEditWork',  'window.APP.editEditWork');

  // شريط التقدم
  const steps   = ['البلاغ','أمر العمل','التسجيل','الاعتماد'];
  const stepIdx = { 'no-order':0, noreg:1, wait:2, done:3 }[getStatus(r).code] ?? 3;
  const progEl  = document.getElementById('editProg');
  if (progEl) {
    progEl.innerHTML = steps.map((s,i) =>
      `<div class="ps ${i < stepIdx ? 'done' : i === stepIdx ? 'cur' : ''}">
        ${i < stepIdx ? '✓ ' : ''}${s}
      </div>`).join('');
  }

  document.getElementById('editOverlay').classList.add('open');
}

export function closeEdit() {
  document.getElementById('editOverlay').classList.remove('open');
  editId = null;
}

export function addFaultToEdit() {
  const v = document.getElementById('e_faultInput')?.value.trim();
  if (!v) return;
  editFaults.push({ text: v, date: nowStamp() });
  document.getElementById('e_faultInput').value = '';
  renderItems('e_faultsList', editFaults, 'window.APP.delEditFault', 'window.APP.editEditFault');
}
export function delEditFault(i) {
  editFaults.splice(i, 1);
  renderItems('e_faultsList', editFaults, 'window.APP.delEditFault', 'window.APP.editEditFault');
}
export function editEditFault(i, newText) {
  if (!newText?.trim()) return;
  editFaults[i].text = newText.trim();
  renderItems('e_faultsList', editFaults, 'window.APP.delEditFault', 'window.APP.editEditFault');
}

export function addWorkToEdit() {
  const v = document.getElementById('e_workInput')?.value.trim();
  if (!v) return;
  editWorks.push({ text: v, date: nowStamp() });
  document.getElementById('e_workInput').value = '';
  renderItems('e_worksList', editWorks, 'window.APP.delEditWork', 'window.APP.editEditWork');
}
export function delEditWork(i) {
  editWorks.splice(i, 1);
  renderItems('e_worksList', editWorks, 'window.APP.delEditWork', 'window.APP.editEditWork');
}
export function editEditWork(i, newText) {
  if (!newText?.trim()) return;
  editWorks[i].text = newText.trim();
  renderItems('e_worksList', editWorks, 'window.APP.delEditWork', 'window.APP.editEditWork');
}

export async function saveEdit() {
  if (!editId) return;
  const pumpSel = document.getElementById('e_pump');
  const pumpId  = pumpSel?.value;
  const pumpNum = pumpSel?.options[pumpSel.selectedIndex]?.text || '';

  await Update(Doc('reports', editId), {
    num:        document.getElementById('e_num').value.trim(),
    city:       document.getElementById('e_city').value,
    pumpId, pumpNum,
    date:       document.getElementById('e_date').value,
    faults:     editFaults,
    orderDate:  document.getElementById('e_orderDate').value,
    works:      editWorks,
    notes:      document.getElementById('e_notes').value.trim(),
    registered: getCI('e_ci_reg'),
    approved:   getCI('e_ci_app'),
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
