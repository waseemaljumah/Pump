// ═══════════════════════════════════════
// settings.js — إعدادات ظهور الأقسام للزوار
// المستند: settings/app  (قراءة للجميع، كتابة للأدمن)
// ═══════════════════════════════════════

import { Doc, Listen, Set } from './firebase.js';
import { state, isAdmin } from './state.js';
import { toast } from './utils.js';

const DEFAULTS = { publicList: true, publicDashboard: true, publicExport: false };

export function initSettings(onUpdate) {
  return Listen(Doc('settings', 'app'), snap => {
    state.settingsExists = snap.exists();
    state.settings = {
      publicList: false, publicDashboard: false, publicExport: false,
      ...(snap.exists() ? snap.data() : {})
    };
    state.settingsLoaded = true;
    ensureDefaultSettings();
    onUpdate();
  }, err => {
    console.warn('settings listener:', err);
    state.settingsLoaded = true;
    onUpdate();
  });
}

// أول دخول للأدمن: ينشئ الإعدادات الافتراضية (القائمة + لوحة التحكم ظاهرتان، التصدير مخفي)
export function ensureDefaultSettings() {
  if (!isAdmin() || !state.settingsLoaded || state.settingsExists) return;
  state.settingsExists = true;
  Set(Doc('settings', 'app'), { ...DEFAULTS, updatedAt: Date.now() })
    .catch(e => console.warn('settings init:', e));
}

export async function setSetting(key, val) {
  try {
    await Set(Doc('settings', 'app'), { [key]: !!val, updatedAt: Date.now() }, { merge: true });
    toast('✅ تم حفظ الإعداد', 'ok');
  } catch (e) {
    console.error(e);
    toast('تعذّر الحفظ — تحقق من قواعد Firestore', 'err');
    renderSettings();
  }
}

export function renderSettings() {
  ['publicList', 'publicDashboard', 'publicExport'].forEach(k => {
    const el = document.getElementById('st_' + k);
    if (el) el.checked = !!state.settings[k];
  });
  const hidden = state.reports.filter(r => r.hidden === true && !r.archived).length;
  const el = document.getElementById('st_hiddenCount');
  if (el) el.textContent = hidden;
}
