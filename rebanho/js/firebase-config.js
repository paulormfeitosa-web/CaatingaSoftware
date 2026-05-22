import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOEgd1WCElKtngAcQ-ygnx0_2lpHLUAyM",
  authDomain: "caatingasoftware.firebaseapp.com",
  projectId: "caatingasoftware",
  storageBucket: "caatingasoftware.firebasestorage.app",
  messagingSenderId: "357801806903",
  appId: "1:357801806903:web:7b03d8f9f0189bf32943b2"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Ativa persistência offline nativa
enableIndexedDbPersistence(db).catch((err) => { 
    console.warn("Offline desativado:", err.code); 
});