import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, update, set, remove } from "firebase/database";
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
  console.log("Cleaning up old seed nodes...");
  await remove(ref(db, 'users/marcelo_dev'));
  await remove(ref(db, 'users/designkara'));
  await remove(ref(db, 'users/freelance_mike'));

  console.log("Bootstrapping users with real Auth UIDs...");

  const users = {
    "2GsYwXpvjhcSQ0Womc7gwdeNDKT2": {
      uid: "2GsYwXpvjhcSQ0Womc7gwdeNDKT2",
      username: "marcelo_dev",
      displayName: "Marcelo",
      initial: "M",
      bio: "Full-stack engineer specializing in high-performance web apps.",
      reputation: 2500,
      joined: "2024",
      status: "Available",
      isVerifiedPro: true,
      createdAt: Date.now()
    },
    "MsmSFDzJZVUKItoUJ8yk3d9MLC13": {
      uid: "MsmSFDzJZVUKItoUJ8yk3d9MLC13",
      username: "designkara",
      displayName: "Kara",
      initial: "K",
      bio: "Brand strategist helping solo founders look like Fortune 500 companies.",
      reputation: 1800,
      joined: "2024",
      status: "Available",
      isVerifiedPro: true,
      createdAt: Date.now()
    },
    "tzYIrJFbd5NH6Mmd66A829b7akW2": {
      uid: "tzYIrJFbd5NH6Mmd66A829b7akW2",
      username: "freelance_mike",
      displayName: "Mike",
      initial: "M",
      bio: "Growth marketer focused on lead gen and client acquisition.",
      reputation: 1200,
      joined: "2024",
      status: "Available",
      isVerifiedPro: true,
      createdAt: Date.now()
    }
  };

  for (const [uid, profile] of Object.entries(users)) {
    await set(ref(db, `users/${uid}`), profile);
    await set(ref(db, `usernames/${profile.username}`), uid);
    console.log(`Updated user: ${profile.username} (${uid})`);
  }

  console.log("Mapping posts to new real UIDs...");
  const postsRef = ref(db, 'posts');
  const snapshot = await get(postsRef);
  
  if (snapshot.exists()) {
    const posts = snapshot.val();
    for (const [id, post] of Object.entries(posts)) {
      let newAuthor = { ...post.author };
      
      // Match by original spoofed name or old spoofed UID
      if (post.author.name === "Marcelo" || post.author.name === "marcelo_dev" || post.author.uid === "marcelo_dev") {
        newAuthor = { uid: "2GsYwXpvjhcSQ0Womc7gwdeNDKT2", name: "marcelo_dev", reputation: 2500 };
      } else if (post.author.name === "Kara" || post.author.name === "designkara" || post.author.uid === "designkara") {
        newAuthor = { uid: "MsmSFDzJZVUKItoUJ8yk3d9MLC13", name: "designkara", reputation: 1800 };
      } else if (post.author.name === "Mike" || post.author.name === "freelance_mike" || post.author.uid === "freelance_mike") {
        newAuthor = { uid: "tzYIrJFbd5NH6Mmd66A829b7akW2", name: "freelance_mike", reputation: 1200 };
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
