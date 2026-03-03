// ═══════════════════════════════════════
// firebase.js — إعدادات Firebase
// ═══════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxFG8UKkkrzAS46Mg4umwmrR-8wqn2H0I",
  authDomain: "pump-5d429.firebaseapp.com",
  projectId: "pump-5d429",
  storageBucket: "pump-5d429.firebasestorage.app",
  messagingSenderId: "138167383302",
  appId: "1:138167383302:web:6d7f94f20c160dfbea1a87"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─── Helpers ───
export const Col   = (name)     => collection(db, name);
export const Doc   = (col, id)  => doc(db, col, id);
export const Add   = addDoc;
export const Update = updateDoc;
export const Delete = deleteDoc;
export const Listen = (ref, cb) => onSnapshot(ref, cb);
export const Q      = query;
export const OBy    = orderBy;
