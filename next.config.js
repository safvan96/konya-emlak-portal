/** @type {import('next').NextConfig} */
const nextConfig = {
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
