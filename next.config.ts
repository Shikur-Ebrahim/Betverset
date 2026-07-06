import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'firebase-admin',
    'jose',
    'jwks-rsa'
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.api-sports.io' },
      { protocol: 'https', hostname: 'media-4.api-sports.io' },
      { protocol: 'https', hostname: 'media-3.api-sports.io' },
      { protocol: 'https', hostname: 'media-2.api-sports.io' },
      { protocol: 'https', hostname: 'media-1.api-sports.io' },
      { protocol: 'https', hostname: 'flagcdn.com' },
      { protocol: 'https', hostname: '*.api-sports.io' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // Cache images at CDN for 24 hours
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  async headers() {
    return [
      // ─── Public fixture/league data: cached at Vercel CDN edge ───
      {
        source: '/api/fixtures/home',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=120' }],
      },
      {
        source: '/api/fixtures/bootstrap',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=120, stale-while-revalidate=300' }],
      },
      {
        source: '/api/fixtures/meta',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=180' }],
      },
      {
        source: '/api/fixtures/meta/summary',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=120' }],
      },
      {
        source: '/api/fixtures/:fixtureId',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=30, stale-while-revalidate=60' }],
      },
      {
        source: '/api/fixtures',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=60, stale-while-revalidate=120' }],
      },
      // ─── Live fixtures: short TTL, revalidated frequently ───
      {
        source: '/api/fixtures/live',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=15, stale-while-revalidate=30' }],
      },
      {
        source: '/api/live/matches',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=15, stale-while-revalidate=30' }],
      },
      // ─── Odds: cached at CDN, purged after sync ───
      {
        source: '/api/odds/fixture/:fixtureId',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=30, stale-while-revalidate=60' }],
      },
      {
        source: '/api/odds/bulk',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=30, stale-while-revalidate=60' }],
      },
      // ─── Leagues & teams: rarely change, long cache ───
      {
        source: '/api/leagues',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=7200' }],
      },
      {
        source: '/api/leagues/top',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=7200' }],
      },
      {
        source: '/api/leagues/:id',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=7200' }],
      },
      {
        source: '/api/teams/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=7200' }],
      },
      // ─── Private/user APIs: never cache at CDN ───
      {
        source: '/api/betting/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache' }],
      },
      {
        source: '/api/user/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache' }],
      },
      {
        source: '/api/admin/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache' }],
      },
      {
        source: '/api/auth/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, no-cache' }],
      },
      // ─── Security headers for all pages ───
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async rewrites() {
    return [];
  },
  // Compress all responses
  compress: true,
  // Power Vercel's data cache for pages
  experimental: {
    ppr: false, // keep off for stability
  },
};

export default nextConfig;
