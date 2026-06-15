import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

// Inicializa o banco já com o cache offline ativado no padrão novo
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});

export const auth = getAuth(app);
export const storage = getStorage(app);