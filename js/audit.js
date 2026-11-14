// ═══════════════════════════════════════
// audit.js — صفحة سجل التعديلات (للمالك فقط)
// المجموعة: auditLog — الإعداد: settings/audit.enabled
// ═══════════════════════════════════════

import { Col, Doc, Q, OBy, Where, Limit, After, GetAll, Count, Batch } from './firebase.js';
import { Set as SetDoc } from './db.js';
import { state, isOwner } from './state.js';
import { toast, escHtml as esc } from './utils.js';

const PAGE = 200;
const BATCH = 400;
const $ = id => document.getElementById(id);

let entries = [];        // السجلات المحمّلة
let lastDoc = null;
let hasMore = false;
let loading = false;
const open = new Set();
const selected = new Set();

const OP = {
  create: { label: 'إنشاء', cls: 'b-green' },
  update: { label: 'تعديل', cls: 'b-blue'  },
  delete: { label: 'حذف',   cls: 'b-red'   },
};

// ─── عند فتح الصفحة ───
export async function initAuditPage() {
  if (!isOwner()) return;
  entries = []; lastDoc = null; hasMore = false;
  open.clear(); selected.clear();
  syncSwitch();
  await Promise.all([loadMore(), refreshCount()]);
}

function syncSwitch() {
  const sw = $('au_enabled');
  if (sw) sw.checked = state.auditEnabled !== false;
}

async function refreshCount() {
  const el = $('au_total');
  if (!el) return;
  try {
    const snap = await Count(Col('auditLog'));
    el.textContent = snap.data().count.toLocaleString('ar-SA');
  } catch (e) { console.warn(e); el.textContent = '—'; }
}

async function loadMore() {
  if (loading) return;
  loading = true;
  const btn = $('au_more');
  if (btn) btn.disabled = true;
  try {
    const parts = [Col('auditLog'), OBy('ts', 'desc')];
    if (lastDoc) parts.push(After(lastDoc));
    parts.push(Limit(PAGE));
    const snap = await GetAll(Q(...parts));
    entries.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
    lastDoc = snap.docs.at(-1) || lastDoc;
    hasMore = snap.docs.length === PAGE;
  } catch (e) {
    console.error(e);
    toast('تعذّر تحميل السجل — تحقق من قواعد Firestore', 'err');
  } finally {
    loading = false;
    if (btn) btn.disabled = false;
    renderAudit();
  }
}
export const auditLoadMore = () => loadMore();

