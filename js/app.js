// ═══════════════════════════════════════
// app.js — نقطة البداية، الراوتر، الصلاحيات، APP العام
// ═══════════════════════════════════════

import { initPumps, renderPumps, addPump, deletePump, editPump, cancelPumpEdit, savePump, populateCitySelects, pumpSearch, pumpPick, pumpKey, pumpBlur } from './pumps.js';
import { initReports, saveReport, clearNewForm, openEdit, closeEdit, saveEdit, deleteReport, addFaultToForm, delFormFault, editFormFault, checkFormFault, addWorkToForm, delFormWork, editFormWork, checkFormWork, rejectFormWork, addFaultToEdit, delEditFault, editEditFault, checkEditFault, addWorkToEdit, delEditWork, editEditWork, checkEditWork, rejectEditWork, initNewForm, archiveReport, unarchiveReport, toggleHidden, viewReport, closeView } from './reports.js';
import { updateStats, renderDashboard, renderList, renderArchived } from './ui.js';
import { doExport, previewExport } from './export.js';
import { initSettings, ensureDefaultSettings, setSetting, renderSettings } from './settings.js';
import { openLogin, closeLogin, doLogin, doLogout, kickOut, closeMsg } from './auth.js';
import { initUsers, renderUsersPage, saveOwnerName, openUserModal, closeUserModal, setPerm, setAllPerms, saveUser, toggleUserDisabled, sendUserReset, deleteUser } from './users.js';
import { initAuditPage, renderAudit, toggleAuditRow, setAuditEnabled, auditSelectVisible, auditToggleSel, auditDeleteSelected, auditDeleteOlder, auditDeleteAll, auditLoadMore } from './audit.js';
import { initTheme, toggleTheme } from './theme.js';
import { onAuth, Listen, Doc } from './firebase.js';
import { toggleCI, todayISO } from './utils.js';
import {
  state, isAdmin, isOwner, isMember, canView, anyPublic, setScope, displayName,
  needsAllReports, needsPumps, VISITOR_PAGES, MEMBER_PAGES, PAGE_SECTION,
} from './state.js';

// ─── صفحات المشروع ───
const PAGES = {
  dashboard:  'pages/dashboard.html',
  new:        'pages/new-report.html',
  list:       'pages/list.html',
  archived:   'pages/archived.html',
  pumps:      'pages/pumps.html',
  export:     'pages/export.html',
  settings:   'pages/settings.html',
  users:      'pages/users.html',
  audit:      'pages/audit.html',
};
const ALL_PAGES = Object.keys(PAGES);

let currentPage = 'dashboard';
let started = false;

// ══════════════════════════════════════
// Section Scope — كل صفحة تابعة لقسم تُفتح داخل نطاقه
// داخل النطاق: isAdmin() = يقدر يعدّل هذا القسم، فكل الأزرار
// المعتمدة على isAdmin / .admin-only تشتغل بدون تعديل كل صفحة.
// ══════════════════════════════════════
function enterScope(page) {
  setScope(PAGE_SECTION[page] || null);
  document.body.classList.toggle('is-admin', isAdmin());
}

// ══════════════════════════════════════
// ROUTER — تحميل الصفحة
// ══════════════════════════════════════
async function loadPage(name) {
  const url = PAGES[name];
  if (!url) return;

  const res  = await fetch(url);
  const html = await res.text();
  if (currentPage !== name) return;           // تغيّرت الصفحة أثناء التحميل
  enterScope(name);
  document.getElementById('mainContent').innerHTML = html;

  populateCitySelects();
  renderPage(name, true);
}

function renderPage(name, first = false) {
  if (name === 'dashboard') {
    renderDashboard();
  } else if (name === 'new') {
    if (first) { initNewForm(); document.getElementById('f_date').value = todayISO(); }
  } else if (name === 'list') {
    if (first && state.pendingFilter !== null) {
      const sel = document.getElementById('fl_st');
      if (sel) sel.value = state.pendingFilter;
      state.pendingFilter = null;
    }
    renderList();
  } else if (name === 'archived') {
    renderArchived();
  } else if (name === 'pumps') {
    renderPumps();
  } else if (name === 'settings') {
    renderSettings();
  } else if (name === 'users') {
    renderUsersPage();
  } else if (name === 'audit') {
    first ? initAuditPage() : renderAudit();
  }
}

