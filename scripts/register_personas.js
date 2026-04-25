import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
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
const auth = getAuth(app);

const personas = [
  { email: "marcelo@soloboard.com", password: "password123", name: "Marcelo" },
  { email: "kara@soloboard.com", password: "password123", name: "Kara" },
  { email: "mike@soloboard.com", password: "password123", name: "Mike" },
];

async function register() {
  console.log("Registering personas in Firebase Auth...");
  const results = [];

  for (const p of personas) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, p.email, p.password);
      console.log(`Registered ${p.name}: UID = ${userCredential.user.uid}`);
      results.push({ name: p.name, email: p.email, uid: userCredential.user.uid });
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`${p.name} (${p.email}) already exists.`);
        // Note: We can't get the UID easily without Admin SDK if they already exist, 
        // but we can try to sign in to get it.
      } else {
        console.error(`Error registering ${p.name}:`, error.message);
      }
    }
  }

  console.log("\n--- REGISTRATION SUMMARY ---");
  console.log(JSON.stringify(results, null, 2));
  console.log("----------------------------");
  process.exit(0);
}

register().catch(err => {
  console.error(err);
  process.exit(1);
});
