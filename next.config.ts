import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    clientSegmentCache: true,
  },
  turbopack: {
    root: '/Users/louisbentot/Documents/Recherche App/soleo',
  },
};

export default nextConfig;