function navTo(name) {
  if (!canView(name)) return;
  currentPage = name;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('nav-' + name)?.classList.add('active');

  loadPage(name);
}

function goFilter(f) {
  if (!canView('list')) return;
  state.pendingFilter = f;
  navTo('list');
}

function firstAllowed() {
  if (isOwner())  return 'dashboard';
  if (isMember()) return MEMBER_PAGES.find(canView) || null;
  return VISITOR_PAGES.find(canView) || null;
}

function showNoAccess() {
  currentPage = 'none';
  setScope(null);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('mainContent').innerHTML = state.user ? `
    <div class="empty">
      <div class="empty-icon">🔒</div>
      <p>لا توجد أقسام متاحة لحسابك حالياً — تواصل مع المالك</p>
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-gray" onclick="APP.doLogout()">خروج</button>
      </div>
    </div>` : `
    <div class="empty">
      <div class="empty-icon">🔒</div>
      <p>لا توجد أقسام متاحة للعرض حالياً</p>
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-primary" onclick="APP.openLogin()">🔐 تسجيل الدخول</button>
      </div>
    </div>`;
}

// ══════════════════════════════════════
// الصلاحيات — إظهار/إخفاء عناصر الواجهة
// ══════════════════════════════════════
function applyAccess() {
  document.body.classList.toggle('is-owner', isOwner());
  document.body.classList.toggle('is-admin', isAdmin());   // حسب القسم الحالي

  const show = (id, ok) => { const el = document.getElementById(id); if (el) el.style.display = ok ? '' : 'none'; };
  ALL_PAGES.forEach(p => show('nav-' + p, canView(p)));

  show('sec-main',     ['dashboard', 'new', 'list', 'archived'].some(canView));
  show('sec-settings', canView('pumps'));
  show('sec-admin',    ['users', 'audit', 'settings'].some(canView));
  show('sec-reports',  canView('export'));
  show('chips',        canView('dashboard'));

  show('loginBtn', !state.user);
  show('userBox',  !!state.user);
  const nm = document.getElementById('userName');
  if (nm) { nm.textContent = displayName(); nm.title = state.user?.email || ''; }
  const role = document.getElementById('userRole');
  if (role) role.textContent = isOwner() ? 'المالك' : '';

  // إن لم يبقَ أي قسم نخفي الشريط الجانبي
  show('sidebar', ALL_PAGES.some(canView));
}

function ensurePage() {
  if (currentPage === 'none' || !canView(currentPage)) {
    const first = firstAllowed();
    first ? navTo(first) : showNoAccess();
  } else {
    document.getElementById('nav-' + currentPage)?.classList.add('active');
  }
}

// ══════════════════════════════════════
// المستمعون — تتغير حسب الدور والصلاحيات
// ══════════════════════════════════════
let unsubReports = null, unsubPumps = null, unsubUsers = null, listenKey = '';

function refreshCurrent() {
  updateStats();
  if (currentPage !== 'none' && canView(currentPage)) {
    enterScope(currentPage);
    renderPage(currentPage);
  }
}

function syncListeners() {
  let key = 'none';
  if (isOwner())       key = 'owner';
  else if (isMember()) key = `member:${needsAllReports() ? 'all' : 'pub'}:${needsPumps() ? 'p' : ''}`;
  else if (!state.user && anyPublic()) key = 'visitor';
  if (key === listenKey) return;
  listenKey = key;

  unsubReports?.(); unsubPumps?.(); unsubUsers?.();
  unsubReports = unsubPumps = unsubUsers = null;
  state.reports = []; state.pumps = []; state.users = [];

  if (key === 'none') { refreshCurrent(); return; }

  if (needsPumps()) unsubPumps = initPumps(() => { if (currentPage === 'pumps') renderPumps(); populateCitySelects(); });
  unsubReports = initReports(refreshCurrent, key === 'owner' || key.includes(':all'));
  if (key === 'owner') unsubUsers = initUsers(() => { if (currentPage === 'users' || currentPage === 'audit') renderPage(currentPage); });
  refreshCurrent();
}

