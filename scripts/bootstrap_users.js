import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, update, set } from "firebase/database";
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

async function bootstrap() {
  console.log("Bootstrapping users...");

  const users = {
    "marcelo_dev": {
      uid: "marcelo_dev",
      username: "marcelo_dev",
      displayName: "Marcelo",
      initial: "M",
      bio: "Full-stack engineer specializing in high-performance web apps.",
      reputation: 2500,
      joined: "2024",
      status: "Available",
      createdAt: Date.now()
    },
    "designkara": {
      uid: "designkara",
      username: "designkara",
      displayName: "Kara",
      initial: "K",
      bio: "Brand strategist helping solo founders look like Fortune 500 companies.",
      reputation: 1800,
      joined: "2024",
      status: "Available",
      createdAt: Date.now()
    },
    "freelance_mike": {
      uid: "freelance_mike",
      username: "freelance_mike",
      displayName: "Mike",
      initial: "M",
      bio: "Growth marketer focused on lead gen and client acquisition.",
      reputation: 1200,
      joined: "2024",
      status: "Available",
      createdAt: Date.now()
    }
  };

  for (const [uid, profile] of Object.entries(users)) {
    await set(ref(db, `users/${uid}`), profile);
    await set(ref(db, `usernames/${profile.username}`), uid);
    console.log(`Updated user: ${profile.username}`);
  }

  console.log("Mapping posts to users...");
  const postsRef = ref(db, 'posts');
  const snapshot = await get(postsRef);
  
  if (snapshot.exists()) {
    const posts = snapshot.val();
    for (const [id, post] of Object.entries(posts)) {
      let newAuthor = { ...post.author };
      
      if (post.author.name === "Marcelo") {
        newAuthor = { uid: "marcelo_dev", name: "marcelo_dev", reputation: 2500 };
      } else if (post.author.name === "Kara") {
        newAuthor = { uid: "designkara", name: "designkara", reputation: 1800 };
      } else if (post.author.name === "Mike") {
        newAuthor = { uid: "freelance_mike", name: "freelance_mike", reputation: 1200 };
      }
      
      await update(ref(db, `posts/${id}/author`), newAuthor);
    }
  }

  console.log("Bootstrap complete!");
  process.exit(0);
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
