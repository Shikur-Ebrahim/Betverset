/**
 * Import match odds day-by-day on the deployed Vercel project.
 *
 * Usage:
 *   node scripts/import-match-days.js              # import today, then ask for next days
 *   node scripts/import-match-days.js --today-only # import today only
 *   node scripts/import-match-days.js --all        # import all 7 days without prompts
 *
 * Env (.env.local):
 *   PROD_SITE_URL=https://betverset.com
 *   CRON_SECRET=...   (optional — required if set on Vercel)
 */
require('dotenv').config({ path: '.env.local' });
const readline = require('readline');

const PROD_URL = (process.env.PROD_SITE_URL || 'https://www.betverset.com').replace(/\/+$/, '');
const CRON_SECRET = process.env.CRON_SECRET || '';
const MAX_DAYS = 7;
const MATCHES_PER_DAY = 50;

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer || '').trim().toLowerCase());
    });
  });
}

async function importDay(dateStr) {
  const url = `${PROD_URL}/api/admin/matches/import?date=${dateStr}`;
  console.log(`\n→ Importing ${dateStr} (max ${MATCHES_PER_DAY} matches with odds)...`);
  console.log(`  POST ${url}`);

  const headers = { Accept: 'application/json' };
  if (CRON_SECRET) headers.Authorization = `Bearer ${CRON_SECRET}`;

  const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    console.error(`  ✗ HTTP ${res.status}`);
    if (data?.error) console.error(`  ${data.error}`);
    if (data?.log) data.log.forEach((line) => console.error(`  ${line}`));
    return { ok: false, date: dateStr, imported: 0 };
  }

  if (Array.isArray(data.log)) {
    data.log.forEach((line) => console.log(`  ${line}`));
  }

  const imported = data.imported ?? 0;
  const oddsSaved = data.oddsSaved ?? 0;
  console.log(`  ✓ ${dateStr}: ${imported} fixtures, ${oddsSaved} odds saved`);
  return { ok: true, date: dateStr, imported, oddsSaved };
}

async function main() {
  const args = process.argv.slice(2);
  const todayOnly = args.includes('--today-only');
  const importAll = args.includes('--all');

  console.log('Betverset — manual match import (production)');
  console.log(`Site: ${PROD_URL}`);
  console.log(`Today: ${todayStr()}`);
  if (!CRON_SECRET) {
    console.log('Note: CRON_SECRET not in .env.local — calling without auth (OK if Vercel has no secret).');
  }

  const results = [];
  let dateStr = todayStr();

  const first = await importDay(dateStr);
  results.push(first);

  if (todayOnly) {
    console.log('\nDone (--today-only). Daily cron will keep the 7-day window updated automatically.');
    process.exit(first.ok ? 0 : 1);
  }

  if (importAll) {
    for (let i = 1; i < MAX_DAYS; i++) {
      dateStr = addDays(todayStr(), i);
      results.push(await importDay(dateStr));
    }
  } else {
    for (let i = 1; i < MAX_DAYS; i++) {
      const nextDate = addDays(todayStr(), i);
      const answer = await ask(`\nImport next day ${nextDate}? [y/N]: `);
      if (answer !== 'y' && answer !== 'yes') {
        console.log('Stopped. Remaining days will be filled by the daily cron at 3 AM UTC.');
        break;
      }
      results.push(await importDay(nextDate));
    }
  }

  const totalImported = results.reduce((n, r) => n + (r.imported || 0), 0);
  console.log(`\n=== Summary: ${totalImported} matches imported across ${results.length} day(s) ===`);
  console.log('After this one-time setup, /api/cron/bootstrap runs daily and keeps 7 days × 50 matches automatically.\n');
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
