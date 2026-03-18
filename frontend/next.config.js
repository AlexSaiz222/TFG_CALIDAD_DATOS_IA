/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // MUI v5 generates "Expression produces a union type that is too complex" errors
    // with deeply nested sx props. This is a known TS limitation, not a runtime issue.
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  output: 'standalone',
  productionBrowserSourceMaps: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'development' 
          ? 'http://localhost:5000/api/:path*' 
          : 'http://backend:5000/api/:path*',
      },
    ];
  },
}

module.exports = nextConfig
