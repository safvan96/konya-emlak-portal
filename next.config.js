/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.sahibinden.com",
      },
      {
        protocol: "https",
        hostname: "imaj.emlakjet.com",
      },
    ],
  },
};

module.exports = nextConfig;
