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

const uids = ["EW8K1vHFBWZHIUX7Hbqrp3hH2393", "V5V8T5AhSIOyHLQL9Jv2nw2UBh02"];

async function setVeteran() {
  for (const uid of uids) {
    await update(ref(db, `users/${uid}`), { 
      reputation: 5500,
      isVerifiedPro: true 
    });
    console.log(`Set ${uid} to Veteran status (5500 rep)`);
  }
  process.exit(0);
}

setVeteran().catch(err => {
  console.error(err);
  process.exit(1);
});
