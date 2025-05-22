// firebase-setup.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAvIp8q3xxlWq7iQC99XgZGCUt2CQQeBDE",
  authDomain: "smart-shooter.firebaseapp.com",
  projectId: "smart-shooter",
  storageBucket: "smart-shooter.firebasestorage.app",
  messagingSenderId: "21050786577",
  appId: "1:21050786577:web:dfd514bb359e7e275042b0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

export { db, auth };