// هل اكتمل تحميل بيانات الحساب؟ + طرد الحساب الموقوف / المحذوف
function accountReady() {
  if (!state.user) return true;
  if (!state.adminLoaded) return false;
  if (isOwner()) return true;
  if (!state.profileLoaded) return false;

  if (!state.profile) {
    kickOut(`لا يوجد حساب مفعّل لهذا البريد في النظام، أو تم حذفه.<br>تواصل مع المالك.
      <div class="msg-uid">معرّف الحساب (UID): <code>${state.user.uid}</code><br>
      إذا كنت المالك: أضف هذا المعرّف في <code>settings/admin → adminUids</code></div>`);
    return false;
  }
  if (state.profile.disabled === true) {
    kickOut('تم إيقاف حسابك.<br>تواصل مع المالك لإعادة تفعيله.');
    return false;
  }
  return true;
}

function onStateChange() {
  if (!state.authReady || !state.settingsLoaded) return;
  if (!accountReady()) return;

  ensureDefaultSettings();
  applyAccess();
  syncListeners();

  if (!started) {
    started = true;
    const first = firstAllowed();
    first ? navTo(first) : showNoAccess();
  } else {
    ensurePage();
    refreshCurrent();
  }
}

// ══════════════════════════════════════
// حساب المستخدم — ملفه وإعدادات المالك والسجل (مباشرة بـ onSnapshot)
// ══════════════════════════════════════
let accountUnsubs = [];

function watchAccount(user) {
  accountUnsubs.forEach(u => u?.());
  accountUnsubs = [];
  state.adminCfg = { adminUids: [], ownerName: '' };
  state.adminLoaded = false;
  state.profile = null;
  state.profileLoaded = false;
  state.auditEnabled = true;
  if (!user) return;

  accountUnsubs.push(Listen(Doc('settings', 'admin'), snap => {
    state.adminCfg = { adminUids: [], ownerName: '', ...(snap.exists() ? snap.data() : {}) };
    state.adminLoaded = true;
    onStateChange();
  }, err => {
    console.warn('admin cfg:', err);
    state.adminLoaded = true;
    onStateChange();
  }));

  // أي تغيير في الصلاحيات أو الإيقاف يُطبّق فوراً
  accountUnsubs.push(Listen(Doc('users', user.uid), snap => {
    state.profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    state.profileLoaded = true;
    onStateChange();
  }, err => {
    console.warn('profile:', err);
    state.profile = null;
    state.profileLoaded = true;
    onStateChange();
  }));

  accountUnsubs.push(Listen(Doc('settings', 'audit'), snap => {
    state.auditEnabled = snap.exists() ? snap.data().enabled !== false : true;
    if (currentPage === 'audit') renderAudit();
  }, err => console.warn('audit cfg:', err)));
}

// ══════════════════════════════════════
// GLOBAL APP — كل الدوال تحت APP
// ══════════════════════════════════════
window.APP = {
  navTo, goFilter,
  // auth / theme / settings
  openLogin, closeLogin, doLogin, doLogout, closeMsg, toggleTheme, setSetting,
  // pumps
  addPump, deletePump, renderPumps, editPump, cancelPumpEdit, savePump,
  pumpSearch, pumpPick, pumpKey, pumpBlur,
  // reports
  saveReport, clearNewForm,
  openEdit, closeEdit, saveEdit, deleteReport, viewReport, closeView,
  addFaultToForm, delFormFault, editFormFault, checkFormFault,
  addWorkToForm,  delFormWork,  editFormWork,  checkFormWork, rejectFormWork,
  addFaultToEdit, delEditFault, editEditFault, checkEditFault,
  addWorkToEdit,  delEditWork,  editEditWork,  checkEditWork, rejectEditWork,
  archiveReport, unarchiveReport, toggleHidden,
  // users (المالك)
  saveOwnerName, openUserModal, closeUserModal, setPerm, setAllPerms, saveUser,
  toggleUserDisabled, sendUserReset, deleteUser, renderUsersPage,
  // audit (المالك)
  renderAudit, toggleAuditRow, setAuditEnabled, auditSelectVisible, auditToggleSel,
  auditDeleteSelected, auditDeleteOlder, auditDeleteAll, auditLoadMore,
  // ui
  updateStats, renderDashboard, renderList, renderArchived,
  // export
  doExport, previewExport,
  // utils
  toggleCI,
};

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
function init() {
  initTheme();

  document.getElementById('topDate').textContent =
    new Date().toLocaleDateString('ar-SA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

  // الإعدادات (قراءة عامة) + حالة تسجيل الدخول
  initSettings(onStateChange);
  onAuth(user => {
    state.user = user;
    state.authReady = true;
    watchAccount(user);
    onStateChange();
  });
}

init();
