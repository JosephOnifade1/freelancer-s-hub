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

async function randomize() {
  console.log("Randomizing post timestamps...");
  const postsRef = ref(db, 'posts');
  const snapshot = await get(postsRef);
  
  if (!snapshot.exists()) {
    console.log("No posts found.");
    process.exit(0);
  }

  const now = Date.now();
  const twoHours = 2 * 60 * 60 * 1000;
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  const posts = snapshot.val();
  for (const id of Object.keys(posts)) {
    // Range between now - 2h and now - 3d
    const randomOffset = Math.floor(Math.random() * (threeDays - twoHours)) + twoHours;
    const newTimestamp = now - randomOffset;
    
    await set(ref(db, `posts/${id}/createdAt`), newTimestamp);
    console.log(`Updated post ${id} to ${new Date(newTimestamp).toLocaleString()}`);
  }

  console.log("Randomization complete!");
  process.exit(0);
}

randomize().catch(err => {
  console.error(err);
  process.exit(1);
});
