import { getPublicApiBaseUrl } from './public-api-url';

/**
 * All browser and server calls go to the Render Express API (`/api/*` on backend).
 * Vercel `/api/*` BFF routes are optional; production must not depend on them.
 */
export function resolveApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicApiBaseUrl()}${normalized}`;
}
