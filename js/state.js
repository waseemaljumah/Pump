// ═══════════════════════════════════════
// state.js — الحالة المشتركة + الصلاحيات
// ═══════════════════════════════════════

export const state = {
  reports: [],
  pumps:   [],
  pendingFilter: null,

  // المصادقة والإعدادات
  user: null,              // المستخدم الأدمن (null = زائر)
  authReady: false,
  settingsLoaded: false,
  settingsExists: false,
  settings: { publicList: false, publicDashboard: false, publicExport: false },
};

export const isAdmin = () => !!state.user;

// أقسام الزائر (بدون تسجيل دخول) يتحكم بها الأدمن من صفحة الإعدادات
export const VISITOR_PAGES = ['dashboard', 'list', 'export'];

export function canView(page) {
  if (isAdmin()) return true;
  const s = state.settings;
  if (page === 'dashboard') return !!s.publicDashboard;
  if (page === 'list')      return !!s.publicList;
  if (page === 'export')    return !!s.publicExport;
  return false; // new / archived / pumps / settings → أدمن فقط
}

export const anyPublic = () => VISITOR_PAGES.some(canViewAsVisitor);
function canViewAsVisitor(page) {
  const s = state.settings;
  return page === 'dashboard' ? !!s.publicDashboard
       : page === 'list'      ? !!s.publicList
       : !!s.publicExport;
}
