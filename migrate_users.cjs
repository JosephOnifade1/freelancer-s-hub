const https = require('https');

const DB_URL = 'https://soloboard-freelancers-hub-default-rtdb.firebaseio.com';

const request = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(`${DB_URL}${path}`, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          if (body) {
             resolve(JSON.parse(body));
          } else {
             resolve(null);
          }
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

async function migrate() {
  console.log("Fetching users...");
  const users = await request('GET', '/users.json');
  if (!users) {
    console.log("No users found.");
    return;
  }

  const existingUsernames = await request('GET', '/usernames.json') || {};

  for (const uid of Object.keys(users)) {
    const user = users[uid];
    const oldUsername = user.username;
    
    // Check if the username is invalid
    const isValidFormat = /^[a-z0-9_]{3,15}$/.test(oldUsername);
    
    if (!isValidFormat) {
      console.log(`Migrating user UID: ${uid} (Old username: "${oldUsername}")`);
      
      // Keep the old username as the display name if it doesn't have one
      const displayName = user.displayName || oldUsername;
      
      // Generate a new handle
      let baseHandle = oldUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 15);
      
      // Ensure it's at least 3 chars
      if (baseHandle.length < 3) {
        baseHandle = baseHandle.padEnd(3, '0');
      }
      
      let newHandle = baseHandle;
      let counter = 1;
      
      // Check for uniqueness in the currently known usernames
      while (existingUsernames[newHandle]) {
        const suffix = String(counter);
        newHandle = baseHandle.substring(0, 15 - suffix.length) + suffix;
        counter++;
      }
      
      console.log(`  -> New Handle: @${newHandle}`);
      console.log(`  -> Display Name: ${displayName}`);
      
      // 1. Claim in registry
      await request('PUT', `/usernames/${newHandle}.json`, uid);
      existingUsernames[newHandle] = uid; // update local cache
      
      // 2. Update user document
      await request('PATCH', `/users/${uid}.json`, {
        username: newHandle,
        displayName: displayName
      });
      
      console.log(`  -> Successfully migrated.`);
    } else {
      console.log(`User UID: ${uid} (Username: "${oldUsername}") is already valid.`);
      // Just ensure they are in the registry if missing
      if (!existingUsernames[oldUsername]) {
        console.log(`  -> Adding to registry...`);
        await request('PUT', `/usernames/${oldUsername}.json`, uid);
        existingUsernames[oldUsername] = uid;
      }
    }
  }
  
  console.log("Migration complete.");
}

migrate().catch(console.error);
