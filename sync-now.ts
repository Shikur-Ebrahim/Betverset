import { fetchAndStoreFixturesForWindow } from './lib/services/apiFootball';

async function main() {
  console.log('Starting sync...');
  try {
    const res = await fetchAndStoreFixturesForWindow();
    console.log('Sync complete:', res);
  } catch (err) {
    console.error('Sync failed:', err);
  }
  process.exit(0);
}

main();
