// ═══════════════════════════════════════
// pumps.js — إدارة المضخات
// ═══════════════════════════════════════

import { Col, Doc, Add, Delete, Listen, Q, OBy } from './firebase.js';
import { state } from './state.js';
import { toast } from './utils.js';

const CITIES = [
  'البيداء (العقيق)','أحد','العيون','العوالي','قباء','المليليح','المندسة','المركزية (الحرم)',
];

// ─── بدء الاستماع لتغييرات المضخات ───
export function initPumps(onUpdate) {
  Listen(Col('pumps'), snap => {
    state.pumps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    populateCitySelects();
    if (typeof onUpdate === 'function') onUpdate();
  });
}

// ─── ملء قوائم البلديات ───
export function populateCitySelects() {
  const extra  = [...new Set(state.pumps.map(p => p.city))];
  const merged = [...new Set([...CITIES, ...extra])];

  document.querySelectorAll('[data-city-select]').forEach(sel => {
    const cur  = sel.value;
    const isFilter = sel.dataset.citySelect === 'filter';
    const first = isFilter
      ? '<option value="">كل البلديات</option>'
      : '<option value="">اختر البلدية</option>';
    sel.innerHTML = first + merged.map(c =>
      `<option ${c === cur ? 'selected' : ''}>${c}</option>`
    ).join('');
  });
}

// ─── تحميل مضخات البلدية في قائمة ───
export function loadPumpsForCity(citySelId, pumpSelId) {
  const city     = document.getElementById(citySelId)?.value;
  const pumpSel  = document.getElementById(pumpSelId);
  if (!pumpSel) return;

  const filtered = state.pumps.filter(p => p.city === city);
  if (!filtered.length) {
    pumpSel.innerHTML = '<option value="">لا توجد مضخات لهذه البلدية — أضفها أولاً</option>';
  } else {
    pumpSel.innerHTML =
      '<option value="">اختر المضخة</option>' +
      filtered.map(p =>
        `<option value="${p.id}">${p.num}${p.desc ? ' — ' + p.desc : ''}</option>`
      ).join('');
  }
}

// ─── إضافة مضخة جديدة ───
export async function addPump() {
  const city = document.getElementById('p_city')?.value;
  const num  = document.getElementById('p_num')?.value.trim();
  const desc = document.getElementById('p_desc')?.value.trim();

  if (!city || !num) { toast('اختر البلدية وأدخل رقم المضخة', 'warn'); return; }

  await Add(Col('pumps'), { city, num, desc, createdAt: Date.now() });

  document.getElementById('p_city').value = '';
  document.getElementById('p_num').value  = '';
  if (document.getElementById('p_desc')) document.getElementById('p_desc').value = '';
  toast('✅ تم إضافة المضخة', 'ok');
}

// ─── حذف مضخة ───
export async function deletePump(id) {
  if (!confirm('حذف هذه المضخة؟')) return;
  await Delete(Doc('pumps', id));
  toast('🗑️ تم حذف المضخة', 'warn');
}

// ─── رسم جدول المضخات ───
export function renderPumps() {
  const fc  = document.getElementById('pf_city')?.value || '';
  const fq  = (document.getElementById('pf_q')?.value || '').toLowerCase();
  const tbody = document.getElementById('pumpsBody');
  if (!tbody) return;

  const data = state.pumps.filter(p => {
    if (fc && p.city !== fc) return false;
    if (fq && !p.num.toLowerCase().includes(fq) && !p.city.includes(fq)) return false;
    return true;
  });

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="empty-icon">🔧</div><p>لا توجد مضخات مسجلة</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = data.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><span class="pump-tag">${p.num}</span></td>
      <td>${p.city}</td>
      <td>${p.desc || '—'}</td>
      <td>${p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-SA') : '—'}</td>
      <td>
        <button class="btn btn-danger btn-sm"
          onclick="window.APP.deletePump('${p.id}')">حذف</button>
      </td>
    </tr>`).join('');
}

export { CITIES };
