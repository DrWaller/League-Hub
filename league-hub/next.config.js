/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.espncdn.com" },
      { protocol: "https", hostname: "g.espncdn.com" },
    ],
  },
};

module.exports = nextConfig;
