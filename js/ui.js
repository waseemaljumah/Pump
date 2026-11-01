// ═══════════════════════════════════════
// ui.js — رسم الواجهة (لوحة التحكم، الجداول، الإحصائيات)
// ═══════════════════════════════════════

import { state, isAdmin, canView } from './state.js';
import { getStatus, matchFilter, escHtml as esc } from './utils.js';

// أزرار الإجراءات (للأدمن فقط)
function hideBtn(r) {
  return `<button class="btn btn-gray btn-sm" onclick="window.APP.toggleHidden('${r.id}')"
    title="${r.hidden ? 'إظهار للزوار' : 'إخفاء عن الزوار'}">${r.hidden ? '👁️ إظهار' : '🙈 إخفاء'}</button>`;
}
const hiddenBadge = r => r.hidden ? ' <span class="badge b-gray">🙈 مخفي</span>' : '';

// ══════════════════════════════════════
// الإحصائيات العلوية
// ══════════════════════════════════════
export function updateStats() {
  const R     = state.reports.filter(r => !r.archived); // تجاهل المؤرشفة
  const total = R.length;
  const done  = R.filter(r => getStatus(r).code === 'done').length;

  set('tTotal',   total);
  set('tPending', total - done);
  set('tDone',    done);
  set('s0',       total);
  set('s1',       R.filter(r => !!r.orderDate).length);
  set('s2',       R.filter(r => !r.orderDate).length);
  set('s3',       R.filter(r => r.worked && !r.registered).length);
  set('s4',       R.filter(r => r.registered).length);
  set('s5',       R.filter(r => r.orderDate && !r.registered).length);
  set('s6',       R.filter(r => r.registered && !r.approved).length);
  set('s7',       done);

  const sub = document.getElementById('dashSub');
  if (sub) sub.textContent = `آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}`;
}

