/**
 * All API routes now live inside this Next.js app under `/api/*`.
 * No external backend URL is needed — we always use the same origin.
 *
 * On the server (API routes / cron), calls should use an absolute URL.
 * On the client (browser), relative `/api` is used.
 */
export function getPublicApiBaseUrl(): string {
  // In browser: use relative path (same origin)
  if (typeof window !== 'undefined') {
    return '/api';
  }

  // On server: use absolute URL built from VERCEL_URL or localhost
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}/api`;
  }

  // Local dev
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}/api`;
}
