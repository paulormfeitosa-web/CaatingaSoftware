import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = { 
    apiKey: "AIzaSyBOEgd1WCElKtngAcQ-ygnx0_2lpHLUAyM", 
    authDomain: "caatingasoftware.firebaseapp.com", 
    projectId: "caatingasoftware", 
    storageBucket: "caatingasoftware.firebasestorage.app", 
    messagingSenderId: "357801806903", 
    appId: "1:357801806903:web:7b03d8f9f0189bf32943b2", 
    measurementId: "G-ZVSVPMDHP0" 
};

// 1. Inicializa os serviços do Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 2. EXPORTA para que os outros arquivos (auth.js, dados.js) possam usar o 'import { db, auth }'
export { app, db, auth };

// 3. Mantém o espelho na 'window' para que as funções de clique no HTML consigam enxergá-los
window.app = app;
window.db = db;
window.auth = auth;

// Variáveis de sessão globais
window.USUARIO = null;
window.tenant = "";
window.listenerUsuario = null;