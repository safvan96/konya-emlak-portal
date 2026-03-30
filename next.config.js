/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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
