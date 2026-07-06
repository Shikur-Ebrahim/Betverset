import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'firebase-admin',
    'jose',
    'jwks-rsa'
  ],
  images: {
    // Allow next/image to optimise external team logos and country flags
    remotePatterns: [
      { protocol: 'https', hostname: 'media.api-sports.io' },
      { protocol: 'https', hostname: 'media-4.api-sports.io' },
      { protocol: 'https', hostname: 'media-3.api-sports.io' },
      { protocol: 'https', hostname: 'media-2.api-sports.io' },
      { protocol: 'https', hostname: 'media-1.api-sports.io' },
      { protocol: 'https', hostname: 'flagcdn.com' },
      { protocol: 'https', hostname: '*.api-sports.io' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600, // Cache optimised images for 1 hour
  },
  async headers() {
    return [
      {
        source: '/api/fixtures/bootstrap',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=180',
          },
        ],
      },
      {
        source: '/api/fixtures/home',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=30, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/api/fixtures/meta',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=45, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/api/fixtures/meta/summary',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=30, stale-while-revalidate=90',
          },
        ],
      },
      {
        // Cache per-match odds at the CDN edge so repeat visits are instant
        source: '/api/odds/fixture/:fixtureId',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
