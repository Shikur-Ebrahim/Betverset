import 'dotenv/config';
import { fetchAndStoreFixturesForWindow } from './lib/services/apiFootball';

// Call the function directly to see if it works
async function run() {
  console.log('Testing sync...');
  // We need to simulate the exact logic from the POST route
  const { POST } = require('./app/api/cron/sync/route');
  
  const req = new Request('http://localhost:3000/api/cron/sync', { method: 'POST' });
  const res = await POST(req);
  console.log('Status:', res.status);
  const json = await res.json();
  console.log('JSON:', json);
}

run().catch(console.error).finally(() => process.exit(0));
