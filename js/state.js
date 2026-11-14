// ═══════════════════════════════════════
// state.js — الحالة المشتركة + الأدوار والصلاحيات
// ═══════════════════════════════════════
//
// الأدوار:
//   • المالك  : uid موجود في settings/admin.adminUids → كل شي
//   • المستخدم: له ملف في users/{uid} فيه perms لكل قسم (hidden | view | edit)
//   • الزائر  : بدون تسجيل دخول → حسب إعدادات الظهور (settings/app)
//
// نطاق القسم (Section Scope):
//   عند فتح صفحة تابعة لقسم يُضبط state.scope على هذا القسم،
//   فتصير isAdmin() = "يقدر يعدّل هذا القسم". خارج الأقسام (الإعدادات،
//   المستخدمين، السجل) تظل isAdmin() = المالك فقط.

export const state = {
  reports: [],
  pumps:   [],
  users:   [],             // للمالك فقط
  pendingFilter: null,

  // المصادقة والإعدادات
  user: null,              // مستخدم Firebase Auth (null = زائر)
  authReady: false,
  settingsLoaded: false,
  settingsExists: false,
  settings: { publicList: false, publicDashboard: false, publicExport: false },

  adminCfg: { adminUids: [], ownerName: '' },   // settings/admin
  adminLoaded: false,
  profile: null,           // users/{uid}
  profileLoaded: false,
  auditEnabled: true,      // settings/audit.enabled

  scope: null,             // القسم الحالي
};

// ─── الأقسام ───
export const SECTIONS = [
  { key: 'dashboard', label: 'لوحة التحكم',    icon: '📊', desc: 'الإحصائيات وبلاغات المتابعة' },
  { key: 'reports',   label: 'البلاغات',       icon: '📋', desc: 'بلاغ جديد، قائمة البلاغات، الأرشيف' },
  { key: 'pumps',     label: 'إدارة المضخات',  icon: '🔧', desc: 'أرقام المضخات وبلدياتها' },
  { key: 'export',    label: 'تصدير Excel',    icon: '📥', desc: 'التعديل هنا = يشمل البلاغات المخفية' },
];
export const SECTION_LABEL = Object.fromEntries(SECTIONS.map(s => [s.key, s.label]));

// الصفحة → القسم (الصفحات غير الموجودة هنا للمالك فقط)
export const PAGE_SECTION = {
  dashboard: 'dashboard',
  new: 'reports', list: 'reports', archived: 'reports',
  pumps: 'pumps',
  export: 'export',
};

export const PERM_LABEL = { hidden: 'مخفي', view: 'مشاهدة', edit: 'تعديل' };

// ─── الأدوار ───
export const isOwner  = () => !!state.user && (state.adminCfg.adminUids || []).includes(state.user.uid);
export const isMember = () => !!state.user && !isOwner() && !!state.profile && state.profile.disabled !== true;
export const isLoggedIn = () => isOwner() || isMember();

export function perm(sec) {
  if (isOwner())  return 'edit';
  if (isMember()) return state.profile.perms?.[sec] || 'hidden';
  return 'hidden';
}
export const canEdit = sec => perm(sec) === 'edit';

// داخل قسم: يقدر يعدّل القسم — خارج الأقسام: المالك فقط
export function isAdmin() {
  return state.scope ? canEdit(state.scope) : isOwner();
}
export function setScope(sec) { state.scope = sec || null; }

// اسم المستخدم الحالي (أعلى الصفحة وفي السجل)
export function displayName() {
  if (!state.user) return '';
  if (isOwner()) return state.adminCfg.ownerName || state.user.email || 'المالك';
  return state.profile?.name || state.user.email || '';
}

// البلاغات المسموح عرضها في القسم الحالي (المشاهدة = مثل الزائر: بدون المخفية)
export const visibleReports = () => isAdmin() ? state.reports : state.reports.filter(r => !r.hidden);

// هل يحتاج المستخدم كل البلاغات (بما فيها المخفية)؟
export const needsAllReports = () => isOwner() || canEdit('dashboard') || canEdit('reports') || canEdit('export');
// هل يحتاج قائمة المضخات؟
export const needsPumps = () => isOwner() ||
  (isMember() && (perm('pumps') !== 'hidden' || canEdit('reports') || canEdit('dashboard')));

// ─── الصفحات المتاحة ───
// أقسام الزائر (بدون تسجيل دخول) يتحكم بها المالك من صفحة الإعدادات
export const VISITOR_PAGES = ['dashboard', 'list', 'export'];
export const MEMBER_PAGES  = ['dashboard', 'list', 'new', 'archived', 'pumps', 'export'];

export function canView(page) {
  if (isOwner()) return true;
  if (state.user) {                       // مستخدم مسجّل
    if (!isMember()) return false;
    const sec = PAGE_SECTION[page];
    if (!sec) return false;               // الإعدادات / المستخدمين / السجل
    const p = perm(sec);
    if (page === 'new') return p === 'edit';
    return p !== 'hidden';
  }
  return canViewAsVisitor(page);
}

export const anyPublic = () => VISITOR_PAGES.some(canViewAsVisitor);
function canViewAsVisitor(page) {
  const s = state.settings;
  if (page === 'dashboard') return !!s.publicDashboard;
  if (page === 'list')      return !!s.publicList;
  if (page === 'export')    return !!s.publicExport;
  return false;
}
