// ═══════════════════════════════════════
// theme.js — الوضع الليلي / العادي
// ═══════════════════════════════════════

const KEY = 'pump-theme';

function stored() { try { return localStorage.getItem(KEY); } catch { return null; } }

export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const b = document.getElementById('themeBtn');
  if (b) {
    b.textContent = t === 'dark' ? '☀️ عادي' : '🌙 ليلي';
    b.title = t === 'dark' ? 'التبديل إلى الوضع العادي' : 'التبديل إلى الوضع الليلي';
  }
}

export function initTheme() { applyTheme(stored() === 'dark' ? 'dark' : 'light'); }

export function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(KEY, next); } catch {}
  applyTheme(next);
}
