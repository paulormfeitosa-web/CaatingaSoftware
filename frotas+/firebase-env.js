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

window.app = initializeApp(firebaseConfig);
window.db = getFirestore(window.app);
window.auth = getAuth(window.app);

window.USUARIO = null;
window.tenant = "";
window.listenerUsuario = null;