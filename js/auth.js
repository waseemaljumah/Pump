// ═══════════════════════════════════════
// auth.js — تسجيل دخول / خروج الأدمن
// ═══════════════════════════════════════

import { signIn, signOutUser } from './firebase.js';
import { toast } from './utils.js';

const ERRORS = {
  'auth/invalid-credential':     'البريد أو كلمة المرور غير صحيحة',
  'auth/wrong-password':         'البريد أو كلمة المرور غير صحيحة',
  'auth/user-not-found':         'البريد أو كلمة المرور غير صحيحة',
  'auth/invalid-email':          'صيغة البريد الإلكتروني غير صحيحة',
  'auth/too-many-requests':      'محاولات كثيرة، حاول لاحقاً',
  'auth/network-request-failed': 'تعذّر الاتصال بالشبكة',
  'auth/operation-not-allowed':  'تسجيل الدخول بالبريد غير مفعّل في Firebase',
};

export function openLogin() {
  document.getElementById('l_err').textContent = '';
  document.getElementById('loginOverlay').classList.add('open');
  setTimeout(() => document.getElementById('l_email')?.focus(), 50);
}

export function closeLogin() {
  document.getElementById('loginOverlay').classList.remove('open');
  document.getElementById('l_pass').value = '';
}

export async function doLogin() {
  const email = document.getElementById('l_email').value.trim();
  const pass  = document.getElementById('l_pass').value;
  const err   = document.getElementById('l_err');
  const btn   = document.getElementById('l_btn');
  if (!email || !pass) { err.textContent = 'أدخل البريد وكلمة المرور'; return; }

  btn.disabled = true; err.textContent = '';
  try {
    await signIn(email, pass);
    closeLogin();
    toast('✅ تم تسجيل الدخول', 'ok');
  } catch (e) {
    err.textContent = ERRORS[e.code] || ('تعذّر تسجيل الدخول: ' + (e.code || e.message));
  } finally {
    btn.disabled = false;
  }
}

export async function doLogout() {
  await signOutUser();
  toast('تم تسجيل الخروج', 'warn');
}
