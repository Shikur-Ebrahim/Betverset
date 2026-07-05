import 'dotenv/config';

// Test parsing the FIREBASE_SERVICE_ACCOUNT_KEY the same way firebase-admin.ts does
const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
console.log('FIREBASE_SERVICE_ACCOUNT_KEY present:', !!jsonEnv);
console.log('First 50 chars:', jsonEnv?.slice(0, 50));
console.log('Last 10 chars:', jsonEnv?.slice(-10));

if (jsonEnv) {
  try {
    function stripQuotes(val: string): string {
      return val.trim().replace(/^['\"]+|['\"]+$/g, '');
    }
    let cleanJson = stripQuotes(jsonEnv);
    cleanJson = cleanJson.replace(/\n/g, '\\n');
    cleanJson = cleanJson.replace(/\\\\n/g, '\\n');
    const sa = JSON.parse(cleanJson);
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    console.log('Parsed OK! project_id:', sa.project_id, 'client_email:', sa.client_email);
    console.log('private_key starts with:', sa.private_key?.slice(0, 30));
  } catch (e) {
    console.error('PARSE ERROR:', e);
    // Try raw parse
    try {
      const sa2 = JSON.parse(jsonEnv);
      console.log('Raw parse worked! project_id:', sa2.project_id);
    } catch (e2) {
      console.error('Raw parse also failed:', e2);
    }
  }
}
