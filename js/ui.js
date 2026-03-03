// ═══════════════════════════════════════
// ui.js — رسم الواجهة (لوحة التحكم، الجداول، الإحصائيات)
// ═══════════════════════════════════════

import { state } from './state.js';
import { getStatus, matchFilter } from './utils.js';

// ══════════════════════════════════════
// الإحصائيات العلوية
// ══════════════════════════════════════
export function updateStats() {
  const R     = state.reports;
  const total = R.length;
  const done  = R.filter(r => getStatus(r).code === 'done').length;

  set('tTotal',   total);
  set('tPending', total - done);
  set('tDone',    done);
  set('s0',       total);
  set('s1',       R.filter(r => !!r.orderDate).length);
  set('s2',       R.filter(r => !r.orderDate).length);
  set('s3',       R.filter(r => r.registered).length);
  set('s4',       R.filter(r => r.orderDate && !r.registered).length);
  set('s5',       R.filter(r => r.registered && !r.approved).length);
  set('s6',       done);

  const sub = document.getElementById('dashSub');
  if (sub) sub.textContent = `آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}`;
}

// ══════════════════════════════════════
// لوحة التحكم
// ══════════════════════════════════════
export function renderDashboard() {
  updateStats();
  const urgent = state.reports.filter(r => getStatus(r).code !== 'done').slice(0, 12);
  const el = document.getElementById('dashTable');
  if (!el) return;

  if (!urgent.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🎉</div><p>جميع البلاغات مكتملة!</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="tw">
      <table>
        <thead><tr>
          <th>رقم البلاغ</th><th>المضخة</th><th>البلدية</th><th>التاريخ</th>
          <th>أمر العمل</th><th>التسجيل</th><th>الاعتماد</th><th>الحالة</th><th>إجراء</th>
        </tr></thead>
        <tbody>
          ${urgent.map(r => reportRow(r)).join('')}
        </tbody>
      </table>
    </div>`;
}

// ══════════════════════════════════════
// قائمة البلاغات
// ══════════════════════════════════════
export function renderList() {
  const q    = (document.getElementById('fl_q')?.value || '').toLowerCase();
  const city = document.getElementById('fl_city')?.value || '';
  const st   = document.getElementById('fl_st')?.value   || '';
  const sort = document.getElementById('fl_sort')?.value || 'desc';

  let data = state.reports.filter(r => {
    if (q && !(r.num||'').toLowerCase().includes(q) &&
             !(r.pumpNum||'').toLowerCase().includes(q) &&
             !r.city.includes(q)) return false;
    if (city && r.city !== city) return false;
    if (!matchFilter(r, st))     return false;
    return true;
  });

  data.sort((a, b) =>
    sort === 'desc'
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date)
  );

  const countEl = document.getElementById('listCount');
  if (countEl) countEl.textContent = `${data.length} بلاغ`;

  const tbody = document.getElementById('listBody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="10">
      <div class="empty"><div class="empty-icon">📭</div><p>لا توجد نتائج</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((r, i) => {
    const status = getStatus(r);
    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${r.num || '—'}</strong></td>
      <td><span class="pump-tag">${r.pumpNum || '—'}</span></td>
      <td>${r.city}</td>
      <td>${r.date}</td>
      <td><span class="badge ${r.orderDate ? 'b-blue' : 'b-red'}">${r.orderDate || '—'}</span></td>
      <td><span class="badge ${r.registered ? 'b-green' : 'b-red'}">${r.registered ? '✓' : '✗'}</span></td>
      <td><span class="badge ${r.approved   ? 'b-green' : 'b-red'}">${r.approved   ? '✓' : '✗'}</span></td>
      <td><span class="badge ${status.cls}">${status.label}</span></td>
      <td style="display:flex;gap:5px">
        <button class="btn btn-outline btn-sm" onclick="window.APP.openEdit('${r.id}')">✏️</button>
        <button class="btn btn-danger  btn-sm" onclick="window.APP.deleteReport('${r.id}')">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

// ─── صف بلاغ مشترك ───
function reportRow(r) {
  const st = getStatus(r);
  return `<tr>
    <td><strong>${r.num || '—'}</strong></td>
    <td><span class="pump-tag">${r.pumpNum || '—'}</span></td>
    <td>${r.city}</td>
    <td>${r.date}</td>
    <td><span class="badge ${r.orderDate   ? 'b-blue'  : 'b-red'}">${r.orderDate   || '—'}</span></td>
    <td><span class="badge ${r.registered  ? 'b-green' : 'b-red'}">${r.registered  ? '✓' : '✗'}</span></td>
    <td><span class="badge ${r.approved    ? 'b-green' : 'b-red'}">${r.approved    ? '✓' : '✗'}</span></td>
    <td><span class="badge ${st.cls}">${st.label}</span></td>
    <td><button class="btn btn-outline btn-sm" onclick="window.APP.openEdit('${r.id}')">تعديل</button></td>
  </tr>`;
}

// ─── helper ───
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
