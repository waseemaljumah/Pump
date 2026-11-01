// ═══════════════════════════════════════
// app.js — نقطة البداية، الراوتر، الصلاحيات، APP العام
// ═══════════════════════════════════════

import { initPumps, renderPumps, addPump, deletePump, populateCitySelects, pumpSearch, pumpPick, pumpKey, pumpBlur } from './pumps.js';
import { initReports, saveReport, clearNewForm, openEdit, closeEdit, saveEdit, deleteReport, addFaultToForm, delFormFault, editFormFault, checkFormFault, addWorkToForm, delFormWork, editFormWork, checkFormWork, rejectFormWork, addFaultToEdit, delEditFault, editEditFault, checkEditFault, addWorkToEdit, delEditWork, editEditWork, checkEditWork, rejectEditWork, initNewForm, archiveReport, unarchiveReport, toggleHidden, viewReport, closeView } from './reports.js';
import { updateStats, renderDashboard, renderList, renderArchived } from './ui.js';
import { doExport, previewExport } from './export.js';
import { initSettings, ensureDefaultSettings, setSetting, renderSettings } from './settings.js';
import { openLogin, closeLogin, doLogin, doLogout } from './auth.js';
import { initTheme, toggleTheme } from './theme.js';
import { onAuth } from './firebase.js';
import { toggleCI, todayISO } from './utils.js';
import { state, isAdmin, canView, anyPublic, VISITOR_PAGES } from './state.js';

// ─── صفحات المشروع ───
const PAGES = {
  dashboard:  'pages/dashboard.html',
  new:        'pages/new-report.html',
  list:       'pages/list.html',
  archived:   'pages/archived.html',
  pumps:      'pages/pumps.html',
  export:     'pages/export.html',
  settings:   'pages/settings.html',
};

let currentPage = 'dashboard';
let started = false;

// ══════════════════════════════════════
// ROUTER — تحميل الصفحة
// ══════════════════════════════════════
async function loadPage(name) {
  const url = PAGES[name];
  if (!url) return;

  const res  = await fetch(url);
  const html = await res.text();
  if (currentPage !== name) return;           // تغيّرت الصفحة أثناء التحميل
  document.getElementById('mainContent').innerHTML = html;

  populateCitySelects();

  if (name === 'dashboard') {
    renderDashboard();
  } else if (name === 'new') {
    initNewForm();
    document.getElementById('f_date').value = todayISO();
  } else if (name === 'list') {
    if (state.pendingFilter !== null) {
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
  return isAdmin() ? 'dashboard' : VISITOR_PAGES.find(canView) || null;
}

function showNoAccess() {
  currentPage = 'none';
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('mainContent').innerHTML = `
    <div class="empty">
      <div class="empty-icon">🔒</div>
      <p>لا توجد أقسام متاحة للعرض حالياً</p>
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-primary" onclick="APP.openLogin()">🔐 دخول الإدارة</button>
      </div>
    </div>`;
}

// ══════════════════════════════════════
// الصلاحيات — إظهار/إخفاء عناصر الواجهة
// ══════════════════════════════════════
function applyAccess() {
  const admin = isAdmin();
  document.body.classList.toggle('is-admin', admin);

  const show = (id, ok) => { const el = document.getElementById(id); if (el) el.style.display = ok ? '' : 'none'; };
  const pages = ['dashboard', 'new', 'list', 'archived', 'pumps', 'settings', 'export'];
  pages.forEach(p => show('nav-' + p, canView(p)));

  show('sec-main',     ['dashboard', 'new', 'list', 'archived'].some(canView));
  show('sec-settings', ['pumps', 'settings'].some(canView));
  show('sec-reports',  canView('export'));
  show('chips',        canView('dashboard'));

  show('loginBtn', !admin);
  show('userBox',  admin);
  const em = document.getElementById('userEmail');
  if (em) em.textContent = state.user?.email || '';

  // إن لم يبقَ أي قسم للزائر نخفي الشريط الجانبي
  show('sidebar', pages.some(canView));
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
// المستمعون — تتغير حسب الأدمن/الزائر
// ══════════════════════════════════════
let unsubReports = null, unsubPumps = null, listenKey = '';

function refreshCurrent() {
  updateStats();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'list')      renderList();
  if (currentPage === 'archived')  renderArchived();
  if (currentPage === 'settings')  renderSettings();
}

function syncListeners() {
  const key = isAdmin() ? 'admin' : (anyPublic() ? 'visitor' : 'none');
  if (key === listenKey) return;
  listenKey = key;

  unsubReports?.(); unsubPumps?.();
  unsubReports = unsubPumps = null;
  state.reports = []; state.pumps = [];

  if (key === 'admin') {
    unsubPumps   = initPumps(() => { renderPumps(); populateCitySelects(); });
    unsubReports = initReports(refreshCurrent, true);
  } else if (key === 'visitor') {
    unsubReports = initReports(refreshCurrent, false);
  }
  refreshCurrent();
}

function onStateChange() {
  if (!state.authReady || !state.settingsLoaded) return;
  ensureDefaultSettings();
  applyAccess();
  syncListeners();

  if (!started) {
    started = true;
    const first = firstAllowed();
    first ? navTo(first) : showNoAccess();
  } else {
    ensurePage();
    if (currentPage === 'settings') renderSettings();
  }
}

// ══════════════════════════════════════
// GLOBAL APP — كل الدوال تحت APP
// ══════════════════════════════════════
window.APP = {
  navTo, goFilter,
  // auth / theme / settings
  openLogin, closeLogin, doLogin, doLogout, toggleTheme, setSetting,
  // pumps
  addPump, deletePump, renderPumps,
  pumpSearch, pumpPick, pumpKey, pumpBlur,
  // reports
  saveReport, clearNewForm,
  openEdit, closeEdit, saveEdit, deleteReport, viewReport, closeView,
  addFaultToForm, delFormFault, editFormFault, checkFormFault,
  addWorkToForm,  delFormWork,  editFormWork,  checkFormWork, rejectFormWork,
  addFaultToEdit, delEditFault, editEditFault, checkEditFault,
  addWorkToEdit,  delEditWork,  editEditWork,  checkEditWork, rejectEditWork,
  archiveReport, unarchiveReport, toggleHidden,
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
    onStateChange();
  });
}

init();
