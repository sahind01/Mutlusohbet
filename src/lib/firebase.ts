// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, set, get, update, remove, onValue, push } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD4GZiQKkqyu6fnJDAwlFb4Siy5_FnzuxE",
  authDomain: "sahink-5e99d.firebaseapp.com",
  databaseURL: "https://sahink-5e99d-default-rtdb.firebaseio.com",
  projectId: "sahink-5e99d",
  storageBucket: "sahink-5e99d.firebasestorage.app",
  messagingSenderId: "983830185039",
  appId: "1:983830185039:web:02790369dedfb5d901163a",
  measurementId: "G-FEX7NBQG0R"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

export { app, auth, db, storage, ref, set, get, update, remove, onValue, push };
export default app;
