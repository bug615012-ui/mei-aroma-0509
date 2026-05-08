/** @type {import('next').NextConfig} */
const nextConfig = {
  // 強制無視 TypeScript 錯誤
  typescript: {
    ignoreBuildErrors: true,
  },
  // 強制無視 ESLint 檢查錯誤
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 確保路由不會被舊的 API 干擾
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
