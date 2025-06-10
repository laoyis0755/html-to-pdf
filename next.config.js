/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/html-to-pdf',
  images: {
    unoptimized: true
  },
  webpack: (config, { isServer }) => {
    // 添加对特定模块的支持
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };

    return config;
  },  experimental: {}
};

module.exports = nextConfig;