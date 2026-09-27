/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.espncdn.com" },
      { protocol: "https", hostname: "g.espncdn.com" },
    ],
  },
  // Belt-and-suspenders: Next.js's automatic file tracing should already
  // pick up the bundled font files read via fs.readFile in the graphics
  // routes, but naming them explicitly here guarantees they ship with the
  // deployed function regardless of tracing quirks. (Nested under
  // `experimental` because this project is on Next.js 14 -- the option
  // moved to the top level in Next.js 15.)
  experimental: {
    outputFileTracingIncludes: {
      "/api/admin/graphics/*": ["./assets/fonts/**"],
    },
  },
};

module.exports = nextConfig;
