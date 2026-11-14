// ═══════════════════════════════════════
// users.js — إدارة المستخدمين (للمالك فقط)
// الملف: users/{uid} = { name, email, perms: {قسم: hidden|view|edit}, disabled, createdAt }
// ═══════════════════════════════════════

import { Col, Doc, Listen, createAccount, accountUid, resetPassword } from './firebase.js';
import { Set, Update, Delete } from './db.js';
import { state, isOwner, SECTIONS, PERM_LABEL } from './state.js';
import { toast, escHtml } from './utils.js';

const $ = id => document.getElementById(id);
const PERM_CLS = { hidden: 'b-gray', view: 'b-blue', edit: 'b-green' };

let editUid = null;          // null = مستخدم جديد
let draftPerms = {};

// ─── الاستماع لقائمة المستخدمين (المالك فقط) ───
export function initUsers(onUpdate) {
  return Listen(Col('users'), snap => {
    state.users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (typeof onUpdate === 'function') onUpdate();
  }, err => console.warn('users listener:', err));
}

// ══════════════════════════════════════
// الصفحة
// ══════════════════════════════════════
export function renderUsersPage() {
  if (!isOwner()) return;
  const nameInp = $('u_ownerName');
  if (nameInp && document.activeElement !== nameInp) nameInp.value = state.adminCfg.ownerName || '';

  const tbody = $('usersBody');
  if (!tbody) return;
  const cnt = $('usersCount');
  if (cnt) cnt.textContent = `${state.users.length} مستخدم`;

  if (!state.users.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-icon">👥</div><p>لا يوجد مستخدمون — اضغط «مستخدم جديد»</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = state.users.map((u, i) => `
    <tr class="${u.disabled ? 'row-hidden' : ''}">
      <td>${i + 1}</td>
      <td><strong>${escHtml(u.name) || '—'}</strong></td>
      <td class="ltr">${escHtml(u.email)}</td>
      <td><div class="perm-badges">${SECTIONS.map(s => {
        const p = u.perms?.[s.key] || 'hidden';
        return `<span class="badge ${PERM_CLS[p]}" title="${s.label}: ${PERM_LABEL[p]}">${s.icon} ${PERM_LABEL[p]}</span>`;
      }).join('')}</div></td>
      <td>${u.disabled ? '<span class="badge b-red">⛔ موقوف</span>' : '<span class="badge b-green">✓ نشط</span>'}</td>
      <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-SA') : '—'}</td>
      <td><div class="act-cell">
        <button class="btn btn-outline btn-sm" onclick="APP.openUserModal('${u.id}')">✏️ تعديل</button>
        <button class="btn ${u.disabled ? 'btn-success' : 'btn-gray'} btn-sm" onclick="APP.toggleUserDisabled('${u.id}')">${u.disabled ? '▶️ تشغيل' : '⏸️ إيقاف'}</button>
        <button class="btn btn-outline btn-sm" onclick="APP.sendUserReset('${u.id}')" title="إرسال رابط تغيير كلمة المرور على بريده">🔑 رابط كلمة المرور</button>
        <button class="btn btn-danger btn-sm" onclick="APP.deleteUser('${u.id}')">🗑️</button>
      </div></td>
    </tr>`).join('');
}

// ─── اسم المالك ───
export async function saveOwnerName() {
  const name = ($('u_ownerName')?.value || '').trim();
  try {
    await Set(Doc('settings', 'admin'), { ownerName: name }, { merge: true });
    toast('✅ تم حفظ اسم المالك', 'ok');
  } catch (e) { console.error(e); toast('تعذّر الحفظ — تحقق من قواعد Firestore', 'err'); }
}

// ══════════════════════════════════════
// نافذة المستخدم
// ══════════════════════════════════════
export function openUserModal(uid = null) {
  editUid = uid;
  const u = uid ? state.users.find(x => x.id === uid) : null;
  draftPerms = Object.fromEntries(SECTIONS.map(s => [s.key, u?.perms?.[s.key] || 'hidden']));

  $('um_title').textContent = u ? `✏️ تعديل المستخدم — ${u.name || u.email}` : '➕ مستخدم جديد';
  $('um_name').value  = u?.name  || '';
  $('um_email').value = u?.email || '';
  $('um_email').disabled = !!u;
  $('um_pass').value = '';
  $('um_passWrap').style.display = u ? 'none' : '';
  $('um_err').textContent = '';
  renderPermEditor();
  $('userOverlay').classList.add('open');
  setTimeout(() => $('um_name')?.focus(), 50);
}

export function closeUserModal() {
  $('userOverlay')?.classList.remove('open');
  editUid = null;
}

function renderPermEditor() {
  const el = $('um_perms');
  if (!el) return;
  el.innerHTML = SECTIONS.map(s => `
    <div class="perm-row">
      <div>
        <div class="setting-name">${s.icon} ${s.label}</div>
        <div class="setting-desc">${s.desc}</div>
      </div>
      <div class="seg">
        ${['hidden', 'view', 'edit'].map(p => `
          <button type="button" class="seg-btn seg-${p} ${draftPerms[s.key] === p ? 'on' : ''}"
            onclick="APP.setPerm('${s.key}','${p}')">${PERM_LABEL[p]}</button>`).join('')}
      </div>
    </div>`).join('');
}

export function setPerm(sec, p) { draftPerms[sec] = p; renderPermEditor(); }
export function setAllPerms(p)  { SECTIONS.forEach(s => (draftPerms[s.key] = p)); renderPermEditor(); }

const AUTH_ERR = {
  'auth/invalid-email':        'صيغة البريد الإلكتروني غير صحيحة',
  'auth/weak-password':        'كلمة المرور ضعيفة — 6 أحرف على الأقل',
  'auth/operation-not-allowed':'تسجيل الدخول بالبريد غير مفعّل في Firebase',
  'auth/network-request-failed':'تعذّر الاتصال بالشبكة',
  'auth/too-many-requests':    'محاولات كثيرة، حاول لاحقاً',
};

export async function saveUser() {
  const name  = $('um_name').value.trim();
  const email = $('um_email').value.trim().toLowerCase();
  const pass  = $('um_pass').value;
  const err   = $('um_err');
  const btn   = $('um_save');
  err.textContent = '';

  if (!name)  { err.textContent = 'اكتب الاسم'; return; }
  const perms = { ...draftPerms };

  // ── تعديل ──
  if (editUid) {
    btn.disabled = true;
    try {
      await Update(Doc('users', editUid), { name, perms, updatedAt: Date.now() });
      closeUserModal();
      toast('✅ تم حفظ المستخدم — الصلاحيات تُطبّق عليه فوراً', 'ok');
    } catch (e) { console.error(e); err.textContent = 'تعذّر الحفظ: ' + (e.code || e.message); }
    finally { btn.disabled = false; }
    return;
  }

  // ── جديد ──
  if (!email) { err.textContent = 'اكتب البريد الإلكتروني'; return; }
  if (pass.length < 6) { err.textContent = 'كلمة المرور 6 أحرف على الأقل'; return; }
  if (state.users.some(u => (u.email || '').toLowerCase() === email)) { err.textContent = 'يوجد مستخدم بنفس البريد'; return; }
  if (state.user?.email?.toLowerCase() === email) { err.textContent = 'هذا بريد المالك'; return; }

  btn.disabled = true;
  try {
    let uid;
    try {
      uid = await createAccount(email, pass);   // App ثاني → جلسة المالك لا تتأثر
    } catch (e) {
      if (e.code !== 'auth/email-already-in-use') throw e;
      // الحساب موجود في Authentication (مثلاً مستخدم محذوف سابقاً) → نربطه إن كانت كلمة المرور صحيحة
      try { uid = await accountUid(email, pass); }
      catch (_) {
        err.innerHTML = 'هذا البريد له حساب سابق في Firebase Authentication.<br>احذفه من Console ← Authentication، أو اكتب كلمة مروره الحالية لربطه.';
        return;
      }
    }
    if ((state.adminCfg.adminUids || []).includes(uid)) { err.textContent = 'هذا حساب مالك'; return; }

    await Set(Doc('users', uid), { name, email, perms, disabled: false, createdAt: Date.now() });
    closeUserModal();
    toast('✅ تم إنشاء المستخدم', 'ok');
  } catch (e) {
    console.error(e);
    err.textContent = AUTH_ERR[e.code] || ('تعذّر الإنشاء: ' + (e.code || e.message));
  } finally {
    btn.disabled = false;
  }
}

// ─── إيقاف / تشغيل ───
export async function toggleUserDisabled(uid) {
  const u = state.users.find(x => x.id === uid);
  if (!u) return;
  if (!u.disabled && !confirm(`إيقاف حساب «${u.name || u.email}»؟\nسيتم إخراجه من الموقع فوراً.`)) return;
  try {
    await Update(Doc('users', uid), { disabled: !u.disabled, updatedAt: Date.now() });
    toast(u.disabled ? '▶️ تم تشغيل الحساب' : '⏸️ تم إيقاف الحساب', 'ok');
  } catch (e) { console.error(e); toast('تعذّر التنفيذ', 'err'); }
}

// ─── رابط تغيير كلمة المرور ───
export async function sendUserReset(uid) {
  const u = state.users.find(x => x.id === uid);
  if (!u?.email) return;
  if (!confirm(`إرسال رابط تغيير كلمة المرور إلى\n${u.email} ؟`)) return;
  try {
    await resetPassword(u.email);
    toast('📧 تم إرسال الرابط إلى ' + u.email, 'ok');
  } catch (e) { console.error(e); toast('تعذّر الإرسال: ' + (e.code || e.message), 'err'); }
}

// ─── حذف ───
export async function deleteUser(uid) {
  const u = state.users.find(x => x.id === uid);
  if (!u) return;
  if (!confirm(`حذف المستخدم «${u.name || u.email}»؟\n\n` +
    `• يُحذف ملفه من Firestore فلا يقدر يدخل أي قسم (ويخرج فوراً إن كان داخل الموقع).\n` +
    `• حسابه يظل في Firebase Authentication — احذفه من هناك يدوياً:\n  Console ← Authentication ← Users`)) return;
  try {
    await Delete(Doc('users', uid));
    toast('🗑️ تم حذف المستخدم — تذكّر حذف حسابه من Authentication', 'warn');
  } catch (e) { console.error(e); toast('تعذّر الحذف', 'err'); }
}
