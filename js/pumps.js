// ═══════════════════════════════════════
// pumps.js — إدارة المضخات
// ═══════════════════════════════════════

import { Col, Doc, Add, Update, Delete, Listen, Q, OBy, Batch } from './firebase.js';
import { state } from './state.js';
import { toast, escHtml } from './utils.js';

const CITIES = [
  'البيداء (العقيق)','ابيار الماشي','أحد','العيون','العوالي','قباء','المليليح','المندسة','المركزية (الحرم)','اخرى',
];

// ─── بدء الاستماع لتغييرات المضخات ───
export function initPumps(onUpdate) {
  return Listen(Col('pumps'), snap => {
    state.pumps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    populateCitySelects();
    if (typeof onUpdate === 'function') onUpdate();
  }, err => console.warn('pumps listener:', err));
}

// ─── ملء قوائم البلديات ───
export function populateCitySelects() {
  const extra  = [...new Set(state.pumps.map(p => p.city))];
  const merged = [...new Set([...CITIES, ...extra])];

  // اقتراحات البلديات لحقل البلدية القابل للتعديل
  const dl = document.getElementById('cityList');
  if (dl) dl.innerHTML = merged.map(c => `<option value="${escHtml(c)}">`).join('');

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

// ══════════════════════════════════════
// اختيار المضخة بالبحث برقمها (البلدية تظهر تلقائياً)
// prefix: 'f' للنموذج الجديد، 'e' لنافذة التعديل
// ══════════════════════════════════════
const pickers = {};   // prefix → { id, num, city, label }
const activeIdx = {}; // prefix → فهرس الاقتراح المحدد بالأسهم
const $ = id => document.getElementById(id);

// توحيد الأرقام العربية/الفارسية والحروف الصغيرة للبحث
export function norm(s) {
  return String(s ?? '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .toLowerCase().trim();
}

export function pumpLabel(p) { return p.num + (p.desc ? ' — ' + p.desc : ''); }

function findMatches(q) {
  const nq = norm(q);
  const rows = state.pumps.map(p => {
    const n = norm(p.num);
    let rank = -1;
    if (!nq)                         rank = 0;
    else if (n === nq)               rank = 0;
    else if (n.startsWith(nq))       rank = 1;
    else if (n.includes(nq))         rank = 2;
    else if (norm(p.city).includes(nq) || norm(p.desc).includes(nq)) rank = 3;
    return { p, rank };
  }).filter(x => x.rank >= 0);
  rows.sort((a, b) => a.rank - b.rank ||
    String(a.p.num).localeCompare(String(b.p.num), 'ar', { numeric: true }));
  return rows.slice(0, 8).map(x => x.p);
}

function setPicked(prefix, info) {
  pickers[prefix] = info;
  const inp = $(prefix + '_pumpSearch');
  if (inp) { inp.value = info.label; inp.classList.add('picked'); }
  if ($(prefix + '_pumpId')) $(prefix + '_pumpId').value = info.id || '';
  if ($(prefix + '_city'))   $(prefix + '_city').value   = info.city || '';
  hideBox(prefix);
}

function clearPicked(prefix) {
  delete pickers[prefix];
  $(prefix + '_pumpSearch')?.classList.remove('picked');
  if ($(prefix + '_pumpId')) $(prefix + '_pumpId').value = '';
  if ($(prefix + '_city'))   $(prefix + '_city').value   = '';
}

function pickPump(prefix, p) {
  setPicked(prefix, { id: p.id, num: pumpLabel(p), city: p.city, label: p.num });
}

function hideBox(prefix) {
  const box = $(prefix + '_pumpBox');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  activeIdx[prefix] = -1;
}

// عند الكتابة أو التركيز
export function pumpSearch(prefix) {
  const inp = $(prefix + '_pumpSearch'), box = $(prefix + '_pumpBox');
  if (!inp || !box) return;

  const sel = pickers[prefix];
  if (sel) {
    if (inp.value === sel.label) { hideBox(prefix); return; } // اختيار قائم ولم يتغير
    clearPicked(prefix);                                     // تغيّر النص → أعد الاختيار
  }

  const res = findMatches(inp.value);
  box._items = res;
  activeIdx[prefix] = -1;

  if (!state.pumps.length) {
    box.innerHTML = '<div class="pump-empty">لا توجد مضخات مسجلة — اكتب الرقم والبلدية وستُضاف تلقائياً عند الحفظ</div>';
  } else if (!res.length) {
    box.innerHTML = '<div class="pump-empty">مضخة جديدة — اكتب اسم البلدية وستُضاف تلقائياً عند الحفظ</div>';
  } else {
    box.innerHTML = res.map(p => `
      <div class="pump-opt" onclick="window.APP.pumpPick('${prefix}','${p.id}')">
        <span class="po-num">${escHtml(p.num)}</span>
        <span class="po-city">${escHtml(p.city)}</span>
        ${p.desc ? `<span class="po-desc">${escHtml(p.desc)}</span>` : ''}
      </div>`).join('');
  }
  box.style.display = 'block';
}

export function pumpPick(prefix, id) {
  const p = state.pumps.find(x => x.id === id);
  if (p) pickPump(prefix, p);
}

export function pumpKey(e, prefix) {
  const box = $(prefix + '_pumpBox');
  if (!box || box.style.display === 'none') return;
  const opts = box.querySelectorAll('.pump-opt');
  if (e.key === 'Escape') { hideBox(prefix); return; }
  if (!opts.length) return;

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = opts.length;
    let i = activeIdx[prefix] ?? -1;
    i = e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
    activeIdx[prefix] = i;
    opts.forEach((o, k) => o.classList.toggle('active', k === i));
    opts[i].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const i = activeIdx[prefix] >= 0 ? activeIdx[prefix] : 0;
    if (box._items?.[i]) pickPump(prefix, box._items[i]);
  }
}

// عند مغادرة الحقل: إن كان الرقم مطابقاً تماماً لمضخة واحدة اخترها تلقائياً
export function pumpBlur(prefix) {
  setTimeout(() => {
    hideBox(prefix);
    const inp = $(prefix + '_pumpSearch');
    if (!inp || pickers[prefix] || !inp.value.trim()) return;
    const nq = norm(inp.value);
    const exact = state.pumps.filter(p => norm(p.num) === nq);
    if (exact.length === 1) pickPump(prefix, exact[0]);
  }, 120);
}

// البلدية قابلة للتعديل: نقرأ القيمة الحالية من الحقل
export function getPumpPick(prefix) {
  const sel = pickers[prefix];
  if (!sel) return null;
  return { ...sel, city: ($(prefix + '_city')?.value || '').trim() };
}

export function resetPumpPicker(prefix) {
  clearPicked(prefix);
  const inp = $(prefix + '_pumpSearch');
  if (inp) inp.value = '';
  hideBox(prefix);
}

// لنافذة التعديل: عرض مضخة البلاغ الحالية
export function setPumpPickFromReport(prefix, r) {
  const p = state.pumps.find(x => x.id === r.pumpId);
  if (p) { pickPump(prefix, p); return; }
  setPicked(prefix, { id: r.pumpId || '', num: r.pumpNum || '', city: r.city || '', label: r.pumpNum || '' });
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

// ─── تعديل مضخة ───
let editingPumpId = null;

export function editPump(id) {
  editingPumpId = id;
  renderPumps();
  document.getElementById('pe_num')?.focus();
}

export function cancelPumpEdit() {
  editingPumpId = null;
  renderPumps();
}

export async function savePump(id) {
  const p = state.pumps.find(x => x.id === id);
  if (!p) return;
  const city = (document.getElementById('pe_city')?.value || '').trim();
  const num  = (document.getElementById('pe_num')?.value  || '').trim();
  const desc = (document.getElementById('pe_desc')?.value || '').trim();
  if (!city || !num) { toast('البلدية ورقم المضخة مطلوبان', 'warn'); return; }

  if (state.pumps.some(x => x.id !== id && norm(x.num) === norm(num) && norm(x.city) === norm(city))) {
    toast('توجد مضخة بنفس الرقم في هذه البلدية', 'warn'); return;
  }

  try {
    await Update(Doc('pumps', id), { city, num, desc, updatedAt: Date.now() });

    // تحديث البلاغات المرتبطة بالمضخة (الرقم والبلدية محفوظة داخل كل بلاغ)
    const linked = state.reports.filter(r => r.pumpId === id);
    const changed = city !== p.city || num !== p.num || desc !== (p.desc || '');
    if (linked.length && changed &&
        confirm(`هذه المضخة مرتبطة بـ ${linked.length} بلاغ.\nهل تريد تحديث رقمها وبلديتها في هذه البلاغات أيضاً؟\n\nموافق = تحديث البلاغات\nإلغاء = تعديل المضخة فقط`)) {
      const pumpNum = pumpLabel({ num, desc });
      for (let i = 0; i < linked.length; i += 400) {
        const b = Batch();
        linked.slice(i, i + 400).forEach(r => b.update(Doc('reports', r.id), { city, pumpNum }));
        await b.commit();
      }
    }
    editingPumpId = null;
    renderPumps();
    toast('✅ تم حفظ تعديل المضخة', 'ok');
  } catch (e) {
    console.error(e);
    toast('تعذّر حفظ التعديل', 'err');
  }
}

// ─── رسم جدول المضخات ───
export function renderPumps() {
  const fc  = document.getElementById('pf_city')?.value || '';
  const fq  = (document.getElementById('pf_q')?.value || '').toLowerCase();
  const tbody = document.getElementById('pumpsBody');
  if (!tbody) return;

  const data = state.pumps.filter(p => {
    if (p.id === editingPumpId) return true; // لا تخفِ المضخة أثناء تعديلها
    if (fc && p.city !== fc) return false;
    if (fq && !String(p.num).toLowerCase().includes(fq) && !String(p.city).includes(fq) &&
        !String(p.desc || '').toLowerCase().includes(fq)) return false;
    return true;
  });

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="empty-icon">🔧</div><p>لا توجد مضخات مسجلة</p></div></td></tr>';
    return;
  }

  const cities = [...new Set([...CITIES, ...state.pumps.map(p => p.city)])];

  // الحفاظ على ما كُتب في صف التعديل إن أُعيد رسم الجدول (تحديث من Firebase)
  const draft = editingPumpId && document.getElementById('pe_num') ? {
    num:  document.getElementById('pe_num').value,
    city: document.getElementById('pe_city').value,
    desc: document.getElementById('pe_desc').value,
  } : null;

  tbody.innerHTML = data.map((p, i) => {
    if (p.id === editingPumpId) {
      const v = draft || { num: p.num, city: p.city, desc: p.desc || '' };
      return `
    <tr class="row-editing">
      <td>${i + 1}</td>
      <td><input type="text" id="pe_num" value="${escHtml(v.num)}" style="min-width:90px"
        onkeydown="if(event.key==='Enter')window.APP.savePump('${p.id}');if(event.key==='Escape')window.APP.cancelPumpEdit()"></td>
      <td><select id="pe_city">
        ${cities.map(c => `<option ${c === v.city ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
      </select></td>
      <td><input type="text" id="pe_desc" value="${escHtml(v.desc)}" placeholder="موقع أو وصف المضخة"
        onkeydown="if(event.key==='Enter')window.APP.savePump('${p.id}');if(event.key==='Escape')window.APP.cancelPumpEdit()"></td>
      <td>${p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-SA') : '—'}</td>
      <td><div class="act-cell">
        <button class="btn btn-success btn-sm" onclick="window.APP.savePump('${p.id}')">💾 حفظ</button>
        <button class="btn btn-gray btn-sm" onclick="window.APP.cancelPumpEdit()">إلغاء</button>
      </div></td>
    </tr>`;
    }
    return `
    <tr>
      <td>${i + 1}</td>
      <td><span class="pump-tag">${escHtml(p.num)}</span></td>
      <td>${escHtml(p.city)}</td>
      <td>${escHtml(p.desc) || '—'}</td>
      <td>${p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-SA') : '—'}</td>
      <td><div class="act-cell">
        <button class="btn btn-outline btn-sm" onclick="window.APP.editPump('${p.id}')">✏️ تعديل</button>
        <button class="btn btn-danger btn-sm" onclick="window.APP.deletePump('${p.id}')">حذف</button>
      </div></td>
    </tr>`;
  }).join('');
}

export { CITIES };
