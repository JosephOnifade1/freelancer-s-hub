import { initializeApp } from "firebase/app";
import { getDatabase, ref, update } from "firebase/database";
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

async function verify() {
  const seedUids = ['marcelo_dev', 'designkara', 'freelance_mike'];
  for (const uid of seedUids) {
    await update(ref(db, `users/${uid}`), { isVerifiedPro: true });
    console.log(`Verified user: ${uid}`);
  }
  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
