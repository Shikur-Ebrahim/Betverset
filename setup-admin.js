const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const sa = JSON.parse(fs.readFileSync('betverset.json', 'utf8'));

initializeApp({
  credential: cert(sa)
});

const auth = getAuth();
const db = getFirestore();

const adminPhone = '+251900000000';
const adminEmail = '251900000000@betverset.bet';
const adminPassword = 'adminpassword123';

async function setupAdmin() {
  let uid;
  try {
    const user = await auth.getUserByEmail(adminEmail);
    uid = user.uid;
    console.log('Admin user already exists in Auth, updating password...');
    await auth.updateUser(uid, { password: adminPassword });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.log('Creating new admin user in Auth...');
      const user = await auth.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: adminPhone,
      });
      uid = user.uid;
    } else {
      throw err;
    }
  }

  console.log('Setting role to admin in Firestore...');
  await db.collection('users').doc(uid).set({
    phone: adminPhone,
    role: 'admin',
    balance: 1000,
    createdAt: new Date().toISOString(),
  }, { merge: true });

  console.log('=============================================');
  console.log('Admin Account Created Successfully!');
  console.log(`Login Phone: ${adminPhone}`);
  console.log(`Password: ${adminPassword}`);
  console.log('=============================================');
}

setupAdmin().catch(console.error);
