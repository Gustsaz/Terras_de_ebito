// firebase.js - Firebase initialization and global exports for Terras de Ébito
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, addDoc, collection,
  query, where, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAUnPoW8hrWLtOq9PyTTfc5gIOnMdxzTA4",
  authDomain: "terrasdeebito-a4c02.firebaseapp.com",
  projectId: "terrasdeebito-a4c02",
  storageBucket: "terrasdeebito-a4c02.firebasestorage.app",
  messagingSenderId: "816117297722",
  appId: "1:816117297722:web:adf4f52b33ed1af90cfb03",
  measurementId: "G-DP41K48FV0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth();
const db = getFirestore(app);
const rtdb = getDatabase(app);

// Make functions global for use in non-module scripts
window.firebaseapp = app;
window.firebaseauth = auth;
window.firestoredb = db;
window.firebasertdb = rtdb;
window.GoogleAuthProvider = GoogleAuthProvider;
window.signInWithPopup = signInWithPopup;
window.onAuthStateChanged = onAuthStateChanged;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.updateDoc = updateDoc;
window.addDoc = addDoc;
window.collection = collection;
window.query = query;
window.where = where;
window.getDocs = getDocs;
window.firebaseOnSnapshot = onSnapshot;

console.log("Firebase initialized");
