/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Already validated in build
    ignoreBuildErrors: false,
  },
  eslint: {
    // Prevent unneeded lint warnings from blocking build
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // In Vercel serverless environment, do not rewrite to localhost:5001
    if (process.env.VERCEL) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