// ══════════════════════════════════════
// الرسم
// ══════════════════════════════════════
function filtered() {
  const fu = $('au_user')?.value || '';
  const fs = $('au_sec')?.value  || '';
  const q  = ($('au_q')?.value   || '').trim().toLowerCase();
  return entries.filter(e => {
    if (fu && e.uid !== fu) return false;
    if (fs && e.section !== fs) return false;
    if (q) {
      const hay = [e.name, e.email, e.record, e.section, OP[e.op]?.label,
        ...(e.changes || []).flatMap(c => [c.row, c.field, c.before, c.after])]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function renderAudit(reload = false) {
  if (!isOwner()) return;
  if (reload === true) { initAuditPage(); return; }
  syncSwitch();
  fillUserFilter();

  const tbody = $('au_body');
  if (!tbody) return;
  const data = filtered();

  $('au_shown')    && ($('au_shown').textContent = data.length);
  $('au_loaded')   && ($('au_loaded').textContent = entries.length);
  $('au_selCount') && ($('au_selCount').textContent = selected.size);
  const more = $('au_moreRow');
  if (more) more.style.display = hasMore ? '' : 'none';

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><div class="empty-icon">📜</div><p>${entries.length ? 'لا توجد نتائج' : 'السجل فارغ'}</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(e => {
    const op = OP[e.op] || { label: e.op, cls: 'b-gray' };
    const isOpen = open.has(e.id);
    const row = `
      <tr class="audit-row ${isOpen ? 'open' : ''}" onclick="APP.toggleAuditRow('${e.id}')">
        <td onclick="event.stopPropagation()"><input type="checkbox" ${selected.has(e.id) ? 'checked' : ''}
            onchange="APP.auditToggleSel('${e.id}', this.checked)"></td>
        <td><strong>${esc(e.name) || '—'}</strong>${e.owner ? ' <span class="badge b-yellow">المالك</span>' : ''}
            <div class="audit-email ltr">${esc(e.email)}</div></td>
        <td><span class="badge ${op.cls}">${op.label}</span></td>
        <td>${esc(e.record)}</td>
        <td>${esc(e.section)}</td>
        <td class="audit-time">${e.ts ? new Date(e.ts).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
        <td><span class="badge b-gray">${e.count ?? (e.changes || []).length}</span> ${isOpen ? '▲' : '▼'}</td>
      </tr>`;
    if (!isOpen) return row;
    const ch = e.changes || [];
    return row + `
      <tr class="audit-detail"><td colspan="7">
        <table class="changes-table">
          <thead><tr><th>الصف</th><th>الخانة</th><th>قبل</th><th>بعد</th></tr></thead>
          <tbody>${ch.map(c => `
            <tr>
              <td>${esc(c.row) || '—'}</td>
              <td><strong>${esc(c.field)}</strong></td>
              <td class="aud-before">${esc(c.before) || '—'}</td>
              <td class="aud-after">${esc(c.after) || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${(e.count || 0) > ch.length ? `<div class="hint-text">عُرض أول ${ch.length} تغيير من ${e.count}</div>` : ''}
      </td></tr>`;
  }).join('');
}

function fillUserFilter() {
  const sel = $('au_user');
  if (!sel) return;
  const cur = sel.value;
  const map = new Map();
  if (state.user) map.set(state.user.uid, state.adminCfg.ownerName || state.user.email || 'المالك');
  state.users.forEach(u => map.set(u.id, u.name || u.email));
  entries.forEach(e => { if (!map.has(e.uid)) map.set(e.uid, e.name || e.email || e.uid); });
  sel.innerHTML = '<option value="">كل المستخدمين</option>' +
    [...map].map(([uid, n]) => `<option value="${esc(uid)}" ${uid === cur ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

export function toggleAuditRow(id) {
  open.has(id) ? open.delete(id) : open.add(id);
  renderAudit();
}

export function auditToggleSel(id, on) {
  on ? selected.add(id) : selected.delete(id);
  $('au_selCount') && ($('au_selCount').textContent = selected.size);
}

export function auditSelectVisible() {
  const data = filtered();
  const allOn = data.length && data.every(e => selected.has(e.id));
  data.forEach(e => (allOn ? selected.delete(e.id) : selected.add(e.id)));
  renderAudit();
}

// ─── تشغيل / إيقاف ───
export async function setAuditEnabled(on) {
  try {
    // نكتب الإعداد قبل الإيقاف وبعد التشغيل حتى يظهر التغيير نفسه في السجل
    state.auditEnabled = true;
    await SetDoc(Doc('settings', 'audit'), { enabled: !!on, updatedAt: Date.now() }, { merge: true });
    state.auditEnabled = !!on;
    toast(on ? '✅ تم تشغيل السجل' : '⏸️ تم إيقاف السجل', 'ok');
  } catch (e) {
    console.error(e);
    toast('تعذّر الحفظ', 'err');
  }
  syncSwitch();
}

// ══════════════════════════════════════
// الحذف (على دفعات 400)
// ══════════════════════════════════════
async function deleteIds(ids) {
  for (let i = 0; i < ids.length; i += BATCH) {
    const b = Batch();
    ids.slice(i, i + BATCH).forEach(id => b.delete(Doc('auditLog', id)));
    await b.commit();
  }
}

// يحذف كل نتائج استعلام دفعة بعد دفعة حتى تخلص
async function deleteQuery(makeQuery) {
  let total = 0;
  for (;;) {
    const snap = await GetAll(makeQuery());
    if (snap.empty) break;
    const b = Batch();
    snap.docs.forEach(d => b.delete(d.ref));
    await b.commit();
    total += snap.size;
    toast(`🗑️ جار الحذف... ${total}`, 'warn');
    if (snap.size < BATCH) break;
  }
  return total;
}

async function afterDelete(n) {
  toast(`🗑️ تم حذف ${n.toLocaleString('ar-SA')} سجل`, 'warn');
  await initAuditPage();
}

export async function auditDeleteSelected() {
  const ids = [...selected];
  if (!ids.length) { toast('لم تحدد أي سجل', 'warn'); return; }
  if (!confirm(`حذف ${ids.length} سجل محدد؟`)) return;
  try { await deleteIds(ids); await afterDelete(ids.length); }
  catch (e) { console.error(e); toast('تعذّر الحذف', 'err'); }
}

export async function auditDeleteOlder() {
  const days = parseInt($('au_days')?.value, 10);
  if (!days || days < 1) { toast('اكتب عدد أيام صحيح', 'warn'); return; }
  const cutoff = Date.now() - days * 86400000;
  if (!confirm(`حذف كل السجلات الأقدم من ${days} يوم؟\n(قبل ${new Date(cutoff).toLocaleDateString('ar-SA')})`)) return;
  try {
    const n = await deleteQuery(() => Q(Col('auditLog'), Where('ts', '<', cutoff), Limit(BATCH)));
    await afterDelete(n);
  } catch (e) { console.error(e); toast('تعذّر الحذف', 'err'); }
}

export async function auditDeleteAll() {
  if (!confirm('حذف كل السجل نهائياً؟')) return;
  if (!confirm('تأكيد أخير: لا يمكن التراجع عن حذف كل السجلات.')) return;
  try {
    const n = await deleteQuery(() => Q(Col('auditLog'), Limit(BATCH)));
    await afterDelete(n);
  } catch (e) { console.error(e); toast('تعذّر الحذف', 'err'); }
}
