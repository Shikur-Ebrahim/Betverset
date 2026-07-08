import { unstable_cache } from 'next/cache';
import { fetchServerHomeBundle } from './server-home-data';

/** ISR: repeat page loads served from Next cache (~instant HTML with 100 matches). */
export const getCachedHomeBundle = unstable_cache(
  async () => fetchServerHomeBundle(),
  ['betvers-home-bundle-v9'],
  { revalidate: 60 }
);
