/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生成可独立运行的产物，供 Docker 部署使用
  output: "standalone",
};

module.exports = nextConfig;
