import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set } from "firebase/database";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function setRep() {
  const seedUids = ['marcelo_dev', 'designkara', 'freelance_mike'];
  for (const uid of seedUids) {
    await set(ref(db, `users/${uid}/reputation`), 1800);
    console.log(`Set reputation for ${uid} to 1800`);
  }
  process.exit(0);
}

setRep().catch(err => {
  console.error(err);
  process.exit(1);
});
