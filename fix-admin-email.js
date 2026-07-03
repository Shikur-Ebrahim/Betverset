const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./betverset.json', 'utf8'));
if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

async function main() {
  // Fix admin email: betverset.bet -> betvers.bet
  const adminUid = 'KofmyzaA1RRgEm0A6Bc85kXRL5f1';
  const newEmail = '251900000000@betvers.bet';

  await auth.updateUser(adminUid, { email: newEmail });
  console.log(`✅ Updated admin email to: ${newEmail}`);

  // Verify
  const user = await auth.getUser(adminUid);
  console.log('Verified:', { uid: user.uid, email: user.email });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
