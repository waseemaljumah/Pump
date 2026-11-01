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
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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

// ─── Auth helpers ───
export const onAuth      = (cb)        => onAuthStateChanged(auth, cb);
export const signIn      = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const signOutUser = ()          => signOut(auth);
