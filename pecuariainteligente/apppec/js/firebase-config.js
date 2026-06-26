// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCAzpHWy7QYjXqyDEaWWUBrZo1xg9wn9YE",
  authDomain: "pecuaria-inteligente.firebaseapp.com",
  projectId: "pecuaria-inteligente",
  storageBucket: "pecuaria-inteligente.firebasestorage.app",
  messagingSenderId: "344714304677",
  appId: "1:344714304677:web:809f71062dfeba0adc414c",
  measurementId: "G-73Q13G8XPT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);