const fs = require('fs');

const sa = JSON.parse(fs.readFileSync('./betverset.json', 'utf8'));

console.log('\n=== VERCEL ENVIRONMENT VARIABLES ===\n');
console.log('Copy each of these into your Vercel project settings under Settings > Environment Variables:\n');

console.log('--- Option A: Single variable (Recommended) ---');
console.log('Variable name: FIREBASE_SERVICE_ACCOUNT_KEY');
console.log('Value (paste the entire line below):');
console.log(JSON.stringify(sa));

console.log('\n\n--- Option B: Individual variables ---');
console.log('FIREBASE_PROJECT_ID =', sa.project_id);
console.log('FIREBASE_CLIENT_EMAIL =', sa.client_email);
console.log('FIREBASE_PRIVATE_KEY = (the private key - copy from betverset.json)');
