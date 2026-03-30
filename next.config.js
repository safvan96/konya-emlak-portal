/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.sahibinden.com",
      },
    ],
  },
};

module.exports = nextConfig;
