// ═══════════════════════════════════════
// firebase.js — إعدادات Firebase (Firestore + Auth)
// ═══════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch,
  getDoc,
  getDocFromCache,
  getDocs,
  getCountFromServer,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxFG8UKkkrzAS46Mg4umwmrR-8wqn2H0I",
  authDomain: "pump-5d429.firebaseapp.com",
  projectId: "pump-5d429",
  storageBucket: "pump-5d429.firebasestorage.app",
  messagingSenderId: "138167383302",
  appId: "1:138167383302:web:6d7f94f20c160dfbea1a87"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ─── Firestore helpers ───
export const Col    = (name)     => collection(db, name);
export const Doc    = (col, id)  => doc(db, col, id);
export const Add    = addDoc;
export const Set    = setDoc;
export const Update = updateDoc;
export const Delete = deleteDoc;
export const Listen = (ref, cb, errCb) => onSnapshot(ref, cb, errCb);
export const Q      = query;
export const OBy    = orderBy;
export const Where  = where;
export const Batch  = () => writeBatch(db);
export const Get    = getDoc;
export const GetCached = getDocFromCache;
export const GetAll = getDocs;
export const Count  = getCountFromServer;
export const Limit  = limit;
export const After  = startAfter;

// ─── Auth helpers ───
export const onAuth      = (cb)        => onAuthStateChanged(auth, cb);
export const signIn      = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const signOutUser = ()          => signOut(auth);
export const resetPassword = (email)  => sendPasswordResetEmail(auth, email);

// ─── App ثاني منفصل لإنشاء حسابات المستخدمين ───
// لو أنشأنا الحساب بالـ App الأساسي، Firebase يسجّل دخول المستخدم الجديد
// ويطلّع المالك من حسابه. الـ App الثاني له جلسة مستقلة في الذاكرة فقط.
let secondaryAuth = null;
function getSecondaryAuth() {
  if (!secondaryAuth) {
    const app2 = initializeApp(firebaseConfig, 'user-creator');
    secondaryAuth = initializeAuth(app2, { persistence: inMemoryPersistence });
  }
  return secondaryAuth;
}

// ينشئ الحساب ويرجّع uid (بدون التأثير على جلسة المالك)
export async function createAccount(email, pw) {
  const a = getSecondaryAuth();
  try {
    const cred = await createUserWithEmailAndPassword(a, email, pw);
    return cred.user.uid;
  } finally {
    await signOut(a).catch(() => {});
  }
}

// لحساب موجود مسبقاً في Authentication: نتحقق من كلمة المرور ونرجّع uid
export async function accountUid(email, pw) {
  const a = getSecondaryAuth();
  try {
    const cred = await signInWithEmailAndPassword(a, email, pw);
    return cred.user.uid;
  } finally {
    await signOut(a).catch(() => {});
  }
}