// ══════════════════════════════════════
// لوحة التحكم
// ══════════════════════════════════════
export function renderDashboard() {
  updateStats();
  const urgent = state.reports
    .filter(r => !r.archived && getStatus(r).code !== 'done')
    .slice(0, 12);
  const el = document.getElementById('dashTable');
  if (!el) return;

  // الزائر: لا روابط للقائمة إن كانت مخفية
  document.querySelector('.stat-grid')?.classList.toggle('no-link', !canView('list'));
  const allBtn = document.getElementById('dashAllBtn');
  if (allBtn) allBtn.style.display = canView('list') ? '' : 'none';

  if (!urgent.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🎉</div><p>جميع البلاغات مكتملة!</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="tw">
      <table>
        <thead><tr>
          <th>رقم البلاغ</th><th>المضخة</th><th>البلدية</th><th>التاريخ</th>
          <th>أمر العمل</th><th>تم العمل</th><th>التسجيل</th><th>الاعتماد</th><th>الحالة</th><th class="admin-only">إجراء</th>
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
  const q       = (document.getElementById('fl_q')?.value || '').toLowerCase();
  const city    = document.getElementById('fl_city')?.value || '';
  const st      = document.getElementById('fl_st')?.value   || '';
  const sort    = document.getElementById('fl_sort')?.value || 'desc';
  const vis     = isAdmin() ? (document.getElementById('fl_vis')?.value || '') : '';

  let data = state.reports.filter(r => {
    // إخفاء البلاغات المؤرشفة من القائمة الرئيسية
    if (r.archived === true) return false;
    
    if (q && !(r.num||'').toLowerCase().includes(q) &&
             !(r.pumpNum||'').toLowerCase().includes(q) &&
             !(r.city||'').includes(q)) return false;
    if (city && r.city !== city) return false;
    if (!matchFilter(r, st))     return false;
    if (vis === 'hidden'  && !r.hidden) return false;
    if (vis === 'visible' &&  r.hidden) return false;
    
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
    tbody.innerHTML = `<tr><td colspan="11">
      <div class="empty"><div class="empty-icon">📭</div><p>لا توجد نتائج</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((r, i) => {
    const status = getStatus(r);
    
    return `<tr class="${r.hidden ? 'row-hidden' : ''}">
      <td>${i + 1}</td>
      <td><strong>${esc(r.num) || '—'}</strong>${hiddenBadge(r)}</td>
      <td><span class="pump-tag">${esc(r.pumpNum) || '—'}</span></td>
      <td>${esc(r.city)}</td>
      <td>${esc(r.date)}</td>
      <td><span class="badge ${r.orderDate ? 'b-blue' : 'b-red'}">${esc(r.orderDate) || '—'}</span></td>
      <td><span class="badge ${r.worked ? 'b-purple': 'b-red'}">${r.worked ? '✓' : '✗'}</span></td>
      <td><span class="badge ${r.registered? 'b-green' : 'b-red'}">${r.registered? '✓' : '✗'}</span></td>
      <td><span class="badge ${r.approved  ? 'b-green' : 'b-red'}">${r.approved  ? '✓' : '✗'}</span></td>
      <td><span class="badge ${status.cls}">${status.label}</span></td>
      <td class="admin-only"><div class="act-cell">
        <button class="btn btn-outline btn-sm" onclick="window.APP.openEdit('${r.id}')">✏️</button>
        ${hideBtn(r)}
        <button class="btn btn-primary btn-sm" onclick="window.APP.archiveReport('${r.id}')" title="أرشفة">📦</button>
        <button class="btn btn-danger  btn-sm" onclick="window.APP.deleteReport('${r.id}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════
// صفحة الأرشيف
// ══════════════════════════════════════
export function renderArchived() {
  const q    = (document.getElementById('ar_q')?.value || '').toLowerCase();
  const city = document.getElementById('ar_city')?.value || '';
  const sort = document.getElementById('ar_sort')?.value || 'desc';

  let data = state.reports.filter(r => {
    // فقط البلاغات المؤرشفة
    if (r.archived !== true) return false;
    
    if (q && !(r.num||'').toLowerCase().includes(q) &&
             !(r.pumpNum||'').toLowerCase().includes(q) &&
             !(r.city||'').includes(q)) return false;
    if (city && r.city !== city) return false;
    
    return true;
  });

  data.sort((a, b) =>
    sort === 'desc'
      ? (b.archivedAt || 0) - (a.archivedAt || 0)
      : (a.archivedAt || 0) - (b.archivedAt || 0)
  );

  const countEl = document.getElementById('archivedCount');
  if (countEl) countEl.textContent = `${data.length} بلاغ مؤرشف`;

  const tbody = document.getElementById('archivedBody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="12">
      <div class="empty"><div class="empty-icon">📦</div><p>لا توجد بلاغات مؤرشفة</p></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map((r, i) => {
    const status = getStatus(r);
    const archivedDate = r.archivedAt ? new Date(r.archivedAt).toLocaleDateString('ar-SA') : '—';
    
    return `<tr class="row-archived">
      <td>${i + 1}</td>
      <td><strong>${r.num || '—'}</strong></td>
      <td><span class="pump-tag">${r.pumpNum || '—'}</span></td>
      <td>${r.city}</td>
      <td>${r.date}</td>
      <td><span class="badge b-gray">${archivedDate}</span></td>
      <td><span class="badge ${r.orderDate ? 'b-blue' : 'b-red'}">${r.orderDate || '—'}</span></td>
      <td><span class="badge ${r.worked ? 'b-purple': 'b-red'}">${r.worked ? '✓' : '✗'}</span></td>
      <td><span class="badge ${r.registered? 'b-green' : 'b-red'}">${r.registered? '✓' : '✗'}</span></td>
      <td><span class="badge ${r.approved  ? 'b-green' : 'b-red'}">${r.approved  ? '✓' : '✗'}</span></td>
      <td><span class="badge ${status.cls}">${status.label}</span></td>
      <td><div class="act-cell">
        <button class="btn btn-outline btn-sm" onclick="window.APP.openEdit('${r.id}')">✏️</button>
        <button class="btn btn-success btn-sm" onclick="window.APP.unarchiveReport('${r.id}')" title="إلغاء الأرشفة">📤 استعادة</button>
        <button class="btn btn-danger  btn-sm" onclick="window.APP.deleteReport('${r.id}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('');
}

// ─── صف بلاغ مشترك (لوحة التحكم) ───
function reportRow(r) {
  const st = getStatus(r);
  return `<tr class="${r.hidden ? 'row-hidden' : ''}">
    <td><strong>${esc(r.num) || '—'}</strong>${hiddenBadge(r)}</td>
    <td><span class="pump-tag">${esc(r.pumpNum) || '—'}</span></td>
    <td>${esc(r.city)}</td>
    <td>${esc(r.date)}</td>
    <td><span class="badge ${r.orderDate  ? 'b-blue'   : 'b-red'}">${esc(r.orderDate) || '—'}</span></td>
    <td><span class="badge ${r.worked     ? 'b-purple' : 'b-red'}">${r.worked     ? '✓' : '✗'}</span></td>
    <td><span class="badge ${r.registered ? 'b-green'  : 'b-red'}">${r.registered ? '✓' : '✗'}</span></td>
    <td><span class="badge ${r.approved   ? 'b-green'  : 'b-red'}">${r.approved   ? '✓' : '✗'}</span></td>
    <td><span class="badge ${st.cls}">${st.label}</span></td>
    <td class="admin-only"><div class="act-cell">
      <button class="btn btn-outline btn-sm" onclick="window.APP.openEdit('${r.id}')">تعديل</button>
      ${hideBtn(r)}
      <button class="btn btn-primary btn-sm" onclick="window.APP.archiveReport('${r.id}')" title="أرشفة">📦</button>
    </div></td>
  </tr>`;
}

// ─── helper ───
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
