// ═══════════════════════════════════════
// app.js — نقطة البداية، الراوتر، APP العام
// ═══════════════════════════════════════

import { initPumps, renderPumps, addPump, deletePump, loadPumpsForCity, populateCitySelects } from './pumps.js';
import { initReports, saveReport, clearNewForm, openEdit, closeEdit, saveEdit, deleteReport, addFaultToForm, delFormFault, editFormFault, addWorkToForm, delFormWork, editFormWork, addFaultToEdit, delEditFault, editEditFault, addWorkToEdit, delEditWork, editEditWork, initNewForm } from './reports.js';
import { updateStats, renderDashboard, renderList } from './ui.js';
import { doExport, previewExport } from './export.js';
import { toast, toggleCI, todayISO } from './utils.js';
import { state } from './state.js';

// ─── صفحات المشروع ───
const PAGES = {
  dashboard:  'pages/dashboard.html',
  new:        'pages/new-report.html',
  list:       'pages/list.html',
  pumps:      'pages/pumps.html',
  export:     'pages/export.html',
};

let currentPage = 'dashboard';

// ══════════════════════════════════════
// ROUTER — تحميل الصفحة
// ══════════════════════════════════════
async function loadPage(name) {
  const url = PAGES[name];
  if (!url) return;

  const res  = await fetch(url);
  const html = await res.text();
  document.getElementById('mainContent').innerHTML = html;

  // بعد تحميل الصفحة
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
  } else if (name === 'pumps') {
    renderPumps();
  }
}

// ══════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════
function navTo(name) {
  currentPage = name;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + name);
  if (navEl) navEl.classList.add('active');

  loadPage(name);
}

function goFilter(f) {
  state.pendingFilter = f;
  navTo('list');
}

// ══════════════════════════════════════
// GLOBAL APP — كل الدوال تحت APP
// ══════════════════════════════════════
window.APP = {
  navTo, goFilter,
  // pumps
  addPump, deletePump, renderPumps,
  loadPumpsForCity,
  // reports
  saveReport, clearNewForm,
  openEdit, closeEdit, saveEdit, deleteReport,
  addFaultToForm, delFormFault, editFormFault,
  addWorkToForm,  delFormWork,  editFormWork,
  addFaultToEdit, delEditFault, editEditFault,
  addWorkToEdit,  delEditWork,  editEditWork,
  // ui
  updateStats, renderDashboard, renderList,
  // export
  doExport, previewExport,
  // utils
  toggleCI,
};

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
async function init() {
  // التاريخ في الهيدر
  document.getElementById('topDate').textContent =
    new Date().toLocaleDateString('ar-SA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

  // تشغيل المستمعين
  initPumps(() => {
    renderPumps();
    // تحديث قوائم البلديات في الصفحة الحالية
    populateCitySelects();
  });

  initReports(() => {
    updateStats();
    if (currentPage === 'dashboard') renderDashboard();
    if (currentPage === 'list')      renderList();
  });

  // تحميل الصفحة الأولى
  await loadPage('dashboard');
}

init();
