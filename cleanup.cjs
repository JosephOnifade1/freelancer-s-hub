const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, remove } = require('firebase/database');

// Replace with your actual project config if needed, or point to local emulator
const app = initializeApp({ databaseURL: 'https://soloboard-freelancers-hub-default-rtdb.firebaseio.com/' });
const db = getDatabase(app);

async function clean() {
  console.log("Starting cleanup...");
  let count = 0;
  
  // 1. Clean Posts
  const postsRef = ref(db, 'posts');
  const snap = await get(postsRef);
  
  if (snap.exists()) {
    const updates = [];
    snap.forEach(child => {
      const p = child.val();
      if (!p.author || !p.author.uid || p.author.name === 'Anonymous' || p.author.name === 'Unknown' || !p.author.name) {
        updates.push(remove(ref(db, 'posts/' + child.key)));
        count++;
      }
    });
    await Promise.all(updates);
    console.log(`Deleted ${count} anonymous posts.`);
  }
  
  // 2. Clean Comments
  const commentsRef = ref(db, 'post-comments');
  const cSnap = await get(commentsRef);
  let cCount = 0;
  
  if (cSnap.exists()) {
    const cUpdates = [];
    cSnap.forEach(postComments => {
      postComments.forEach(child => {
        const c = child.val();
        if (!c.authorUid || c.author === 'Anonymous' || c.author === 'Unknown' || !c.author) {
          cUpdates.push(remove(ref(db, 'post-comments/' + postComments.key + '/' + child.key)));
          cCount++;
        }
      });
    });
    await Promise.all(cUpdates);
    console.log(`Deleted ${cCount} anonymous comments.`);
  }
  
  console.log('Cleanup complete.');
  process.exit(0);
}

clean();
