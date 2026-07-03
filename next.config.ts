import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin'],
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
    ];
  },
};

export default nextConfig;
