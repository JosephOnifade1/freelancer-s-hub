const fs = require('fs');
const https = require('https');

https.get('https://soloboard-freelancers-hub-default-rtdb.firebaseio.com/users.json', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const users = JSON.parse(data);
      if (users === null) {
        console.log("No users found or permission denied.");
      } else if (users.error) {
        console.log("Error:", users.error);
      } else {
        Object.keys(users).forEach(uid => {
          const u = users[uid];
          console.log(`UID: ${uid}`);
          console.log(`  Username: ${u.username}`);
          console.log(`  Display Name: ${u.displayName}`);
          console.log(`  Email/Name used at signup: ${u.email || (u.displayName || u.username)}`);
          console.log('---');
        });
      }
    } catch (e) {
      console.log("Error parsing JSON:", e);
      console.log(data);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
