import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBOEgd1WCElKtngAcQ-ygnx0_2lpHLUAyM",
    authDomain: "caatingasoftware.firebaseapp.com",
    projectId: "caatingasoftware",
    storageBucket: "caatingasoftware.firebasestorage.app",
    messagingSenderId: "357801806903",
    appId: "1:357801806903:web:7b03d8f9f0189bf32943b2"
};

// PROTEÇÃO: Verifica se o app já foi inicializado para evitar travamentos de "App already exists"
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);