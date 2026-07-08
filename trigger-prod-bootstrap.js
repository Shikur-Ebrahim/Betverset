require('dotenv').config({ path: '.env.local' });

const PROD_URL = (process.env.PROD_SITE_URL || 'https://www.betverset.com').replace(/\/+$/, '');

async function trigger() {
  const secret = process.env.CRON_SECRET || '';
  console.log(`Triggering bootstrap on ${PROD_URL}...`);
  try {
    const headers = { Accept: 'application/json' };
    if (secret) headers.Authorization = `Bearer ${secret}`;
    const res = await fetch(`${PROD_URL}/api/cron/bootstrap`, {
      method: 'POST',
      headers,
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
trigger();
